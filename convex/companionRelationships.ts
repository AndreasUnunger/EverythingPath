import { ConvexError, v, type Infer } from 'convex/values';
import { query } from './_generated/server';
import type { MutationCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { legacyCharacterMutation } from './lib/campaignRuntime';
import {
  characterKindValidator,
  companionKindValidator,
  companionSourceValidator,
  companionStatusValidator,
} from './schema';
import { requireCharacterAccess } from './lib/characterAccess';
import {
  initializeCharacterSheet,
  loadCharacterSheet,
  type LoadedCharacterSheet,
} from './lib/characterSheet';
import { defaultAbilityScores } from '../src/lib/character-sheet';
import { formatGrantKeyId } from '../src/lib/character-sheet-grants';
import {
  isCompatibleCompanionEndpoint,
  hasAvailableSupportingSource,
  isSupportingSourceAvailable,
  doesCreateCompanionCycle,
  readCompanionGraph,
  reconcileCompanionRelationships,
} from './lib/companionRelationships';

const relationshipArgs = {
  relationshipId: v.id('companionRelationship'),
  operationId: v.string(),
};
const linkArgs = {
  associatedCharacterId: v.id('character'),
  kind: companionKindValidator,
  sources: v.array(companionSourceValidator),
  operationId: v.string(),
};

const linkValidator = v.object({
  ...linkArgs,
  companionCharacterId: v.id('character'),
});

export const list = query({
  args: { characterId: v.id('character') },
  returns: v.array(
    v.object({
      relationshipId: v.id('companionRelationship'),
      role: v.union(v.literal('companion'), v.literal('associated')),
      kind: companionKindValidator,
      status: v.optional(companionStatusValidator),
      interruption: v.union(
        v.null(),
        v.literal('manual'),
        v.literal('support'),
        v.literal('access'),
        v.literal('conflict'),
        v.literal('cycle'),
      ),
      endpoint: v.union(
        v.null(),
        v.object({ characterId: v.id('character'), name: v.string() }),
      ),
      sources: v.array(
        companionSourceValidator.extend({ available: v.boolean() }),
      ),
      lastOperationId: v.optional(v.string()),
    }),
  ),
  async handler(ctx, args) {
    await requireCharacterAccess(ctx, args);
    const graph = await readCompanionGraph(ctx, args.characterId);
    const result = [];
    for (const row of graph.relationships.values()) {
      if (
        row.associatedCharacterId !== args.characterId &&
        row.companionCharacterId !== args.characterId
      )
        continue;
      const role: 'companion' | 'associated' =
        row.associatedCharacterId === args.characterId
          ? 'companion'
          : 'associated';
      const endpointId =
        role === 'companion'
          ? row.companionCharacterId
          : row.associatedCharacterId;
      let endpoint: { characterId: Id<'character'>; name: string } | null =
        null;
      try {
        const { character } = await requireCharacterAccess(ctx, {
          characterId: endpointId,
        });
        endpoint = { characterId: character._id, name: character.name };
      } catch (error) {
        if (!(error instanceof ConvexError)) throw error;
      }
      const state = graph.states.get(row._id);
      if (!state) continue;
      result.push({
        relationshipId: row._id,
        role,
        kind: row.kind,
        ...(endpoint
          ? { status: state.status, lastOperationId: row.lastOperationId }
          : {}),
        interruption:
          role === 'associated' && !endpoint ? null : state.interruption,
        endpoint,
        sources:
          role === 'associated' && !endpoint
            ? []
            : row.sources.map((source) => ({
                ...source,
                available: isSupportingSourceAvailable(
                  source,
                  graph.countingEntries.get(row.associatedCharacterId),
                ),
              })),
      });
    }
    return result;
  },
});

async function getWritableSheet(
  ctx: MutationCtx,
  characterId: Id<'character'>,
) {
  const sheet = await loadCharacterSheet(
    ctx,
    { characterId },
    { isWritable: true },
  );
  if (!sheet) throw new ConvexError('Character Sheet not found');
  return sheet;
}

function validateSources(
  sheet: LoadedCharacterSheet,
  sources: Infer<typeof companionSourceValidator>[],
) {
  if (!sources.length || sources.length > 128)
    throw new ConvexError('Choose between 1 and 128 supporting sources');
  const keys = new Set<string>();
  for (const source of sources) {
    if (!source.key.trim() || !source.label.trim() || keys.has(source.key))
      throw new ConvexError('Supporting sources need unique keys and names');
    keys.add(source.key);
    if (source.sheetEntryId && source.grantKey)
      throw new ConvexError('Choose one reference for each supporting source');
    if (source.sheetEntryId) {
      const entry = sheet.entries.find(
        (entry) => entry._id === source.sheetEntryId,
      );
      if (entry?.characterId !== sheet.character._id)
        throw new ConvexError(
          'Supporting source does not belong to this Character',
        );
      if (
        entry.kind === 'base' ||
        entry.kind === 'abilityDamage' ||
        entry.kind === 'abilityDrain'
      )
        throw new ConvexError(
          'Choose a Class Level, Grant or Selection as the supporting source',
        );
    }
    const grantKey = source.grantKey;
    if (
      grantKey &&
      !sheet.calculated.resolvedEntries.some(
        (row) => row.entry._id === formatGrantKeyId(grantKey),
      )
    )
      throw new ConvexError(
        'Supporting Grant does not belong to this Character',
      );
  }
}

async function validateLink(
  ctx: MutationCtx,
  {
    associated,
    companion,
    ignoredRelationshipId,
    supportingSources,
  }: {
    associated: LoadedCharacterSheet;
    companion: LoadedCharacterSheet;
    ignoredRelationshipId?: Id<'companionRelationship'>;
    supportingSources?: Infer<typeof companionSourceValidator>[];
  },
) {
  const associatedCharacterId = associated.character._id;
  const companionCharacterId = companion.character._id;
  if (associatedCharacterId === companionCharacterId)
    throw new ConvexError('A Character cannot be its own Companion');
  if (!isCompatibleCompanionEndpoint(associated.character, companion.character))
    throw new ConvexError(
      'Companions must share a campaign or be private Characters with the same owner',
    );
  const loadedSheets = [associated, companion];
  const associatedGraph = await readCompanionGraph(
    ctx,
    associatedCharacterId,
    loadedSheets,
  );
  const companionGraph = associatedGraph.characters.has(companionCharacterId)
    ? associatedGraph
    : await readCompanionGraph(ctx, companionCharacterId, loadedSheets);
  if (
    supportingSources &&
    !hasAvailableSupportingSource(
      supportingSources,
      associatedGraph.countingEntries.get(associatedCharacterId),
    )
  )
    throw new ConvexError(
      'This relationship has no available supporting source',
    );
  const active = new Map([...associatedGraph.active, ...companionGraph.active]);
  for (const [id, row] of active)
    if (row._id === ignoredRelationshipId) active.delete(id);
  if (active.has(companionCharacterId))
    throw new ConvexError(
      'This Companion already has an active associated Character',
    );
  if (
    doesCreateCompanionCycle(
      active,
      associatedCharacterId,
      companionCharacterId,
    )
  )
    throw new ConvexError(
      'Companion Relationships cannot form an active cycle',
    );
}

async function getRelationship(
  ctx: MutationCtx,
  relationshipId: Id<'companionRelationship'>,
) {
  const row = await ctx.db.get('companionRelationship', relationshipId);
  if (!row) throw new ConvexError('Companion Relationship not found');
  const associated = await getWritableSheet(ctx, row.associatedCharacterId);
  return { row, associated };
}

async function insertRelationship(
  ctx: MutationCtx,
  args: Infer<typeof linkValidator>,
  loadedSheets: LoadedCharacterSheet[],
) {
  const id = await ctx.db.insert('companionRelationship', {
    associatedCharacterId: args.associatedCharacterId,
    companionCharacterId: args.companionCharacterId,
    kind: args.kind,
    sources: args.sources,
    status: 'active',
    manuallyInterrupted: false,
    activatedAt: Date.now(),
    lastOperationId: args.operationId,
  });
  await reconcileCompanionRelationships(
    ctx,
    args.associatedCharacterId,
    args.operationId,
    loadedSheets,
  );
  return id;
}

export const link = legacyCharacterMutation({
  args: linkValidator.fields,
  returns: v.id('companionRelationship'),
  async handler(ctx, args) {
    const [associated, companion] = await Promise.all([
      getWritableSheet(ctx, args.associatedCharacterId),
      getWritableSheet(ctx, args.companionCharacterId),
    ]);
    await validateLink(ctx, { associated, companion });
    validateSources(associated, args.sources);
    return await insertRelationship(ctx, args, [associated, companion]);
  },
});

export const create = legacyCharacterMutation({
  args: {
    ...linkArgs,
    name: v.string(),
    characterKind: v.optional(characterKindValidator),
  },
  returns: v.object({
    relationshipId: v.id('companionRelationship'),
    companionCharacterId: v.id('character'),
  }),
  async handler(ctx, args) {
    const sheet = await getWritableSheet(ctx, args.associatedCharacterId);
    validateSources(sheet, args.sources);
    if (!args.name.trim())
      throw new ConvexError('Character name cannot be empty');
    const level = args.kind === 'cohort' ? 1 : 0;
    const companionCharacterId = await ctx.db.insert('character', {
      ...(sheet.character.campaignId
        ? { campaignId: sheet.character.campaignId }
        : { sheetDemo: sheet.character.sheetDemo }),
      name: args.name.trim(),
      description: '',
      kind: args.characterKind ?? 'npc',
      ownerId: sheet.actor,
      isActive: true,
      level,
      ...defaultAbilityScores,
    });
    await initializeCharacterSheet(ctx, {
      characterId: companionCharacterId,
      operationId: args.operationId,
      updatedBy: sheet.actor,
      level,
    });
    const relationshipId = await insertRelationship(
      ctx,
      {
        ...args,
        companionCharacterId,
      },
      [sheet],
    );
    return { relationshipId, companionCharacterId };
  },
});

export const replace = legacyCharacterMutation({
  args: { ...relationshipArgs, companionCharacterId: v.id('character') },
  returns: v.id('companionRelationship'),
  async handler(ctx, args) {
    const { row: previous, associated } = await getRelationship(
      ctx,
      args.relationshipId,
    );
    if (previous.status === 'replaced')
      throw new ConvexError('Reselect this Companion before replacing it');
    if (previous.companionCharacterId === args.companionCharacterId)
      throw new ConvexError('Choose a different Companion');
    const companion = await getWritableSheet(ctx, args.companionCharacterId);
    await validateLink(ctx, {
      associated,
      companion,
      ignoredRelationshipId: previous._id,
    });
    await ctx.db.patch('companionRelationship', previous._id, {
      status: 'replaced',
      lastOperationId: args.operationId,
    });
    return await insertRelationship(
      ctx,
      {
        ...previous,
        companionCharacterId: args.companionCharacterId,
        operationId: args.operationId,
      },
      [associated, companion],
    );
  },
});

export const interrupt = legacyCharacterMutation({
  args: relationshipArgs,
  returns: v.null(),
  async handler(ctx, args) {
    const { row, associated } = await getRelationship(ctx, args.relationshipId);
    if (row.status === 'replaced')
      throw new ConvexError('Reselect this Companion before interrupting it');
    await ctx.db.patch('companionRelationship', row._id, {
      status: 'interrupted',
      manuallyInterrupted: true,
      lastOperationId: args.operationId,
    });
    await reconcileCompanionRelationships(
      ctx,
      row.associatedCharacterId,
      args.operationId,
      [associated],
    );
    return null;
  },
});

export const restore = legacyCharacterMutation({
  args: relationshipArgs,
  returns: v.null(),
  async handler(ctx, args) {
    const { row, associated } = await getRelationship(ctx, args.relationshipId);
    const companion = await getWritableSheet(ctx, row.companionCharacterId);
    await validateLink(ctx, {
      associated,
      companion,
      ignoredRelationshipId: row._id,
      supportingSources: row.sources,
    });
    await ctx.db.patch('companionRelationship', row._id, {
      status: 'active',
      manuallyInterrupted: false,
      activatedAt: Date.now(),
      lastOperationId: args.operationId,
    });
    await reconcileCompanionRelationships(
      ctx,
      row.associatedCharacterId,
      args.operationId,
      [associated],
    );
    return null;
  },
});

export const setSourceEnabled = legacyCharacterMutation({
  args: { ...relationshipArgs, sourceKey: v.string(), enabled: v.boolean() },
  returns: v.null(),
  async handler(ctx, args) {
    const { row, associated } = await getRelationship(ctx, args.relationshipId);
    if (!row.sources.some((source) => source.key === args.sourceKey))
      throw new ConvexError('Supporting source not found');
    await ctx.db.patch('companionRelationship', row._id, {
      sources: row.sources.map((source) =>
        source.key === args.sourceKey
          ? { ...source, enabled: args.enabled }
          : source,
      ),
      lastOperationId: args.operationId,
    });
    await reconcileCompanionRelationships(
      ctx,
      row.associatedCharacterId,
      args.operationId,
      [associated],
    );
    return null;
  },
});

export const addSource = legacyCharacterMutation({
  args: { ...relationshipArgs, source: companionSourceValidator },
  returns: v.null(),
  async handler(ctx, args) {
    const { row, associated } = await getRelationship(ctx, args.relationshipId);
    const sources = [...row.sources, args.source];
    if (
      sources.length > 128 ||
      row.sources.some((source) => source.key === args.source.key)
    )
      throw new ConvexError(
        'Supporting sources need unique keys and at most 128 contributions',
      );
    validateSources(associated, [args.source]);
    await ctx.db.patch('companionRelationship', row._id, {
      sources,
      lastOperationId: args.operationId,
    });
    await reconcileCompanionRelationships(
      ctx,
      row.associatedCharacterId,
      args.operationId,
      [associated],
    );
    return null;
  },
});
