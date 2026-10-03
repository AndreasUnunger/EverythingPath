import {
  builtIn,
  composeStatistics,
  resolveSheet,
  specialSizeModifiers,
  type Ability,
  type CharacterSheetInput,
  type LeafTarget,
  type ModifierTarget,
  type ResolvedStatistic,
  type ResolveOptions,
  type SheetCatalogEntryDetail,
  type SheetEntry,
  type SheetWarning,
  type SourcedModifier,
} from './character-sheet';
import type { resolveWeaponProficiencies } from './character-sheet-equipment';
import { isHandDependentWeapon } from './character-sheet-proficiencies';

export type AttackRoutineState = Extract<
  SheetEntry,
  { kind: 'attackRoutine' }
>['state'];
export type WeaponDetail = NonNullable<
  Extract<SheetCatalogEntryDetail, { kind: 'item' }>['weapon']
>;
export type AttackStatistic =
  | 'attackBonus'
  | 'damageBonus'
  | 'criticalThreat'
  | 'criticalMultiplier'
  | 'rangeIncrement';
export type AttackLine = {
  weaponEntryId: string;
  weaponName: string;
  mode: AttackRoutineState['mode'];
  damageDice: string;
  damageType: string;
  damageDiceSource: { sheetEntryId: string; entryName: string; source: string };
  attackBonus: ResolvedStatistic;
  damageBonus: ResolvedStatistic;
  criticalThreat: ResolvedStatistic;
  criticalMultiplier: ResolvedStatistic;
  rangeIncrement: ResolvedStatistic | null;
};
export type ResolvedAttackRoutine = {
  entryId: string;
  name: string;
  weaponEntryId: string;
  hands: AttackRoutineState['hands'];
  mode: AttackRoutineState['mode'];
  single: AttackLine[];
  full: AttackLine[];
  warnings: SheetWarning[];
};

export function defaultAttackRoutineConfiguration(
  weapon: WeaponDetail,
): Pick<AttackRoutineState, 'hands' | 'mode'> {
  return {
    hands: weapon.handedness === 'twoHanded' ? 'two' : 'one',
    mode: weapon.attackType === 'ranged' ? 'ranged' : 'melee',
  };
}

export function formatCriticalRange(threat: number) {
  return threat === 20 ? '20' : `${threat}–20`;
}

export function attackRoutineWeaponUses(input: CharacterSheetInput) {
  return input.entries.flatMap((entry) => {
    if (entry.kind !== 'attackRoutine' || !entry.active) return [];
    const item = input.entries.find(
      (candidate) => candidate._id === entry.state.weaponEntryId,
    );
    if (item?.kind !== 'item' || !item.active) return [];
    const catalog = input.catalogEntries.find(
      (candidate) => candidate._id === item.catalogEntryId,
    );
    if (catalog?.detail?.kind !== 'item' || !catalog.detail.weapon) return [];
    return [
      {
        entryId: item._id,
        routineEntryId: entry._id,
        hands: entry.state.hands,
        attack:
          entry.state.mode === 'melee'
            ? ('melee' as const)
            : ('ranged' as const),
      },
    ];
  });
}

type RoutineEntry = Extract<SheetEntry, { kind: 'attackRoutine' }>;
type ItemEntry = Extract<SheetEntry, { kind: 'item' }>;
type CompleteWeapon = WeaponDetail & {
  dice: string;
  threat: number;
  mult: number;
};
type AvailableWeapon = {
  kind: 'available';
  item: ItemEntry;
  weapon: CompleteWeapon;
  name: string;
  source: string;
};
type AttackCalculation = {
  entry: RoutineEntry;
  equippedWeapon: AvailableWeapon;
  abilities: Record<Ability, { score: number; modifier: number }>;
  breakdowns: Record<LeafTarget, ResolvedStatistic>;
  proficiency:
    | ReturnType<typeof resolveWeaponProficiencies>['weapons'][number]
    | undefined;
  options: ResolveOptions;
};

function routineWarning({
  entry,
  kind = 'rules',
  check,
  facts,
  message,
}: {
  entry: RoutineEntry;
  kind?: SheetWarning['kind'];
  check: SheetWarning['check'];
  facts: readonly unknown[];
  message: string;
}): SheetWarning {
  return {
    kind,
    check,
    target: { kind: 'entry', entryId: entry._id },
    subject: entry._id,
    fingerprint: JSON.stringify(facts),
    message,
  };
}

