import { hasFamiliarCalculationDependencies } from './lib/companionRelationshipGraph';
import { ConvexError, v, type Infer } from 'convex/values';
import {
  paginationOptsValidator,
  paginationResultValidator,
} from 'convex/server';
import { validate } from 'convex-helpers/validators';
import { internalQuery, type MutationCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { ReadCtx } from './types';
import schema, {
  catalogEntryValidator,
  catalogImpactEvaluationValidator as evaluationValidator,
} from './schema';
import { generalInternalMutation } from './lib/writeGate';
import { requireCurrentPreparation } from './catalogRelease';
import { markCatalogImpactDirty } from './lib/catalogReleaseImpact';
import { listCatalogReferences } from '../src/lib/catalog-copy-references';
import {
  planReleaseImpact,
  type ReleaseDependencyEdge,
} from '../src/lib/catalog/release-impact';
import {
  releaseFingerprint,
  releaseByteCount,
  isObject,
} from '../src/lib/catalog/release-schema';
import { importedCatalogEntrySchema } from '../src/lib/catalog/imported-entry-schema';
import type { z } from 'zod';
import { catalogRuntimeCompatibility } from '../src/lib/catalog/runtime-compatibility';
import {
  calculateCharacterSheetProjectionsForRelease,
  isSupportedCatalogCalculation,
} from '../src/lib/catalog/calculation-dispatch';
import { calculateMilitiaCharacterFacts } from './lib/militiaCharacterFacts';
import { readCharacterSheetData } from './lib/characterSheetData';
import {
  projectCampaignCopies,
  findPreferredCampaignCopy,
} from './lib/catalogCopies';
import {
  reviewedCastingTablesSchema,
  defaultCastingTables,
} from '../src/lib/character-sheet-casting-tables';

const maxSheetRows = 128;
const maxCandidateReadBytes = 1048576;
const maxBatchReadBytes = 512000;
const maxStatusRows = 1024;
const definitionBatchRows = 4;
const characterBatchRows = 32;
const reverseSpellBatchRows = 8;
const maxDependencies = 256;
const maxResourceRows = 32;
const maxInspectionRows = 32;
async function readRun(ctx: ReadCtx, runId: Id<'catalogImpactRun'>) {
  const run = await ctx.db.get('catalogImpactRun', runId);
  if (!run) throw new ConvexError('Catalog impact run is missing');
  const release = await ctx.db.get('catalogRelease', run.releaseId);
  if (!release) throw new ConvexError('Catalog Release does not exist');
  return { run, release };
}

async function requireCharacterWork(
  ctx: ReadCtx,
  runId: Id<'catalogImpactRun'>,
  characterId: Id<'character'>,
) {
  const work = await ctx.db
    .query('catalogImpactWork')
    .withIndex('by_runId_and_characterId', (q) =>
      q.eq('runId', runId).eq('characterId', characterId),
    )
    .unique();
  if (!work)
    throw new ConvexError(
      `Character ${characterId} has no candidate work in run ${runId}`,
    );
  return work;
}

async function countWorkState(
  ctx: ReadCtx,
  runId: Id<'catalogImpactRun'>,
  state: 'dirty' | 'failed',
) {
  const page = await ctx.db
    .query('catalogImpactWork')
    .withIndex('by_runId_and_state', (q) =>
      q.eq('runId', runId).eq('state', state),
    )
    .paginate({
      numItems: maxStatusRows,
      cursor: null,
      maximumRowsRead: maxStatusRows,
      maximumBytesRead: maxCandidateReadBytes,
    });
  return { count: page.page.length, hasMore: !page.isDone };
}

async function clearControl(ctx: MutationCtx, runId: Id<'catalogImpactRun'>) {
  const control = await ctx.db
    .query('catalogImpactControl')
    .withIndex('by_key', (q) => q.eq('key', 'global'))
    .unique();
  if (control?.runId === runId)
    await ctx.db.delete('catalogImpactControl', control._id);
}

async function latestReadyRun(ctx: ReadCtx, releaseId: Id<'catalogRelease'>) {
  return ctx.db
    .query('catalogImpactRun')
    .withIndex('by_releaseId_and_lifecycle', (q) =>
      q.eq('releaseId', releaseId).eq('lifecycle', 'ready'),
    )
    .order('desc')
    .first();
}

async function requirePreparedRelease(
  ctx: ReadCtx,
  release: Doc<'catalogRelease'>,
) {
  await requireCurrentPreparation(ctx, release);
  if (release.state !== 'prepared')
    throw new ConvexError('Catalog Release is not prepared');
}

async function requireActiveRegistration(
  ctx: ReadCtx,
  run: Doc<'catalogImpactRun'>,
) {
  const control = await ctx.db
    .query('catalogImpactControl')
    .withIndex('by_key', (q) => q.eq('key', 'global'))
    .unique();
  if (
    control?.runId !== run._id ||
    (run.lifecycle && run.lifecycle !== 'active')
  )
    throw new ConvexError('Catalog impact run was superseded');
}

async function requireRun(ctx: ReadCtx, runId: Id<'catalogImpactRun'>) {
  const recorded = await readRun(ctx, runId);
  await requireActiveRegistration(ctx, recorded.run);
  await requirePreparedRelease(ctx, recorded.release);
  return recorded;
}

async function releaseRow(
  ctx: ReadCtx,
  releaseId: Id<'catalogRelease'>,
  kind: 'definition' | 'resource',
  key: string,
) {
  return ctx.db
    .query('catalogReleaseRow')
    .withIndex('by_releaseId_and_kind_and_key', (q) =>
      q.eq('releaseId', releaseId).eq('kind', kind).eq('key', key),
    )
    .unique();
}

type CandidateReadBudget = { bytes: number };

function recordCandidateRead(budget: CandidateReadBudget, value: unknown) {
  budget.bytes += releaseByteCount(value);
  if (budget.bytes > maxCandidateReadBytes)
    throw new ConvexError('Candidate exceeds representative read byte limit');
}

type ImportedDefinition = z.infer<typeof importedCatalogEntrySchema>;

async function candidateClassDetail(
  ctx: ReadCtx,
  definition: Doc<'catalogEntry'>,
  detail: Extract<ImportedDefinition['detail'], { kind: 'class' }>,
  budget: CandidateReadBudget,
) {
  if (detail.featuresByLevel.length > maxSheetRows)
    throw new ConvexError(
      `Candidate features exceed ${maxSheetRows} for ${definition.ruleIdentity}`,
    );
  const featuresByLevel: {
    classLevel: number;
    catalogEntryId: Id<'catalogEntry'>;
  }[] = [];
  for (const feature of detail.featuresByLevel) {
    const target = await globalDefinition(ctx, feature.externalKey);
    recordCandidateRead(budget, target);
    if (!target)
      throw new ConvexError(
        `Candidate feature ${feature.externalKey} is unavailable for ${definition.ruleIdentity}`,
      );
    featuresByLevel.push({
      classLevel: feature.classLevel,
      catalogEntryId: target._id,
    });
  }
  const previousCasting =
    'casting' in definition.detail ? definition.detail.casting : undefined;
  if (
    detail.casting &&
    (!previousCasting ||
      detail.tag !== previousCasting?.classTag ||
      Object.entries(detail.casting).some(
        ([key, value]) =>
          value !== undefined && value !== Reflect.get(previousCasting, key),
      ))
  )
    throw new ConvexError(
      `Candidate casting metadata is unsupported for ${definition.ruleIdentity}`,
    );
  return {
    ...definition.detail,
    hitDie: detail.hitDie,
    bab: detail.bab,
    saves: detail.saves,
    classSkills: detail.classSkills,
    skillRanksPerLevel: detail.skillRanksPerLevel,
    ...('classKind' in definition.detail
      ? { alignments: detail.alignments }
      : {}),
    casting: detail.casting ? previousCasting : undefined,
    featuresByLevel,
  };
}

async function candidateDetail(
  ctx: ReadCtx,
  definition: Doc<'catalogEntry'>,
  payload: ImportedDefinition,
  budget: CandidateReadBudget,
) {
  const detail = payload.detail;
  switch (detail.kind) {
    case 'feat':
      return {
        kind: detail.kind,
        featTypes: detail.featTypes,
        repeatable: detail.repeatable,
        additionalTraits: detail.additionalTraits,
      };
    case 'trait':
      return { kind: detail.kind, traitType: detail.traitType };
    case 'classFeature':
      return { kind: detail.kind };
    case 'spellEffect':
      return {
        kind: detail.kind,
        defaultCasterLevel: detail.defaultCasterLevel,
        lastsOverOneDay: detail.lastsOverOneDay,
      };
    case 'spell':
      return {
        kind: detail.kind,
        levels: detail.levels,
        school: detail.school,
        description: payload.description,
      };
    case 'race':
      return {
        ...definition.detail,
        racialHitDice: detail.racialHitDice,
        creatureTypes: detail.creatureTypes,
        creatureSubtypes: detail.creatureSubtypes,
      };
    case 'class':
      return candidateClassDetail(ctx, definition, detail, budget);
    default:
      return detail;
  }
}

async function candidateDefinition(
  ctx: ReadCtx,
  release: Doc<'catalogRelease'>,
  definition: Doc<'catalogEntry'>,
  budget: CandidateReadBudget = { bytes: 0 },
) {
  recordCandidateRead(budget, definition);
  if (
    definition.copiedFrom ||
    (definition.scope !== 'global' && !definition.importedSpell)
  )
    return definition;
  const row = await releaseRow(
    ctx,
    release._id,
    'definition',
    definition.ruleIdentity,
  );
  recordCandidateRead(budget, row);
  if (!row) return definition;
  const parsed = importedCatalogEntrySchema.safeParse(row.payload);
  if (!parsed.success || parsed.data.modifiers.length > maxSheetRows)
    throw new ConvexError(
      `Unsupported candidate definition ${definition.ruleIdentity}`,
    );
  const payload = parsed.data;
  if (payload.detail.kind !== definition.detail.kind)
    throw new ConvexError(
      `Candidate definition ${definition.ruleIdentity} changes its stable identity kind`,
    );
  const detail = await candidateDetail(ctx, definition, payload, budget);
  const { _id, _creationTime, ...body } = definition;
  const candidate = {
    ...body,
    name: payload.name,
    sources: payload.sources,
    modifiers: payload.modifiers,
    // Rule-identity prerequisites are release content; held definitions carry them.
    prerequisites: payload.prerequisites,
    detail,
    sourceKey: payload.sourceKey,
  };
  // Imported definitions have no Grant bodies. Existing reviewed ID-based
  // Grants stay usable; future class features are mapped through stable keys.
  if (!validate(catalogEntryValidator, candidate, { db: ctx.db }))
    throw new ConvexError(
      `Candidate definition ${definition.ruleIdentity} is not supported by the prepared sheet resolver`,
    );
  return { ...candidate, _id, _creationTime };
}

async function readResources(
  ctx: ReadCtx,
  release: Doc<'catalogRelease'>,
  budget: CandidateReadBudget,
) {
  const nextPage = await ctx.db
    .query('catalogReleaseRow')
    .withIndex('by_releaseId_and_kind_and_key', (q) =>
      q.eq('releaseId', release._id).eq('kind', 'resource'),
    )
    .paginate({
      numItems: maxResourceRows + 1,
      cursor: null,
      maximumRowsRead: maxResourceRows + 1,
      maximumBytesRead: maxCandidateReadBytes,
    });
  const next = nextPage.page;
  const base = await baseRelease(ctx, release);
  const oldPage = base
    ? await ctx.db
        .query('catalogReleaseRow')
        .withIndex('by_releaseId_and_kind_and_key', (q) =>
          q.eq('releaseId', base._id).eq('kind', 'resource'),
        )
        .paginate({
          numItems: maxResourceRows + 1,
          cursor: null,
          maximumRowsRead: maxResourceRows + 1,
          maximumBytesRead: maxCandidateReadBytes,
        })
    : null;
  const old = oldPage?.page ?? [];
  recordCandidateRead(budget, next);
  recordCandidateRead(budget, old);
  if (
    !nextPage.isDone ||
    (oldPage && !oldPage.isDone) ||
    next.length > maxResourceRows ||
    old.length > maxResourceRows
  )
    throw new ConvexError('Release exceeds representative resource limit');
  const changed: string[] = [];
  for (const key of new Set([...next, ...old].map((row) => row.key))) {
    const candidate: unknown = next.find((row) => row.key === key)?.payload;
    const previous: unknown = old.find((row) => row.key === key)?.payload;
    if (
      (await releaseFingerprint(candidate ?? null)) !==
      (await releaseFingerprint(previous ?? null))
    ) {
      if (
        !base &&
        key === 'builtin:casting-tables' &&
        isObject(candidate) &&
        (await releaseFingerprint(candidate.definitions)) ===
          (await releaseFingerprint(defaultCastingTables))
      )
        continue;
      changed.push(`resource:${key}`);
    }
  }
  const casting: unknown = next.find(
    (row) => row.key === 'builtin:casting-tables',
  )?.payload;
  if (
    casting === undefined &&
    old.some((row) => row.key === 'builtin:casting-tables')
  )
    throw new ConvexError('Candidate casting resource removal is unsupported');
  return {
    rows: next,
    oldRows: old,
    changed,
    hasCalculationChanged:
      (base?.manifest.compatibility.calculation ??
        catalogRuntimeCompatibility.calculation) !==
      release.manifest.compatibility.calculation,
    castingTables: isObject(casting)
      ? reviewedCastingTablesSchema.parse(casting.definitions)
      : undefined,
  };
}

function keyedReleaseEdges(
  key: string,
  payload: unknown,
): ReleaseDependencyEdge[] {
  if (!isObject(payload) || !isObject(payload.detail)) return [];
  const detail = payload.detail;
  const edges: ReleaseDependencyEdge[] = [];
  if (typeof detail.spellKey === 'string')
    edges.push({ from: `key:${key}`, to: `key:${detail.spellKey}` });
  if (detail.kind === 'spell') {
    if (isObject(detail.levels))
      for (const tag of Object.keys(detail.levels))
        edges.push({ from: `casting:${tag}`, to: `key:${key}` });
    if (isObject(detail.grantedLevels))
      for (const [kind, lists] of Object.entries(detail.grantedLevels))
        if (isObject(lists))
          for (const list of Object.keys(lists))
            edges.push({ from: `granted:${kind}:${list}`, to: `key:${key}` });
  }
  if (edges.length > maxSheetRows)
    throw new ConvexError(
      'Definition exceeds representative keyed relationship limit',
    );
  return edges;
}

async function readKeyedChanges(
  ctx: ReadCtx,
  runId: Id<'catalogImpactRun'>,
  roots: string[],
  liveSpellKeys: Set<string>,
) {
  const edges: ReleaseDependencyEdge[] = [];
  const changed: string[] = [];
  const seen = new Set<string>();
  const pending = [...roots];
  while (pending.length) {
    const key = pending.pop();
    if (key === undefined) break;
    if (seen.has(key)) continue;
    seen.add(key);
    if (seen.size > maxDependencies)
      throw new ConvexError(
        'Sheet exceeds representative keyed dependency limit',
      );
    const change = await ctx.db
      .query('catalogImpactChange')
      .withIndex('by_runId_and_key', (q) => q.eq('runId', runId).eq('key', key))
      .unique();
    if (change?.hasChanged) changed.push(key);
    const dependencies = await ctx.db
      .query('catalogImpactEdge')
      .withIndex('by_runId_and_from', (q) =>
        q.eq('runId', runId).eq('from', key),
      )
      .take(maxDependencies + 1);
    if (
      dependencies.length > maxDependencies ||
      edges.length + dependencies.length > maxDependencies
    )
      throw new ConvexError(
        'Sheet exceeds representative keyed dependency limit',
      );
    for (const edge of dependencies) {
      if (key.startsWith('character:') && !liveSpellKeys.has(edge.to)) continue;
      edges.push({ from: edge.from, to: edge.to });
      pending.push(edge.to);
    }
  }
  return { edges, changed };
}

/** Recheck current lightweight references, including writes after reverse discovery. */
async function readLiveSpellKeys(
  ctx: ReadCtx,
  runId: Id<'catalogImpactRun'>,
  characterId: Id<'character'>,
  budget: CandidateReadBudget,
) {
  const edges = await ctx.db
    .query('catalogImpactEdge')
    .withIndex('by_runId_and_from', (q) =>
      q.eq('runId', runId).eq('from', `character:${characterId}`),
    )
    .paginate(boundedPage(maxDependencies, null));
  recordCandidateRead(budget, edges.page);
  if (!edges.isDone)
    throw new ConvexError(
      `Character exceeds representative ${maxDependencies}-key Spell dependency limit`,
    );
  const liveKeys = new Set<string>();
  for (const edge of edges.page) {
    const ruleIdentity = edge.to.slice('key:'.length);
    const indexed = await ctx.db
      .query('spellCatalogIndex')
      .withIndex('by_characterId_and_ruleIdentity', (q) =>
        q.eq('characterId', characterId).eq('ruleIdentity', ruleIdentity),
      )
      .take(maxSheetRows + 1);
    if (indexed.length > maxSheetRows)
      throw new ConvexError(
        `Spell ${ruleIdentity} exceeds representative casting-reference limit`,
      );
    recordCandidateRead(budget, indexed);
    for (const row of indexed)
      if (await hasLiveSpellDefinition(ctx, row, budget)) {
        liveKeys.add(edge.to);
        break;
      }
    if (liveKeys.has(edge.to)) continue;
    // Older index rows have no identity; look up only this changed local key.
    const definitions = await ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId_and_ruleIdentity', (q) =>
        q.eq('characterId', characterId).eq('ruleIdentity', ruleIdentity),
      )
      .take(maxSheetRows + 1);
    recordCandidateRead(budget, definitions);
    if (definitions.length > maxSheetRows)
      throw new ConvexError(
        `Spell ${ruleIdentity} exceeds representative local-definition limit`,
      );
    const global = await globalDefinition(ctx, ruleIdentity);
    recordCandidateRead(budget, global);
    const liveDefinitions = global ? [...definitions, global] : definitions;
    for (const definition of liveDefinitions) {
      if (
        definition.copiedFrom ||
        (definition.scope !== 'global' && !definition.importedSpell)
      )
        continue;
      const reference = await ctx.db
        .query('spellCatalogIndex')
        .withIndex('by_characterId_and_catalogEntryId', (q) =>
          q.eq('characterId', characterId).eq('catalogEntryId', definition._id),
        )
        .first();
      if (reference) {
        liveKeys.add(edge.to);
        break;
      }
    }
  }
  return liveKeys;
}

