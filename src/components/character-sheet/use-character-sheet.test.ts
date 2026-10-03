import { useClassLevelChoicesForm } from './use-sheet-forms';
import { act, renderHook, waitFor } from '@testing-library/react';
import { convexTest } from 'convex-test';
import { beforeEach, expect, test, vi } from 'vitest';
import { ConvexError } from 'convex/values';
import schema from '@convex/schema';
import {
  defaultAbilityScores,
  defaultCreationSettings,
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
      buildOut: 'buildOut',
      editCreationSettings: 'settings',
      acceptWarning: 'accept',
      reopenWarning: 'reopen',
      createPersonalAdjustment: 'createAdjustment',
      editPersonalAdjustment: 'editAdjustment',
      removePersonalAdjustment: 'removeAdjustment',
      createAbilityChange: 'createAbilityChange',
      editAbilityChange: 'editAbilityChange',
      removeAbilityChange: 'removeAbilityChange',
      createSheetEntry: 'createSheetEntry',
      editSheetEntry: 'editSheetEntry',
      removeSheetEntry: 'removeSheetEntry',
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

function isBaseCatalogEntry(
  entry: CharacterSheetSnapshot['catalogEntries'][number],
): entry is CharacterSheetSnapshot['baseScoresEntry'] {
  return entry.detail.kind === 'base';
}

vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => ({
    kind: 'ready',
    readOnly: false,
    message: '',
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
    const adjustmentId = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Bull strength',
      ruleIdentity: 'manual:strength',
      stacksWithItself: false,
      detail: { kind: 'manual' },
      sources: [],
      modifiers: [
        { target: 'ability.str', bonusType: 'enhancement', value: 4 },
      ],
    });
    const adjustmentEntryId = await ctx.db.insert('characterSheetEntry', {
      characterId,
      kind: 'manual',
      active: true,
      catalogEntryId: adjustmentId,
      state: { kind: 'manual' },
    });
    const adjustment = await ctx.db.get('catalogEntry', adjustmentId);
    if (!adjustment) throw new Error('Missing adjustment');
    const character = await ctx.db.get('character', characterId);
    const catalogEntry = await ctx.db.get('catalogEntry', baseId);
    const entries = await Promise.all(
      [baseEntryId, firstId, secondId, adjustmentEntryId].map((id) =>
        ctx.db.get('characterSheetEntry', id),
      ),
    );
    if (
      !character ||
      !catalogEntry ||
      !isBaseCatalogEntry(catalogEntry) ||
      entries.some((entry) => entry === null)
    )
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
      owner: null,
      campaign: {
        campaignId,
        campaignName: 'Demo',
        organizationId: 'org',
        ownershipAvailable: true,
      },
      entries: completeEntries,
      catalogEntries: [catalogEntry, adjustment],
      baseScoresEntry: catalogEntry,
      calculated: calculateCharacterSheet({
        characterKind: character.kind,
        entries: completeEntries,
        catalogEntries: [catalogEntry, adjustment],
      }),
      permanentCalculated: calculateCharacterSheet(
        {
          characterKind: character.kind,
          entries: completeEntries,
          catalogEntries: [catalogEntry, adjustment],
        },
        { permanentOnly: true },
      ),
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
    calculated: calculateCharacterSheet({
      entries: initial.entries.filter((entry) => entry.kind === 'base'),
      catalogEntries: initial.catalogEntries,
      characterKind: 'pc',
    }),
  };
  view.rerender();
  expect(view.result.current.sheet?.calculated.level).toBe(0);
  expect(view.result.current.sheet?.calculated.hp).toBe(0);
  expect(view.result.current.sheet?.warning).toBeNull();
  expect(view.result.current.sheet?.warnings).toContainEqual(
    expect.objectContaining({
      check: 'levelZero',
      message: 'A PC has no Class Levels.',
    }),
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
      permanentCalculated: calculateCharacterSheet(
        {
          entries,
          catalogEntries: seeded.catalogEntries,
          characterKind: 'pc',
        },
        { permanentOnly: true },
      ),
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
        record: {
          ...initial.character,
          owner: initial.owner,
          ownershipAvailable: initial.campaign?.ownershipAvailable ?? false,
        },
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
      permanentCalculated: calculateCharacterSheet(
        {
          entries,
          catalogEntries: initial.catalogEntries,
          characterKind: 'npc',
        },
        { permanentOnly: true },
      ),
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

test('a personal Strength adjustment changes the total without changing base scores or point buy', async () => {
  // CRB Ability Scores: point buy purchases the base score before other adjustments.
  const initial = await fixture();
  const entries = initial.entries.map((entry) =>
    entry.kind === 'base'
      ? { ...entry, state: { ...entry.state, ...defaultCreationSettings } }
      : entry,
  );
  const catalogEntries = initial.catalogEntries.map((entry) =>
    entry.detail.kind === 'manual'
      ? {
          ...entry,
          detail: { kind: 'manual' as const },
          modifiers: [
            {
              target: 'ability.str' as const,
              bonusType: 'enhancement' as const,
              value: 2,
            },
          ],
        }
      : entry,
  );
  snapshot = {
    ...initial,
    entries,
    catalogEntries,
    calculated: calculateCharacterSheet({
      entries,
      catalogEntries,
      characterKind: 'pc',
    }),
    permanentCalculated: calculateCharacterSheet(
      {
        entries,
        catalogEntries,
        characterKind: 'pc',
      },
      { permanentOnly: true },
    ),
  };
  const view = renderHook(() =>
    useCharacterSheet({ organizationId: 'org', characterId: 'hero' }),
  );
  expect(view.result.current.sheet?.baseScores.strength).toBe(10);
  expect(view.result.current.sheet?.calculated.abilities.strength.score).toBe(
    12,
  );
  expect(view.result.current.sheet?.calculated.pointBuy?.spent).toBe(0);
});

test('personal adjustments expose their saved definition and keep refused changes local', async () => {
  snapshot = await fixture();
  const view = renderHook(() =>
    useCharacterSheet({ organizationId: 'org', characterId: 'hero' }),
  );
  const adjustment = view.result.current.sheet?.adjustments[0];
  if (!adjustment) throw new Error('Expected adjustment');
  expect(adjustment.name).toBe('Bull strength');
  expect(adjustment.modifiers).toEqual([
    { target: 'ability.str', bonusType: 'enhancement', value: 4 },
  ]);
  let pending: Promise<void> | undefined;
  act(() => {
    pending = view.result.current.adjustments.setActive(
      adjustment.entryId,
      false,
    );
  });
  expect(view.result.current.adjustments.status.kind).toBe('saving');
  expect(calls[0]?.args).toMatchObject({
    entryId: adjustment.entryId,
    active: false,
  });
  expect(calls[0]?.args).not.toHaveProperty('name');
  expect(calls[0]?.args).not.toHaveProperty('modifiers');
  await act(async () => {
    calls[0]?.reject(new ConvexError('Editing is paused'));
    await pending;
  });
  expect(view.result.current.adjustments.status).toEqual({
    kind: 'error',
    message: "Personal adjustment wasn't saved: Editing is paused. Try again.",
  });
  expect(view.result.current.sheet?.adjustments[0]?.active).toBe(true);
});

test('adjustment changes from another player are marked while own echoes stay quiet', async () => {
  snapshot = await fixture();
  const initial = snapshot;
  const view = renderHook(() =>
    useCharacterSheet({ organizationId: 'org', characterId: 'hero' }),
  );
  const adjustment = view.result.current.sheet?.adjustments[0];
  if (!adjustment) throw new Error('Expected adjustment');
  let pending: Promise<void> | undefined;
  act(() => {
    pending = view.result.current.adjustments.setActive(
      adjustment.entryId,
      false,
    );
  });
  const operationId = calls[0]?.args.operationId;
  if (typeof operationId !== 'string') throw new Error('Expected operation ID');
  snapshot = {
    ...initial,
    revision: 2,
    lastOperationId: operationId,
    entries: initial.entries.map((entry) =>
      entry.kind === 'manual' ? { ...entry, active: false } : entry,
    ),
  };
  view.rerender();
  expect(view.result.current.adjustments.hasRemoteChange).toBe(false);
  await act(async () => {
    calls[0]?.resolve(null);
    await pending;
  });
  expect(view.result.current.adjustments.status.kind).toBe('saved');
  snapshot = {
    ...snapshot,
    revision: 3,
    lastOperationId: 'other-player',
    catalogEntries: snapshot.catalogEntries.map((entry) =>
      entry.detail.kind === 'manual'
        ? { ...entry, name: 'Updated strength' }
        : entry,
    ),
  };
  view.rerender();
  expect(view.result.current.adjustments.hasRemoteChange).toBe(true);
  expect(view.result.current.sheet?.adjustments[0]?.name).toBe(
    'Updated strength',
  );
  act(() => view.result.current.adjustments.dismissRemoteChange());
  expect(view.result.current.adjustments.hasRemoteChange).toBe(false);
});

test('a minimal sheet offers Build out and shows only the structured level-zero warning', async () => {
  const initial = await fixture(true);
  const entries = initial.entries.filter((entry) => entry.kind === 'base');
  snapshot = {
    ...initial,
    character: { ...initial.character, sheetMode: 'militiaOnly' },
    entries,
    calculated: calculateCharacterSheet({
      entries,
      catalogEntries: initial.catalogEntries,
      characterKind: 'pc',
      sheetMode: 'militiaOnly',
    }),
  };
  const view = renderHook(() =>
    useCharacterSheet({
      organizationId: 'org',
      characterId: initial.character._id,
    }),
  );
  expect(view.result.current.sheet?.warnings).toEqual([
    expect.objectContaining({
      check: 'levelZero',
      target: { kind: 'classLevels' },
      accepted: false,
    }),
  ]);
  expect(view.result.current.sheet?.showMissingChoices).toBe(false);
  expect(view.result.current.sheet?.warning).toBe('A PC has no Class Levels.');
  expect(view.result.current.buildOut.available).toBe(true);
  snapshot = {
    ...snapshot,
    character: { ...snapshot.character, kind: 'npc' },
    calculated: calculateCharacterSheet({
      entries,
      catalogEntries: initial.catalogEntries,
      characterKind: 'npc',
      sheetMode: 'militiaOnly',
    }),
  };
  view.rerender();
  expect(view.result.current.sheet?.warnings).toEqual([]);
  expect(view.result.current.sheet?.warning).toBeNull();
});

test.each(['own', 'another session'])(
  'Build out from %s announces new warnings only to other sessions',
  async (session) => {
    const initial = await fixture();
    snapshot = {
      ...initial,
      character: { ...initial.character, sheetMode: 'militiaOnly' },
      calculated: calculateCharacterSheet({
        ...initial,
        characterKind: initial.character.kind,
        sheetMode: 'militiaOnly',
      }),
    };
    const view = renderHook(() =>
      useCharacterSheet({
        organizationId: 'org',
        characterId: initial.character._id,
      }),
    );
    expect(view.result.current.sheet?.warnings).toEqual([]);
    let pending: Promise<unknown> | undefined;
    act(() => {
      pending = view.result.current.buildOut.run();
    });
    const call = required(calls[0]);
    expect(call.name).toBe('buildOut');
    snapshot = {
      ...initial,
      character: { ...initial.character, sheetMode: 'full' },
      revision: 2,
      lastOperationId:
        session === 'own'
          ? String(call.args.operationId)
          : 'other-session:build-out',
    };
    view.rerender();
    expect(view.result.current.sheet?.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          check: 'class',
          target: {
            kind: 'classLevel',
            entryId: required(initial.entries[1])._id,
            field: 'class',
          },
        }),
      ]),
    );
    expect(view.result.current.sheet?.showMissingChoices).toBe(true);
    expect(view.result.current.buildOut.available).toBe(false);
    expect(view.result.current.warnings.hasRemoteChange).toBe(
      session !== 'own',
    );
    await act(async () => {
      call.resolve(null);
      await pending;
    });
  },
);

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined)
    throw new Error('Expected fixture value');
  return value;
}

