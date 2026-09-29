import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { FunctionArgs } from 'convex/server';
import { zid } from 'convex-helpers/server/zod4';
import { api } from '../../../convex/_generated/api';
import { canonicalResolutionRecordSchema } from '~/lib/canonical-resolution-record';
import { createWeeklyDraft } from '~/lib/weekly-draft';
import { useRecentHistory } from './use-recent-history';
import {
  useCanonicalHistory,
  type CanonicalHistory,
} from './use-canonical-history';

const watchQuery = vi.fn();
const convex = { watchQuery };
vi.mock('convex/react', () => ({ useConvex: () => convex }));
const campaign = zid('campaign').parse('campaign');
const otherCampaign = zid('campaign').parse('other');
type Args = FunctionArgs<typeof api.canonicalHistory.read>;
type Value = CanonicalHistory | null | undefined | Error;
const values = new Map<string, Value>();
const watches: {
  args: Args;
  update: () => void;
  stop: ReturnType<typeof vi.fn>;
}[] = [];
function key(args: Args) {
  return `${args.campaignId}:${args.week ?? 'latest'}`;
}
function history(week: number, previousWeek: number | null): CanonicalHistory {
  const context = {
    firstMilitiaWeek: false,
    startDay: 0,
    uneventfulCarry: false,
    carriedEvents: [],
    queuedEffects: [],
    orders: [],
    lastBuyoffWeek: null,
  };
  return {
    week,
    previousWeek,
    nextWeek: null,
    effectiveRecordId: `effective-${week}`,
    earlierSequence: null,
    createdAt: 3000,
    audit: [
      {
        recordId: `effective-${week}`,
        sequence: 2,
        provenance: 'historical_correction',
        createdAt: 3000,
      },
      {
        recordId: `older-${week}`,
        sequence: 1,
        provenance: 'historical_correction',
        createdAt: 2000,
      },
      {
        recordId: `original-${week}`,
        sequence: 0,
        provenance: 'confirmation',
        createdAt: 1000,
      },
    ],
    record: canonicalResolutionRecordSchema.parse({
      recordId: `effective-${week}`,
      source: createWeeklyDraft({
        draftId: `closed-${week}`,
        week,
        slotIds: [],
        context,
      }),
      provenance: 'historical_correction',
      rulesetVersion: 1,
      baselinePlan: { formatVersion: 1, data: {} },
      finalPlan: { formatVersion: 1, data: {} },
      finalOutcome: { formatVersion: 1, data: {} },
      adjudication: {
        acknowledgements: [],
        rulesExceptions: [],
        tableAdjustments: [],
      },
      warnings: [],
      successorContext: context,
      supersedesRecordId: `older-${week}`,
    }),
  };
}
beforeEach(() => {
  values.clear();
  watches.length = 0;
  watchQuery.mockImplementation((_query: unknown, args: Args) => ({
    localQueryResult: () => {
      const value = values.get(key(args));
      if (value instanceof Error) throw value;
      return value;
    },
    onUpdate: (update: () => void) => {
      const stop = vi.fn();
      watches.push({ args, update, stop });
      return stop;
    },
  }));
});

test('recent weeks follow canonical gaps and ignore audit entries, stopping after three effective weeks', () => {
  values.set('campaign:latest', history(12, 8));
  values.set('campaign:8', history(8, 3));
  values.set('campaign:3', history(3, 1));
  const { result } = renderHook(() => useRecentHistory(campaign, true));
  expect(result.current.status).toBe('ready');
  expect(result.current.weeks.map((item) => item.week)).toEqual([12, 8, 3]);
  expect(result.current.weeks.map((item) => item.record.recordId)).toEqual([
    'effective-12',
    'effective-8',
    'effective-3',
  ]);
  expect(watchQuery.mock.calls.map(([query, args]) => [query, args])).toEqual([
    [
      api.canonicalHistory.read,
      {
        campaignId: campaign,
        week: undefined,
        recordId: undefined,
        beforeSequence: undefined,
      },
    ],
    [
      api.canonicalHistory.read,
      {
        campaignId: campaign,
        week: 8,
        recordId: undefined,
        beforeSequence: undefined,
      },
    ],
    [
      api.canonicalHistory.read,
      {
        campaignId: campaign,
        week: 3,
        recordId: undefined,
        beforeSequence: undefined,
      },
    ],
  ]);
});

