import { ConvexError, v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import { query } from './_generated/server';
import { campaignMutation } from './lib/campaignRuntime';
import schema from './schema';
import {
  abilityKeys,
  abilityTargets,
  defaultAbilityScores,
} from '../src/lib/character-sheet';
import {
  initializeCharacterSheet,
  loadCharacterSheet,
  recordSheetChange,
  requireFixtureCampaign,
  requireSheetCampaignAccess,
} from './lib/characterSheet';

const scope = { organizationId: v.string(), characterId: v.id('character') };
const abilityValue = v.object({ score: v.number(), modifier: v.number() });
const calculatedValidator = v.object({
  abilities: v.object({
    strength: abilityValue,
    dexterity: abilityValue,
    constitution: abilityValue,
    intelligence: abilityValue,
    wisdom: abilityValue,
    charisma: abilityValue,
  }),
  level: v.number(),
  hitDice: v.number(),
  hp: v.union(v.number(), v.null()),
});
export const create = campaignMutation({
  args: {
    organizationId: v.string(),
    campaignId: v.id('campaign'),
    name: v.string(),
    kind: v.union(v.literal('pc'), v.literal('npc')),
    description: v.optional(v.string()),
    operationId: v.string(),
  },
  returns: v.id('character'),
  async handler(ctx, args) {
    const { campaign, access } = await requireSheetCampaignAccess(ctx, {
      campaignId: args.campaignId,
      organizationId: args.organizationId,
    });
    requireFixtureCampaign(campaign);
    if (!args.name.trim())
      throw new ConvexError('Character name cannot be empty');
    const characterId = await ctx.db.insert('character', {
      campaignId: args.campaignId,
      name: args.name.trim(),
      kind: args.kind,
      description: args.description ?? '',
      ownerId: access.user.tokenIdentifier,
      isActive: true,
      level: 1,
      ...defaultAbilityScores,
    });
    await initializeCharacterSheet(ctx, {
      characterId,
      operationId: args.operationId,
      updatedBy: access.user.tokenIdentifier,
    });
    return characterId;
  },
});
export const read = query({
  args: { organizationId: v.string(), characterId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      character: schema.doc('character'),
      entries: v.array(schema.doc('characterSheetEntry')),
      catalogEntries: v.array(schema.doc('catalogEntry')),
      baseScoresEntry: schema.doc('catalogEntry'),
      calculated: calculatedValidator,
      revision: v.number(),
      lastOperationId: v.union(v.string(), v.null()),
      updatedBy: v.union(v.string(), v.null()),
    }),
  ),
  async handler(ctx, args) {
    const characterId = ctx.db.normalizeId('character', args.characterId);
    if (!characterId) throw new ConvexError('Invalid Character identifier');
    const sheet = await loadCharacterSheet(ctx, { ...args, characterId });
    if (!sheet) return null;
    const { actor: _actor, ...result } = sheet;
    return result;
  },
});

