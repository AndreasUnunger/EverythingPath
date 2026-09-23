'use client';

import type { MarketplaceLedgerEntry } from '~/components/week-board/activity-asset-operations';
import {
  getCheckBonusHelperText,
  getEventOverseerSupportOptions,
  type EventOverseerSupportTarget,
  type OfficerEffects,
} from '~/components/week-board/officer-effects';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  MILITIA_EVENT_DETAILS,
  MILITIA_EVENT_TABLE,
} from '~/components/week-board/data';
import {
  formatEventRange,
  formatResolvedEventLabel,
  formatResolvedEventTriggerLabel,
  renderEventChanceRulesWarning,
  renderResolvedEventDetails,
} from '~/components/week-board/event-utils';
import type { WeekBoardTeamManager } from '~/components/week-board/team-manager-effects';
import { getTeamManagerBonusForTeamId } from '~/components/week-board/team-manager-effects';
import type {
  EventTriggerResolution,
  ResolvedEventValue,
} from '~/components/week-board/types';
import type { TeamStatus } from '~/lib/militia-domain';

export type EventPhaseViewModel = {
  eventChanceTotal: string;
  setEventChanceTotalAction: (value: string) => void;
  eventTriggerRollTotal: string;
  setEventTriggerRollTotalAction: (value: string) => void;
  eventPercentileTotal: string;
  setEventPercentileTotalAction: (value: string) => void;
  effectiveEventPercentileTotal: string;
  guaranteedEventFirstPercentileTotal: string;
  setGuaranteedEventFirstPercentileTotalAction: (value: string) => void;
  guaranteedEventSecondPercentileTotal: string;
  setGuaranteedEventSecondPercentileTotalAction: (value: string) => void;
  guaranteedEventChoice: 'first' | 'second' | '';
  setGuaranteedEventChoiceAction: (value: 'first' | 'second' | '') => void;
  showRollTwiceFields: boolean;
  eventRollTwiceFirst: string;
  setEventRollTwiceFirstAction: (value: string) => void;
  eventRollTwiceSecond: string;
  setEventRollTwiceSecondAction: (value: string) => void;
  suggestedEventChanceTotal: number;
  rank: number;
  eventWouldOccurBeforeSabotage: boolean;
  sabotageCheckTotal: string;
  setSabotageCheckTotalAction: (value: string) => void;
  sabotageNotorietyIncreaseTotal: string;
  setSabotageNotorietyIncreaseTotalAction: (value: string) => void;
  sabotageNegatesEvent: boolean;
  shouldResolveEventTable: boolean;
  resolvedEventTrigger: EventTriggerResolution;
  hasGuaranteedEventAction: boolean;
  resolvedEvent: ResolvedEventValue;
  resolvedRollTwiceFirst: ResolvedEventValue;
  resolvedRollTwiceSecond: ResolvedEventValue;
  resolvedEventNames: string[];
  teams: Array<{
    teamId: string;
    status: TeamStatus;
    manager: WeekBoardTeamManager;
  }>;
  marketplaces: MarketplaceLedgerEntry[];
  manipulateEventsChoiceText?: string;
  cacheDiscoveredMitigationTotal: string;
  setCacheDiscoveredMitigationTotalAction: (value: string) => void;
  theftMitigationTotal: string;
  setTheftMitigationTotalAction: (value: string) => void;
  sicknessTwiceLoyaltyTotal: string;
  setSicknessTwiceLoyaltyTotalAction: (value: string) => void;
  turncoatTrainingLossTotal: string;
  setTurncoatTrainingLossTotalAction: (value: string) => void;
  turncoatOfficerCheckTotal: string;
  setTurncoatOfficerCheckTotalAction: (value: string) => void;
  turncoatSelectedTeamId: string;
  setTurncoatSelectedTeamIdAction: (value: string) => void;
  missingInActionSelectedTeamId: string;
  setMissingInActionSelectedTeamIdAction: (value: string) => void;
  sicknessSelectedTeamId: string;
  setSicknessSelectedTeamIdAction: (value: string) => void;
  turnAroundBoostTeamId: string;
  setTurnAroundBoostTeamIdAction: (value: string) => void;
  marketDayMarketplaceId: string;
  setMarketDayMarketplaceIdAction: (value: string) => void;
  marketDayTownName: string;
  setMarketDayTownNameAction: (value: string) => void;
  marketDayAppliesToAllTrackedMarketplaces: boolean;
  rivalrySelectedTeamIds: string[];
  setRivalrySelectedTeamIdsAction: (value: string[]) => void;
  officerEffects: OfficerEffects;
  overseerEventSupportTarget: EventOverseerSupportTarget | '';
  setOverseerEventSupportTargetAction: (
    value: EventOverseerSupportTarget | '',
  ) => void;
  onPreviousWeekAction: () => void;
  previousWeekDisabled: boolean;
  continueLabel: string;
  onContinueAction: () => void;
};

