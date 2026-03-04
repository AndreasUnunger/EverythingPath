'use client';

import { Card } from '~/components/ui/card';
import { ACTION_CARDS } from '~/components/week-board/data';
import {
  formatResolvedEventLabel,
  formatResolvedEventTriggerLabel,
  renderResolvedEventDetails,
  resolveMilitiaEventFromPercentile,
} from '~/components/week-board/event-utils';
import { type SummaryRow } from '~/components/week-board/activity-rolls-controller';
import type { ActionId, EventTriggerResolution } from '~/components/week-board/types';

export type SummaryPhaseViewModel = {
  rank: number;
  training: number;
  treasury: number;
  notoriety: number;
  upkeepAttritionTotal: string;
  showMaxNotorietyPenalty: boolean;
  upkeepNotorietyPenaltyTotal: string;
  maxNotorietyLoyaltyCheckTotal: string;
  nearestSettlementKey: string;
  showTreasuryShortagePenalty: boolean;
  upkeepTreasuryPenaltyTotal: string;
  slots: Array<ActionId | null>;
  activityRollSummaryRows: SummaryRow[];
  eventChanceTotal: string;
  eventTriggerRollTotal: string;
  resolvedEventTrigger: EventTriggerResolution;
  shouldResolveEventTable: boolean;
  eventPercentileTotal: string;
  effectiveEventPercentileTotal: string;
  hasGuaranteedEventAction: boolean;
  guaranteedEventFirstPercentileTotal: string;
  guaranteedEventSecondPercentileTotal: string;
  guaranteedEventChoice: 'first' | 'second' | '';
  showRollTwiceFields: boolean;
  eventRollTwiceFirst: string;
  eventRollTwiceSecond: string;
  sabotageCheckTotal: string;
  sabotageNotorietyIncreaseTotal: string;
  formatManualTotalForSummaryAction: (raw: string) => string;
};

