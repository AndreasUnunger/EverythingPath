import { act, renderHook } from '@testing-library/react';
import { getFunctionName } from 'convex/server';
import { ConvexError } from 'convex/values';
import { beforeEach, expect, test, vi } from 'vitest';
import { buildSheet } from './character-sheet-test-fixture';
import { useCharacterSheetSelections } from './use-character-sheet-selections';

const writes = vi.hoisted(() => ({
  fill: vi.fn(),
  clear: vi.fn(),
  edit: vi.fn(),
  settings: vi.fn(),
}));
vi.mock('convex/react', () => ({
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
    ({
      'characterSheet:fillSelectionSlot': writes.fill,
      'characterSheet:clearSelectionSlot': writes.clear,
      'characterSheet:editSelection': writes.edit,
      'characterSheet:editCreationSettings': writes.settings,
    })[getFunctionName(reference)],
}));
beforeEach(() =>
  Object.values(writes).forEach((write) =>
    write.mockReset().mockResolvedValue(null),
  ),
);

test('slot selection acknowledges saving at its position and preserves recorded-level choice order', async () => {
  const snapshot = buildSheet();
  const catalogEntryId = snapshot.catalogEntries[0]!._id;
  let finish: (() => void) | undefined;
  writes.fill.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = () => resolve('new-selection');
      }),
  );
  const view = renderHook(() =>
    useCharacterSheetSelections(
      { characterId: snapshot.character._id },
      snapshot,
    ),
  );
  let save: Promise<boolean> | undefined;
  act(() => {
    save = view.result.current.fill({
      slotId: 'feat:general',
      position: 0,
      catalogEntryId,
      gainedAtClassLevel: snapshot.entries[1]!._id,
      choiceOrder: 2,
    });
  });
  expect(view.result.current.statusForSlot('feat:general', 0)).toEqual({
    kind: 'saving',
  });
  expect(view.result.current.statusForSlot('feat:general', 1)).toEqual({
    kind: 'idle',
  });
  expect(writes.fill).toHaveBeenCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    slotId: 'feat:general',
    position: 0,
    catalogEntryId,
    gainedAtClassLevel: snapshot.entries[1]!._id,
    choiceOrder: 2,
  });
  await act(async () => {
    finish?.();
    expect(await save).toBe(true);
  });
  expect(view.result.current.statusForSlot('feat:general', 0)).toEqual({
    kind: 'saved',
  });
});

test('failed removal can be retried and reordering keeps the chosen entry identity', async () => {
  const snapshot = buildSheet();
  const entryId = snapshot.entries[1]!._id;
  writes.clear.mockRejectedValueOnce(new ConvexError('Character is read only'));
  const view = renderHook(() =>
    useCharacterSheetSelections(
      { characterId: snapshot.character._id },
      snapshot,
    ),
  );
  await act(async () => {
    expect(await view.result.current.remove(entryId)).toBe(false);
  });
  expect(view.result.current.statusForEntry(entryId)).toEqual({
    kind: 'error',
    message: "Selection wasn't saved: Character is read only. Try again.",
  });
  await act(async () => {
    expect(await view.result.current.remove(entryId)).toBe(true);
  });
  await act(async () => {
    expect(await view.result.current.edit(entryId, { choiceOrder: 1 })).toBe(
      true,
    );
  });
  expect(writes.edit).toHaveBeenCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    entryId,
    choiceOrder: 1,
  });
  expect(view.result.current.statusForEntry(entryId)).toEqual({
    kind: 'saved',
  });
});

test('switching Characters clears selection acknowledgements and ignores a late response', async () => {
  const initial = buildSheet();
  let finish: (() => void) | undefined;
  writes.clear.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = () => resolve(null);
      }),
  );
  const view = renderHook(
    ({ snapshot }) =>
      useCharacterSheetSelections(
        { characterId: snapshot.character._id },
        snapshot,
      ),
    { initialProps: { snapshot: initial } },
  );
  const entryId = initial.entries[1]!._id;
  let save: Promise<boolean> | undefined;
  act(() => {
    save = view.result.current.remove(entryId);
  });
  view.rerender({
    snapshot: {
      ...initial,
      character: {
        ...initial.character,
        _id: 'another-character' as typeof initial.character._id,
      },
    },
  });
  expect(view.result.current.statusForEntry(entryId)).toEqual({ kind: 'idle' });
  await act(async () => {
    finish?.();
    await save;
  });
  expect(view.result.current.statusForEntry(entryId)).toEqual({ kind: 'idle' });
});

test('another player’s feat definition edit is acknowledged while unrelated score changes are quiet', () => {
  const initial = buildSheet();
  const view = renderHook(
    ({ snapshot }) =>
      useCharacterSheetSelections(
        { characterId: snapshot.character._id },
        snapshot,
      ),
    { initialProps: { snapshot: initial } },
  );
  view.rerender({
    snapshot: buildSheet({
      scores: { ...initial.character, strength: 14 },
      lastOperationId: 'another-player',
    }),
  });
  expect(view.result.current.hasRemoteChange).toBe(false);
  view.rerender({
    snapshot: {
      ...initial,
      lastOperationId: 'another-player',
      catalogEntries: [
        ...initial.catalogEntries,
        {
          ...initial.baseScoresEntry,
          _id: 'feat-catalog' as typeof initial.baseScoresEntry._id,
          name: 'Power Attack',
          ruleIdentity: 'power-attack',
          detail: { kind: 'feat' },
        },
      ],
    },
  });
  expect(view.result.current.hasRemoteChange).toBe(true);
  act(() => view.result.current.dismissRemoteChange());
  expect(view.result.current.hasRemoteChange).toBe(false);
});

test('alignment and deity changes use the existing sheet settings writer and acknowledge the field group', async () => {
  const snapshot = buildSheet();
  const view = renderHook(() =>
    useCharacterSheetSelections(
      { characterId: snapshot.character._id },
      snapshot,
    ),
  );
  await act(async () => {
    expect(
      await view.result.current.saveFacts({
        alignment: 'LG',
        deity: 'Iomedae',
      }),
    ).toBe(true);
  });
  expect(writes.settings).toHaveBeenCalledWith({
    characterId: snapshot.character._id,
    operationId: expect.any(String),
    settings: {},
    alignment: 'LG',
    deity: 'Iomedae',
  });
  expect(view.result.current.factsStatus).toEqual({ kind: 'saved' });
});
