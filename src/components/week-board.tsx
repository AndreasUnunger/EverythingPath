'use client';

import type { Id } from '@convex/_generated/dataModel';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { WEEK_PHASES } from '~/components/week-board/data';
import {
  ActivityPhaseSection,
  EventPhaseSection,
  SummaryPhaseSection,
  UpkeepPhaseSection,
} from '~/components/week-board/phase-sections';
import { useWeekBoardController } from '~/components/week-board/use-week-board-controller';

export function WeekBoard({
  campaignId,
  organizationId,
  canQuery,
}: {
  campaignId: Id<'campaign'> | undefined;
  organizationId: string;
  canQuery: boolean;
}) {
  const controller = useWeekBoardController({
    campaignId,
    organizationId,
    canQuery,
  });

  if (!campaignId) {
    return (
      <p className="text-muted-foreground font-mono text-sm">
        Select a campaign to use the week board.
      </p>
    );
  }

  if (!canQuery) {
    return (
      <p className="text-muted-foreground font-mono text-sm">
        Waiting for organization access sync...
      </p>
    );
  }

  if (controller.isLoading || !controller.data) {
    return (
      <p className="text-muted-foreground font-mono text-sm">
        Loading week board...
      </p>
    );
  }

  return (
    <Card className="bg-card border-2 p-4">
      <h3 className="text-primary font-sans text-xl font-bold">
        Week {controller.data.state.weekNumber}
      </h3>

      {controller.error ? (
        <div className="border-destructive/50 bg-destructive/10 text-destructive mb-3 p-2 font-mono text-sm">
          {controller.error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {WEEK_PHASES.map((item) => (
          <Button
            key={item}
            variant={controller.phase === item ? 'default' : 'outline'}
            className="font-mono capitalize"
            onClick={() => void controller.actions.changePhase(item)}
          >
            {item === 'week_closed' ? 'summary' : item}
          </Button>
        ))}
      </div>

      {controller.phase === 'upkeep' ? (
        <UpkeepPhaseSection
          upkeepAttritionTotal={controller.upkeepAttritionTotal}
          setUpkeepAttritionTotalAction={controller.setUpkeepAttritionTotal}
          showMaxNotorietyPenalty={controller.showMaxNotorietyPenalty}
          upkeepNotorietyPenaltyTotal={controller.upkeepNotorietyPenaltyTotal}
          setUpkeepNotorietyPenaltyTotalAction={
            controller.setUpkeepNotorietyPenaltyTotal
          }
          showTreasuryShortagePenalty={controller.showTreasuryShortagePenalty}
          upkeepTreasuryPenaltyTotal={controller.upkeepTreasuryPenaltyTotal}
          setUpkeepTreasuryPenaltyTotalAction={
            controller.setUpkeepTreasuryPenaltyTotal
          }
          minimumTreasury={controller.minimumTreasury}
          treasuryAmount={controller.treasuryAmount}
          setTreasuryAmountAction={controller.setTreasuryAmount}
          applyTreasuryUpdateAction={(mode) => {
            void controller.actions.applyTreasuryUpdate(mode);
          }}
          applyRankUpAction={() => {
            void controller.actions.applyRankUp();
          }}
          canRankUp={controller.data.canRankUp}
          rankUpBlockedReason={controller.data.rankUpBlockedReason}
        />
      ) : null}

      {controller.phase === 'activity' ? (
        <ActivityPhaseSection
          dragState={controller.dragState}
          setDragStateAction={controller.setDragState}
          assignedActionIds={controller.assignedActionIds}
          hasNonLieLowStaged={controller.hasNonLieLowStaged}
          hasLieLowStaged={controller.hasLieLowStaged}
          slotRows={controller.slotRows}
          activeDropSlotId={controller.activeDropSlotId}
          slotRefs={controller.slotRefs}
          resetSlotsAction={() => {
            void controller.actions.resetSlots();
          }}
          militiaId={controller.data.militiaId}
          organizationId={organizationId}
          rank={controller.data.rank}
          stagedActionIds={controller.stagedActionIds}
          serverActivityTotals={controller.serverActivityTotals}
          onErrorAction={(message) => controller.actions.setError(message)}
        />
      ) : null}

      {controller.phase === 'event' ? (
        <EventPhaseSection
          eventChanceTotal={controller.eventChanceTotal}
          setEventChanceTotalAction={controller.setEventChanceTotal}
          eventTriggerRollTotal={controller.eventTriggerRollTotal}
          setEventTriggerRollTotalAction={controller.setEventTriggerRollTotal}
          eventPercentileTotal={controller.eventPercentileTotal}
          setEventPercentileTotalAction={controller.setEventPercentileTotal}
          showRollTwiceFields={controller.showRollTwiceFields}
          eventRollTwiceFirst={controller.eventRollTwiceFirst}
          setEventRollTwiceFirstAction={controller.setEventRollTwiceFirst}
          eventRollTwiceSecond={controller.eventRollTwiceSecond}
          setEventRollTwiceSecondAction={controller.setEventRollTwiceSecond}
          suggestedEventChanceTotal={controller.suggestedEventChanceTotal}
          rank={controller.data.rank}
          eventWouldOccurBeforeSabotage={
            controller.eventWouldOccurBeforeSabotage
          }
          sabotageCheckTotal={controller.sabotageCheckTotal}
          setSabotageCheckTotalAction={controller.setSabotageCheckTotal}
          sabotageNotorietyIncreaseTotal={
            controller.sabotageNotorietyIncreaseTotal
          }
          setSabotageNotorietyIncreaseTotalAction={
            controller.setSabotageNotorietyIncreaseTotal
          }
          sabotageNegatesEvent={controller.sabotageNegatesEvent}
          shouldResolveEventTable={controller.shouldResolveEventTable}
          resolvedEventTrigger={controller.resolvedEventTrigger}
          hasGuaranteedEventAction={controller.hasGuaranteedEventAction}
          resolvedEvent={controller.resolvedEvent}
          resolvedRollTwiceFirst={controller.resolvedRollTwiceFirst}
          resolvedRollTwiceSecond={controller.resolvedRollTwiceSecond}
        />
      ) : null}

      {controller.phase === 'week_closed' ? (
        <SummaryPhaseSection
          rank={controller.data.rank}
          training={controller.data.training}
          treasury={controller.data.treasury}
          notoriety={controller.data.notoriety}
          upkeepAttritionTotal={controller.upkeepAttritionTotal}
          showMaxNotorietyPenalty={controller.showMaxNotorietyPenalty}
          upkeepNotorietyPenaltyTotal={controller.upkeepNotorietyPenaltyTotal}
          showTreasuryShortagePenalty={controller.showTreasuryShortagePenalty}
          upkeepTreasuryPenaltyTotal={controller.upkeepTreasuryPenaltyTotal}
          slots={controller.slots}
          activityRollSummaryRows={controller.activityRollSummaryRows}
          eventChanceTotal={controller.eventChanceTotal}
          eventTriggerRollTotal={controller.eventTriggerRollTotal}
          resolvedEventTrigger={controller.resolvedEventTrigger}
          shouldResolveEventTable={controller.shouldResolveEventTable}
          eventPercentileTotal={controller.eventPercentileTotal}
          showRollTwiceFields={controller.showRollTwiceFields}
          eventRollTwiceFirst={controller.eventRollTwiceFirst}
          eventRollTwiceSecond={controller.eventRollTwiceSecond}
          sabotageCheckTotal={controller.sabotageCheckTotal}
          sabotageNotorietyIncreaseTotal={
            controller.sabotageNotorietyIncreaseTotal
          }
          formatManualTotalForSummaryAction={formatManualTotalForSummaryAction}
        />
      ) : null}

      <div className="mt-4 flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => void controller.actions.goBackWeek()}
          disabled={controller.data.state.weekNumber <= 1}
        >
          Previous Week
        </Button>
        {controller.phase === 'upkeep' ? (
          <Button
            onClick={() => void controller.actions.changePhase('activity')}
          >
            Continue to Activity
          </Button>
        ) : null}
        {controller.phase === 'activity' ? (
          <Button onClick={() => void controller.actions.changePhase('event')}>
            Continue to Event
          </Button>
        ) : null}
        {controller.phase === 'event' ? (
          <Button onClick={() => void controller.actions.continueToSummary()}>
            Continue to Summary
          </Button>
        ) : null}
        {controller.phase === 'week_closed' ? (
          <Button onClick={() => void controller.actions.commitPhase()}>
            Commit Changes to Militia
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

function formatManualTotalForSummaryAction(raw: string) {
  const trimmed = raw.trim();
  return trimmed ? trimmed : 'Not entered';
}