function resolveRoutineWeapon({
  entry,
  input,
  recordedEntries,
}: {
  entry: RoutineEntry;
  input: CharacterSheetInput;
  recordedEntries: readonly SheetEntry[];
}): AvailableWeapon | { kind: 'unavailable'; warning: SheetWarning } {
  const state = entry.state;
  const effectiveItem = input.entries.find(
    (candidate) => candidate._id === state.weaponEntryId,
  );
  const item =
    effectiveItem ??
    recordedEntries.find((candidate) => candidate._id === state.weaponEntryId);
  const catalog =
    item && 'catalogEntryId' in item
      ? input.catalogEntries.find(
          (candidate) => candidate._id === item.catalogEntryId,
        )
      : undefined;
  const weapon =
    catalog?.detail?.kind === 'item' ? catalog.detail.weapon : undefined;
  if (!item || item.kind !== 'item' || !weapon) {
    return {
      kind: 'unavailable',
      warning: routineWarning({
        entry,
        kind: item ? 'unresolved' : 'rules',
        check: item ? 'invalidAttackWeapon' : 'missingAttackWeapon',
        facts: [state.weaponEntryId],
        message: item
          ? `${state.name}'s selected entry is no longer a weapon. Choose another weapon to use this routine.`
          : `${state.name}'s weapon is no longer in Gear. Choose another weapon to use this routine.`,
      }),
    };
  }
  if (!item.active || !effectiveItem) {
    return {
      kind: 'unavailable',
      warning: routineWarning({
        entry,
        check: item.active ? 'unavailableAttackWeapon' : 'inactiveAttackWeapon',
        facts: [state.weaponEntryId, item.active ? 'unavailable' : false],
        message: item.active
          ? `${state.name}'s weapon is unavailable. Restore its source or choose another weapon to use this routine.`
          : `${state.name}'s weapon is switched off. Switch it on in Gear or choose another weapon to use this routine.`,
      }),
    };
  }
  if (
    !weapon.dice ||
    weapon.threat === undefined ||
    weapon.mult === undefined
  ) {
    return {
      kind: 'unavailable',
      warning: routineWarning({
        entry,
        kind: 'unresolved',
        check: 'attackWeaponUnresolved',
        facts: [state.weaponEntryId, weapon.dice, weapon.threat, weapon.mult],
        message: `${state.name}'s weapon statistics are incomplete. Damage and attacks cannot be calculated.`,
      }),
    };
  }
  return {
    kind: 'available',
    item,
    weapon: {
      ...weapon,
      dice: weapon.dice,
      threat: weapon.threat,
      mult: weapon.mult,
    },
    name: catalog?.name ?? weapon.baseType,
    source: catalog?.ruleIdentity ?? weapon.baseType,
  };
}

function isImprovisedThrow({ entry, equippedWeapon }: AttackCalculation) {
  return entry.state.mode === 'thrown' && !equippedWeapon.weapon.thrown;
}

function routineSuitabilityWarnings({
  calculation,
  proficiencyFingerprint,
}: {
  calculation: AttackCalculation;
  proficiencyFingerprint: string | undefined;
}): SheetWarning[] {
  const {
    entry,
    equippedWeapon: { name, weapon },
    proficiency,
  } = calculation;
  const state = entry.state;
  const warnings: SheetWarning[] = [];
  if (isImprovisedThrow(calculation)) {
    warnings.push(
      routineWarning({
        entry,
        check: 'unsuitableAttackMode',
        facts: [state.weaponEntryId, state.mode, weapon.thrown],
        message: `${name} is not designed to be thrown. Improvised throw: −4 on attacks and a 10 ft. range increment.`,
      }),
    );
  }
  if (
    state.mode !== 'thrown' &&
    weapon.attackType &&
    state.mode !== weapon.attackType
  ) {
    warnings.push(
      routineWarning({
        entry,
        check: 'unsuitableAttackMode',
        facts: [state.weaponEntryId, state.mode, weapon.attackType],
        message: `${name} is normally used for ${weapon.attackType} attacks. This routine uses ${state.mode} attacks.`,
      }),
    );
  }
  if (state.hands === 'one' && weapon.handedness === 'twoHanded') {
    warnings.push(
      routineWarning({
        entry,
        check: 'unsuitableAttackHands',
        facts: [state.weaponEntryId, state.hands, weapon.handedness],
        message: `${name} normally requires two hands. This routine uses one hand.`,
      }),
    );
  }
  if (
    proficiency?.attackPenalty &&
    state.hands === 'one' &&
    isHandDependentWeapon(weapon.baseType)
  ) {
    warnings.push({
      ...routineWarning({
        entry,
        check: 'oneHandedExotic',
        facts: [state.weaponEntryId, state.hands, proficiency.attackPenalty],
        message: `${name} needs its named proficiency to be used in one hand. Not proficient: −4 on attacks.`,
      }),
      ...(proficiencyFingerprint
        ? { fingerprint: proficiencyFingerprint }
        : {}),
    });
  }
  return warnings;
}