async function readImpactSheetEntries(
  ctx: ReadCtx,
  characterId: Id<'character'>,
  budget: CandidateReadBudget,
) {
  const entryPage = await ctx.db
    .query('characterSheetEntry')
    .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
    .paginate({
      numItems: maxSheetRows + 1,
      cursor: null,
      maximumRowsRead: maxSheetRows + 1,
      maximumBytesRead: maxCandidateReadBytes,
    });
  const entries = entryPage.page;
  recordCandidateRead(budget, entries);
  if (!entryPage.isDone || entries.length > maxSheetRows)
    throw new ConvexError('Sheet exceeds representative release impact limit');
  return entries;
}

async function readImpactDefinitions(
  ctx: ReadCtx,
  release: Doc<'catalogRelease'>,
  character: Doc<'character'>,
  roots: string[],
  budget: CandidateReadBudget,
) {
  const oldDefinitions = new Map<string, Doc<'catalogEntry'>>();
  const nextDefinitions = new Map<string, Doc<'catalogEntry'>>();
  const oldEdges: ReleaseDependencyEdge[] = [];
  const newEdges: ReleaseDependencyEdge[] = [];
  const changed: string[] = [];
  const pending = [...roots];
  const seen = new Set<string>();
  while (pending.length) {
    const id = pending.pop();
    if (id === undefined) break;
    if (seen.has(id)) continue;
    seen.add(id);
    if (seen.size > maxDependencies)
      throw new ConvexError('Sheet exceeds representative dependency limit');
    const normalized = ctx.db.normalizeId('catalogEntry', id);
    const active = normalized && (await ctx.db.get('catalogEntry', normalized));
    if (!active) continue;
    if (
      active.scope !== 'global' &&
      !(
        (active.scope === 'character' &&
          active.characterId === character._id) ||
        (active.scope === 'campaign' &&
          active.campaignId === character.campaignId)
      )
    )
      throw new ConvexError(
        'Catalog dependency does not belong to this Character',
      );
    const candidate = await candidateDefinition(ctx, release, active, budget);
    recordCandidateRead(budget, candidate);
    oldDefinitions.set(id, active);
    nextDefinitions.set(id, candidate);
    if (
      (await releaseFingerprint(active)) !==
      (await releaseFingerprint(candidate))
    )
      changed.push(id, `key:${active.ruleIdentity}`);
    for (const [definition, edges] of [
      [active, oldEdges],
      [candidate, newEdges],
    ] as const) {
      if (!definition.copiedFrom)
        edges.push({ from: id, to: `key:${definition.ruleIdentity}` });
      if (
        definition.detail.kind === 'class' &&
        'casting' in definition.detail &&
        definition.detail.casting
      )
        edges.push({
          from: id,
          to: `casting:${definition.detail.casting.classTag}`,
        });
      for (const reference of listCatalogReferences(definition)) {
        edges.push({ from: id, to: reference.id });
        pending.push(reference.id);
        if (oldEdges.length + newEdges.length > maxDependencies)
          throw new ConvexError(
            'Sheet exceeds representative relationship limit',
          );
      }
      if (
        definition.detail.kind === 'class' &&
        'casting' in definition.detail &&
        definition.detail.casting
      )
        edges.push({ from: id, to: 'resource:builtin:casting-tables' });
      if (definition.scope === 'global') {
        const copy = await findPreferredCampaignCopy(ctx, {
          campaignId: character.campaignId,
          originalId: definition._id,
        });
        recordCandidateRead(budget, copy);
        if (copy) {
          edges.push({ from: id, to: copy._id });
          pending.push(copy._id);
        }
      }
    }
  }
  return { oldDefinitions, nextDefinitions, oldEdges, newEdges, changed };
}

