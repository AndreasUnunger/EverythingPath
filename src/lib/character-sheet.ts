import {
  attackRoutineWeaponUses,
  resolveAttackRoutines,
  type AttackRoutineState,
} from './character-sheet-attacks';
import {
  resolveCharacterSheetArchetypes,
  type ResolvedCharacterSheetArchetypes,
} from './character-sheet-archetypes';
import type { Alignment } from './character-sheet-prerequisite-schema';
import type { CompanionLinkedInputResolution } from './character-sheet-linked-inputs';
import { resolveCharacterSheetSelectionRules } from './character-sheet-selection-rules';
import {
  resolveCharacterSheetPrerequisites,
  type Prerequisite,
  type PrerequisiteFacts,
} from './character-sheet-prerequisites';
import type { Infer, GenericId } from 'convex/values';
import type { characterSheetEntryValidator } from '../../convex/schema';
import { z } from 'zod';
import { resolveCharacterSheetGrants } from './character-sheet-grants';
import type { ArmorCategory } from './character-sheet-armor-categories';
import { resolveSkills } from './character-sheet-skills';
import {
  resolveEquipment,
  resolveWeaponProficiencies,
} from './character-sheet-equipment';
import {
  resolveProficiencies,
  type ProficiencyGrant,
  type ProficiencyPrerequisite,
} from './character-sheet-proficiencies';
import {
  resolveSheetConditions,
  type ConditionKey,
} from './character-sheet-conditions';
import { calculateSpellcastings } from './character-sheet-spellcasting';
import { calculateSpellCollections } from './character-sheet-spell-collections';
import type {
  Casting,
  ReviewedCastingTables,
} from './character-sheet-casting-tables';
import {
  racialTraitWarnings,
  resolveCharacterSheetRacialFacts,
} from './character-sheet-racial';
import {
  advancementBudgets,
  advancementWarnings,
  resolveAdvancement,
} from './character-sheet-advancement';
import {
  evaluateFormula,
  FormulaError,
  parseFormula,
} from './character-sheet-formulas';

import { abilityKeys, type Ability } from './character-sheet-abilities';
export { abilityKeys, type Ability } from './character-sheet-abilities';

export const abilityLabels: Record<Ability, string> = {
  strength: 'Strength',
  dexterity: 'Dexterity',
  constitution: 'Constitution',
  intelligence: 'Intelligence',
  wisdom: 'Wisdom',
  charisma: 'Charisma',
};
export type AbilityScores = Record<Ability, number>;
export const defaultAbilityScores: AbilityScores = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
};
export const abilityTargets = {
  strength: 'ability.str',
  dexterity: 'ability.dex',
  constitution: 'ability.con',
  intelligence: 'ability.int',
  wisdom: 'ability.wis',
  charisma: 'ability.cha',
} as const;
export type BaseModifier = {
  target: (typeof abilityTargets)[Ability];
  bonusType: 'base';
  value: number;
};
export type CreationSettings = {
  abilityMethod:
    | { kind: 'pointBuy'; budget: number }
    | { kind: 'rolled'; budget?: number };
  traitCount: number;
  campaignTraitRequired: boolean;
};
export const defaultCreationSettings = {
  abilityMethod: { kind: 'pointBuy', budget: 15 },
  traitCount: 2,
  campaignTraitRequired: false,
} satisfies CreationSettings;
export const warningChecks = [
  'class',
  'hpGainedMissing',
  'hpGainedBelowMinimum',
  'hpGainedAboveMaximum',
  'firstLevelHpNotMaximum',
  'totalHpUnresolved',
  'levelZero',
  'pointBuy',
  'unsupportedFormula',
  'formulaDependency',
  'abilityIncreaseMissing',
  'abilityIncreaseMilestone',
  'favoredClassBonusMissing',
  'favoredClassBonusNotFavored',
  'favoredClassCount',
  'favoredClassPrestige',
  'skillRankCap',
  'skillRankBudget',
  'skillRanksUnspent',
  'skillRankBudgetUnresolved',
  'armorCheckPenaltyUnresolved',
  'classVersions',
  'keptDormant',
  'racialAbilityScoreChoice',
  'racialReplacementUnresolved',
  'racialReplacementDuplicate',
  'racialTraitRace',
  'racialProgressionMissing',
  'racialSkillRankCap',
  'racialSkillRankBudget',
  'proficiencyPrerequisite',
  'prerequisites.current',
  'prerequisites.recordedLevel',
  'featSlotBudget',
  'featSlotType',
  'featDuplicate',
  'traitCount',
  'traitType',
  'traitSlotType',
  'traitDuplicate',
  'drawbackCount',
  'campaignTraitRequired',
  'npcTraits',
  'classAlignment',
  'oneHandedExotic',
  'equipmentEnhancement',
  'spellCount',
  'spellLevel',
  'spellOffList',
  'spellOrphaned',
  'archetypeConflict',
  'archetypeClass',
  'archetypeReplacementUnmatched',
  'archetypeUnchainedMonk',
  'archetypeFeatureUpgrade',
  'archetypeSkillRanksConflict',
  'missingAttackWeapon',
  'inactiveAttackWeapon',
  'unavailableAttackWeapon',
  'invalidAttackWeapon',
  'invalidAttackOffHand',
  'unsuitableAttackOffHand',
  'unsuitableAttackHands',
  'unsuitableAttackMode',
  'attackWeaponUnresolved',
] as const;
export const characterSheetWarningSchema = z.object({
  kind: z.enum(['incomplete', 'unresolved', 'rules']),
  check: z.enum(warningChecks),
  target: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('entry'), entryId: z.string() }),
    z.object({ kind: z.literal('pointBuy') }),
    z.object({
      kind: z.literal('classLevel'),
      entryId: z.string(),
      field: z.enum([
        'class',
        'hpGained',
        'abilityIncrease',
        'favoredClassBonus',
        'skillRanks',
      ]),
    }),
    z.object({ kind: z.literal('hitPoints') }),
    z.object({ kind: z.literal('classLevels') }),
    z.object({ kind: z.literal('favoredClasses') }),
    z.object({
      kind: z.literal('spellcasting'),
      classEntryId: z.string(),
      spellLevel: z.number(),
    }),
    z.object({
      kind: z.literal('modifier'),
      entryId: z.string(),
      modifierIndex: z.number(),
    }),
  ]),
  subject: z.string(),
  fingerprint: z.string(),
  message: z.string(),
});
export type SheetWarning = z.infer<typeof characterSheetWarningSchema>;
// CRB Table 1–1: Ability Score Costs.
const pointBuyCosts = new Map([
  [7, -4],
  [8, -2],
  [9, -1],
  [10, 0],
  [11, 1],
  [12, 2],
  [13, 3],
  [14, 5],
  [15, 7],
  [16, 10],
  [17, 13],
  [18, 17],
]);

export function calculatePointBuy({
  baseModifiers,
  abilityMethod,
}: {
  baseModifiers: readonly BaseModifier[];
  abilityMethod: CreationSettings['abilityMethod'];
}): { spent: number | null } | null {
  if (abilityMethod.kind === 'rolled') return null;
  const costs = baseModifiers.map((modifier) =>
    pointBuyCosts.get(modifier.value),
  );
  const spent = costs.some((cost) => cost === undefined)
    ? null
    : costs.reduce<number>((sum, cost) => sum + (cost ?? 0), 0);
  return { spent };
}
export type FavoredClassBonus =
  | { choice: 'hp' }
  | { choice: 'skill' }
  | { choice: 'alt'; note: string };
export type CharacterSheetClassDetail = {
  kind: 'class';
  classKind: 'base' | 'prestige' | 'npc';
  alignments?: readonly Alignment[];
  counterpartOf?: string;
  hitDie: number;
  bab: 'full' | 'threeQuarters' | 'half';
  saves: Record<'fort' | 'ref' | 'will', 'good' | 'poor'>;
  skillRanksPerLevel: number;
  casting?: Casting;
  classSkills?: readonly string[];
  featuresByLevel?: readonly { classLevel: number; catalogEntryId: string }[];
  picksByLevel?: readonly { classLevel: number; list: string; count: number }[];
};
export type CharacterSheetCatalogEntry = {
  _id: string;
  name?: string;
  ruleIdentity: string;
  sourceKey?: string;
  stacksWithItself?: boolean;
  countsAsRaces?: readonly string[] | { oneOf: readonly string[] };
  modifiers: readonly CatalogModifier[];
  detail?: SheetCatalogEntryDetail;
  proficiencies?: readonly ProficiencyGrant[];
  proficiencyPrerequisites?: readonly ProficiencyPrerequisite[];
  prerequisites?: readonly Prerequisite[];
  description?: string;
  guidanceText?: string;
  prerequisiteText?: string;
  grants?: readonly { catalogEntryId: string }[];
  grantsSlots?: readonly {
    kind: 'feat' | 'trait';
    count: number;
    featTypes?: readonly string[];
    feats?: readonly string[];
    ignoresPrerequisites?: boolean;
  }[];
};
export const creatureSizes = [
  'fine',
  'diminutive',
  'tiny',
  'small',
  'medium',
  'large',
  'huge',
  'gargantuan',
  'colossal',
] as const;
export type CreatureSize = (typeof creatureSizes)[number];
export {
  proficiencyCategories,
  type ProficiencyGrant,
} from './character-sheet-proficiencies';
// The resolver uses synthetic row identities, while stored references retain the
// schema's exact discriminated state and metadata fields.
type ResolveSheetIds<Value> =
  Value extends GenericId<string>
    ? string
    : Value extends readonly (infer Item)[]
      ? ResolveSheetIds<Item>[]
      : Value extends object
        ? { [Key in keyof Value]: ResolveSheetIds<Value[Key]> }
        : Value;
type ResolveStoredSheetEntry<Entry> = Entry extends { characterId: unknown }
  ? ResolveSheetIds<Omit<Entry, 'characterId'>> & { _id: string }
  : never;
export type SheetEntry = ResolveStoredSheetEntry<
  Infer<typeof characterSheetEntryValidator>
>;