test('Character Sheet Entries and ability changes expose save acknowledgements and localize refused writes', async () => {
  snapshot = await fixture();
  const initial = snapshot;
  const view = renderHook(() =>
    useCharacterSheet({
      organizationId: 'org',
      characterId: initial.character._id,
    }),
  );
  expect(
    view.result.current.sheet?.permanentCalculated.abilities.strength.score,
  ).toBe(14);
  let pending: Promise<boolean> | undefined;
  act(() => {
    pending = view.result.current.abilityChanges.setActive(
      initial.entries[0]!._id,
      false,
    );
  });
  expect(view.result.current.abilityChanges.status.kind).toBe('saving');
  expect(calls[0]?.name).toBe('editAbilityChange');
  await act(async () => {
    calls[0]?.reject(new ConvexError('Editing is paused'));
    await pending;
  });
  expect(view.result.current.abilityChanges.status.kind).toBe('error');
  act(() => {
    pending = view.result.current.sheetEntries.remove(initial.entries[0]!._id);
  });
  expect(view.result.current.sheetEntries.status.kind).toBe('saving');
  expect(calls[1]?.name).toBe('removeSheetEntry');
  await act(async () => {
    calls[1]?.resolve(null);
    await pending;
  });
  expect(view.result.current.sheetEntries.status.kind).toBe('saved');
});

