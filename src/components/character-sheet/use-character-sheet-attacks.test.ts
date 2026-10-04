import {
  calculateFixtureSheet as calculateCharacterSheet,
  buildSheet,
} from './character-sheet-test-fixture';
import { act, renderHook } from '@testing-library/react';
import { getFunctionName } from 'convex/server';
import { ConvexError } from 'convex/values';
import { beforeEach, expect, test, vi } from 'vitest';

import { useCharacterSheetAttacks } from './use-character-sheet-attacks';

const writes = vi.hoisted(() => ({
  select: vi.fn(),
  create: vi.fn(),
  edit: vi.fn(),
  remove: vi.fn(),
  restore: vi.fn(),
  equipment: vi.fn(),
}));
vi.mock('convex/react', () => ({
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
    ({
      'characterSheet:createAttackRoutine': writes.create,
      'characterSheet:editAttackRoutine': writes.edit,
      'characterSheet:deleteAttackRoutine': writes.remove,
      'characterSheet:restoreAttackRoutine': writes.restore,
      'characterSheet:selectEntry': writes.select,
      'characterSheet:editEquipment': writes.equipment,
    })[getFunctionName(reference)],
}));
beforeEach(() =>
  Object.values(writes).forEach((write) =>
    write.mockReset().mockResolvedValue(null),
  ),
);

function weaponSheet() {
  const snapshot = buildSheet({
    adjustments: [
      { id: 'routine', name: 'Routine placeholder', modifiers: [] },
    ],
    sheetEntries: [
      {
        id: 'sword',
        name: 'Longsword',
        detail: {
          kind: 'item',
          consumable: false,
          weapon: {
            baseType: 'longsword',
            proficiency: 'martial',
            handedness: 'oneHanded',
            dice: '1d8',
            damageTypes: ['slashing'],
            threat: 19,
            mult: 2,
          },
        },
        modifiers: [],
      },
    ],
  });
  const sword = snapshot.entries.find((entry) => entry._id === 'sword');
  if (!sword) throw new Error('Missing sword');
  snapshot.entries = snapshot.entries.map((entry) =>
    entry._id === 'routine'
      ? {
          _id: entry._id,
          _creationTime: entry._creationTime,
          characterId: entry.characterId,
          kind: 'attackRoutine',
          active: true,
          state: {
            kind: 'attackRoutine',
            name: 'Sword strike',
            weaponEntryId: sword._id,
            hands: 'one',
            mode: 'melee',
            revision: 0,
          },
        }
      : entry,
  );
  snapshot.calculated = calculateCharacterSheet({
    entries: snapshot.entries,
    catalogEntries: snapshot.catalogEntries,
    characterKind: 'pc',
  });
  return snapshot;
}

test('routine rows expose resolver lines and save sequential edits with the latest change winning', async () => {
  const snapshot = weaponSheet();
  const view = renderHook(() =>
    useCharacterSheetAttacks({ characterId: snapshot.character._id }, snapshot),
  );
  const row = view.result.current.rows[0];
  expect(row).toMatchObject({
    name: 'Sword strike',
    weaponEntryId: 'sword',
    revision: 0,
  });
  expect(row?.single[0]?.attackBonus.total).toBe(-4);
  expect(row?.singleView[0]).toMatchObject({
    attack: {
      text: '−4',
      target: {
        kind: 'attackRoutine',
        entryId: 'routine',
        sequence: 'single',
        attackIndex: 0,
        statistic: 'attackBonus',
      },
    },
    damage: { text: '1d8', diceSource: { sheetEntryId: 'sword' } },
    critical: { text: '19–20/×2' },
    range: null,
  });
  expect(view.result.current.weapons).toMatchObject([
    { entryId: 'sword', label: 'Longsword' },
  ]);
  writes.edit.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
  await view.result.current.edit('routine', { name: 'New strike' });
  await view.result.current.edit('routine', { hands: 'two' });
  for (const [args] of writes.edit.mock.calls)
    expect(args).not.toHaveProperty('expectedRevision');
  expect(writes.edit).toHaveBeenLastCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    entryId: 'routine',
    hands: 'two',
  });
});

test('routine edits retain off-hand choices and weapon-end writes target only their selected end', async () => {
  const snapshot = weaponSheet();
  const view = renderHook(() =>
    useCharacterSheetAttacks({ characterId: snapshot.character._id }, snapshot),
  );
  await view.result.current.edit('routine', {
    offHand: { kind: 'otherEnd', mode: 'melee' },
  });
  expect(writes.edit).toHaveBeenLastCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    entryId: 'routine',
    offHand: { kind: 'otherEnd', mode: 'melee' },
  });
  await view.result.current.edit('routine', { offHand: null });
  expect(writes.edit.mock.lastCall?.[0]).toMatchObject({ offHand: null });
  await view.result.current.saveWeaponEnd('sword', 'otherEnd', {
    enhancement: 2,
  });
  expect(writes.equipment).toHaveBeenLastCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    entryId: 'sword',
    end: 'otherEnd',
    enhancement: 2,
  });
  expect(view.result.current.weapons[0]).toMatchObject({
    primaryState: { masterwork: false, enhancement: 0, material: null },
    otherEndState: { masterwork: false, enhancement: 0, material: null },
  });
});