function damageStrength({
  weapon,
  state,
  strength,
}: {
  weapon: WeaponDetail;
  state: AttackRoutineState;
  strength: number;
}) {
  if (state.mode === 'thrown') return strength;
  if (state.mode === 'melee')
    return strength < 0 ||
      state.hands === 'one' ||
      weapon.handedness === 'light'
      ? strength
      : Math.floor(strength * 1.5);
  switch (weapon.strengthDamage) {
    case 'sling':
    case 'thrown':
      return strength;
    case 'compositeBow':
      return Math.min(strength, weapon.strengthRating ?? 0);
    case 'bow':
      return Math.min(strength, 0);
    default:
      return 0;
  }
}

function sourced({
  calculation,
  value,
  label,
  target = calculation.entry.state.mode === 'melee'
    ? 'attack.melee'
    : 'attack.ranged',
  sheetEntryId = calculation.equippedWeapon.item._id,
}: {
  calculation: AttackCalculation;
  value: number;
  label: string;
  target?: ModifierTarget;
  sheetEntryId?: string;
}): SourcedModifier {
  return builtIn({
    target,
    id: `${calculation.entry._id}:${label}`,
    sheetEntryId,
    name: label,
    value,
  });
}

function resolveAttackBonus(calculation: AttackCalculation): ResolvedStatistic {
  const {
    entry,
    equippedWeapon: { item, name, weapon },
    abilities,
    breakdowns,
    proficiency,
    options,
  } = calculation;
  const state = entry.state;
  const target = state.mode === 'melee' ? 'attack.melee' : 'attack.ranged';
  const ability = state.mode === 'melee' ? 'strength' : 'dexterity';
  const leaf = breakdowns[target];
  const modifiers: SourcedModifier[] = [
    ...leaf.applied,
    ...leaf.suppressed,
    ...leaf.conditional,
  ];
  const enhancement = item.state.enhancement ?? 0;
  const masterwork = item.state.masterwork === true;
  const size = -specialSizeModifiers[options.size ?? 'medium'];
  if (isImprovisedThrow(calculation)) {
    modifiers.push({
      ...sourced({
        calculation,
        value: -4,
        label: `Improvised throw: ${name}`,
      }),
      stacksWithinEntry: true,
    });
  }
  if (size) {
    modifiers.push({
      ...builtIn({ target, id: 'size-attack', name: 'Size', value: size }),
      bonusType: 'size',
    });
  }
  if (enhancement || masterwork) {
    modifiers.push({
      ...sourced({
        calculation,
        value: enhancement || 1,
        label: `${name} ${enhancement ? 'enhancement' : 'masterwork'}`,
      }),
      bonusType: 'enhancement',
    });
  }
  if (proficiency?.attackPenalty && !isImprovisedThrow(calculation)) {
    modifiers.push({
      ...sourced({
        calculation,
        value: proficiency.attackPenalty,
        label: `Not proficient: ${name}`,
      }),
      stacksWithinEntry: true,
    });
  }
  if (
    state.mode === 'ranged' &&
    weapon.strengthDamage === 'compositeBow' &&
    abilities.strength.modifier < (weapon.strengthRating ?? 0)
  ) {
    modifiers.push({
      ...sourced({ calculation, value: -2, label: `${name} Strength rating` }),
      stacksWithinEntry: true,
    });
  }
  return composeStatistics({
    statistics: [resolveSheet(modifiers, options)[target], breakdowns.bab],
    builtIns: [
      sourced({
        calculation,
        value: abilities[ability].modifier,
        label: ability === 'strength' ? 'Strength' : 'Dexterity',
        sheetEntryId: `builtin:ability.${ability === 'strength' ? 'str' : 'dex'}`,
      }),
    ],
    includes: () => true,
    name: 'attack',
  });
}

function resolveDamageBonus(calculation: AttackCalculation): ResolvedStatistic {
  const {
    entry,
    equippedWeapon: { item, name, weapon },
    abilities,
    breakdowns,
    options,
  } = calculation;
  const target =
    entry.state.mode === 'melee' ? 'damage.melee' : 'damage.ranged';
  const leaf = breakdowns[target];
  const modifiers: SourcedModifier[] = [
    ...leaf.applied,
    ...leaf.suppressed,
    ...leaf.conditional,
    {
      ...sourced({
        calculation,
        value: damageStrength({
          weapon,
          state: entry.state,
          strength: abilities.strength.modifier,
        }),
        label: 'Strength to damage',
        target,
        sheetEntryId: 'builtin:ability.str',
      }),
      stacksWithinEntry: true,
    },
  ];
  const enhancement = item.state.enhancement ?? 0;
  if (enhancement) {
    modifiers.push({
      ...sourced({
        calculation,
        value: enhancement,
        label: `${name} enhancement`,
        target,
      }),
      bonusType: 'enhancement',
    });
  }
  return resolveSheet(modifiers, options)[target];
}