async function readImpactInputs(
  ctx: ReadCtx,
  release: Doc<'catalogRelease'>,
  character: Doc<'character'>,
  runId: Id<'catalogImpactRun'>,
) {
  const budget: CandidateReadBudget = { bytes: 0 };
  const entries = await readImpactSheetEntries(ctx, character._id, budget);
  const liveSpellKeys = await readLiveSpellKeys(
    ctx,
    runId,
    character._id,
    budget,
  );
  const roots = [
    ...listCatalogReferences(entries).map((ref) => ref.id),
    `character:${character._id}`,
    ...liveSpellKeys,
  ];
  const { oldDefinitions, nextDefinitions, oldEdges, newEdges, changed } =
    await readImpactDefinitions(ctx, release, character, roots, budget);
  const resources = await readResources(ctx, release, budget);
  // Unknown built-in resources remain visible failures, never certified defaults.
  // Seed catalog resources initialize recorded defaults; they are not live dependencies.
  const keyedChanges = await readKeyedChanges(
    ctx,
    runId,
    [
      ...roots,
      ...oldEdges.map((edge) => edge.to),
      ...newEdges.map((edge) => edge.to),
    ],
    liveSpellKeys,
  );
  const impact = planReleaseImpact({
    roots,
    oldEdges,
    newEdges: [...newEdges, ...keyedChanges.edges],
    changed: [...changed, ...resources.changed, ...keyedChanges.changed],
    hasCalculationChanged: resources.hasCalculationChanged,
  });
  const catalogEntries = projectCampaignCopies([...nextDefinitions.values()]);
  return {
    character,
    entries,
    catalogEntries,
    oldDefinitions: [...oldDefinitions.values()],
    resources,
    impact,
  };
}