export function creationSettingsFor(
  base: Extract<SheetEntry, { kind: 'base' }>,
): CreationSettings {
  return {
    abilityMethod: base.state.abilityMethod ?? { kind: 'rolled' },
    traitCount: base.state.traitCount ?? defaultCreationSettings.traitCount,
    campaignTraitRequired:
      base.state.campaignTraitRequired ??
      defaultCreationSettings.campaignTraitRequired,
  };
}

export type CharacterSheetRacialProgression = {
  creatureType: string;
  hitDie: number;
  bab: CharacterSheetClassDetail['bab'];
  saves: CharacterSheetClassDetail['saves'];
  skillRanksPerHitDie: number;
  classSkills: string[];
};
export type ArchetypeReplacement = {
  classLevel: number;
  catalogEntryId: string;
  scope?: 'whole' | 'part';
};
export type ArchetypeFeatureChange =
  | { featureIdentity: string; scope: 'whole' }
  | { featureIdentity: string; scope: 'part'; part: string };

export type SheetCatalogEntryDetail =
  | {
      kind: 'race';
      racialTraits: readonly string[];
      allowedAlternateRaces?: readonly string[];
      size?: CreatureSize;
      creatureTypes?: readonly string[];
      creatureSubtypes?: readonly string[];
      racialHitDice?: number;
      racialProgression?: CharacterSheetRacialProgression;
    }
  | {
      kind: 'racialTrait';
      raceEntryIds: readonly string[];
      replaces: readonly string[];
      favoredClassCount?: 2;
      bonusSkillRanksPerLevel?: number;
      unresolvedReplacements?: readonly string[];
      subrace?: string;
    }
  | {
      kind: 'archetype';
      classSkillsAdded?: readonly string[];
      classSkillsRemoved?: readonly string[];
      skillRanksPerLevel?: number;
      featureChanges?: readonly ArchetypeFeatureChange[];
      classEntryIds: readonly string[];
      replaces: readonly ArchetypeReplacement[];
      adds: readonly { classLevel: number; catalogEntryId: string }[];
      picksByLevel?: readonly {
        classLevel: number;
        list: string;
        count: number;
      }[];
    }
  | {
      kind: 'classFeature';
      parentFeature?: string;
      part?: string;
      duplicateUpgrade?: string;
      picksByLevel?: readonly {
        classLevel: number;
        list: string;
        count: number;
      }[];
    }
  | {
      kind: 'feat';
      featTypes?: readonly string[];
      repeatable?: 'no' | 'newChoice' | 'yes' | 'unreviewed';
      additionalTraits?: true;
    }
  | { kind: 'trait'; traitType?: string }
  | {
      kind: 'spellEffect';
      lastsOverOneDay?: boolean;
      defaultCasterLevel?: number;
    }
  | {
      kind: 'item';
      consumable?: boolean;
      armor?: {
        slot: 'armor' | 'shield';
        armorCheckPenalty: number;
        category?: ArmorCategory;
        bonus?: number;
        maxDex?: number | null;
        asf?: number;
      };
      material?: string;
      weapon?: {
        baseType: string;
        proficiency: 'simple' | 'martial' | 'exotic' | 'always';
        groups?: readonly string[];
        handedness?: 'light' | 'oneHanded' | 'twoHanded';
        attackType?: 'melee' | 'ranged';
        dice?: string;
        damageTypes?: readonly string[];
        threat?: number;
        mult?: number;
        thrown?: boolean;
        rangeIncrement?: number;
        thrownRangeIncrement?: number;
        strengthDamage?:
          | 'melee'
          | 'thrown'
          | 'bow'
          | 'compositeBow'
          | 'crossbow'
          | 'sling';
        strengthRating?: number;
        otherEnd?: {
          dice: string;
          threat: number;
          mult: number;
          damageTypes?: readonly string[];
        };
      };
    }
  | CharacterSheetClassDetail
  | { kind: 'class' }
  | { kind: 'condition'; conditionKey?: ConditionKey }
  | {
      kind: 'spell';
      levels?: Readonly<Record<string, number>>;
      school?: string;
      description?: string;
    }
  | { kind: 'base' | 'manual' };

export function isTemporaryEffect(
  entry: Pick<SheetEntry, 'kind'>,
  detail?: SheetCatalogEntryDetail,
) {
  return (
    entry.kind === 'abilityDamage' ||
    entry.kind === 'condition' ||
    (entry.kind === 'spellEffect' &&
      (detail?.kind !== 'spellEffect' || detail.lastsOverOneDay !== true)) ||
    (entry.kind === 'item' &&
      detail?.kind === 'item' &&
      detail.consumable === true)
  );
}

export type CharacterSheetInput = {
  resources?: { castingTables?: ReviewedCastingTables };
  sheetMode?: 'militiaOnly' | 'full';
  characterKind: 'pc' | 'npc';
  entries: readonly SheetEntry[];
  catalogEntries: readonly CharacterSheetCatalogEntry[];
  favoredClassCount?: number;
  racialHitDice?: {
    count: number;
    hpGained: number | null;
    progression?: Pick<CharacterSheetClassDetail, 'bab' | 'saves'> & {
      skillRanksPerHitDie: number;
      classSkills?: readonly string[];
    };
  };
};

type ClassLevelEntry = Extract<SheetEntry, { kind: 'classLevel' }>;
type FormulaCache = Map<string, ReturnType<typeof parseFormula> | FormulaError>;

function baseScoresFor({ entries, catalogEntries }: CharacterSheetInput) {
  const [base, ...otherBases] = entries.filter(
    (entry) => entry.kind === 'base',
  );
  if (!base || otherBases.length > 0)
    throw new Error('A sheet requires one base-scores entry');
  const catalogEntry = catalogEntries.find(
    (item) => item._id === base.catalogEntryId,
  );
  if (!catalogEntry) throw new Error('Base scores are unavailable');
  if (catalogEntry.modifiers.length !== 6)
    throw new Error('Base scores require six finite Modifiers');
  const baseModifiers = abilityKeys.map((ability): BaseModifier => {
    const [modifier, ...others] = catalogEntry.modifiers.filter(
      (item) => item.target === abilityTargets[ability],
    );
    if (
      !modifier ||
      others.length ||
      modifier.bonusType !== 'base' ||
      typeof modifier.value !== 'number' ||
      !Number.isFinite(modifier.value)
    )
      throw new Error('Base scores require six finite Modifiers');
    return {
      target: abilityTargets[ability],
      bonusType: 'base',
      value: modifier.value,
    };
  });
  return { base, baseModifiers };
}

function sourceCatalogModifiers(
  { entries, catalogEntries }: CharacterSheetInput,
  options: ResolveOptions,
): InputSourcedModifier[] {
  return entries.flatMap((entry): InputSourcedModifier[] => {
    if (!entry.active || !('catalogEntryId' in entry) || entry.kind === 'spell')
      return [];
    const catalog = catalogEntries.find(
      (item) => item._id === entry.catalogEntryId,
    );
    if (!catalog) throw new Error('Catalog Entry is unavailable');
    if (options.permanentOnly && isTemporaryEffect(entry, catalog.detail))
      return [];
    const choice = 'choice' in entry.state ? entry.state.choice : undefined;
    return catalog.modifiers.flatMap(
      (modifier, modifierIndex): InputSourcedModifier[] => {
        const ability = abilityKeys.find((ability) => ability === choice);
        const target =
          modifier.target === 'ability.$choice'
            ? ability
              ? abilityTargets[ability]
              : undefined
            : modifier.target;
        if (!target) return [];
        return [
          {
            modifierIndex,
            ...(entry.state.kind === 'spellEffect'
              ? { effectCasterLevel: entry.state.casterLevel }
              : {}),
            ...modifier,
            target,
            ...(modifier.condition
              ? {
                  condition: {
                    ...modifier.condition,
                    ...(modifier.condition.castingClass === '$choice' &&
                    typeof choice === 'string'
                      ? { castingClass: choice }
                      : {}),
                    ...(modifier.condition.school === '$choice' &&
                    typeof choice === 'string'
                      ? { school: choice }
                      : {}),
                  },
                }
              : {}),
            sheetEntryId: entry._id,
            entryName:
              catalog.name ??
              (entry.kind === 'base' ? 'Base scores' : 'Personal adjustment'),
            source: catalog.sourceKey ?? catalog.ruleIdentity,
            builtIn: entry.kind === 'base',
            stacksWithItself: catalog.stacksWithItself,
          },
        ];
      },
    );
  });
}

function abilityChangesFor(
  entries: readonly SheetEntry[],
  options: ResolveOptions,
) {
  const abilityDamage: Partial<Record<Ability, number>> = {};
  const drainModifiers: InputSourcedModifier[] = [];
  for (const entry of entries) {
    if (!entry.active) continue;
    if (entry.kind === 'abilityDamage' && !options.permanentOnly)
      abilityDamage[entry.state.ability] =
        (abilityDamage[entry.state.ability] ?? 0) + entry.state.points;
    if (entry.kind === 'abilityDrain')
      drainModifiers.push({
        target: abilityTargets[entry.state.ability],
        bonusType: 'untyped',
        value: -entry.state.points,
        sheetEntryId: entry._id,
        entryName: 'Ability drain',
        source: `drain:${entry._id}`,
        builtIn: true,
      });
  }
  return { abilityDamage, drainModifiers };
}

function characterLevelInputs(
  advancement: ReturnType<typeof resolveAdvancement>,
) {
  return {
    level: advancement.levels.length,
    hitDice: advancement.hitDice,
    classLevels: advancement.classLevelCounts,
  };
}

function calculationContext(
  { entries, catalogEntries }: CharacterSheetInput,
  advancement: ReturnType<typeof resolveAdvancement>,
  abilityDamage: Partial<Record<Ability, number>>,
  options: ResolveOptions,
): ResolveOptions {
  return {
    ...options,
    ...characterLevelInputs(advancement),
    abilityDamage,
    activeCatalogEntryIds: entries.flatMap((entry) => {
      if (!entry.active) return [];
      if (entry.kind === 'classLevel')
        return advancement.rows.some(
          (row) => row.entry._id === entry._id && row.catalog,
        ) && entry.state.classEntryId
          ? [entry.state.classEntryId]
          : [];
      if (!('catalogEntryId' in entry)) return [];
      const catalog = catalogEntries.find(
        (item) => item._id === entry.catalogEntryId,
      );
      return options.permanentOnly && isTemporaryEffect(entry, catalog?.detail)
        ? []
        : [entry.catalogEntryId];
    }),
  };
}

