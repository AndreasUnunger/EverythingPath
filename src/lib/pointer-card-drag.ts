import type { PointerEvent as ReactPointerEvent } from 'react';

export type PointerCardDragState<TId extends string> = {
  actionId: TId;
  source: 'deck' | 'slot';
  sourceSlotIndex?: number;
  pointerX: number;
  pointerY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

export function createPointerCardDragState<TId extends string>({
  event,
  actionId,
  source,
  sourceSlotIndex,
}: {
  event: ReactPointerEvent<HTMLElement>;
  actionId: TId;
  source: 'deck' | 'slot';
  sourceSlotIndex?: number;
}): PointerCardDragState<TId> {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    actionId,
    source,
    sourceSlotIndex,
    pointerX: event.clientX,
    pointerY: event.clientY,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    width: rect.width,
    height: rect.height,
  };
}

export function shouldIgnorePointerCardDragStart(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest(
      'button, input, select, textarea, a, [role="combobox"], [role="listbox"], [data-radix-select-trigger]',
    ),
  );
}

export function getPointerCardDragStyle<TId extends string>(
  dragState: PointerCardDragState<TId> | null,
) {
  if (!dragState) return undefined;

  return {
    position: 'fixed' as const,
    left: dragState.pointerX - dragState.offsetX,
    top: dragState.pointerY - dragState.offsetY,
    width: dragState.width,
    zIndex: 9999,
    pointerEvents: 'none' as const,
    touchAction: 'none' as const,
    isolation: 'isolate' as const,
    backgroundColor: 'var(--card)',
    WebkitUserSelect: 'none' as const,
  };
}