async function calculateCandidateOutcome(
  ctx: ReadCtx,
  release: Doc<'catalogRelease'>,
  character: Doc<'character'>,
  inputs: Awaited<ReturnType<typeof readImpactInputs>>,
) {
  if (
    release.manifest.compatibility.schema !==
      catalogRuntimeCompatibility.schema ||
    !isSupportedCatalogCalculation(release.manifest.compatibility.calculation)
  )
    throw new ConvexError('Candidate calculation behavior is unavailable');
  if (
    inputs.impact.reasons.some(
      (key) =>
        key.startsWith('resource:') &&
        key !== 'resource:builtin:casting-tables',
    )
  )
    throw new ConvexError(
      'Candidate resource is unsupported by the prepared resolver',
    );
  if (await hasFamiliarCalculationDependencies(ctx, character))
    throw new ConvexError(
      'Candidate linked Familiar calculations require the companion dependency adapter',
    );
  const projections = calculateCharacterSheetProjectionsForRelease(
    release.manifest.compatibility.calculation,
    {
      entries: inputs.entries,
      catalogEntries: inputs.catalogEntries,
      characterKind: character.kind,
      sheetMode: character.sheetMode,
      resources: { castingTables: inputs.resources.castingTables },
    },
  );
  const active = await readCharacterSheetData(ctx, character);
  const candidate = {
    ...active,
    catalogEntries: inputs.catalogEntries,
    calculated: projections.current,
    permanentCalculated: projections.permanent,
  };
  const calculatedFacts = await calculateMilitiaCharacterFacts(
    ctx,
    character,
    candidate,
    { trustedLinkedInputs: true },
  );
  const facts = { ...calculatedFacts, characterId: character._id };
  const activeFacts = await calculateMilitiaCharacterFacts(
    ctx,
    character,
    active,
    { trustedLinkedInputs: true },
  );
  return {
    kind: 'ready' as const,
    facts,
    hasFactsChanged:
      (await releaseFingerprint(facts)) !==
      (await releaseFingerprint(activeFacts)),
    reasons: inputs.impact.reasons,
    ...(inputs.impact.reasons.includes('resource:builtin:casting-tables')
      ? {
          castingEvidence: projections.permanent.spellcastings.flatMap(
            (casting) =>
              casting.slots.map((slot) => ({
                classTag: casting.classTag,
                spellLevel: slot.spellLevel,
                base: slot.base,
                total: slot.total,
              })),
          ),
        }
      : {}),
  };
}