function abilityValue(
  ability: Ability,
  breakdowns: Record<LeafTarget, ResolvedStatistic>,
  abilityDamage: Partial<Record<Ability, number>>,
) {
  const score = breakdowns[abilityTargets[ability]].total;
  const modifier =
    Math.floor((score - 10) / 2) -
    Math.floor((abilityDamage[ability] ?? 0) / 2);
  return { score, modifier };
}

function calculateAbilities(
  breakdowns: Record<LeafTarget, ResolvedStatistic>,
  abilityDamage: Partial<Record<Ability, number>>,
) {
  return {
    strength: abilityValue('strength', breakdowns, abilityDamage),
    dexterity: abilityValue('dexterity', breakdowns, abilityDamage),
    constitution: abilityValue('constitution', breakdowns, abilityDamage),
    intelligence: abilityValue('intelligence', breakdowns, abilityDamage),
    wisdom: abilityValue('wisdom', breakdowns, abilityDamage),
    charisma: abilityValue('charisma', breakdowns, abilityDamage),
  };
}

function abilityModifierBreakdown(
  ability: Ability,
  abilities: ReturnType<typeof calculateAbilities>,
  abilityDamage: Partial<Record<Ability, number>>,
): ResolvedStatistic {
  const points = abilityDamage[ability] ?? 0;
  const applied: SourcedModifier[] = [
    {
      target: abilityTargets[ability],
      bonusType: 'base',
      value: Math.floor((abilities[ability].score - 10) / 2),
      sheetEntryId: `builtin:modifier:${ability}`,
      entryName: `${abilityLabels[ability]} modifier`,
      source: `builtin:modifier:${ability}`,
      builtIn: true,
    },
  ];
  if (points)
    applied.push({
      target: abilityTargets[ability],
      bonusType: 'untyped',
      value: -Math.floor(points / 2),
      sheetEntryId: `builtin:damage:${ability}`,
      entryName: `Ability damage (${points} points)`,
      source: `builtin:damage:${ability}`,
      builtIn: true,
    });
  return {
    total: abilities[ability].modifier,
    applied,
    suppressed: [],
    conditional: [],
  };
}

function calculateAbilityModifierBreakdowns(
  abilities: ReturnType<typeof calculateAbilities>,
  abilityDamage: Partial<Record<Ability, number>>,
) {
  return {
    strength: abilityModifierBreakdown('strength', abilities, abilityDamage),
    dexterity: abilityModifierBreakdown('dexterity', abilities, abilityDamage),
    constitution: abilityModifierBreakdown(
      'constitution',
      abilities,
      abilityDamage,
    ),
    intelligence: abilityModifierBreakdown(
      'intelligence',
      abilities,
      abilityDamage,
    ),
    wisdom: abilityModifierBreakdown('wisdom', abilities, abilityDamage),
    charisma: abilityModifierBreakdown('charisma', abilities, abilityDamage),
  };
}

function builtInHpModifiers(
  levels: readonly ClassLevelEntry[],
  breakdowns: Record<LeafTarget, ResolvedStatistic>,
  options: ResolveOptions,
): SourcedModifier[] {
  const modifiers: SourcedModifier[] = [];
  const hitDice = options.hitDice ?? levels.length;
  if (hitDice)
    modifiers.push({
      target: 'hp',
      bonusType: 'untyped',
      value:
        abilityValue('constitution', breakdowns, options.abilityDamage ?? {})
          .modifier * hitDice,
      sheetEntryId: 'builtin:constitution-hp',
      entryName: 'Constitution',
      source: 'constitution-hp',
      builtIn: true,
    });
  return modifiers;
}

function permanentIntelligenceFor(
  input: CharacterSheetInput,
  advancement: ReturnType<typeof resolveAdvancement>,
  options: ResolveOptions,
  formulaCache: FormulaCache,
  archetypes: ResolvedCharacterSheetArchetypes,
) {
  const permanentOptions = { ...options, permanentOnly: true, archetypes };
  const countingInput = {
    ...input,
    entries: resolveCharacterSheetGrants(input, permanentOptions)
      .countingEntries,
  };
  const { drainModifiers } = abilityChangesFor(
    countingInput.entries,
    permanentOptions,
  );
  const modifiers = [
    ...sourceCatalogModifiers(countingInput, permanentOptions),
    ...drainModifiers,
    ...advancement.modifiers,
  ].filter((modifier) => modifier.target === 'ability.int');
  const breakdowns = emptyBreakdowns();
  const intelligence = resolveTarget(
    'ability.int',
    modifiers,
    calculationContext(countingInput, advancement, {}, permanentOptions),
    breakdowns,
    formulaCache,
    [],
  );
  return Math.floor((intelligence.total - 10) / 2);
}

function permanentAbilitiesFor(
  input: CharacterSheetInput,
  options: ResolveOptions,
  formulaCache: FormulaCache,
  archetypes: ResolvedCharacterSheetArchetypes,
) {
  const permanentOptions = { ...options, permanentOnly: true, archetypes };
  const countingInput = {
    ...input,
    entries: resolveCharacterSheetGrants(input, permanentOptions)
      .countingEntries,
  };
  const { input: effectiveInput } = resolveSheetConditions({
    input: countingInput,
    permanentOnly: true,
  });
  const advancement = resolveAdvancement(effectiveInput, { archetypes });
  const { drainModifiers } = abilityChangesFor(
    effectiveInput.entries,
    permanentOptions,
  );
  const modifiers = [
    ...sourceCatalogModifiers(effectiveInput, permanentOptions),
    ...drainModifiers,
    ...advancement.modifiers,
  ].filter((modifier) => modifier.target.startsWith('ability.'));
  const context = calculationContext(
    effectiveInput,
    advancement,
    {},
    permanentOptions,
  );
  const breakdowns = emptyBreakdowns();
  for (const ability of abilityKeys) {
    const target = abilityTargets[ability];
    breakdowns[target] = resolveTarget(
      target,
      modifiers,
      context,
      breakdowns,
      formulaCache,
      [],
    );
  }
  return calculateAbilities(breakdowns, {});
}

function usesDexterityForCmb(size: ResolveOptions['size'] = 'medium') {
  return size === 'fine' || size === 'diminutive' || size === 'tiny';
}

function calculateDerivedStatistics(
  breakdowns: Record<LeafTarget, ResolvedStatistic>,
  abilities: ReturnType<typeof calculateAbilities>,
  options: ResolveOptions,
) {
  const specialSize = specialSizeModifiers[options.size ?? 'medium'];
  const derivedStatistics = deriveDefenses({
    breakdowns,
    strength: abilities.strength.modifier,
    dexterity: abilities.dexterity.modifier,
    specialSize,
    maxDexterityBonus: options.armorMaxDexterityBonus,
    deniedDexterityBy: options.deniedDexterityBy,
    flatFootedBy: options.flatFootedBy,
  });
  function dependentStatistic(
    target: LeafTarget,
    ability: Ability,
    name: string,
  ) {
    return composeStatistics({
      statistics: [breakdowns[target]],
      builtIns: [
        builtIn({
          target,
          id: `${target}-ability`,
          name,
          value: abilities[ability].modifier,
        }),
      ],
      includes: () => true,
      name: target,
    });
  }
  return {
    ...derivedStatistics,
    bab: breakdowns.bab,
    fortitude: dependentStatistic('save.fort', 'constitution', 'Constitution'),
    reflex: dependentStatistic('save.ref', 'dexterity', 'Dexterity'),
    will: dependentStatistic('save.will', 'wisdom', 'Wisdom'),
    initiative: dependentStatistic('init', 'dexterity', 'Dexterity'),
    cmb: composeStatistics({
      statistics: [breakdowns.bab, breakdowns.cmb],
      builtIns: [
        builtIn({
          target: 'cmb',
          id: 'cmb-ability',
          name: usesDexterityForCmb(options.size) ? 'Dexterity' : 'Strength',
          value: usesDexterityForCmb(options.size)
            ? abilities.dexterity.modifier
            : abilities.strength.modifier,
        }),
        ...(specialSize
          ? [
              builtIn({
                target: 'cmb',
                id: 'size-cmb',
                name: 'Size',
                value: specialSize,
              }),
            ]
          : []),
      ],
      includes: () => true,
      name: 'CMB',
    }),
  };
}

type SheetProjectionArgs = {
  recordedInput: CharacterSheetInput;
  resolveOptions: ResolveOptions;
  formulaCache: FormulaCache;
  archetypes: ResolvedCharacterSheetArchetypes;
  baseScores?: ReturnType<typeof baseScoresFor>;
  permanentIntelligence?: number;
  permanentAbilities?: Record<Ability, { score: number; modifier: number }>;
};

