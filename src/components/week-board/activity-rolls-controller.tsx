'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Id } from '@convex/_generated/dataModel';
import { api as db } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import {
  ACTIVITY_ROLL_KEYS,
  buildActivityRollSections,
  isParsableActivityRollTotal,
  mergeActivityRollDraftWithServer,
  type ActivityRollDraft,
  type ActivityRollKey,
  toActivityRollDraft,
} from '~/components/week-board/activity-roll-sections';
import { ActivityRollsPanel } from '~/components/week-board/activity-rolls-panel';
import type { ActivityRollTotals } from '~/components/week-board/roll-totals';
import { useDebouncedAutosave } from '~/hooks/use-debounced-autosave';

export {
  buildActivityRollSummaryRows,
  type SummaryRow,
} from '~/components/week-board/activity-roll-sections';

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return fallback;
}

export function ActivityRollsController({
  militiaId,
  organizationId,
  rank,
  stagedActionIds,
  serverTotals,
  onErrorAction,
  className,
  showTitle = true,
}: {
  militiaId: Id<'militia'> | undefined;
  organizationId: string;
  rank: number;
  stagedActionIds: string[];
  serverTotals: ActivityRollTotals;
  onErrorAction: (message: string) => void;
  className?: string;
  showTitle?: boolean;
}) {
  const saveWeekBoardState = useMutation(db.weekBoard.saveWeekBoardState);
  const initialServerDraft = toActivityRollDraft(serverTotals);
  const [draft, setDraft] = useState<ActivityRollDraft>(initialServerDraft);
  const lastServerDraftRef = useRef<ActivityRollDraft>(initialServerDraft);

  useEffect(() => {
    const nextServerDraft = toActivityRollDraft(serverTotals);
    setDraft((currentDraft) =>
      mergeActivityRollDraftWithServer({
        currentDraft,
        previousServerDraft: lastServerDraftRef.current,
        nextServerDraft,
      }),
    );
    lastServerDraftRef.current = nextServerDraft;
  }, [serverTotals]);

  const setField = (key: ActivityRollKey, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const sections = useMemo(
    () => buildActivityRollSections({ rank, stagedActionIds, draft, setField }),
    [rank, stagedActionIds, draft],
  );

  const enabledFieldKeys = useMemo(() => {
    return new Set<ActivityRollKey>(
      sections.flatMap((section) =>
        section.fields
          .filter((field) => !field.disabled)
          .map((field) => field.key as ActivityRollKey),
      ),
    );
  }, [sections]);

  useDebouncedAutosave({
    enabled: Boolean(militiaId),
    deps: [militiaId, organizationId, draft, serverTotals, enabledFieldKeys],
    shouldSkip: () => {
      if (!militiaId) return true;
      const normalized = ACTIVITY_ROLL_KEYS.map((key) => {
        const active = enabledFieldKeys.has(key);
        return {
          local: active ? draft[key] : '',
          server: active ? (serverTotals[key]?.toString() ?? '') : '',
        };
      });

      if (normalized.every((row) => row.local === row.server)) return true;
      return !normalized.every((row) => isParsableActivityRollTotal(row.local));
    },
    run: async () => {
      if (!militiaId) return;
      const activityRollTotals = Object.fromEntries(
        ACTIVITY_ROLL_KEYS.map((key) => {
          const active = enabledFieldKeys.has(key);
          return [key, active ? draft[key] : undefined];
        }),
      );

      await saveWeekBoardState({
        organizationId,
        militiaId,
        patch: { activityRollTotals },
      });
    },
    onError: (error) => {
      onErrorAction(getErrorMessage(error, 'Failed to auto-save Activity roll totals.'));
    },
  });

  return (
    <ActivityRollsPanel
      sections={sections}
      className={className}
      showTitle={showTitle}
    />
  );
}