const writeScope = { ...scope, operationId: v.string() };
const rowScope = { ...writeScope, entryId: v.id('characterSheetEntry') };
async function loadWritableSheet(
  ctx: MutationCtx,
  args: { organizationId: string; characterId: Id<'character'> },
) {
  const sheet = await loadCharacterSheet(ctx, args, { isWritable: true });
  if (!sheet) throw new ConvexError('Character has no sheet');
  return sheet;
}
function getClassLevel(
  sheet: NonNullable<Awaited<ReturnType<typeof loadCharacterSheet>>>,
  entryId: Id<'characterSheetEntry'>,
) {
  const entry = sheet.entries.find((item) => item._id === entryId);
  if (entry?.kind !== 'classLevel')
    throw new ConvexError('Class Level does not belong to this Character');
  return entry;
}
async function renumberClassLevels(
  ctx: MutationCtx,
  levels: ReturnType<typeof getClassLevel>[],
) {
  for (const [index, row] of levels.entries())
    if (row.state.position !== index + 1)
      await ctx.db.patch('characterSheetEntry', row._id, {
        state: { ...row.state, position: index + 1 },
      });
}
function requireFiniteNumber(value: number) {
  if (!Number.isFinite(value)) throw new ConvexError('Enter a finite number');
}
export const editBaseScores = campaignMutation({
  args: {
    ...writeScope,
    scores: v.object({
      strength: v.optional(v.number()),
      dexterity: v.optional(v.number()),
      constitution: v.optional(v.number()),
      intelligence: v.optional(v.number()),
      wisdom: v.optional(v.number()),
      charisma: v.optional(v.number()),
    }),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const catalogEntry = sheet.baseScoresEntry;
    const values = new Map<
      (typeof abilityTargets)[keyof typeof abilityTargets],
      number
    >();
    for (const ability of abilityKeys) {
      const value = args.scores[ability];
      if (value !== undefined) {
        requireFiniteNumber(value);
        values.set(abilityTargets[ability], value);
      }
    }
    const modifiers = catalogEntry.modifiers.map((modifier) => ({
      ...modifier,
      value: values.get(modifier.target) ?? modifier.value,
    }));
    const hasChanges = modifiers.some(
      (modifier, index) =>
        modifier.value !== catalogEntry.modifiers[index]?.value,
    );
    if (!hasChanges) return null;
    await ctx.db.patch('catalogEntry', catalogEntry._id, { modifiers });
    await recordSheetChange(ctx, {
      character: sheet.character,
      operationId: args.operationId,
      updatedBy: sheet.actor,
    });
    return null;
  },
});
export const addClassLevel = campaignMutation({
  args: writeScope,
  returns: v.id('characterSheetEntry'),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    if (sheet.entries.length >= 4096)
      throw new ConvexError('Character sheet is too large');
    const entryId = await ctx.db.insert('characterSheetEntry', {
      characterId: args.characterId,
      kind: 'classLevel',
      active: true,
      state: {
        kind: 'classLevel',
        classEntryId: null,
        position: sheet.calculated.level + 1,
        hpGained: null,
      },
    });
    await recordSheetChange(ctx, {
      character: sheet.character,
      operationId: args.operationId,
      updatedBy: sheet.actor,
    });
    return entryId;
  },
});
export const editClassLevel = campaignMutation({
  args: { ...rowScope, hpGained: v.union(v.number(), v.null()) },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const entry = getClassLevel(sheet, args.entryId);
    if (args.hpGained !== null) requireFiniteNumber(args.hpGained);
    if (entry.state.hpGained === args.hpGained) return null;
    await ctx.db.patch('characterSheetEntry', entry._id, {
      state: { ...entry.state, hpGained: args.hpGained },
    });
    await recordSheetChange(ctx, {
      character: sheet.character,
      operationId: args.operationId,
      updatedBy: sheet.actor,
    });
    return null;
  },
});
export const moveClassLevel = campaignMutation({
  args: { ...rowScope, position: v.number() },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const entry = getClassLevel(sheet, args.entryId);
    const levels = sheet.entries
      .filter((item) => item.kind === 'classLevel')
      .filter((item) => item._id !== entry._id);
    if (
      !Number.isInteger(args.position) ||
      args.position < 1 ||
      args.position > levels.length + 1
    )
      throw new ConvexError('Choose a valid Class Level position');
    levels.splice(args.position - 1, 0, entry);
    await renumberClassLevels(ctx, levels);
    await recordSheetChange(ctx, {
      character: sheet.character,
      operationId: args.operationId,
      updatedBy: sheet.actor,
    });
    return null;
  },
});
export const deleteClassLevel = campaignMutation({
  args: rowScope,
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const entry = getClassLevel(sheet, args.entryId);
    await ctx.db.delete('characterSheetEntry', entry._id);
    const levels = sheet.entries
      .filter((item) => item.kind === 'classLevel')
      .filter((item) => item._id !== entry._id);
    await renumberClassLevels(ctx, levels);
    await recordSheetChange(ctx, {
      character: sheet.character,
      operationId: args.operationId,
      updatedBy: sheet.actor,
    });
    return null;
  },
});
