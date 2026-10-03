import { findArchetypeSelection } from '../src/lib/character-sheet-archetype-helpers';
import { defaultAttackRoutineConfiguration } from '../src/lib/character-sheet-attacks';
import { classCastingSchema } from '../src/lib/character-sheet-casting-tables';
import {
  manualProficiencySchema,
  proficiencyKey,
} from '../src/lib/character-sheet-proficiencies';
import {
  copyCatalogDefinition,
  findPreferredCampaignCopy,
  preserveCuratedModifierFields,
  projectCampaignCopies,
  requireEditableCharacterDefinition,
} from './lib/catalogCopies';
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
  isCatalogSheetDefinition,
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
import {
  conditionEffectSchema,
  getConditionDefinition,
} from '../src/lib/character-sheet-conditions';
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
  manualProficiencyValidator,
  racialProgressionValidator,
  archetypeReplacementValidator,
  archetypeFeatureChangeValidator,
  attackRoutineHandsValidator,
  attackRoutineModeValidator,
} from './schema';
import { getUser } from './user';
import {
  deleteSpellCatalogIndex,
  reconcileSpellDefinition,
} from './lib/spellCatalog';
import {
  characterOwnerValidator,
  readCharacterOwners,
} from './lib/characterOwnership';
import {
  requireCharacterAccess,
  requireCharacterCampaignAccess,
  type CharacterScope,
} from './lib/characterAccess';
import {
  abilityKeys,
  abilityTargets,
  creatureSizes,
  proficiencyCategories,
  defaultAbilityScores,
  creationSettingsFor,
  modifierConditionSchema,
  characterSheetWarningSchema,
  type Modifier,
  type CatalogModifier,
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
const spellcastingValidator = v.object({
  classEntryId: v.string(),
  ...zodOutputToConvex(
    classCastingSchema.omit({
      table: true,
      casterLevelOffset: true,
    }),
  ).fields,
  name: v.string(),
  castingLevel: v.number(),
  tableLevel: v.number(),
  casterLevel: v.union(breakdownValidator, v.null()),
  concentration: v.union(breakdownValidator, v.null()),
  castableSpellLevels: v.array(v.number()),
  slots: v.array(
    v.object({
      spellLevel: v.number(),
      base: v.union(v.number(), v.null()),
      bonus: v.number(),
      total: v.union(v.number(), v.null()),
      known: v.union(v.number(), v.null()),
      prepared: v.union(v.number(), v.null()),
      dc: breakdownValidator,
      dcUnresolved: v.boolean(),
      schoolDCs: v.array(
        v.object({
          school: v.string(),
          breakdown: breakdownValidator,
          unresolved: v.boolean(),
        }),
      ),
    }),
  ),
  unresolved: v.array(v.string()),
});
const archetypeFeatureRowValidator = archetypeReplacementValidator
  .omit('catalogEntryId')
  .extend({ catalogEntryId: v.string() });
const archetypeConflictValidator = v.object({
  featureIdentity: v.string(),
  part: v.union(v.string(), v.null()),
  entryIds: v.array(v.string()),
  classIdentity: v.string(),
});
const archetypesValidator = v.object({
  classes: v.array(
    v.object({
      classEntryId: v.string(),
      classIdentity: v.string(),
      classLevel: v.number(),
      classSkills: v.array(v.string()),
      skillRanksPerLevel: v.union(v.number(), v.null()),
      archetypes: v.array(
        v.object({
          entryId: v.string(),
          catalogEntryId: v.string(),
          ruleIdentity: v.string(),
          name: v.string(),
          active: v.boolean(),
          applicable: v.boolean(),
          replacements: v.array(archetypeFeatureRowValidator),
          additions: v.array(archetypeFeatureRowValidator.omit('scope')),
          changes: v.array(archetypeFeatureChangeValidator),
          classSkillsAdded: v.array(v.string()),
          classSkillsRemoved: v.array(v.string()),
          skillRanksPerLevel: v.optional(v.number()),
        }),
      ),
      conflicts: v.array(archetypeConflictValidator),
    }),
  ),
  conflicts: v.array(archetypeConflictValidator),
  warnings: v.array(zodOutputToConvex(characterSheetWarningSchema)),
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
const collectionSpellValidator = v.object({
  entryId: v.string(),
  catalogEntryId: v.string(),
  ruleIdentity: v.string(),
  name: v.string(),
  classEntryId: v.union(v.string(), v.null()),
  castingClassName: v.union(v.string(), v.null()),
  school: v.optional(v.string()),
  description: v.optional(v.string()),
  spellLevel: v.union(v.number(), v.null()),
  explicitLevel: v.union(v.number(), v.null()),
  offList: v.boolean(),
});
function attackLineValidator() {
  return v.object({
    weaponEntryId: v.string(),
    weaponName: v.string(),
    mode: attackRoutineModeValidator,
    damageDice: v.string(),
    damageType: v.string(),
    damageDiceSource: v.object({
      sheetEntryId: v.string(),
      entryName: v.string(),
      source: v.string(),
    }),
    attackBonus: breakdownValidator,
    damageBonus: breakdownValidator,
    criticalThreat: breakdownValidator,
    criticalMultiplier: breakdownValidator,
    rangeIncrement: v.union(breakdownValidator, v.null()),
  });
}
const calculatedValidator = v.object({
  spellCollections: v.object({
    collections: v.array(
      v.object({
        classEntryId: v.string(),
        classTag: v.string(),
        record: v.union(
          v.literal('known'),
          v.literal('book'),
          v.literal('none'),
        ),
        heading: v.union(
          v.literal('Spells known'),
          v.literal('Spellbook'),
          v.literal('Formula book'),
          v.literal('Familiar'),
          v.null(),
        ),
        readOnly: v.boolean(),
        spells: v.array(collectionSpellValidator),
        levels: v.array(
          v.object({
            spellLevel: v.number(),
            count: v.number(),
            allowance: v.union(v.number(), v.null()),
          }),
        ),
      }),
    ),
    spellsWithoutSpellcasting: v.array(collectionSpellValidator),
  }),
  attackRoutines: v.array(
    v.object({
      entryId: v.string(),
      name: v.string(),
      weaponEntryId: v.string(),
      hands: attackRoutineHandsValidator,
      mode: attackRoutineModeValidator,
      single: v.array(attackLineValidator()),
      full: v.array(attackLineValidator()),
      warnings: v.array(zodOutputToConvex(characterSheetWarningSchema)),
    }),
  ),
  spellcastings: v.array(spellcastingValidator),
  spellcastingUnresolved: v.array(v.string()),
  racial: v.object({
    raceEntryId: v.union(v.string(), v.null()),
    size: v.union(
      v.union(...creatureSizes.map((size) => v.literal(size))),
      v.null(),
    ),
    creatureTypes: v.array(v.string()),
    creatureSubtypes: v.array(v.string()),
    countsAsRaces: v.array(v.string()),
    racialTraitIdentities: v.array(v.string()),
    favoredClassCount: v.number(),
    bonusSkillRanksPerLevel: v.number(),
    proficiencies: v.array(
      v.union(
        v.object({
          category: v.union(
            ...proficiencyCategories.map((value) => v.literal(value)),
          ),
        }),
        v.object({
          baseType: v.string(),
          asMartial: v.optional(v.literal(true)),
        }),
        v.object({ group: v.string() }),
      ),
    ),
  }),
  resolvedEntries: v.array(resolvedEntryValidator),
  warningsForAcceptance: v.array(
    zodOutputToConvex(characterSheetWarningSchema),
  ),
  conditionEffects: v.array(zodOutputToConvex(conditionEffectSchema)),
  archetypes: archetypesValidator,
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
  racialHitDice: v.number(),
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
  equipment: v.object({
    items: v.array(
      v.object({
        entryId: v.string(),
        name: v.string(),
        slot: v.union(v.literal('armor'), v.literal('shield')),
        category: v.union(v.string(), v.null()),
        armorBonus: v.number(),
        enhancement: v.number(),
        maxDexterityBonus: v.union(v.number(), v.null()),
        armorCheckPenalty: v.number(),
        spellFailure: v.number(),
        masterwork: v.boolean(),
        proficient: v.boolean(),
      }),
    ),
    armorCheckPenalty: v.number(),
    spellFailure: v.number(),
    maxDexterityBonus: v.union(v.number(), v.null()),
    nonproficiencyAttackPenalty: v.number(),
  }),
  proficiencies: v.object({
    grants: v.array(
      v.object({
        proficiency: manualProficiencyValidator,
        entryId: v.string(),
        name: v.string(),
      }),
    ),
    choices: v.array(
      v.object({
        entryId: v.string(),
        name: v.string(),
        choice: v.union(v.string(), v.null()),
      }),
    ),
    added: v.array(manualProficiencyValidator),
    removed: v.array(manualProficiencyValidator),
    missingChoices: v.array(
      v.object({
        entryId: v.string(),
        name: v.string(),
        kind: v.union(v.literal('classLevel'), v.literal('entry')),
      }),
    ),
  }),
  proficiencyPrerequisites: v.array(
    v.object({
      entryId: v.string(),
      view: v.union(v.literal('current'), v.literal('recorded')),
      proficiency: manualProficiencyValidator,
      met: v.boolean(),
    }),
  ),
  weaponProficiencies: v.array(
    v.object({
      entryId: v.string(),
      name: v.string(),
      hands: attackRoutineHandsValidator,
      proficient: v.boolean(),
      attackPenalty: v.number(),
      armorNonproficiencyPenalty: v.number(),
      totalAttackPenalty: v.number(),
      breakdown: breakdownValidator,
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
    const {
      actor: _actor,
      initialSupportingEntryKeys: _initialSupportingEntryKeys,
      ...result
    } = sheet;
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
async function purgeRemovedAttackRoutines(
  ctx: MutationCtx,
  characterId: Id<'character'>,
  keepEntryId?: Id<'characterSheetEntry'>,
) {
  const removed = ctx.db
    .query('characterSheetEntry')
    .withIndex('by_characterId_and_kind_and_active', (q) =>
      q
        .eq('characterId', characterId)
        .eq('kind', 'attackRoutine')
        .eq('active', false),
    )
    .order('desc');
  const purgedIds = new Set<string>();
  let retainedId = keepEntryId;
  for await (const entry of removed) {
    retainedId ??= entry._id;
    if (entry._id === retainedId) continue;
    await ctx.db.delete('characterSheetEntry', entry._id);
    purgedIds.add(entry._id);
  }
  if (purgedIds.size) {
    const acceptances = await ctx.db
      .query('acceptedWarning')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .take(maxAcceptedWarnings + 1);
    for (const accepted of acceptances)
      if (purgedIds.has(accepted.subject.split(':')[0] ?? ''))
        await ctx.db.delete('acceptedWarning', accepted._id);
  }
  return purgedIds;
}
async function loadWritableRoutineSheet(
  ctx: MutationCtx,
  args: CharacterScope,
) {
  // Retire earlier Undo rows before the sheet-size guard can strand old removals.
  const access = await requireCharacterAccess(ctx, args);
  await purgeRemovedAttackRoutines(ctx, access.character._id);
  return await loadWritableSheet(ctx, args);
}
async function insertAttackRoutine(
  ctx: MutationCtx,
  sheet: Awaited<ReturnType<typeof loadWritableSheet>>,
  state: {
    name: string;
    weaponEntryId: Id<'characterSheetEntry'>;
    hands: Infer<typeof attackRoutineHandsValidator>;
    mode: Infer<typeof attackRoutineModeValidator>;
  },
) {
  if (sheet.entries.length >= maxCharacterChildRows)
    throw new ConvexError('Character sheet is too large');
  const entryId = await ctx.db.insert('characterSheetEntry', {
    characterId: sheet.character._id,
    kind: 'attackRoutine',
    active: true,
    state: { kind: 'attackRoutine', ...state, revision: 0 },
  });
  const entry = await ctx.db.get('characterSheetEntry', entryId);
  if (!entry) throw new ConvexError('Attack Routine is unavailable');
  sheet.entries.push(entry);
  return entryId;
}
const attackRoutineFields = {
  name: v.optional(v.string()),
  hands: v.optional(attackRoutineHandsValidator),
  mode: v.optional(attackRoutineModeValidator),
};
function requireRoutineName(name: string) {
  if (!name.trim()) throw new ConvexError('Attack Routine name is required');
  if (name.trim().length > 256)
    throw new ConvexError('Attack Routine name is too long');
  return name.trim();
}
function getRoutineWeapon(
  sheet: Awaited<ReturnType<typeof loadWritableSheet>>,
  weaponEntryId: Id<'characterSheetEntry'>,
) {
  const weapon = sheet.entries.find((row) => row._id === weaponEntryId);
  const definition =
    weapon?.kind === 'item'
      ? sheet.catalogEntries.find((row) => row._id === weapon.catalogEntryId)
      : undefined;
  if (definition?.detail.kind !== 'item' || !definition.detail.weapon)
    throw new ConvexError('Weapon does not belong to this Character');
  return { name: definition.name, detail: definition.detail.weapon };
}
function getAttackRoutine(
  sheet: Awaited<ReturnType<typeof loadWritableSheet>>,
  entryId: Id<'characterSheetEntry'>,
) {
  const entry = sheet.entries.find((row) => row._id === entryId);
  if (entry?.kind !== 'attackRoutine')
    throw new ConvexError('Attack Routine does not belong to this Character');
  return entry;
}
export const createAttackRoutine = campaignMutation({
  args: {
    ...writeScope,
    ...attackRoutineFields,
    weaponEntryId: v.id('characterSheetEntry'),
  },
  returns: v.id('characterSheetEntry'),
  async handler(ctx, args) {
    const sheet = await loadWritableRoutineSheet(ctx, args);
    const weapon = getRoutineWeapon(sheet, args.weaponEntryId);
    const entryId = await insertAttackRoutine(ctx, sheet, {
      name: requireRoutineName(args.name ?? weapon.name),
      weaponEntryId: args.weaponEntryId,
      ...defaultAttackRoutineConfiguration(weapon.detail),
      ...(args.hands !== undefined ? { hands: args.hands } : {}),
      ...(args.mode !== undefined ? { mode: args.mode } : {}),
    });
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return entryId;
  },
});
export const editAttackRoutine = campaignMutation({
  args: {
    ...rowScope,
    ...attackRoutineFields,
    weaponEntryId: v.optional(v.id('characterSheetEntry')),
  },
  returns: v.number(),
  async handler(ctx, args) {
    const sheet = await loadWritableRoutineSheet(ctx, args);
    const entry = getAttackRoutine(sheet, args.entryId);
    if (!entry.active) throw new ConvexError('Attack Routine was deleted');
    const replacement =
      args.weaponEntryId !== undefined &&
      args.weaponEntryId !== entry.state.weaponEntryId
        ? getRoutineWeapon(sheet, args.weaponEntryId)
        : undefined;
    const state = {
      ...entry.state,
      ...(replacement
        ? defaultAttackRoutineConfiguration(replacement.detail)
        : {}),
      ...(args.name !== undefined
        ? { name: requireRoutineName(args.name) }
        : {}),
      ...(args.hands !== undefined ? { hands: args.hands } : {}),
      ...(args.mode !== undefined ? { mode: args.mode } : {}),
      ...(args.weaponEntryId !== undefined
        ? { weaponEntryId: args.weaponEntryId }
        : {}),
    };
    if (compareValues(state, entry.state) === 0)
      return entry.state.revision ?? 0;
    state.revision = (entry.state.revision ?? 0) + 1;
    await ctx.db.patch('characterSheetEntry', entry._id, { state });
    sheet.entries = sheet.entries.map((row) =>
      row._id === entry._id ? { ...entry, state } : row,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return state.revision;
  },
});
export const deleteAttackRoutine = campaignMutation({
  args: rowScope,
  returns: v.number(),
  async handler(ctx, args) {
    const sheet = await loadWritableRoutineSheet(ctx, args);
    const entry = getAttackRoutine(sheet, args.entryId);
    if (!entry.active) return entry.state.revision ?? 0;
    const purgedIds = await purgeRemovedAttackRoutines(
      ctx,
      sheet.character._id,
      entry._id,
    );
    sheet.entries = sheet.entries.filter((row) => !purgedIds.has(row._id));
    const state = {
      ...entry.state,
      revision: (entry.state.revision ?? 0) + 1,
    };
    await ctx.db.patch('characterSheetEntry', entry._id, {
      active: false,
      state,
    });
    sheet.entries = sheet.entries.map((row) =>
      row._id === entry._id ? { ...entry, active: false, state } : row,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return state.revision;
  },
});
export const restoreAttackRoutine = campaignMutation({
  args: rowScope,
  returns: v.number(),
  async handler(ctx, args) {
    const sheet = await loadWritableRoutineSheet(ctx, args);
    const entry = getAttackRoutine(sheet, args.entryId);
    if (entry.active) return entry.state.revision ?? 0;
    const state = { ...entry.state, revision: (entry.state.revision ?? 0) + 1 };
    await ctx.db.patch('characterSheetEntry', entry._id, {
      active: true,
      state,
    });
    sheet.entries = sheet.entries.map((row) =>
      row._id === entry._id ? { ...entry, active: true, state } : row,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return state.revision;
  },
});
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
  if (definition?.detail.kind !== 'class')
    throw new ConvexError('Class does not belong to this Character');
  return definition;
}
async function resolvePreferredCatalogEntryId(
  ctx: MutationCtx,
  sheet: WritableSheet,
  catalogEntryId: Id<'catalogEntry'>,
) {
  const preferred = await findPreferredCampaignCopy(ctx, {
    campaignId: sheet.character.campaignId,
    originalId: catalogEntryId,
    candidates: sheet.catalogEntries,
  });
  return preferred?._id ?? catalogEntryId;
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
function requireSafeWholeNumber(value: number, label: string) {
  requireNonnegativeInteger(value, label);
  if (!Number.isSafeInteger(value))
    throw new ConvexError(`${label} must be a safe whole number`);
}
function modifierReferences(modifiers: readonly CatalogModifier[]) {
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
export function validatePersonalAdjustment({
  sheet,
  name,
  modifiers,
  previousModifiers = [],
}: {
  sheet: NonNullable<Awaited<ReturnType<typeof loadCharacterSheet>>>;
  name: string;
  modifiers: readonly CatalogModifier[];
  previousModifiers?: readonly CatalogModifier[];
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
    requireEditableCharacterDefinition(
      catalogEntry,
      args.characterId,
      args.name !== undefined || args.modifiers !== undefined,
    );
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
  {
    removedEntryId,
    includeConditionReferences = false,
  }: {
    removedEntryId?: Id<'characterSheetEntry'>;
    includeConditionReferences?: boolean;
  } = {},
) {
  if (
    sheet.entries.some(
      (entry) =>
        entry._id !== removedEntryId &&
        sheetEntryReferencesCatalog(entry, catalogEntryId),
    )
  )
    return true;
  return sheet.catalogEntries.some(
    (definition) =>
      definition._id !== catalogEntryId &&
      listCatalogDependencies(definition).some(
        ({ id, kind }) =>
          (includeConditionReferences || kind !== 'condition') &&
          id === catalogEntryId,
      ),
  );
}
async function removeCatalogSelection(
  ctx: MutationCtx,
  sheet: Awaited<ReturnType<typeof loadWritableSheet>>,
  entry: Doc<'characterSheetEntry'> & { catalogEntryId: Id<'catalogEntry'> },
) {
  await ctx.db.delete('characterSheetEntry', entry._id);
  const definition = sheet.catalogEntries.find(
    (row) => row._id === entry.catalogEntryId,
  );
  if (
    definition?.scope === 'character' &&
    definition.characterId === sheet.character._id &&
    !definition.importedSpell &&
    !isCatalogDefinitionReferenced(sheet, entry.catalogEntryId, {
      removedEntryId: entry._id,
    })
  ) {
    await deleteSpellCatalogIndex(ctx, entry.catalogEntryId);
    await ctx.db.delete('catalogEntry', entry.catalogEntryId);
    sheet.catalogEntries = sheet.catalogEntries.filter(
      (row) => row._id !== entry.catalogEntryId,
    );
  }
  sheet.entries = sheet.entries.filter((row) => row._id !== entry._id);
  await reconcileSpellDefinition({
    ctx,
    sheet,
    catalogEntryId: entry.catalogEntryId,
  });
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
      ? requireClassDefinition(
          sheet,
          await resolvePreferredCatalogEntryId(ctx, sheet, args.classEntryId),
        )
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
        classEntryId: chosen ?? selected?._id ?? null,
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
      requireSafeWholeNumber(ranks, 'Skill ranks');
    }
    const skillRanks = args.skillRank
      ? {
          ...sumRanksBySkill(entry.state.skillRanks ?? {}),
          ...normalizedAllocation,
        }
      : normalizedAllocation;
    for (const ranks of Object.values(skillRanks ?? {}))
      requireSafeWholeNumber(ranks, 'Skill ranks');
    const selected = args.classEntryId
      ? requireClassDefinition(
          sheet,
          await resolvePreferredCatalogEntryId(ctx, sheet, args.classEntryId),
        )
      : null;
    const proficiencyChoice = args.proficiencyChoice?.trim() ?? '';
    const changes = {
      ...(args.hpGained !== undefined ? { hpGained: args.hpGained } : {}),
      ...(args.classEntryId !== undefined
        ? { classEntryId: selected?._id ?? null }
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
    await deleteCharacterSheet(ctx, args.characterId, args.operationId);
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
  if (!isCatalogSheetDefinition(catalog))
    throw new ConvexError('Catalog Entry definition is unavailable');
  return { entry, catalog };
}
export function validateSheetEntryDetail(
  detail: typeof sheetEntryDetailValidator.type,
  casterLevel?: number,
) {
  if (detail.kind === 'spell' && detail.levels) {
    for (const level of Object.values(detail.levels))
      requireNonnegativeInteger(level, 'Spell level');
  }
  if (detail.kind === 'item' && detail.weapon) {
    if (!detail.weapon.baseType.trim())
      throw new ConvexError('Weapon name is required');
    for (const value of [
      detail.weapon.threat,
      detail.weapon.mult,
      detail.weapon.rangeIncrement,
      detail.weapon.thrownRangeIncrement,
      detail.weapon.strengthRating,
    ])
      if (value !== undefined) requireFiniteNumber(value);
    if (
      detail.weapon.dice !== undefined &&
      !/^[1-9]\d*d[1-9]\d*$/.test(detail.weapon.dice.trim())
    )
      throw new ConvexError('Enter weapon damage dice such as 1d8');
  }
  if (detail.kind === 'item' && detail.armor) {
    requireFiniteNumber(detail.armor.armorCheckPenalty);
    if (detail.armor.armorCheckPenalty < 0)
      throw new ConvexError('Armor check penalty must be nonnegative');
    for (const value of [
      detail.armor.bonus,
      detail.armor.maxDex,
      detail.armor.asf,
    ])
      if (value !== undefined && value !== null) {
        requireFiniteNumber(value);
        if (value < 0)
          throw new ConvexError('Armor values must be nonnegative');
      }
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
function canonicalConditionFields({
  detail,
  name,
  modifiers,
  selectDefinition = false,
}: {
  detail: typeof sheetEntryDetailValidator.type;
  name?: string;
  modifiers?: readonly Modifier[];
  selectDefinition?: boolean;
}) {
  if (detail.kind !== 'condition' || detail.conditionKey === undefined)
    return null;
  const definition = getConditionDefinition(detail.conditionKey);
  if (name !== undefined && name.trim() !== definition.name)
    throw new ConvexError('A CRB condition must use its canonical name');
  if (
    modifiers !== undefined &&
    !(selectDefinition && modifiers.length === 0) &&
    compareValues([...modifiers], definition.modifiers) !== 0
  )
    throw new ConvexError('A CRB condition must use its canonical Modifiers');
  return {
    name: definition.name,
    modifiers: definition.modifiers,
    ruleIdentity: definition.ruleIdentity,
    sourceKey: definition.ruleIdentity,
    sources: definition.sources,
  };
}
function buildCatalogIdentityPatch({
  canonical,
  catalog,
}: {
  canonical: ReturnType<typeof canonicalConditionFields>;
  catalog: ReturnType<typeof getSheetEntry>['catalog'];
}) {
  if (catalog.copiedFrom) return {};
  if (canonical)
    return {
      ruleIdentity: canonical.ruleIdentity,
      sourceKey: canonical.sourceKey,
      sources: canonical.sources,
    };
  if (
    catalog.detail.kind === 'condition' &&
    catalog.detail.conditionKey !== undefined
  )
    return {
      ruleIdentity: `sheetEntry:${catalog._id}`,
      sourceKey: undefined,
      sources: [],
    };
  return {};
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
    const sheet = await loadWritableRoutineSheet(ctx, args);
    const canonical = canonicalConditionFields({
      ...args,
      selectDefinition: true,
    });
    const name = canonical?.name ?? args.name.trim();
    const modifiers = canonical?.modifiers ?? args.modifiers;
    validatePersonalAdjustment({
      sheet,
      name,
      modifiers,
    });
    validateSheetEntryDetail(args.detail, args.casterLevel);
    if (sheet.entries.length >= maxCharacterChildRows)
      throw new ConvexError('Character sheet is too large');
    const catalogEntryId = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: args.characterId,
      name,
      ruleIdentity: canonical?.ruleIdentity ?? `sheetEntry:${args.characterId}`,
      ...(canonical ? { sourceKey: canonical.sourceKey } : {}),
      stacksWithItself: false,
      modifiers,
      detail: args.detail,
      sources: canonical?.sources ?? [],
    });
    if (!canonical)
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
    await reconcileSpellDefinition({ ctx, sheet, catalogEntryId: catalog._id });
    if (detail.kind === 'item' && detail.weapon && !detail.armor)
      await insertAttackRoutine(ctx, sheet, {
        weaponEntryId: entryId,
        name,
        ...defaultAttackRoutineConfiguration(detail.weapon),
      });
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
    requireEditableCharacterDefinition(
      catalog,
      args.characterId,
      args.name !== undefined ||
        args.modifiers !== undefined ||
        args.detail !== undefined,
    );
    const detail = args.detail ?? catalog.detail;
    if (detail.kind !== entry.kind)
      throw new ConvexError('A Character Sheet Entry kind cannot be changed');
    const canonical = canonicalConditionFields({ ...args, detail });
    const name = canonical?.name ?? args.name?.trim() ?? catalog.name;
    const modifiers =
      canonical?.modifiers ??
      (args.modifiers
        ? preserveCuratedModifierFields(args.modifiers, catalog.modifiers)
        : catalog.modifiers);
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
    if (
      args.name !== undefined ||
      args.modifiers !== undefined ||
      args.detail !== undefined
    )
      await ctx.db.patch('catalogEntry', catalog._id, {
        name,
        modifiers,
        detail,
        ...buildCatalogIdentityPatch({ canonical, catalog }),
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
    await reconcileSpellDefinition({
      ctx,
      sheet,
      catalogEntryId: updatedCatalog._id,
    });
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
function sheetEntryReferencesCatalog(
  entry: Doc<'characterSheetEntry'>,
  catalogEntryId: Id<'catalogEntry'>,
) {
  if ('catalogEntryId' in entry && entry.catalogEntryId === catalogEntryId)
    return true;
  if (entry.kind === 'classLevel')
    return entry.state.classEntryId === catalogEntryId;
  if (entry.kind === 'base')
    return entry.state.favoredClassIds?.includes(catalogEntryId) ?? false;
  if (
    entry.kind === 'racialTrait' &&
    entry.state.replaces?.includes(catalogEntryId)
  )
    return true;
  return 'choice' in entry.state && entry.state.choice === catalogEntryId;
}
async function deleteUnusedRaceStatisticsCopies(
  ctx: MutationCtx,
  sheet: WritableSheet,
) {
  for (const definition of sheet.catalogEntries) {
    if (
      definition.detail.kind !== 'race' ||
      definition.scope !== 'character' ||
      definition.characterId !== sheet.character._id ||
      !definition.racialStatisticsCopy
    )
      continue;
    if (
      isCatalogDefinitionReferenced(sheet, definition._id, {
        includeConditionReferences: true,
      })
    )
      continue;
    await ctx.db.delete('catalogEntry', definition._id);
    sheet.catalogEntries = sheet.catalogEntries.filter(
      (entry) => entry._id !== definition._id,
    );
  }
}
async function persistRecordedEntry(
  ctx: MutationCtx,
  sheet: WritableSheet,
  row: WithoutSystemFields<Doc<'characterSheetEntry'>>,
  previousId?: Id<'characterSheetEntry'>,
) {
  const previous = sheet.entries.find((entry) => entry._id === previousId);
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
  const spellDefinitionIds = new Set([
    ...(previous?.kind === 'spell' ? [previous.catalogEntryId] : []),
    ...(stored.kind === 'spell' ? [stored.catalogEntryId] : []),
  ]);
  for (const catalogEntryId of spellDefinitionIds)
    await reconcileSpellDefinition({ ctx, sheet, catalogEntryId });
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
    requireRacialAbilityScoreChoice(definition, args.state.choice);
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
  choiceOrder: v.optional(v.union(v.number(), v.null())),
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
    const sheet = await loadWritableRoutineSheet(ctx, args);
    const definition = requireCatalogSheetDefinition(
      sheet,
      await resolvePreferredCatalogEntryId(ctx, sheet, args.catalogEntryId),
    );
    requireEntryChoice(definition.detail.kind, args.choice);
    requireAlternateRacialTrait(sheet, definition);
    requireRacialAbilityScoreChoice(definition, args.choice);
    if (definition.kind === 'race' && args.active !== false)
      requireSingleActiveRace(sheet);
    if (args.choiceOrder !== undefined && args.choiceOrder !== null)
      requireSafeWholeNumber(args.choiceOrder, 'Choice order');
    const selectionSource = requireSelectionReferences(
      sheet,
      args.selectionSource,
      args.gainedAtClassLevel,
    );
    const existingOrders = sheet.entries.flatMap((row) =>
      'gainedAtClassLevel' in row &&
      row.gainedAtClassLevel === args.gainedAtClassLevel &&
      row.choiceOrder !== undefined
        ? [row.choiceOrder]
        : [],
    );
    const choiceOrder =
      args.choiceOrder !== undefined
        ? args.choiceOrder
        : args.gainedAtClassLevel
          ? Math.max(-1, ...existingOrders) + 1
          : undefined;
    if (choiceOrder !== undefined && choiceOrder !== null)
      requireSafeWholeNumber(choiceOrder, 'Choice order');
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
      ...(choiceOrder !== undefined && choiceOrder !== null
        ? { choiceOrder }
        : {}),
      ...(args.gainedAtClassLevel
        ? { gainedAtClassLevel: args.gainedAtClassLevel }
        : {}),
    });
    if (
      definition.detail.kind === 'item' &&
      definition.detail.weapon &&
      !definition.detail.armor
    )
      await insertAttackRoutine(ctx, sheet, {
        weaponEntryId: id,
        name: requireRoutineName(
          definition.name ?? definition.detail.weapon.baseType,
        ),
        ...defaultAttackRoutineConfiguration(definition.detail.weapon),
      });
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return id;
  },
});
export function requireEntryChoice(
  kind: string,
  choice: string | null | undefined,
) {
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
export function buildRecordedCatalogState(
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
    if (args.choiceOrder !== undefined && args.choiceOrder !== null)
      requireSafeWholeNumber(args.choiceOrder, 'Choice order');
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
    requireAlternateRacialTrait(sheet, definition);
    requireRacialAbilityScoreChoice(definition, args.choice);
    if (previous.kind === 'race' && (args.active ?? previous.active))
      requireSingleActiveRace(sheet, previous._id);
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
      choiceOrder:
        args.choiceOrder === null
          ? undefined
          : (args.choiceOrder ?? previous.choiceOrder),
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

/** Race switches leave each source row and its recorded Grants available to restore. */
export const selectRace = campaignMutation({
  args: {
    ...writeScope,
    catalogEntryId: v.union(v.id('catalogEntry'), v.null()),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const definition =
      args.catalogEntryId === null
        ? null
        : requireCatalogSheetDefinition(
            sheet,
            await resolvePreferredCatalogEntryId(
              ctx,
              sheet,
              args.catalogEntryId,
            ),
          );
    if (definition && definition.kind !== 'race')
      throw new ConvexError('Choose a race');
    const selected = sheet.entries.find(
      (entry) =>
        entry.kind === 'race' &&
        !entry.grantKey &&
        definition !== null &&
        sheet.catalogEntries.some(
          (catalog) =>
            catalog._id === entry.catalogEntryId &&
            catalog.ruleIdentity === definition.ruleIdentity,
        ),
    );
    let changed = false;
    for (const entry of sheet.entries) {
      if (entry.kind !== 'race' || entry.grantKey) continue;
      const active = entry._id === selected?._id;
      if (entry.active === active) continue;
      await ctx.db.patch('characterSheetEntry', entry._id, { active });
      sheet.entries = sheet.entries.map((row) =>
        row._id === entry._id ? { ...entry, active } : row,
      );
      changed = true;
    }
    if (
      definition &&
      selected?.kind === 'race' &&
      selected.catalogEntryId !== definition._id
    ) {
      await ctx.db.patch('characterSheetEntry', selected._id, {
        catalogEntryId: definition._id,
        catalogOverride: undefined,
      });
      sheet.entries = sheet.entries.map((entry) =>
        entry._id === selected._id && entry.kind === 'race'
          ? {
              ...entry,
              catalogEntryId: definition._id,
              catalogOverride: undefined,
            }
          : entry,
      );
      changed = true;
    }
    if (definition && !selected) {
      await persistRecordedEntry(ctx, sheet, {
        characterId: sheet.character._id,
        catalogEntryId: definition._id,
        kind: 'race',
        active: true,
        state: { kind: 'race' },
      });
      changed = true;
    }
    if (changed) {
      await deleteUnusedRaceStatisticsCopies(ctx, sheet);
      await pruneWarningAcceptancesAndRecordChange(ctx, {
        sheet,
        operationId: args.operationId,
      });
    }
    return null;
  },
});

export const setRacialTraitSelected = campaignMutation({
  args: {
    ...writeScope,
    catalogEntryId: v.id('catalogEntry'),
    selected: v.boolean(),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const definition = requireCatalogSheetDefinition(
      sheet,
      await resolvePreferredCatalogEntryId(ctx, sheet, args.catalogEntryId),
    );
    if (definition.kind !== 'racialTrait')
      throw new ConvexError('Choose a Racial Trait');
    requireAlternateRacialTrait(sheet, definition);
    const previous = sheet.entries.find(
      (entry) =>
        entry.kind === 'racialTrait' &&
        !entry.grantKey &&
        entry.catalogEntryId === definition._id,
    );
    if (previous && previous.kind !== 'racialTrait')
      throw new ConvexError('Choose a Racial Trait');
    if (previous) {
      if (previous.active === args.selected) return null;
      await ctx.db.patch('characterSheetEntry', previous._id, {
        active: args.selected,
      });
      sheet.entries = sheet.entries.map((entry) =>
        entry._id === previous._id
          ? { ...previous, active: args.selected }
          : entry,
      );
    } else {
      if (!args.selected) return null;
      await persistRecordedEntry(ctx, sheet, {
        characterId: sheet.character._id,
        catalogEntryId: definition._id,
        kind: 'racialTrait',
        active: true,
        state: { kind: 'racialTrait' },
      });
    }
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

export const chooseRacialAbilityScore = campaignMutation({
  args: {
    ...writeScope,
    target: dormantTargetValidator,
    ability: v.union(abilityValidator, v.null()),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const resolved = findResolvedEntry(sheet, args.target);
    const entry = resolved.entry;
    if (entry.kind !== 'racialTrait')
      throw new ConvexError('Choose an ability score for a Racial Trait');
    const definition = sheet.catalogEntries.find(
      (row) => row._id === entry.catalogEntryId,
    );
    if (
      !definition?.modifiers.some(
        (modifier) => modifier.target === 'ability.$choice',
      )
    )
      throw new ConvexError('This Racial Trait has no ability score choice');
    const catalogEntryId = ctx.db.normalizeId(
      'catalogEntry',
      entry.catalogEntryId,
    );
    if (!catalogEntryId) throw new ConvexError('Racial Trait is unavailable');
    const previous = sheet.entries.find(
      (row) => row._id === resolved.storedEntryId,
    );
    if (previous && previous.kind !== 'racialTrait')
      throw new ConvexError('Racial Trait is unavailable');
    if ((entry.state.choice ?? null) === args.ability) return null;
    await persistRecordedEntry(
      ctx,
      sheet,
      {
        characterId: sheet.character._id,
        catalogEntryId,
        active: entry.active,
        ...buildRecordedCatalogState(ctx, previous ?? entry, args.ability),
        ...(entry.grantKey ? { grantKey: entry.grantKey } : {}),
        ...(previous?.notes !== undefined ? { notes: previous.notes } : {}),
        ...(previous?.kept ? { kept: previous.kept } : {}),
        ...(previous?.catalogOverride ? { catalogOverride: true } : {}),
        ...(previous?.selectionSource
          ? { selectionSource: previous.selectionSource }
          : {}),
        ...(previous?.gainedAtClassLevel
          ? { gainedAtClassLevel: previous.gainedAtClassLevel }
          : {}),
        ...(previous?.choiceOrder !== undefined
          ? { choiceOrder: previous.choiceOrder }
          : {}),
      },
      previous?._id,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

export const setRacialTraitReplacements = campaignMutation({
  args: {
    ...rowScope,
    replaces: v.union(v.array(v.id('catalogEntry')), v.null()),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const previous = sheet.entries.find((entry) => entry._id === args.entryId);
    if (previous?.kind !== 'racialTrait' || previous.grantKey)
      throw new ConvexError(
        'Alternate Racial Trait does not belong to this Character',
      );
    if (args.replaces && args.replaces.length > 256)
      throw new ConvexError('Choose at most 256 replacements');
    for (const id of args.replaces ?? []) {
      const definition = requireCatalogSheetDefinition(sheet, id);
      if (definition.kind !== 'racialTrait')
        throw new ConvexError('Choose a Racial Trait to replace');
    }
    const state = {
      ...previous.state,
      replaces:
        args.replaces === null ? undefined : [...new Set(args.replaces)],
    };
    if (compareValues(state, previous.state) === 0) return null;
    await ctx.db.patch('characterSheetEntry', previous._id, { state });
    sheet.entries = sheet.entries.map((entry) =>
      entry._id === previous._id ? { ...previous, state } : entry,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

function requireSingleActiveRace(sheet: WritableSheet, exceptEntryId?: string) {
  if (
    sheet.entries.some(
      (entry) =>
        entry.kind === 'race' && entry.active && entry._id !== exceptEntryId,
    )
  )
    throw new ConvexError('Change your race with the race picker');
}
function requireAlternateRacialTrait(
  sheet: WritableSheet,
  definition: Doc<'catalogEntry'>,
) {
  if (definition.detail.kind !== 'racialTrait') return;
  const isStandard = sheet.catalogEntries.some(
    (race) =>
      race.detail.kind === 'race' &&
      race.detail.racialTraits.some(
        (id) =>
          id === definition._id ||
          sheet.catalogEntries.find((trait) => trait._id === id)
            ?.ruleIdentity === definition.ruleIdentity,
      ),
  );
  if (isStandard)
    throw new ConvexError('Standard Racial Traits are granted by their race');
}
function requireRacialAbilityScoreChoice(
  definition: Doc<'catalogEntry'>,
  choice: string | null | undefined,
) {
  if (
    definition.countsAsRaces &&
    !Array.isArray(definition.countsAsRaces) &&
    'oneOf' in definition.countsAsRaces &&
    choice != null &&
    !definition.countsAsRaces.oneOf.includes(choice)
  )
    throw new ConvexError('Choose one of the available races');
  if (
    definition.detail.kind === 'racialTrait' &&
    definition.modifiers.some(
      (modifier) => modifier.target === 'ability.$choice',
    ) &&
    choice != null &&
    !abilityKeys.some((ability) => ability === choice)
  )
    throw new ConvexError('Choose a valid ability score');
}

function requireRacialProgression(
  progression: Infer<typeof racialProgressionValidator> | null | undefined,
) {
  if (progression == null) return;
  if (!progression.creatureType.trim())
    throw new ConvexError('Creature type is required');
  requireSafeWholeNumber(progression.hitDie, 'Hit Die');
  if (progression.hitDie === 0)
    throw new ConvexError('Hit Die must be a whole number of 1 or more');
  requireNonnegativeInteger(
    progression.skillRanksPerHitDie,
    'Skill ranks per Hit Die',
  );
  if (progression.classSkills.length > 256)
    throw new ConvexError('Choose at most 256 class skills');
  if (progression.classSkills.some((skill) => !skill.trim()))
    throw new ConvexError('Choose a named class skill');
}
function requireRacialSkillRanks(ranks: Record<string, number> | undefined) {
  if (ranks === undefined) return;
  if (Object.keys(ranks).length > 256)
    throw new ConvexError('Choose at most 256 skills');
  const skills = new Set<string>();
  for (const [skill, count] of Object.entries(ranks)) {
    if (!skill.trim()) throw new ConvexError('Choose a skill');
    const key = canonicalSkillKey(skill);
    if (!key) throw new ConvexError('Choose a valid skill');
    if (skills.has(key)) throw new ConvexError('Choose each skill once');
    skills.add(key);
    requireNonnegativeInteger(count, 'Racial skill ranks');
  }
}
const raceStatisticsValidator = v.object({
  racialHitDice: v.optional(v.number()),
  racialProgression: v.optional(v.union(racialProgressionValidator, v.null())),
  racialHpGained: v.optional(v.union(v.number(), v.null())),
  racialSkillRanks: v.optional(v.record(v.string(), v.number())),
});
type RaceStatistics = Infer<typeof raceStatisticsValidator>;
type RaceDetail = Extract<Doc<'catalogEntry'>['detail'], { kind: 'race' }>;
function updatedRaceDetail(detail: RaceDetail, changes: RaceStatistics) {
  const { racialProgression: previousProgression, ...previousDetail } = detail;
  const progression =
    changes.racialProgression === undefined
      ? previousProgression
      : changes.racialProgression;
  return {
    ...previousDetail,
    ...(changes.racialHitDice !== undefined &&
    changes.racialHitDice !== (detail.racialHitDice ?? 0)
      ? { racialHitDice: changes.racialHitDice }
      : {}),
    ...(progression != null ? { racialProgression: progression } : {}),
  };
}
async function createRaceStatisticsCopy(
  ctx: MutationCtx,
  sheet: WritableSheet,
  definition: ReturnType<typeof requireCatalogSheetDefinition>,
  detail: RaceDetail,
) {
  await deleteUnusedRaceStatisticsCopies(ctx, sheet);
  if (
    sheet.catalogEntries.filter(
      (entry) =>
        entry.scope === 'character' &&
        entry.characterId === sheet.character._id,
    ).length >= maxCharacterChildRows
  )
    throw new ConvexError('Character sheet is too large');
  return copyCatalogDefinition(
    ctx,
    definition,
    { scope: 'character', characterId: sheet.character._id },
    { racialStatisticsCopy: true, detail },
  );
}
async function writeRaceStatisticsDefinition(
  ctx: MutationCtx,
  sheet: WritableSheet,
  {
    definition,
    detail,
    hasOverride,
  }: {
    definition: ReturnType<typeof requireCatalogSheetDefinition>;
    detail: RaceDetail;
    hasOverride: boolean;
  },
) {
  const catalogEntryId = hasOverride
    ? definition._id
    : await createRaceStatisticsCopy(ctx, sheet, definition, detail);
  if (hasOverride)
    await ctx.db.patch('catalogEntry', catalogEntryId, { detail });
  const updatedDefinition = await ctx.db.get('catalogEntry', catalogEntryId);
  if (!updatedDefinition)
    throw new ConvexError('Race definition is unavailable');
  sheet.catalogEntries = projectCampaignCopies([
    ...sheet.catalogEntries.filter((entry) => entry._id !== catalogEntryId),
    updatedDefinition,
  ]);
  return catalogEntryId;
}

export const editRaceStatistics = campaignMutation({
  args: { ...rowScope, ...raceStatisticsValidator.fields },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const previous = sheet.entries.find((entry) => entry._id === args.entryId);
    if (previous?.kind !== 'race' || previous.grantKey)
      throw new ConvexError('Race does not belong to this Character');
    const definition = requireCatalogSheetDefinition(
      sheet,
      previous.catalogEntryId,
    );
    if (definition.detail.kind !== 'race')
      throw new ConvexError('Race definition is unavailable');
    if (args.racialHitDice !== undefined)
      requireSafeWholeNumber(args.racialHitDice, 'Racial Hit Dice');
    requireRacialProgression(args.racialProgression);
    if (args.racialHpGained != null)
      requireNonnegativeInteger(args.racialHpGained, 'Racial hit points');
    requireRacialSkillRanks(args.racialSkillRanks);
    const state = {
      ...previous.state,
      ...(args.racialHpGained !== undefined
        ? { racialHpGained: args.racialHpGained }
        : {}),
      ...(args.racialSkillRanks !== undefined
        ? { racialSkillRanks: args.racialSkillRanks }
        : {}),
    };
    const persistedDefinition = await ctx.db.get(
      'catalogEntry',
      definition._id,
    );
    if (persistedDefinition?.detail.kind !== 'race')
      throw new ConvexError('Race definition is unavailable');
    const detail = updatedRaceDetail(persistedDefinition.detail, args);
    const definitionChanged =
      compareValues(detail, persistedDefinition.detail) !== 0;
    if (compareValues(state, previous.state) === 0 && !definitionChanged)
      return null;
    const catalogEntryId = definitionChanged
      ? await writeRaceStatisticsDefinition(ctx, sheet, {
          definition,
          detail,
          hasOverride:
            definition.scope === 'character' &&
            definition.characterId === sheet.character._id &&
            (definition.racialStatisticsCopy === true ||
              definition.copiedFrom !== undefined ||
              previous.catalogOverride === true),
        })
      : definition._id;
    const patch = {
      state,
      catalogEntryId,
      ...(definitionChanged ? { catalogOverride: true as const } : {}),
    };
    await ctx.db.patch('characterSheetEntry', previous._id, patch);
    sheet.entries = sheet.entries.map((entry) =>
      entry._id === previous._id ? { ...previous, ...patch } : entry,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

export const editEquipment = campaignMutation({
  args: {
    ...writeScope,
    entryId: v.optional(v.id('characterSheetEntry')),
    grantKey: v.optional(grantKeyValidator),
    active: v.optional(v.boolean()),
    masterwork: v.optional(v.boolean()),
    enhancement: v.optional(v.number()),
    material: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    if (Boolean(args.entryId) === Boolean(args.grantKey))
      throw new ConvexError('Choose one equipment entry');
    const resolved = args.grantKey
      ? findResolvedEntry(sheet, { grantKey: args.grantKey })
      : null;
    const entry =
      resolved?.entry ?? sheet.entries.find((row) => row._id === args.entryId);
    if (entry?.kind !== 'item')
      throw new ConvexError('Item does not belong to this Character');
    const catalogEntryId = ctx.db.normalizeId(
      'catalogEntry',
      entry.catalogEntryId,
    );
    if (!catalogEntryId)
      throw new ConvexError('Item definition is unavailable');
    const definition = sheet.catalogEntries.find(
      (row) => row._id === catalogEntryId,
    );
    if (definition?.detail.kind !== 'item' || !definition.detail.armor)
      throw new ConvexError('Choose armor or a shield');
    const previous = sheet.entries.find(
      (row) => row._id === (resolved?.storedEntryId ?? args.entryId),
    );
    if (args.enhancement !== undefined)
      requireSafeWholeNumber(args.enhancement, 'Enhancement');
    const normalizedMaterial = args.material?.trim();
    const state = {
      ...entry.state,
      ...(args.masterwork !== undefined ? { masterwork: args.masterwork } : {}),
      ...(args.enhancement !== undefined
        ? { enhancement: args.enhancement }
        : {}),
      ...(args.material !== undefined
        ? {
            material:
              normalizedMaterial === '' ? null : (normalizedMaterial ?? null),
          }
        : {}),
    };
    const active = args.active ?? entry.active;
    if (active === entry.active && compareValues(state, entry.state) === 0)
      return null;
    await persistRecordedEntry(
      ctx,
      sheet,
      {
        characterId: sheet.character._id,
        catalogEntryId,
        kind: 'item',
        active,
        state,
        ...('grantKey' in entry && entry.grantKey
          ? { grantKey: entry.grantKey }
          : {}),
        ...('choiceOrder' in entry && entry.choiceOrder !== undefined
          ? { choiceOrder: entry.choiceOrder }
          : {}),
        ...('kept' in entry && entry.kept ? { kept: entry.kept } : {}),
        ...('catalogOverride' in entry && entry.catalogOverride
          ? { catalogOverride: entry.catalogOverride }
          : {}),
        ...('notes' in entry && entry.notes !== undefined
          ? { notes: entry.notes }
          : {}),
        ...('gainedAtClassLevel' in entry && entry.gainedAtClassLevel
          ? {
              gainedAtClassLevel:
                ctx.db.normalizeId(
                  'characterSheetEntry',
                  entry.gainedAtClassLevel,
                ) ?? undefined,
            }
          : {}),
        ...(previous &&
        'selectionSource' in previous &&
        previous.selectionSource
          ? { selectionSource: previous.selectionSource }
          : {}),
      },
      previous?._id,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

export const setManualProficiency = campaignMutation({
  args: {
    ...writeScope,
    proficiency: manualProficiencyValidator,
    disposition: v.union(
      v.literal('added'),
      v.literal('removed'),
      v.literal('none'),
    ),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const parsed = manualProficiencySchema.safeParse(args.proficiency);
    if (!parsed.success)
      throw new ConvexError(
        'Enter a proficiency category, weapon name or group',
      );
    const proficiency = parsed.data;
    const base = sheet.entries.find((row) => row.kind === 'base');
    if (!base) throw new ConvexError('Base scores are unavailable');
    const previous = base.state.proficiencies ?? { added: [], removed: [] };
    const proficiencies = {
      added: previous.added.filter(
        (value) => proficiencyKey(value) !== proficiencyKey(proficiency),
      ),
      removed: previous.removed.filter(
        (value) => proficiencyKey(value) !== proficiencyKey(proficiency),
      ),
    };
    if (args.disposition !== 'none')
      proficiencies[args.disposition].push(proficiency);
    if (
      proficiencies.added.length + proficiencies.removed.length >
      maxCharacterChildRows
    )
      throw new ConvexError('Too many manual proficiencies');
    const state = { ...base.state, proficiencies };
    if (compareValues(state, base.state) === 0) return null;
    await ctx.db.patch('characterSheetEntry', base._id, { state });
    sheet.entries = sheet.entries.map((row) =>
      row._id === base._id ? { ...base, state } : row,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

export const setProficiencyChoice = campaignMutation({
  args: { ...rowScope, choice: v.union(v.string(), v.null()) },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const entry = sheet.entries.find((row) => row._id === args.entryId);
    if (
      !entry ||
      (entry.kind !== 'race' &&
        entry.kind !== 'racialTrait' &&
        entry.kind !== 'archetype' &&
        entry.kind !== 'classFeature' &&
        entry.kind !== 'feat' &&
        entry.kind !== 'trait')
    )
      throw new ConvexError(
        'Proficiency choice does not belong to this Character',
      );
    const catalog = sheet.catalogEntries.find(
      (row) => row._id === entry.catalogEntryId,
    );
    if (!catalog?.proficiencies?.some((grant) => 'choice' in grant))
      throw new ConvexError('Entry has no proficiency choice');
    const normalizedChoice = args.choice?.trim();
    const choice = normalizedChoice === '' ? null : (normalizedChoice ?? null);
    const state = { ...entry.state, choice };
    if (compareValues(state, entry.state) === 0) return null;
    const patch = buildRecordedCatalogState(ctx, entry, choice);
    await ctx.db.patch('characterSheetEntry', entry._id, patch);
    const updated = await ctx.db.get('characterSheetEntry', entry._id);
    if (!updated) throw new ConvexError('Entry is unavailable');
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

export const setArchetypeSelected = campaignMutation({
  args: {
    ...writeScope,
    classEntryId: v.id('catalogEntry'),
    catalogEntryId: v.id('catalogEntry'),
    selected: v.boolean(),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const classEntryId = await resolvePreferredCatalogEntryId(
      ctx,
      sheet,
      args.classEntryId,
    );
    const catalogEntryId = await resolvePreferredCatalogEntryId(
      ctx,
      sheet,
      args.catalogEntryId,
    );
    const baseClass = sheet.catalogEntries.find(
      (definition) => definition._id === classEntryId,
    );
    if (baseClass?.detail.kind !== 'class')
      throw new ConvexError('Class does not belong to this Character');
    const definition = requireCatalogSheetDefinition(sheet, catalogEntryId);
    if (definition.detail.kind !== 'archetype')
      throw new ConvexError('Choose an Archetype');
    const previous = findArchetypeSelection({
      entries: sheet.entries,
      catalogEntries: sheet.catalogEntries,
      ruleIdentity: definition.ruleIdentity,
    });
    if (previous?.kind === 'archetype') {
      const catalogEntryId = args.selected
        ? definition._id
        : previous.catalogEntryId;
      if (
        previous.active === args.selected &&
        previous.catalogEntryId === catalogEntryId &&
        previous.state.classEntryId === classEntryId
      )
        return null;
      await ctx.db.patch('characterSheetEntry', previous._id, {
        active: args.selected,
        catalogEntryId,
        state: { ...previous.state, classEntryId },
      });
      sheet.entries = sheet.entries.map((entry) =>
        entry._id === previous._id
          ? {
              ...previous,
              active: args.selected,
              catalogEntryId,
              state: { ...previous.state, classEntryId },
            }
          : entry,
      );
    } else {
      if (!args.selected) return null;
      await persistRecordedEntry(ctx, sheet, {
        characterId: sheet.character._id,
        catalogEntryId: definition._id,
        kind: 'archetype',
        active: true,
        state: { kind: 'archetype', classEntryId },
      });
    }
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});

export const setArchetypePartChoices = campaignMutation({
  args: {
    ...rowScope,
    replacementChoices: v.union(
      v.null(),
      v.array(archetypeReplacementValidator),
    ),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadWritableSheet(ctx, args);
    const previous = sheet.entries.find((entry) => entry._id === args.entryId);
    if (previous?.kind !== 'archetype' || previous.grantKey)
      throw new ConvexError('Archetype does not belong to this Character');
    if (args.replacementChoices && args.replacementChoices.length > 256)
      throw new ConvexError('Choose at most 256 feature replacements');
    for (const replacement of args.replacementChoices ?? []) {
      if (
        !Number.isSafeInteger(replacement.classLevel) ||
        replacement.classLevel < 1
      )
        throw new ConvexError('Choose a positive whole class level');
      const definition = requireCatalogSheetDefinition(
        sheet,
        replacement.catalogEntryId,
      );
      if (definition.kind !== 'classFeature')
        throw new ConvexError('Choose a class feature to replace');
    }
    const state = {
      ...previous.state,
      replaces: args.replacementChoices ?? undefined,
    };
    if (compareValues(state, previous.state) === 0) return null;
    await ctx.db.patch('characterSheetEntry', previous._id, { state });
    sheet.entries = sheet.entries.map((entry) =>
      entry._id === previous._id ? { ...previous, state } : entry,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return null;
  },
});
