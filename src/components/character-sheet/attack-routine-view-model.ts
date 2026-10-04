import type {
  AttackLine,
  AttackStatistic,
  WeaponDetail,
} from '~/lib/character-sheet-attacks';
import type { SheetWarning } from '~/lib/character-sheet';
import { formatCriticalRange } from '~/lib/character-sheet-attacks';
import { defaultAttackRoutineConfiguration } from '~/lib/character-sheet-attacks';
import type { CharacterSheetBreakdownTarget } from '~/lib/character-sheet-breakdowns';
import { formatSigned } from './equipment-statistics';
import type {
  CharacterSheetSnapshot,
  SheetWarningView,
} from './use-character-sheet';

/** Every displayed routine number carries the resolver's structured breakdown address. */
export function attackRoutineLineView({
  entryId,
  sequence,
  attackIndex,
  line,
}: {
  entryId: string;
  sequence: 'single' | 'full';
  attackIndex: number;
  line: AttackLine;
}) {
  function target(statistic: AttackStatistic): CharacterSheetBreakdownTarget {
    return { kind: 'attackRoutine', entryId, sequence, attackIndex, statistic };
  }
  const threat = line.criticalThreat.total;
  const damage = line.damageBonus.total;
  return {
    weaponName: line.weaponName,
    hand: line.hand,
    end: line.end,
    handLabel: line.hand === 'off' ? 'Off hand' : 'Main hand',
    endLabel: line.end === 'otherEnd' ? 'Other end' : null,
    mode: line.mode,
    position: sequence === 'single' ? null : attackIndex + 1,
    attack: {
      text: formatSigned(line.attackBonus.total),
      statistic: line.attackBonus,
      target: target('attackBonus'),
    },
    damage: {
      text: `${line.damageDice}${damage === 0 ? '' : formatSigned(damage)}`,
      dice: line.damageDice,
      statistic: line.damageBonus,
      target: target('damageBonus'),
      diceSource: line.damageDiceSource,
      damageType: line.damageType,
    },
    critical: {
      text: `${threat === 20 ? '' : `${formatCriticalRange(threat)}/`}×${line.criticalMultiplier.total}`,
      threat: {
        statistic: line.criticalThreat,
        target: target('criticalThreat'),
      },
      multiplier: {
        statistic: line.criticalMultiplier,
        target: target('criticalMultiplier'),
      },
    },
    range:
      line.rangeIncrement === null
        ? null
        : {
            text: `${line.rangeIncrement.total} ft.`,
            statistic: line.rangeIncrement,
            target: target('rangeIncrement'),
          },
  };
}

/** Routine warnings use the sheet's acceptance without borrowing Gear warnings. */
export function listAttackRoutineWarnings(
  warnings: SheetWarningView[],
  row: { warnings: readonly SheetWarning[] },
): SheetWarningView[] {
  return row.warnings.map(
    (warning) =>
      warnings.find(
        (view) =>
          view.check === warning.check &&
          view.subject === warning.subject &&
          view.fingerprint === warning.fingerprint,
      ) ?? { ...warning, accepted: false },
  );
}

/** Resolve display addresses and retain the observed routine revision. */
export function listAttackRoutineRows(
  snapshot: CharacterSheetSnapshot | null | undefined,
) {
  const revisions = new Map<string, number>(
    (snapshot?.entries ?? []).flatMap((entry) =>
      entry.kind === 'attackRoutine'
        ? [[entry._id, entry.state.revision ?? 0] as const]
        : [],
    ),
  );
  return (snapshot?.calculated.attackRoutines ?? []).map((routine) => ({
    ...routine,
    singleView: routine.single.map((line, attackIndex) =>
      attackRoutineLineView({
        entryId: routine.entryId,
        sequence: 'single',
        attackIndex,
        line,
      }),
    ),
    fullView: routine.full.map((line, attackIndex) =>
      attackRoutineLineView({
        entryId: routine.entryId,
        sequence: 'full',
        attackIndex,
        line,
      }),
    ),
    revision: revisions.get(routine.entryId) ?? 0,
  }));
}

