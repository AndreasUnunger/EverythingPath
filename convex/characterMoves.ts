import { ConvexError, v, compareValues } from 'convex/values';
import { query, internalMutation, type MutationCtx } from './_generated/server';
import { legacyCharacterMutation } from './lib/campaignRuntime';
import {
  requireCharacterAccess,
  requireCharacterCampaignAccess,
} from './lib/characterAccess';
import { requireFixtureCampaign } from './lib/characterSheet';
import type { ReadCtx } from './types';
import type { WithoutSystemFields } from 'convex/server';
import type { Doc, Id } from './_generated/dataModel';

import { internal } from './_generated/api';
import { publishCharacterMoveSpellIndex } from './lib/characterMoveSpells';
import { loadCharacterSheet } from './lib/characterSheet';
import {
  releaseFingerprint,
  releaseByteCount,
} from '../src/lib/catalog/release-schema';
import { readActiveCatalogRelease } from './catalogRelease';
import {
  listCatalogDependencyKeys,
  listCatalogReferences,
  isCatalogKeyedListMember,
  remapCatalogReferences,
  remapCatalogDependencyKeys,
} from '../src/lib/catalog-copy-references';
import {
  characterCopyDefinition,
  planCharacterMove,
} from './lib/characterMovePlan';
import {
  writeCatalogDefinition,
  readReferencedCatalogDefinitions,
  calculateDefinitionFingerprint,
  readCampaignSpellMembershipStamp,
} from './lib/catalogCopies';
import { updateCanonicalCharacter } from './lib/canonicalCharacters';
import { removeCharacterDepartureAssignments } from './lib/canonicalCharacterDeparture';
import { reconcileCompanionRelationships } from './lib/companionRelationships';

type CharacterMoveRootTable =
  | 'characterSheetEntry'
  | 'spellCatalogIndex'
  | 'spellCatalogSummary'
  | 'characterLinkedInput'
  | 'acceptedWarning';
type RootDocument = Doc<CharacterMoveRootTable>;
function stripDocument<Row extends { _id: string; _creationTime: number }>(
  row: Row,
): WithoutSystemFields<Row>;
function stripDocument(row: { _id: string; _creationTime: number }) {
  const { _id, _creationTime, ...body } = row;
  return body;
}
function defineCharacterMoveRoot<Row extends RootDocument>(
  table: CharacterMoveRootTable,
  read: (ctx: ReadCtx, characterId: Id<'character'>) => Promise<Row[]>,
  write: (ctx: MutationCtx, row: Row) => Promise<void>,
  inputSignature: (rows: readonly Row[]) => unknown = (rows) => rows,
) {
  return {
    table,
    read: async (ctx: ReadCtx, characterId: Id<'character'>) => {
      const rows = await read(ctx, characterId);
      if (rows.length > 8192)
        throw new ConvexError(
          'Character movement exceeds the prepared sheet limits',
        );
      return {
        rows,
        inputSignature: inputSignature(rows),
        changes: (remapping: Readonly<Record<string, Id<'catalogEntry'>>>) => {
          const changes: Row[] = [];
          for (const row of rows) {
            let next = row;
            for (const [source, id] of Object.entries(remapping)) {
              next = remapCatalogReferences(next, source, id);
              next = remapCatalogDependencyKeys(next, source, id);
            }
            if (compareValues(row, next) !== 0) changes.push(next);
          }
          return {
            rows: changes,
            publish: async (ctx: MutationCtx) => {
              for (const row of changes) await write(ctx, row);
            },
          };
        },
      };
    },
  };
}
// One typed list includes every per-Character sheet table. Entry unions include
// archetypes, selections and Attack Routines; durable warning/linked-input keys stay intact.
// Familiar species, pending seeded scores and permanent facts are Character fields
// that the in-place arrival patch retains; Companion Relationships stay keyed by Character.
const characterMoveSheetRoots = [
  defineCharacterMoveRoot(
    'characterSheetEntry',
    (ctx, id) =>
      ctx.db
        .query('characterSheetEntry')
        .withIndex('by_characterId', (q) => q.eq('characterId', id))
        .take(8193),
    (ctx, row) =>
      ctx.db.replace('characterSheetEntry', row._id, stripDocument(row)),
  ),
  defineCharacterMoveRoot(
    'spellCatalogIndex',
    (ctx, id) =>
      ctx.db
        .query('spellCatalogIndex')
        .withIndex('by_characterId_and_catalogEntryId', (q) =>
          q.eq('characterId', id),
        )
        .take(8193),
    (ctx, row) =>
      ctx.db.replace('spellCatalogIndex', row._id, stripDocument(row)),
    (rows) =>
      rows
        .map((row) => ({
          catalogEntryId: row.catalogEntryId,
          castingClassId: row.castingClassId,
          ruleIdentity: row.ruleIdentity,
        }))
        .sort(
          (left, right) =>
            left.castingClassId.localeCompare(right.castingClassId) ||
            left.catalogEntryId.localeCompare(right.catalogEntryId) ||
            (left.ruleIdentity ?? '').localeCompare(right.ruleIdentity ?? ''),
        ),
  ),
  defineCharacterMoveRoot(
    'spellCatalogSummary',
    (ctx, id) =>
      ctx.db
        .query('spellCatalogSummary')
        .withIndex(
          'by_characterId_and_castingClassId_and_kind_and_value',
          (q) => q.eq('characterId', id),
        )
        .take(8193),
    (ctx, row) =>
      ctx.db.replace('spellCatalogSummary', row._id, stripDocument(row)),
    () => null,
  ),
  defineCharacterMoveRoot(
    'characterLinkedInput',
    (ctx, id) =>
      ctx.db
        .query('characterLinkedInput')
        .withIndex('by_characterId', (q) => q.eq('characterId', id))
        .take(8193),
    (ctx, row) =>
      ctx.db.replace('characterLinkedInput', row._id, stripDocument(row)),
  ),
  defineCharacterMoveRoot(
    'acceptedWarning',
    (ctx, id) =>
      ctx.db
        .query('acceptedWarning')
        .withIndex('by_characterId', (q) => q.eq('characterId', id))
        .take(8193),
    (ctx, row) =>
      ctx.db.replace('acceptedWarning', row._id, stripDocument(row)),
    () => null,
  ),
];