function prepareSheetCalculation({
  recordedInput,
  resolveOptions,
  countingEntries,
  archetypes,
}: {
  recordedInput: CharacterSheetInput;
  resolveOptions: ResolveOptions;
  countingEntries: readonly SheetEntry[];
  archetypes: ResolvedCharacterSheetArchetypes;
}) {
  const countingInput = {
    ...recordedInput,
    entries: countingEntries,
  };
  const racial = resolveCharacterSheetRacialFacts(countingInput);
  const options = {
    ...resolveOptions,
    size: resolveOptions.size ?? racial.size ?? undefined,
  };
  const race = countingInput.entries.find((entry) => entry.kind === 'race');
  const raceDefinition =
    race && 'catalogEntryId' in race
      ? recordedInput.catalogEntries.find(
          (entry) => entry._id === race.catalogEntryId,
        )
      : undefined;
  const raceDetail =
    raceDefinition?.detail?.kind === 'race' ? raceDefinition.detail : undefined;
  const input = {
    ...countingInput,
    racialHitDice:
      raceDetail && race?.state.kind === 'race'
        ? {
            count: raceDetail.racialHitDice ?? 0,
            hpGained: race.state.racialHpGained ?? null,
            progression: raceDetail.racialProgression,
          }
        : recordedInput.racialHitDice,
  };
  const conditions = resolveSheetConditions({
    input,
    permanentOnly: options.permanentOnly,
  });
  const effectiveInput = conditions.input;
  const proficiencies = resolveProficiencies(effectiveInput);
  const equipment = resolveEquipment({
    input: effectiveInput,
    proficiencies,
    permanentOnly: options.permanentOnly,
  });
  const weaponProficiencies = resolveWeaponProficiencies(
    effectiveInput,
    proficiencies,
    equipment,
    [...attackRoutineWeaponUses(effectiveInput), ...(options.weaponUses ?? [])],
  );
  const sourced = [
    ...sourceCatalogModifiers(effectiveInput, options),
    ...equipment.modifiers,
  ];
  const advancement = resolveAdvancement(effectiveInput, { archetypes });
  const { levels } = advancement;
  const { abilityDamage, drainModifiers } = abilityChangesFor(
    effectiveInput.entries,
    options,
  );
  const grappled = conditions.effects.find(
    (effect) => !effect.replacedBy && effect.conditionKey === 'grappled',
  );
  const invisible = conditions.effects.filter(
    (effect) => !effect.replacedBy && effect.conditionKey === 'invisible',
  );
  const invisibilityReason =
    'While grappled, invisibility grants only +2 CMD to avoid being grappled.';
  const conditionEffects = conditions.effects.map((effect) =>
    grappled && invisible.includes(effect)
      ? { ...effect, notes: [...effect.notes, invisibilityReason] }
      : effect,
  );
  const replacementSuppression = conditionEffects.flatMap((effect) => {
    if (!effect.replacedBy) return [];
    const winner = conditionEffects.find(
      (item) => item.sheetEntryId === effect.replacedBy,
    );
    return [
      {
        sheetEntryId: effect.sheetEntryId,
        suppressedBy: effect.replacedBy,
        reason: `Replaced by ${winner?.name ?? 'another condition'}.`,
        includesConditional: true,
      },
    ];
  });
  const conditionSuppression = [
    ...replacementSuppression,
    ...(grappled
      ? invisible.map((effect) => ({
          sheetEntryId: effect.sheetEntryId,
          suppressedBy: grappled.sheetEntryId,
          reason: invisibilityReason,
        }))
      : []),
  ];
  const context = calculationContext(
    effectiveInput,
    advancement,
    abilityDamage,
    {
      ...options,
      conditionSuppression,
      abilityPenaltyEntryIds: conditionEffects
        .filter((effect) => !effect.replacedBy)
        .map((effect) => effect.sheetEntryId),
    },
  );
  const dexCaps = [
    options.armorMaxDexterityBonus,
    equipment.maxDexterityBonus,
  ].filter((value): value is number => typeof value === 'number');
  const derivedOptions = {
    ...options,
    armorMaxDexterityBonus: dexCaps.length ? Math.min(...dexCaps) : undefined,
    deniedDexterityBy: conditions.deniedDexterityBy,
    flatFootedBy: conditionEffects.find(
      (effect) => !effect.replacedBy && effect.conditionKey === 'flat-footed',
    )?.sheetEntryId,
  };
  const size = specialSizeModifiers[options.size ?? 'medium'];
  if (size)
    sourced.push({
      ...builtIn({
        target: 'ac.other',
        id: 'size-ac',
        name: 'Size',
        value: -size,
      }),
      bonusType: 'size',
    });
  const modifiers = [...sourced, ...drainModifiers, ...advancement.modifiers];
  return {
    input,
    effectiveInput,
    racial,
    options,
    proficiencies,
    equipment,
    weaponProficiencies,
    advancement,
    levels,
    abilityDamage,
    conditionEffects,
    derivedOptions,
    modifiers,
    context,
  };
}

function calculateSheetProjection({
  recordedInput,
  resolveOptions,
  formulaCache,
  archetypes,
  baseScores = baseScoresFor(recordedInput),
  permanentIntelligence,
  permanentAbilities,
}: SheetProjectionArgs) {
  const { base, baseModifiers } = baseScores;
  const grants = resolveCharacterSheetGrants(recordedInput, {
    ...resolveOptions,
    archetypes,
  });
  const {
    input,
    effectiveInput,
    racial,
    options,
    proficiencies,
    equipment,
    weaponProficiencies,
    advancement,
    levels,
    abilityDamage,
    conditionEffects,
    derivedOptions,
    modifiers,
    context,
  } = prepareSheetCalculation({
    recordedInput,
    resolveOptions,
    countingEntries: grants.countingEntries,
    archetypes,
  });
  const {
    breakdowns,
    warnings: formulaWarnings,
    casting,
    dependentOptions,
  } = resolveCalculation(modifiers, context, formulaCache, levels, {
    input,
    abilityDamage,
    permanentAbilities,
  });
  const { spellcastings, spellcastingUnresolved } = casting;
  const { warnings: spellWarnings, ...spellCollections } =
    calculateSpellCollections({
      input: recordedInput,
      spellcastings,
    });
  const abilities = calculateAbilities(breakdowns, abilityDamage);
  const attackRoutines = resolveAttackRoutines({
    input: effectiveInput,
    recordedEntries: recordedInput.entries,
    abilities,
    breakdowns,
    weaponProficiencies: weaponProficiencies.weapons,
    routineWarningFingerprints: weaponProficiencies.routineWarningFingerprints,
    options: dependentOptions,
  });
  const skillProjection = resolveSkills({
    advancement,
    abilities,
    breakdowns,
    equipment,
  });
  const selectionRules = resolveCharacterSheetSelectionRules(effectiveInput, {
    grantsResolved: true,
  });
  const recordedFacts = new Map<string, PrerequisiteFacts>();
  const numericActivationIds = new Set(
    recordedInput.catalogEntries.flatMap((definition) =>
      definition.modifiers.flatMap((modifier) =>
        modifier.condition?.whileActive ? [modifier.condition.whileActive] : [],
      ),
    ),
  );
  const prerequisites = resolveCharacterSheetPrerequisites(
    recordedInput,
    effectiveInput,
    {
      abilities,
      bab: breakdowns.bab.total,
      companionLinkedInputs: options.companionLinkedInputs,
      skillRanks: Object.fromEntries(
        skillProjection.skills.map(({ key, ranks }) => [key, ranks]),
      ),
      casting,
    },
    (prefix): PrerequisiteFacts => {
      // Plain feats/traits do not change numeric facts. Preserve every numeric
      // contribution and conditional activation, including same-level Grants.
      const key = JSON.stringify(
        prefix.entries.filter((entry) => {
          if (entry.kind !== 'feat' && entry.kind !== 'trait') return true;
          const definition = prefix.catalogEntries.find(
            (row) => row._id === entry.catalogEntryId,
          );
          return (
            !definition ||
            definition.modifiers.length > 0 ||
            numericActivationIds.has(entry.catalogEntryId)
          );
        }),
      );
      const cached = recordedFacts.get(key);
      if (cached) return cached;
      const prepared = prepareSheetCalculation({
        recordedInput: prefix,
        resolveOptions: options,
        countingEntries: prefix.entries,
        archetypes: resolveCharacterSheetArchetypes(prefix),
      });
      const result = resolveCalculation(
        prepared.modifiers,
        prepared.context,
        formulaCache,
        prepared.levels,
        { input: prepared.input, abilityDamage: prepared.abilityDamage },
      );
      const prefixAbilities = calculateAbilities(
        result.breakdowns,
        prepared.abilityDamage,
      );
      const prefixSkills = resolveSkills({
        advancement: prepared.advancement,
        abilities: prefixAbilities,
        breakdowns: result.breakdowns,
        equipment: prepared.equipment,
      });
      const facts = {
        abilities: prefixAbilities,
        bab: result.breakdowns.bab.total,
        companionLinkedInputs: options.companionLinkedInputs,
        skillRanks: Object.fromEntries(
          prefixSkills.skills.map(({ key, ranks }) => [key, ranks]),
        ),
        casting: result.casting,
      };
      recordedFacts.set(key, facts);
      return facts;
    },
  );
  const hp =
    advancement.missingRacialHp ||
    levels.some((entry) => entry.state.hpGained === null)
      ? null
      : breakdowns.hp.total;
  const creationSettings = creationSettingsFor(base);
  const pointBuy = calculatePointBuy({
    baseModifiers,
    abilityMethod: creationSettings.abilityMethod,
  });
  const advancementResult = advancementBudgets({
    advancement,
    bonusSkillRanksPerLevel: racial.bonusSkillRanksPerLevel,
    intelligence:
      permanentIntelligence ??
      (options.permanentOnly
        ? abilities.intelligence.modifier
        : permanentIntelligenceFor(
            recordedInput,
            advancement,
            options,
            formulaCache,
            archetypes,
          )),
  });
  const calculationWarnings = [
    ...sheetWarnings({
      characterKind: input.characterKind,
      base,
      levels,
      baseModifiers,
      creationSettings,
      pointBuy,
      hp,
    }),
    ...advancementWarnings({
      characterKind: input.characterKind,
      advancement,
      classLevels: advancementResult.classLevels,
      favoredClassIds: base.state.favoredClassIds ?? [],
      favoredClassCount: input.favoredClassCount ?? racial.favoredClassCount,
      catalogEntries: input.catalogEntries,
    }),
    ...formulaWarnings,
    ...skillProjection.warnings,
    ...weaponProficiencies.warnings,
    ...attackRoutines.flatMap((routine) => routine.warnings),
    ...prerequisites.warnings,
    ...selectionRules.warnings,
    ...grants.warnings,
    ...archetypes.warnings,
    ...racialTraitWarnings(
      recordedInput,
      grants.allEntries,
      advancementResult.budgets.racialSkillRanks,
    ),
    ...spellWarnings,
  ];
  const warnings = calculationWarnings.filter(
    (warning) =>
      input.sheetMode !== 'militiaOnly' || warning.check === 'levelZero',
  );
  const dormantModifiers = sourceCatalogModifiers(
    {
      ...input,
      entries: grants.allEntries
        .filter((row) => row.dormant && !row.counting)
        .map(({ entry }) => ({ ...entry, active: true })),
    },
    options,
  );
  const dormantWarnings: SheetWarning[] = [];
  for (const modifier of dormantModifiers) {
    try {
      resolveModifierValue(
        modifier,
        dependentOptions,
        breakdowns,
        formulaCache,
      );
    } catch (error) {
      if (!(error instanceof FormulaError)) throw error;
      recordFormulaWarning(dormantWarnings, modifier, error);
    }
  }
  return {
    abilities,
    attackRoutines,
    spellcastings,
    spellCollections,
    spellcastingUnresolved,
    racial,
    archetypes,
    resolvedEntries: grants.entries.filter(
      ({ entry }) =>
        entry.kind !== 'base' &&
        entry.kind !== 'classLevel' &&
        entry.kind !== 'abilityDamage' &&
        entry.kind !== 'abilityDrain',
    ),
    skills: skillProjection.skills,
    equipment: {
      items: equipment.items,
      armorCheckPenalty: equipment.armorCheckPenalty,
      spellFailure: equipment.spellFailure,
      maxDexterityBonus: equipment.maxDexterityBonus,
      nonproficiencyAttackPenalty: equipment.nonproficiencyAttackPenalty,
    },
    proficiencies,
    weaponProficiencies: weaponProficiencies.weapons,
    proficiencyPrerequisites: prerequisites.proficiencyChecks,
    prerequisites: prerequisites.checks,
    selectionRules,
    conditionEffects,
    abilityModifierBreakdowns: calculateAbilityModifierBreakdowns(
      abilities,
      abilityDamage,
    ),
    level: levels.length,
    racialHitDice: advancement.racialHitDice,
    hitDice: advancement.hitDice,
    ...advancementResult,
    hp,
    creationSettings,
    pointBuy,
    calculationWarnings,
    warnings,
    warningsForAcceptance: [
      ...warnings,
      ...dormantWarnings,
      ...grants.warningsForAcceptance,
    ],
    breakdowns: { ...breakdowns, ...skillProjection.breakdowns },
    derivedStatistics: calculateDerivedStatistics(
      breakdowns,
      abilities,
      derivedOptions,
    ),
  };
}

