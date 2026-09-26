import { expect, test } from 'vitest';
import { createMemoryDraftAuthority } from '~/lib/memory-draft-persistence';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import { upkeepFixture, roll } from '../../../tests/rules/upkeep-fixture';
import type { WorkspaceGateway } from './gateway';
import { createWorkspace } from './store';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function fixture(draftId = 'week-40') {
  const { draft, snapshot } = upkeepFixture();
  draft.draftId = draftId;
  draft.context = { ...draft.context, firstMilitiaWeek: true };
  draft.event.chanceRoll = roll(100, 100);
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
  let receive!: Parameters<WorkspaceGateway['subscribe']>[0];
  let fail!: Parameters<WorkspaceGateway['subscribe']>[1];
  const gateway: WorkspaceGateway = {
    subscribe(next, failed) {
      receive = next;
      fail = failed;
      next(source);
      return () => undefined;
    },
    transport: () => authority.transport,
  };
  return {
    gateway,
    authority,
    source,
    receive: (next: typeof source | null) => receive(next),
    fail: () => fail(),
  };
}

function ready(workspace: ReturnType<typeof createWorkspace>) {
  const snapshot = workspace.getSnapshot();
  if (snapshot.status !== 'ready') throw new Error('Expected ready Workspace');
  return snapshot;
}

test('Confirmation stays pending through a closed-draft loading observation until its response arrives', async () => {
  const { gateway, authority } = fixture();
  const response = deferred();
  const workspace = createWorkspace({
    ...gateway,
    transport: () => ({
      ...authority.transport,
      async confirm(operation) {
        const receipt = await authority.transport.confirm(operation);
        await response.promise;
        return receipt;
      },
    }),
  });
  const stop = workspace.start();
  try {
    await expect.poll(() => ready(workspace).canConfirm).toBe(true);
    const observed: boolean[] = [];
    workspace.subscribe(() => observed.push(workspace.getPendingWork()));
    const confirming = ready(workspace).confirm();
    expect(workspace.getPendingWork()).toBe(true);
    await expect.poll(() => workspace.getSnapshot().status).toBe('loading');
    expect(workspace.getPendingWork()).toBe(true);
    expect(observed).not.toContain(false);
    response.resolve();
    expect(await confirming).toBe('accepted');
    expect(workspace.getSnapshot().status).toBe('loading');
    expect(workspace.getPendingWork()).toBe(false);
    expect(observed.at(-1)).toBe(false);
  } finally {
    response.resolve();
    stop();
  }
});

test('a disappearing source keeps Confirmation protected and notifies subscribers when it settles', async () => {
  const fixtureState = fixture();
  const response = deferred();
  const workspace = createWorkspace({
    ...fixtureState.gateway,
    transport: () => ({
      ...fixtureState.authority.transport,
      async confirm(operation) {
        const receipt =
          await fixtureState.authority.transport.confirm(operation);
        await response.promise;
        return receipt;
      },
    }),
  });
  const stop = workspace.start();
  try {
    await expect.poll(() => ready(workspace).canConfirm).toBe(true);
    const confirming = ready(workspace).confirm();
    await expect.poll(() => workspace.getSnapshot().status).toBe('loading');
    fixtureState.receive(null);
    expect(workspace.getSnapshot()).toEqual({ status: 'unavailable' });
    expect(workspace.getPendingWork()).toBe(true);
    const observed: boolean[] = [];
    workspace.subscribe(() => observed.push(workspace.getPendingWork()));
    response.resolve();
    expect(await confirming).toBe('accepted');
    expect(workspace.getSnapshot()).toEqual({ status: 'unavailable' });
    expect(workspace.getPendingWork()).toBe(false);
    expect(observed.at(-1)).toBe(false);
  } finally {
    response.resolve();
    stop();
  }
});