const progressValidator = v.object({
  generation: v.number(),
  operationId: v.string(),
  state: v.union(
    v.literal('preparing'),
    v.literal('ready'),
    v.literal('completed'),
    v.literal('cancelled'),
  ),
  prepared: v.number(),
  total: v.number(),
  destinationCampaignId: v.optional(v.id('campaign')),
  destinationCampaignName: v.optional(v.string()),
});
function moveProgress(move: Doc<'characterMove'>) {
  return {
    generation: move.generation,
    operationId: move.operationId,
    state: move.state,
    prepared: move.prepared,
    total: move.total,
    destinationCampaignId: move.destinationCampaignId,
    destinationCampaignName: move.destinationCampaignName,
  };
}
async function findMove(
  ctx: ReadCtx,
  characterId: Id<'character'>,
  operationId: string,
) {
  return ctx.db
    .query('characterMove')
    .withIndex('by_characterId_and_operationId', (q) =>
      q.eq('characterId', characterId).eq('operationId', operationId),
    )
    .unique();
}
type MoveCollections = {
  candidateIds: Id<'catalogEntry'>[];
  destinationCandidateIds: Id<'catalogEntry'>[];
  definitionIds: Id<'catalogEntry'>[];
  requiredKeys: string[];
};
type PreparedMove = Doc<'characterMove'> & MoveCollections;
const maxMoveMetadataBytes = 900 * 1024;
function prepareMoveMetadata<Value extends MoveCollections>(value: Value) {
  const {
    candidateIds: _candidateIds,
    destinationCandidateIds: _destinationCandidateIds,
    definitionIds: _definitionIds,
    requiredKeys: _requiredKeys,
    ...metadata
  } = value;
  if (releaseByteCount(metadata) > maxMoveMetadataBytes)
    throw new ConvexError('Move preparation exceeds document limits');
  return metadata;
}
function listMoveReferences(
  value: MoveCollections,
): Doc<'characterMoveReference'>['reference'][] {
  return [
    ...value.candidateIds.map((catalogEntryId) => ({
      kind: 'candidate' as const,
      catalogEntryId,
    })),
    ...value.destinationCandidateIds.map((catalogEntryId) => ({
      kind: 'destination' as const,
      catalogEntryId,
    })),
    ...value.definitionIds.map((catalogEntryId) => ({
      kind: 'definition' as const,
      catalogEntryId,
    })),
    ...value.requiredKeys.map((key) => ({ kind: 'key' as const, key })),
  ];
}
function moveReferenceKey(
  reference: Doc<'characterMoveReference'>['reference'],
) {
  return `${reference.kind}:${reference.kind === 'key' ? reference.key : reference.catalogEntryId}`;
}
async function persistMoveReferences(
  ctx: MutationCtx,
  move: PreparedMove,
  previous?: PreparedMove,
) {
  const existing = new Set(
    previous?.generation === move.generation
      ? listMoveReferences(previous).map(moveReferenceKey)
      : [],
  );
  for (const reference of listMoveReferences(move))
    if (!existing.has(moveReferenceKey(reference)))
      await ctx.db.insert('characterMoveReference', {
        moveId: move._id,
        characterId: move.characterId,
        generation: move.generation,
        reference,
      });
}
async function readPreparedMove(
  ctx: ReadCtx,
  move: Doc<'characterMove'>,
): Promise<PreparedMove> {
  const rows = await ctx.db
    .query('characterMoveReference')
    .withIndex('by_moveId_and_generation', (q) =>
      q.eq('moveId', move._id).eq('generation', move.generation),
    )
    .take(32769);
  if (rows.length > 32768)
    throw new ConvexError('Character has too many catalog dependencies');
  const collections: MoveCollections = {
    candidateIds: [],
    destinationCandidateIds: [],
    definitionIds: [],
    requiredKeys: [],
  };
  for (const { reference } of rows) {
    if (reference.kind === 'key') collections.requiredKeys.push(reference.key);
    else if (reference.kind === 'candidate')
      collections.candidateIds.push(reference.catalogEntryId);
    else if (reference.kind === 'destination')
      collections.destinationCandidateIds.push(reference.catalogEntryId);
    else collections.definitionIds.push(reference.catalogEntryId);
  }
  collections.definitionIds.sort((a, b) => a.localeCompare(b));
  return { ...move, ...collections };
}
async function patchPreparation(
  ctx: MutationCtx,
  previous: PreparedMove,
  next: PreparedMove,
) {
  await persistMoveReferences(ctx, next, previous);
  const { _id, _creationTime, ...metadata } = prepareMoveMetadata(next);
  await ctx.db.patch('characterMove', next._id, metadata);
}
async function resetPreparation(
  ctx: MutationCtx,
  move: PreparedMove,
  inputs: Awaited<ReturnType<typeof readInputs>>,
): Promise<ReturnType<typeof moveProgress>> {
  const next = {
    ...move,
    ...buildPreparation(inputs),
    generation: move.generation + 1,
    prepared: 0,
    state: 'preparing' as const,
  };
  await patchPreparation(ctx, move, next);
  await ctx.scheduler.runAfter(0, internal.characterMoves.cleanup, {
    characterId: move.characterId,
  });
  return discover(ctx, next);
}
async function readInputs(
  ctx: ReadCtx,
  {
    characterId,
    candidateIds = [],
    destinationCampaignId,
    destinationCandidateIds = [],
  }: {
    characterId: Id<'character'>;
    candidateIds?: readonly Id<'catalogEntry'>[];
    destinationCampaignId?: Id<'campaign'>;
    destinationCandidateIds?: readonly Id<'catalogEntry'>[];
  },
) {
  const sheet = await loadCharacterSheet(
    ctx,
    { characterId },
    { isWritable: true },
  );
  if (!sheet) throw new ConvexError('Character has no sheet');
  const [roots, release, associated, companion] = await Promise.all([
    Promise.all(
      characterMoveSheetRoots.map((root) => root.read(ctx, characterId)),
    ),
    readActiveCatalogRelease(ctx),
    ctx.db
      .query('companionRelationship')
      .withIndex('by_associatedCharacterId', (q) =>
        q.eq('associatedCharacterId', characterId),
      )
      .take(1025),
    ctx.db
      .query('companionRelationship')
      .withIndex('by_companionCharacterId', (q) =>
        q.eq('companionCharacterId', characterId),
      )
      .take(1025),
  ]);
  if (associated.length > 1024 || companion.length > 1024)
    throw new ConvexError(
      'Character movement exceeds the prepared sheet limits',
    );
  const ownDefinitions = await ctx.db
    .query('catalogEntry')
    .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
    .take(8193);
  if (ownDefinitions.length > 8192)
    throw new ConvexError('Character has too many local catalog dependencies');
  const candidates = await Promise.all(
    candidateIds.map((id) => ctx.db.get('catalogEntry', id)),
  );
  if (candidates.some((row) => !row))
    throw new ConvexError(
      'A catalog dependency disappeared; cancel and start a new move',
    );
  const definitions = await readReferencedCatalogDefinitions(
    ctx,
    sheet.character,
    [
      ...sheet.catalogEntries,
      ...ownDefinitions,
      ...candidates.filter((row) => row !== null),
    ],
    roots.flatMap((root) => listCatalogReferences(root.rows)),
  );
  const destinationDefinitions = await Promise.all(
    destinationCandidateIds.map((id) => ctx.db.get('catalogEntry', id)),
  );
  if (
    destinationDefinitions.some(
      (row) =>
        row?.scope !== 'campaign' || row.campaignId !== destinationCampaignId,
    )
  )
    throw new ConvexError(
      'Destination catalog changed; cancel and start a new move',
    );
  const plan = await planCharacterMove({
    characterId,
    sourceCampaignId: sheet.character.campaignId,
    retainedDefinitionIds: Object.values(
      sheet.character.carriedCatalogReferences ?? {},
    ),
    sheet: roots.map((root) => root.rows),
    definitions,
  });
  const needed = new Set(plan.requiredDefinitionIds);
  const requiredDefinitions = definitions
    .filter((row) => needed.has(row._id))
    .sort((a, b) => a._id.localeCompare(b._id));
  const sourceFingerprints: Record<string, string> = {};
  for (const row of requiredDefinitions.filter(
    (row) => row.scope === 'campaign',
  )) {
    const raw = await ctx.db.get('catalogEntry', row._id);
    if (!raw) throw new ConvexError('Catalog dependency disappeared');
    sourceFingerprints[row._id] = await calculateDefinitionFingerprint(raw);
  }
  const fingerprint = await releaseFingerprint({
    character: {
      characterId: sheet.character._id,
      campaignId: sheet.character.campaignId,
      ownerId: sheet.character.ownerId,
      carriedCatalogReferences: sheet.character.carriedCatalogReferences,
      baseScores: sheet.baseScoresEntry,
    },
    roots: roots.map((root) => root.inputSignature),
    release,
    associated,
    companion,
  });
  return {
    sheet,
    roots,
    sourceSpellMembershipStamp: await readCampaignSpellMembershipStamp(
      ctx,
      sheet.character.campaignId,
    ),
    destinationSpellMembershipStamp: await readCampaignSpellMembershipStamp(
      ctx,
      destinationCampaignId,
    ),
    fingerprint,
    sourceFingerprints,
    destinationDefinitions: destinationDefinitions.filter(
      (row) => row !== null,
    ),
    definitions: requiredDefinitions,
  };
}
async function reconcileStagedDefinitions(
  ctx: MutationCtx,
  move: PreparedMove,
  inputs: Awaited<ReturnType<typeof readInputs>>,
) {
  const staged = await ctx.db
    .query('characterMoveDefinition')
    .withIndex('by_moveId_and_generation', (q) =>
      q.eq('moveId', move._id).eq('generation', move.generation),
    )
    .take(8193);
  if (
    staged.length !== inputs.definitions.length ||
    staged.some(
      (row) =>
        !inputs.definitions.some(
          (definition) => definition._id === row.sourceId,
        ),
    )
  )
    return { kind: 'closure_changed' as const };
  const staleStaging = staged.some((row) => {
    const current = inputs.definitions.find(
      (definition) => definition._id === row.sourceId,
    );
    if (!current) return true;
    const { _id: _id, _creationTime: _time, ...body } = current;
    return compareValues(body, row.definition) !== 0;
  });
  if (staleStaging) {
    let changed = 0;
    for (const row of staged) {
      const current = inputs.definitions.find(
        (definition) => definition._id === row.sourceId,
      );
      if (!current) return { kind: 'closure_changed' as const };
      const { _id: _id, _creationTime: _time, ...definition } = current;
      if (compareValues(definition, row.definition) === 0) continue;
      await ctx.db.patch('characterMoveDefinition', row._id, { definition });
      changed += 1;
      if (changed === 32) break;
    }
    return { kind: 'refreshed' as const };
  }
  const definitions: Doc<'catalogEntry'>[] = staged.map((row) => ({
    ...row.definition,
    _id: row.sourceId,
    _creationTime: row.sourceCreatedAt,
  }));
  return { kind: 'current' as const, definitions };
}