async function evaluateWork(
  ctx: ReadCtx,
  release: Doc<'catalogRelease'>,
  work: Doc<'catalogImpactWork'>,
): Promise<Infer<typeof evaluationValidator>> {
  const runId = work.runId;
  const characterId = work.characterId;
  const character = await ctx.db.get('character', characterId);
  if (!character?.sheetMode)
    return {
      revision: work.revision,
      inputFingerprint: await releaseFingerprint(character),
      result: { kind: character ? 'notPrepared' : 'deleted' },
    };
  try {
    const inputs = await readImpactInputs(ctx, release, character, runId);
    const inputFingerprint = await releaseFingerprint({
      ...inputs,
      release: release.manifest.artifactFingerprint,
    });
    if (!inputs.impact.isAffected)
      return {
        revision: work.revision,
        inputFingerprint,
        result: { kind: 'unaffected' as const },
      };
    return {
      revision: work.revision,
      inputFingerprint,
      result: await calculateCandidateOutcome(ctx, release, character, inputs),
    };
  } catch (error) {
    return {
      revision: work.revision,
      inputFingerprint: await releaseFingerprint({
        character,
        revision: work.revision,
      }),
      result: {
        kind: 'failed' as const,
        error:
          error instanceof Error
            ? error.message
            : 'Candidate calculation failed',
      },
    };
  }
}

export const start = generalInternalMutation({
  args: { releaseNumber: v.number() },
  returns: v.id('catalogImpactRun'),
  handler: async (ctx, args) => {
    const release = await ctx.db
      .query('catalogRelease')
      .withIndex('by_releaseNumber', (q) =>
        q.eq('releaseNumber', args.releaseNumber),
      )
      .unique();
    if (!release) throw new ConvexError('Catalog Release does not exist');
    await requirePreparedRelease(ctx, release);
    const existing = await ctx.db
      .query('catalogImpactRun')
      .withIndex('by_releaseId', (q) => q.eq('releaseId', release._id))
      .order('desc')
      .first();
    if (existing && (!existing.lifecycle || existing.lifecycle === 'active')) {
      await requireActiveRegistration(ctx, existing);
      return existing._id;
    }
    const runId = await ctx.db.insert('catalogImpactRun', {
      releaseId: release._id,
      cursor: null,
      isDiscoveryComplete: false,
      baseReleaseNumber: release.baseReleaseNumber,
      discoveryStage: 'next',
      lifecycle: 'active',
    });
    const control = await ctx.db
      .query('catalogImpactControl')
      .withIndex('by_key', (q) => q.eq('key', 'global'))
      .unique();
    if (control) {
      const previous = await ctx.db.get('catalogImpactRun', control.runId);
      if (previous)
        await ctx.db.patch('catalogImpactRun', previous._id, {
          lifecycle: 'superseded',
        });
      await ctx.db.delete('catalogImpactControl', control._id);
    }
    await ctx.db.insert('catalogImpactControl', { key: 'global', runId });

    return runId;
  },
});

async function baseRelease(ctx: ReadCtx, release: Doc<'catalogRelease'>) {
  const baseNumber = release.baseReleaseNumber;
  if (baseNumber === null) return null;
  return ctx.db
    .query('catalogRelease')
    .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', baseNumber))
    .unique();
}

async function globalDefinition(ctx: ReadCtx, ruleIdentity: string) {
  const rows = await ctx.db
    .query('catalogEntry')
    .withIndex('by_scope_and_ruleIdentity', (q) =>
      q.eq('scope', 'global').eq('ruleIdentity', ruleIdentity),
    )
    .take(2);
  if (rows.length > 1)
    throw new ConvexError(`Duplicate global ruleIdentity ${ruleIdentity}`);
  return rows[0] ?? null;
}

function boundedPage(
  numItems: number,
  cursor: string | null,
  maximumBytesRead = maxCandidateReadBytes,
) {
  return { numItems, cursor, maximumRowsRead: numItems, maximumBytesRead };
}

