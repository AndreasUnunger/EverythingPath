'use client';

import type { PointerEvent as ReactPointerEvent } from 'react';
import { Card } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { shouldIgnorePointerCardDragStart } from '~/lib/pointer-card-drag';
import type { ActivityPhaseViewModel } from './activity-phase-shared';
import type { ActivityActionCardEntry } from '~/components/week-board/phase-sections/activity-phase-shared';
import type { DragState } from '~/components/week-board/types';
import { getPointerCardDragStyle } from '~/lib/pointer-card-drag';

export function ActivityDeckCard({
  entry,
  dragState,
  onDragStart,
  slotRows,
  onStage,
}: {
  entry: ActivityActionCardEntry;
  dragState: DragState | null;
  slotRows: ActivityPhaseViewModel['slotRows'];
  onStage: ActivityPhaseViewModel['stageAction'];
  onDragStart: (
    event: ReactPointerEvent<HTMLDivElement>,
    entry: ActivityActionCardEntry,
  ) => void;
}) {
  return (
    <div
      style={entry.isDraggingCard && dragState ? { height: dragState.height } : undefined}
    >
      <Card
        role="group"
        aria-label={`Action Choice: ${entry.card.title}`}
        tabIndex={0}
        onPointerDown={(event) => {
          if (!shouldIgnorePointerCardDragStart(event.target)) onDragStart(event, entry);
        }}
        className={getDeckCardClassName(entry)}
        style={entry.isDraggingCard ? getPointerCardDragStyle(dragState) : undefined}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-mono text-base font-bold">{entry.card.title}</p>
            <p className="text-muted-foreground font-mono text-xs">{entry.card.team}</p>
            {entry.stagedCount > 0 ? (
              <p className="text-muted-foreground mt-1 font-mono text-[11px]">
                Staged: {entry.stagedCount}
              </p>
            ) : null}
          </div>
          <span className="border-primary/40 bg-primary/5 rounded px-2 py-0.5 font-mono text-[14px] uppercase">
            Cost: {entry.costLabel}
          </span>
        </div>
        <ul className="mt-1 space-y-1">
          {entry.card.fullText.map((line) => (
            <li
              key={`${entry.card.id}-${line}`}
              className="text-muted-foreground font-mono text-xs"
            >
              {line}
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap gap-2">
          {slotRows.map((slot) => (
            <Button
              key={slot.slotId}
              type="button"
              size="sm"
              variant="outline"
              disabled={entry.isDisabled || entry.isAssigned}
              aria-label={`Stage ${entry.card.title} in Activity Slot ${slot.slotNumber}`}
              onClick={() => onStage(slot.slotNumber - 1, entry.card.id)}
            >
              Stage in Slot {slot.slotNumber}
            </Button>
          ))}
        </div>
        {entry.isDisabled ? (
          <p className="text-muted-foreground mt-2 font-mono text-[11px]">
            {entry.warnings[0] ?? 'Unavailable due to current staged-state constraints.'}
          </p>
        ) : !entry.isLegal ? (
          <p className="mt-2 font-mono text-[11px] text-amber-700">
            {entry.warnings[0] ??
              'Rules warning: selectable, but outside recommended constraints.'}
          </p>
        ) : null}
      </Card>
    </div>
  );
}

function getDeckCardClassName(entry: ActivityActionCardEntry) {
  if (entry.isDraggingCard) {
    return 'border-primary bg-background border-2 border-solid p-3 shadow-2xl transition-none select-none';
  }
  if (entry.isAssigned) {
    return 'border-primary/40 bg-card/70 border-2 p-3 opacity-45 transition-all';
  }
  if (entry.isDisabled) {
    return 'border-muted bg-card/50 cursor-not-allowed border-2 p-3 opacity-50 transition-all';
  }
  if (entry.isLegal) {
    return 'border-primary/60 bg-card hover:border-primary hover:bg-primary/5 cursor-grab border-2 p-3 shadow-sm transition-all hover:-translate-y-0.5 active:cursor-grabbing';
  }
  return 'border-amber-600/50 bg-amber-500/5 hover:border-amber-600 hover:bg-amber-500/10 cursor-grab border-2 p-3 shadow-sm transition-all hover:-translate-y-0.5 active:cursor-grabbing';
}
