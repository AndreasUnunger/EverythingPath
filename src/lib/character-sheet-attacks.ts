import type {
  AttackHand,
  AttackWeaponEnd,
} from './character-sheet-attack-types';
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
  hand: AttackHand;
  end: AttackWeaponEnd;
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
  offHand?: AttackRoutineState['offHand'];
  twoWeaponPenaltySummary: string | null;
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
    const hands = [
      {
        hand: 'main' as const,
        weaponEntryId: entry.state.weaponEntryId,
        hands: entry.state.hands,
        mode: entry.state.mode,
      },
      ...(entry.state.offHand?.kind === 'weapon'
        ? [
            {
              ...entry.state.offHand,
              hand: 'off' as const,
              hands: 'one' as const,
            },
          ]
        : []),
    ];
    return hands.flatMap((hand) => {
      const item = input.entries.find(
        (candidate) => candidate._id === hand.weaponEntryId,
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
          hand: hand.hand,
          hands: hand.hands,
          attack:
            hand.mode === 'melee' ? ('melee' as const) : ('ranged' as const),
        },
      ];
    });
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
  hand: AttackLine['hand'];
  end: AttackLine['end'];
  twoWeaponPenalty?: number;
  twoWeaponFeatEntryId?: string;
  doubleSliceEntryId?: string;
  usesBothEnds?: boolean;
  entry: RoutineEntry;
  equippedWeapon: AvailableWeapon;
  abilities: Record<Ability, { score: number; modifier: number }>;
  breakdowns: Record<LeafTarget, ResolvedStatistic>;
  proficiency:
    | ReturnType<typeof resolveWeaponProficiencies>['weapons'][number]
    | undefined;
  options: ResolveOptions;
};

function activeFeatSelections(input: CharacterSheetInput) {
  return new Map(
    input.entries.flatMap((entry) => {
      if (entry.kind !== 'feat' || !entry.active) return [];
      const definition = input.catalogEntries.find(
        (candidate) => candidate._id === entry.catalogEntryId,
      );
      return definition ? [[definition.ruleIdentity, entry] as const] : [];
    }),
  );
}

