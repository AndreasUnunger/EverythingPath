'use client';

import { useEffect } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { PointerCardDragState } from '~/lib/pointer-card-drag';

type SlotRow = {
  slotId: string;
  slotNumber: number;
};

function getHoveredSlotNumber({
  clientX,
  clientY,
  slotRows,
  slotRefs,
}: {
  clientX: number;
  clientY: number;
  slotRows: SlotRow[];
  slotRefs: Record<string, HTMLDivElement | null>;
}) {
  for (const row of slotRows) {
    const slotEl = slotRefs[row.slotId];
    if (!slotEl) continue;
    const rect = slotEl.getBoundingClientRect();
    const isInside =
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom;
    if (isInside) {
      return row.slotNumber;
    }
  }
  return null;
}

export function useActivityCardDrag<TActionId extends string>({
  dragState,
  setDragState,
  slotRows,
  slotRefs,
  setActiveDropSlotId,
  onDrop,
}: {
  dragState: PointerCardDragState<TActionId> | null;
  setDragState: Dispatch<SetStateAction<PointerCardDragState<TActionId> | null>>;
  slotRows: SlotRow[];
  slotRefs: RefObject<Record<string, HTMLDivElement | null>>;
  setActiveDropSlotId: (slotId: string | null) => void;
  onDrop: (args: {
    dropSlotIndex: number | null;
    actionId: TActionId;
    sourceSlotIndex?: number;
  }) => void;
}) {
  useEffect(() => {
    if (!dragState) return;

    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    const handlePointerMove = (event: PointerEvent) => {
      setDragState((current) =>
        current
          ? {
              ...current,
              pointerX: event.clientX,
              pointerY: event.clientY,
            }
          : current,
      );

      const hoveredSlotNumber = getHoveredSlotNumber({
        clientX: event.clientX,
        clientY: event.clientY,
        slotRows,
        slotRefs: slotRefs.current,
      });
      const hoveredSlotId =
        hoveredSlotNumber === null
          ? null
          : slotRows[hoveredSlotNumber - 1]?.slotId ?? null;
      setActiveDropSlotId(hoveredSlotId);
    };

    const handlePointerUp = (event: PointerEvent) => {
      const hoveredSlotNumber = getHoveredSlotNumber({
        clientX: event.clientX,
        clientY: event.clientY,
        slotRows,
        slotRefs: slotRefs.current,
      });

      onDrop({
        dropSlotIndex:
          hoveredSlotNumber === null ? null : hoveredSlotNumber - 1,
        actionId: dragState.actionId,
        sourceSlotIndex: dragState.sourceSlotIndex,
      });

      setDragState(null);
      setActiveDropSlotId(null);
      document.body.style.userSelect = previousUserSelect;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.style.userSelect = previousUserSelect;
    };
  }, [dragState, onDrop, setActiveDropSlotId, setDragState, slotRefs, slotRows]);
}