test('level-up and insertion return a scroll target to the initiating device only and keep HP out of the command', async () => {
  snapshot = await fixture();
  const initial = snapshot;
  const view = renderHook(() =>
    useCharacterSheet({
      organizationId: 'org',
      characterId: initial.character._id,
    }),
  );
  const classEntryId = initial.baseScoresEntry._id;
  const levelId = view.result.current.sheet?.levels[0]?._id;
  if (!levelId) throw new Error('Missing row');
  let pending: Promise<void> | undefined;
  act(() => {
    pending = view.result.current.levels.add(classEntryId);
  });
  expect(calls[0]?.args).toMatchObject({ classEntryId });
  expect(calls[0]?.args).not.toHaveProperty('hpGained');
  await act(async () => {
    calls[0]?.resolve(levelId);
    await pending;
  });
  expect(view.result.current.levels.appendedEntryId).toBe(levelId);
  act(() => view.result.current.levels.acknowledgeAppend());
  expect(view.result.current.levels.appendedEntryId).toBeNull();
  snapshot = { ...initial, revision: 2, lastOperationId: 'remote-level-up' };
  view.rerender();
  expect(view.result.current.levels.appendedEntryId).toBeNull();
  act(() => {
    pending = view.result.current.levels.insert(1);
  });
  expect(calls[1]?.args).toMatchObject({ position: 1 });
  await act(async () => {
    calls[1]?.resolve(levelId);
    await pending;
  });
  expect(view.result.current.levels.appendedEntryId).toBe(levelId);
});