export function EventPhaseSection({
  viewModel,
}: {
  viewModel: EventPhaseViewModel;
}) {
  const {
    eventChanceTotal,
    setEventChanceTotalAction,
    eventTriggerRollTotal,
    setEventTriggerRollTotalAction,
    eventPercentileTotal,
    setEventPercentileTotalAction,
    effectiveEventPercentileTotal,
    guaranteedEventFirstPercentileTotal,
    setGuaranteedEventFirstPercentileTotalAction,
    guaranteedEventSecondPercentileTotal,
    setGuaranteedEventSecondPercentileTotalAction,
    guaranteedEventChoice,
    setGuaranteedEventChoiceAction,
    showRollTwiceFields,
    eventRollTwiceFirst,
    setEventRollTwiceFirstAction,
    eventRollTwiceSecond,
    setEventRollTwiceSecondAction,
    suggestedEventChanceTotal,
    rank,
    eventWouldOccurBeforeSabotage,
    sabotageCheckTotal,
    setSabotageCheckTotalAction,
    sabotageNotorietyIncreaseTotal,
    setSabotageNotorietyIncreaseTotalAction,
    sabotageNegatesEvent,
    shouldResolveEventTable,
    resolvedEventTrigger,
    hasGuaranteedEventAction,
    resolvedEvent,
    resolvedRollTwiceFirst,
    resolvedRollTwiceSecond,
    resolvedEventNames,
    teams,
    marketplaces,
    manipulateEventsChoiceText,
    cacheDiscoveredMitigationTotal,
    setCacheDiscoveredMitigationTotalAction,
    theftMitigationTotal,
    setTheftMitigationTotalAction,
    sicknessTwiceLoyaltyTotal,
    setSicknessTwiceLoyaltyTotalAction,
    turncoatTrainingLossTotal,
    setTurncoatTrainingLossTotalAction,
    turncoatOfficerCheckTotal,
    setTurncoatOfficerCheckTotalAction,
    turncoatSelectedTeamId,
    setTurncoatSelectedTeamIdAction,
    missingInActionSelectedTeamId,
    setMissingInActionSelectedTeamIdAction,
    sicknessSelectedTeamId,
    setSicknessSelectedTeamIdAction,
    turnAroundBoostTeamId,
    setTurnAroundBoostTeamIdAction,
    marketDayMarketplaceId,
    setMarketDayMarketplaceIdAction,
    marketDayTownName,
    setMarketDayTownNameAction,
    marketDayAppliesToAllTrackedMarketplaces,
    rivalrySelectedTeamIds,
    setRivalrySelectedTeamIdsAction,
    officerEffects,
    overseerEventSupportTarget,
    setOverseerEventSupportTargetAction,
    onPreviousWeekAction,
    previousWeekDisabled,
    continueLabel,
    onContinueAction,
  } = viewModel;
  const showCacheDiscoveredControls = resolvedEventNames.includes('Cache Discovered');
  const showTheftControls = resolvedEventNames.includes('Theft');
  const showSicknessControls = resolvedEventNames.includes('Sickness');
  const showTurncoatControls = resolvedEventNames.includes('Turncoat');
  const showMissingInActionControls =
    resolvedEventNames.includes('Missing in Action');
  const showTurnAroundControls = resolvedEventNames.includes('Turn Around');
  const showMarketDayControls = resolvedEventNames.includes('Market Day');
  const showRivalryControls = resolvedEventNames.includes('Rivalry');
  const overseerSupportOptions = getEventOverseerSupportOptions({
    officerEffects,
    eventWouldOccurBeforeSabotage,
    resolvedEventNames,
  });
  const sabotageHelperText = getCheckBonusHelperText({
    checkType: 'secrecy',
    officerEffects,
    overseerSupportTarget: overseerEventSupportTarget,
    currentEventTarget: 'sabotage',
    additionalParts:
      getTeamManagerBonusForTeamId('saboteurs', teams) !== undefined
        ? [`Saboteurs manager CHA bonus +${getTeamManagerBonusForTeamId('saboteurs', teams)}`]
        : undefined,
  });
  const cacheDiscoveredHelperText = getCheckBonusHelperText({
    checkType: 'secrecy',
    officerEffects,
    overseerSupportTarget: overseerEventSupportTarget,
    currentEventTarget: 'cache_discovered',
  });
  const theftHelperText = getCheckBonusHelperText({
    checkType: 'loyalty',
    officerEffects,
    overseerSupportTarget: overseerEventSupportTarget,
    currentEventTarget: 'theft',
  });
  const sicknessHelperText = getCheckBonusHelperText({
    checkType: 'loyalty',
    officerEffects,
    overseerSupportTarget: overseerEventSupportTarget,
    currentEventTarget: 'sickness_twice',
  });

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <Card className="border p-3">
        <p className="mb-2 font-mono text-sm font-bold">Event Trigger</p>
        <div className="space-y-2">
          <div className="space-y-1">
            <Label htmlFor="event-chance-total" className="font-mono text-xs">
              Event chance total
            </Label>
            <Input
              id="event-chance-total"
              value={eventChanceTotal}
              onChange={(event) => setEventChanceTotalAction(event.target.value)}
              placeholder={`Suggested ${suggestedEventChanceTotal} from Notoriety + carry (min 10, max 95)`}
              className="font-mono"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="event-trigger-roll-total" className="font-mono text-xs">
              Event trigger roll total
            </Label>
            <Input
              id="event-trigger-roll-total"
              value={eventTriggerRollTotal}
              onChange={(event) => setEventTriggerRollTotalAction(event.target.value)}
              placeholder="Enter event trigger percentile roll total"
              className="font-mono"
            />
          </div>
          <div className="space-y-1">
            <Label
              htmlFor="event-table-percentile-total"
              className="font-mono text-xs"
            >
              Event table percentile total
            </Label>
            <Input
              id="event-table-percentile-total"
              value={eventPercentileTotal}
              onChange={(event) => setEventPercentileTotalAction(event.target.value)}
              placeholder="Enter event table percentile total"
              className="font-mono"
              disabled={!shouldResolveEventTable || hasGuaranteedEventAction}
            />
          </div>
          {hasGuaranteedEventAction ? (
            <>
              <div className="space-y-1">
                <Label
                  htmlFor="event-guaranteed-first-percentile-total"
                  className="font-mono text-xs"
                >
                  Guaranteed roll 1 percentile total
                </Label>
                <Input
                  id="event-guaranteed-first-percentile-total"
                  value={guaranteedEventFirstPercentileTotal}
                  onChange={(event) =>
                    setGuaranteedEventFirstPercentileTotalAction(event.target.value)
                  }
                  placeholder="Enter first guaranteed event roll"
                  className="font-mono"
                  disabled={!shouldResolveEventTable}
                />
              </div>
              <div className="space-y-1">
                <Label
                  htmlFor="event-guaranteed-second-percentile-total"
                  className="font-mono text-xs"
                >
                  Guaranteed roll 2 percentile total
                </Label>
                <Input
                  id="event-guaranteed-second-percentile-total"
                  value={guaranteedEventSecondPercentileTotal}
                  onChange={(event) =>
                    setGuaranteedEventSecondPercentileTotalAction(event.target.value)
                  }
                  placeholder="Enter second guaranteed event roll"
                  className="font-mono"
                  disabled={!shouldResolveEventTable}
                />
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-xs">Chosen guaranteed result</Label>
                <Select
                  value={guaranteedEventChoice || undefined}
                  onValueChange={(value) =>
                    setGuaranteedEventChoiceAction(value as 'first' | 'second')
                  }
                  disabled={!shouldResolveEventTable}
                >
                  <SelectTrigger className="w-full font-mono">
                    <SelectValue placeholder="Select chosen event roll" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first">Use roll 1</SelectItem>
                    <SelectItem value="second">Use roll 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {manipulateEventsChoiceText ? (
                <p className="text-muted-foreground font-mono text-xs">
                  {manipulateEventsChoiceText}
                </p>
              ) : null}
            </>
          ) : null}
          {eventWouldOccurBeforeSabotage ? (
            <>
              <div className="space-y-1">
                <Label
                  htmlFor="event-sabotage-check-total"
                  className="font-mono text-xs"
                >
                  Sabotage check total (optional)
                </Label>
                <Input
                  id="event-sabotage-check-total"
                  value={sabotageCheckTotal}
                  onChange={(event) => setSabotageCheckTotalAction(event.target.value)}
                  placeholder={`DC ${15 + rank}`}
                  className="font-mono"
                />
                {sabotageHelperText ? (
                  <p className="text-muted-foreground font-mono text-xs">
                    {sabotageHelperText}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label
                  htmlFor="event-sabotage-notoriety-total"
                  className="font-mono text-xs"
                >
                  Sabotage notoriety increase total (optional)
                </Label>
                <Input
                  id="event-sabotage-notoriety-total"
                  value={sabotageNotorietyIncreaseTotal}
                  onChange={(event) =>
                    setSabotageNotorietyIncreaseTotalAction(event.target.value)
                  }
                  placeholder="Enter +1d6 total"
                  className="font-mono"
                />
              </div>
            </>
          ) : null}
          {showRollTwiceFields ? (
            <>
              <div className="space-y-1">
                <Label htmlFor="event-roll-twice-first" className="font-mono text-xs">
                  Roll Twice first event total
                </Label>
                <Input
                  id="event-roll-twice-first"
                  value={eventRollTwiceFirst}
                  onChange={(event) => setEventRollTwiceFirstAction(event.target.value)}
                  placeholder="Enter first event total"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="event-roll-twice-second" className="font-mono text-xs">
                  Roll Twice second event total
                </Label>
                <Input
                  id="event-roll-twice-second"
                  value={eventRollTwiceSecond}
                  onChange={(event) =>
                    setEventRollTwiceSecondAction(event.target.value)
                  }
                  placeholder="Enter second event total"
                  className="font-mono"
                />
              </div>
            </>
          ) : null}
        </div>
      </Card>
      <Card className="border p-3 lg:col-span-2">
        <p className="mb-2 font-mono text-sm font-bold">Event Resolution</p>
        <div className="space-y-2 font-mono text-xs">
          <div className="rounded border p-2">
            <p className="text-muted-foreground">Event occurrence check</p>
            <p className="mt-1 text-sm font-bold">
              {formatResolvedEventTriggerLabel(resolvedEventTrigger)}
            </p>
            <p className="text-muted-foreground mt-1">
              Event occurs when trigger roll is lower than event chance.
            </p>
          </div>
          {renderEventChanceRulesWarning(eventChanceTotal)}
          {hasGuaranteedEventAction ? (
            <p className="text-muted-foreground">
              Event is guaranteed this week by staged activity action.
            </p>
          ) : null}
          {eventWouldOccurBeforeSabotage && sabotageCheckTotal.trim() !== '' ? (
            <p className="text-muted-foreground">
              {sabotageNegatesEvent
                ? 'Sabotage check negates this event.'
                : 'Sabotage check does not negate this event.'}
            </p>
          ) : null}
          {shouldResolveEventTable ? (
            <div className="rounded border p-2">
              <p className="text-muted-foreground">Primary event table roll</p>
              <p className="mt-1 text-sm font-bold">
                {formatResolvedEventLabel(resolvedEvent)}
              </p>
              {renderResolvedEventDetails(resolvedEvent)}
              {hasGuaranteedEventAction ? (
                <p className="text-muted-foreground mt-1">
                  Effective roll: {effectiveEventPercentileTotal.trim() || 'not selected'}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="rounded border p-2">
              <p className="text-muted-foreground">Event table</p>
              <p className="mt-1">No event this week; skip Table 6-3 roll.</p>
            </div>
          )}
          {showRollTwiceFields ? (
            <>
              <div className="rounded border p-2">
                <p className="text-muted-foreground">Roll Twice: first event</p>
                <p className="mt-1 text-sm font-bold">
                  {formatResolvedEventLabel(resolvedRollTwiceFirst)}
                </p>
                {renderResolvedEventDetails(resolvedRollTwiceFirst)}
              </div>
              <div className="rounded border p-2">
                <p className="text-muted-foreground">Roll Twice: second event</p>
                <p className="mt-1 text-sm font-bold">
                  {formatResolvedEventLabel(resolvedRollTwiceSecond)}
                </p>
                {renderResolvedEventDetails(resolvedRollTwiceSecond)}
              </div>
            </>
          ) : null}
          <div className="rounded border p-2">
            <p className="font-mono text-xs font-bold">Mitigations and Team Targets</p>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              {overseerSupportOptions.length > 0 ? (
                <div className="space-y-1 md:col-span-2">
                  <Label className="font-mono text-xs">Overseer event support</Label>
                  <Select
                    value={overseerEventSupportTarget || undefined}
                    onValueChange={(value) =>
                      setOverseerEventSupportTargetAction(
                        value === '__none__'
                          ? ''
                          : (value as EventOverseerSupportTarget),
                      )
                    }
                  >
                    <SelectTrigger className="border-primary bg-card w-full border-2 font-mono">
                      <SelectValue placeholder="Select one event check to receive Overseer support" />
                    </SelectTrigger>
                    <SelectContent className="border-primary bg-card border-2 font-mono">
                      <SelectItem value="__none__">No Overseer support selected</SelectItem>
                      {overseerSupportOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {showCacheDiscoveredControls ? (
                <div className="space-y-1">
                  <Label className="font-mono text-xs">
                    Cache Discovered mitigation total
                  </Label>
                  <Input
                    value={cacheDiscoveredMitigationTotal}
                    onChange={(event) =>
                      setCacheDiscoveredMitigationTotalAction(event.target.value)
                    }
                    placeholder="DC 10 + rank"
                    className="font-mono"
                  />
                  {cacheDiscoveredHelperText ? (
                    <p className="text-muted-foreground font-mono text-xs">
                      {cacheDiscoveredHelperText}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {showTheftControls ? (
                <div className="space-y-1">
                  <Label className="font-mono text-xs">Theft mitigation total</Label>
                  <Input
                    value={theftMitigationTotal}
                    onChange={(event) => setTheftMitigationTotalAction(event.target.value)}
                    placeholder="DC 20"
                    className="font-mono"
                  />
                  {theftHelperText ? (
                    <p className="text-muted-foreground font-mono text-xs">
                      {theftHelperText}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {showSicknessControls ? (
                <>
                  <div className="space-y-1">
                    <Label className="font-mono text-xs">
                      Sickness (Twice) loyalty total
                    </Label>
                    <Input
                      value={sicknessTwiceLoyaltyTotal}
                      onChange={(event) =>
                        setSicknessTwiceLoyaltyTotalAction(event.target.value)
                      }
                      placeholder="DC 20"
                      className="font-mono"
                    />
                    {sicknessHelperText ? (
                      <p className="text-muted-foreground font-mono text-xs">
                        {sicknessHelperText}
                      </p>
                    ) : null}
                  </div>
                  <EventTeamSelect
                    label="Sickness team"
                    value={sicknessSelectedTeamId}
                    onChange={setSicknessSelectedTeamIdAction}
                    teams={teams}
                  />
                </>
              ) : null}
              {showTurncoatControls ? (
                <>
                  <div className="space-y-1">
                    <Label className="font-mono text-xs">
                      Turncoat training loss total
                    </Label>
                    <Input
                      value={turncoatTrainingLossTotal}
                      onChange={(event) =>
                        setTurncoatTrainingLossTotalAction(event.target.value)
                      }
                      placeholder={`1d6 + ${rank}`}
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="font-mono text-xs">
                      Turncoat (Twice) officer check total
                    </Label>
                    <Input
                      value={turncoatOfficerCheckTotal}
                      onChange={(event) =>
                        setTurncoatOfficerCheckTotalAction(event.target.value)
                      }
                      placeholder={`DC ${10 + rank}`}
                      className="font-mono"
                    />
                  </div>
                  <EventTeamSelect
                    label="Turncoat team"
                    value={turncoatSelectedTeamId}
                    onChange={setTurncoatSelectedTeamIdAction}
                    teams={teams}
                  />
                </>
              ) : null}
              {showMissingInActionControls ? (
                <EventTeamSelect
                  label="Missing in Action team"
                  value={missingInActionSelectedTeamId}
                  onChange={setMissingInActionSelectedTeamIdAction}
                  teams={teams}
                />
              ) : null}
              {showTurnAroundControls ? (
                <EventTeamSelect
                  label="Turn Around boost team"
                  value={turnAroundBoostTeamId}
                  onChange={setTurnAroundBoostTeamIdAction}
                  teams={teams}
                />
              ) : null}
              {showMarketDayControls ? (
                <div className="space-y-2 md:col-span-2">
                  <div className="space-y-1">
                    <Label className="font-mono text-xs">
                      Market Day tracked marketplace
                    </Label>
                    <Select
                      value={marketDayMarketplaceId || '__none__'}
                      onValueChange={(value) =>
                        setMarketDayMarketplaceIdAction(
                          value === '__none__' ? '' : value,
                        )
                      }
                      disabled={
                        marketplaces.length === 0 ||
                        marketDayAppliesToAllTrackedMarketplaces
                      }
                    >
                      <SelectTrigger className="border-primary bg-card w-full border-2 font-mono">
                        <SelectValue
                          placeholder={
                            marketplaces.length > 0
                              ? 'Select tracked marketplace'
                              : 'No tracked marketplaces yet'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="border-primary bg-card border-2 font-mono">
                        <SelectItem value="__none__">
                          No tracked marketplace selected
                        </SelectItem>
                        {marketplaces.map((marketplace) => (
                          <SelectItem
                            key={marketplace._id}
                            value={marketplace._id}
                          >
                            {marketplace.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="font-mono text-xs">Operated town name</Label>
                    <Input
                      value={marketDayTownName}
                      onChange={(event) =>
                        setMarketDayTownNameAction(event.target.value)
                      }
                      placeholder="Enter town for table reference"
                      className="font-mono"
                    />
                  </div>
                  <p className="text-muted-foreground font-mono text-xs">
                    {marketDayAppliesToAllTrackedMarketplaces
                      ? 'Roll Twice applies the extra 5% discount to all tracked marketplaces this week.'
                      : 'Choose a tracked marketplace for the durable discount, or note the operated town used at the table.'}
                  </p>
                </div>
              ) : null}
              {showRivalryControls ? (
                <div className="space-y-1 md:col-span-2">
                  <Label className="font-mono text-xs">Rivalry teams</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[0, 1].map((index) => (
                      <Select
                        key={`rivalry-${index}`}
                        value={rivalrySelectedTeamIds[index] ?? undefined}
                        onValueChange={(value) => {
                          const next = [...rivalrySelectedTeamIds];
                          next[index] = value;
                          setRivalrySelectedTeamIdsAction(
                            next.filter((item) => item?.trim()),
                          );
                        }}
                      >
                        <SelectTrigger className="border-primary bg-card w-full border-2 font-mono">
                          <SelectValue placeholder={`Select rivalry team ${index + 1}`} />
                        </SelectTrigger>
                        <SelectContent className="border-primary bg-card border-2 font-mono">
                          {teams.map((team) => (
                            <SelectItem
                              key={`rivalry-team-${index}-${team.teamId}`}
                              value={team.teamId}
                            >
                              {team.teamId}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ))}
                  </div>
                </div>
              ) : null}
              {!showCacheDiscoveredControls &&
              !showTheftControls &&
              !showSicknessControls &&
              !showTurncoatControls &&
              !showMissingInActionControls &&
              !showTurnAroundControls &&
              !showMarketDayControls &&
              !showRivalryControls ? (
                <p className="text-muted-foreground font-mono text-xs md:col-span-2">
                  No mitigation or team-target input required for the currently
                  resolved event(s).
                </p>
              ) : null}
            </div>
          </div>
          <p className="text-muted-foreground">
            Enter percentile totals as 1-100 to resolve against Table 6-3.
          </p>
        </div>
      </Card>
      <div className="flex items-center justify-between lg:col-span-3">
        <Button
          variant="outline"
          onClick={onPreviousWeekAction}
          disabled={previousWeekDisabled}
        >
          Previous Week
        </Button>
        <Button onClick={onContinueAction}>{continueLabel}</Button>
      </div>
      {shouldResolveEventTable ? (
        <Card className="border p-3 lg:col-span-3">
          <p className="mb-2 font-mono text-sm font-bold">
            Event Table 6-3 Reference
          </p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {MILITIA_EVENT_TABLE.map((entry) => (
              <div
                key={`${entry.min}-${entry.max}-${entry.name}`}
                className="rounded border p-2"
              >
                <p className="font-mono text-xs font-bold">
                  {formatEventRange(entry.min, entry.max)}: {entry.name}
                </p>
                <ul className="mt-1 space-y-1">
                  {(MILITIA_EVENT_DETAILS[entry.name]?.fullText ?? []).map((line) => (
                    <li
                      key={`${entry.name}-${line}`}
                      className="text-muted-foreground font-mono text-xs"
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function EventTeamSelect({
  label,
  value,
  onChange,
  teams,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  teams: Array<{ teamId: string }>;
}) {
  return (
    <div className="space-y-1">
      <Label className="font-mono text-xs">{label}</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className="border-primary bg-card w-full border-2 font-mono">
          <SelectValue placeholder="Select team" />
        </SelectTrigger>
        <SelectContent className="border-primary bg-card border-2 font-mono">
          {teams.map((team) => (
            <SelectItem key={`${label}-${team.teamId}`} value={team.teamId}>
              {team.teamId}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
