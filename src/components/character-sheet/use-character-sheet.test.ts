import { act, renderHook } from '@testing-library/react';
import { convexTest } from 'convex-test';
import { beforeEach, expect, test, vi } from 'vitest';
import { ConvexError } from 'convex/values';
import schema from '@convex/schema';
import {
  defaultAbilityScores,
  calculateCharacterSheet,
} from '~/lib/character-sheet';
import { useCreateCharacterSheet } from './use-create-character-sheet';
import {
  useCharacterSheet,
  type CharacterSheetSnapshot,
} from './use-character-sheet';

let snapshot: CharacterSheetSnapshot | null | undefined;
type Call = {
  name: string;
  args: Record<string, unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};
let calls: Call[] = [];
vi.mock('@convex/_generated/api', () => ({
  api: {
    characterSheet: {
      read: 'read',
      editBaseScores: 'scores',
      editClassLevel: 'hp',
      addClassLevel: 'add',
      moveClassLevel: 'move',
      deleteClassLevel: 'delete',
      create: 'create',
    },
  },
}));
vi.mock('convex/react', () => ({
  useQuery: () => snapshot,
  useMutation: (name: string) => (args: Record<string, unknown>) =>
    new Promise((resolve, reject) => {
      calls.push({ name, args, resolve, reject });
    }),
}));

async function fixture() {
  const t = convexTest(schema, import.meta.glob('../../../convex/**/*.ts'));
  return await t.run(async (ctx) => {
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Demo',
      description: '',
      organizationId: 'org',
      ownerId: 'owner',
    });
    const characterId = await ctx.db.insert('character', {
      campaignId,
      name: 'Kesh',
      description: '',
      ownerId: 'owner',
      kind: 'pc',
      isActive: true,
      level: 1,
      ...defaultAbilityScores,
    });
    const baseId = await ctx.db.insert('catalogEntry', {
      characterId,
      scope: 'character',
      detail: { kind: 'base' },
      ruleIdentity: 'base-scores',
      stacksWithItself: false,
      sources: [],
      name: 'Base scores',
      modifiers: [
        { target: 'ability.str', bonusType: 'base', value: 10 },
        { target: 'ability.dex', bonusType: 'base', value: 10 },
        { target: 'ability.con', bonusType: 'base', value: 10 },
        { target: 'ability.int', bonusType: 'base', value: 10 },
        { target: 'ability.wis', bonusType: 'base', value: 10 },
        { target: 'ability.cha', bonusType: 'base', value: 10 },
      ],
    });
    const baseEntryId = await ctx.db.insert('characterSheetEntry', {
      characterId,
      kind: 'base',
      active: true,
      catalogEntryId: baseId,
      state: {
        kind: 'base',
      },
    });
    const firstId = await ctx.db.insert('characterSheetEntry', {
      characterId,
      kind: 'classLevel',
      active: true,
      state: {
        kind: 'classLevel',
        classEntryId: null,
        position: 1,
        hpGained: 8,
      },
    });
    const secondId = await ctx.db.insert('characterSheetEntry', {
      characterId,
      kind: 'classLevel',
      active: true,
      state: {
        kind: 'classLevel',
        classEntryId: null,
        position: 2,
        hpGained: 5,
      },
    });
    const character = await ctx.db.get('character', characterId);
    const catalogEntry = await ctx.db.get('catalogEntry', baseId);
    const entries = await Promise.all(
      [baseEntryId, firstId, secondId].map((id) =>
        ctx.db.get('characterSheetEntry', id),
      ),
    );
    if (!character || !catalogEntry || entries.some((entry) => entry === null))
      throw new Error('Fixture missing');
    const completeEntries = entries.filter((entry) => entry !== null);
    return {
      character,
      entries: completeEntries,
      catalogEntries: [catalogEntry],
      baseScoresEntry: catalogEntry,
      calculated: calculateCharacterSheet({
        entries: completeEntries,
        catalogEntries: [catalogEntry],
      }),
      revision: 1,
      lastOperationId: 'seed',
      updatedBy: 'owner',
    };
  });
}

beforeEach(() => {
  calls = [];
  snapshot = undefined;
});

