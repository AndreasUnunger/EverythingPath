import type { Infer, GenericId } from 'convex/values';
import type { characterSheetEntryValidator } from '../../convex/schema';
import { z } from 'zod';
import { resolveCharacterSheetGrants } from './character-sheet-grants';
import { resolveSkills } from './character-sheet-skills';
import {
  resolveSheetConditions,
  type ConditionKey,
} from './character-sheet-conditions';
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

export const abilityKeys = [
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
] as const;
export type Ability = (typeof abilityKeys)[number];
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
  counterpartOf?: string;
  hitDie: number;
  bab: 'full' | 'threeQuarters' | 'half';
  saves: Record<'fort' | 'ref' | 'will', 'good' | 'poor'>;
  skillRanksPerLevel: number;
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
  modifiers: readonly Modifier[];
  detail?: SheetCatalogEntryDetail;
  grants?: readonly { catalogEntryId: string }[];
  grantsSlots?: readonly {
    kind: 'feat' | 'trait';
    count: number;
    featTypes?: readonly string[];
    feats?: readonly string[];
    ignoresPrerequisites?: boolean;
  }[];
};
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

export type SheetCatalogEntryDetail =
  | { kind: 'race'; racialTraits: readonly string[] }
  | {
      kind: 'racialTrait';
      raceEntryIds: readonly string[];
      replaces: readonly string[];
    }
  | {
      kind: 'archetype';
      classEntryIds: readonly string[];
      replaces: readonly { classLevel: number; catalogEntryId: string }[];
      adds: readonly { classLevel: number; catalogEntryId: string }[];
      picksByLevel?: readonly {
        classLevel: number;
        list: string;
        count: number;
      }[];
    }
  | {
      kind: 'classFeature';
      picksByLevel?: readonly {
        classLevel: number;
        list: string;
        count: number;
      }[];
    }
  | { kind: 'feat' | 'trait' }
  | {
      kind: 'spellEffect';
      lastsOverOneDay?: boolean;
      defaultCasterLevel?: number;
    }
  | {
      kind: 'item';
      consumable?: boolean;
      armor?: { slot: 'armor' | 'shield'; armorCheckPenalty: number };
    }
  | CharacterSheetClassDetail
  | { kind: 'class' }
  | { kind: 'condition'; conditionKey?: ConditionKey }
  | { kind: 'base' | 'manual' | 'spell' };

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
  sheetMode?: 'militiaOnly' | 'full';
  characterKind: 'pc' | 'npc';
  entries: readonly SheetEntry[];
  catalogEntries: readonly CharacterSheetCatalogEntry[];
  favoredClassCount?: number;
  racialHitDice?: {
    count: number;
    hpGained: number | null;
    progression: Pick<CharacterSheetClassDetail, 'bab' | 'saves'> & {
      skillRanksPerHitDie: number;
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
    return catalog.modifiers.map((modifier, modifierIndex) => ({
      modifierIndex,
      ...(entry.state.kind === 'spellEffect'
        ? { effectCasterLevel: entry.state.casterLevel }
        : {}),
      ...modifier,
      sheetEntryId: entry._id,
      entryName:
        catalog.name ??
        (entry.kind === 'base' ? 'Base scores' : 'Personal adjustment'),
      source: catalog.sourceKey ?? catalog.ruleIdentity,
      builtIn: entry.kind === 'base',
      stacksWithItself: catalog.stacksWithItself,
    }));
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
) {
  const permanentOptions = { ...options, permanentOnly: true };
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

function calculateSheetProjection(
  recordedInput: CharacterSheetInput,
  options: ResolveOptions,
  formulaCache: FormulaCache,
  { base, baseModifiers } = baseScoresFor(recordedInput),
  permanentIntelligence?: number,
) {
  const grants = resolveCharacterSheetGrants(recordedInput, options);
  const input = { ...recordedInput, entries: grants.countingEntries };
  const conditions = resolveSheetConditions({
    input,
    permanentOnly: options.permanentOnly,
  });
  const effectiveInput = conditions.input;
  const sourced = sourceCatalogModifiers(effectiveInput, options);
  const advancement = resolveAdvancement(effectiveInput);
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
  const derivedOptions = {
    ...options,
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
  const { breakdowns, warnings: formulaWarnings } = resolveCalculation(
    [...sourced, ...drainModifiers, ...advancement.modifiers],
    context,
    formulaCache,
    levels,
  );
  const abilities = calculateAbilities(breakdowns, abilityDamage);
  const skillProjection = resolveSkills({
    input: effectiveInput,
    advancement,
    abilities,
    breakdowns,
    permanentOnly: options.permanentOnly,
  });
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
    intelligence:
      permanentIntelligence ??
      (options.permanentOnly
        ? abilities.intelligence.modifier
        : permanentIntelligenceFor(
            recordedInput,
            advancement,
            options,
            formulaCache,
          )),
  });
  const warnings = [
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
      favoredClassCount: input.favoredClassCount ?? 1,
      catalogEntries: input.catalogEntries,
    }),
    ...formulaWarnings,
    ...skillProjection.warnings,
    ...grants.warnings,
  ].filter(
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
      resolveModifierValue(modifier, context, breakdowns, formulaCache);
    } catch (error) {
      if (!(error instanceof FormulaError)) throw error;
      recordFormulaWarning(dormantWarnings, modifier, error);
    }
  }
  return {
    abilities,
    resolvedEntries: grants.entries.filter(
      ({ entry }) =>
        entry.kind !== 'base' &&
        entry.kind !== 'classLevel' &&
        entry.kind !== 'abilityDamage' &&
        entry.kind !== 'abilityDrain',
    ),
    skills: skillProjection.skills,
    conditionEffects,
    abilityModifierBreakdowns: calculateAbilityModifierBreakdowns(
      abilities,
      abilityDamage,
    ),
    level: levels.length,
    hitDice: advancement.hitDice,
    ...advancementResult,
    hp,
    creationSettings,
    pointBuy,
    warnings,
    warningsForAcceptance: [...warnings, ...dormantWarnings],
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
  return calculateSheetProjection(input, options, new Map());
}

