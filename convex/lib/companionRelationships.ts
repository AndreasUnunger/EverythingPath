import {
  representativeCompanionRules,
  listCuratedCompanionInputs,
  type CompanionSourceRuleKind,
} from '../../src/lib/catalog/representative-companion-rules';
import {
  linkedInputKey,
  type CompanionLinkedInput,
} from '../../src/lib/character-sheet-linked-inputs';
import { ConvexError } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { ReadCtx } from '../types';
import type { MutationCtx } from '../_generated/server';
import { readCharacterSheetData } from './preparedCharacterSheet';
import {
  characterSheetClassFamily,
  formatGrantKeyId,
} from '../../src/lib/character-sheet-grants';

const maxRelationships = 1024;
type Relationship = Doc<'companionRelationship'>;
type CompanionSheet = Awaited<ReturnType<typeof readCharacterSheetData>>;
export type CompanionInterruption =
  | 'manual'
  | 'support'
  | 'access'
  | 'conflict'
  | 'cycle'
  | null;

export function isCompatibleCompanionEndpoint(
  associated: Doc<'character'> | null,
  companion: Doc<'character'> | null,
) {
  return Boolean(
    associated &&
    companion &&
    (associated.campaignId
      ? associated.campaignId === companion.campaignId
      : !companion.campaignId &&
        associated.ownerId &&
        associated.ownerId === companion.ownerId),
  );
}

export function isSupportingSourceAvailable(
  source: Relationship['sources'][number],
  countingEntries?: Set<string>,
) {
  return source.sheetEntryId
    ? Boolean(countingEntries?.has(source.sheetEntryId))
    : source.grantKey
      ? Boolean(countingEntries?.has(formatGrantKeyId(source.grantKey)))
      : true;
}

export function hasAvailableSupportingSource(
  sources: Relationship['sources'],
  countingEntries?: Set<string>,
) {
  return sources.some(
    (source) =>
      source.enabled && isSupportingSourceAvailable(source, countingEntries),
  );
}

async function readConnectedRelationships(
  ctx: ReadCtx,
  characterId: Id<'character'>,
  sheets: Map<Id<'character'>, CompanionSheet>,
) {
  const pending = [characterId];
  const visited = new Set<Id<'character'>>();
  const relationships = new Map<Id<'companionRelationship'>, Relationship>();
  const characters = new Map<Id<'character'>, Doc<'character'> | null>();
  for (const id of pending) {
    if (visited.has(id)) continue;
    visited.add(id);
    if (visited.size > maxRelationships)
      throw new ConvexError('Too many connected Companions');
    characters.set(
      id,
      sheets.get(id)?.character ?? (await ctx.db.get('character', id)),
    );
    const groups = await Promise.all([
      ctx.db
        .query('companionRelationship')
        .withIndex('by_associatedCharacterId', (q) =>
          q.eq('associatedCharacterId', id),
        )
        .take(maxRelationships + 1),
      ctx.db
        .query('companionRelationship')
        .withIndex('by_companionCharacterId', (q) =>
          q.eq('companionCharacterId', id),
        )
        .take(maxRelationships + 1),
    ]);
    for (const row of groups.flat()) {
      relationships.set(row._id, row);
      if (relationships.size > maxRelationships)
        throw new ConvexError('Too many connected Companion Relationships');
      pending.push(row.associatedCharacterId, row.companionCharacterId);
    }
  }
  return { relationships, characters };
}

export function getCompanionSupportingEntryKeys(sheet: CompanionSheet | null) {
  return new Set([
    ...(sheet?.calculated.resolvedEntries
      .filter((entry) => entry.counting)
      .flatMap((entry) => [
        entry.entry._id,
        ...(entry.storedEntryId ? [entry.storedEntryId] : []),
      ]) ?? []),
    ...(sheet?.entries
      .filter((entry) => entry.kind === 'classLevel' && entry.active)
      .map((entry) => entry._id) ?? []),
  ]);
}

function determineInterruption({
  row,
  characters,
  countingEntries,
  active,
}: {
  row: Relationship;
  characters: Map<Id<'character'>, Doc<'character'> | null>;
  countingEntries: Map<Id<'character'>, Set<string>>;
  active: Map<Id<'character'>, Relationship>;
}): CompanionInterruption {
  if (row.manuallyInterrupted) return 'manual';
  if (
    !isCompatibleCompanionEndpoint(
      characters.get(row.associatedCharacterId) ?? null,
      characters.get(row.companionCharacterId) ?? null,
    )
  )
    return 'access';
  if (
    !hasAvailableSupportingSource(
      row.sources,
      countingEntries.get(row.associatedCharacterId),
    )
  )
    return 'support';
  if (active.has(row.companionCharacterId)) return 'conflict';
  if (
    doesCreateCompanionCycle(
      active,
      row.associatedCharacterId,
      row.companionCharacterId,
    )
  )
    return 'cycle';
  return null;
}

