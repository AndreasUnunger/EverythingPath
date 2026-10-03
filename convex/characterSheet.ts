import { compareValues, ConvexError, v } from 'convex/values';
import { zodOutputToConvex } from 'convex-helpers/server/zod4';
import type { Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import { query } from './_generated/server';
import { campaignMutation } from './lib/campaignRuntime';
import schema, { creationSettingsValidator, modifierValidator } from './schema';
import { getUser } from './user';
import {
  requireCharacterCampaignAccess,
  type CharacterScope,
} from './lib/characterAccess';
import {
  abilityKeys,
  abilityTargets,
  defaultAbilityScores,
  calculateCharacterSheet,
  creationSettingsFor,
  modifierConditionSchema,
  type Modifier,
  type BaseModifier,
} from '../src/lib/character-sheet';
import {
  deleteCharacterSheet,
  initializeCharacterSheet,
  isManualCatalogEntry,
  loadCharacterSheet,
  pruneWarningAcceptancesAndRecordChange,
  requireFixtureCampaign,
  updateCharacterArchive,
} from './lib/characterSheet';

const scope = {
  organizationId: v.optional(v.string()),
  campaignId: v.optional(v.id('campaign')),
  characterId: v.id('character'),
};
const abilityValue = v.object({ score: v.number(), modifier: v.number() });
const sourcedModifierValidator = modifierValidator.omit('condition').extend({
  condition: v.optional(zodOutputToConvex(modifierConditionSchema)),
  sheetEntryId: v.string(),
  entryName: v.string(),
  source: v.string(),
  builtIn: v.boolean(),
  stacksWithItself: v.optional(v.boolean()),
});
const breakdownValidator = v.object({
  total: v.number(),
  applied: v.array(sourcedModifierValidator),
  suppressed: v.array(
    sourcedModifierValidator.extend({
      reason: v.string(),
      suppressedBy: v.string(),
    }),
  ),
  conditional: v.array(sourcedModifierValidator),
});
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
  creationSettings: creationSettingsValidator,
  pointBuy: v.union(
    v.null(),
    v.object({
      spent: v.union(v.number(), v.null()),
    }),
  ),
  warnings: v.array(
    v.object({
      kind: v.union(
        v.literal('incomplete'),
        v.literal('unresolved'),
        v.literal('rules'),
      ),
      check: v.union(
        v.literal('class'),
        v.literal('hpGainedMissing'),
        v.literal('hpGainedBelowMinimum'),
        v.literal('totalHpUnresolved'),
        v.literal('levelZero'),
        v.literal('pointBuy'),
      ),
      target: v.union(
        v.object({ kind: v.literal('pointBuy') }),
        v.object({
          kind: v.literal('classLevel'),
          entryId: v.string(),
          field: v.union(v.literal('class'), v.literal('hpGained')),
        }),
        v.object({ kind: v.literal('hitPoints') }),
        v.object({ kind: v.literal('classLevels') }),
      ),
      subject: v.string(),
      fingerprint: v.string(),
      message: v.string(),
    }),
  ),
  breakdowns: v.record(v.string(), breakdownValidator),
  derivedStatistics: v.object({
    ac: breakdownValidator,
    touchAc: breakdownValidator,
    flatFootedAc: breakdownValidator,
    cmd: breakdownValidator,
    flatFootedCmd: breakdownValidator,
  }),
});
export const create = campaignMutation({
  args: {
    organizationId: v.optional(v.string()),
    campaignId: v.optional(v.id('campaign')),
    name: v.string(),
    kind: v.union(v.literal('pc'), v.literal('npc')),
    description: v.optional(v.string()),
    operationId: v.string(),
  },
  returns: v.id('character'),
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError('Authentication required');
    const user = await getUser(ctx, identity.tokenIdentifier);
    if (args.campaignId) {
      if (!args.organizationId)
        throw new ConvexError('Organization is required for a campaign');
      const { campaign } = await requireCharacterCampaignAccess(ctx, {
        campaignId: args.campaignId,
        organizationId: args.organizationId,
      });
      requireFixtureCampaign(campaign);
    } else {
      if (args.organizationId !== undefined)
        throw new ConvexError('Campaign is required for an organization');
      if (!user.characterSheetDemo)
        throw new ConvexError(
          "Private character sheets aren't available for your account yet.",
        );
    }
    if (!args.name.trim())
      throw new ConvexError('Character name cannot be empty');
    const characterId = await ctx.db.insert('character', {
      ...(args.campaignId
        ? { campaignId: args.campaignId }
        : { sheetDemo: true as const }),
      name: args.name.trim(),
      kind: args.kind,
      description: args.description ?? '',
      ownerId: identity.tokenIdentifier,
      isActive: true,
      level: 1,
      ...defaultAbilityScores,
    });
    await initializeCharacterSheet(ctx, {
      characterId,
      operationId: args.operationId,
      updatedBy: identity.tokenIdentifier,
    });
    return characterId;
  },
});
export const read = query({
  args: { ...scope, characterId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      character: schema.doc('character'),
      campaign: v.union(
        v.null(),
        v.object({
          campaignId: v.id('campaign'),
          campaignName: v.string(),
          organizationId: v.string(),
        }),
      ),
      entries: v.array(schema.doc('characterSheetEntry')),
      catalogEntries: v.array(schema.doc('catalogEntry')),
      baseScoresEntry: schema.doc('catalogEntry'),
      calculated: calculatedValidator,
      acceptedWarnings: v.array(schema.doc('acceptedWarning')),
      revision: v.number(),
      lastOperationId: v.union(v.string(), v.null()),
      updatedBy: v.union(v.string(), v.null()),
    }),
  ),
  async handler(ctx, args) {
    const characterId = ctx.db.normalizeId('character', args.characterId);
    if (!characterId) throw new ConvexError('Character not found');
    const sheet = await loadCharacterSheet(ctx, { ...args, characterId });
    if (!sheet) return null;
    const { actor: _actor, ...result } = sheet;
    return {
      ...result,
      calculated: calculateCharacterSheet({
        entries: sheet.entries,
        catalogEntries: sheet.catalogEntries,
        characterKind: sheet.character.kind,
      }),
    };
  },
});

