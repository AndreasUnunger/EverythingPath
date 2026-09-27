import { expect, test } from 'vitest';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import { editWeeklyDraft } from '~/lib/weekly-draft';
import { persistentEventFixture } from '../../../tests/rules/persistent-event-fixture';
import {
  checkModifiersEdit,
  clearRetainedEdit,
  modifierList,
  officerCheckEdit,
  removeRetainedTargetEdit,
  theftRollEdit,
  type Mitigation,
} from './persistent-check-edits';

const total = (value: number, modifiers: RawRoll['modifiers'] = []) =>
  ({
    diceTotal: value,
    diceCount: 1,
    sides: 20,
    provenance: { kind: 'generated', sourceId: 'roller' },
    modifiers,
  }) satisfies RawRoll;

// A check decision with every supported field an older editor could record.
const full: Mitigation = {
  kind: 'mitigate',
  eventId: 'carried',
  overseerCharacterId: 'pc',
  strategistCharacterId: 'pc',
  targets: [
    { kind: 'team', teamId: 'team' },
    { kind: 'settlement', settlementId: 'town' },
  ],
  rolls: {
    check: total(12, [{ sourceId: 'custom:a', value: 2, reason: 'Speech' }]),
  },
  officerCheck: {
    characterId: 'pc',
    skill: 'bluff',
    skillBonus: 3,
    roll: total(9, [{ sourceId: 'custom:b', value: 1, reason: 'Flattery' }]),
  },
};
const decision = (edit: ReturnType<typeof theftRollEdit> | null) => {
  if (edit?.kind !== 'persistent_decision') throw new Error('no edit');
  return edit.decision;
};

test('[PER-04.theft-roll] the Theft roll changes alone and a blank clears only it', () => {
  const next = decision(theftRollEdit(full, total(18)));
  expect(next).toEqual({ ...full, rolls: { check: total(18) } });
  const { rolls: _rolls, ...rest } = full;
  expect(decision(theftRollEdit(full, null))).toEqual(rest);
});

test('[PER-04.officer] each officer field keeps its siblings; a blank skill bonus or roll is cleared, never zeroed', () => {
  expect(
    decision(officerCheckEdit(full, { field: 'skill', value: 'intimidate' })),
  ).toEqual({
    ...full,
    officerCheck: { ...full.officerCheck, skill: 'intimidate' },
  });
  expect(
    decision(officerCheckEdit(full, { field: 'skillBonus', value: 0 })),
  ).toMatchObject({ officerCheck: { skillBonus: 0 } });
  const blank = decision(
    officerCheckEdit(full, { field: 'skillBonus', value: null }),
  );
  expect(blank).toEqual({
    ...full,
    officerCheck: {
      characterId: 'pc',
      skill: 'bluff',
      roll: full.officerCheck!.roll,
    },
  });
  const noRoll = decision(
    officerCheckEdit(full, { field: 'roll', value: null }),
  );
  expect(noRoll).toMatchObject({
    overseerCharacterId: 'pc',
    rolls: full.rolls,
  });
  expect(noRoll.kind === 'mitigate' && noRoll.officerCheck?.roll).toBe(
    undefined,
  );
});

test('[PER-04.officer-pending] a new officer check waits for both its character and its skill', () => {
  const empty: Mitigation = { kind: 'mitigate', eventId: 'rivalry' };
  expect(
    officerCheckEdit(empty, { field: 'characterId', value: 'pc' }),
  ).toBeNull();
  expect(
    officerCheckEdit(
      empty,
      { field: 'skillBonus', value: 2 },
      {
        characterId: 'pc',
      },
    ),
  ).toBeNull();
  expect(
    decision(
      officerCheckEdit(
        empty,
        { field: 'skill', value: 'diplomacy' },
        { characterId: 'pc' },
      ),
    ),
  ).toEqual({
    kind: 'mitigate',
    eventId: 'rivalry',
    officerCheck: { characterId: 'pc', skill: 'diplomacy' },
  });
});

test('[PER-04.modifiers] modifiers are added, edited in place with their source identity, and removed by position', () => {
  const added = modifierList(full, 'theft', {
    kind: 'add',
    modifier: { sourceId: 'custom:c', value: -1, reason: 'Rain' },
  })!;
  expect(added.map((entry) => entry.sourceId)).toEqual([
    'custom:a',
    'custom:c',
  ]);
  const edited = modifierList(full, 'rivalry', {
    kind: 'edit',
    index: 0,
    value: 4,
    reason: 'Better flattery',
  })!;
  expect(edited).toEqual([
    { sourceId: 'custom:b', value: 4, reason: 'Better flattery' },
  ]);
  expect(decision(checkModifiersEdit(full, 'rivalry', edited))).toEqual({
    ...full,
    officerCheck: {
      ...full.officerCheck,
      roll: { ...full.officerCheck!.roll!, modifiers: edited },
    },
  });
  expect(modifierList(full, 'theft', { kind: 'remove', index: 0 })).toEqual([]);
  expect(modifierList(full, 'theft', { kind: 'remove', index: 5 })).toBeNull();
  // A modifier belongs to its roll: nothing to change before the roll.
  const bare: Mitigation = { kind: 'mitigate', eventId: 'carried' };
  expect(
    modifierList(bare, 'theft', {
      kind: 'add',
      modifier: { sourceId: 'custom:c', value: 1, reason: 'Rain' },
    }),
  ).toBeNull();
  expect(checkModifiersEdit(bare, 'theft', [])).toBeNull();
});

test('[PER-04.retained-clear] a retained field or one target is removed deliberately; everything else stays', () => {
  const { strategistCharacterId: _strategist, ...rest } = full;
  expect(decision(clearRetainedEdit(full, 'strategistCharacterId'))).toEqual(
    rest,
  );
  expect(decision(removeRetainedTargetEdit(full, 0))).toEqual({
    ...full,
    targets: [{ kind: 'settlement', settlementId: 'town' }],
  });
  const { targets: _targets, ...untargeted } = full;
  expect(
    decision(
      removeRetainedTargetEdit({ ...full, targets: [full.targets![0]!] }, 0),
    ),
  ).toEqual(untargeted);
});

test('[PER-04.valid] every field edit is a valid persistent_decision for the draft', () => {
  const { draft } = persistentEventFixture('theft');
  for (const edit of [
    theftRollEdit(full, total(18)),
    officerCheckEdit(full, { field: 'skillBonus', value: -2 }),
    clearRetainedEdit(full, 'targets'),
  ])
    expect(editWeeklyDraft(draft, edit!).ok).toBe(true);
});
