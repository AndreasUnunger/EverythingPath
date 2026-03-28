'use client';

import type { Id } from '@convex/_generated/dataModel';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { AssetLedgerPanel } from '~/components/week-board/asset-ledger-panel';
import { WEEK_PHASES } from '~/components/week-board/data';
import {
  buildActivityPhaseViewModel,
  buildEventPhaseViewModel,
  buildPersistentPhaseViewModel,
  buildSummaryPhaseViewModel,
  buildUpkeepPhaseViewModel,
} from '~/components/week-board/phase-sections/build-view-models';
import {
  ActivityPhaseSection,
  EventPhaseSection,
  PersistentPhaseSection,
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

  const hasTrackedMilitiaState =
    controller.settlements.length > 0 ||
    controller.caches.length > 0 ||
    controller.marketplaces.length > 0 ||
    controller.orders.length > 0 ||
    controller.trackedPeople.length > 0;
  const showGlobalAssetPanel =
    controller.phase !== 'activity' && hasTrackedMilitiaState;

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
        {WEEK_PHASES.filter((item) =>
          controller.availablePhases.includes(item),
        ).map((item) => (
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

      <div
        className={
          showGlobalAssetPanel
            ? 'mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]'
            : 'mt-4'
        }
      >
        <div>
          {controller.phase === 'upkeep' ? (
            <UpkeepPhaseSection viewModel={buildUpkeepPhaseViewModel(controller)} />
          ) : null}

          {controller.phase === 'activity' ? (
            <ActivityPhaseSection
              viewModel={buildActivityPhaseViewModel({ controller })}
            />
          ) : null}

          {controller.phase === 'event' ? (
            <EventPhaseSection viewModel={buildEventPhaseViewModel(controller)} />
          ) : null}

          {controller.phase === 'persistent' ? (
            <PersistentPhaseSection
              viewModel={buildPersistentPhaseViewModel(controller)}
            />
          ) : null}

          {controller.phase === 'week_closed' ? (
            <SummaryPhaseSection
              viewModel={buildSummaryPhaseViewModel({
                controller,
                formatManualTotalForSummaryAction,
              })}
            />
          ) : null}
        </div>

        {showGlobalAssetPanel ? (
          <AssetLedgerPanel
            currentWeek={controller.data.state.weekNumber}
            settlements={controller.settlements}
            caches={controller.caches}
            marketplaces={controller.marketplaces}
            orders={controller.orders}
            trackedPeople={controller.trackedPeople}
          />
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between">
        {controller.phase === 'event' ? null : (
          <Button
            variant="outline"
            onClick={() => void controller.actions.goBackWeek()}
            disabled={controller.data.state.weekNumber <= 1}
          >
            Previous Week
          </Button>
        )}
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
        {controller.phase === 'persistent' ? (
          <Button
            onClick={() => void controller.actions.changePhase('week_closed')}
          >
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
