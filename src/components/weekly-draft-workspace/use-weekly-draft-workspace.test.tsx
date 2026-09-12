import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, test } from 'vitest';
import type { ReactNode } from 'react';
import { createWeeklyDraft } from '~/lib/weekly-draft';
import { createMemoryDraftAuthority } from '~/lib/memory-draft-persistence';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { WorkspaceGateway } from './gateway';
import {
  WeeklyDraftWorkspaceProvider,
  useWeeklyDraftWorkspace,
} from './use-weekly-draft-workspace';
function fixture() {
  const draft = createWeeklyDraft({
    draftId: 'workspace',
    week: 4,
    slotIds: ['left'],
    context: {
      firstMilitiaWeek: false,
      startDay: 21,
      uneventfulCarry: false,
      carriedEvents: [],
      queuedEffects: [],
      orders: [],
      lastBuyoffWeek: null,
    },
  });
  draft.event.chanceRoll = {
    dice: [100],
    sides: 100,
    provenance: { kind: 'table' },
    modifiers: [],
  };
  const source = workspaceSourceSchema.parse({
    key: {
      campaignId: 'campaign',
      militiaId: 'militia',
      draftId: draft.draftId,
    },
    sourceRevision: 0,
    snapshot: {
      rank: 2,
      training: 14,
      treasuryCopper: 5000,
      notoriety: 0,
      focus: 'Loyalty',
      roster: {
        people: [{ characterId: 'pc', kind: 'pc', hitDice: 2 }],
        teams: [],
        officers: [],
      },
      characters: [
        {
          characterId: 'pc',
          level: 2,
          strength: 10,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 10,
          charisma: 10,
          isActive: true,
        },
      ],
      settlements: [],
      bonuses: [],
    },
    people: [],
  });
  const authority = createMemoryDraftAuthority(draft, source.snapshot);
  const gateway: WorkspaceGateway = {
    subscribe(next) {
      next(source);
      return () => undefined;
    },
    transport() {
      return authority.transport;
    },
  };
  return { gateway, authority, source };
}
function renderWorkspace(gateway: WorkspaceGateway | null) {
  return renderHook(() => useWeeklyDraftWorkspace(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <WeeklyDraftWorkspaceProvider gateway={gateway}>
        {children}
      </WeeklyDraftWorkspaceProvider>
    ),
  });
}
function roll(field: 'check' | 'training', value: number) {
  return {
    kind: 'upkeep_roll' as const,
    field,
    roll: {
      dice: [value],
      sides: field === 'check' ? 20 : 6,
      provenance: { kind: 'table' as const },
      modifiers: [],
    },
  };
}
test('[rules.P81.workspace] only ready exposes semantic operations and derived Upkeep facts', async () => {
  const unavailable = renderWorkspace(null);
  expect(unavailable.result.current).toEqual({ status: 'unavailable' });
  unavailable.unmount();
  const { gateway } = fixture();
  const screen = renderWorkspace(gateway);
  await waitFor(() => expect(screen.result.current.status).toBe('ready'));
  let view = screen.result.current;
  if (view.status !== 'ready' || view.phaseView.phase !== 'upkeep')
    throw new Error('Expected Upkeep');
  expect(view.phaseView.rolls[0]).toMatchObject({
    field: 'check',
    dice: [null],
    modifier: 3,
    dc: 10,
  });
  expect(view.canConfirm).toBe(false);
  await act(async () => {
    if (view.status === 'ready') await view.edit(roll('check', 10));
  });
  view = screen.result.current;
  if (view.status !== 'ready') throw new Error('Expected ready');
  await act(async () => {
    if (view.status === 'ready') await view.edit(roll('training', 3));
  });
  await waitFor(() =>
    expect(
      screen.result.current.status === 'ready' &&
        screen.result.current.canConfirm,
      JSON.stringify(screen.result.current),
    ).toBe(true),
  );
  const ready = screen.result.current;
  if (ready.status !== 'ready' || ready.phaseView.phase !== 'upkeep')
    throw new Error('Expected Upkeep');
  expect(ready.phaseView.after.training).toBe(11);
  expect(ready.phaseView.minimumTreasuryCopper).toBe(2000);
  expect(ready).not.toHaveProperty('draft');
  expect(ready).not.toHaveProperty('revision');
  expect(ready).not.toHaveProperty('flush');
  act(() => ready.viewPhase('summary'));
  expect(
    screen.result.current.status === 'ready' &&
      screen.result.current.phaseView.phase,
  ).toBe('summary');
  screen.unmount();
});

