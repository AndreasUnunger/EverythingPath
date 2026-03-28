'use client';

import { Card } from '~/components/ui/card';
import type {
  ActivityAssetOperationsDraft,
  MarketplaceLedgerEntry,
} from '~/components/week-board/activity-asset-operations';
import { type SummaryRow } from '~/components/week-board/activity-roll-sections';
import {
  formatResolvedEventLabel,
  formatResolvedEventTriggerLabel,
  renderResolvedEventDetails,
  resolveMilitiaEventFromPercentile,
} from '~/components/week-board/event-utils';
import {
  buildEventOccurrenceItems,
  buildOperationSummaryItems,
  buildStagedSlotItems,
  buildUpkeepSummaryItems,
  hasManualTotal,
} from '~/components/week-board/phase-sections/summary-phase-shared';
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
  slotTeams: Array<string | null>;
  activityTeamOperations: {
    recruits: Array<{ slotIndex: number; teamId: string }>;
    dismissals: Array<{ slotIndex: number; teamId: string }>;
    upgrades: Array<{ slotIndex: number; fromTeamId: string; toTeamId: string }>;
  };
  activityOfficerOperations: {
    changes: Array<{
      slotIndex: number;
      role:
        | 'ambassador'
        | 'commandant'
        | 'marshal'
        | 'overseer'
        | 'spymaster'
        | 'strategist';
      characterId?: string;
    }>;
  };
  activityAssetOperations: ActivityAssetOperationsDraft;
  weekWarnings: Array<{ code: string; message: string }>;
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
  cacheDiscoveredMitigationTotal: string;
  theftMitigationTotal: string;
  sicknessTwiceLoyaltyTotal: string;
  turncoatOfficerCheckTotal: string;
  turncoatSelectedTeamId: string;
  missingInActionSelectedTeamId: string;
  sicknessSelectedTeamId: string;
  turnAroundBoostTeamId: string;
  rivalrySelectedTeamIds: string[];
  marketplaces: MarketplaceLedgerEntry[];
  marketDayMarketplaceId: string;
  marketDayTownName: string;
  marketDayAppliesToAllTrackedMarketplaces: boolean;
  overseerEventSupportTarget: '' | 'sabotage' | 'cache_discovered' | 'theft' | 'sickness_twice';
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
    slotTeams,
    activityTeamOperations,
    activityOfficerOperations,
    activityAssetOperations,
    weekWarnings,
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
    cacheDiscoveredMitigationTotal,
    theftMitigationTotal,
    sicknessTwiceLoyaltyTotal,
    turncoatOfficerCheckTotal,
    turncoatSelectedTeamId,
    missingInActionSelectedTeamId,
    sicknessSelectedTeamId,
    turnAroundBoostTeamId,
    rivalrySelectedTeamIds,
    marketplaces,
    marketDayMarketplaceId,
    marketDayTownName,
    marketDayAppliesToAllTrackedMarketplaces,
    overseerEventSupportTarget,
    formatManualTotalForSummaryAction,
  } = viewModel;

  const upkeepItems = buildUpkeepSummaryItems({
    upkeepAttritionTotal,
    showMaxNotorietyPenalty,
    upkeepNotorietyPenaltyTotal,
    maxNotorietyLoyaltyCheckTotal,
    nearestSettlementKey,
    showTreasuryShortagePenalty,
    upkeepTreasuryPenaltyTotal,
    formatManualTotalForSummary: formatManualTotalForSummaryAction,
  });
  const stagedSlotItems = buildStagedSlotItems({ slots, slotTeams });
  const operationItems = buildOperationSummaryItems({
    slots,
    activityTeamOperations,
    activityOfficerOperations,
    activityAssetOperations,
  });
  const marketDayMarketplaceLabel =
    marketplaces.find((marketplace) => marketplace._id === marketDayMarketplaceId)
      ?.label ?? '';
  const eventOccurrenceItems = buildEventOccurrenceItems({
    eventChanceTotal,
    eventTriggerRollTotal,
    hasGuaranteedEventAction,
    guaranteedEventFirstPercentileTotal,
    guaranteedEventSecondPercentileTotal,
    guaranteedEventChoice,
    sabotageCheckTotal,
    sabotageNotorietyIncreaseTotal,
    cacheDiscoveredMitigationTotal,
    theftMitigationTotal,
    sicknessTwiceLoyaltyTotal,
    turncoatOfficerCheckTotal,
    turncoatSelectedTeamId,
    missingInActionSelectedTeamId,
    sicknessSelectedTeamId,
    turnAroundBoostTeamId,
    marketDayMarketplaceLabel,
    marketDayTownName,
    marketDayAppliesToAllTrackedMarketplaces,
    rivalrySelectedTeamIds,
    overseerEventSupportTarget,
    formatManualTotalForSummary: formatManualTotalForSummaryAction,
  });
  const resolvedEventPercentile = hasGuaranteedEventAction
    ? effectiveEventPercentileTotal
    : eventPercentileTotal;

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Card className="border p-3">
        <p className="mb-2 font-mono text-sm font-bold">Week Summary</p>
        <div className="space-y-2 font-mono text-xs">
          <p className="text-muted-foreground">
            Review staged results before committing this week to militia state.
          </p>

          <SummaryListCard
            title="Militia snapshot"
            items={[
              `Rank: ${rank}`,
              `Training: ${training}`,
              `Treasury: ${treasury}`,
              `Notoriety: ${notoriety}`,
            ]}
          />

          <SummaryListCard title="Upkeep totals entered" items={upkeepItems} />
          <SummaryListCard title="Activity selections" items={stagedSlotItems} />
          <SummaryListCard title="Staged operations" items={operationItems} />

          {weekWarnings.length > 0 ? (
            <SummaryListCard
              title="Rules warnings"
              items={weekWarnings.map((warning) => `Warning: ${warning.message}`)}
              listClassName="text-amber-700"
            />
          ) : null}

          {activityRollSummaryRows.length > 0 ? (
            <SummaryListCard
              title="Activity roll totals entered"
              items={activityRollSummaryRows.map(
                (row) => `${row.label}: ${row.value}`,
              )}
            />
          ) : null}
        </div>
      </Card>

      <Card className="border p-3">
        <p className="mb-2 font-mono text-sm font-bold">Event Summary</p>
        <div className="space-y-2 font-mono text-xs">
          {eventOccurrenceItems.length > 0 ? (
            <div className="rounded border p-2">
              <p className="text-muted-foreground">Event occurrence check</p>
              <ul className="mt-1 space-y-1">
                {eventOccurrenceItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="mt-1 text-sm font-bold">
                {formatResolvedEventTriggerLabel(resolvedEventTrigger)}
              </p>
            </div>
          ) : null}

          {shouldResolveEventTable &&
          hasManualTotal(resolvedEventPercentile) ? (
            <ResolvedEventCard
              title="Event table roll"
              percentile={resolvedEventPercentile}
            />
          ) : null}

          {showRollTwiceFields && hasManualTotal(eventRollTwiceFirst) ? (
            <ResolvedEventCard
              title="Roll Twice: first event"
              percentile={eventRollTwiceFirst}
            />
          ) : null}

          {showRollTwiceFields && hasManualTotal(eventRollTwiceSecond) ? (
            <ResolvedEventCard
              title="Roll Twice: second event"
              percentile={eventRollTwiceSecond}
            />
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function SummaryListCard({
  title,
  items,
  listClassName,
}: {
  title: string;
  items: string[];
  listClassName?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="rounded border p-2">
      <p className="text-muted-foreground">{title}</p>
      <ul className={`mt-1 space-y-1 ${listClassName ?? ''}`.trim()}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function ResolvedEventCard({
  title,
  percentile,
}: {
  title: string;
  percentile: string;
}) {
  const resolvedEvent = resolveMilitiaEventFromPercentile(percentile);

  return (
    <div className="rounded border p-2">
      <p className="text-muted-foreground">{title}</p>
      <p className="mt-1 text-sm font-bold">
        {formatResolvedEventLabel(resolvedEvent)}
      </p>
      {renderResolvedEventDetails(resolvedEvent)}
    </div>
  );
}