export function calculateCharacterSheet(
  input: CharacterSheetInput,
  options: ResolveOptions = {},
) {
  const formulaCache: FormulaCache = new Map();
  const baseScores = baseScoresFor(input);
  const archetypes = resolveCharacterSheetArchetypes(input);
  if (options.permanentOnly)
    return calculateSheetProjection({
      recordedInput: input,
      resolveOptions: options,
      formulaCache,
      archetypes,
      baseScores,
    });
  const permanentAbilities = permanentAbilitiesFor(
    input,
    options,
    formulaCache,
    archetypes,
  );
  return calculateSheetProjection({
    recordedInput: input,
    resolveOptions: options,
    formulaCache,
    archetypes,
    baseScores,
    permanentIntelligence: permanentAbilities.intelligence.modifier,
    permanentAbilities,
  });
}

export function calculateCharacterSheetProjections(
  input: CharacterSheetInput,
  options: Omit<ResolveOptions, 'permanentOnly'> & {
    projectionInputs?: {
      current: Pick<
        ResolveOptions,
        | 'classLevels'
        | 'casterLevels'
        | 'arcaneCasterLevel'
        | 'preModifierCasterLevel'
        | 'companionLinkedInputs'
      >;
      permanent: Pick<
        ResolveOptions,
        | 'classLevels'
        | 'casterLevels'
        | 'arcaneCasterLevel'
        | 'preModifierCasterLevel'
        | 'companionLinkedInputs'
      >;
    };
  } = {},
) {
  const { projectionInputs, ...shared } = options;
  const formulaCache: FormulaCache = new Map();
  const baseScores = baseScoresFor(input);
  const archetypes = resolveCharacterSheetArchetypes(input);
  const permanent = calculateSheetProjection({
    recordedInput: input,
    resolveOptions: {
      ...shared,
      ...projectionInputs?.permanent,
      permanentOnly: true,
    },
    formulaCache,
    archetypes,
    baseScores,
  });
  return {
    current: calculateSheetProjection({
      recordedInput: input,
      resolveOptions: { ...shared, ...projectionInputs?.current },
      formulaCache,
      archetypes,
      baseScores,
      permanentIntelligence: permanent.abilities.intelligence.modifier,
      permanentAbilities: permanent.abilities,
    }),
    permanent,
  };
}

export function sheetWarnings({
  characterKind,
  base,
  levels,
  baseModifiers,
  creationSettings,
  pointBuy,
  hp,
}: {
  characterKind: 'pc' | 'npc';
  base: Extract<SheetEntry, { kind: 'base' }>;
  levels: readonly Extract<SheetEntry, { kind: 'classLevel' }>[];
  baseModifiers: readonly BaseModifier[];
  creationSettings: CreationSettings;
  pointBuy: ReturnType<typeof calculatePointBuy>;
  hp: number | null;
}): SheetWarning[] {
  const warnings: SheetWarning[] = [];
  function warn({
    facts,
    ...warning
  }: Omit<SheetWarning, 'fingerprint'> & { facts: unknown }) {
    warnings.push({ ...warning, fingerprint: JSON.stringify(facts) });
  }
  if (characterKind === 'pc' && levels.length === 0)
    warn({
      kind: 'rules',
      check: 'levelZero',
      subject: 'sheet',
      target: { kind: 'classLevels' },
      facts: ['pc', 0],
      message: 'A PC has no Class Levels.',
    });
  for (const entry of levels) {
    if (entry.state.classEntryId === null)
      warn({
        kind: 'incomplete',
        check: 'class',
        subject: entry._id,
        target: { kind: 'classLevel', entryId: entry._id, field: 'class' },
        facts: [null],
        message: 'Choose a class.',
      });
    if (entry.state.hpGained === null)
      warn({
        kind: 'incomplete',
        check: 'hpGainedMissing',
        subject: entry._id,
        target: { kind: 'classLevel', entryId: entry._id, field: 'hpGained' },
        facts: [null],
        message: 'Enter hit points gained.',
      });
    else if (entry.state.hpGained < 1)
      warn({
        kind: 'rules',
        check: 'hpGainedBelowMinimum',
        subject: entry._id,
        target: { kind: 'classLevel', entryId: entry._id, field: 'hpGained' },
        facts: [1, entry.state.hpGained],
        message: 'Hit points gained are below 1.',
      });
  }
  if (hp === null)
    warn({
      kind: 'unresolved',
      check: 'totalHpUnresolved',
      subject: 'sheet',
      target: { kind: 'hitPoints' },
      facts: levels
        .map((entry): [number, number | null] => [
          entry.state.position,
          entry.state.hpGained,
        ])
        .sort((a, b) => a[0] - b[0]),
      message: 'Hit points need the HP gained at every Class Level.',
    });
  if (creationSettings.abilityMethod.kind === 'pointBuy' && pointBuy) {
    const { spent } = pointBuy;
    const { budget } = creationSettings.abilityMethod;
    if (spent === null || spent > budget) {
      const scores = abilityKeys.map(
        (ability) =>
          baseModifiers.find(
            (modifier) => modifier.target === abilityTargets[ability],
          )?.value,
      );
      warn({
        kind: 'rules',
        check: 'pointBuy',
        subject: base._id,
        target: { kind: 'pointBuy' },
        facts: ['pointBuy', budget, scores],
        message:
          spent === null
            ? 'Point buy uses whole base scores from 7 to 18.'
            : `Base scores cost ${spent} points, above the ${budget}-point budget.`,
      });
    }
  }
  return warnings;
}

export const personalBonusTypes = [
  'alchemical',
  'armor',
  'circumstance',
  'competence',
  'deflection',
  'dodge',
  'enhancement',
  'inherent',
  'insight',
  'luck',
  'morale',
  'naturalArmor',
  'profane',
  'racial',
  'resistance',
  'sacred',
  'shield',
  'size',
  'trait',
  'untyped',
] as const;
export const bonusTypes = [...personalBonusTypes, 'base'] as const;
export type BonusType = (typeof bonusTypes)[number];
const skillTargets = [
  'skill.acr',
  'skill.apr',
  'skill.blf',
  'skill.clm',
  'skill.crf',
  'skill.dip',
  'skill.dev',
  'skill.dis',
  'skill.esc',
  'skill.fly',
  'skill.han',
  'skill.hea',
  'skill.int',
  'skill.kar',
  'skill.kdu',
  'skill.ken',
  'skill.kge',
  'skill.khi',
  'skill.klo',
  'skill.kna',
  'skill.kno',
  'skill.kpl',
  'skill.kre',
  'skill.lin',
  'skill.per',
  'skill.prf',
  'skill.pro',
  'skill.rid',
  'skill.sen',
  'skill.slt',
  'skill.spl',
  'skill.ste',
  'skill.sur',
  'skill.swm',
  'skill.umd',
] as const;
export const leafTargets = [
  'ability.str',
  'ability.dex',
  'ability.con',
  'ability.int',
  'ability.wis',
  'ability.cha',
  'ac.armor',
  'ac.shield',
  'ac.natural',
  'ac.other',
  'save.fort',
  'save.ref',
  'save.will',
  ...skillTargets,
  'bab',
  'attack.melee',
  'attack.ranged',
  'damage.melee',
  'damage.ranged',
  'cmb',
  'cmd',
  'init',
  'hp',
  'casterLevel',
  'spellDC',
  'concentration',
] as const;
export const modifierTargets = [
  ...leafTargets,
  'ac',
  'saves',
  'skills',
  'attack',
  'damage',
] as const;
export const catalogModifierTargets = [
  ...modifierTargets,
  'ability.$choice',
] as const;
export type CatalogModifier = Omit<Modifier, 'target'> & {
  target: (typeof catalogModifierTargets)[number];
};
export type ModifierTarget = (typeof modifierTargets)[number];
export type LeafTarget = (typeof leafTargets)[number];
const situationSchema = z.union([
  z.string(),
  z.object({ local: z.string() }),
  z.object({ option: z.string() }),
]);
export const modifierConditionSchema = z.object({
  situation: situationSchema.optional(),
  whileActive: z.string().optional(),
  castingClass: z.string().optional(),
  school: z.string().optional(),
});
export type Situation = z.infer<typeof situationSchema>;
export type Modifier = {
  target: ModifierTarget;
  bonusType: BonusType;
  value: number | { formula: string };
  condition?: z.infer<typeof modifierConditionSchema>;
  stacksWithinEntry?: true;
};
export type InputSourcedModifier = Modifier & {
  modifierIndex?: number;
  effectCasterLevel?: number;
  sheetEntryId: string;
  entryName: string;
  source: string;
  builtIn: boolean;
  stacksWithItself?: boolean;
};
export type SourcedModifier = Omit<InputSourcedModifier, 'value'> & {
  value: number;
  sheetEntryId: string;
  entryName: string;
  source: string;
  builtIn: boolean;
  stacksWithItself?: boolean;
};
export type SuppressedModifier = SourcedModifier & {
  reason: string;
  suppressedBy: string;
};
export type ResolvedStatistic = {
  total: number;
  applied: SourcedModifier[];
  suppressed: SuppressedModifier[];
  conditional: SourcedModifier[];
};
const parentTargets: Partial<Record<ModifierTarget, readonly LeafTarget[]>> = {
  ac: ['ac.other'],
  saves: ['save.fort', 'save.ref', 'save.will'],
  skills: skillTargets,
  attack: ['attack.melee', 'attack.ranged'],
  damage: ['damage.melee', 'damage.ranged'],
};

