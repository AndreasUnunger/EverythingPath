'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Id } from '@convex/_generated/dataModel';
import {
  ACTIVITY_ROLL_KEYS,
  buildActivityRollSections,
  isParsableActivityRollTotal,
  mergeActivityRollDraftWithServer,
  type ActivityRollDraft,
  type ActivityRollKey,
  toActivityRollDraft,
} from '~/components/week-board/activity-roll-sections';
import type { OfficerEffects } from '~/components/week-board/officer-effects';
import { ActivityRollsPanel } from '~/components/week-board/activity-rolls-panel';
import type { ActivityRollTotals } from '~/components/week-board/roll-totals';
import type { WeekBoardTeamRow } from '~/components/week-board/team-manager-effects';
import type { ActionId } from '~/components/week-board/types';
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
  rank,
  stagedActionIds,
  serverTotals,
  officerEffects,
  strategistBonusActionId,
  recruitTeamId,
  slotTeams,
  teams,
  queueActivityRollTotalsPatchAction,
  onErrorAction,
  className,
  showTitle = true,
}: {
  militiaId: Id<'militia'> | undefined;
  rank: number;
  stagedActionIds: string[];
  serverTotals: ActivityRollTotals;
  officerEffects: OfficerEffects;
  strategistBonusActionId: ActionId | null;
  recruitTeamId?: string;
  slotTeams: Array<string | null>;
  teams: WeekBoardTeamRow[];
  queueActivityRollTotalsPatchAction: (args: {
    militiaId: Id<'militia'>;
    activityRollTotals: Partial<Record<ActivityRollKey, string>>;
  }) => Promise<void>;
  onErrorAction: (message: string) => void;
  className?: string;
  showTitle?: boolean;
}) {
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
    () =>
      buildActivityRollSections({
        rank,
        stagedActionIds,
        draft,
        setField,
        officerEffects,
        strategistBonusActionId,
        recruitTeamId,
        slotTeams,
        teams,
      }),
    [
      draft,
      officerEffects,
      rank,
      recruitTeamId,
      stagedActionIds,
      strategistBonusActionId,
      slotTeams,
      teams,
    ],
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
    delayMs: 900,
    deps: [militiaId, draft, serverTotals, enabledFieldKeys],
    shouldSkip: () => {
      if (!militiaId) return true;
      const patch = buildActivityRollTotalsPatch({
        draft,
        serverTotals,
        enabledFieldKeys,
      });

      if (!patch) return true;

      return !ACTIVITY_ROLL_KEYS.every((key) =>
        isParsableActivityRollTotal(enabledFieldKeys.has(key) ? draft[key] : ''),
      );
    },
    run: async () => {
      if (!militiaId) return;
      const patch = buildActivityRollTotalsPatch({
        draft,
        serverTotals,
        enabledFieldKeys,
      });

      if (!patch) return;

      await queueActivityRollTotalsPatchAction({
        militiaId,
        activityRollTotals: patch,
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

function buildActivityRollTotalsPatch({
  draft,
  serverTotals,
  enabledFieldKeys,
}: {
  draft: ActivityRollDraft;
  serverTotals: ActivityRollTotals;
  enabledFieldKeys: Set<ActivityRollKey>;
}) {
  const patch: Partial<Record<ActivityRollKey, string>> = {};

  for (const key of ACTIVITY_ROLL_KEYS) {
    const localValue = enabledFieldKeys.has(key) ? draft[key] : '';
    const serverValue = enabledFieldKeys.has(key)
      ? (serverTotals[key]?.toString() ?? '')
      : '';

    if (localValue !== serverValue) {
      patch[key] = localValue;
    }
  }

  return Object.keys(patch).length > 0 ? patch : undefined;
}