const writeScope = { ...scope, operationId: v.string() };
const rowScope = { ...writeScope, entryId: v.id('characterSheetEntry') };
const personalAdjustmentFields = {
  name: v.string(),
  modifiers: v.array(modifierValidator.omit('stacksWithinEntry')),
};
async function loadWritableSheet(ctx: MutationCtx, args: CharacterScope) {
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
  const reordered = levels.map((row, index) => ({
    ...row,
    state: { ...row.state, position: index + 1 },
  }));
  for (const [index, row] of reordered.entries())
    if (levels[index]?.state.position !== row.state.position)
      await ctx.db.patch('characterSheetEntry', row._id, { state: row.state });
  return reordered;
}
function requireFiniteNumber(value: number) {
  if (!Number.isFinite(value)) throw new ConvexError('Enter a finite number');
}
function requireNonnegativeInteger(value: number, label: string) {
  requireFiniteNumber(value);
  if (!Number.isInteger(value) || value < 0)
    throw new ConvexError(`${label} must be a whole number of 0 or more`);
}
function modifierReferences(modifiers: readonly Modifier[]) {
  return modifiers.flatMap((modifier) => {
    const situation = modifier.condition?.situation;
    return [
      modifier.condition?.whileActive,
      typeof situation === 'object' && 'option' in situation
        ? situation.option
        : undefined,
    ].filter((reference): reference is string => reference !== undefined);
  });
}
function validatePersonalAdjustment({
  sheet,
  name,
  modifiers,
  previousModifiers = [],
}: {
  sheet: NonNullable<Awaited<ReturnType<typeof loadCharacterSheet>>>;
  name: string;
  modifiers: readonly Modifier[];
  previousModifiers?: readonly Modifier[];
}) {
  if (!name.trim()) throw new ConvexError('Adjustment name cannot be empty');
  if (modifiers.length > 256)
    throw new ConvexError('An adjustment supports at most 256 Modifiers');
  for (const modifier of modifiers) {
    requireFiniteNumber(modifier.value);
    if (modifier.bonusType === 'base')
      throw new ConvexError('Base scores cannot be personal adjustments');
  }
  const previousReferences = new Set(modifierReferences(previousModifiers));
  for (const reference of modifierReferences(modifiers)) {
    if (
      !previousReferences.has(reference) &&
      !sheet.catalogEntries.some((entry) => entry._id === reference)
    )
      throw new ConvexError(
        'Modifier reference does not belong to this Character',
      );
  }
}
export const createPersonalAdjustment = campaignMutation({
  args: { ...writeScope, ...personalAdjustmentFields },
  returns: v.id('characterSheetEntry'),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    validatePersonalAdjustment({
      sheet,
      name: args.name,
      modifiers: args.modifiers,
    });
    if (sheet.entries.length >= 4096)
      throw new ConvexError('Character sheet is too large');
    const catalogEntryId = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: args.characterId,
      name: args.name.trim(),
      ruleIdentity: `manual:${args.characterId}`,
      stacksWithItself: false,
      modifiers: args.modifiers,
      detail: { kind: 'manual' },
      sources: [],
    });
    await ctx.db.patch('catalogEntry', catalogEntryId, {
      ruleIdentity: `manual:${catalogEntryId}`,
    });
    const entryId = await ctx.db.insert('characterSheetEntry', {
      characterId: args.characterId,
      kind: 'manual',
      active: true,
      catalogEntryId,
      state: { kind: 'manual' },
    });
    const entry = await ctx.db.get('characterSheetEntry', entryId);
    const catalogEntry = await ctx.db.get('catalogEntry', catalogEntryId);
    if (!entry || !catalogEntry)
      throw new ConvexError('Personal adjustment is unavailable');
    sheet.entries.push(entry);
    sheet.catalogEntries.push(catalogEntry);
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return entryId;
  },
});
function getPersonalAdjustment(
  sheet: NonNullable<Awaited<ReturnType<typeof loadCharacterSheet>>>,
  entryId: Id<'characterSheetEntry'>,
) {
  const entry = sheet.entries.find((row) => row._id === entryId);
  if (entry?.kind !== 'manual')
    throw new ConvexError(
      'Personal adjustment does not belong to this Character',
    );
  return entry;
}
export const editPersonalAdjustment = campaignMutation({
  args: {
    ...rowScope,
    ...v.object(personalAdjustmentFields).partial().fields,
    active: v.optional(v.boolean()),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const entry = getPersonalAdjustment(sheet, args.entryId);
    const catalogEntry = sheet.catalogEntries.find(
      (row) => row._id === entry.catalogEntryId,
    );
    if (!catalogEntry || !isManualCatalogEntry(catalogEntry))
      throw new ConvexError('Personal adjustment is unavailable');
    const name = args.name?.trim() ?? catalogEntry.name;
    const modifiers = args.modifiers ?? catalogEntry.modifiers;
    validatePersonalAdjustment({
      sheet,
      name,
      modifiers,
      previousModifiers: catalogEntry.modifiers,
    });
    if (
      catalogEntry.name === name &&
      compareValues(catalogEntry.modifiers, modifiers) === 0 &&
      (args.active === undefined || args.active === entry.active)
    )
      return null;
    const catalogPatch = {
      ...(args.name !== undefined ? { name } : {}),
      ...(args.modifiers !== undefined ? { modifiers } : {}),
    };
    if (args.name !== undefined || args.modifiers !== undefined)
      await ctx.db.patch('catalogEntry', entry.catalogEntryId, catalogPatch);
    if (args.active !== undefined)
      await ctx.db.patch('characterSheetEntry', entry._id, {
        active: args.active,
      });
    sheet.catalogEntries = sheet.catalogEntries.map((row) =>
      row._id === catalogEntry._id && isManualCatalogEntry(row)
        ? { ...row, name, modifiers }
        : row,
    );
    sheet.entries = sheet.entries.map((row) =>
      row.kind === 'manual' &&
      row._id === entry._id &&
      args.active !== undefined
        ? { ...row, active: args.active }
        : row,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});
export const removePersonalAdjustment = campaignMutation({
  args: rowScope,
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const entry = getPersonalAdjustment(sheet, args.entryId);
    await ctx.db.delete('characterSheetEntry', entry._id);
    await ctx.db.delete('catalogEntry', entry.catalogEntryId);
    sheet.entries = sheet.entries.filter((row) => row._id !== entry._id);
    sheet.catalogEntries = sheet.catalogEntries.filter(
      (row) => row._id !== entry.catalogEntryId,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});
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
    const values = new Map<BaseModifier['target'], number>();
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
    sheet.catalogEntries = sheet.catalogEntries.map((entry) =>
      entry._id === catalogEntry._id && entry.detail.kind === 'base'
        ? { ...entry, modifiers }
        : entry,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
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
        position:
          sheet.entries.filter((entry) => entry.kind === 'classLevel').length +
          1,
        hpGained: null,
      },
    });
    const entry = await ctx.db.get('characterSheetEntry', entryId);
    if (!entry) throw new ConvexError('Class Level is unavailable');
    sheet.entries.push(entry);
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
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
    const state = { ...entry.state, hpGained: args.hpGained };
    await ctx.db.patch('characterSheetEntry', entry._id, { state });
    sheet.entries = sheet.entries.map((row) =>
      row._id === entry._id ? { ...entry, state } : row,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
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
    sheet.entries = [
      ...sheet.entries.filter((entry) => entry.kind !== 'classLevel'),
      ...(await renumberClassLevels(ctx, levels)),
    ];
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
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
    sheet.entries = [
      ...sheet.entries.filter((entry) => entry.kind !== 'classLevel'),
      ...(await renumberClassLevels(ctx, levels)),
    ];
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

export const editCreationSettings = campaignMutation({
  args: { ...writeScope, settings: creationSettingsValidator.partial() },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const base = sheet.entries.find((entry) => entry.kind === 'base');
    if (!base) throw new ConvexError('Base scores are unavailable');
    const previous = creationSettingsFor(base);
    const settings = { ...previous, ...args.settings };
    if (settings.abilityMethod.budget !== undefined)
      requireNonnegativeInteger(
        settings.abilityMethod.budget,
        'Point-buy budget',
      );
    requireNonnegativeInteger(settings.traitCount, 'Trait count');
    if (JSON.stringify(previous) === JSON.stringify(settings)) return null;
    const state = { ...base.state, ...settings };
    await ctx.db.patch('characterSheetEntry', base._id, { state });
    sheet.entries = sheet.entries.map((entry) =>
      entry._id === base._id ? { ...base, state } : entry,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

const warningScope = { ...writeScope, check: v.string(), subject: v.string() };
export const acceptWarning = campaignMutation({
  args: { ...warningScope, fingerprint: v.string() },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const calculated = calculateCharacterSheet({
      entries: sheet.entries,
      catalogEntries: sheet.catalogEntries,
      characterKind: sheet.character.kind,
    });
    const warning = calculated.warnings.find(
      (item) =>
        item.check === args.check &&
        item.subject === args.subject &&
        item.fingerprint === args.fingerprint,
    );
    if (warning?.kind !== 'rules')
      throw new ConvexError('Only a current rules warning can be accepted');
    const previous = sheet.acceptedWarnings.find(
      (item) => item.check === args.check && item.subject === args.subject,
    );
    if (previous?.fingerprint === warning.fingerprint) return null;
    if (previous) {
      await ctx.db.delete('acceptedWarning', previous._id);
      sheet.acceptedWarnings = sheet.acceptedWarnings.filter(
        (item) => item._id !== previous._id,
      );
    }
    if (sheet.acceptedWarnings.length >= 8192)
      throw new ConvexError('Character has too many accepted warnings');
    await ctx.db.insert('acceptedWarning', {
      characterId: args.characterId,
      check: warning.check,
      subject: warning.subject,
      fingerprint: warning.fingerprint,
      acceptedBy: sheet.actor,
      acceptedAt: Date.now(),
    });
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
      calculated,
    });
    return null;
  },
});
export const reopenWarning = campaignMutation({
  args: warningScope,
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const previous = sheet.acceptedWarnings.find(
      (item) => item.check === args.check && item.subject === args.subject,
    );
    if (!previous) return null;
    await ctx.db.delete('acceptedWarning', previous._id);
    sheet.acceptedWarnings = sheet.acceptedWarnings.filter(
      (item) => item._id !== previous._id,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

export const archive = campaignMutation({
  args: { ...writeScope, isActive: v.boolean() },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    if (!sheet.character.campaignId)
      throw new ConvexError('Only campaign Characters can be archived');
    await updateCharacterArchive(ctx, args);
    sheet.character = { ...sheet.character, isActive: args.isActive };
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

export const deletePrivate = campaignMutation({
  args: writeScope,
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    if (sheet.character.campaignId)
      throw new ConvexError('Archive campaign Characters instead');
    await deleteCharacterSheet(ctx, args.characterId);
    return null;
  },
});