test('[rules.P81.recovery] players navigate independently while a pending edit fails and restores the accepted value', async () => {
  const { gateway, authority } = fixture();
  let release!: () => void;
  const held = new Promise<void>((done) => {
    release = done;
  });
  const first = renderWorkspace({
    ...gateway,
    transport: () => ({
      ...authority.transport,
      async send(operation) {
        await held;
        return authority.transport.send(operation);
      },
    }),
  });
  const second = renderWorkspace(gateway);
  await waitFor(() => expect(first.result.current.status).toBe('ready'));
  await waitFor(() => expect(second.result.current.status).toBe('ready'));
  const initial = first.result.current;
  if (initial.status !== 'ready') throw new Error('Expected ready');
  let pending!: Promise<'accepted' | 'failed'>;
  act(() => {
    pending = initial.edit(roll('check', 10));
  });
  expect(
    first.result.current.status === 'ready' && first.result.current.feedback,
  ).toBe('pending');
  act(() => initial.viewPhase('summary'));
  expect(
    first.result.current.status === 'ready' &&
      first.result.current.phaseView.phase,
  ).toBe('summary');
  expect(
    second.result.current.status === 'ready' &&
      second.result.current.phaseView.phase,
  ).toBe('upkeep');
  const other = second.result.current;
  if (other.status !== 'ready') throw new Error('Expected ready');
  await act(() => other.edit(roll('check', 12)));
  await act(async () => {
    release();
    expect(await pending).toBe('failed');
  });
  expect(
    first.result.current.status === 'ready' && first.result.current.feedback,
  ).toBe('failed');
  act(() => initial.viewPhase('upkeep'));
  const recovered = first.result.current;
  if (recovered.status !== 'ready' || recovered.phaseView.phase !== 'upkeep')
    throw new Error('Expected Upkeep');
  expect(recovered.phaseView.rolls[0]?.dice).toEqual([12]);
  first.unmount();
  second.unmount();
});

test('[rules.P81.states] loading, failed and unavailable never expose editing and a later available source recovers', async () => {
  const { gateway, source } = fixture();
  let next!: (value: typeof source | null) => void;
  let failed!: () => void;
  const screen = renderWorkspace({
    ...gateway,
    subscribe(receive, onFailure) {
      next = receive;
      failed = onFailure;
      return () => undefined;
    },
  });
  expect(screen.result.current).toEqual({ status: 'loading' });
  act(() => failed());
  expect(screen.result.current).toEqual({ status: 'failed' });
  act(() => next(source));
  await waitFor(() => expect(screen.result.current.status).toBe('ready'));
  const ready = screen.result.current;
  if (ready.status !== 'ready') throw new Error('Expected ready');
  act(() => ready.viewPhase('persistent'));
  expect(
    screen.result.current.status === 'ready' &&
      screen.result.current.phaseView.phase,
  ).toBe('upkeep');
  act(() => next(null));
  expect(screen.result.current).toEqual({ status: 'unavailable' });
  screen.unmount();
});

import { persistentEventFixture } from '../../../tests/rules/persistent-event-fixture';
test('[rules.P81.eligibility] carried-event eligibility remains enabled after ending, and new current-week events cannot enable it', async () => {
  const { draft, snapshot } = persistentEventFixture('double_agent');
  const source = workspaceSourceSchema.parse({
    key: {
      campaignId: 'campaign',
      militiaId: 'militia',
      draftId: draft.draftId,
    },
    sourceRevision: 0,
    snapshot,
    people: [],
  });
  const authority = createMemoryDraftAuthority(draft, snapshot);
  const screen = renderWorkspace({
    subscribe(next) {
      next(source);
      return () => undefined;
    },
    transport() {
      return authority.transport;
    },
  });
  await waitFor(() => expect(screen.result.current.status).toBe('ready'));
  const ready = screen.result.current;
  if (ready.status !== 'ready') throw new Error('Expected ready');
  await act(async () => {
    await ready.edit({
      kind: 'persistent_decision',
      decision: {
        kind: 'end',
        eventId: 'carried',
        acknowledgement: {
          acknowledgementId: 'ending',
          subjectId: 'carried',
          outcome: 'The spy was exposed',
        },
      },
    });
  });
  act(() => ready.viewPhase('persistent'));
  expect(
    screen.result.current.status === 'ready' &&
      screen.result.current.phaseView.phase,
  ).toBe('persistent');
  screen.unmount();
  const fresh = renderWorkspace(fixture().gateway);
  await waitFor(() => expect(fresh.result.current.status).toBe('ready'));
  const current = fresh.result.current;
  if (current.status !== 'ready') throw new Error('Expected ready');
  await act(async () => {
    await current.edit({
      kind: 'event_tree',
      occurrences: [
        {
          eventId: 'new-event',
          origin: { kind: 'rolled' },
          eventType: 'low_morale',
        },
      ],
    });
  });
  act(() => current.viewPhase('persistent'));
  expect(
    fresh.result.current.status === 'ready' &&
      fresh.result.current.phaseView.phase,
  ).toBe('upkeep');
  fresh.unmount();
});