export function SummaryPhaseSection({
  viewModel,
}: {
  viewModel: SummaryPhaseViewModel;
}) {
  const {
    rank,
    training,
    treasury,
    notoriety,
    upkeepAttritionTotal,
    showMaxNotorietyPenalty,
    upkeepNotorietyPenaltyTotal,
    maxNotorietyLoyaltyCheckTotal,
    nearestSettlementKey,
    showTreasuryShortagePenalty,
    upkeepTreasuryPenaltyTotal,
    slots,
    activityRollSummaryRows,
    eventChanceTotal,
    eventTriggerRollTotal,
    resolvedEventTrigger,
    shouldResolveEventTable,
    eventPercentileTotal,
    effectiveEventPercentileTotal,
    hasGuaranteedEventAction,
    guaranteedEventFirstPercentileTotal,
    guaranteedEventSecondPercentileTotal,
    guaranteedEventChoice,
    showRollTwiceFields,
    eventRollTwiceFirst,
    eventRollTwiceSecond,
    sabotageCheckTotal,
    sabotageNotorietyIncreaseTotal,
    formatManualTotalForSummaryAction,
  } = viewModel;

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Card className="border p-3">
        <p className="mb-2 font-mono text-sm font-bold">Week Summary</p>
        <div className="space-y-2 font-mono text-xs">
          <p className="text-muted-foreground">
            Review staged results before committing this week to militia state.
          </p>
          <div className="rounded border p-2">
            <p className="text-muted-foreground">Militia snapshot</p>
            <ul className="mt-1 space-y-1">
              <li>Rank: {rank}</li>
              <li>Training: {training}</li>
              <li>Treasury: {treasury}</li>
              <li>Notoriety: {notoriety}</li>
            </ul>
          </div>
          <div className="rounded border p-2">
            <p className="text-muted-foreground">Upkeep totals entered</p>
            <ul className="mt-1 space-y-1">
              <li>
                Attrition total: {formatManualTotalForSummaryAction(upkeepAttritionTotal)}
              </li>
              {showMaxNotorietyPenalty ? (
                <>
                  <li>
                    Max-notoriety penalty total:{' '}
                    {formatManualTotalForSummaryAction(upkeepNotorietyPenaltyTotal)}
                  </li>
                  <li>
                    Max-notoriety loyalty check total:{' '}
                    {formatManualTotalForSummaryAction(
                      maxNotorietyLoyaltyCheckTotal,
                    )}
                  </li>
                  <li>
                    Nearest settlement:{' '}
                    {nearestSettlementKey.trim() ? nearestSettlementKey : 'Not selected'}
                  </li>
                </>
              ) : null}
              {showTreasuryShortagePenalty ? (
                <li>
                  Treasury-shortage penalty total:{' '}
                  {formatManualTotalForSummaryAction(upkeepTreasuryPenaltyTotal)}
                </li>
              ) : null}
            </ul>
          </div>
          <div className="rounded border p-2">
            <p className="text-muted-foreground">Activity selections</p>
            <ul className="mt-1 space-y-1">
              {slots.map((slotActionId, index) => {
                const action = ACTION_CARDS.find((card) => card.id === slotActionId);
                return (
                  <li key={`summary-slot-${index + 1}`}>
                    Slot {index + 1}: {action ? action.title : 'Empty'}
                  </li>
                );
              })}
            </ul>
          </div>
          {activityRollSummaryRows.length > 0 ? (
            <div className="rounded border p-2">
              <p className="text-muted-foreground">Activity roll totals entered</p>
              <ul className="mt-1 space-y-1">
                {activityRollSummaryRows.map((row) => (
                  <li key={row.label}>
                    {row.label}: {row.value}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="rounded border p-2">
            <p className="text-muted-foreground">Treasury changes</p>
            <p className="mt-1">
              Deposits and withdrawals are applied immediately. Current treasury above
              reflects all entered upkeep treasury changes.
            </p>
          </div>
        </div>
      </Card>
      <Card className="border p-3">
        <p className="mb-2 font-mono text-sm font-bold">Event Summary</p>
        <div className="space-y-2 font-mono text-xs">
          <div className="rounded border p-2">
            <p className="text-muted-foreground">Event occurrence check</p>
            <ul className="mt-1 space-y-1">
              <li>
                Event chance total: {formatManualTotalForSummaryAction(eventChanceTotal)}
              </li>
              <li>
                Trigger roll total:{' '}
                {formatManualTotalForSummaryAction(eventTriggerRollTotal)}
              </li>
              {hasGuaranteedEventAction ? (
                <>
                  <li>
                    Guaranteed roll 1:{' '}
                    {formatManualTotalForSummaryAction(
                      guaranteedEventFirstPercentileTotal,
                    )}
                  </li>
                  <li>
                    Guaranteed roll 2:{' '}
                    {formatManualTotalForSummaryAction(
                      guaranteedEventSecondPercentileTotal,
                    )}
                  </li>
                  <li>
                    Guaranteed selection:{' '}
                    {guaranteedEventChoice ? guaranteedEventChoice : 'Not selected'}
                  </li>
                </>
              ) : null}
              <li>
                Sabotage check total:{' '}
                {formatManualTotalForSummaryAction(sabotageCheckTotal)}
              </li>
              <li>
                Sabotage notoriety increase:{' '}
                {formatManualTotalForSummaryAction(sabotageNotorietyIncreaseTotal)}
              </li>
            </ul>
            <p className="mt-1 text-sm font-bold">
              {formatResolvedEventTriggerLabel(resolvedEventTrigger)}
            </p>
          </div>
          {shouldResolveEventTable ? (
            <div className="rounded border p-2">
              <p className="text-muted-foreground">Event table roll</p>
              <p className="mt-1 text-sm font-bold">
                {formatResolvedEventLabel(
                  resolveMilitiaEventFromPercentile(
                    hasGuaranteedEventAction
                      ? effectiveEventPercentileTotal
                      : eventPercentileTotal,
                  ),
                )}
              </p>
              {renderResolvedEventDetails(
                resolveMilitiaEventFromPercentile(
                  hasGuaranteedEventAction
                    ? effectiveEventPercentileTotal
                    : eventPercentileTotal,
                ),
              )}
            </div>
          ) : null}
          {showRollTwiceFields ? (
            <>
              <div className="rounded border p-2">
                <p className="text-muted-foreground">Roll Twice: first event</p>
                <p className="mt-1 text-sm font-bold">
                  {formatResolvedEventLabel(
                    resolveMilitiaEventFromPercentile(eventRollTwiceFirst),
                  )}
                </p>
                {renderResolvedEventDetails(
                  resolveMilitiaEventFromPercentile(eventRollTwiceFirst),
                )}
              </div>
              <div className="rounded border p-2">
                <p className="text-muted-foreground">Roll Twice: second event</p>
                <p className="mt-1 text-sm font-bold">
                  {formatResolvedEventLabel(
                    resolveMilitiaEventFromPercentile(eventRollTwiceSecond),
                  )}
                </p>
                {renderResolvedEventDetails(
                  resolveMilitiaEventFromPercentile(eventRollTwiceSecond),
                )}
              </div>
            </>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