async function discoverDefinitions(
  ctx: MutationCtx,
  run: Doc<'catalogImpactRun'>,
  release: Doc<'catalogRelease'>,
) {
  const base = await baseRelease(ctx, release);
  const selected = run.discoveryStage === 'next' ? release : base;
  if (!selected) {
    await ctx.db.patch('catalogImpactRun', run._id, {
      discoveryStage: 'reverse',
      cursor: null,
    });
    return false;
  }
  const page = await ctx.db
    .query('catalogReleaseRow')
    .withIndex('by_releaseId_and_kind_and_key', (q) =>
      q.eq('releaseId', selected._id).eq('kind', 'definition'),
    )
    .paginate(boundedPage(definitionBatchRows, run.cursor, maxBatchReadBytes));
  for (const row of page.page) {
    const existing = await ctx.db
      .query('catalogImpactChange')
      .withIndex('by_runId_and_key', (q) =>
        q.eq('runId', run._id).eq('key', `key:${row.key}`),
      )
      .unique();
    if (existing) continue;
    try {
      const next = await releaseRow(ctx, release._id, 'definition', row.key);
      const old = base
        ? await releaseRow(ctx, base._id, 'definition', row.key)
        : null;
      let hasChanged =
        (await releaseFingerprint(next?.payload ?? null)) !==
        (await releaseFingerprint(old?.payload ?? null));
      if (!base && next) {
        const active = await globalDefinition(ctx, row.key);
        if (active) {
          try {
            hasChanged =
              (await releaseFingerprint(active)) !==
              (await releaseFingerprint(
                await candidateDefinition(ctx, release, active),
              ));
          } catch {
            hasChanged = true;
          }
        }
      }
      const edgesByPair = new Map<string, ReleaseDependencyEdge>();
      for (const payload of [next?.payload, old?.payload]) {
        // Only changed Spell lists enter the forward graph. The index handles
        // off-list and recorded references without enumerating a caster's corpus.
        if (
          !hasChanged &&
          isObject(payload) &&
          isObject(payload.detail) &&
          payload.detail.kind === 'spell'
        )
          continue;
        // Old and new bodies usually share relationships; each edge counts once.
        for (const edge of keyedReleaseEdges(row.key, payload))
          edgesByPair.set(JSON.stringify([edge.from, edge.to]), edge);
      }
      const edges = [...edgesByPair.values()];
      if (edges.length > maxSheetRows)
        throw new ConvexError(
          `Keyed relationships exceed ${maxSheetRows} for ${row.key}`,
        );
      await ctx.db.insert('catalogImpactChange', {
        runId: run._id,
        key: `key:${row.key}`,
        hasChanged,
        hasSpellDependencies:
          hasChanged &&
          [next?.payload, old?.payload].some(
            (payload) =>
              isObject(payload) &&
              isObject(payload.detail) &&
              payload.detail.kind === 'spell',
          ),
      });
      for (const edge of edges)
        await ctx.db.insert('catalogImpactEdge', { runId: run._id, ...edge });
    } catch (error) {
      await ctx.db.patch('catalogImpactRun', run._id, {
        isDiscoveryComplete: true,
        discoveryError: `Discovery failed for ${row.key}: ${error instanceof Error ? error.message : 'unsupported definition'}`,
      });
      return true;
    }
  }
  await ctx.db.patch('catalogImpactRun', run._id, {
    cursor: page.isDone ? null : page.continueCursor,
    discoveryStage: page.isDone
      ? run.discoveryStage === 'next'
        ? 'base'
        : 'reverse'
      : run.discoveryStage,
  });
  return false;
}

async function hasLiveSpellDefinition(
  ctx: ReadCtx,
  indexed: Doc<'spellCatalogIndex'>,
  budget?: CandidateReadBudget,
) {
  const definition = await ctx.db.get('catalogEntry', indexed.catalogEntryId);
  if (budget) recordCandidateRead(budget, definition);
  return Boolean(
    definition &&
    !definition.copiedFrom &&
    (definition.scope === 'global' || definition.importedSpell),
  );
}

async function advanceReverseChange(
  ctx: MutationCtx,
  run: Doc<'catalogImpactRun'>,
) {
  await ctx.db.patch('catalogImpactRun', run._id, {
    reverseKey: undefined,
    reverseCursor: undefined,
    reverseLookup: undefined,
    reverseDefinitionIds: undefined,
    reverseDefinitionCursor: undefined,
    isReverseDefinitionsComplete: undefined,
    ...(run.isReverseDiscoveryComplete
      ? { discoveryStage: 'sheets', cursor: null }
      : {}),
  });
}