test('[rules.P82.workspace] Activity exposes complete choices and retained extra slots through shared movement', async () => {
  const { gateway } = fixture();
  const first = renderWorkspace(gateway);
  const second = renderWorkspace(gateway);
  await waitFor(() => expect(first.result.current.status).toBe('ready'));
  await act(async () => {
    if (first.result.current.status !== 'ready') throw Error('not ready');
    first.result.current.viewPhase('activity');
    await first.result.current.edit({ kind: 'add_slot', slotId: 'middle' });
    await first.result.current.edit({ kind: 'add_slot', slotId: 'right' });
    await first.result.current.edit({
      kind: 'stage',
      slotId: 'left',
      choice: {
        choiceId: 'drill',
        actionId: 'drill_militia',
        costCopper: 0,
        rolls: {
          check: {
            dice: [10],
            sides: 20,
            provenance: { kind: 'table' },
            modifiers: [],
          },
        },
      },
    });
    await first.result.current.edit({
      kind: 'move',
      fromSlotId: 'left',
      toSlotId: 'right',
      choiceId: 'drill',
    });
  });
  await waitFor(() => {
    const state = first.result.current;
    if (state.status !== 'ready' || state.phaseView.phase !== 'activity')
      throw Error('not activity');
    expect(state.phaseView.slots[0]?.choice).toBeNull();
    expect(state.phaseView.slots[2]?.choice).toMatchObject({
      choiceId: 'drill',
      costCopper: 0,
      rolls: { check: { dice: [10] } },
    });
    expect(state.phaseView.slots[2]?.overAllowance).toBe(true);
    expect(
      second.result.current.status === 'ready' &&
        second.result.current.phaseView.phase,
    ).toBe('upkeep');
  });
});

test('[rules.P82.declared-references] incomplete staged creations remain named choices for later actions', async () => {
  const { gateway } = fixture();
  const workspace = renderWorkspace(gateway);
  await waitFor(() => expect(workspace.result.current.status).toBe('ready'));
  await act(async () => {
    const state = workspace.result.current;
    if (state.status !== 'ready') throw new Error('Expected Workspace');
    state.viewPhase('activity');
    await state.edit({
      kind: 'stage',
      slotId: 'left',
      choice: {
        choiceId: 'recruits',
        actionId: 'recruit_team',
        teamType: 'patrons',
      },
    });
    await state.edit({ kind: 'add_slot', slotId: 'market' });
    await state.edit({
      kind: 'stage',
      slotId: 'market',
      choice: {
        choiceId: 'purchase',
        actionId: 'broker_market',
        purchases: [
          { itemId: 'potion', priceCopper: 123, name: 'Healing potion' },
        ],
      },
    });
    await state.edit({ kind: 'add_slot', slotId: 'cache' });
    await state.edit({
      kind: 'stage',
      slotId: 'cache',
      choice: {
        choiceId: 'cache-choice',
        actionId: 'secure_cache',
        mode: 'place',
        cacheId: 'mill',
        location: 'Under the mill',
      },
    });
    await state.edit({ kind: 'add_slot', slotId: 'events' });
    await state.edit({
      kind: 'stage',
      slotId: 'events',
      choice: {
        choiceId: 'guarantee',
        actionId: 'guarantee_event',
        candidates: [
          {
            eventId: 'rivalry',
            eventType: 'rivalry',
            origin: { kind: 'rolled' },
          },
        ],
      },
    });
  });
  await waitFor(() => {
    const state = workspace.result.current;
    if (state.status !== 'ready' || state.phaseView.phase !== 'activity')
      throw new Error('Expected Activity');
    expect(state.phaseView.teams).toContainEqual(
      expect.objectContaining({
        value: 'recruit:recruits',
        label: 'Recruit Team · Slot 1',
      }),
    );
    expect(state.phaseView.items).toContainEqual({
      value: 'potion',
      label: 'Healing potion',
    });
    expect(state.phaseView.caches).toContainEqual({
      value: 'mill',
      label: 'Under the mill',
    });
    expect(state.phaseView.events).toContainEqual({
      value: 'rivalry',
      label: 'Rivalry · Event 1',
    });
  });
});
