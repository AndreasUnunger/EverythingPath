import { z } from 'zod';

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
export type SheetWarning = {
  kind: 'incomplete' | 'unresolved' | 'rules';
  check:
    | 'class'
    | 'hpGainedMissing'
    | 'hpGainedBelowMinimum'
    | 'totalHpUnresolved'
    | 'levelZero'
    | 'pointBuy';
  target:
    | { kind: 'pointBuy' }
    | { kind: 'classLevel'; entryId: string; field: 'class' | 'hpGained' }
    | { kind: 'hitPoints' }
    | { kind: 'classLevels' };
  subject: string;
  fingerprint: string;
  message: string;
};
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
type SheetEntry = { _id: string } & (
  | {
      kind: 'base';
      active: true;
      catalogEntryId: string;
      state: { kind: 'base' } & Partial<CreationSettings>;
    }
  | {
      kind: 'manual';
      active: boolean;
      catalogEntryId: string;
      state: { kind: 'manual' };
    }
  | {
      kind: 'classLevel';
      active: true;
      state: {
        kind: 'classLevel';
        classEntryId: null;
        position: number;
        hpGained: number | null;
      };
    }
);

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

export function calculateCharacterSheet(
  {
    entries,
    catalogEntries,
    characterKind,
  }: {
    characterKind: 'pc' | 'npc';
    entries: readonly SheetEntry[];
    catalogEntries: readonly {
      _id: string;
      name?: string;
      ruleIdentity: string;
      sourceKey?: string;
      stacksWithItself?: boolean;
      modifiers: readonly Modifier[];
    }[];
  },
  options: ResolveOptions = {},
) {
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
      !Number.isFinite(modifier.value)
    )
      throw new Error('Base scores require six finite Modifiers');
    return {
      target: abilityTargets[ability],
      bonusType: 'base',
      value: modifier.value,
    };
  });
  const sourced = entries.flatMap((entry): SourcedModifier[] => {
    if (!entry.active || entry.kind === 'classLevel') return [];
    const catalog = catalogEntries.find(
      (item) => item._id === entry.catalogEntryId,
    );
    if (!catalog) throw new Error('Catalog Entry is unavailable');
    return catalog.modifiers.map((modifier) => ({
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
  const context = {
    ...options,
    activeCatalogEntryIds: entries.flatMap((entry) =>
      entry.active && entry.kind !== 'classLevel' ? [entry.catalogEntryId] : [],
    ),
  };
  const constitution = resolveStatistic(
    sourced.filter(
      (item) =>
        item.target === 'ability.con' && conditionApplies(item, context),
    ),
  );
  const constitutionModifier = Math.floor((constitution.total - 10) / 2);
  const levels = entries.filter((entry) => entry.kind === 'classLevel');
  const hpModifiers: SourcedModifier[] = levels.flatMap((entry) =>
    entry.state.hpGained === null
      ? []
      : [
          {
            target: 'hp',
            bonusType: 'untyped',
            value: entry.state.hpGained,
            sheetEntryId: entry._id,
            entryName: `Class Level ${entry.state.position}`,
            source: `hp:${entry._id}`,
            builtIn: true,
          },
        ],
  );
  if (levels.length)
    hpModifiers.push({
      target: 'hp',
      bonusType: 'untyped',
      value: constitutionModifier * levels.length,
      sheetEntryId: 'builtin:constitution-hp',
      entryName: 'Constitution',
      source: 'constitution-hp',
      builtIn: true,
    });
  const breakdowns = resolveSheet([...sourced, ...hpModifiers], context);
  function calculateAbilityValue(ability: Ability) {
    const score = breakdowns[abilityTargets[ability]].total;
    const abilityModifier = Math.floor((score - 10) / 2);
    return { score, modifier: abilityModifier };
  }
  const abilities = {
    strength: calculateAbilityValue('strength'),
    dexterity: calculateAbilityValue('dexterity'),
    constitution: calculateAbilityValue('constitution'),
    intelligence: calculateAbilityValue('intelligence'),
    wisdom: calculateAbilityValue('wisdom'),
    charisma: calculateAbilityValue('charisma'),
  };

  const hp = levels.some((entry) => entry.state.hpGained === null)
    ? null
    : breakdowns.hp.total;
  const creationSettings = creationSettingsFor(base);
  const pointBuy = calculatePointBuy({
    baseModifiers,
    abilityMethod: creationSettings.abilityMethod,
  });
  const derivedStatistics = deriveDefenses({
    breakdowns,
    strength: abilities.strength.modifier,
    dexterity: abilities.dexterity.modifier,
  });
  return {
    abilities,
    level: levels.length,
    hitDice: levels.length,
    hp,
    creationSettings,
    pointBuy,
    warnings: sheetWarnings({
      characterKind,
      base,
      levels,
      baseModifiers,
      creationSettings,
      pointBuy,
      hp,
    }),
    breakdowns,
    derivedStatistics,
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
  value: number;
  condition?: z.infer<typeof modifierConditionSchema>;
  stacksWithinEntry?: true;
};
export type SourcedModifier = Modifier & {
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

export type ResolveOptions = {
  situations?: readonly (
    | string
    | { local: string; sheetEntryId: string }
    | { option: string }
  )[];
  activeCatalogEntryIds?: readonly string[];
};

function conditionApplies(modifier: SourcedModifier, options: ResolveOptions) {
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

function expandModifier(modifier: SourcedModifier): SourcedModifier[] {
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

export function resolveSheet(
  modifiers: readonly SourcedModifier[],
  options: ResolveOptions = {},
): Record<LeafTarget, ResolvedStatistic> {
  const expanded = modifiers.flatMap(expandModifier);
  const resolve = (target: LeafTarget): ResolvedStatistic => ({
    ...resolveStatistic(
      expanded.filter(
        (item) => item.target === target && conditionApplies(item, options),
      ),
    ),
    conditional: expanded.filter(
      (item) => item.target === target && !conditionApplies(item, options),
    ),
  });
  return {
    'ability.str': resolve('ability.str'),
    'ability.dex': resolve('ability.dex'),
    'ability.con': resolve('ability.con'),
    'ability.int': resolve('ability.int'),
    'ability.wis': resolve('ability.wis'),
    'ability.cha': resolve('ability.cha'),
    'ac.armor': resolve('ac.armor'),
    'ac.shield': resolve('ac.shield'),
    'ac.natural': resolve('ac.natural'),
    'ac.other': resolve('ac.other'),
    'save.fort': resolve('save.fort'),
    'save.ref': resolve('save.ref'),
    'save.will': resolve('save.will'),
    'skill.acr': resolve('skill.acr'),
    'skill.apr': resolve('skill.apr'),
    'skill.blf': resolve('skill.blf'),
    'skill.clm': resolve('skill.clm'),
    'skill.crf': resolve('skill.crf'),
    'skill.dip': resolve('skill.dip'),
    'skill.dev': resolve('skill.dev'),
    'skill.dis': resolve('skill.dis'),
    'skill.esc': resolve('skill.esc'),
    'skill.fly': resolve('skill.fly'),
    'skill.han': resolve('skill.han'),
    'skill.hea': resolve('skill.hea'),
    'skill.int': resolve('skill.int'),
    'skill.kar': resolve('skill.kar'),
    'skill.kdu': resolve('skill.kdu'),
    'skill.ken': resolve('skill.ken'),
    'skill.kge': resolve('skill.kge'),
    'skill.khi': resolve('skill.khi'),
    'skill.klo': resolve('skill.klo'),
    'skill.kna': resolve('skill.kna'),
    'skill.kno': resolve('skill.kno'),
    'skill.kpl': resolve('skill.kpl'),
    'skill.kre': resolve('skill.kre'),
    'skill.lin': resolve('skill.lin'),
    'skill.per': resolve('skill.per'),
    'skill.prf': resolve('skill.prf'),
    'skill.pro': resolve('skill.pro'),
    'skill.rid': resolve('skill.rid'),
    'skill.sen': resolve('skill.sen'),
    'skill.slt': resolve('skill.slt'),
    'skill.spl': resolve('skill.spl'),
    'skill.ste': resolve('skill.ste'),
    'skill.sur': resolve('skill.sur'),
    'skill.swm': resolve('skill.swm'),
    'skill.umd': resolve('skill.umd'),
    bab: resolve('bab'),
    'attack.melee': resolve('attack.melee'),
    'attack.ranged': resolve('attack.ranged'),
    'damage.melee': resolve('damage.melee'),
    'damage.ranged': resolve('damage.ranged'),
    cmb: resolve('cmb'),
    cmd: resolve('cmd'),
    init: resolve('init'),
    hp: resolve('hp'),
    casterLevel: resolve('casterLevel'),
    spellDC: resolve('spellDC'),
    concentration: resolve('concentration'),
  };
}

function builtIn({
  target,
  id,
  name,
  value,
}: {
  target: ModifierTarget;
  id: 'base-ac' | 'base-cmd' | 'strength' | 'dexterity';
  name: string;
  value: number;
}): SourcedModifier {
  return {
    target,
    value,
    bonusType: 'untyped',
    sheetEntryId: `builtin:${id}`,
    entryName: name,
    source: `builtin:${id}`,
    builtIn: true,
  };
}

function composeStatistics({
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
}: {
  breakdowns: Record<LeafTarget, ResolvedStatistic>;
  strength: number;
  dexterity: number;
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
      value: dexterity,
    }),
  ];
  const losesDexBonus = (item: SourcedModifier) =>
    item.sheetEntryId === 'builtin:dexterity' && item.value > 0;
  const ac = composeStatistics({
    statistics: acLeaves,
    builtIns: acBase,
    includes: () => true,
    name: 'AC',
  });
  const touchAc = composeStatistics({
    statistics: acLeaves,
    builtIns: acBase,
    includes: (item) =>
      item.target === 'ac.other' &&
      !['armor', 'shield', 'naturalArmor'].includes(item.bonusType),
    name: 'touch AC',
  });
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
  ];
  const cmd = stackCmd(
    composeStatistics({
      statistics: [cmdAc, breakdowns.cmd, breakdowns.bab],
      builtIns: cmdBase,
      includes: () => true,
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
