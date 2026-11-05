'use client';

import { useState } from 'react';
import type { Id } from '../../../convex/_generated/dataModel';
import {
  useCanonicalHistory,
  type CanonicalHistory,
} from './use-canonical-history';

export type RecentHistory = {
  status: 'idle' | 'loading' | 'failed' | 'ready';
  weeks: CanonicalHistory[];
  retry: () => void;
};

export function useRecentHistory(
  campaignId: Id<'campaign'>,
  enabled: boolean,
): RecentHistory {
  const [attempt, setAttempt] = useState(0);
  const latest = useCanonicalHistory(campaignId, {}, attempt, { enabled });
  const previousWeek = latest?.data?.previousWeek;
  const scope = JSON.stringify([
    latest?.data?.week,
    latest?.data?.effectiveRecordId,
  ]);
  const previous = useCanonicalHistory(
    campaignId,
    { week: previousWeek ?? undefined },
    attempt,
    { enabled: enabled && previousWeek != null, scope },
  );
  const oldestWeek = previous?.data?.previousWeek;
  const oldest = useCanonicalHistory(
    campaignId,
    { week: oldestWeek ?? undefined },
    attempt,
    {
      enabled: enabled && oldestWeek != null,
      scope: JSON.stringify([
        scope,
        previous?.data?.week,
        previous?.data?.effectiveRecordId,
      ]),
    },
  );
  const retry = () => setAttempt((value) => value + 1);
  if (!enabled) return { status: 'idle', weeks: [], retry };
  const results = [latest];
  if (previousWeek != null) results.push(previous);
  if (oldestWeek != null) results.push(oldest);
  if (results.some((result) => result?.failed))
    return { status: 'failed', weeks: [], retry };
  if (results.some((result) => result?.data === undefined))
    return { status: 'loading', weeks: [], retry };
  return {
    status: 'ready',
    weeks: results.flatMap((result) => (result?.data ? [result.data] : [])),
    retry,
  };
}