function weaponStatistic({
  calculation,
  value,
  label,
}: {
  calculation: AttackCalculation;
  value: number;
  label: string;
}): ResolvedStatistic {
  return {
    total: value,
    applied: [
      sourced({
        calculation,
        value,
        label: `${calculation.equippedWeapon.name} ${label}`,
      }),
    ],
    suppressed: [],
    conditional: [],
  };
}

function resolveAttackLine(calculation: AttackCalculation): AttackLine {
  const {
    entry,
    equippedWeapon: { item, weapon, name, source },
  } = calculation;
  const mode = entry.state.mode;
  const range =
    mode === 'melee'
      ? undefined
      : mode === 'thrown'
        ? isImprovisedThrow(calculation)
          ? 10
          : (weapon.thrownRangeIncrement ?? weapon.rangeIncrement)
        : weapon.rangeIncrement;
  return {
    weaponEntryId: item._id,
    weaponName: name,
    mode,
    damageDice: weapon.dice,
    damageType: weapon.damageTypes?.join(', ') ?? '',
    damageDiceSource: { sheetEntryId: item._id, entryName: name, source },
    attackBonus: resolveAttackBonus(calculation),
    damageBonus: resolveDamageBonus(calculation),
    criticalThreat: weaponStatistic({
      calculation,
      value: weapon.threat,
      label: 'critical threat',
    }),
    criticalMultiplier: weaponStatistic({
      calculation,
      value: weapon.mult,
      label: 'critical multiplier',
    }),
    rangeIncrement:
      range === undefined
        ? null
        : weaponStatistic({
            calculation,
            value: range,
            label: 'range increment',
          }),
  };
}

function resolveIterativeAttacks({
  calculation,
  line,
}: {
  calculation: AttackCalculation;
  line: AttackLine;
}): AttackLine[] {
  const count = Math.min(
    4,
    1 + Math.max(0, Math.floor((calculation.breakdowns.bab.total - 1) / 5)),
  );
  return Array.from({ length: count }, (_, index) => ({
    ...line,
    attackBonus: index
      ? composeStatistics({
          statistics: [line.attackBonus],
          builtIns: [
            sourced({
              calculation,
              value: -5 * index,
              label: `Iterative attack ${index + 1}`,
              sheetEntryId: 'builtin:bab',
            }),
          ],
          includes: () => true,
          name: 'iterative attack',
        })
      : line.attackBonus,
  }));
}

/** CRB pp. 141–145, 179, 182: manufactured single attacks and BAB iteratives. */
export function resolveAttackRoutines({
  input,
  recordedEntries = input.entries,
  abilities,
  breakdowns,
  weaponProficiencies,
  routineWarningFingerprints = new Map(),
  options = {},
}: {
  input: CharacterSheetInput;
  recordedEntries?: readonly SheetEntry[];
  abilities: Record<Ability, { score: number; modifier: number }>;
  breakdowns: Record<LeafTarget, ResolvedStatistic>;
  weaponProficiencies: ReturnType<typeof resolveWeaponProficiencies>['weapons'];
  routineWarningFingerprints?: ReadonlyMap<string, string>;
  options?: ResolveOptions;
}): ResolvedAttackRoutine[] {
  return input.entries.flatMap((entry): ResolvedAttackRoutine[] => {
    if (entry.kind !== 'attackRoutine' || !entry.active) return [];
    const state = entry.state;
    const routine: ResolvedAttackRoutine = {
      entryId: entry._id,
      name: state.name,
      weaponEntryId: state.weaponEntryId,
      hands: state.hands,
      mode: state.mode,
      single: [],
      full: [],
      warnings: [],
    };
    const equippedWeapon = resolveRoutineWeapon({
      entry,
      input,
      recordedEntries,
    });
    if (equippedWeapon.kind === 'unavailable')
      return [{ ...routine, warnings: [equippedWeapon.warning] }];
    const calculation: AttackCalculation = {
      entry,
      equippedWeapon,
      abilities,
      breakdowns,
      proficiency: weaponProficiencies.find(
        (use) =>
          use.entryId === state.weaponEntryId && use.hands === state.hands,
      ),
      options,
    };
    const line = resolveAttackLine(calculation);
    return [
      {
        ...routine,
        single: [line],
        full: resolveIterativeAttacks({ calculation, line }),
        warnings: routineSuitabilityWarnings({
          calculation,
          proficiencyFingerprint: routineWarningFingerprints.get(entry._id),
        }),
      },
    ];
  });
}