function groupBy<T>(items: readonly T[], key: (item: T) => string) {
  const groups = new Map<string, [T, ...T[]]>();
  for (const item of items) {
    const name = key(item);
    const group = groups.get(name);
    if (group) group.push(item);
    else groups.set(name, [item]);
  }
  return [...groups.values()];
}

type EntryContributions = [SourcedModifier, ...SourcedModifier[]];
type Suppress = (
  items: SourcedModifier[],
  winner: SourcedModifier,
  reason: string,
) => void;

function suppressWithinEntry(
  modifiers: SourcedModifier[],
  suppress: Suppress,
): EntryContributions[] {
  return groupBy(modifiers, (item) => item.sheetEntryId)
    .map((entry) =>
      groupBy(entry, (item) => `${item.bonusType}:${item.value < 0}`).flatMap(
        (group) => {
          const unmarked = group.filter((item) => !item.stacksWithinEntry);
          const winner = unmarked.reduce<SourcedModifier | undefined>(
            (best, item) =>
              !best || Math.abs(item.value) > Math.abs(best.value)
                ? item
                : best,
            undefined,
          );
          if (winner)
            suppress(
              unmarked.filter((item) => item !== winner),
              winner,
              'A stronger contribution from this entry applies.',
            );
          return [
            ...(winner ? [winner] : []),
            ...group.filter((item) => item.stacksWithinEntry),
          ];
        },
      ),
    )
    .filter(
      (entry): entry is [SourcedModifier, ...SourcedModifier[]] =>
        entry.length > 0,
    );
}

function keepStrongestPerSource(
  entries: EntryContributions[],
  suppress: Suppress,
) {
  return groupBy(entries, (entry) =>
    JSON.stringify([
      entry[0].source,
      entry[0].stacksWithItself ? entry[0].sheetEntryId : null,
    ]),
  ).flatMap((source) => {
    const net = (entry: SourcedModifier[]) =>
      entry.reduce((sum, item) => sum + item.value, 0);
    const penaltiesOnly = source.every((entry) => net(entry) <= 0);
    const winner = source.reduce((best, entry) =>
      (penaltiesOnly ? net(entry) < net(best) : net(entry) > net(best))
        ? entry
        : best,
    );
    for (const entry of source) {
      if (entry !== winner)
        suppress(
          entry,
          winner[0],
          'A stronger entry from the same Source applies.',
        );
    }
    return winner;
  });
}

function typeStacks(modifier: SourcedModifier) {
  return modifier.value < 0
    ? modifier.bonusType === 'untyped'
    : ['dodge', 'racial', 'untyped', 'circumstance'].includes(
        modifier.bonusType,
      );
}

function stackByType(modifiers: SourcedModifier[], suppress: Suppress) {
  return groupBy(
    modifiers,
    (item) => `${item.bonusType}:${item.value < 0}`,
  ).flatMap((group) => {
    const first = group[0];
    if (typeStacks(first)) return group;
    const candidates = groupBy(group, (item) => item.sheetEntryId);
    const winner = candidates.reduce((best, entry) =>
      Math.abs(entry.reduce((sum, item) => sum + item.value, 0)) >
      Math.abs(best.reduce((sum, item) => sum + item.value, 0))
        ? entry
        : best,
    );
    suppress(
      group.filter((item) => !winner.includes(item)),
      winner[0],
      first.value < 0
        ? 'A worse penalty of this type applies.'
        : 'A higher bonus of this type applies.',
    );
    return winner;
  });
}

function resolveStatistic(modifiers: SourcedModifier[]): ResolvedStatistic {
  const suppressed: SuppressedModifier[] = [];
  const suppress: Suppress = (items, winner, reason) => {
    suppressed.push(
      ...items.map((item) => ({
        ...item,
        reason,
        suppressedBy: winner.sheetEntryId,
      })),
    );
  };
  const entries = suppressWithinEntry(modifiers, suppress);
  const sourceWinners = keepStrongestPerSource(entries, suppress);
  const applied = stackByType(sourceWinners, suppress);
  return {
    total: applied.reduce((sum, item) => sum + item.value, 0),
    applied,
    suppressed,
    conditional: [],
  };
}

export const specialSizeModifiers = {
  fine: -8,
  diminutive: -4,
  tiny: -2,
  small: -1,
  medium: 0,
  large: 1,
  huge: 2,
  gargantuan: 4,
  colossal: 8,
};
export type ResolveOptions = {
  companionLinkedInputs?: readonly CompanionLinkedInputResolution[];
  size?: CreatureSize;
  weaponUses?: readonly {
    entryId: string;
    hands: AttackRoutineState['hands'];
    attack?: 'melee' | 'ranged';
  }[];
  armorMaxDexterityBonus?: number;
  deniedDexterityBy?: string;
  flatFootedBy?: string;
  permanentOnly?: boolean;
  level?: number;
  hitDice?: number;
  classLevels?: Readonly<Record<string, number>>;
  casterLevels?: Readonly<Record<string, number>>;
  unresolvedCasterLevels?: readonly string[];
  arcaneCasterLevel?: number;
  arcaneCasterLevelUnresolved?: boolean;
  preModifierCasterLevel?: number;
  castingClass?: string;
  school?: string;
  abilityDamage?: Partial<Record<Ability, number>>;
  abilityPenaltyEntryIds?: readonly string[];
  conditionSuppression?: readonly {
    sheetEntryId: string;
    suppressedBy: string;
    reason: string;
    includesConditional?: boolean;
  }[];
  situations?: readonly (
    | string
    | { local: string; sheetEntryId: string }
    | { option: string }
  )[];
  activeCatalogEntryIds?: readonly string[];
};

function conditionApplies(
  modifier: InputSourcedModifier,
  options: ResolveOptions,
) {
  const condition = modifier.condition;
  if (!condition) return true;
  if (condition.castingClass && condition.castingClass !== options.castingClass)
    return false;
  if (condition.school && condition.school !== options.school) return false;
  if (
    condition.whileActive &&
    !options.activeCatalogEntryIds?.includes(condition.whileActive)
  )
    return false;
  const situation = condition.situation;
  if (!situation) return true;
  return (
    options.situations?.some((selected) => {
      if (typeof situation === 'string') return selected === situation;
      if (typeof selected === 'string') return false;
      if ('local' in situation)
        return (
          'local' in selected &&
          selected.local === situation.local &&
          selected.sheetEntryId === modifier.sheetEntryId
        );
      return 'option' in selected && selected.option === situation.option;
    }) ?? false
  );
}

function expandModifier(
  modifier: InputSourcedModifier,
): InputSourcedModifier[] {
  if (modifier.target === 'ac') {
    const target: LeafTarget =
      modifier.bonusType === 'armor'
        ? 'ac.armor'
        : modifier.bonusType === 'shield'
          ? 'ac.shield'
          : modifier.bonusType === 'naturalArmor'
            ? 'ac.natural'
            : 'ac.other';
    return [{ ...modifier, target }];
  }
  const targets = parentTargets[modifier.target];
  return targets
    ? targets.map((target) => ({ ...modifier, target }))
    : [modifier];
}

const calculationStages = {
  input: 0,
  abilityScore: 1,
  abilityModifier: 2,
  classBase: 3,
  casterLevel: 4,
  dependent: 5,
} as const;

export function targetStage(target: string) {
  if (target.startsWith('ability.')) return calculationStages.abilityScore;
  if (target === 'bab') return calculationStages.classBase;
  if (target === 'casterLevel') return calculationStages.casterLevel;
  return calculationStages.dependent;
}

function emptyStatistic(): ResolvedStatistic {
  return { total: 0, applied: [], suppressed: [], conditional: [] };
}

