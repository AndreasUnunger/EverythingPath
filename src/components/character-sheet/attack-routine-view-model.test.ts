import { expect, test } from 'vitest';
import { buildSheet } from './character-sheet-test-fixture';
import {
  attackOffHandChoiceValue,
  attackRoutineLineView,
  listAttackRoutineOffHands,
  listAttackRoutineRows,
  listAttackRoutineWeapons,
} from './attack-routine-view-model';

test('an off-hand double-end line keeps its own damage, critical and full-attack breakdown address', () => {
  const snapshot = buildSheet({
    sheetEntries: [
      {
        id: 'staff',
        name: 'Quarterstaff',
        modifiers: [],
        detail: {
          kind: 'item',
          consumable: false,
          weapon: {
            baseType: 'quarterstaff',
            proficiency: 'simple',
            handedness: 'twoHanded',
            dice: '1d6',
            threat: 20,
            mult: 2,
            otherEnd: { dice: '1d8', threat: 19, mult: 3 },
          },
        },
      },
    ],
    attackRoutines: [{ id: 'routine', name: 'Staff', weaponEntryId: 'staff' }],
  });
  const line = listAttackRoutineRows(snapshot)[0]?.single[0];
  if (!line) throw new Error('Missing attack line');
  const view = attackRoutineLineView({
    entryId: 'routine',
    sequence: 'full',
    attackIndex: 2,
    line: {
      ...line,
      hand: 'off',
      end: 'otherEnd',
      damageDice: '1d8',
      criticalThreat: { ...line.criticalThreat, total: 19 },
      criticalMultiplier: { ...line.criticalMultiplier, total: 3 },
    },
  });
  expect(view).toMatchObject({
    hand: 'off',
    end: 'otherEnd',
    handLabel: 'Off hand',
    endLabel: 'Other end',
    position: 3,
    damage: {
      text: '1d8',
      target: {
        kind: 'attackRoutine',
        entryId: 'routine',
        sequence: 'full',
        attackIndex: 2,
        statistic: 'damageBonus',
      },
    },
    critical: { text: '19–20/×3' },
  });
  expect(
    listAttackRoutineOffHands(listAttackRoutineWeapons(snapshot), 'staff'),
  ).toMatchObject([
    {
      choice: { kind: 'otherEnd' },
      label: 'Other end of Quarterstaff',
      weapon: {
        dice: '1d8',
        threat: 19,
        mult: 3,
        handedness: 'light',
      },
    },
    {
      choice: { kind: 'weapon', weaponEntryId: 'staff' },
      label: 'Quarterstaff',
    },
  ]);
});

test('a weapon ID cannot select the other-end card', () => {
  expect(
    attackOffHandChoiceValue({ kind: 'weapon', weaponEntryId: 'otherEnd' }),
  ).toBe('weapon:otherEnd');
  expect(attackOffHandChoiceValue({ kind: 'otherEnd' })).toBe('end:otherEnd');
});