test('a campaign switch ignores delayed callbacks from its disposed reader', () => {
  values.set('campaign:latest', history(12, null));
  values.set('other:latest', history(5, null));
  const view = renderHook(({ id }) => useRecentHistory(id, true), {
    initialProps: { id: campaign },
  });
  const old = watches[0]!;
  view.rerender({ id: otherCampaign });
  expect(view.result.current.weeks.map((item) => item.week)).toEqual([5]);
  expect(old.stop).toHaveBeenCalledOnce();
  act(old.update);
  expect(view.result.current.status).toBe('ready');
  expect(view.result.current.weeks.map((item) => item.week)).toEqual([5]);
});

test.each(['watch', 'subscription'])(
  'a %s setup failure is local and retryable',
  (stage) => {
    if (stage === 'watch') {
      watchQuery.mockImplementationOnce(() => {
        throw new Error('offline');
      });
    } else {
      watchQuery.mockImplementationOnce(() => ({
        localQueryResult: () => undefined,
        onUpdate: () => {
          throw new Error('offline');
        },
      }));
    }
    values.set('campaign:latest', history(12, null));
    const { result } = renderHook(() => useRecentHistory(campaign, true));
    expect(result.current.status).toBe('failed');
    act(result.current.retry);
    expect(result.current.status).toBe('ready');
    expect(result.current.weeks.map((item) => item.week)).toEqual([12]);
  },
);

test.each([0, 1, 2])(
  'returns %i finished weeks without querying nonexistent predecessors',
  (count) => {
    values.set(
      'campaign:latest',
      count === 0 ? null : history(12, count === 1 ? null : 8),
    );
    values.set('campaign:8', history(8, null));
    const { result } = renderHook(() => useRecentHistory(campaign, true));
    expect(result.current.status).toBe('ready');
    expect(result.current.weeks.map((item) => item.week)).toEqual(
      [12, 8].slice(0, count),
    );
    expect(watchQuery).toHaveBeenCalledTimes(Math.max(1, count));
  },
);

test.each(['latest', '8', '3'])(
  'loading and failure at week %s stay local and recover on retry',
  (failedWeek) => {
    values.set('campaign:latest', history(12, 8));
    values.set('campaign:8', history(8, 3));
    values.set('campaign:3', history(3, null));
    const recovered = values.get(`campaign:${failedWeek}`);
    values.set(`campaign:${failedWeek}`, undefined);
    const { result } = renderHook(() => useRecentHistory(campaign, true));
    expect(result.current.status).toBe('loading');
    expect(result.current.weeks).toEqual([]);
    const failed = watches.at(-1)!;
    values.set(`campaign:${failedWeek}`, new Error('offline'));
    act(failed.update);
    expect(result.current.status).toBe('failed');
    expect(result.current.weeks).toEqual([]);
    values.set(`campaign:${failedWeek}`, recovered);
    act(result.current.retry);
    expect(result.current.status).toBe('ready');
    expect(result.current.weeks.map((item) => item.week)).toEqual([12, 8, 3]);
    expect(failed.stop).toHaveBeenCalledOnce();
    values.set(`campaign:${failedWeek}`, new Error('late obsolete error'));
    act(failed.update);
    expect(result.current.status).toBe('ready');
  },
);

test('the latest week changing clears its old descendants until the new chain is ready', () => {
  values.set('campaign:latest', history(12, 8));
  values.set('campaign:8', history(8, 3));
  values.set('campaign:3', history(3, null));
  const { result } = renderHook(() => useRecentHistory(campaign, true));
  const oldPrevious = watches[1]!;
  const oldOldest = watches[2]!;
  values.set('campaign:latest', history(20, 12));
  act(watches[0]!.update);
  expect(result.current.status).toBe('loading');
  expect(result.current.weeks).toEqual([]);
  expect(oldPrevious.stop).toHaveBeenCalledOnce();
  expect(oldOldest.stop).toHaveBeenCalledOnce();
  act(oldOldest.update);
  expect(result.current.weeks).toEqual([]);
  values.set('campaign:12', history(12, 8));
  act(watches.at(-1)!.update);
  expect(result.current.weeks.map((item) => item.week)).toEqual([20, 12, 8]);
  expect(
    watches.filter((watch) => watch.stop.mock.calls.length === 0),
  ).toHaveLength(3);
});