function emptyBreakdowns(): Record<LeafTarget, ResolvedStatistic> {
  return {
    'ability.str': emptyStatistic(),
    'ability.dex': emptyStatistic(),
    'ability.con': emptyStatistic(),
    'ability.int': emptyStatistic(),
    'ability.wis': emptyStatistic(),
    'ability.cha': emptyStatistic(),
    'ac.armor': emptyStatistic(),
    'ac.shield': emptyStatistic(),
    'ac.natural': emptyStatistic(),
    'ac.other': emptyStatistic(),
    'save.fort': emptyStatistic(),
    'save.ref': emptyStatistic(),
    'save.will': emptyStatistic(),
    'skill.acr': emptyStatistic(),
    'skill.apr': emptyStatistic(),
    'skill.blf': emptyStatistic(),
    'skill.clm': emptyStatistic(),
    'skill.crf': emptyStatistic(),
    'skill.dip': emptyStatistic(),
    'skill.dev': emptyStatistic(),
    'skill.dis': emptyStatistic(),
    'skill.esc': emptyStatistic(),
    'skill.fly': emptyStatistic(),
    'skill.han': emptyStatistic(),
    'skill.hea': emptyStatistic(),
    'skill.int': emptyStatistic(),
    'skill.kar': emptyStatistic(),
    'skill.kdu': emptyStatistic(),
    'skill.ken': emptyStatistic(),
    'skill.kge': emptyStatistic(),
    'skill.khi': emptyStatistic(),
    'skill.klo': emptyStatistic(),
    'skill.kna': emptyStatistic(),
    'skill.kno': emptyStatistic(),
    'skill.kpl': emptyStatistic(),
    'skill.kre': emptyStatistic(),
    'skill.lin': emptyStatistic(),
    'skill.per': emptyStatistic(),
    'skill.prf': emptyStatistic(),
    'skill.pro': emptyStatistic(),
    'skill.rid': emptyStatistic(),
    'skill.sen': emptyStatistic(),
    'skill.slt': emptyStatistic(),
    'skill.spl': emptyStatistic(),
    'skill.ste': emptyStatistic(),
    'skill.sur': emptyStatistic(),
    'skill.swm': emptyStatistic(),
    'skill.umd': emptyStatistic(),
    bab: emptyStatistic(),
    'attack.melee': emptyStatistic(),
    'attack.ranged': emptyStatistic(),
    'damage.melee': emptyStatistic(),
    'damage.ranged': emptyStatistic(),
    cmb: emptyStatistic(),
    cmd: emptyStatistic(),
    init: emptyStatistic(),
    hp: emptyStatistic(),
    casterLevel: emptyStatistic(),
    spellDC: emptyStatistic(),
    concentration: emptyStatistic(),
  };
}

class FormulaDependencyError extends FormulaError {}

function readNamedLevel(
  name: string,
  key: string,
  levels: Readonly<Record<string, number>> = {},
) {
  if (Object.hasOwn(levels, key)) return levels[key] ?? 0;
  if (key in levels)
    throw new FormulaError(`${name} is not a supported variable.`);
  return 0;
}

type FormulaContext = {
  name: string;
  modifier: InputSourcedModifier;
  options: ResolveOptions;
  breakdowns: Record<LeafTarget, ResolvedStatistic>;
};

type VariableRule = {
  match: (name: string) => boolean;
  stage: number;
  read: (context: FormulaContext) => number;
};

const abilityVariables: Readonly<Record<string, Ability | undefined>> = {
  '@ability.str.mod': 'strength',
  '@ability.dex.mod': 'dexterity',
  '@ability.con.mod': 'constitution',
  '@ability.int.mod': 'intelligence',
  '@ability.wis.mod': 'wisdom',
  '@ability.cha.mod': 'charisma',
};

const variableRules: readonly VariableRule[] = [
  {
    match: (name) => name === '@level',
    stage: calculationStages.input,
    read: ({ options }) => options.level ?? 0,
  },
  {
    match: (name) => /^@classLevel\.[A-Za-z][A-Za-z0-9_.]*$/.test(name),
    stage: calculationStages.input,
    read: ({ name, options }) =>
      readNamedLevel(
        name,
        name.slice('@classLevel.'.length),
        options.classLevels,
      ),
  },
  {
    match: (name) => name === '@hitDice',
    stage: calculationStages.classBase,
    read: ({ options }) => options.hitDice ?? 0,
  },
  {
    match: (name) => name === '@bab',
    stage: calculationStages.classBase,
    read: ({ breakdowns }) => breakdowns.bab.total,
  },
  {
    match: (name) => Object.hasOwn(abilityVariables, name),
    stage: calculationStages.abilityModifier,
    read: ({ name, breakdowns, options }) => {
      const ability = abilityVariables[name];
      if (!ability) throw new FormulaError('Unsupported ability.');
      return abilityValue(ability, breakdowns, options.abilityDamage ?? {})
        .modifier;
    },
  },
  {
    match: (name) => name === '@casterLevel',
    stage: calculationStages.input,
    read: ({ modifier, options }) => {
      if (modifier.effectCasterLevel !== undefined)
        return modifier.effectCasterLevel;
      if (modifier.target === 'casterLevel')
        return options.preModifierCasterLevel ?? 0;
      throw new FormulaError(
        '@casterLevel is supported only on a Spell Effect or caster-level Modifier.',
      );
    },
  },
  {
    match: (name) => /^@casterLevel\.[A-Za-z][A-Za-z0-9_.]*$/.test(name),
    stage: calculationStages.casterLevel,
    read: ({ name, options }) => {
      const key = name.slice('@casterLevel.'.length);
      if (
        key === 'arcane'
          ? options.arcaneCasterLevelUnresolved
          : options.unresolvedCasterLevels?.includes(key)
      )
        throw new FormulaError(
          `${name} depends on an unresolved caster level.`,
        );
      return key === 'arcane'
        ? (options.arcaneCasterLevel ?? 0)
        : readNamedLevel(name, key, options.casterLevels);
    },
  },
];

function resolveVariable(context: FormulaContext): number {
  const rule = variableRules.find((rule) => rule.match(context.name));
  if (!rule)
    throw new FormulaError(`${context.name} is not a supported variable.`);
  if (rule.stage >= targetStage(context.modifier.target))
    throw new FormulaDependencyError(
      `${context.name} depends on its own result or a statistic calculated later.`,
    );
  return rule.read(context);
}

function cachedFormula(expression: string, cache: FormulaCache) {
  const cached = cache.get(expression);
  if (cached instanceof FormulaError) throw cached;
  if (cached) return cached;
  try {
    const parsed = parseFormula(expression);
    cache.set(expression, parsed);
    return parsed;
  } catch (error) {
    if (error instanceof FormulaError) cache.set(expression, error);
    throw error;
  }
}

function resolveModifierValue(
  modifier: InputSourcedModifier,
  options: ResolveOptions,
  breakdowns: Record<LeafTarget, ResolvedStatistic>,
  formulaCache: FormulaCache,
) {
  if (typeof modifier.value === 'number') return modifier.value;
  return evaluateFormula(
    cachedFormula(modifier.value.formula, formulaCache),
    (name) => resolveVariable({ name, modifier, options, breakdowns }),
  );
}

function recordFormulaWarning(
  warnings: SheetWarning[],
  modifier: InputSourcedModifier,
  error: FormulaError,
) {
  const warning: SheetWarning = {
    kind: 'rules',
    check:
      error instanceof FormulaDependencyError
        ? 'formulaDependency'
        : 'unsupportedFormula',
    subject: `${modifier.sheetEntryId}:${modifier.modifierIndex ?? 0}`,
    target: {
      kind: 'modifier',
      entryId: modifier.sheetEntryId,
      modifierIndex: modifier.modifierIndex ?? 0,
    },
    fingerprint: JSON.stringify([
      modifier.target,
      modifier.value,
      error.message,
    ]),
    message: `This Modifier contributes nothing. ${error.message}`,
  };
  if (
    !warnings.some(
      (item) =>
        item.subject === warning.subject && item.check === warning.check,
    )
  )
    warnings.push(warning);
}

function resolveTarget(
  target: LeafTarget,
  modifiers: readonly InputSourcedModifier[],
  options: ResolveOptions,
  breakdowns: Record<LeafTarget, ResolvedStatistic>,
  formulaCache: FormulaCache,
  warnings: SheetWarning[],
): ResolvedStatistic {
  const active: SourcedModifier[] = [];
  const conditional: SourcedModifier[] = [];
  const conditionSuppressed: SuppressedModifier[] = [];
  for (const modifier of modifiers.filter((item) => item.target === target)) {
    try {
      const value = resolveModifierValue(
        modifier,
        options,
        breakdowns,
        formulaCache,
      );
      const {
        modifierIndex: _index,
        effectCasterLevel: _casterLevel,
        ...displayModifier
      } = modifier;
      const resolved = { ...displayModifier, value };
      const suppression = options.conditionSuppression?.find(
        (item) => item.sheetEntryId === modifier.sheetEntryId,
      );
      if (
        !suppression?.includesConditional &&
        !conditionApplies(modifier, options)
      )
        conditional.push(resolved);
      else if (suppression)
        conditionSuppressed.push({
          ...resolved,
          reason: suppression.reason,
          suppressedBy: suppression.suppressedBy,
        });
      else active.push(resolved);
    } catch (error) {
      if (!(error instanceof FormulaError)) throw error;
      recordFormulaWarning(warnings, modifier, error);
    }
  }
  const statistic = resolveStatistic(active);
  statistic.suppressed.push(...conditionSuppressed);
  if (target.startsWith('ability.')) {
    const penalties = statistic.applied.filter(
      (modifier) =>
        modifier.value < 0 &&
        options.abilityPenaltyEntryIds?.includes(modifier.sheetEntryId),
    );
    const penalty = penalties.reduce(
      (sum, modifier) => sum + modifier.value,
      0,
    );
    const otherScore = statistic.total - penalty;
    const limitedPenalty = Math.max(penalty, -Math.max(0, otherScore - 1));
    if (limitedPenalty !== penalty) {
      statistic.applied.push(
        builtIn({
          target,
          id: `condition-score-floor:${target}`,
          name: 'Condition penalty minimum score',
          value: limitedPenalty - penalty,
        }),
      );
      statistic.total = otherScore + limitedPenalty;
    }
  }
  return { ...statistic, conditional };
}

