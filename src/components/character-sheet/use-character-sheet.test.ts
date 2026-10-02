import { act, renderHook, waitFor } from '@testing-library/react';
import { convexTest } from 'convex-test';
import { beforeEach, expect, test, vi } from 'vitest';
import { ConvexError } from 'convex/values';
import schema from '@convex/schema';
import {
  defaultAbilityScores,
  calculateCharacterSheet,
} from '~/lib/character-sheet';
import { useCharacterRecord } from '../character-manager/use-character-record';
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
    character: {
      updateCharacter: 'kind',
      createCharacter: 'legacyCreate',
      archiveCharacter: 'archive',
    },
    characterSheet: {
      read: 'read',
      editBaseScores: 'scores',
      editClassLevel: 'hp',
      addClassLevel: 'add',
      moveClassLevel: 'move',
      deleteClassLevel: 'delete',
      create: 'create',
      editCreationSettings: 'settings',
      acceptWarning: 'accept',
      reopenWarning: 'reopen',
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

async function fixture(acceptPointBuy = false) {
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
    const acceptedWarnings = [];
    if (acceptPointBuy) {
      const id = await ctx.db.insert('acceptedWarning', {
        characterId,
        check: 'pointBuy',
        subject: baseEntryId,
        fingerprint: 'spent-22-budget-15',
        acceptedBy: 'other-player',
        acceptedAt: 1,
      });
      const accepted = await ctx.db.get('acceptedWarning', id);
      if (accepted) acceptedWarnings.push(accepted);
    }
    return {
      character,
      entries: completeEntries,
      catalogEntries: [catalogEntry],
      baseScoresEntry: catalogEntry,
      calculated: calculateCharacterSheet({
        characterKind: character.kind,
        entries: completeEntries,
        catalogEntries: [catalogEntry],
      }),
      acceptedWarnings,
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

test('sheet rules warnings expose inline targets, preserve incomplete choices and localize refusal', async () => {
  snapshot = await fixture();
  const initial = snapshot;
  snapshot = {
    ...initial,
    calculated: {
      ...initial.calculated,
      warnings: [
        {
          kind: 'rules',
          check: 'pointBuy' as const,
          target: { kind: 'pointBuy' as const },
          subject: initial.entries[0]!._id,
          fingerprint: 'spent-22-budget-15',
          message: '22 points exceeds 15.',
        },
        {
          kind: 'incomplete',
          check: 'class',
          target: {
            kind: 'classLevel',
            entryId: initial.entries[1]!._id,
            field: 'class',
          },
          subject: initial.entries[1]!._id,
          fingerprint: 'class-unfilled',
          message: 'Choose a class.',
        },
      ],
    },
  };
  const view = renderHook(() =>
    useCharacterSheet({
      organizationId: 'org',
      characterId: initial.character._id,
    }),
  );
  const [rule, incomplete] = view.result.current.sheet!.warnings;
  if (!rule || !incomplete) throw new Error('Expected warnings');
  expect(rule).toMatchObject({ accepted: false, target: { kind: 'pointBuy' } });
  expect(incomplete).toMatchObject({
    accepted: false,
    target: {
      kind: 'classLevel',
      entryId: initial.entries[1]!._id,
      field: 'class',
    },
  });
  await act(async () => {
    await view.result.current.warnings.accept(incomplete);
  });
  expect(calls).toEqual([]);
  let pending: Promise<void> | undefined;
  act(() => {
    pending = view.result.current.warnings.accept(rule);
  });
  expect(view.result.current.warnings.statusFor(rule).kind).toBe('saving');
  expect(view.result.current.warnings.statusFor(incomplete).kind).toBe('idle');
  await act(async () => {
    calls[0]?.reject(new ConvexError('Editing is paused'));
    await pending;
  });
  expect(view.result.current.warnings.statusFor(rule)).toEqual({
    kind: 'error',
    message: "Warning wasn't saved: Editing is paused. Try again.",
  });
  expect(view.result.current.sheet!.warnings[0]?.accepted).toBe(false);
  expect(view.result.current.sheet!.calculated.hp).toBe(initial.calculated.hp);
});

test('remote acceptance is announced even when combined with an unrelated local save', async () => {
  const initial = await fixture(true);
  const calculated = {
    ...initial.calculated,
    warnings: [
      {
        kind: 'rules' as const,
        check: 'pointBuy' as const,
        target: { kind: 'pointBuy' as const },
        subject: initial.entries[0]!._id,
        fingerprint: 'spent-22-budget-15',
        message: '22 points exceeds 15.',
      },
    ],
  };
  snapshot = { ...initial, calculated, acceptedWarnings: [] };
  const view = renderHook(() =>
    useCharacterSheet({
      organizationId: 'org',
      characterId: initial.character._id,
    }),
  );
  let save: Promise<void> | undefined;
  act(() => {
    save = view.result.current.saveHitPoints(initial.entries[1]!._id, 10);
  });
  const operationId = calls[0]?.args.operationId;
  if (typeof operationId !== 'string') throw new Error('Expected operation ID');
  snapshot = { ...initial, calculated, lastOperationId: operationId };
  view.rerender();
  expect(view.result.current.sheet!.warnings[0]?.accepted).toBe(true);
  expect(view.result.current.warnings.hasRemoteChange).toBe(true);
  await act(async () => {
    calls[0]?.resolve(null);
    await save;
  });
});

test('own acceptance echoes stay quiet, unrelated edits preserve it and another player can reopen it', async () => {
  const initial = await fixture(true);
  const calculated = {
    ...initial.calculated,
    warnings: [
      {
        kind: 'rules' as const,
        check: 'pointBuy' as const,
        target: { kind: 'pointBuy' as const },
        subject: initial.entries[0]!._id,
        fingerprint: 'spent-22-budget-15',
        message: '22 points exceeds 15.',
      },
    ],
  };
  snapshot = { ...initial, calculated, acceptedWarnings: [] };
  const view = renderHook(() =>
    useCharacterSheet({
      organizationId: 'org',
      characterId: initial.character._id,
    }),
  );
  const warning = view.result.current.sheet!.warnings[0]!;
  let pending: Promise<void> | undefined;
  act(() => {
    pending = view.result.current.warnings.accept(warning);
  });
  const operationId = calls[0]?.args.operationId;
  if (typeof operationId !== 'string') throw new Error('Expected operation ID');
  snapshot = { ...initial, calculated, lastOperationId: operationId };
  view.rerender();
  expect(view.result.current.sheet!.warnings[0]?.accepted).toBe(true);
  expect(view.result.current.warnings.hasRemoteChange).toBe(false);
  await act(async () => {
    calls[0]?.resolve(null);
    await pending;
  });
  expect(view.result.current.warnings.statusFor(warning).kind).toBe('saved');
  snapshot = {
    ...snapshot,
    character: { ...initial.character, description: 'A new note' },
    lastOperationId: 'other-player-note',
  };
  view.rerender();
  expect(view.result.current.sheet!.warnings[0]?.accepted).toBe(true);
  expect(view.result.current.warnings.hasRemoteChange).toBe(false);
  snapshot = {
    ...snapshot,
    acceptedWarnings: [],
    lastOperationId: 'other-player-reopen',
  };
  view.rerender();
  expect(view.result.current.sheet!.warnings[0]?.accepted).toBe(false);
  expect(view.result.current.warnings.hasRemoteChange).toBe(true);
});

test('changed facts reopen a warning while an earlier acceptance is still pending', async () => {
  const initial = await fixture(true);
  const warning = {
    kind: 'rules' as const,
    check: 'pointBuy' as const,
    target: { kind: 'pointBuy' as const },
    subject: initial.entries[0]!._id,
    fingerprint: 'spent-22-budget-15',
    message: '22 points exceeds 15.',
  };
  snapshot = {
    ...initial,
    calculated: { ...initial.calculated, warnings: [warning] },
    acceptedWarnings: [],
  };
  const view = renderHook(() =>
    useCharacterSheet({
      organizationId: 'org',
      characterId: initial.character._id,
    }),
  );
  let pending: Promise<void> | undefined;
  act(() => {
    pending = view.result.current.warnings.accept(
      view.result.current.sheet!.warnings[0]!,
    );
  });
  snapshot = {
    ...initial,
    lastOperationId: 'other-player-scores',
    calculated: {
      ...initial.calculated,
      warnings: [
        {
          ...warning,
          fingerprint: 'spent-25-budget-15',
          message: '25 points exceeds 15.',
        },
      ],
    },
  };
  view.rerender();
  const changed = view.result.current.sheet!.warnings[0]!;
  expect(changed.accepted).toBe(false);
  expect(view.result.current.warnings.statusFor(changed).kind).toBe('idle');
  await act(async () => {
    calls[0]?.resolve(null);
    await pending;
  });
  expect(view.result.current.sheet!.warnings[0]?.accepted).toBe(false);
  expect(view.result.current.sheet!.calculated.hp).toBe(initial.calculated.hp);
});

test('an own acceptance echo combined with an unrelated remote edit is not a remote warning change', async () => {
  const initial = await fixture(true);
  const calculated = {
    ...initial.calculated,
    warnings: [
      {
        kind: 'rules' as const,
        check: 'pointBuy' as const,
        target: { kind: 'pointBuy' as const },
        subject: initial.entries[0]!._id,
        fingerprint: 'spent-22-budget-15',
        message: '22 points exceeds 15.',
      },
    ],
  };
  snapshot = { ...initial, calculated, acceptedWarnings: [] };
  const view = renderHook(() =>
    useCharacterSheet({
      organizationId: 'org',
      characterId: initial.character._id,
    }),
  );
  let pending: Promise<void> | undefined;
  act(() => {
    pending = view.result.current.warnings.accept(
      view.result.current.sheet!.warnings[0]!,
    );
  });
  snapshot = { ...initial, calculated, lastOperationId: 'remote-note-edit' };
  view.rerender();
  expect(view.result.current.sheet!.warnings[0]?.accepted).toBe(true);
  expect(view.result.current.warnings.hasRemoteChange).toBe(false);
  await act(async () => {
    calls[0]?.resolve(null);
    await pending;
  });
});

test('a coalesced reopen retires completed acceptance so a later remote acceptance is announced', async () => {
  const initial = await fixture(true);
  const calculated = {
    ...initial.calculated,
    warnings: [
      {
        kind: 'rules' as const,
        check: 'pointBuy' as const,
        target: { kind: 'pointBuy' as const },
        subject: initial.entries[0]!._id,
        fingerprint: 'spent-22-budget-15',
        message: '22 points exceeds 15.',
      },
    ],
  };
  snapshot = { ...initial, calculated, acceptedWarnings: [] };
  const view = renderHook(() =>
    useCharacterSheet({
      organizationId: 'org',
      characterId: initial.character._id,
    }),
  );
  let pending: Promise<void> | undefined;
  act(() => {
    pending = view.result.current.warnings.accept(
      view.result.current.sheet!.warnings[0]!,
    );
  });
  snapshot = { ...snapshot, revision: 3, lastOperationId: 'remote-reopen' };
  view.rerender();
  await act(async () => {
    calls[0]?.resolve(null);
    await pending;
  });
  expect(view.result.current.sheet!.warnings[0]?.accepted).toBe(false);
  snapshot = {
    ...initial,
    calculated,
    revision: 4,
    lastOperationId: 'later-remote-accept',
  };
  view.rerender();
  expect(view.result.current.sheet!.warnings[0]?.accepted).toBe(true);
  expect(view.result.current.warnings.hasRemoteChange).toBe(true);
});

test('an own echo after the save reply is acknowledged while the previous revision is still displayed', async () => {
  const initial = await fixture(true);
  const calculated = {
    ...initial.calculated,
    warnings: [
      {
        kind: 'rules' as const,
        check: 'pointBuy' as const,
        target: { kind: 'pointBuy' as const },
        subject: initial.entries[0]!._id,
        fingerprint: 'spent-22-budget-15',
        message: '22 points exceeds 15.',
      },
    ],
  };
  snapshot = { ...initial, calculated, acceptedWarnings: [] };
  const view = renderHook(() =>
    useCharacterSheet({
      organizationId: 'org',
      characterId: initial.character._id,
    }),
  );
  let pending: Promise<void> | undefined;
  act(() => {
    pending = view.result.current.warnings.accept(
      view.result.current.sheet!.warnings[0]!,
    );
  });
  const operationId = calls[0]?.args.operationId;
  if (typeof operationId !== 'string') throw new Error('Expected operation ID');
  await act(async () => {
    calls[0]?.resolve(null);
    await pending;
  });
  snapshot = {
    ...initial,
    calculated,
    revision: 2,
    lastOperationId: operationId,
  };
  view.rerender();
  expect(view.result.current.sheet!.warnings[0]?.accepted).toBe(true);
  expect(view.result.current.warnings.hasRemoteChange).toBe(false);
});

test.each(['own', 'another session'])(
  'a kind edit from %s reports warning changes only to other sessions',
  async (session) => {
    const seeded = await fixture();
    const entries = seeded.entries.filter((entry) => entry.kind === 'base');
    snapshot = {
      ...seeded,
      entries,
      calculated: calculateCharacterSheet({
        entries,
        catalogEntries: seeded.catalogEntries,
        characterKind: 'pc',
      }),
    };
    const initial = snapshot;
    const campaignId = initial.character.campaignId;
    if (!campaignId) throw new Error('Expected a campaign Character');
    const sheet = renderHook(() =>
      useCharacterSheet({
        organizationId: 'org',
        characterId: initial.character._id,
      }),
    );
    const record = renderHook(() =>
      useCharacterRecord({
        organizationId: 'org',
        campaignId,
        record: initial.character,
        onSaved: vi.fn(),
      }),
    );
    act(() => {
      record.result.current.form.setValue('kind', 'npc', { shouldDirty: true });
      record.result.current.save();
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    const call = calls[0]!;
    expect(call.name).toBe('kind');
    expect(call.args.operationId).toEqual(expect.any(String));
    snapshot = {
      ...initial,
      character: { ...initial.character, kind: 'npc' },
      calculated: calculateCharacterSheet({
        entries,
        catalogEntries: initial.catalogEntries,
        characterKind: 'npc',
      }),
      revision: 2,
      lastOperationId:
        session === 'own'
          ? String(call.args.operationId)
          : 'other-session:kind-edit',
      updatedBy: initial.updatedBy,
    };
    sheet.rerender();
    expect(
      sheet.result.current.sheet!.warnings.some(
        (warning) => warning.check === 'levelZero',
      ),
    ).toBe(false);
    expect(sheet.result.current.warnings.hasRemoteChange).toBe(
      session !== 'own',
    );
    await act(async () => call.resolve(null));
  },
);