test('disabled history does not read, and closing or unmounting cleans up every subscription', () => {
  values.set('campaign:latest', history(12, 8));
  values.set('campaign:8', history(8, 3));
  values.set('campaign:3', history(3, null));
  const view = renderHook(
    ({ enabled }) => useRecentHistory(campaign, enabled),
    {
      initialProps: { enabled: false },
    },
  );
  expect(view.result.current.status).toBe('idle');
  expect(watchQuery).not.toHaveBeenCalled();
  view.rerender({ enabled: true });
  expect(view.result.current.weeks).toHaveLength(3);
  view.rerender({ enabled: false });
  expect(view.result.current.weeks).toEqual([]);
  expect(watches.every((watch) => watch.stop.mock.calls.length === 1)).toBe(
    true,
  );
  view.rerender({ enabled: true });
  expect(view.result.current.status).toBe('ready');
  view.unmount();
  expect(watches.every((watch) => watch.stop.mock.calls.length === 1)).toBe(
    true,
  );
});

test('reopening History waits for fresh results instead of flashing the last visit', () => {
  values.set('campaign:latest', history(12, null));
  const visibleWeeks: number[][] = [];
  const view = renderHook(
    ({ enabled }) => {
      const result = useRecentHistory(campaign, enabled);
      visibleWeeks.push(result.weeks.map((item) => item.week));
      return result;
    },
    { initialProps: { enabled: true } },
  );
  view.rerender({ enabled: false });
  values.set('campaign:latest', undefined);
  visibleWeeks.length = 0;
  view.rerender({ enabled: true });
  expect(visibleWeeks.every((weeks) => weeks.length === 0)).toBe(true);
  expect(view.result.current.status).toBe('loading');
});

test('the shared full reader preserves record and audit-page selectors and rejects late selection callbacks', () => {
  values.set('campaign:4', history(4, null));
  values.set('campaign:latest', history(12, null));
  const initialProps: {
    selection: { week?: number; recordId?: string; beforeSequence?: number };
    attempt: number;
  } = {
    selection: { week: 4, recordId: 'original-4', beforeSequence: 3 },
    attempt: 0,
  };
  const view = renderHook(
    ({ selection, attempt }) =>
      useCanonicalHistory(campaign, selection, attempt),
    {
      initialProps,
    },
  );
  expect(watchQuery).toHaveBeenLastCalledWith(api.canonicalHistory.read, {
    campaignId: campaign,
    week: 4,
    recordId: 'original-4',
    beforeSequence: 3,
  });
  const selected = watches[0]!;
  view.rerender({ selection: {}, attempt: 0 });
  expect(watchQuery).toHaveBeenLastCalledWith(api.canonicalHistory.read, {
    campaignId: campaign,
    week: undefined,
    recordId: undefined,
    beforeSequence: undefined,
  });
  act(selected.update);
  expect(view.result.current?.data?.week).toBe(12);
  view.rerender({ selection: {}, attempt: 1 });
  expect(watches[1]!.stop).toHaveBeenCalledOnce();
  expect(view.result.current?.data?.week).toBe(12);
});

test('a corrected effective latest record refreshes its predecessor chain without mixing old rows', () => {
  values.set('campaign:latest', history(12, 8));
  values.set('campaign:8', history(8, null));
  const { result } = renderHook(() => useRecentHistory(campaign, true));
  const oldPrevious = watches[1]!;
  const corrected = history(12, 8);
  corrected.effectiveRecordId = 'corrected-12';
  corrected.record.recordId = 'corrected-12';
  values.set('campaign:latest', corrected);
  values.set('campaign:8', undefined);
  act(watches[0]!.update);
  expect(result.current.status).toBe('loading');
  expect(result.current.weeks).toEqual([]);
  expect(oldPrevious.stop).toHaveBeenCalledOnce();
  const priorCorrected = history(8, null);
  priorCorrected.effectiveRecordId = 'corrected-8';
  priorCorrected.record.recordId = 'corrected-8';
  values.set('campaign:8', priorCorrected);
  act(watches.at(-1)!.update);
  expect(result.current.weeks.map((week) => week.record.recordId)).toEqual([
    'corrected-12',
    'corrected-8',
  ]);
});
