'use client';

import type { Id } from '@convex/_generated/dataModel';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  ACTION_CARDS,
  MILITIA_EVENT_DETAILS,
  MILITIA_EVENT_TABLE,
} from '~/components/week-board/data';
import {
  formatEventRange,
  formatResolvedEventLabel,
  formatResolvedEventTriggerLabel,
  renderEventChanceRulesWarning,
  renderResolvedEventDetails,
  resolveMilitiaEventFromPercentile,
} from '~/components/week-board/event-utils';
import type { ActivityRollTotals } from '~/components/week-board/roll-totals';
import type {
  ActionId,
  DragState,
  EventTriggerResolution,
  ResolvedEventValue,
} from '~/components/week-board/types';
import {
  ActivityRollsController,
  type SummaryRow,
} from '~/components/week-board/activity-rolls-controller';

export function UpkeepPhaseSection({
  upkeepAttritionTotal,
  setUpkeepAttritionTotalAction,
  showMaxNotorietyPenalty,
  upkeepNotorietyPenaltyTotal,
  setUpkeepNotorietyPenaltyTotalAction,
  showTreasuryShortagePenalty,
  upkeepTreasuryPenaltyTotal,
  setUpkeepTreasuryPenaltyTotalAction,
  minimumTreasury,
  treasuryAmount,
  setTreasuryAmountAction,
  applyTreasuryUpdateAction,
  applyRankUpAction,
  canRankUp,
  rankUpBlockedReason,
}: {
  upkeepAttritionTotal: string;
  setUpkeepAttritionTotalAction: (value: string) => void;
  showMaxNotorietyPenalty: boolean;
  upkeepNotorietyPenaltyTotal: string;
  setUpkeepNotorietyPenaltyTotalAction: (value: string) => void;
  showTreasuryShortagePenalty: boolean;
  upkeepTreasuryPenaltyTotal: string;
  setUpkeepTreasuryPenaltyTotalAction: (value: string) => void;
  minimumTreasury: number;
  treasuryAmount: string;
  setTreasuryAmountAction: (value: string) => void;
  applyTreasuryUpdateAction: (mode: 'deposit' | 'withdraw') => void;
  applyRankUpAction: () => void;
  canRankUp: boolean;
  rankUpBlockedReason?: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Card className="border p-3">
        <p className="mb-2 font-mono text-sm font-bold">Upkeep Totals</p>
        <div className="space-y-2">
          <div className="space-y-1">
            <Label
              htmlFor="upkeep-attrition-total"
              className="font-mono text-xs"
            >
              Training attrition total
            </Label>
            <Input
              id="upkeep-attrition-total"
              value={upkeepAttritionTotal}
              onChange={(event) => setUpkeepAttritionTotalAction(event.target.value)}
              placeholder="Enter total attrition result"
              className="font-mono"
            />
          </div>
          {showMaxNotorietyPenalty ? (
            <div className="space-y-1">
              <Label
                htmlFor="upkeep-max-notoriety-penalty"
                className="font-mono text-xs"
              >
                Maximum-notoriety penalty total
              </Label>
              <Input
                id="upkeep-max-notoriety-penalty"
                value={upkeepNotorietyPenaltyTotal}
                onChange={(event) =>
                  setUpkeepNotorietyPenaltyTotalAction(event.target.value)
                }
                placeholder="Enter total max-notoriety penalty result"
                className="font-mono"
              />
            </div>
          ) : null}
          {showTreasuryShortagePenalty ? (
            <div className="space-y-1">
              <Label
                htmlFor="upkeep-treasury-shortage-penalty"
                className="font-mono text-xs"
              >
                Treasury-shortage penalty total
              </Label>
              <Input
                id="upkeep-treasury-shortage-penalty"
                value={upkeepTreasuryPenaltyTotal}
                onChange={(event) =>
                  setUpkeepTreasuryPenaltyTotalAction(event.target.value)
                }
                placeholder={`Enter total treasury-shortage penalty result (min treasury ${minimumTreasury})`}
                className="font-mono"
              />
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-2">
            <div className="space-y-1">
              <Label
                htmlFor="upkeep-treasury-amount"
                className="font-mono text-xs"
              >
                Treasury transaction amount
              </Label>
              <Input
                id="upkeep-treasury-amount"
                value={treasuryAmount}
                onChange={(event) => setTreasuryAmountAction(event.target.value)}
                placeholder="Enter treasury amount"
                className="font-mono"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => applyTreasuryUpdateAction('deposit')}
              >
                Deposit
              </Button>
              <Button
                variant="outline"
                onClick={() => applyTreasuryUpdateAction('withdraw')}
              >
                Withdraw
              </Button>
            </div>
          </div>
        </div>
      </Card>
      <Card className="border p-3">
        <p className="font-mono text-sm font-bold">Upkeep Order</p>
        <ul className="text-muted-foreground mt-2 space-y-1 font-mono text-xs">
          <li>1. Training Attrition</li>
          <li>2. Maximum-Notoriety Penalties</li>
          <li>3. Treasury-Shortage Penalties</li>
          <li>4. Increase Rank</li>
          <li>5. Deposits and Withdrawals</li>
        </ul>
        <div className="mt-3 flex gap-2">
          <Button variant="outline" onClick={applyRankUpAction} disabled={!canRankUp}>
            Rank Up (+1)
          </Button>
        </div>
        {!canRankUp && rankUpBlockedReason ? (
          <p className="text-muted-foreground mt-2 font-mono text-xs">
            {rankUpBlockedReason}
          </p>
        ) : null}
      </Card>
    </div>
  );
}

export function ActivityPhaseSection({
  dragState,
  setDragStateAction,
  assignedActionIds,
  hasNonLieLowStaged,
  hasLieLowStaged,
  slotRows,
  activeDropSlotId,
  slotRefs,
  resetSlotsAction,
  militiaId,
  organizationId,
  rank,
  stagedActionIds,
  serverActivityTotals,
  onErrorAction,
}: {
  dragState: DragState | null;
  setDragStateAction: Dispatch<SetStateAction<DragState | null>>;
  assignedActionIds: Set<ActionId>;
  hasNonLieLowStaged: boolean;
  hasLieLowStaged: boolean;
  slotRows: Array<{
    slotId: string;
    slotNumber: number;
    slotActionId: ActionId | null;
  }>;
  activeDropSlotId: string | null;
  slotRefs: RefObject<Record<string, HTMLDivElement | null>>;
  resetSlotsAction: () => void;
  militiaId: Id<'militia'>;
  organizationId: string;
  rank: number;
  stagedActionIds: ActionId[];
  serverActivityTotals: ActivityRollTotals;
  onErrorAction: (message: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,40%)] xl:items-start">
      <div className="order-2 max-h-[calc(100vh-18rem)] min-h-0 overflow-y-auto border p-2 xl:order-1">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {ACTION_CARDS.map((card) => {
            const isDraggingCard =
              dragState?.source === 'deck' && dragState.actionId === card.id;
            const isAssigned = assignedActionIds.has(card.id);
            const costLabel =
              card.id === 'drill_militia'
                ? `${card.cost} (${rank * 10} gp)`
                : card.cost;
            const isDisabledByRules =
              (!isAssigned && card.id === 'lie_low' && hasNonLieLowStaged) ||
              (!isAssigned && card.id !== 'lie_low' && hasLieLowStaged);
            const isDisabled = isDisabledByRules;
            return (
              <div
                key={card.id}
                style={
                  isDraggingCard ? { height: dragState.height } : undefined
                }
              >
                <Card
                  onPointerDown={(event) => {
                    if (isDisabled) return;
                    event.preventDefault();
                    const element = event.currentTarget as HTMLDivElement;
                    const rect = element.getBoundingClientRect();
                    setDragStateAction({
                      actionId: card.id,
                      source: 'deck',
                      sourceSlotIndex: undefined,
                      pointerX: event.clientX,
                      pointerY: event.clientY,
                      offsetX: event.clientX - rect.left,
                      offsetY: event.clientY - rect.top,
                      width: rect.width,
                      height: rect.height,
                    });
                  }}
                  className={
                    isDraggingCard
                      ? 'border-primary bg-background border-2 border-solid p-3 shadow-2xl transition-none select-none'
                      : isAssigned
                        ? 'border-primary/40 bg-card/70 border-2 p-3 opacity-45 transition-all'
                        : isDisabled
                          ? 'border-muted bg-card/50 cursor-not-allowed border-2 p-3 opacity-50 transition-all'
                          : 'border-primary/60 bg-card hover:border-primary hover:bg-primary/5 cursor-grab border-2 p-3 shadow-sm transition-all hover:-translate-y-0.5 active:cursor-grabbing'
                  }
                  style={
                    isDraggingCard
                      ? {
                          position: 'fixed',
                          left: dragState.pointerX - dragState.offsetX,
                          top: dragState.pointerY - dragState.offsetY,
                          width: dragState.width,
                          zIndex: 9999,
                          pointerEvents: 'none',
                          touchAction: 'none',
                          isolation: 'isolate',
                          backgroundColor: 'var(--card)',
                          WebkitUserSelect: 'none',
                        }
                      : undefined
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-base font-bold">
                        {card.title}
                      </p>
                      <p className="text-muted-foreground font-mono text-xs">
                        {card.team}
                      </p>
                    </div>
                    <span className="border-primary/40 bg-primary/5 rounded px-2 py-0.5 font-mono text-[14px] uppercase">
                      Cost: {costLabel}
                    </span>
                  </div>
                  <ul className="mt-1 space-y-1">
                    {card.fullText.map((line) => (
                      <li
                        key={`${card.id}-${line}`}
                        className="text-muted-foreground font-mono text-xs"
                      >
                        {line}
                      </li>
                    ))}
                  </ul>
                  {isDisabledByRules ? (
                    <p className="text-muted-foreground mt-2 font-mono text-[11px]">
                      Unavailable with current staged actions.
                    </p>
                  ) : null}
                </Card>
              </div>
            );
          })}
        </div>
      </div>
      <Card className="order-1 max-h-[calc(100vh-18rem)] overflow-y-auto border p-3 xl:sticky xl:top-4 xl:order-2">
        <div className="mb-1 grid grid-cols-2 gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-sm font-bold">
              Activity Slots ({slotRows.length} max)
            </p>
            <Button variant="outline" onClick={resetSlotsAction}>
              Reset Slots
            </Button>
          </div>
          <p className="font-mono text-sm font-bold">Activity Roll Entry</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="space-y-2">
              {slotRows.map(({ slotId, slotNumber, slotActionId }) => {
                const action = ACTION_CARDS.find(
                  (card) => card.id === slotActionId,
                );
                const isActiveDropSlot = activeDropSlotId === slotId;
                const isDraggingFromThisSlot =
                  dragState?.sourceSlotIndex === slotNumber - 1 &&
                  dragState.actionId === slotActionId;
                return (
                  <div
                    key={slotId}
                    ref={(el) => {
                      slotRefs.current[slotId] = el;
                    }}
                    className={
                      isDraggingFromThisSlot
                        ? 'bg-primary/5 min-h-28 border-2 border-transparent p-2 transition-all'
                        : isActiveDropSlot
                          ? 'border-primary bg-primary/10 ring-primary/40 min-h-28 border-2 border-dashed p-2 ring-2 transition-all'
                          : action
                            ? 'border-primary/40 bg-primary/5 min-h-28 border-2 border-dashed p-2 transition-all'
                            : 'border-primary/25 bg-primary/5 min-h-28 border-2 border-dashed p-2 transition-all'
                    }
                  >
                    <p className="font-mono text-sm">
                      Activity Slot {slotNumber}
                    </p>
                    {action ? (
                      <div
                        className="mt-2"
                        style={
                          isDraggingFromThisSlot && dragState
                            ? { height: dragState.height }
                            : undefined
                        }
                      >
                        <Card
                          onPointerDown={(event) => {
                            event.preventDefault();
                            const element =
                              event.currentTarget as HTMLDivElement;
                            const rect = element.getBoundingClientRect();
                            setDragStateAction({
                              actionId: action.id,
                              source: 'slot',
                              sourceSlotIndex: slotNumber - 1,
                              pointerX: event.clientX,
                              pointerY: event.clientY,
                              offsetX: event.clientX - rect.left,
                              offsetY: event.clientY - rect.top,
                              width: rect.width,
                              height: rect.height,
                            });
                          }}
                          className={
                            isDraggingFromThisSlot
                              ? 'border-primary bg-card cursor-grabbing border-2 border-solid p-2 shadow-2xl transition-none select-none'
                              : 'border-primary/50 bg-card cursor-grab border p-2 transition-all active:cursor-grabbing'
                          }
                          style={
                            isDraggingFromThisSlot && dragState
                              ? {
                                  position: 'fixed',
                                  left: dragState.pointerX - dragState.offsetX,
                                  top: dragState.pointerY - dragState.offsetY,
                                  width: dragState.width,
                                  zIndex: 9999,
                                  pointerEvents: 'none',
                                  touchAction: 'none',
                                  isolation: 'isolate',
                                  backgroundColor: 'var(--card)',
                                  opacity: 1,
                                  backdropFilter: 'none',
                                  WebkitUserSelect: 'none',
                                }
                              : undefined
                          }
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-mono text-sm font-bold">
                              {action.title}
                            </p>
                            <span className="border-primary/40 bg-primary/5 rounded px-2 py-0.5 font-mono text-[10px] uppercase">
                              Staged
                            </span>
                          </div>
                          <p className="text-muted-foreground mt-1 font-mono text-xs">
                            Drag out of slot to unstage.
                          </p>
                        </Card>
                      </div>
                    ) : (
                      <p className="text-muted-foreground mt-1 font-mono text-xs">
                        {dragState && isActiveDropSlot
                          ? 'Release to stage this action'
                          : 'Drag an activity card here'}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <ActivityRollsController
              militiaId={militiaId}
              organizationId={organizationId}
              rank={rank}
              stagedActionIds={stagedActionIds}
              serverTotals={serverActivityTotals}
              onErrorAction={onErrorAction}
              className="space-y-2"
              showTitle={false}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}

export function EventPhaseSection({
  eventChanceTotal,
  setEventChanceTotalAction,
  eventTriggerRollTotal,
  setEventTriggerRollTotalAction,
  eventPercentileTotal,
  setEventPercentileTotalAction,
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
}: {
  eventChanceTotal: string;
  setEventChanceTotalAction: (value: string) => void;
  eventTriggerRollTotal: string;
  setEventTriggerRollTotalAction: (value: string) => void;
  eventPercentileTotal: string;
  setEventPercentileTotalAction: (value: string) => void;
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
}) {
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
            <Label
              htmlFor="event-trigger-roll-total"
              className="font-mono text-xs"
            >
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
              disabled={!shouldResolveEventTable}
            />
          </div>
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
                  onChange={(event) =>
                    setSabotageCheckTotalAction(event.target.value)
                  }
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
                <Label
                  htmlFor="event-roll-twice-first"
                  className="font-mono text-xs"
                >
                  Roll Twice first event total
                </Label>
                <Input
                  id="event-roll-twice-first"
                  value={eventRollTwiceFirst}
                  onChange={(event) =>
                    setEventRollTwiceFirstAction(event.target.value)
                  }
                  placeholder="Enter first event total"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label
                  htmlFor="event-roll-twice-second"
                  className="font-mono text-xs"
                >
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
                <p className="text-muted-foreground">
                  Roll Twice: second event
                </p>
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
                  {(MILITIA_EVENT_DETAILS[entry.name]?.fullText ?? []).map(
                    (line) => (
                      <li
                        key={`${entry.name}-${line}`}
                        className="text-muted-foreground font-mono text-xs"
                      >
                        {line}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

export function SummaryPhaseSection({
  rank,
  training,
  treasury,
  notoriety,
  upkeepAttritionTotal,
  showMaxNotorietyPenalty,
  upkeepNotorietyPenaltyTotal,
  showTreasuryShortagePenalty,
  upkeepTreasuryPenaltyTotal,
  slots,
  activityRollSummaryRows,
  eventChanceTotal,
  eventTriggerRollTotal,
  resolvedEventTrigger,
  shouldResolveEventTable,
  eventPercentileTotal,
  showRollTwiceFields,
  eventRollTwiceFirst,
  eventRollTwiceSecond,
  sabotageCheckTotal,
  sabotageNotorietyIncreaseTotal,
  formatManualTotalForSummaryAction,
}: {
  rank: number;
  training: number;
  treasury: number;
  notoriety: number;
  upkeepAttritionTotal: string;
  showMaxNotorietyPenalty: boolean;
  upkeepNotorietyPenaltyTotal: string;
  showTreasuryShortagePenalty: boolean;
  upkeepTreasuryPenaltyTotal: string;
  slots: Array<ActionId | null>;
  activityRollSummaryRows: SummaryRow[];
  eventChanceTotal: string;
  eventTriggerRollTotal: string;
  resolvedEventTrigger: EventTriggerResolution;
  shouldResolveEventTable: boolean;
  eventPercentileTotal: string;
  showRollTwiceFields: boolean;
  eventRollTwiceFirst: string;
  eventRollTwiceSecond: string;
  sabotageCheckTotal: string;
  sabotageNotorietyIncreaseTotal: string;
  formatManualTotalForSummaryAction: (raw: string) => string;
}) {
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
                Attrition total:{' '}
                {formatManualTotalForSummaryAction(upkeepAttritionTotal)}
              </li>
              {showMaxNotorietyPenalty ? (
                <li>
                  Max-notoriety penalty total:{' '}
                  {formatManualTotalForSummaryAction(upkeepNotorietyPenaltyTotal)}
                </li>
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
                const action = ACTION_CARDS.find(
                  (card) => card.id === slotActionId,
                );
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
              <p className="text-muted-foreground">
                Activity roll totals entered
              </p>
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
              Deposits and withdrawals are applied immediately. Current treasury
              above reflects all entered upkeep treasury changes.
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
                Event chance total:{' '}
                {formatManualTotalForSummaryAction(eventChanceTotal)}
              </li>
              <li>
                Trigger roll total:{' '}
                {formatManualTotalForSummaryAction(eventTriggerRollTotal)}
              </li>
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
                  resolveMilitiaEventFromPercentile(eventPercentileTotal),
                )}
              </p>
              {renderResolvedEventDetails(
                resolveMilitiaEventFromPercentile(eventPercentileTotal),
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
                <p className="text-muted-foreground">
                  Roll Twice: second event
                </p>
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
