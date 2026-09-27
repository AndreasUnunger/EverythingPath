import { renderHook } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { Id } from '@convex/_generated/dataModel';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import { roll, upkeepFixture } from '../../../tests/rules/upkeep-fixture';
import { useCampaignHomeContent } from './use-campaign-home-content';

type Read = { data?: unknown; error?: unknown; refetch: () => unknown };
const reads = new Map<string, Read>();
const calls: [string, unknown][] = [];
const refetch = vi.fn();

vi.mock('@convex/_generated/api', () => ({
  api: {
    canonicalDraftPersistence: { workspace: 'workspace', observe: 'observe' },
    canonicalHistory: { list: 'list', read: 'read' },
  },
}));
vi.mock('@convex-dev/react-query', () => ({
  convexQuery: (query: string, args: unknown) => ({ query, args }),
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ query, args }: { query: string; args: unknown }) => {
    calls.push([query, args]);
    if (args === 'skip') return { data: undefined, error: null, refetch };
    return reads.get(query) ?? { data: undefined, error: null, refetch };
  },
}));

const campaignId = 'campaign' as Id<'campaign'>;
function militia() {
  const { draft, snapshot } = upkeepFixture();
  draft.context = { ...draft.context, firstMilitiaWeek: true };
  draft.event.chanceRoll = roll(100, 100);
  const source = workspaceSourceSchema.parse({
    key: { campaignId, militiaId: 'militia', draftId: draft.draftId },
    week: draft.week,
    sourceRevision: 0,
    snapshot,
    people: [],
  });
  const observation = {
    draftId: draft.draftId,
    revision: 0,
    status: 'open',
    draft,
    targetRevisions: [],
  };
  return { draft, source, observation };
}
const ok = (data: unknown): Read => ({ data, error: null, refetch });
const failed = (): Read => ({
  data: undefined,
  error: new Error('x'),
  refetch,
});
const listed = (weeks: unknown[] = []) =>
  ok({ weeks, earlierWeek: null, selected: null });

function render() {
  return renderHook(() => useCampaignHomeContent(campaignId)).result.current;
}

beforeEach(() => {
  reads.clear();
  calls.length = 0;
  refetch.mockClear();
});

test('loading and failure are never "no militia", and failure retries locally', () => {
  expect(render()).toEqual({ kind: 'loading' });
  reads.set('workspace', failed());
  const state = render();
  expect(state.kind).toBe('failed');
  if (state.kind === 'failed') state.retry();
  expect(refetch).toHaveBeenCalledTimes(1);
});

test('without a militia the home reads neither the draft nor finished weeks', () => {
  reads.set('workspace', ok(null));
  expect(render()).toEqual({ kind: 'no_militia' });
  expect(calls.filter(([query]) => query !== 'workspace')).toEqual([
    ['observe', 'skip'],
    ['list', 'skip'],
  ]);
});

test('with a militia it makes exactly the shared finished-week listing request', () => {
  const { source, observation } = militia();
  reads.set('workspace', ok(source));
  reads.set('observe', ok(observation));
  reads.set('list', listed());
  render();
  expect(calls.filter(([query]) => query === 'list')).toEqual([
    ['list', { campaignId, limit: 3 }],
  ]);
  expect(calls.filter(([query]) => query === 'observe')).toEqual([
    ['observe', source.key],
  ]);
  expect(calls.map(([query]) => query)).not.toContain('read');
});

test('Continue opens the target phase of the accepted draft', () => {
  const { source, observation } = militia();
  reads.set('workspace', ok(source));
  reads.set('observe', ok(observation));
  reads.set('list', listed());
  const state = render();
  expect(state).toMatchObject({
    kind: 'militia',
    continueWeek: {
      kind: 'ready',
      week: 40,
      phase: 'summary',
      href: '/campaigns/campaign/week?phase=summary',
    },
    recent: { kind: 'ready', weeks: [] },
  });
});

test('no target is fabricated while the draft loads or the next week arrives', () => {
  const { source, observation } = militia();
  reads.set('workspace', ok(source));
  reads.set('list', listed());
  expect(render()).toMatchObject({
    continueWeek: { kind: 'loading', week: 40 },
  });
  // A peer confirmed: the observed draft closed before the successor source.
  reads.set('observe', ok({ ...observation, status: 'closed', draft: null }));
  expect(render()).toMatchObject({
    continueWeek: { kind: 'loading', week: 40 },
  });
  // The successor source arrived; the old draft's observation is stale.
  reads.set(
    'workspace',
    ok({ ...source, week: 41, key: { ...source.key, draftId: 'week-41' } }),
  );
  reads.set('observe', ok(observation));
  expect(render()).toMatchObject({
    continueWeek: { kind: 'loading', week: 41 },
  });
});

test('a finished-week failure stays local and does not block Continue', () => {
  const { source, observation } = militia();
  reads.set('workspace', ok(source));
  reads.set('observe', ok(observation));
  reads.set('list', failed());
  const state = render();
  expect(state).toMatchObject({
    continueWeek: { kind: 'ready' },
    recent: { kind: 'failed' },
  });
  if (state.kind === 'militia' && state.recent.kind === 'failed')
    state.recent.retry();
  expect(refetch).toHaveBeenCalledTimes(1);
});

test('a draft read failure keeps its week and offers a retry', () => {
  const { source } = militia();
  reads.set('workspace', ok(source));
  reads.set('observe', failed());
  reads.set('list', listed());
  const state = render();
  expect(state).toMatchObject({ continueWeek: { kind: 'failed', week: 40 } });
});