/** CRB Table 8–7; only the off-hand weapon determines light status. */
function twoWeaponPenalties({
  light,
  trained,
}: {
  light: boolean;
  trained: boolean;
}) {
  return trained
    ? { main: light ? -2 : -4, off: light ? -2 : -4 }
    : { main: light ? -4 : -6, off: light ? -8 : -10 };
}

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
  hand = 'main',
}: {
  entry: RoutineEntry;
  input: CharacterSheetInput;
  recordedEntries: readonly SheetEntry[];
  hand?: AttackHand;
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
  const weaponName = catalog?.name ?? weapon?.baseType ?? 'The selected weapon';
  const subject = hand === 'off' ? weaponName : `${state.name}'s weapon`;
  const repair =
    hand === 'off'
      ? 'choose another weapon. Off-hand attacks are skipped.'
      : 'choose another weapon to use this routine.';
  if (!item || item.kind !== 'item' || !weapon) {
    return {
      kind: 'unavailable',
      warning: routineWarning({
        entry,
        kind: item ? 'unresolved' : 'rules',
        check: item ? 'invalidAttackWeapon' : 'missingAttackWeapon',
        facts: [state.weaponEntryId],
        message: item
          ? `${hand === 'off' ? weaponName : `${state.name}'s selected entry`} is no longer a weapon. ${repair.charAt(0).toUpperCase()}${repair.slice(1)}`
          : `${subject} is no longer in Gear. ${repair.charAt(0).toUpperCase()}${repair.slice(1)}`,
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
          ? `${subject} is unavailable. Restore its source or ${repair}`
          : `${subject} is switched off. Switch it on in Gear or ${repair}`,
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
        message:
          hand === 'off'
            ? `${weaponName}'s statistics are incomplete. Off-hand attacks are skipped.`
            : `${state.name}'s weapon statistics are incomplete. Damage and attacks cannot be calculated.`,
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

function strengthForHand(strength: number, offHand: boolean) {
  return strength < 0 || !offHand ? strength : Math.floor(strength / 2);
}

function rangedDamageStrength(
  weapon: WeaponDetail,
  strength: number,
  offHand: boolean,
) {
  switch (weapon.strengthDamage) {
    case 'sling':
    case 'thrown':
      return strengthForHand(strength, offHand);
    case 'compositeBow': {
      const cappedStrength = Math.min(strength, weapon.strengthRating ?? 0);
      return strengthForHand(cappedStrength, offHand);
    }
    case 'bow':
      return Math.min(strength, 0);
    default:
      return 0;
  }
}

function damageStrength({
  weapon,
  state,
  strength,
  offHand = false,
  usesBothEnds = false,
}: {
  weapon: WeaponDetail;
  state: AttackRoutineState;
  strength: number;
  offHand?: boolean;
  usesBothEnds?: boolean;
}) {
  if (state.mode === 'ranged')
    return rangedDamageStrength(weapon, strength, offHand);
  const singleEndTwoHanded =
    state.mode === 'melee' &&
    state.hands === 'two' &&
    weapon.handedness !== 'light' &&
    !usesBothEnds;
  if (strength > 0 && !offHand && singleEndTwoHanded)
    return Math.floor(strength * 1.5);
  return strengthForHand(strength, offHand);
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
    ...(leaf.excluded ?? []),
  ];
  if (calculation.twoWeaponPenalty) {
    modifiers.push({
      ...sourced({
        calculation,
        value: calculation.twoWeaponPenalty,
        label: 'Two-weapon fighting',
        sheetEntryId: calculation.twoWeaponFeatEntryId ?? calculation.entry._id,
      }),
      stacksWithinEntry: true,
    });
  }
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
    ...(leaf.excluded ?? []),
    {
      ...sourced({
        calculation,
        value: damageStrength({
          weapon,
          state: entry.state,
          strength: abilities.strength.modifier,
          offHand: calculation.hand === 'off',
          usesBothEnds: calculation.usesBothEnds,
        }),
        label: 'Strength to damage',
        target,
        sheetEntryId: 'builtin:ability.str',
      }),
      stacksWithinEntry: true,
    },
  ];
  if (
    calculation.doubleSliceEntryId &&
    calculation.hand === 'off' &&
    abilities.strength.modifier > 0
  ) {
    const fullStrength = damageStrength({
      weapon,
      state: entry.state,
      strength: abilities.strength.modifier,
      offHand: false,
      usesBothEnds: calculation.usesBothEnds,
    });
    const halfStrength = damageStrength({
      weapon,
      state: entry.state,
      strength: abilities.strength.modifier,
      offHand: true,
    });
    if (fullStrength !== halfStrength)
      modifiers.push({
        ...sourced({
          calculation,
          value: fullStrength - halfStrength,
          label: 'Double Slice',
          target,
          sheetEntryId: calculation.doubleSliceEntryId,
        }),
        stacksWithinEntry: true,
      });
  }
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
    hand: calculation.hand,
    end: calculation.end,
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

function resolveOffHandAttacks({
  calculation,
  feats,
}: {
  calculation: AttackCalculation;
  feats: ReturnType<typeof activeFeatSelections>;
}): AttackLine[] {
  const line = resolveAttackLine(calculation);
  const extras = [
    {
      identity: 'improved-two-weapon-fighting',
      penalty: -5,
      label: 'Improved Two-Weapon Fighting',
    },
    {
      identity: 'greater-two-weapon-fighting',
      penalty: -10,
      label: 'Greater Two-Weapon Fighting',
    },
  ];
  return [
    line,
    ...extras.flatMap(({ identity, penalty, label }) => {
      const feat = feats.get(identity);
      if (!feat) return [];
      return [
        {
          ...line,
          attackBonus: composeStatistics({
            statistics: [line.attackBonus],
            builtIns: [
              sourced({
                calculation,
                value: penalty,
                label,
                sheetEntryId: feat._id,
              }),
            ],
            includes: () => true,
            name: 'off-hand attack',
          }),
        },
      ];
    }),
  ];
}

type RoutineCalculationContext = Pick<
  AttackCalculation,
  'abilities' | 'breakdowns' | 'options'
>;

function resolveOffHandWeapon({
  entry,
  mainWeapon,
  input,
  recordedEntries,
}: {
  entry: RoutineEntry;
  mainWeapon: ReturnType<typeof resolveRoutineWeapon>;
  input: CharacterSheetInput;
  recordedEntries: readonly SheetEntry[];
}):
  | { kind: 'none'; warnings: SheetWarning[] }
  | { kind: 'unavailable'; warnings: SheetWarning[] }
  | {
      kind: 'available';
      entry: RoutineEntry;
      weapon: AvailableWeapon;
      usesBothEnds: boolean;
    } {
  const state = entry.state;
  const offState = state.offHand;
  if (!offState) return { kind: 'none', warnings: [] };
  const usesBothEnds = offState.kind === 'otherEnd';
  const secondEnd =
    mainWeapon.kind === 'available' ? mainWeapon.weapon.otherEnd : undefined;
  const invalidOffHand = usesBothEnds
    ? mainWeapon.kind === 'available' && !secondEnd
    : offState.weaponEntryId === state.weaponEntryId;
  if (invalidOffHand)
    return {
      kind: 'unavailable',
      warnings: [
        routineWarning({
          entry,
          check: 'invalidAttackOffHand',
          facts: [offState, state.weaponEntryId],
          message: usesBothEnds
            ? `${mainWeapon.kind === 'available' ? mainWeapon.name : state.name} has no recorded second end. Choose an off-hand weapon or record the weapon's other end.`
            : 'The same Gear weapon cannot fill both hands. Choose a separate weapon or the other end of a double weapon.',
        }),
      ],
    };
  const offEntry: RoutineEntry = {
    ...entry,
    state: {
      ...state,
      weaponEntryId:
        offState.kind === 'otherEnd'
          ? state.weaponEntryId
          : offState.weaponEntryId,
      hands: usesBothEnds ? state.hands : 'one',
      mode: offState.mode,
    },
  };
  const offWeapon: ReturnType<typeof resolveRoutineWeapon> =
    usesBothEnds && secondEnd && mainWeapon.kind === 'available'
      ? {
          ...mainWeapon,
          item: {
            ...mainWeapon.item,
            state: { kind: 'item', ...mainWeapon.item.state.otherEnd },
          },
          weapon: {
            ...mainWeapon.weapon,
            ...secondEnd,
            damageTypes: secondEnd.damageTypes ?? mainWeapon.weapon.damageTypes,
          },
        }
      : resolveRoutineWeapon({
          entry: offEntry,
          input,
          recordedEntries,
          hand: 'off',
        });
  if (offWeapon.kind === 'unavailable')
    return { kind: 'unavailable', warnings: [offWeapon.warning] };
  return {
    kind: 'available',
    entry: offEntry,
    weapon: offWeapon,
    usesBothEnds,
  };
}

function offHandConfigurationWarnings(entry: RoutineEntry) {
  const { offHand, hands, mode } = entry.state;
  if (!offHand) return [];
  const usesBothEnds = offHand.kind === 'otherEnd';
  if (
    (!usesBothEnds && hands !== 'two') ||
    (usesBothEnds && hands === 'two' && offHand.mode === mode)
  )
    return [];
  return [
    routineWarning({
      entry,
      check: 'unsuitableAttackOffHand',
      facts: [hands, mode, offHand, usesBothEnds],
      message: usesBothEnds
        ? 'Using both ends of a double weapon normally requires two hands in the same attack mode. This routine keeps your chosen configuration.'
        : 'The main weapon is held in two hands while an off-hand weapon is selected. This routine keeps both weapons.',
    }),
  ];
}

function resolveRoutineOffHand({
  entry,
  mainWeapon,
  context,
  input,
  recordedEntries,
  weaponProficiencies,
  feats,
  routineWarningFingerprints,
}: {
  entry: RoutineEntry;
  mainWeapon: ReturnType<typeof resolveRoutineWeapon>;
  context: RoutineCalculationContext;
  input: CharacterSheetInput;
  recordedEntries: readonly SheetEntry[];
  weaponProficiencies: ReturnType<typeof resolveWeaponProficiencies>['weapons'];
  feats: ReturnType<typeof activeFeatSelections>;
  routineWarningFingerprints: ReadonlyMap<string, string>;
}) {
  const resolved = resolveOffHandWeapon({
    entry,
    mainWeapon,
    input,
    recordedEntries,
  });
  if (resolved.kind !== 'available') return resolved;
  const { entry: offEntry, weapon: offWeapon, usesBothEnds } = resolved;
  const light = usesBothEnds || offWeapon.weapon.handedness === 'light';
  const penalties = twoWeaponPenalties({
    light,
    trained: feats.has('two-weapon-fighting'),
  });
  const offCalculation: AttackCalculation = {
    ...context,
    entry: offEntry,
    equippedWeapon: offWeapon,
    hand: 'off',
    end: usesBothEnds ? 'otherEnd' : 'primary',
    usesBothEnds,
    twoWeaponPenalty: penalties.off,
    twoWeaponFeatEntryId: feats.get('two-weapon-fighting')?._id,
    doubleSliceEntryId: feats.get('double-slice')?._id,
    proficiency: weaponProficiencies.find(
      (use) =>
        use.entryId === offWeapon.item._id &&
        use.hands === offEntry.state.hands,
    ),
  };
  const warnings = routineSuitabilityWarnings({
    calculation: offCalculation,
    proficiencyFingerprint: routineWarningFingerprints.get(`${entry._id}:off`),
  });
  warnings.push(...offHandConfigurationWarnings(entry));
  const signed = (value: number) => (value < 0 ? `−${-value}` : `+${value}`);
  return {
    kind: 'available' as const,
    calculation: offCalculation,
    penalties,
    summary: `Two-weapon fighting${light ? ', light off hand' : ''}: ${signed(penalties.main)} primary, ${signed(penalties.off)} off hand`,
    warnings,
  };
}

/** CRB pp. 141–145, 179, 182, 202: manufactured attacks and two-weapon chains. */
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
  const feats = activeFeatSelections(input);
  return input.entries.flatMap((entry): ResolvedAttackRoutine[] => {
    if (entry.kind !== 'attackRoutine' || !entry.active) return [];
    const state = entry.state;
    const routine: ResolvedAttackRoutine = {
      entryId: entry._id,
      name: state.name,
      weaponEntryId: state.weaponEntryId,
      hands: state.hands,
      mode: state.mode,
      ...(state.offHand ? { offHand: state.offHand } : {}),
      twoWeaponPenaltySummary: null,
      single: [],
      full: [],
      warnings: [],
    };
    const equippedWeapon = resolveRoutineWeapon({
      entry,
      input,
      recordedEntries,
    });
    const offHand = resolveRoutineOffHand({
      entry,
      mainWeapon: equippedWeapon,
      context: { abilities, breakdowns, options },
      input,
      recordedEntries,
      weaponProficiencies,
      feats,
      routineWarningFingerprints,
    });
    const offWarnings = offHand.warnings.map((warning) => ({
      ...warning,
      subject: `${entry._id}:off`,
      fingerprint: JSON.stringify(['off', warning.fingerprint]),
      message: `Off hand: ${warning.message}`,
    }));
    if (equippedWeapon.kind === 'unavailable')
      return [
        { ...routine, warnings: [equippedWeapon.warning, ...offWarnings] },
      ];
    const calculation: AttackCalculation = {
      hand: 'main',
      end: 'primary',
      entry,
      equippedWeapon,
      abilities,
      breakdowns,
      proficiency: weaponProficiencies.find(
        (use) =>
          use.entryId === state.weaponEntryId && use.hands === state.hands,
      ),
      options: {
        ...options,
        weapon: {
          entryId: equippedWeapon.item._id,
          baseType: equippedWeapon.weapon.baseType,
          groups: equippedWeapon.weapon.groups,
          kind: 'manufactured',
        },
      },
    };
    const line = resolveAttackLine(calculation);
    const offCalculation =
      offHand.kind === 'available' ? offHand.calculation : undefined;
    const fullLine =
      offHand.kind === 'available'
        ? resolveAttackLine({
            ...calculation,
            twoWeaponPenalty: offHand.penalties.main,
            twoWeaponFeatEntryId: feats.get('two-weapon-fighting')?._id,
            usesBothEnds: offHand.calculation.usesBothEnds,
          })
        : line;
    return [
      {
        ...routine,
        twoWeaponPenaltySummary:
          offHand.kind === 'available' ? offHand.summary : null,
        single: [line],
        full: [
          ...resolveIterativeAttacks({ calculation, line: fullLine }),
          ...(offCalculation
            ? resolveOffHandAttacks({ calculation: offCalculation, feats })
            : []),
        ],
        warnings: [
          ...routineSuitabilityWarnings({
            calculation,
            proficiencyFingerprint: routineWarningFingerprints.get(entry._id),
          }),
          ...offWarnings,
        ],
      },
    ];
  });
}