export type CharacterSheetProjections = ReturnType<
  typeof calculateCharacterSheetProjections
>;

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
      >;
      permanent: Pick<
        ResolveOptions,
        | 'classLevels'
        | 'casterLevels'
        | 'arcaneCasterLevel'
        | 'preModifierCasterLevel'
      >;
    };
  } = {},
) {
  const { projectionInputs, ...shared } = options;
  const formulaCache: FormulaCache = new Map();
  const baseScores = baseScoresFor(input);
  const permanent = calculateSheetProjection(
    input,
    { ...shared, ...projectionInputs?.permanent, permanentOnly: true },
    formulaCache,
    baseScores,
  );
  return {
    current: calculateSheetProjection(
      input,
      { ...shared, ...projectionInputs?.current },
      formulaCache,
      baseScores,
      permanent.abilities.intelligence.modifier,
    ),
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

const specialSizeModifiers = {
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
  size?: keyof typeof specialSizeModifiers;
  armorMaxDexterityBonus?: number;
  deniedDexterityBy?: string;
  flatFootedBy?: string;
  permanentOnly?: boolean;
  level?: number;
  hitDice?: number;
  classLevels?: Readonly<Record<string, number>>;
  casterLevels?: Readonly<Record<string, number>>;
  arcaneCasterLevel?: number;
  preModifierCasterLevel?: number;
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

export function targetStage(target: string) {
  if (target.startsWith('ability.')) return 1;
  if (target === 'bab') return 3;
  if (target === 'casterLevel') return 4;
  return 5;
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
    stage: 0,
    read: ({ options }) => options.level ?? 0,
  },
  {
    match: (name) => /^@classLevel\.[A-Za-z][A-Za-z0-9_.]*$/.test(name),
    stage: 0,
    read: ({ name, options }) =>
      readNamedLevel(
        name,
        name.slice('@classLevel.'.length),
        options.classLevels,
      ),
  },
  {
    match: (name) => name === '@hitDice',
    stage: 3,
    read: ({ options }) => options.hitDice ?? 0,
  },
  {
    match: (name) => name === '@bab',
    stage: 3,
    read: ({ breakdowns }) => breakdowns.bab.total,
  },
  {
    match: (name) => Object.hasOwn(abilityVariables, name),
    stage: 2,
    read: ({ name, breakdowns, options }) => {
      const ability = abilityVariables[name];
      if (!ability) throw new FormulaError('Unsupported ability.');
      return abilityValue(ability, breakdowns, options.abilityDamage ?? {})
        .modifier;
    },
  },
  {
    match: (name) => name === '@casterLevel',
    stage: 0,
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
    stage: 4,
    read: ({ name, options }) => {
      const key = name.slice('@casterLevel.'.length);
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
) {
  const expanded = modifiers.flatMap(expandModifier);
  const breakdowns = emptyBreakdowns();
  const warnings: SheetWarning[] = [];
  for (const target of [...leafTargets].sort(
    (a, b) => targetStage(a) - targetStage(b),
  )) {
    if (target === 'hp')
      expanded.push(...builtInHpModifiers(levels, breakdowns, options));
    breakdowns[target] = resolveTarget(
      target,
      expanded,
      options,
      breakdowns,
      formulaCache,
      warnings,
    );
  }
  return { breakdowns, warnings };
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
      name: 'Dexterity',
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