export async function readCompanionGraph(
  ctx: ReadCtx,
  characterId: Id<'character'>,
  loadedSheets: CompanionSheet[] = [],
) {
  const sheets = new Map(
    loadedSheets.map((sheet) => [sheet.character._id, sheet]),
  );
  const { relationships, characters } = await readConnectedRelationships(
    ctx,
    characterId,
    sheets,
  );
  const countingEntries = new Map<Id<'character'>, Set<string>>();
  for (const row of relationships.values()) {
    if (
      countingEntries.has(row.associatedCharacterId) ||
      !row.sources.some(
        (source) =>
          source.sheetEntryId !== undefined || source.grantKey !== undefined,
      )
    )
      continue;
    const character = characters.get(row.associatedCharacterId);
    const sheet =
      sheets.get(row.associatedCharacterId) ??
      (character?.sheetMode
        ? await readCharacterSheetData(ctx, character)
        : null);
    if (sheet) sheets.set(row.associatedCharacterId, sheet);
    countingEntries.set(
      row.associatedCharacterId,
      getCompanionSupportingEntryKeys(sheet),
    );
  }
  const active = new Map<Id<'character'>, Relationship>();
  const states = new Map<
    Id<'companionRelationship'>,
    { status: Relationship['status']; interruption: CompanionInterruption }
  >();
  const ordered = [...relationships.values()].sort(
    (a, b) =>
      Number(b.status === 'active') - Number(a.status === 'active') ||
      b.activatedAt - a.activatedAt ||
      b._creationTime - a._creationTime ||
      b._id.localeCompare(a._id),
  );
  for (const row of ordered) {
    if (row.status === 'replaced') {
      states.set(row._id, { status: 'replaced', interruption: null });
      continue;
    }
    const interruption = determineInterruption({
      row,
      characters,
      countingEntries,
      active,
    });
    states.set(row._id, {
      status: interruption ? 'interrupted' : 'active',
      interruption,
    });
    if (!interruption) active.set(row.companionCharacterId, row);
  }
  return { relationships, characters, states, active, countingEntries, sheets };
}

export function doesCreateCompanionCycle(
  active: Map<Id<'character'>, Relationship>,
  associatedCharacterId: Id<'character'>,
  companionCharacterId: Id<'character'>,
) {
  let current: Id<'character'> | undefined = associatedCharacterId;
  const visited = new Set<Id<'character'>>();
  while (current && !visited.has(current)) {
    if (current === companionCharacterId) return true;
    visited.add(current);
    current = active.get(current)?.associatedCharacterId;
  }
  return false;
}

// Sheet edits publish support loss/restoration together with their existing state.
// Reads also derive eligibility, covering ownership/campaign changes and deletion.
export async function reconcileCompanionRelationships(
  ctx: MutationCtx,
  characterId: Id<'character'>,
  operationId?: string,
  loadedSheets: CompanionSheet[] = [],
  previousCountingEntries?: Set<string>,
) {
  const graph = await readCompanionGraph(ctx, characterId, loadedSheets);
  for (const row of graph.relationships.values()) {
    const state = graph.states.get(row._id);
    const hasChangedAvailability =
      previousCountingEntries &&
      row.associatedCharacterId === characterId &&
      row.sources.some(
        (source) =>
          isSupportingSourceAvailable(source, previousCountingEntries) !==
          isSupportingSourceAvailable(
            source,
            graph.countingEntries.get(characterId),
          ),
      );
    if (
      state &&
      (state.status !== row.status || (operationId && hasChangedAvailability))
    )
      await ctx.db.patch('companionRelationship', row._id, {
        status: state.status,
        ...(operationId ? { lastOperationId: operationId } : {}),
      });
  }
}

export function deriveCompanionSourceRuleKind({
  kind,
  source,
  sheet,
}: {
  kind: Relationship['kind'];
  source: Relationship['sources'][number];
  sheet: CompanionSheet | null;
}): CompanionSourceRuleKind {
  if (!sheet) return source.ruleKind ?? kind;
  const sourceEntry = source.sheetEntryId
    ? sheet.entries.find((entry) => entry._id === source.sheetEntryId)
    : source.grantKey
      ? sheet.calculated.resolvedEntries.find(
          ({ entry }) => entry._id === formatGrantKeyId(source.grantKey!),
        )?.entry
      : null;
  const classDefinition =
    sourceEntry?.kind === 'classLevel'
      ? sheet.catalogEntries.find(
          (entry) => entry._id === sourceEntry.state.classEntryId,
        )
      : null;
  const identity = classDefinition
    ? characterSheetClassFamily(classDefinition, sheet.catalogEntries)
    : (source.grantKey?.source ??
      (sourceEntry && 'catalogEntryId' in sourceEntry
        ? sheet.catalogEntries.find(
            (entry) => entry._id === sourceEntry.catalogEntryId,
          )?.ruleIdentity
        : null));
  if (kind === 'familiar') {
    if (identity === 'wizard') return 'wizardFamiliar';
    if (identity === 'sorcerer') return 'sorcererFamiliar';
    if (identity === 'witch') return 'witchFamiliar';
  }
  if (kind === 'animalCompanion') {
    if (identity === 'druid') return 'druidCompanion';
    if (identity === 'ranger') return 'rangerCompanion';
  }
  return sourceEntry ? kind : (source.ruleKind ?? kind);
}
export function resolveCuratedCompanionSources({
  relationship,
  sheet,
}: {
  relationship: Relationship;
  sheet: CompanionSheet | null;
}) {
  return relationship.sources.map((source) => ({
    ...source,
    ruleKind: deriveCompanionSourceRuleKind({
      kind: relationship.kind,
      source,
      sheet,
    }),
  }));
}
export function listRelationshipLinkedInputs(
  relationship: Pick<Relationship, 'kind' | 'sources'>,
) {
  return listCuratedCompanionInputs(relationship);
}
export function findCuratedCompanionBinding(
  source: Relationship['sources'][number],
  kind: Relationship['kind'],
  input: CompanionLinkedInput,
) {
  return representativeCompanionRules[source.ruleKind ?? kind].inputs.find(
    (binding) => linkedInputKey(binding.input) === linkedInputKey(input),
  );
}
