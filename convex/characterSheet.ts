import {
  maxCharacterChildRows,
  maxAcceptedWarnings,
  requireAbilityScore,
  listCatalogDependencies,
} from './lib/preparedCharacterSheet';
import {
  characterSheetClassFamily,
  hasGrantAncestor,
  resolveCharacterSheetGrants,
  normalizeCharacterSheetChoiceName,
  type GrantKey,
} from '../src/lib/character-sheet-grants';
import {
  createCatalogSheetEntryState,
  isSelectableCatalogSheetEntryKind,
  isCatalogSheetEntry,
  type SelectableCatalogSheetEntryKind,
} from '../src/lib/character-sheet-entries';
import {
  compareValues,
  ConvexError,
  v,
  type Infer,
  type Validator,
} from 'convex/values';
import {
  canonicalSkillKey,
  sumRanksBySkill,
  skillDefinitions,
} from '../src/lib/character-sheet-skills';
import { zodOutputToConvex } from 'convex-helpers/server/zod4';
import type { Doc, Id } from './_generated/dataModel';
import type { WithoutSystemFields } from 'convex/server';
import type { MutationCtx } from './_generated/server';
import { query } from './_generated/server';
import { legacyCharacterMutation as campaignMutation } from './lib/campaignRuntime';
import schema, {
  creationSettingsValidator,
  favoredClassBonusValidator,
  characterSheetEntryValidator,
  modifierValidator,
  abilityValidator,
  abilityChangeKindValidator,
  sheetEntryDetailValidator,
  grantKeyValidator,
  selectionSourceValidator,
} from './schema';
import { getUser } from './user';
import {
  characterOwnerValidator,
  readCharacterOwners,
} from './lib/characterOwnership';
import {
  requireCharacterCampaignAccess,
  type CharacterScope,
} from './lib/characterAccess';
import {
  abilityKeys,
  abilityTargets,
  defaultAbilityScores,
  creationSettingsFor,
  modifierConditionSchema,
  characterSheetWarningSchema,
  type Modifier,
  type BaseModifier,
  type SheetEntry,
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
  value: v.number(),
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
// Stored state shapes flow directly into the read DTO; only resolver identity differs.
const resolvedSheetEntryValidator = v.union(
  ...characterSheetEntryValidator.members.map((member) =>
    member.extend({
      _id: v.string(),
      _creationTime: v.optional(v.number()),
      characterId: v.optional(v.id('character')),
    }),
  ),
);
const resolvedEntryValidator = v.object({
  entry: resolvedSheetEntryValidator as Validator<
    SheetEntry & {
      characterId?: Id<'character'>;
      _creationTime?: number;
    },
    'required',
    string
  >,
  origin: v.union(v.literal('grant'), v.literal('selection')),
  recorded: v.boolean(),
  dormant: v.boolean(),
  counting: v.boolean(),
  storedEntryId: v.optional(v.string()),
  reason: v.optional(
    v.union(
      v.object({ kind: v.literal('sourceMissing') }),
      v.object({
        kind: v.literal('replaced'),
        byEntryIds: v.array(v.string()),
      }),
    ),
  ),
});
const calculatedValidator = v.object({
  resolvedEntries: v.array(resolvedEntryValidator),
  warningsForAcceptance: v.array(
    zodOutputToConvex(characterSheetWarningSchema),
  ),
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
  classLevels: v.array(
    v.object({
      entryId: v.string(),
      position: v.number(),
      classEntryId: v.union(v.string(), v.null()),
      classLevel: v.union(v.number(), v.null()),
      hitDice: v.number(),
      abilityIncreaseDue: v.boolean(),
      skillRankBudget: v.union(v.number(), v.null()),
      skillRanksSpent: v.number(),
      skillRanksRemaining: v.union(v.number(), v.null()),
      skillRankCap: v.number(),
      cumulativeSkillRanks: v.array(
        v.object({ skill: v.string(), ranks: v.number() }),
      ),
      exceededSkillRankCaps: v.array(
        v.object({ skill: v.string(), ranks: v.number() }),
      ),
    }),
  ),
  budgets: v.object({
    kind: v.literal('ordinary'),
    intelligenceModifier: v.number(),
    generalFeats: v.number(),
    racialSkillRanks: v.union(v.number(), v.null()),
    skillRanks: v.union(v.number(), v.null()),
    skillRankCap: v.number(),
  }),
  skills: v.array(
    v.object({
      key: v.union(...skillDefinitions.map(({ key }) => v.literal(key))),
      name: v.string(),
      ability: abilityValidator,
      ranks: v.number(),
      classSkill: v.boolean(),
      armorCheckPenalty: v.number(),
    }),
  ),
  hp: v.union(v.number(), v.null()),
  creationSettings: creationSettingsValidator,
  pointBuy: v.union(
    v.null(),
    v.object({
      spent: v.union(v.number(), v.null()),
    }),
  ),
  warnings: v.array(zodOutputToConvex(characterSheetWarningSchema)),
  breakdowns: v.record(v.string(), breakdownValidator),
  abilityModifierBreakdowns: v.record(v.string(), breakdownValidator),
  derivedStatistics: v.object({
    bab: breakdownValidator,
    fortitude: breakdownValidator,
    reflex: breakdownValidator,
    will: breakdownValidator,
    initiative: breakdownValidator,
    cmb: breakdownValidator,
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
      owner: v.union(characterOwnerValidator, v.null()),
      campaign: v.union(
        v.null(),
        v.object({
          campaignId: v.id('campaign'),
          campaignName: v.string(),
          organizationId: v.string(),
          ownershipAvailable: v.boolean(),
        }),
      ),
      entries: v.array(schema.doc('characterSheetEntry')),
      catalogEntries: v.array(schema.doc('catalogEntry')),
      baseScoresEntry: schema.doc('catalogEntry'),
      calculated: calculatedValidator,
      permanentCalculated: calculatedValidator.omit('resolvedEntries'),
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
    const owners = await readCharacterOwners(
      ctx,
      [sheet.character],
      sheet.actor,
    );
    return {
      ...result,
      owner: sheet.character.ownerId
        ? (owners.get(sheet.character.ownerId) ?? null)
        : null,
    };
  },
});

const writeScope = { ...scope, operationId: v.string() };
export const buildOut = campaignMutation({
  args: writeScope,
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    if (sheet.character.sheetMode === 'full') return null;
    await ctx.db.patch('character', args.characterId, { sheetMode: 'full' });
    sheet.character = { ...sheet.character, sheetMode: 'full' };
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});
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
function requireClassDefinition(
  sheet: NonNullable<Awaited<ReturnType<typeof loadCharacterSheet>>>,
  classEntryId: Id<'catalogEntry'>,
) {
  const definition = sheet.catalogEntries.find(
    (entry) => entry._id === classEntryId,
  );
  if (
    definition?.detail.kind !== 'class' ||
    definition.characterId !== sheet.character._id
  )
    throw new ConvexError('Class does not belong to this Character');
  return definition;
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
    if (typeof modifier.value === 'number') {
      requireFiniteNumber(modifier.value);
      if (
        modifier.target.startsWith('ability.') &&
        !Number.isSafeInteger(modifier.value)
      )
        throw new ConvexError('Ability Modifiers must be whole numbers');
    } else if (modifier.value.formula.length > 4096)
      throw new ConvexError('Formula is too long');
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
  args: {
    ...writeScope,
    ...personalAdjustmentFields,
    gainedAtClassLevel: v.optional(v.id('characterSheetEntry')),
  },
  returns: v.id('characterSheetEntry'),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    if (args.gainedAtClassLevel !== undefined)
      getClassLevel(sheet, args.gainedAtClassLevel);
    validatePersonalAdjustment({
      sheet,
      name: args.name,
      modifiers: args.modifiers,
    });
    if (sheet.entries.length >= maxCharacterChildRows)
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
      ...(args.gainedAtClassLevel !== undefined
        ? { gainedAtClassLevel: args.gainedAtClassLevel }
        : {}),
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
  if (entry?.kind !== 'manual' || entry.grantKey)
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
function isCatalogDefinitionReferenced(
  sheet: Awaited<ReturnType<typeof loadWritableSheet>>,
  catalogEntryId: Id<'catalogEntry'>,
  removedEntryId: Id<'characterSheetEntry'>,
) {
  if (
    sheet.entries.some(
      (entry) =>
        entry._id !== removedEntryId &&
        (('catalogEntryId' in entry &&
          entry.catalogEntryId === catalogEntryId) ||
          (entry.kind === 'classLevel' &&
            entry.state.classEntryId === catalogEntryId) ||
          (entry.kind === 'base' &&
            entry.state.favoredClassIds?.includes(catalogEntryId))),
    )
  )
    return true;
  return sheet.catalogEntries.some(
    (definition) =>
      definition._id !== catalogEntryId &&
      listCatalogDependencies(definition).some(
        ({ id, kind }) => kind !== 'condition' && id === catalogEntryId,
      ),
  );
}
async function removeCatalogSelection(
  ctx: MutationCtx,
  sheet: Awaited<ReturnType<typeof loadWritableSheet>>,
  entry: Doc<'characterSheetEntry'> & { catalogEntryId: Id<'catalogEntry'> },
) {
  await ctx.db.delete('characterSheetEntry', entry._id);
  if (!isCatalogDefinitionReferenced(sheet, entry.catalogEntryId, entry._id)) {
    await ctx.db.delete('catalogEntry', entry.catalogEntryId);
    sheet.catalogEntries = sheet.catalogEntries.filter(
      (row) => row._id !== entry.catalogEntryId,
    );
  }
  sheet.entries = sheet.entries.filter((row) => row._id !== entry._id);
}
export const removePersonalAdjustment = campaignMutation({
  args: rowScope,
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const entry = getPersonalAdjustment(sheet, args.entryId);
    await removeCatalogSelection(ctx, sheet, entry);
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
        requireAbilityScore(value);
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
      entry._id === catalogEntry._id ? { ...catalogEntry, modifiers } : entry,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});
export const addClassLevel = campaignMutation({
  args: {
    ...writeScope,
    position: v.optional(v.number()),
    classEntryId: v.optional(v.union(v.id('catalogEntry'), v.null())),
  },
  returns: v.id('characterSheetEntry'),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const levels = sheet.entries.filter((entry) => entry.kind === 'classLevel');
    const position = args.position ?? levels.length + 1;
    if (
      !Number.isInteger(position) ||
      position < 1 ||
      position > levels.length + 1
    )
      throw new ConvexError('Choose a valid Class Level position');
    const selected = args.classEntryId
      ? requireClassDefinition(sheet, args.classEntryId)
      : null;
    const chosen = selected
      ? levels.find(
          (entry) =>
            entry.state.classEntryId &&
            sheet.catalogEntries.find(
              (definition) => definition._id === entry.state.classEntryId,
            )?.ruleIdentity === selected.ruleIdentity,
        )?.state.classEntryId
      : null;
    if (sheet.entries.length >= maxCharacterChildRows)
      throw new ConvexError('Character sheet is too large');
    const entryId = await ctx.db.insert('characterSheetEntry', {
      characterId: args.characterId,
      kind: 'classLevel',
      active: true,
      state: {
        kind: 'classLevel',
        classEntryId: chosen ?? args.classEntryId ?? null,
        position,
        hpGained: null,
      },
    });
    const entry = await ctx.db.get('characterSheetEntry', entryId);
    if (!entry) throw new ConvexError('Class Level is unavailable');
    if (entry.kind !== 'classLevel')
      throw new ConvexError('Class Level is unavailable');
    levels.splice(position - 1, 0, entry);
    sheet.entries = [
      ...sheet.entries.filter((item) => item.kind !== 'classLevel'),
      ...(await renumberClassLevels(ctx, levels)),
    ];
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return entry._id;
  },
});
export const editClassLevel = campaignMutation({
  args: {
    ...rowScope,
    hpGained: v.optional(v.union(v.number(), v.null())),
    classEntryId: v.optional(v.union(v.id('catalogEntry'), v.null())),
    favoredClassBonus: v.optional(favoredClassBonusValidator),
    abilityIncrease: v.optional(
      v.union(v.null(), ...abilityKeys.map((ability) => v.literal(ability))),
    ),
    skillRanks: v.optional(v.record(v.string(), v.number())),
    skillRank: v.optional(v.object({ skill: v.string(), ranks: v.number() })),
    proficiencyChoice: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const entry = getClassLevel(sheet, args.entryId);
    if (args.hpGained !== undefined && args.hpGained !== null)
      requireFiniteNumber(args.hpGained);
    if (
      args.favoredClassBonus?.choice === 'alt' &&
      !args.favoredClassBonus.note.trim()
    )
      throw new ConvexError('Describe the other favored-class bonus');
    if (args.skillRanks !== undefined && args.skillRank !== undefined)
      throw new ConvexError('Save one skill or the full allocation, not both');
    const allocation = args.skillRank
      ? { [args.skillRank.skill]: args.skillRank.ranks }
      : args.skillRanks;
    const normalizedAllocation = allocation && sumRanksBySkill(allocation);
    for (const [skill, ranks] of Object.entries(allocation ?? {})) {
      if (!canonicalSkillKey(skill))
        throw new ConvexError('Choose an available skill');
      requireNonnegativeInteger(ranks, 'Skill ranks');
      if (!Number.isSafeInteger(ranks))
        throw new ConvexError('Skill ranks must be a safe whole number');
    }
    const skillRanks = args.skillRank
      ? {
          ...sumRanksBySkill(entry.state.skillRanks ?? {}),
          ...normalizedAllocation,
        }
      : normalizedAllocation;
    for (const ranks of Object.values(skillRanks ?? {}))
      if (!Number.isSafeInteger(ranks))
        throw new ConvexError('Skill ranks must be a safe whole number');
    const selected = args.classEntryId
      ? requireClassDefinition(sheet, args.classEntryId)
      : null;
    const proficiencyChoice = args.proficiencyChoice?.trim() ?? '';
    const changes = {
      ...(args.hpGained !== undefined ? { hpGained: args.hpGained } : {}),
      ...(args.classEntryId !== undefined
        ? { classEntryId: args.classEntryId }
        : {}),
      ...(args.favoredClassBonus !== undefined
        ? { favoredClassBonus: args.favoredClassBonus }
        : {}),
      ...(args.abilityIncrease !== undefined
        ? { abilityIncrease: args.abilityIncrease }
        : {}),
      ...(skillRanks !== undefined ? { skillRanks } : {}),
      ...(args.proficiencyChoice !== undefined
        ? {
            proficiencyChoice:
              proficiencyChoice === '' ? null : proficiencyChoice,
          }
        : {}),
    };
    let changed = false;
    for (const row of sheet.entries) {
      if (row.kind !== 'classLevel') continue;
      const rowClass = sheet.catalogEntries.find(
        (definition) => definition._id === row.state.classEntryId,
      );
      const switchesDefinition =
        selected && selected.ruleIdentity === rowClass?.ruleIdentity;
      let state = row.state;
      if (row._id === entry._id) state = { ...row.state, ...changes };
      else if (switchesDefinition)
        state = { ...row.state, classEntryId: selected._id };
      if (compareValues(state, row.state) === 0) continue;
      changed = true;
      await ctx.db.patch('characterSheetEntry', row._id, { state });
      row.state = state;
    }
    if (!changed) return null;
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
  args: {
    ...writeScope,
    settings: creationSettingsValidator.partial(),
    favoredClassIds: v.optional(v.array(v.id('catalogEntry'))),
  },
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
    const favoredClassIds: Id<'catalogEntry'>[] = [];
    for (const classId of args.favoredClassIds ?? []) {
      if (!(await ctx.db.get('catalogEntry', classId))) continue;
      requireClassDefinition(sheet, classId);
      favoredClassIds.push(classId);
    }
    const state = {
      ...base.state,
      ...settings,
      ...(args.favoredClassIds !== undefined ? { favoredClassIds } : {}),
    };
    if (compareValues(base.state, state) === 0) return null;
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
    const warning = sheet.calculated.warnings.find(
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
    if (sheet.acceptedWarnings.length >= maxAcceptedWarnings)
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

function getAbilityChange(
  sheet: Awaited<ReturnType<typeof loadWritableSheet>>,
  entryId: Id<'characterSheetEntry'>,
) {
  const entry = sheet.entries.find((row) => row._id === entryId);
  if (entry?.kind !== 'abilityDamage' && entry?.kind !== 'abilityDrain')
    throw new ConvexError('Ability change does not belong to this Character');
  return entry;
}
export const createAbilityChange = campaignMutation({
  args: {
    ...writeScope,
    kind: abilityChangeKindValidator,
    ability: abilityValidator,
    points: v.number(),
  },
  returns: v.id('characterSheetEntry'),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    requireNonnegativeInteger(args.points, 'Ability change');
    if (sheet.entries.length >= maxCharacterChildRows)
      throw new ConvexError('Character sheet is too large');
    const state = { ability: args.ability, points: args.points };
    const entryId = await ctx.db.insert(
      'characterSheetEntry',
      args.kind === 'abilityDamage'
        ? {
            characterId: args.characterId,
            kind: 'abilityDamage',
            active: true,
            state: { kind: 'abilityDamage', ...state },
          }
        : {
            characterId: args.characterId,
            kind: 'abilityDrain',
            active: true,
            state: { kind: 'abilityDrain', ...state },
          },
    );
    const entry = await ctx.db.get('characterSheetEntry', entryId);
    if (!entry) throw new ConvexError('Ability change is unavailable');
    sheet.entries.push(entry);
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return entryId;
  },
});
export const editAbilityChange = campaignMutation({
  args: {
    ...rowScope,
    ability: v.optional(abilityValidator),
    points: v.optional(v.number()),
    active: v.optional(v.boolean()),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const entry = getAbilityChange(sheet, args.entryId);
    if (args.points !== undefined)
      requireNonnegativeInteger(args.points, 'Ability change');
    const changes = {
      ability: args.ability ?? entry.state.ability,
      points: args.points ?? entry.state.points,
    };
    const active = args.active ?? entry.active;
    // Keep each state discriminator correlated with its Convex patch variant.
    const patch =
      entry.kind === 'abilityDamage'
        ? { active, state: { ...entry.state, ...changes } }
        : { active, state: { ...entry.state, ...changes } };
    if (
      compareValues(patch.state, entry.state) === 0 &&
      active === entry.active
    )
      return null;
    await ctx.db.patch('characterSheetEntry', entry._id, patch);
    const updated = await ctx.db.get('characterSheetEntry', entry._id);
    if (!updated) throw new ConvexError('Ability change is unavailable');
    sheet.entries = sheet.entries.map((row) =>
      row._id === entry._id ? updated : row,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});
export const removeAbilityChange = campaignMutation({
  args: rowScope,
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const entry = getAbilityChange(sheet, args.entryId);
    await ctx.db.delete('characterSheetEntry', entry._id);
    sheet.entries = sheet.entries.filter((row) => row._id !== entry._id);
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

function getSheetEntry(
  sheet: Awaited<ReturnType<typeof loadWritableSheet>>,
  entryId: Id<'characterSheetEntry'>,
) {
  const entry = sheet.entries.find((row) => row._id === entryId);
  if (!isCatalogSheetEntry(entry) || entry.grantKey)
    throw new ConvexError(
      'Character Sheet Entry does not belong to this Character',
    );
  const catalog = sheet.catalogEntries.find(
    (row) => row._id === entry.catalogEntryId,
  );
  if (!catalog || !isCatalogSheetEntry(catalog.detail))
    throw new ConvexError('Catalog Entry definition is unavailable');
  return { entry, catalog: { ...catalog, detail: catalog.detail } };
}
function validateSheetEntryDetail(
  detail: typeof sheetEntryDetailValidator.type,
  casterLevel?: number,
) {
  if (detail.kind === 'item' && detail.armor) {
    requireFiniteNumber(detail.armor.armorCheckPenalty);
    if (detail.armor.armorCheckPenalty < 0)
      throw new ConvexError('Armor check penalty must be nonnegative');
  }
  if (detail.kind === 'spellEffect') {
    requireNonnegativeInteger(
      detail.defaultCasterLevel,
      'Default caster level',
    );
    if (casterLevel !== undefined)
      requireNonnegativeInteger(casterLevel, 'Caster level');
  } else if (casterLevel !== undefined)
    throw new ConvexError('Only a Spell Effect has a caster level');
}
export const createSheetEntry = campaignMutation({
  args: {
    ...writeScope,
    ...personalAdjustmentFields,
    detail: sheetEntryDetailValidator,
    casterLevel: v.optional(v.number()),
  },
  returns: v.id('characterSheetEntry'),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    validatePersonalAdjustment({
      sheet,
      name: args.name,
      modifiers: args.modifiers,
    });
    validateSheetEntryDetail(args.detail, args.casterLevel);
    if (sheet.entries.length >= maxCharacterChildRows)
      throw new ConvexError('Character sheet is too large');
    const catalogEntryId = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: args.characterId,
      name: args.name.trim(),
      ruleIdentity: `sheetEntry:${args.characterId}`,
      stacksWithItself: false,
      modifiers: args.modifiers,
      detail: args.detail,
      sources: [],
    });
    await ctx.db.patch('catalogEntry', catalogEntryId, {
      ruleIdentity: `sheetEntry:${catalogEntryId}`,
    });
    const common = {
      characterId: args.characterId,
      active: true,
      catalogEntryId,
    };
    const detail = args.detail;
    const entryId = await ctx.db.insert(
      'characterSheetEntry',
      detail.kind === 'spellEffect'
        ? {
            ...common,
            kind: 'spellEffect',
            state: {
              kind: 'spellEffect',
              casterLevel: args.casterLevel ?? detail.defaultCasterLevel,
            },
          }
        : detail.kind === 'condition'
          ? { ...common, kind: 'condition', state: { kind: 'condition' } }
          : detail.kind === 'item'
            ? { ...common, kind: 'item', state: { kind: 'item' } }
            : { ...common, kind: 'spell', state: { kind: 'spell' } },
    );
    const entry = await ctx.db.get('characterSheetEntry', entryId);
    const catalog = await ctx.db.get('catalogEntry', catalogEntryId);
    if (!entry || !catalog)
      throw new ConvexError('Character Sheet Entry is unavailable');
    sheet.entries.push(entry);
    sheet.catalogEntries.push(catalog);
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return entryId;
  },
});
export const editSheetEntry = campaignMutation({
  args: {
    ...rowScope,
    name: v.optional(v.string()),
    modifiers: v.optional(v.array(modifierValidator.omit('stacksWithinEntry'))),
    detail: v.optional(sheetEntryDetailValidator),
    casterLevel: v.optional(v.number()),
    active: v.optional(v.boolean()),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const { entry, catalog } = getSheetEntry(sheet, args.entryId);
    const detail = args.detail ?? catalog.detail;
    if (detail.kind !== entry.kind)
      throw new ConvexError('A Character Sheet Entry kind cannot be changed');
    const name = args.name?.trim() ?? catalog.name;
    const modifiers = args.modifiers ?? catalog.modifiers;
    validatePersonalAdjustment({
      sheet,
      name,
      modifiers,
      previousModifiers: catalog.modifiers,
    });
    validateSheetEntryDetail(detail, args.casterLevel);
    const active = args.active ?? entry.active;
    // Construct each state with its patch so Convex retains the discriminator.
    const patch =
      entry.kind === 'spellEffect'
        ? {
            active,
            state: {
              ...entry.state,
              casterLevel: args.casterLevel ?? entry.state.casterLevel,
            },
          }
        : entry.kind === 'condition'
          ? { active, state: entry.state }
          : entry.kind === 'item'
            ? { active, state: entry.state }
            : { active, state: entry.state };
    if (
      name === catalog.name &&
      compareValues(modifiers, catalog.modifiers) === 0 &&
      compareValues(detail, catalog.detail) === 0 &&
      active === entry.active &&
      compareValues(patch.state, entry.state) === 0
    )
      return null;
    await ctx.db.patch('catalogEntry', catalog._id, {
      name,
      modifiers,
      detail,
    });
    await ctx.db.patch('characterSheetEntry', entry._id, patch);
    const updated = await ctx.db.get('characterSheetEntry', entry._id);
    const updatedCatalog = await ctx.db.get('catalogEntry', catalog._id);
    if (!updated || !updatedCatalog)
      throw new ConvexError('Character Sheet Entry is unavailable');
    sheet.entries = sheet.entries.map((row) =>
      row._id === entry._id ? updated : row,
    );
    sheet.catalogEntries = sheet.catalogEntries.map((row) =>
      row._id === catalog._id ? updatedCatalog : row,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});
export const removeSheetEntry = campaignMutation({
  args: rowScope,
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const { entry } = getSheetEntry(sheet, args.entryId);
    await removeCatalogSelection(ctx, sheet, entry);
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

const dormantTargetValidator = v.union(
  v.object({ grantKey: grantKeyValidator }),
  v.object({ entryId: v.id('characterSheetEntry') }),
);
const grantStateValidator = v.object({
  active: v.optional(v.boolean()),
  choice: v.optional(v.union(v.string(), v.null())),
  notes: v.optional(v.string()),
  catalogEntryId: v.optional(v.id('catalogEntry')),
});

type WritableSheet = Awaited<ReturnType<typeof loadWritableSheet>>;
function findResolvedEntry(
  sheet: WritableSheet,
  target: { grantKey: GrantKey } | { entryId: Id<'characterSheetEntry'> },
) {
  const resolved = sheet.calculated.resolvedEntries.find((row) =>
    'grantKey' in target
      ? row.origin === 'grant' &&
        compareValues(
          'grantKey' in row.entry ? row.entry.grantKey : undefined,
          target.grantKey,
        ) === 0
      : row.storedEntryId === target.entryId && row.origin === 'selection',
  );
  if (!resolved)
    throw new ConvexError('Entry does not belong to this Character');
  return resolved;
}
function requireCatalogSheetDefinition(
  sheet: WritableSheet,
  id: Id<'catalogEntry'>,
) {
  const definition = sheet.catalogEntries.find((row) => row._id === id);
  if (!definition)
    throw new ConvexError('Catalog Entry does not belong to this Character');
  if (!isSelectableCatalogSheetEntryKind(definition.detail.kind))
    throw new ConvexError('Choose a feature or Selection');
  return { ...definition, kind: definition.detail.kind };
}
async function persistRecordedEntry(
  ctx: MutationCtx,
  sheet: WritableSheet,
  row: WithoutSystemFields<Doc<'characterSheetEntry'>>,
  previousId?: Id<'characterSheetEntry'>,
) {
  // The concrete document is checked by the schema before it enters the sheet.
  if (previousId) await ctx.db.replace('characterSheetEntry', previousId, row);
  else if (sheet.entries.length >= maxCharacterChildRows)
    throw new ConvexError('Character sheet is too large');
  const id = previousId ?? (await ctx.db.insert('characterSheetEntry', row));
  const stored = await ctx.db.get('characterSheetEntry', id);
  if (!stored) throw new ConvexError('Entry is unavailable');
  sheet.entries = [
    ...sheet.entries.filter((entry) => entry._id !== id),
    stored,
  ];
  return id;
}

export const editGrantState = campaignMutation({
  args: {
    ...writeScope,
    grantKey: grantKeyValidator,
    state: grantStateValidator,
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const resolved = findResolvedEntry(sheet, { grantKey: args.grantKey });
    const previous = sheet.entries.find(
      (row) => row._id === resolved.storedEntryId,
    );
    if (!('catalogEntryId' in resolved.entry) || resolved.entry.kind === 'base')
      throw new ConvexError('Grant definition is unavailable');
    const catalogEntryId =
      args.state.catalogEntryId ??
      ctx.db.normalizeId('catalogEntry', resolved.entry.catalogEntryId);
    if (!catalogEntryId)
      throw new ConvexError('Grant definition is unavailable');
    const definition = requireCatalogSheetDefinition(sheet, catalogEntryId);
    const resolvedCatalogEntryId = resolved.entry.catalogEntryId;
    const resolvedDefinition = sheet.catalogEntries.find(
      (row) => row._id === resolvedCatalogEntryId,
    );
    if (
      definition.ruleIdentity !== resolvedDefinition?.ruleIdentity ||
      definition.detail.kind !== resolved.entry.kind
    )
      throw new ConvexError(
        'A Grant copy must retain its rule identity and kind',
      );
    const choice =
      args.state.choice ??
      ('choice' in resolved.entry.state
        ? resolved.entry.state.choice
        : undefined);
    const row = {
      characterId: sheet.character._id,
      catalogEntryId,
      ...buildRecordedCatalogState(
        ctx,
        resolved.entry,
        args.state.choice === null ? null : choice,
      ),
      active: args.state.active ?? resolved.entry.active,
      grantKey: args.grantKey,
      ...(args.state.catalogEntryId !== undefined ||
      (previous && 'catalogOverride' in previous && previous.catalogOverride)
        ? { catalogOverride: true as const }
        : {}),
      ...(previous && 'kept' in previous && previous.kept
        ? { kept: true as const }
        : {}),
      ...(args.state.notes !== undefined
        ? { notes: args.state.notes }
        : 'notes' in resolved.entry && resolved.entry.notes !== undefined
          ? { notes: resolved.entry.notes }
          : {}),
    };
    await persistRecordedEntry(ctx, sheet, row, previous?._id);
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

export const setDormantEntryKept = campaignMutation({
  args: { ...writeScope, target: dormantTargetValidator, kept: v.boolean() },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const resolved = findResolvedEntry(sheet, args.target);
    if (!resolved.dormant)
      throw new ConvexError('Only dormant entries can be kept or un-kept');
    const previous = sheet.entries.find(
      (entry) => entry._id === resolved.storedEntryId,
    );
    if (previous && 'kept' in previous && Boolean(previous.kept) === args.kept)
      return null;
    if (!previous && !args.kept) return null;
    if (previous) {
      if (!('catalogEntryId' in previous) || previous.kind === 'base')
        throw new ConvexError('Only features and Selections can be kept');
      const { _id, _creationTime, ...row } = previous;
      const definition = requireCatalogSheetDefinition(
        sheet,
        previous.catalogEntryId,
      );
      const defaultState = createCatalogSheetEntryState(
        previous.kind,
        undefined,
        definition.detail.kind === 'spellEffect'
          ? definition.detail.defaultCasterLevel
          : undefined,
      ).state;
      const state =
        'choice' in previous.state && previous.state.choice === null
          ? Object.fromEntries(
              Object.entries(previous.state).filter(
                ([key]) => key !== 'choice',
              ),
            )
          : previous.state;
      if (
        !args.kept &&
        previous.grantKey &&
        previous.active &&
        !previous.notes &&
        !previous.catalogOverride &&
        !previous.selectionSource &&
        !previous.gainedAtClassLevel &&
        compareValues(state, defaultState) === 0
      ) {
        await ctx.db.delete('characterSheetEntry', _id);
        sheet.entries = sheet.entries.filter((entry) => entry._id !== _id);
      } else
        await persistRecordedEntry(
          ctx,
          sheet,
          { ...row, kept: args.kept ? true : undefined },
          _id,
        );
    } else {
      if (
        !('catalogEntryId' in resolved.entry) ||
        !('grantKey' in resolved.entry) ||
        !resolved.entry.grantKey
      )
        throw new ConvexError('Grant definition is unavailable');
      const catalogEntryId = ctx.db.normalizeId(
        'catalogEntry',
        resolved.entry.catalogEntryId,
      );
      if (!catalogEntryId)
        throw new ConvexError('Grant definition is unavailable');
      requireCatalogSheetDefinition(sheet, catalogEntryId);
      await persistRecordedEntry(ctx, sheet, {
        characterId: sheet.character._id,
        catalogEntryId,
        ...buildRecordedCatalogState(ctx, resolved.entry),
        active: resolved.entry.active,
        grantKey: resolved.entry.grantKey,
        kept: true,
      });
    }
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

export const discardDormantEntry = campaignMutation({
  args: { ...writeScope, target: dormantTargetValidator },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const resolved = findResolvedEntry(sheet, args.target);
    if (!resolved.dormant)
      throw new ConvexError('Only dormant entries can be discarded');
    const previous = sheet.entries.find(
      (entry) => entry._id === resolved.storedEntryId,
    );
    if (!previous)
      throw new ConvexError('This entry has no recorded state to discard');
    const discardedIds = new Set<string>([resolved.entry._id, previous._id]);
    if (resolved.origin === 'selection' && 'catalogEntryId' in previous) {
      for (const grant of resolveCharacterSheetGrants({
        entries: sheet.entries,
        catalogEntries: sheet.catalogEntries,
        characterKind: sheet.character.kind,
      }).allEntries) {
        if (
          grant.origin !== 'grant' ||
          !hasGrantAncestor(grant.entry._id, resolved.entry._id)
        )
          continue;
        discardedIds.add(grant.entry._id);
        if (grant.storedEntryId) {
          discardedIds.add(grant.storedEntryId);
          const stored = sheet.entries.find(
            (entry) => entry._id === grant.storedEntryId,
          );
          if (stored) await ctx.db.delete('characterSheetEntry', stored._id);
        }
      }
      sheet.entries = sheet.entries.filter(
        (entry) => !discardedIds.has(entry._id) || entry._id === previous._id,
      );
      await removeCatalogSelection(ctx, sheet, previous);
    } else {
      await ctx.db.delete('characterSheetEntry', previous._id);
      sheet.entries = sheet.entries.filter(
        (entry) => entry._id !== previous._id,
      );
    }
    const belongsToDiscardedEntry = (subject: string) =>
      [...discardedIds].some(
        (id) => subject === id || subject.startsWith(`${id}:`),
      ) ||
      (resolved.origin === 'selection' &&
        hasGrantAncestor(subject, resolved.entry._id));
    for (const accepted of sheet.acceptedWarnings.filter((accepted) =>
      belongsToDiscardedEntry(accepted.subject),
    ))
      await ctx.db.delete('acceptedWarning', accepted._id);
    sheet.acceptedWarnings = sheet.acceptedWarnings.filter(
      (accepted) => !belongsToDiscardedEntry(accepted.subject),
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

const selectionFields = {
  active: v.optional(v.boolean()),
  choice: v.optional(v.union(v.string(), v.null())),
  notes: v.optional(v.string()),
  selectionSource: v.optional(v.union(selectionSourceValidator, v.null())),
  gainedAtClassLevel: v.optional(
    v.union(v.id('characterSheetEntry'), v.null()),
  ),
};
function requireSelectionReferences(
  sheet: WritableSheet,
  source: Infer<typeof selectionSourceValidator> | null | undefined,
  gainedAtClassLevel?: Id<'characterSheetEntry'> | null,
) {
  if (gainedAtClassLevel) getClassLevel(sheet, gainedAtClassLevel);
  if (!source) return source;
  if (source.kind === 'classPrompt') {
    if (!Number.isSafeInteger(source.classLevel) || source.classLevel < 1)
      throw new ConvexError('Enter a positive whole prompt level');
    const sourceDefinition = sheet.catalogEntries.find(
      (row) =>
        row.ruleIdentity === source.source && row.detail.kind === 'class',
    );
    if (!sourceDefinition)
      throw new ConvexError(
        'Class prompt source does not belong to this Character',
      );
    const family = characterSheetClassFamily(
      sourceDefinition,
      sheet.catalogEntries,
    );
    const selectedIds = new Set(
      sheet.entries.flatMap((row) =>
        row.kind === 'classLevel' && row.state.classEntryId
          ? [row.state.classEntryId]
          : [],
      ),
    );
    const familyDefinitions = sheet.catalogEntries.filter(
      (row) =>
        row.detail.kind === 'class' &&
        characterSheetClassFamily(row, sheet.catalogEntries) === family,
    );
    const selectedDefinitions = familyDefinitions.filter((row) =>
      selectedIds.has(row._id),
    );
    const definitions = selectedDefinitions.length
      ? selectedDefinitions
      : familyDefinitions;
    const list = normalizeCharacterSheetChoiceName(source.list);
    if (
      !definitions.some(
        (row) =>
          row.detail.kind === 'class' &&
          'picksByLevel' in row.detail &&
          row.detail.picksByLevel.some(
            (prompt) =>
              prompt.classLevel === source.classLevel &&
              normalizeCharacterSheetChoiceName(prompt.list) === list,
          ),
      )
    )
      throw new ConvexError('Choose a prompt defined by this class');
    return { ...source, source: family, list };
  }
  const reference = source.kind === 'slot' ? source.grantedBy : source.source;
  const resolved = sheet.calculated.resolvedEntries.find((row) =>
    reference.kind === 'entry'
      ? row.entry._id === reference.entryId ||
        row.storedEntryId === reference.entryId
      : 'grantKey' in row.entry &&
        compareValues(row.entry.grantKey, reference.grantKey) === 0,
  );
  if (!resolved)
    throw new ConvexError('Selection source does not belong to this Character');
  if (source.kind === 'prompt') {
    if (!source.list.trim()) throw new ConvexError('Choose a prompt list');
    if (source.classLevel !== undefined)
      requireNonnegativeInteger(source.classLevel, 'Prompt level');
  }
  const normalizedReference =
    resolved.origin === 'grant' &&
    'grantKey' in resolved.entry &&
    resolved.entry.grantKey
      ? { kind: 'grant' as const, grantKey: resolved.entry.grantKey }
      : reference;
  return source.kind === 'slot'
    ? { ...source, grantedBy: normalizedReference }
    : { ...source, source: normalizedReference };
}
export const selectEntry = campaignMutation({
  args: {
    ...writeScope,
    ...selectionFields,
    catalogEntryId: v.id('catalogEntry'),
  },
  returns: v.id('characterSheetEntry'),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const definition = requireCatalogSheetDefinition(
      sheet,
      args.catalogEntryId,
    );
    requireEntryChoice(definition.detail.kind, args.choice);
    const selectionSource = requireSelectionReferences(
      sheet,
      args.selectionSource,
      args.gainedAtClassLevel,
    );
    const id = await persistRecordedEntry(ctx, sheet, {
      ...createCatalogSheetEntryState(
        definition.kind,
        args.choice,
        definition.detail.kind === 'spellEffect'
          ? definition.detail.defaultCasterLevel
          : undefined,
      ),
      characterId: sheet.character._id,
      catalogEntryId: definition._id,
      active: args.active ?? true,
      ...(args.notes !== undefined ? { notes: args.notes } : {}),
      ...(selectionSource ? { selectionSource } : {}),
      ...(args.gainedAtClassLevel
        ? { gainedAtClassLevel: args.gainedAtClassLevel }
        : {}),
    });
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return id;
  },
});
function requireEntryChoice(kind: string, choice: string | null | undefined) {
  if (
    choice !== undefined &&
    ['condition', 'item', 'spell', 'spellEffect'].includes(kind)
  )
    throw new ConvexError('This entry does not have a recorded choice');
}
type RecordedCatalogEntry = Extract<
  Doc<'characterSheetEntry'>,
  { kind: SelectableCatalogSheetEntryKind }
>;
type RecordedCatalogState<Entry = RecordedCatalogEntry> =
  Entry extends Doc<'characterSheetEntry'>
    ? Pick<Entry, 'kind' | 'state'>
    : never;
function buildRecordedCatalogState(
  ctx: MutationCtx,
  entry: SheetEntry,
  choice?: string | null,
): RecordedCatalogState {
  requireEntryChoice(entry.kind, choice);
  if (!isSelectableCatalogSheetEntryKind(entry.kind))
    throw new ConvexError('Choose a feature or Selection');
  if (entry.kind === 'feat') {
    const slot = entry.state.slot;
    const reference = typeof slot === 'object' ? slot.grantedBy : undefined;
    if (reference?.kind === 'entry') {
      const entryId = ctx.db.normalizeId(
        'characterSheetEntry',
        reference.entryId,
      );
      if (!entryId)
        throw new ConvexError(
          'Selection source does not belong to this Character',
        );
      return {
        kind: 'feat',
        state: {
          ...entry.state,
          ...(choice === undefined ? {} : { choice }),
          slot: { grantedBy: { kind: 'entry', entryId } },
        },
      };
    }
  }
  // Preserve every schema-defined recorded field; the kind/state discriminants
  // originate in the same schema member and are unchanged by a choice edit.
  return {
    kind: entry.kind,
    state: { ...entry.state, ...(choice === undefined ? {} : { choice }) },
  } as RecordedCatalogState;
}
export const editSelection = campaignMutation({
  args: {
    ...rowScope,
    ...selectionFields,
    catalogEntryId: v.optional(v.id('catalogEntry')),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const previous = sheet.entries.find((row) => row._id === args.entryId);
    if (
      !previous ||
      !('catalogEntryId' in previous) ||
      previous.kind === 'base' ||
      previous.grantKey
    )
      throw new ConvexError('Selection does not belong to this Character');
    const definition = sheet.catalogEntries.find(
      (row) => row._id === (args.catalogEntryId ?? previous.catalogEntryId),
    );
    if (!definition)
      throw new ConvexError('Catalog Entry does not belong to this Character');
    if (definition.detail.kind !== previous.kind)
      throw new ConvexError('A Selection must retain its kind');
    // An unchanged broken Class Level link remains unplaced rather than guessed.
    const unchangedSource =
      args.selectionSource === undefined ||
      compareValues(args.selectionSource, previous.selectionSource) === 0;
    const selectionSource = unchangedSource
      ? previous.selectionSource
      : requireSelectionReferences(sheet, args.selectionSource);
    if (
      args.gainedAtClassLevel &&
      args.gainedAtClassLevel !== previous.gainedAtClassLevel
    )
      getClassLevel(sheet, args.gainedAtClassLevel);
    const choice =
      args.choice !== undefined
        ? args.choice
        : 'choice' in previous.state
          ? previous.state.choice
          : undefined;
    const row = {
      ...buildRecordedCatalogState(ctx, previous, choice),
      characterId: sheet.character._id,
      catalogEntryId: definition._id,
      active: args.active ?? previous.active,
      notes: args.notes ?? previous.notes,
      ...(previous.kept ? { kept: previous.kept } : {}),
      selectionSource: selectionSource ?? undefined,
      gainedAtClassLevel:
        args.gainedAtClassLevel === null
          ? undefined
          : (args.gainedAtClassLevel ?? previous.gainedAtClassLevel),
    };
    await persistRecordedEntry(ctx, sheet, row, previous._id);
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});