test('the shared sheet exposes ordered stable level identities and localizes a rejected move', async () => {
  snapshot = await fixture();
  const initial = snapshot;
  const view = renderHook(() =>
    useCharacterSheet({
      organizationId: 'org',
      characterId: initial.character._id,
    }),
  );
  const [first, second] = view.result.current.sheet?.levels ?? [];
  if (!first || !second) throw new Error('Expected two levels');
  let move: Promise<void> | undefined;
  act(() => {
    move = view.result.current.levels.move(second._id, 1);
  });
  expect(view.result.current.levels.status.kind).toBe('saving');
  await act(async () => {
    calls[0]?.reject(new ConvexError('Move refused'));
    await move;
  });
  expect(view.result.current.levels.status).toEqual({
    kind: 'error',
    message: "Class Levels weren't saved: Move refused. Try again.",
  });
  expect(view.result.current.sheet?.levels.map((row) => row._id)).toEqual([
    first._id,
    second._id,
  ]);
});

test('a remote reorder carries row HP with its identity, and deleting the final level leaves a warning', async () => {
  snapshot = await fixture();
  const initial = snapshot;
  const view = renderHook(() =>
    useCharacterSheet({
      organizationId: 'org',
      characterId: initial.character._id,
    }),
  );
  const originals = view.result.current.sheet?.levels ?? [];
  snapshot = {
    ...initial,
    revision: 2,
    lastOperationId: 'other-player',
    entries: [...initial.entries].reverse().map((entry) =>
      entry.kind === 'classLevel'
        ? {
            ...entry,
            state: { ...entry.state, position: 3 - entry.state.position },
          }
        : entry,
    ),
  };
  view.rerender();
  expect(
    view.result.current.sheet?.levels.map((entry) => [
      entry._id,
      entry.state.hpGained,
    ]),
  ).toEqual([
    [originals[1]?._id, 5],
    [originals[0]?._id, 8],
  ]);
  expect(view.result.current.levels.hasRemoteChange).toBe(true);
  snapshot = {
    ...snapshot,
    revision: 3,
    lastOperationId: 'delete-other',
    entries: initial.entries.filter((entry) => entry.kind === 'base'),
    calculated: { ...initial.calculated, level: 0, hitDice: 0, hp: 0 },
  };
  view.rerender();
  expect(view.result.current.sheet?.calculated.level).toBe(0);
  expect(view.result.current.sheet?.calculated.hp).toBe(0);
  expect(view.result.current.sheet?.warning).toBe(
    'This PC has no Class Levels.',
  );
});

test('a local move waits once and its own echo never reports another player', async () => {
  snapshot = await fixture();
  const initial = snapshot;
  const view = renderHook(() =>
    useCharacterSheet({
      organizationId: 'org',
      characterId: initial.character._id,
    }),
  );
  const second = view.result.current.sheet?.levels[1];
  if (!second) throw new Error('Expected level');
  let pending: Promise<void> | undefined;
  act(() => {
    pending = view.result.current.levels.move(second._id, 1);
  });
  await act(async () => {
    await view.result.current.levels.remove(second._id);
  });
  expect(calls).toHaveLength(1);
  const operationId = calls[0]?.args.operationId;
  if (typeof operationId !== 'string') throw new Error('Expected operation ID');
  snapshot = {
    ...initial,
    revision: 2,
    lastOperationId: operationId,
    entries: [...initial.entries].reverse().map((entry) =>
      entry.kind === 'classLevel'
        ? {
            ...entry,
            state: { ...entry.state, position: 3 - entry.state.position },
          }
        : entry,
    ),
  };
  view.rerender();
  expect(view.result.current.levels.hasRemoteChange).toBe(false);
  await act(async () => {
    calls[0]?.resolve(null);
    await pending;
  });
  expect(view.result.current.levels.status.kind).toBe('saved');
});

test('creation validates the name, holds one pending request and opens the created sheet', async () => {
  const initial = await fixture();
  const opened: string[] = [];
  const view = renderHook(() =>
    useCreateCharacterSheet({
      organizationId: 'org',
      campaignId: initial.character.campaignId,
      onCreated: (id) => {
        opened.push(id);
      },
    }),
  );
  await act(async () => {
    await view.result.current.create();
  });
  expect(view.result.current.form.formState.errors.name?.message).toBe(
    'Character name is required',
  );
  expect(calls).toHaveLength(0);
  act(() =>
    view.result.current.form.setValue('name', 'New hero', {
      shouldDirty: true,
    }),
  );
  let pending: Promise<void> | undefined;
  await act(async () => {
    pending = view.result.current.create();
  });
  await act(async () => {
    await view.result.current.create();
  });
  expect(calls).toHaveLength(1);
  expect(view.result.current.status.kind).toBe('saving');
  await act(async () => {
    calls[0]?.resolve(initial.character._id);
    await pending;
  });
  expect(opened).toEqual([initial.character._id]);
});