/** Number same-named recorded weapons in their stable sheet order. */
export function listAttackRoutineWeapons(
  snapshot: CharacterSheetSnapshot | null | undefined,
) {
  const available = (snapshot?.entries ?? []).flatMap((entry) => {
    if (entry.kind !== 'item') return [];
    const catalog = snapshot?.catalogEntries.find(
      (candidate) => candidate._id === entry.catalogEntryId,
    );
    if (catalog?.detail.kind !== 'item' || !catalog.detail.weapon) return [];
    return [
      {
        entryId: entry._id,
        name: catalog.name,
        weapon: catalog.detail.weapon,
        active: entry.active,
        primaryState: {
          masterwork: entry.state.masterwork ?? false,
          enhancement: entry.state.enhancement ?? 0,
          material: entry.state.material ?? null,
        },
        otherEndState: {
          masterwork: entry.state.otherEnd?.masterwork ?? false,
          enhancement: entry.state.otherEnd?.enhancement ?? 0,
          material: entry.state.otherEnd?.material ?? null,
        },
      },
    ];
  });
  const counts = new Map<string, number>();
  for (const weapon of available)
    counts.set(weapon.name, (counts.get(weapon.name) ?? 0) + 1);
  const seen = new Map<string, number>();
  return available.map((weapon) => {
    const index = (seen.get(weapon.name) ?? 0) + 1;
    seen.set(weapon.name, index);
    return {
      ...weapon,
      label:
        (counts.get(weapon.name) ?? 0) > 1
          ? `${weapon.name} ${index}`
          : weapon.name,
    };
  });
}

/** Offer Gear choices without rejecting a table's unusual hand configuration. */
export function listAttackRoutineOffHands(
  weapons: ReturnType<typeof listAttackRoutineWeapons>,
  mainWeaponEntryId: string,
) {
  const main = weapons.find((weapon) => weapon.entryId === mainWeaponEntryId);
  const choices = [
    ...(main?.weapon.otherEnd
      ? [
          {
            ...main,
            choice: { kind: 'otherEnd' as const },
            label: `Other end of ${main.label}`,
            weapon: {
              ...main.weapon,
              ...main.weapon.otherEnd,
              handedness: 'light' as const,
            },
          },
        ]
      : []),
    ...weapons.map((weapon) => ({
      ...weapon,
      choice: { kind: 'weapon' as const, weaponEntryId: weapon.entryId },
    })),
  ];
  return choices.map((choice) => ({
    ...choice,
    defaultMode: defaultAttackRoutineConfiguration(choice.weapon).mode,
  }));
}

/** Radio values identify a choice without overloading a Gear entry ID. */
export function attackOffHandChoiceValue(
  choice: { kind: 'weapon'; weaponEntryId: string } | { kind: 'otherEnd' },
) {
  return choice.kind === 'otherEnd'
    ? 'end:otherEnd'
    : `weapon:${choice.weaponEntryId}`;
}

/** Weapon catalog choices exclude armor, whose bash has no default routine. */
export function listAttackWeaponCatalog(
  snapshot: CharacterSheetSnapshot | null | undefined,
) {
  return (snapshot?.catalogEntries ?? []).flatMap((entry) =>
    entry.detail.kind === 'item' && entry.detail.weapon && !entry.detail.armor
      ? [
          {
            catalogEntryId: entry._id,
            label: entry.name,
            weapon: entry.detail.weapon,
          },
        ]
      : [],
  );
}

const handednessLabels = {
  light: 'Light',
  oneHanded: 'One-handed',
  twoHanded: 'Two-handed',
} as const;

/** A weapon card's facts: "1d8 · 19–20/×2 · One-handed". */
export function describeWeapon(weapon: WeaponDetail) {
  const critical =
    weapon.threat === undefined || weapon.mult === undefined
      ? null
      : `${weapon.threat === 20 ? '' : `${formatCriticalRange(weapon.threat)}/`}×${weapon.mult}`;
  const range =
    weapon.rangeIncrement === undefined ? null : `${weapon.rangeIncrement} ft.`;
  return [
    weapon.dice ?? null,
    critical,
    weapon.attackType === 'ranged'
      ? 'Ranged'
      : weapon.handedness
        ? handednessLabels[weapon.handedness]
        : null,
    range,
    weapon.thrown ? 'Thrown' : null,
  ]
    .filter((fact) => fact !== null)
    .join(' · ');
}

export const handsLabels = { one: 'One hand', two: 'Two hands' } as const;
export const modeLabels = {
  melee: 'Melee',
  ranged: 'Ranged',
  thrown: 'Thrown',
} as const;
