'use client';
import { useRef, useState, type PointerEvent, type MouseEvent } from 'react';
import type { StagedActionChoice } from '~/lib/weekly-draft-facts';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { ActivityView } from './types';
type Selection =
  | { kind: 'deck'; actionId: StagedActionChoice['actionId'] }
  | { kind: 'slot'; slotId: string; choiceId: string };
type Drag = {
  selection: Selection;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  moved: boolean;
  target: string | null;
};
export function useActivityPlacement(
  view: ActivityView,
  edit: (edit: WeeklyDraftEdit) => unknown,
  disabled: boolean,
) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const active = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const targets = useRef(new Map<string, HTMLElement>());
  const [feedback, setFeedback] = useState(
    'Choose a card, then choose a slot. You can also drag cards.',
  );
  function update(next: Drag | null) {
    active.current = next;
    setDrag(next);
  }
  function place(picked: Selection, target: string | null) {
    if (disabled) return;
    const slot = view.slots.find((slot) => slot.slotId === target);
    if (picked.kind === 'deck') {
      if (!slot) {
        setFeedback('Drop an action in a slot. The card returned to the deck.');
        return;
      }
      const choice = {
        choiceId: crypto.randomUUID(),
        actionId: picked.actionId,
        ...(picked.actionId === 'special_order'
          ? { orderId: crypto.randomUUID(), orderedDay: view.startDay }
          : {}),
      };
      edit(
        slot.choice
          ? {
              kind: 'replace',
              slotId: slot.slotId,
              choiceId: slot.choice.choiceId,
              choice,
            }
          : { kind: 'stage', slotId: slot.slotId, choice },
      );
    } else {
      const source = view.slots.find((slot) => slot.slotId === picked.slotId);
      if (source?.choice?.choiceId !== picked.choiceId) {
        setFeedback(
          'That choice changed. Choose its latest card and try again.',
        );
        return;
      }
      if (slot?.slotId === picked.slotId) return;
      if (!slot)
        edit({
          kind: 'clear',
          slotId: picked.slotId,
          choiceId: picked.choiceId,
        });
      else if (slot.choice)
        edit({
          kind: 'swap',
          fromSlotId: picked.slotId,
          toSlotId: slot.slotId,
          choiceId: picked.choiceId,
          otherChoiceId: slot.choice.choiceId,
        });
      else
        edit({
          kind: 'move',
          fromSlotId: picked.slotId,
          toSlotId: slot.slotId,
          choiceId: picked.choiceId,
        });
    }
    setSelection(null);
    setFeedback(
      slot ? 'Choice placed. Review its details below.' : 'Choice cleared.',
    );
  }
  function cancel() {
    if (active.current?.moved) suppressClick.current = true;
    update(null);
    setSelection(null);
    setFeedback('Placement cancelled. Your choices are unchanged.');
  }
  function targetAt(x: number, y: number) {
    for (const [id, node] of targets.current) {
      const rect = node.getBoundingClientRect();
      if (
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom
      )
        return id;
    }
    return null;
  }
  return {
    lostCapture: () => {
      if (active.current) cancel();
    },
    selection,
    drag,
    feedback,
    cancel,
    targetRef(id: string, node: HTMLElement | null) {
      if (node) targets.current.set(id, node);
      else targets.current.delete(id);
    },
    choose(picked: Selection, event: MouseEvent<HTMLButtonElement>) {
      if (disabled) return;
      if (suppressClick.current && event.detail !== 0) {
        suppressClick.current = false;
        return;
      }
      suppressClick.current = false;
      setSelection(picked);
      setFeedback('Choose a destination slot, or clear the selected choice.');
    },
    place(target: string | null) {
      if (selection) place(selection, target);
    },
    down(event: PointerEvent<HTMLButtonElement>, picked: Selection) {
      if (
        disabled ||
        event.button !== 0 ||
        event.isPrimary === false ||
        active.current
      )
        return;
      suppressClick.current = false;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      update({
        selection: picked,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        x: event.clientX,
        y: event.clientY,
        moved: false,
        target: null,
      });
    },
    move(this: void, event: PointerEvent<HTMLButtonElement>) {
      const current = active.current;
      if (current?.pointerId !== event.pointerId) return;
      if (disabled) {
        cancel();
        return;
      }
      const moved =
        current.moved ||
        Math.hypot(
          event.clientX - current.startX,
          event.clientY - current.startY,
        ) >= 6;
      if (moved) event.preventDefault();
      update({
        ...current,
        x: event.clientX,
        y: event.clientY,
        moved,
        target: targetAt(event.clientX, event.clientY),
      });
    },
    up(this: void, event: PointerEvent<HTMLButtonElement>) {
      const current = active.current;
      if (current?.pointerId !== event.pointerId) return;
      update(null);
      if (!current.moved) return;
      suppressClick.current = true;
      place(current.selection, targetAt(event.clientX, event.clientY));
    },
  };
}
