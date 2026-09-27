import { useMemo } from 'react';
import {
  eventOccurrenceSchema,
  eventTreeSchema,
  rawRollModifiersSchema,
  type RawRoll,
} from '~/lib/weekly-draft-facts';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import { isCandidateChoice } from '~/lib/event-occurrence-preparation';
import type { EventBlock, EventView } from './types';

type Occurrence = EventView['occurrences'][number]['occurrence'];
export type TableModifier = EventBlock['table']['modifiers'][number];

/**
 * The Event view's edits. Every occurrence edit waits for its occurrence to
 * exist in the accepted draft: a prepared position that is still being saved
 * accepts no child edit. Structural validation happens before sending, with
 * its message returned to the caller instead of a browser popup.
 */
export function useEventEdits(
  view: EventView,
  edit: (edit: WeeklyDraftEdit) => unknown,
) {
  return useMemo(() => {
    const blocks = new Map<string, EventBlock>();
    const collect = (block: EventBlock) => {
      blocks.set(block.eventId, block);
      for (const child of [...block.children, ...block.hidden]) collect(child);
    };
    for (const block of [
      ...(view.automatic?.blocks ?? []),
      ...view.rolled.blocks,
      ...view.candidates.flatMap((set) => set.blocks),
      ...view.inactive,
    ])
      collect(block);
    // The occurrence's own tree, in parent-before-child order.
    function tree(eventId: string) {
      const owner = view.occurrences.find(
        (item) => item.occurrence.eventId === eventId,
      )?.owner;
      return view.occurrences
        .filter(
          (item) => item.owner?.choice.choiceId === owner?.choice.choiceId,
        )
        .map((item) => item.occurrence);
    }
    function saveOccurrence(occurrence: Occurrence): string | null {
      const block = blocks.get(occurrence.eventId);
      if (!block?.saved) return 'This event is not ready for its roll yet.';
      const parsed = eventOccurrenceSchema.safeParse(occurrence);
      const checked = eventTreeSchema.safeParse(
        tree(occurrence.eventId).map((entry) =>
          entry.eventId === occurrence.eventId ? occurrence : entry,
        ),
      );
      if (!parsed.success) return parsed.error.issues[0]!.message;
      if (!checked.success) return checked.error.issues[0]!.message;
      edit({ kind: 'event_occurrence', occurrence: parsed.data });
      return null;
    }
    function current(eventId: string) {
      return blocks.get(eventId)?.item.occurrence ?? null;
    }
    return {
      saveOccurrence,
      setChanceRoll(roll: RawRoll | null) {
        edit({ kind: 'event_chance', roll });
      },
      /** A new die, or null to clear; clearing a surplus position removes it. */
      setTableRoll(eventId: string, roll: RawRoll | null) {
        const block = blocks.get(eventId);
        const occurrence = current(eventId);
        if (!block?.saved || !occurrence) return;
        if (roll === null && block.removal) {
          edit(block.removal);
          return;
        }
        const { tableRoll: _previous, ...rest } = occurrence;
        saveOccurrence(roll ? { ...rest, tableRoll: roll } : rest);
      },
      /** Replaces the table roll's extra modifiers; provenance and dice stay. */
      setTableModifiers(eventId: string, modifiers: TableModifier[]) {
        const occurrence = current(eventId);
        if (!occurrence?.tableRoll) return 'Enter the table roll first.';
        const parsed = rawRollModifiersSchema.safeParse(
          modifiers.map(({ sourceId, value, reason }) => ({
            sourceId,
            value,
            reason,
          })),
        );
        if (!parsed.success) return parsed.error.issues[0]!.message;
        return saveOccurrence({
          ...occurrence,
          tableRoll: { ...occurrence.tableRoll, modifiers: parsed.data },
        });
      },
      /** Marks this candidate as the event that happens for its Activity choice. */
      chooseCandidate(eventId: string) {
        const block = blocks.get(eventId);
        const owner = block?.item.owner;
        if (!block?.saved || !isCandidateChoice(owner?.choice)) return;
        edit({
          kind: 'detail',
          slotId: owner.slotId,
          choiceId: owner.choice.choiceId,
          choice: { ...owner.choice, selectedEventId: eventId },
        });
      },
    };
  }, [view, edit]);
}

/** A fresh stable identity for a table modifier the table adds. */
export function newTableModifierSource() {
  return `table-modifier:${crypto.randomUUID()}`;
}