async function publish(
  ctx: MutationCtx,
  move: PreparedMove,
  inputs: Awaited<ReturnType<typeof readInputs>>,
) {
  const { sheet } = inputs;
  if (inputs.fingerprint !== move.fingerprint)
    return resetPreparation(ctx, move, inputs);
  const staging = await reconcileStagedDefinitions(ctx, move, inputs);
  if (staging.kind === 'closure_changed')
    return resetPreparation(ctx, move, inputs);
  if (staging.kind === 'refreshed') return moveProgress(move);
  const { definitions } = staging;
  const plan = await planCharacterMove({
    characterId: move.characterId,
    sourceCampaignId: move.sourceCampaignId,
    retainedDefinitionIds: Object.values(
      sheet.character.carriedCatalogReferences ?? {},
    ),
    sourceFingerprints: inputs.sourceFingerprints,
    sheet: inputs.roots.map((root) => root.rows),
    definitions,
    allocateId: async (source) =>
      writeCatalogDefinition(
        ctx,
        await characterCopyDefinition(
          source,
          move.characterId,
          inputs.sourceFingerprints[source._id],
        ),
      ),
  });
  if (!plan.complete) throw new ConvexError('Move preparation is incomplete');
  const changedRoots = inputs.roots.map((root) => root.changes(plan.remapping));
  const plannedWrites =
    plan.copies.length +
    plan.updates.length +
    changedRoots.reduce((total, root) => total + root.rows.length, 0) +
    256;
  const plannedBytes = releaseByteCount({
    copies: plan.copies,
    updates: plan.updates,
    roots: changedRoots.map((root) => root.rows),
  });
  const publicationMetrics = await ctx.meta.getTransactionMetrics();
  if (
    plannedWrites > publicationMetrics.documentsWritten.remaining ||
    plannedBytes + 1024 * 1024 > publicationMetrics.bytesWritten.remaining
  )
    throw new ConvexError(
      'This move exceeds atomic publication limits; the Character remains in its current campaign',
    );
  for (const copy of plan.copies)
    await writeCatalogDefinition(ctx, copy.definition, copy.id);
  for (const update of plan.updates)
    await writeCatalogDefinition(ctx, update.definition, update.id);
  for (const root of changedRoots) await root.publish(ctx);
  return publishCharacterArrival(ctx, move, inputs, definitions, plan);
}
async function publishCharacterArrival(
  ctx: MutationCtx,
  move: PreparedMove,
  inputs: Awaited<ReturnType<typeof readInputs>>,
  definitions: readonly Doc<'catalogEntry'>[],
  plan: {
    remapping: Record<string, Id<'catalogEntry'>>;
    copies: readonly { id: Id<'catalogEntry'> }[];
  },
) {
  const { sheet } = inputs;
  const carriedCatalogReferences = {
    ...Object.fromEntries(
      Object.entries(sheet.character.carriedCatalogReferences ?? {}).map(
        ([origin, selected]) => [origin, plan.remapping[selected] ?? selected],
      ),
    ),
    ...plan.remapping,
  };
  for (const definition of definitions) {
    const copyId = plan.remapping[definition._id];
    if (
      definition.scope === 'campaign' &&
      definition.campaignPreference &&
      definition.copiedFrom &&
      !carriedCatalogReferences[definition.copiedFrom] &&
      copyId
    )
      carriedCatalogReferences[definition.copiedFrom] = copyId;
  }
  if (Object.keys(carriedCatalogReferences).length > 1024)
    throw new ConvexError(
      'Carried catalog selection exceeds the 1024-reference document limit; the Character remains in its current campaign',
    );
  await removeCharacterDepartureAssignments(ctx, {
    characterId: move.characterId,
    sourceCampaignId: move.sourceCampaignId,
    characterName: sheet.character.name,
    actor: move.actor,
  });
  await ctx.db.patch('character', move.characterId, {
    campaignId: move.destinationCampaignId,
    carriedCatalogReferences,
    sheetMode: 'full',
    ...(move.destinationCampaignId
      ? {}
      : { sheetDemo: sheet.character.sheetDemo ?? true }),
    sheetRevision: (inputs.sheet.character.sheetRevision ?? 0) + 1,
    sheetLastOperationId: move.operationId,
    sheetUpdatedBy: move.actor,
  });
  const published = await loadCharacterSheet(ctx, {
    characterId: move.characterId,
  });
  if (!published) throw new ConvexError('Published sheet unavailable');
  const copies = await Promise.all(
    plan.copies.map((copy) => ctx.db.get('catalogEntry', copy.id)),
  );
  await publishCharacterMoveSpellIndex(ctx, {
    characterId: move.characterId,
    destinationCampaignId: move.destinationCampaignId,
    entries: published.entries,
    destinationDefinitions: inputs.destinationDefinitions,
    definitions: [
      ...published.catalogEntries,
      ...definitions.filter(
        (row) =>
          row.scope === 'global' &&
          row.detail.kind === 'spell' &&
          !published.catalogEntries.some((current) => current._id === row._id),
      ),
      ...copies.filter((row) => row !== null),
    ],
  });
  await updateCanonicalCharacter(ctx, move.characterId);
  await reconcileCompanionRelationships(
    ctx,
    move.characterId,
    move.operationId,
  );
  await ctx.db.patch('characterMove', move._id, { state: 'completed' });
  await ctx.scheduler.runAfter(0, internal.characterMoves.cleanup, {
    characterId: move.characterId,
  });
  return { ...moveProgress(move), state: 'completed' as const };
}
function buildPreparation(inputs: Awaited<ReturnType<typeof readInputs>>) {
  const requiredKeys = [
    ...new Set([
      ...inputs.definitions.flatMap(listCatalogDependencyKeys),
      ...inputs.roots.flatMap((root) => listCatalogDependencyKeys(root.rows)),
    ]),
  ];
  if (requiredKeys.length > 8192)
    throw new ConvexError('Character has too many required catalog keys');
  return {
    destinationCandidateIds: Array<Id<'catalogEntry'>>(),
    requiredKeys,
    candidateIds: Array<Id<'catalogEntry'>>(),
    scanPhase: 'campaignSpells' as const,
    scanCursor: null,
    fingerprint: inputs.fingerprint,
    sourceRevision: inputs.sheet.character.sheetRevision ?? 0,
    sourceSpellMembershipStamp: inputs.sourceSpellMembershipStamp,
    destinationSpellMembershipStamp: inputs.destinationSpellMembershipStamp,
    definitionIds: inputs.definitions.map((row) => row._id),
    total: inputs.definitions.length,
  };
}
async function advance(ctx: MutationCtx, storedMove: Doc<'characterMove'>) {
  let move = await readPreparedMove(ctx, storedMove);
  const access = await requireOwner(
    ctx,
    move.characterId,
    move.destinationCampaignId,
  );
  if (
    !move.destinationCampaignId &&
    !access.character.sheetDemo &&
    !access.user.characterSheetDemo
  )
    throw new ConvexError(
      "Private character sheets aren't available for this account yet.",
    );
  if (move.actor !== access.user.tokenIdentifier)
    throw new ConvexError('Only the current owner can resume this move');
  if (move.state === 'completed' || move.state === 'cancelled')
    return moveProgress(move);
  if (access.character.campaignId !== move.sourceCampaignId)
    throw new ConvexError('Character campaign changed; start a new move');
  const [sourceStamp, destinationStamp] = await Promise.all([
    readCampaignSpellMembershipStamp(ctx, move.sourceCampaignId),
    readCampaignSpellMembershipStamp(ctx, move.destinationCampaignId),
  ]);
  if (
    sourceStamp !== move.sourceSpellMembershipStamp ||
    destinationStamp !== move.destinationSpellMembershipStamp
  )
    return resetPreparation(
      ctx,
      move,
      await readInputs(ctx, {
        characterId: move.characterId,
        destinationCampaignId: move.destinationCampaignId,
      }),
    );
  const hasRevisionChanged =
    (access.character.sheetRevision ?? 0) !== move.sourceRevision;
  const currentInputs =
    hasRevisionChanged || move.state === 'ready'
      ? await readInputs(ctx, {
          characterId: move.characterId,
          candidateIds: move.candidateIds,
          destinationCampaignId: move.destinationCampaignId,
          destinationCandidateIds: move.destinationCandidateIds,
        })
      : undefined;
  if (hasRevisionChanged && currentInputs) {
    if (currentInputs.fingerprint !== move.fingerprint)
      return resetPreparation(ctx, move, currentInputs);
    const sourceRevision = access.character.sheetRevision ?? 0;
    await ctx.db.patch('characterMove', move._id, { sourceRevision });
    move = { ...move, sourceRevision };
  }
  if (move.scanPhase !== 'done') return discover(ctx, move);
  if (move.state === 'ready' && currentInputs)
    return publish(ctx, move, currentInputs);
  return stage(ctx, move, currentInputs);
}
async function readDiscoveryPage(
  ctx: ReadCtx,
  move: PreparedMove,
  phase: Exclude<Doc<'characterMove'>['scanPhase'], 'done'>,
) {
  const campaignIds = {
    globalKeys: undefined,
    destinationSpells: move.destinationCampaignId,
    campaignKeys: move.sourceCampaignId,
    campaignSpells: move.sourceCampaignId,
  };
  const campaignId = campaignIds[phase];
  const scope = phase === 'globalKeys' ? 'global' : 'campaign';
  return ctx.db
    .query('catalogEntry')
    .withIndex('by_campaignId_and_scope_and_detail_kind', (q) => {
      return q
        .eq('campaignId', campaignId)
        .eq('scope', scope)
        .eq('detail.kind', 'spell');
    })
    .paginate({
      cursor: move.scanCursor,
      numItems: 32,
      maximumRowsRead: 32,
      maximumBytesRead: 1024 * 1024,
    });
}
async function discover(
  ctx: MutationCtx,
  preparedMove: PreparedMove,
): Promise<ReturnType<typeof moveProgress>> {
  let move = preparedMove;
  while (move.scanPhase !== 'done') {
    const phase = move.scanPhase;
    if (
      !move.sourceCampaignId &&
      phase !== 'globalKeys' &&
      phase !== 'destinationSpells'
    ) {
      move = { ...move, scanPhase: 'globalKeys', scanCursor: null };
      continue;
    }
    if (phase === 'destinationSpells' && !move.destinationCampaignId) {
      move = { ...move, scanPhase: 'done', scanCursor: null };
      continue;
    }
    const page = await readDiscoveryPage(ctx, move, phase);
    const keys = new Set(move.requiredKeys);
    const candidates = new Set(
      phase === 'destinationSpells'
        ? move.destinationCandidateIds
        : move.candidateIds,
    );
    for (const row of page.page)
      if (isCatalogKeyedListMember(row, keys)) candidates.add(row._id);
    if (candidates.size > 8192)
      throw new ConvexError('Character has too many keyed dependencies');
    const nextScanPhase = {
      campaignSpells: 'globalKeys',
      campaignKeys: 'globalKeys',
      globalKeys: 'destinationSpells',
      destinationSpells: 'done',
    } as const;
    const scanPhase = page.isDone ? nextScanPhase[phase] : phase;
    const scanCursor = page.isDone ? null : page.continueCursor;
    const previous = move;
    move = {
      ...move,
      ...(phase === 'destinationSpells'
        ? { destinationCandidateIds: [...candidates] }
        : { candidateIds: [...candidates] }),
      scanPhase,
      scanCursor,
    };
    await patchPreparation(ctx, previous, move);
    if (page.page.length && scanPhase !== 'done') return moveProgress(move);
  }
  const inputs = await readInputs(ctx, {
    characterId: move.characterId,
    candidateIds: move.candidateIds,
    destinationCampaignId: move.destinationCampaignId,
    destinationCandidateIds: move.destinationCandidateIds,
  });
  const keys = new Set([
    ...inputs.definitions.flatMap(listCatalogDependencyKeys),
    ...inputs.roots.flatMap((root) => listCatalogDependencyKeys(root.rows)),
  ]);
  if (keys.size > 8192)
    throw new ConvexError('Character has too many required catalog keys');
  const newKeys = [...keys].some((key) => !move.requiredKeys.includes(key));
  const next = {
    ...buildPreparation(inputs),
    fingerprint: move.fingerprint,
    sourceSpellMembershipStamp: move.sourceSpellMembershipStamp,
    destinationSpellMembershipStamp: move.destinationSpellMembershipStamp,
    candidateIds: move.candidateIds,
    destinationCandidateIds: move.destinationCandidateIds,
    scanPhase: newKeys ? ('campaignSpells' as const) : ('done' as const),
    requiredKeys: [...keys],
  };
  await patchPreparation(ctx, move, { ...move, ...next });
  move = { ...move, ...next };
  return newKeys ? moveProgress(move) : stage(ctx, move, inputs);
}
async function stage(
  ctx: MutationCtx,
  move: PreparedMove,
  inputs?: Awaited<ReturnType<typeof readInputs>>,
): Promise<ReturnType<typeof moveProgress>> {
  const currentInputs =
    inputs ??
    (await readInputs(ctx, {
      characterId: move.characterId,
      candidateIds: move.candidateIds,
      destinationCampaignId: move.destinationCampaignId,
      destinationCandidateIds: move.destinationCandidateIds,
    }));
  const ids = move.definitionIds.slice(move.prepared, move.prepared + 32);
  let count = 0;
  let bytes = 0;
  for (const id of ids) {
    const row = currentInputs.definitions.find(
      (definition) => definition._id === id,
    );
    if (!row) return resetPreparation(ctx, move, currentInputs);
    const { _id, _creationTime, ...definition } = row;
    const size = releaseByteCount(definition);
    if (count > 0 && bytes + size > 1024 * 1024) break;
    await ctx.db.insert('characterMoveDefinition', {
      moveId: move._id,
      characterId: move.characterId,
      generation: move.generation,
      sourceId: _id,
      sourceCreatedAt: _creationTime,
      definition,
    });
    count += 1;
    bytes += size;
  }
  const prepared = move.prepared + count;
  const state =
    prepared === move.total ? ('ready' as const) : ('preparing' as const);
  await ctx.db.patch('characterMove', move._id, { prepared, state });
  return { ...moveProgress(move), prepared, state };
}

