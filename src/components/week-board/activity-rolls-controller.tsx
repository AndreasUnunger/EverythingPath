'use client';

import { useEffect, useRef, useState } from 'react';
import type { Id } from '@convex/_generated/dataModel';
import {
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
    if (!militiaId || !isParsableActivityRollTotal(value)) return;
    // The board owns batching so leaving Activity cannot discard pending rolls.
    void queueActivityRollTotalsPatchAction({
      militiaId,
      activityRollTotals: { [key]: value },
    }).catch((error: unknown) => {
      onErrorAction(
        getErrorMessage(error, 'Failed to auto-save Activity roll totals.'),
      );
    });
  };

  const sections = buildActivityRollSections({
    rank,
    stagedActionIds,
    draft,
    setField,
    officerEffects,
    strategistBonusActionId,
    recruitTeamId,
    slotTeams,
    teams,
  });

  return (
    <ActivityRollsPanel
      sections={sections}
      className={className}
      showTitle={showTitle}
    />
  );
}