test('the catalog weapon picker selects its existing definition and lets the server add the default routine', async () => {
  const snapshot = weaponSheet();
  const view = renderHook(() =>
    useCharacterSheetAttacks({ characterId: snapshot.character._id }, snapshot),
  );
  const choice = view.result.current.weaponCatalog[0];
  expect(choice?.label).toBe('Longsword');
  if (!choice) throw new Error('Missing weapon choice');
  await act(async () => {
    expect(await view.result.current.addWeapon(choice.catalogEntryId)).toBe(
      true,
    );
  });
  expect(writes.select).toHaveBeenLastCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    catalogEntryId: choice.catalogEntryId,
  });
  expect(writes.create).not.toHaveBeenCalled();
});

test('missing weapons keep the routine, and a remote edit leaves the next write available', async () => {
  const snapshot = weaponSheet();
  const view = renderHook(
    ({ incoming }) =>
      useCharacterSheetAttacks(
        { characterId: incoming.character._id },
        incoming,
      ),
    { initialProps: { incoming: snapshot } },
  );
  const entries = snapshot.entries
    .filter((entry) => entry._id !== 'sword')
    .map((entry) =>
      entry.kind === 'attackRoutine'
        ? {
            ...entry,
            state: { ...entry.state, name: 'Remote strike', revision: 4 },
          }
        : entry,
    );
  view.rerender({
    incoming: {
      ...snapshot,
      entries,
      lastOperationId: 'other-player',
      calculated: calculateCharacterSheet({
        entries,
        catalogEntries: snapshot.catalogEntries,
        characterKind: 'pc',
      }),
    },
  });
  expect(view.result.current.rows[0]).toMatchObject({
    entryId: 'routine',
    name: 'Remote strike',
    single: [],
    full: [],
    warnings: [{ check: 'missingAttackWeapon' }],
  });
  expect(view.result.current.hasRemoteChange).toBe(true);
  writes.edit.mockResolvedValueOnce(5);
  await view.result.current.edit('routine', { name: 'Retained strike' });
  expect(writes.edit.mock.lastCall?.[0]).not.toHaveProperty('expectedRevision');
  expect(writes.edit.mock.lastCall?.[0]).toMatchObject({
    entryId: 'routine',
    name: 'Retained strike',
  });
});

test('a no-op acknowledgement leaves editing available and a failed delete offers no Undo', async () => {
  const snapshot = weaponSheet();
  const view = renderHook(() =>
    useCharacterSheetAttacks({ characterId: snapshot.character._id }, snapshot),
  );
  writes.edit.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
  await view.result.current.edit('routine', { name: 'Sword strike' });
  await view.result.current.edit('routine', { name: 'Another strike' });
  expect(writes.edit.mock.calls.map(([args]) => args.name)).toEqual([
    'Sword strike',
    'Another strike',
  ]);
  writes.remove.mockRejectedValueOnce(
    new ConvexError('Attack Routine changed'),
  );
  await act(async () => {
    expect(await view.result.current.remove('routine')).toBe(false);
  });
  expect(view.result.current.removed).toBeNull();
  expect(view.result.current.statusFor('routine').kind).toBe('error');
});

test('remove preserves an undo receipt through the query echo and Undo restores the same routine', async () => {
  const snapshot = weaponSheet();
  writes.remove.mockResolvedValueOnce(1);
  writes.restore
    .mockRejectedValueOnce(new ConvexError('Character is read only'))
    .mockResolvedValueOnce(2);
  const view = renderHook(
    ({ incoming }) =>
      useCharacterSheetAttacks(
        { characterId: incoming.character._id },
        incoming,
      ),
    { initialProps: { incoming: snapshot } },
  );
  await act(async () => {
    expect(await view.result.current.remove('routine')).toBe(true);
  });
  expect(view.result.current.removed).toMatchObject({
    entryId: 'routine',
    name: 'Sword strike',
    revision: 1,
  });
  const entries = snapshot.entries.map((entry) =>
    entry.kind === 'attackRoutine'
      ? {
          ...entry,
          active: false,
          state: { ...entry.state, revision: 1 },
        }
      : entry,
  );
  view.rerender({
    incoming: {
      ...snapshot,
      entries,
      calculated: calculateCharacterSheet({
        entries,
        catalogEntries: snapshot.catalogEntries,
        characterKind: 'pc',
      }),
    },
  });
  expect(view.result.current.rows).toEqual([]);
  await act(async () => {
    expect(await view.result.current.undo()).toBe(false);
  });
  expect(view.result.current.removed?.entryId).toBe('routine');
  expect(view.result.current.statusFor('undo').kind).toBe('error');
  await act(async () => {
    expect(await view.result.current.undo()).toBe(true);
  });
  expect(writes.restore.mock.lastCall?.[0]).not.toHaveProperty(
    'expectedRevision',
  );
  expect(writes.restore).toHaveBeenLastCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    entryId: 'routine',
  });
  expect(view.result.current.removed).toBeNull();
});
