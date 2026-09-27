'use client';

import { useState } from 'react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import {
  buildWeekIndex,
  isWeekCovered,
  type FinishedWeek,
  type FinishedWeekListing,
  type ListWindow,
  type WeekIndexItem,
} from './finished-week-index';
import {
  useWatchedQueries,
  useWatchedQuery,
  type Watched,
} from './use-watched-queries';

/** An older window's control: not requested, loading, or failed. */
export type WindowStatus = 'idle' | 'loading' | 'failed';

export type ListingWindows = {
  /** The newest page, which also decides empty, failed and loading states. */
  newest: Watched<FinishedWeekListing>;
  latestRow: FinishedWeek | null;
  items: WeekIndexItem[];
  /** The listing row for a week, from any loaded window or its own read. */
  rowFor: (week: number | undefined) => FinishedWeek | null;
  windowStatus: (beforeWeek: number) => WindowStatus;
  /** Loads the page before `beforeWeek`, or reads it again after a failure. */
  loadEarlier: (beforeWeek: number) => void;
  retry: () => void;
  /** Called when the latest row is chosen: drops every older window. */
  restoreNewest: () => void;
};

const windowName = (beforeWeek: number | null) => `${beforeWeek ?? 'newest'}`;

/**
 * The bounded listing windows behind the Finished weeks index: the newest page
 * always; older pages on request; and, for a directly linked week outside
 * them, only the window ending at that week (never every page in between).
 */
export function useListingWindows({
  campaignId,
  isEnabled,
  explicitWeek,
}: {
  campaignId: Id<'campaign'>;
  isEnabled: boolean;
  explicitWeek: number | undefined;
}): ListingWindows {
  const [anchors, setAnchors] = useState<number[]>([]);
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  // The latest row's link navigates asynchronously; windows are dropped once
  // the address actually shows that week, so the old deep link can't re-add
  // its window in between.
  const [restoring, setRestoring] = useState<{
    week: number;
    from: number | undefined;
  } | null>(null);

  const allAnchors = [null, ...anchors];
  const keyFor = (beforeWeek: number | null) =>
    `list:${windowName(beforeWeek)}:${attempts[windowName(beforeWeek)] ?? 0}`;
  const results = useWatchedQueries(
    api.canonicalHistory.list,
    isEnabled
      ? allAnchors.map((beforeWeek) => ({
          key: keyFor(beforeWeek),
          args:
            beforeWeek === null ? { campaignId } : { campaignId, beforeWeek },
        }))
      : [],
  );
  const resultFor = (beforeWeek: number | null): Watched<FinishedWeekListing> =>
    results[keyFor(beforeWeek)] ?? { status: 'loading' };
  const newest = resultFor(null);
  const windows: ListWindow[] = allAnchors.flatMap((beforeWeek) => {
    const result = resultFor(beforeWeek);
    return result.status === 'ready'
      ? [{ beforeWeek, listing: result.data }]
      : [];
  });
  const loadedRows = windows.flatMap(({ listing }) => listing.weeks);
  const latestRow =
    newest.status === 'ready' ? (newest.data.weeks[0] ?? null) : null;

  if (restoring && explicitWeek !== restoring.from) {
    setRestoring(null);
    // Only arriving at the latest week drops the windows; any other
    // navigation in between keeps them.
    if (explicitWeek === restoring.week) setAnchors([]);
  }
  const isSettled = allAnchors.every(
    (beforeWeek) => resultFor(beforeWeek).status !== 'loading',
  );
  const needsDeepWindow =
    isEnabled &&
    restoring === null &&
    explicitWeek !== undefined &&
    newest.status === 'ready' &&
    isSettled &&
    !isWeekCovered(windows, explicitWeek) &&
    !anchors.includes(explicitWeek + 1);
  if (needsDeepWindow) setAnchors([...anchors, explicitWeek + 1]);

  // A linked week outside every loaded window is shown at once from its own
  // one-row read while its window loads.
  const isListed = loadedRows.some((row) => row.week === explicitWeek);
  const selected = useWatchedQuery(
    api.canonicalHistory.list,
    `selected:${explicitWeek}:${attempts[windowName(null)] ?? 0}`,
    isEnabled && explicitWeek !== undefined && !isListed
      ? { campaignId, selectedWeek: explicitWeek, limit: 1 }
      : null,
  );
  const pinned = selected.status === 'ready' ? selected.data.selected : null;

  const retry = () =>
    setAttempts((current) => {
      const next = { ...current };
      for (const beforeWeek of allAnchors) {
        if (resultFor(beforeWeek).status !== 'failed') continue;
        const name = windowName(beforeWeek);
        next[name] = (next[name] ?? 0) + 1;
      }
      return next;
    });

  return {
    newest,
    latestRow,
    items: buildWeekIndex(windows, pinned),
    rowFor: (week) =>
      loadedRows.find((row) => row.week === week) ??
      (pinned?.week === week ? pinned : null),
    windowStatus: (beforeWeek) => {
      if (!anchors.includes(beforeWeek)) return 'idle';
      const { status } = resultFor(beforeWeek);
      return status === 'ready' ? 'idle' : status;
    },
    loadEarlier: (beforeWeek) =>
      anchors.includes(beforeWeek)
        ? retry()
        : setAnchors((current) => [...current, beforeWeek]),
    retry,
    restoreNewest: () => {
      if (!latestRow) return;
      if (explicitWeek === latestRow.week) setAnchors([]);
      else setRestoring({ week: latestRow.week, from: explicitWeek });
    },
  };
}