test('an authoritative successor clears old Confirmation protection without letting its late response clear a new edit', async () => {
  const current = fixture();
  const successor = fixture('successor');
  const confirmationResponse = deferred();
  const editResponse = deferred();
  const workspace = createWorkspace({
    ...current.gateway,
    transport: (source) =>
      source.key.draftId === current.source.key.draftId
        ? {
            ...current.authority.transport,
            async confirm(operation) {
              const receipt =
                await current.authority.transport.confirm(operation);
              await confirmationResponse.promise;
              return receipt;
            },
          }
        : {
            ...successor.authority.transport,
            async send(operation) {
              const receipt =
                await successor.authority.transport.send(operation);
              await editResponse.promise;
              return receipt;
            },
          },
  });
  const stop = workspace.start();
  try {
    await expect.poll(() => ready(workspace).canConfirm).toBe(true);
    const confirming = ready(workspace).confirm();
    await expect.poll(() => workspace.getSnapshot().status).toBe('loading');
    current.receive(successor.source);
    expect(workspace.getPendingWork()).toBe(false);
    await expect.poll(() => ready(workspace).canConfirm).toBe(true);
    const saving = ready(workspace).edit({
      kind: 'event_chance',
      roll: roll(100, 99),
    });
    expect(workspace.getPendingWork()).toBe(true);
    confirmationResponse.resolve();
    expect(await confirming).toBe('accepted');
    expect(workspace.getPendingWork()).toBe(true);
    editResponse.resolve();
    expect(await saving).toBe('accepted');
    expect(workspace.getPendingWork()).toBe(false);
  } finally {
    confirmationResponse.resolve();
    editResponse.resolve();
    stop();
  }
});

test('a delayed edit stays protected through source failure, disappearance and recovery of the same draft', async () => {
  const current = fixture();
  const response = deferred();
  const workspace = createWorkspace({
    ...current.gateway,
    transport: () => ({
      ...current.authority.transport,
      async send(operation) {
        const receipt = await current.authority.transport.send(operation);
        await response.promise;
        return receipt;
      },
    }),
  });
  const stop = workspace.start();
  try {
    await expect.poll(() => ready(workspace).canConfirm).toBe(true);
    const saving = ready(workspace).edit({
      kind: 'event_chance',
      roll: roll(100, 99),
    });
    expect(workspace.getPendingWork()).toBe(true);
    await expect.poll(() => ready(workspace).phaseView.phase).toBe('upkeep');
    current.fail();
    expect(workspace.getSnapshot()).toEqual({ status: 'failed' });
    expect(workspace.getPendingWork()).toBe(true);
    current.receive(null);
    expect(workspace.getSnapshot()).toEqual({ status: 'unavailable' });
    expect(workspace.getPendingWork()).toBe(true);
    current.receive(current.source);
    await expect.poll(() => workspace.getSnapshot().status).toBe('ready');
    expect(ready(workspace).pendingWork).toBe(true);
    const observed: boolean[] = [];
    workspace.subscribe(() => observed.push(workspace.getPendingWork()));
    response.resolve();
    expect(await saving).toBe('accepted');
    expect(workspace.getPendingWork()).toBe(false);
    expect(observed.at(-1)).toBe(false);
    expect(ready(workspace).pendingWork).toBe(false);
    await expect.poll(() => ready(workspace).canConfirm).toBe(true);
  } finally {
    response.resolve();
    stop();
  }
});

test('Confirmation that is not ready does not create unobservable pending work', async () => {
  const { gateway } = fixture();
  const workspace = createWorkspace(gateway);
  const stop = workspace.start();
  try {
    await expect.poll(() => ready(workspace).canConfirm).toBe(true);
    await ready(workspace).edit({ kind: 'event_chance', roll: null });
    await expect.poll(() => ready(workspace).forecastPending).toBe(false);
    expect(ready(workspace).canConfirm).toBe(false);
    const confirming = ready(workspace).confirm();
    expect(workspace.getPendingWork()).toBe(false);
    expect(await confirming).toBe('failed');
  } finally {
    stop();
  }
});