test('a rejected choice-form mutation retains the draft and retries it through the sheet writer', async () => {
  snapshot = await fixture();
  const first = snapshot.entries.find((entry) => entry.kind === 'classLevel');
  if (!first) throw new Error('Missing row');
  const view = renderHook(() => {
    const controller = useCharacterSheet({
      organizationId: 'org',
      characterId: first.characterId,
    });
    const row = controller.sheet?.levels.find(
      (entry) => entry._id === first._id,
    );
    const choices = useClassLevelChoicesForm({
      classEntryId: row?.state.classEntryId ?? null,
      classChoices: controller.sheet?.classChoices ?? [],
      favoredClassBonus: row?.state.favoredClassBonus,
      abilityIncrease: row?.state.abilityIncrease,
      save: async (changes) => {
        await controller.saveClassLevel(first._id, changes);
      },
    });
    return { controller, choices };
  });
  act(() =>
    view.result.current.choices.form.setValue('abilityIncrease', 'strength', {
      shouldDirty: true,
    }),
  );
  let pending: Promise<void> | undefined;
  act(() => {
    pending = view.result.current.choices.save();
  });
  await waitFor(() => expect(calls).toHaveLength(1));
  await act(async () => {
    calls[0]?.reject(new ConvexError('Editing is paused'));
    await pending;
  });
  expect(view.result.current.choices.status.kind).toBe('error');
  expect(view.result.current.choices.form.getValues('abilityIncrease')).toBe(
    'strength',
  );
  act(() => {
    pending = view.result.current.choices.save();
  });
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(calls[1]?.args).toMatchObject({
    entryId: first._id,
    abilityIncrease: 'strength',
  });
  await act(async () => {
    calls[1]?.resolve(null);
    await pending;
  });
  expect(view.result.current.choices.status.kind).toBe('saved');
});