async function discoverReverseSpells(
  ctx: MutationCtx,
  run: Doc<'catalogImpactRun'>,
) {
  const reverseKey = run.reverseKey;
  if (!reverseKey) {
    const page = await ctx.db
      .query('catalogImpactChange')
      .withIndex('by_runId_and_hasSpellDependencies', (q) =>
        q.eq('runId', run._id).eq('hasSpellDependencies', true),
      )
      .paginate(boundedPage(1, run.cursor, maxBatchReadBytes));
    const change = page.page[0];
    if (!change) {
      await ctx.db.patch('catalogImpactRun', run._id, {
        discoveryStage: 'sheets',
        cursor: null,
      });
      return false;
    }
    await ctx.db.patch('catalogImpactRun', run._id, {
      reverseKey: change.key,
      reverseCursor: null,
      reverseLookup: 'identity',
      isReverseDiscoveryComplete: page.isDone,
      cursor: page.continueCursor,
    });
    return false;
  }
  const key = reverseKey.slice('key:'.length);
  if (run.reverseLookup === 'definitions') {
    const definitions = await ctx.db
      .query('catalogEntry')
      .withIndex('by_ruleIdentity', (q) => q.eq('ruleIdentity', key))
      .paginate(
        boundedPage(
          definitionBatchRows,
          run.reverseDefinitionCursor ?? null,
          maxBatchReadBytes,
        ),
      );
    const ids = definitions.page
      .filter(
        (row) =>
          !row.copiedFrom && (row.scope === 'global' || row.importedSpell),
      )
      .map((row) => row._id);
    if (ids.length === 0 && definitions.isDone)
      await advanceReverseChange(ctx, run);
    else
      await ctx.db.patch('catalogImpactRun', run._id, {
        reverseDefinitionIds: ids,
        reverseDefinitionCursor: definitions.continueCursor,
        isReverseDefinitionsComplete: definitions.isDone,
        reverseLookup: ids.length ? 'catalogEntry' : 'definitions',
      });
    return false;
  }
  const definitionId = run.reverseDefinitionIds?.[0];
  const query =
    run.reverseLookup === 'catalogEntry' && definitionId
      ? ctx.db
          .query('spellCatalogIndex')
          .withIndex('by_catalogEntryId', (q) =>
            q.eq('catalogEntryId', definitionId),
          )
      : ctx.db
          .query('spellCatalogIndex')
          .withIndex('by_ruleIdentity', (q) => q.eq('ruleIdentity', key));
  const page = await query.paginate(
    boundedPage(
      reverseSpellBatchRows,
      run.reverseCursor ?? null,
      maxBatchReadBytes,
    ),
  );
  for (const indexed of page.page) {
    if (!(await hasLiveSpellDefinition(ctx, indexed))) continue;
    const from = `character:${indexed.characterId}`;
    const edge = await ctx.db
      .query('catalogImpactEdge')
      .withIndex('by_runId_and_from_and_to', (q) =>
        q.eq('runId', run._id).eq('from', from).eq('to', reverseKey),
      )
      .unique();
    if (!edge)
      await ctx.db.insert('catalogImpactEdge', {
        runId: run._id,
        from,
        to: reverseKey,
      });
  }
  if (!page.isDone)
    await ctx.db.patch('catalogImpactRun', run._id, {
      reverseCursor: page.continueCursor,
    });
  else if (run.reverseLookup === 'identity')
    await ctx.db.patch('catalogImpactRun', run._id, {
      reverseLookup: 'definitions',
      reverseCursor: null,
    });
  else {
    const remainingIds = run.reverseDefinitionIds?.slice(1) ?? [];
    if (!remainingIds.length && run.isReverseDefinitionsComplete)
      await advanceReverseChange(ctx, run);
    else
      await ctx.db.patch('catalogImpactRun', run._id, {
        reverseDefinitionIds: remainingIds,
        reverseCursor: null,
        reverseLookup: remainingIds.length ? 'catalogEntry' : 'definitions',
      });
  }
  return false;
}

async function discoverSheets(ctx: MutationCtx, run: Doc<'catalogImpactRun'>) {
  const page = await ctx.db
    .query('character')
    .withIndex('by_sheetMode', (q) => q.gt('sheetMode', undefined))
    .paginate(boundedPage(characterBatchRows, run.cursor, maxBatchReadBytes));
  for (const character of page.page)
    await markCatalogImpactDirty(ctx, character._id);
  await ctx.db.patch('catalogImpactRun', run._id, {
    cursor: page.continueCursor,
    isDiscoveryComplete: page.isDone,
  });
  return page.isDone;
}

export const discover = generalInternalMutation({
  args: { runId: v.id('catalogImpactRun') },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const { run, release } = await requireRun(ctx, args.runId);
    if (run.isDiscoveryComplete) return true;
    if (run.discoveryStage === 'sheets') return discoverSheets(ctx, run);
    if (run.discoveryStage === 'reverse')
      return discoverReverseSpells(ctx, run);
    return discoverDefinitions(ctx, run, release);
  },
});

export const evaluate = internalQuery({
  args: { runId: v.id('catalogImpactRun'), characterId: v.id('character') },
  returns: evaluationValidator,
  handler: async (ctx, args) => {
    const { release } = await requireRun(ctx, args.runId);
    const work = await requireCharacterWork(ctx, args.runId, args.characterId);
    return evaluateWork(ctx, release, work);
  },
});

export const complete = generalInternalMutation({
  args: {
    runId: v.id('catalogImpactRun'),
    characterId: v.id('character'),
    evaluation: evaluationValidator,
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const { run, release } = await requireRun(ctx, args.runId);
    const work = await ctx.db
      .query('catalogImpactWork')
      .withIndex('by_runId_and_characterId', (q) =>
        q.eq('runId', run._id).eq('characterId', args.characterId),
      )
      .unique();
    if (work?.revision !== args.evaluation.revision || work.state !== 'dirty')
      return false;
    const current = await evaluateWork(ctx, release, work);
    if (
      current.inputFingerprint !== args.evaluation.inputFingerprint ||
      (await releaseFingerprint(current.result)) !==
        (await releaseFingerprint(args.evaluation.result))
    )
      return false;
    const result = args.evaluation.result;
    await ctx.db.patch('catalogImpactWork', work._id, {
      state: result.kind,
      inputFingerprint: args.evaluation.inputFingerprint,
      ...(result.kind === 'ready'
        ? {
            facts: result.facts,
            hasFactsChanged: result.hasFactsChanged,
            reasons: result.reasons,
            error: undefined,
          }
        : {
            facts: undefined,
            hasFactsChanged: undefined,
            reasons: undefined,
            error: result.kind === 'failed' ? result.error : undefined,
          }),
    });
    return true;
  },
});

export const retryDiscovery = generalInternalMutation({
  args: { runId: v.id('catalogImpactRun') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { run } = await requireRun(ctx, args.runId);
    if (run.discoveryError)
      await ctx.db.patch('catalogImpactRun', run._id, {
        isDiscoveryComplete: false,
        discoveryError: undefined,
      });
    return null;
  },
});

export const retry = generalInternalMutation({
  args: { runId: v.id('catalogImpactRun'), characterId: v.id('character') },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireRun(ctx, args.runId);
    const work = await ctx.db
      .query('catalogImpactWork')
      .withIndex('by_runId_and_characterId', (q) =>
        q.eq('runId', args.runId).eq('characterId', args.characterId),
      )
      .unique();
    if (!work) throw new ConvexError('Character has no candidate work');
    await markCatalogImpactDirty(ctx, args.characterId);
    return null;
  },
});

export const finish = generalInternalMutation({
  args: { runId: v.id('catalogImpactRun') },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const recorded = await readRun(ctx, args.runId);
    await requirePreparedRelease(ctx, recorded.release);
    if (recorded.run.lifecycle === 'ready') return true;
    const { run } = recorded;
    await requireActiveRegistration(ctx, run);
    if (!run.isDiscoveryComplete || run.discoveryError) return false;
    const dirty = await countWorkState(ctx, run._id, 'dirty');
    const failed = await countWorkState(ctx, run._id, 'failed');
    if (dirty.count || failed.count) return false;
    await ctx.db.patch('catalogImpactRun', run._id, { lifecycle: 'ready' });
    await clearControl(ctx, run._id);
    return true;
  },
});