function resolveCalculation(
  modifiers: readonly InputSourcedModifier[],
  options: ResolveOptions,
  formulaCache: FormulaCache = new Map(),
  levels: readonly ClassLevelEntry[] = [],
  castingInput?: {
    input: CharacterSheetInput;
    abilityDamage: Partial<Record<Ability, number>>;
    permanentAbilities?: Record<Ability, { score: number; modifier: number }>;
  },
) {
  const expanded = modifiers.flatMap(expandModifier);
  const breakdowns = emptyBreakdowns();
  const warnings: SheetWarning[] = [];
  const orderedTargets = [...leafTargets].sort(
    (a, b) => targetStage(a) - targetStage(b),
  );
  function resolveTargets(
    targets: readonly LeafTarget[],
    context: ResolveOptions,
  ) {
    for (const target of targets) {
      if (target === 'hp')
        expanded.push(...builtInHpModifiers(levels, breakdowns, context));
      breakdowns[target] = resolveTarget(
        target,
        expanded,
        context,
        breakdowns,
        formulaCache,
        warnings,
      );
    }
  }
  resolveTargets(
    orderedTargets.filter(
      (target) => targetStage(target) < calculationStages.dependent,
    ),
    options,
  );
  const casting: ReturnType<typeof calculateSpellcastings> = castingInput
    ? calculateSpellcastings({
        input: castingInput.input,
        modifiers,
        options,
        abilities: calculateAbilities(breakdowns, castingInput.abilityDamage),
        permanentAbilities: castingInput.permanentAbilities,
        resolve: (target, contributions, scoped) => {
          const localWarnings: SheetWarning[] = [];
          const statistic = resolveTarget(
            target,
            contributions,
            scoped,
            breakdowns,
            formulaCache,
            localWarnings,
          );
          for (const warning of localWarnings) {
            if (
              !warnings.some(
                (item) =>
                  item.subject === warning.subject &&
                  item.check === warning.check,
              )
            )
              warnings.push(warning);
          }
          return {
            statistic,
            warnings: localWarnings.filter((warning) =>
              contributions.some(
                (modifier) =>
                  modifier.target === target &&
                  `${modifier.sheetEntryId}:${modifier.modifierIndex ?? 0}` ===
                    warning.subject &&
                  conditionApplies(modifier, scoped) &&
                  !scoped.conditionSuppression?.some(
                    (suppression) =>
                      suppression.sheetEntryId === modifier.sheetEntryId,
                  ),
              ),
            ),
          };
        },
      })
    : {
        spellcastings: [],
        spellcastingUnresolved: [],
        casterLevels: {},
        arcaneCasterLevel: undefined,
        unresolvedCasterLevels: [],
        arcaneCasterLevelUnresolved: false,
      };
  const dependentOptions: ResolveOptions = {
    ...options,
    casterLevels: { ...casting.casterLevels, ...options.casterLevels },
    arcaneCasterLevel: options.arcaneCasterLevel ?? casting.arcaneCasterLevel,
    unresolvedCasterLevels: [
      ...(options.unresolvedCasterLevels ?? []),
      ...casting.unresolvedCasterLevels,
    ],
    arcaneCasterLevelUnresolved:
      (options.arcaneCasterLevelUnresolved ?? false) ||
      casting.arcaneCasterLevelUnresolved,
  };
  resolveTargets(
    orderedTargets.filter(
      (target) => targetStage(target) === calculationStages.dependent,
    ),
    dependentOptions,
  );
  return { breakdowns, warnings, casting, dependentOptions };
}

export function resolveSheet(
  modifiers: readonly InputSourcedModifier[],
  options: ResolveOptions = {},
): Record<LeafTarget, ResolvedStatistic> {
  return resolveCalculation(modifiers, options).breakdowns;
}

export function builtIn({
  target,
  id,
  name,
  value,
  sheetEntryId = `builtin:${id}`,
  isBase = false,
}: {
  target: ModifierTarget;
  id: string;
  name: string;
  value: number;
  sheetEntryId?: string;
  isBase?: boolean;
}): SourcedModifier {
  return {
    target,
    value,
    bonusType: isBase ? 'base' : 'untyped',
    sheetEntryId,
    entryName: name,
    source: sheetEntryId,
    builtIn: true,
  };
}

export function composeStatistics({
  statistics,
  builtIns,
  includes,
  name,
}: {
  statistics: ResolvedStatistic[];
  builtIns: SourcedModifier[];
  includes: (modifier: SourcedModifier) => boolean;
  name: string;
}): ResolvedStatistic {
  const contributions = [
    ...builtIns,
    ...statistics.flatMap((statistic) => statistic.applied),
  ];
  const applied = contributions.filter(includes);
  return {
    total: applied.reduce((sum, item) => sum + item.value, 0),
    applied,
    suppressed: [
      ...statistics.flatMap((statistic) => statistic.suppressed),
      ...contributions
        .filter((item) => !includes(item))
        .map((item) => ({
          ...item,
          reason: `Does not apply to ${name}.`,
          suppressedBy: `builtin:${name}`,
        })),
    ],
    conditional: statistics
      .flatMap((statistic) => statistic.conditional)
      .filter(includes),
  };
}

function stackCmd(statistic: ResolvedStatistic): ResolvedStatistic {
  const suppressed = [...statistic.suppressed];
  const suppress: Suppress = (items, winner, reason) => {
    suppressed.push(
      ...items.map((item) => ({
        ...item,
        reason,
        suppressedBy: winner.sheetEntryId,
      })),
    );
  };
  // Leaves have already resolved Sources; only competing CMD types are rechecked.
  const nonstacking = statistic.applied.filter((item) => !typeStacks(item));
  const entries = suppressWithinEntry(nonstacking, suppress).flat();
  const applied = stackByType(
    [...statistic.applied.filter(typeStacks), ...entries],
    suppress,
  );
  return {
    ...statistic,
    total: applied.reduce((sum, item) => sum + item.value, 0),
    applied,
    suppressed,
  };
}

function deriveDefenses({
  breakdowns,
  strength,
  dexterity,
  specialSize,
  maxDexterityBonus,
  deniedDexterityBy,
  flatFootedBy,
}: {
  breakdowns: Record<LeafTarget, ResolvedStatistic>;
  strength: number;
  dexterity: number;
  specialSize: number;
  maxDexterityBonus?: number;
  deniedDexterityBy?: string;
  flatFootedBy?: string;
}) {
  const acLeaves = [
    breakdowns['ac.armor'],
    breakdowns['ac.shield'],
    breakdowns['ac.natural'],
    breakdowns['ac.other'],
  ];
  const acBase = [
    builtIn({ target: 'ac.other', id: 'base-ac', name: 'Base AC', value: 10 }),
    builtIn({
      target: 'ac.other',
      id: 'dexterity',
      name:
        maxDexterityBonus !== undefined && dexterity > maxDexterityBonus
          ? `Dexterity (armor maximum +${maxDexterityBonus})`
          : 'Dexterity',
      value: Math.min(dexterity, maxDexterityBonus ?? Infinity),
    }),
  ];
  const losesDexBonus = (item: SourcedModifier) =>
    item.sheetEntryId === 'builtin:dexterity' && item.value > 0;
  const denied = (item: SourcedModifier) =>
    Boolean(deniedDexterityBy) &&
    (losesDexBonus(item) || (item.bonusType === 'dodge' && item.value > 0));
  function explainDeniedDexterity(
    statistic: ResolvedStatistic,
  ): ResolvedStatistic {
    return {
      ...statistic,
      suppressed: statistic.suppressed.map((modifier) =>
        denied(modifier)
          ? {
              ...modifier,
              suppressedBy: deniedDexterityBy ?? modifier.suppressedBy,
              reason:
                'Dexterity bonus and dodge bonuses are denied by this condition.',
            }
          : modifier,
      ),
    };
  }
  const ac = explainDeniedDexterity(
    composeStatistics({
      statistics: acLeaves,
      builtIns: acBase,
      includes: (item) => !denied(item),
      name: 'AC',
    }),
  );
  const touchAc = explainDeniedDexterity(
    composeStatistics({
      statistics: acLeaves,
      builtIns: acBase,
      includes: (item) =>
        !denied(item) &&
        item.target === 'ac.other' &&
        !['armor', 'shield', 'naturalArmor'].includes(item.bonusType),
      name: 'touch AC',
    }),
  );
  const flatFootedAc = composeStatistics({
    statistics: acLeaves,
    builtIns: acBase,
    includes: (item) =>
      !losesDexBonus(item) && !(item.bonusType === 'dodge' && item.value > 0),
    name: 'flat-footed AC',
  });
  const cmdAc = composeStatistics({
    statistics: acLeaves,
    builtIns: [],
    includes: (item) =>
      (item.value < 0 && item.bonusType !== 'size') ||
      [
        'circumstance',
        'deflection',
        'dodge',
        'insight',
        'luck',
        'morale',
        'profane',
        'sacred',
      ].includes(item.bonusType),
    name: 'CMD',
  });
  const cmdBase = [
    builtIn({ target: 'cmd', id: 'base-cmd', name: 'Base CMD', value: 10 }),
    builtIn({
      target: 'cmd',
      id: 'strength',
      name: 'Strength',
      value: strength,
    }),
    builtIn({
      target: 'cmd',
      id: 'dexterity',
      name: 'Dexterity',
      value: dexterity,
    }),
    ...(specialSize
      ? [
          builtIn({
            target: 'cmd',
            id: 'size-cmd',
            name: 'Size',
            value: specialSize,
          }),
        ]
      : []),
  ];
  const cmd = stackCmd(
    composeStatistics({
      statistics: [cmdAc, breakdowns.cmd, breakdowns.bab],
      builtIns: cmdBase,
      includes: (item) => !(flatFootedBy && losesDexBonus(item)),
      name: 'CMD',
    }),
  );
  const flatFootedCmd = stackCmd(
    composeStatistics({
      statistics: [cmdAc, breakdowns.cmd, breakdowns.bab],
      builtIns: cmdBase,
      includes: (item) => !losesDexBonus(item),
      name: 'flat-footed CMD',
    }),
  );
  return { ac, touchAc, flatFootedAc, cmd, flatFootedCmd };
}
