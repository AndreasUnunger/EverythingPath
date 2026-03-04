'use client';

import type { Id } from '@convex/_generated/dataModel';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { ACTION_CARDS } from '~/components/week-board/data';
import type { ActivityRollTotals } from '~/components/week-board/roll-totals';
import type { ActionId, DragState } from '~/components/week-board/types';
import { ActivityRollsController } from '~/components/week-board/activity-rolls-controller';

export type ActivityPhaseViewModel = {
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
};

export function ActivityPhaseSection({
  viewModel,
}: {
  viewModel: ActivityPhaseViewModel;
}) {
  const {
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
  } = viewModel;

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
                style={isDraggingCard ? { height: dragState.height } : undefined}
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
                      <p className="font-mono text-base font-bold">{card.title}</p>
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
                const action = ACTION_CARDS.find((card) => card.id === slotActionId);
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
                    <p className="font-mono text-sm">Activity Slot {slotNumber}</p>
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
                            const element = event.currentTarget as HTMLDivElement;
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
                            <p className="font-mono text-sm font-bold">{action.title}</p>
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