export const abandon = generalInternalMutation({
  args: { runId: v.id('catalogImpactRun') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { run } = await readRun(ctx, args.runId);
    // Ready evidence is retained for its Catalog Release; never make it deletable.
    if (run.lifecycle === 'ready')
      throw new ConvexError(
        'Ready Catalog impact evidence cannot be abandoned',
      );
    await ctx.db.patch('catalogImpactRun', run._id, { lifecycle: 'abandoned' });
    await clearControl(ctx, run._id);
    return null;
  },
});

/** Repeated calls remove one bounded batch; retained ready evidence is historical. */
export const cleanup = generalInternalMutation({
  args: { runId: v.id('catalogImpactRun') },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get('catalogImpactRun', args.runId);
    if (!run) {
      await clearControl(ctx, args.runId);
      return true;
    }
    if (!run.lifecycle || run.lifecycle === 'active') {
      let isCurrent = true;
      try {
        await requireRun(ctx, args.runId);
      } catch {
        isCurrent = false;
      }
      // `false` means more batches remain, so a current run must fail loudly.
      if (isCurrent)
        throw new ConvexError(
          'Catalog impact run is still active; finish or abandon it before cleanup',
        );
      await ctx.db.patch('catalogImpactRun', run._id, {
        lifecycle: 'superseded',
      });
    }
    await clearControl(ctx, run._id);
    if (
      run.lifecycle === 'ready' &&
      (await latestReadyRun(ctx, run.releaseId))?._id === run._id
    )
      return true;
    const workRows = await ctx.db
      .query('catalogImpactWork')
      .withIndex('by_runId_and_characterId', (q) => q.eq('runId', run._id))
      .paginate(boundedPage(characterBatchRows, null, maxBatchReadBytes));
    if (workRows.page.length) {
      for (const row of workRows.page)
        await ctx.db.delete('catalogImpactWork', row._id);
      return false;
    }
    const edgeRows = await ctx.db
      .query('catalogImpactEdge')
      .withIndex('by_runId_and_from', (q) => q.eq('runId', run._id))
      .paginate(boundedPage(characterBatchRows, null, maxBatchReadBytes));
    if (edgeRows.page.length) {
      for (const row of edgeRows.page)
        await ctx.db.delete('catalogImpactEdge', row._id);
      return false;
    }
    const changeRows = await ctx.db
      .query('catalogImpactChange')
      .withIndex('by_runId_and_key', (q) => q.eq('runId', run._id))
      .paginate(boundedPage(characterBatchRows, null, maxBatchReadBytes));
    if (changeRows.page.length) {
      for (const row of changeRows.page)
        await ctx.db.delete('catalogImpactChange', row._id);
      return false;
    }
    await ctx.db.delete('catalogImpactRun', run._id);
    return true;
  },
});

export const status = internalQuery({
  args: { runId: v.id('catalogImpactRun') },
  returns: v.object({
    isDiscoveryComplete: v.boolean(),
    pendingCount: v.number(),
    failedCount: v.number(),
    isReady: v.boolean(),
    discoveryError: v.optional(v.string()),
    hasTruncatedCounts: v.optional(v.boolean()),
  }),
  handler: async (ctx, args) => {
    const run = await ctx.db.get('catalogImpactRun', args.runId);
    if (!run)
      return {
        isDiscoveryComplete: false,
        pendingCount: 0,
        failedCount: 1,
        isReady: false,
        discoveryError: 'Catalog impact run is missing',
      };
    const controls = await ctx.db
      .query('catalogImpactControl')
      .withIndex('by_key', (q) => q.eq('key', 'global'))
      .take(2);
    const control = controls.length === 1 ? controls[0] : null;
    const release = await ctx.db.get('catalogRelease', run.releaseId);
    let preparationError: string | undefined;
    try {
      if (!release) throw new ConvexError('Catalog Release is missing');
      await requireCurrentPreparation(ctx, release);
    } catch (error) {
      preparationError =
        error instanceof Error
          ? error.message
          : 'Catalog preparation is inconsistent';
    }
    const inconsistency =
      run.lifecycle !== 'ready' && control?.runId !== run._id
        ? 'Catalog impact control is missing or the run was superseded'
        : undefined;
    const pending = await countWorkState(ctx, run._id, 'dirty');
    const failed = await countWorkState(ctx, run._id, 'failed');
    const discoveryError =
      run.discoveryError ?? preparationError ?? inconsistency;
    return {
      isDiscoveryComplete: run.isDiscoveryComplete,
      ...(discoveryError ? { discoveryError } : {}),
      pendingCount: pending.count,
      failedCount: failed.count + (discoveryError ? 1 : 0),
      ...(pending.hasMore || failed.hasMore
        ? { hasTruncatedCounts: true }
        : {}),
      isReady:
        run.isDiscoveryComplete &&
        !discoveryError &&
        pending.count === 0 &&
        failed.count === 0,
    };
  },
});

export const inspectWork = internalQuery({
  args: {
    runId: v.id('catalogImpactRun'),
    state: schema.tables.catalogImpactWork.validator.fields.state,
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(schema.doc('catalogImpactWork')),
  handler: async (ctx, args) => {
    await readRun(ctx, args.runId);
    if (
      [
        args.paginationOpts.numItems,
        args.paginationOpts.maximumRowsRead,
        args.paginationOpts.maximumBytesRead,
      ].some(
        (value) =>
          value === undefined || !Number.isSafeInteger(value) || value < 1,
      ) ||
      args.paginationOpts.numItems > maxInspectionRows ||
      (args.paginationOpts.maximumRowsRead ?? 0) > maxInspectionRows ||
      (args.paginationOpts.maximumBytesRead ?? 0) > maxBatchReadBytes
    )
      throw new ConvexError('Bound candidate work inspection');
    return ctx.db
      .query('catalogImpactWork')
      .withIndex('by_runId_and_state', (q) =>
        q.eq('runId', args.runId).eq('state', args.state),
      )
      .paginate(args.paginationOpts);
  },
});