const scope = { characterId: v.id('character') };
async function requireOwner(
  ctx: ReadCtx,
  characterId: Id<'character'>,
  destinationCampaignId?: Id<'campaign'>,
) {
  const access = await requireCharacterAccess(ctx, { characterId });
  if (access.character.ownerId !== access.user.tokenIdentifier)
    throw new ConvexError(
      'Only the current owner can leave or move a Character',
    );
  if (destinationCampaignId)
    await requireCharacterCampaignAccess(ctx, {
      campaignId: destinationCampaignId,
    });
  if (access.campaign) {
    requireFixtureCampaign(access.campaign);
  } else if (!access.character.sheetDemo)
    throw new ConvexError(
      "Editing isn't available for this character sheet yet.",
    );
  if (destinationCampaignId) {
    const destination = await ctx.db.get('campaign', destinationCampaignId);
    if (!destination) throw new ConvexError('Destination campaign not found');
    requireFixtureCampaign(destination);
  }
  return access;
}
export const start = legacyCharacterMutation({
  args: {
    ...scope,
    destinationCampaignId: v.optional(v.id('campaign')),
    operationId: v.string(),
  },
  returns: progressValidator,
  handler: async (ctx, args) => {
    const access = await requireOwner(
      ctx,
      args.characterId,
      args.destinationCampaignId,
    );
    if (
      !args.destinationCampaignId &&
      !access.character.sheetDemo &&
      !access.user.characterSheetDemo
    )
      throw new ConvexError(
        "Private character sheets aren't available for this account yet.",
      );
    if (!args.operationId.trim() || args.operationId.length > 200)
      throw new ConvexError('Enter a move operation identifier');
    const previous = await findMove(ctx, args.characterId, args.operationId);
    if (previous) {
      if (
        previous.destinationCampaignId !== args.destinationCampaignId ||
        previous.actor !== access.user.tokenIdentifier
      )
        throw new ConvexError('Move operation already used');
      return moveProgress(previous);
    }
    if (access.character.campaignId === args.destinationCampaignId)
      throw new ConvexError('Choose a different campaign');
    const pending = await ctx.db
      .query('characterMove')
      .withIndex('by_characterId', (q) => q.eq('characterId', args.characterId))
      .order('desc')
      .first();
    if (
      pending &&
      (pending.state === 'preparing' || pending.state === 'ready')
    ) {
      await ctx.db.patch('characterMove', pending._id, { state: 'cancelled' });
      await ctx.scheduler.runAfter(0, internal.characterMoves.cleanup, {
        characterId: args.characterId,
      });
    }
    const inputs = await readInputs(ctx, {
      characterId: args.characterId,
      destinationCampaignId: args.destinationCampaignId,
    });
    const operation = {
      characterId: args.characterId,
      operationId: args.operationId,
      actor: access.user.tokenIdentifier,
      sourceCampaignId: access.character.campaignId,
      destinationCampaignId: args.destinationCampaignId,
      destinationCampaignName: args.destinationCampaignId
        ? (await ctx.db.get('campaign', args.destinationCampaignId))?.name
        : undefined,
      ...buildPreparation(inputs),
      generation: 0,
      prepared: 0,
      state: 'preparing' as const,
    };
    const id = await ctx.db.insert(
      'characterMove',
      prepareMoveMetadata(operation),
    );
    const move = await ctx.db.get('characterMove', id);
    if (!move) throw new ConvexError('Move unavailable');
    const preparedMove = { ...move, ...buildPreparation(inputs) };
    await persistMoveReferences(ctx, preparedMove);
    return discover(ctx, preparedMove);
  },
});
export const resume = legacyCharacterMutation({
  args: { ...scope, operationId: v.string() },
  returns: progressValidator,
  handler: async (ctx, args) => {
    const move = await findMove(ctx, args.characterId, args.operationId);
    if (!move) throw new ConvexError('Move not found');
    return advance(ctx, move);
  },
});
export const status = query({
  args: { ...scope, operationId: v.optional(v.string()) },
  returns: v.union(progressValidator, v.null()),
  handler: async (ctx, args) => {
    const access = await requireOwner(ctx, args.characterId);
    const move = args.operationId
      ? await findMove(ctx, args.characterId, args.operationId)
      : await ctx.db
          .query('characterMove')
          .withIndex('by_characterId', (q) =>
            q.eq('characterId', args.characterId),
          )
          .order('desc')
          .first();
    if (
      move?.state !== 'completed' &&
      move &&
      (move.actor !== access.user.tokenIdentifier ||
        move.sourceCampaignId !== access.character.campaignId)
    )
      return { ...moveProgress(move), state: 'cancelled' as const };
    if (move?.state !== 'completed' && move?.destinationCampaignId) {
      const destination = await ctx.db.get(
        'campaign',
        move.destinationCampaignId,
      );
      if (
        !destination?.e2eFixture ||
        !access.user.orgIds.some(
          (row) => row.orgId === destination.organizationId,
        )
      )
        return { ...moveProgress(move), state: 'cancelled' as const };
    }
    return move ? moveProgress(move) : null;
  },
});
export const destinations = query({
  args: scope,
  returns: v.object({
    available: v.boolean(),
    isOwner: v.boolean(),
    currentCampaignId: v.optional(v.id('campaign')),
    currentCampaignHasMilitia: v.boolean(),
    departureRoles: v.array(v.string()),
    destinations: v.array(
      v.object({
        campaignId: v.id('campaign'),
        campaignName: v.string(),
        organizationId: v.string(),
        hasMilitia: v.boolean(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const { character, user, campaign } = await requireCharacterAccess(
      ctx,
      args,
    );
    const available = Boolean(
      campaign ? campaign.e2eFixture : character.sheetDemo,
    );
    const isOwner = character.ownerId === user.tokenIdentifier;
    const currentCampaignId = character.campaignId;
    const militia = currentCampaignId
      ? await ctx.db
          .query('militia')
          .withIndex('by_campaign', (q) =>
            q.eq('campaignId', currentCampaignId),
          )
          .unique()
      : null;
    const canonical = militia
      ? await ctx.db
          .query('canonicalMilitiaState')
          .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
          .unique()
      : null;
    const departureRoles: string[] = [];
    if (
      canonical?.snapshot.roster.people.some(
        (person) => person.characterId === character._id,
      )
    )
      departureRoles.push('Militia roster');
    for (const officer of canonical?.snapshot.roster.officers ?? [])
      if (officer.characterId === character._id)
        departureRoles.push(`Officer: ${officer.role}`);
    for (const team of canonical?.snapshot.roster.teams ?? [])
      if (team.managerCharacterId === character._id)
        departureRoles.push(`Team manager: ${team.name}`);
    const currentCampaignHasMilitia = Boolean(militia);
    if (!available || !isOwner)
      return {
        available,
        isOwner,
        currentCampaignId: character.campaignId,
        currentCampaignHasMilitia,
        departureRoles,
        destinations: [],
      };
    const destinations = [];
    for (const { orgId } of user.orgIds) {
      const campaigns = await ctx.db
        .query('campaign')
        .withIndex('by_organization', (q) => q.eq('organizationId', orgId))
        .take(257);
      if (campaigns.length > 256)
        throw new ConvexError('Too many campaigns to load');
      for (const c of campaigns) {
        if (!c.e2eFixture || c._id === character.campaignId) continue;
        const militia = await ctx.db
          .query('militia')
          .withIndex('by_campaign', (q) => q.eq('campaignId', c._id))
          .unique();
        destinations.push({
          campaignId: c._id,
          campaignName: c.name,
          organizationId: c.organizationId,
          hasMilitia: Boolean(militia),
        });
      }
    }
    return {
      available,
      isOwner,
      currentCampaignId: character.campaignId,
      currentCampaignHasMilitia,
      departureRoles,
      destinations,
    };
  },
});

export const cancel = legacyCharacterMutation({
  args: { ...scope, operationId: v.string() },
  returns: progressValidator,
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.characterId);
    const move = await findMove(ctx, args.characterId, args.operationId);
    if (!move) throw new ConvexError('Move not found');
    if (move.state === 'completed') return moveProgress(move);
    await ctx.db.patch('characterMove', move._id, { state: 'cancelled' });
    await ctx.scheduler.runAfter(0, internal.characterMoves.cleanup, {
      characterId: args.characterId,
    });
    return { ...moveProgress(move), state: 'cancelled' as const };
  },
});

// Housekeeping never changes live Character/catalog state. Authorized deletion
// and terminal operations retain this bounded cleanup across maintenance epochs.
export const cleanup = internalMutation({
  args: { characterId: v.id('character') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const character = await ctx.db.get('character', args.characterId);
    const rows = await ctx.db
      .query('characterMoveDefinition')
      .withIndex('by_characterId', (q) => q.eq('characterId', args.characterId))
      .take(32);
    let deleted = 0;
    for (const row of rows) {
      const move = await ctx.db.get('characterMove', row.moveId);
      if (
        !character ||
        !move ||
        move.state === 'completed' ||
        move.state === 'cancelled' ||
        row.generation !== move.generation ||
        move.actor !== character.ownerId ||
        move.sourceCampaignId !== character.campaignId
      ) {
        await ctx.db.delete('characterMoveDefinition', row._id);
        deleted += 1;
      }
    }
    const references = await ctx.db
      .query('characterMoveReference')
      .withIndex('by_characterId', (q) => q.eq('characterId', args.characterId))
      .take(32);
    let deletedReferences = 0;
    for (const row of references) {
      const move = await ctx.db.get('characterMove', row.moveId);
      if (
        !character ||
        !move ||
        move.state === 'completed' ||
        move.state === 'cancelled' ||
        row.generation !== move.generation ||
        move.actor !== character.ownerId ||
        move.sourceCampaignId !== character.campaignId
      ) {
        await ctx.db.delete('characterMoveReference', row._id);
        deletedReferences += 1;
      }
    }
    if (!character) {
      const moves = await ctx.db
        .query('characterMove')
        .withIndex('by_characterId', (q) =>
          q.eq('characterId', args.characterId),
        )
        .take(32);
      for (const move of moves) await ctx.db.delete('characterMove', move._id);
      if (moves.length === 32 || rows.length === 32 || references.length === 32)
        await ctx.scheduler.runAfter(0, internal.characterMoves.cleanup, args);
    } else if (deleted === 32 || deletedReferences === 32)
      await ctx.scheduler.runAfter(0, internal.characterMoves.cleanup, args);
    return null;
  },
});
