'use client';

import { useEffect, useState } from 'react';
import { useConvex } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import type { HistorySelection } from '~/lib/campaign-routes';

export type CanonicalHistory = NonNullable<
  FunctionReturnType<typeof api.canonicalHistory.read>
>;

type HistoryResult = {
  key: string;
  data?: CanonicalHistory | null;
  failed?: boolean;
};

export function useCanonicalHistory(
  campaignId: Id<'campaign'>,
  selection: HistorySelection,
  attempt: number,
  { enabled = true, scope = '' }: { enabled?: boolean; scope?: string } = {},
) {
  const convex = useConvex();
  const { week, recordId, beforeSequence } = selection;
  const key = JSON.stringify([
    campaignId,
    week,
    recordId,
    beforeSequence,
    attempt,
    enabled,
    scope,
  ]);
  const [result, setResult] = useState<HistoryResult>({ key });
  // Clear retired selections, including a disabled tab, before they can reappear.
  if (result.key !== key) setResult({ key });
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let stop: (() => void) | undefined;
    try {
      const watch = convex.watchQuery(api.canonicalHistory.read, {
        campaignId,
        week,
        recordId,
        beforeSequence,
      });
      const update = () => {
        if (!active) return;
        try {
          setResult({ key, data: watch.localQueryResult() });
        } catch {
          setResult({ key, failed: true });
        }
      };
      stop = watch.onUpdate(update);
      update();
    } catch {
      setResult({ key, failed: true });
    }
    return () => {
      active = false;
      stop?.();
    };
  }, [convex, campaignId, week, recordId, beforeSequence, key, enabled]);
  return enabled && result?.key === key ? result : undefined;
}