test('a selection linked to a deleted Class Level is exposed as unplaced without moving to its successor', async () => {
  snapshot = await fixture();
  const initial = snapshot;
  const first = initial.entries.find((entry) => entry.kind === 'classLevel');
  const selection = initial.entries.find((entry) => entry.kind === 'manual');
  if (!first || !selection) throw new Error('Missing fixtures');
  snapshot = {
    ...initial,
    entries: initial.entries.map((entry) =>
      entry._id === selection._id && entry.kind === 'manual'
        ? { ...entry, gainedAtClassLevel: first._id }
        : entry,
    ),
  };
  const view = renderHook(() =>
    useCharacterSheet({
      organizationId: 'org',
      characterId: initial.character._id,
    }),
  );
  expect(view.result.current.sheet?.unplacedSelections).toEqual([]);
  snapshot = {
    ...snapshot,
    revision: 2,
    lastOperationId: 'delete-level',
    entries: snapshot.entries
      .filter((entry) => entry._id !== first._id)
      .map((entry) =>
        entry.kind === 'classLevel'
          ? { ...entry, state: { ...entry.state, position: 1 } }
          : entry,
      ),
  };
  view.rerender();
  expect(view.result.current.sheet?.unplacedSelections).toMatchObject([
    { _id: selection._id, gainedAtClassLevel: first._id },
  ]);
});

function isManualCatalogEntry(
  entry: CharacterSheetSnapshot['catalogEntries'][number],
): entry is Extract<
  CharacterSheetSnapshot['catalogEntries'][number],
  { detail: { kind: 'manual' } }
> {
  return entry.detail.kind === 'manual';
}

test('equivalent level and adjustment data stays quiet when property order changes', async () => {
  snapshot = await fixture();
  const initial = snapshot;
  const view = renderHook(() =>
    useCharacterSheet({
      organizationId: 'org',
      characterId: initial.character._id,
    }),
  );
  snapshot = {
    ...initial,
    revision: 2,
    lastOperationId: 'other-player:equivalent-data',
    entries: initial.entries.map((entry) => {
      if (entry.kind !== 'classLevel') return entry;
      return {
        ...entry,
        state: {
          hpGained: entry.state.hpGained,
          position: entry.state.position,
          classEntryId: entry.state.classEntryId,
          kind: entry.state.kind,
        },
      };
    }),
    catalogEntries: initial.catalogEntries.map(
      (entry): CharacterSheetSnapshot['catalogEntries'][number] => {
        if (!isManualCatalogEntry(entry)) return entry;
        return {
          ...entry,
          modifiers: entry.modifiers.map((modifier) => ({
            value: modifier.value,
            bonusType: modifier.bonusType,
            target: modifier.target,
          })),
        };
      },
    ),
  };
  view.rerender();
  expect(view.result.current.levels.hasRemoteChange).toBe(false);
  expect(view.result.current.adjustments.hasRemoteChange).toBe(false);
});
