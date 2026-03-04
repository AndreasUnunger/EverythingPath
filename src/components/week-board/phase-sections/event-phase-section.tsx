'use client';

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
import type {
  EventTriggerResolution,
  ResolvedEventValue,
} from '~/components/week-board/types';

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
    onPreviousWeekAction,
    previousWeekDisabled,
    continueLabel,
    onContinueAction,
  } = viewModel;

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
