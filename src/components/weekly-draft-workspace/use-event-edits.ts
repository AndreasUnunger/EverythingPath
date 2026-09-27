import { useMemo } from 'react';
import {
  acknowledgementSchema,
  eventOccurrenceSchema,
  eventTreeSchema,
  rawRollModifiersSchema,
  type RawRoll,
} from '~/lib/weekly-draft-facts';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import { isCandidateChoice } from '~/lib/event-occurrence-preparation';
import type { EventBlock, EventView } from './types';

type Occurrence = EventView['occurrences'][number]['occurrence'];
type TargetCheck = NonNullable<Occurrence['targetChecks']>[number];
export type TargetCheckPatch = {
  mitigation?: 'attempted' | 'unattempted';
  // A die, or null to clear it.
  check?: RawRoll | null;
  loss?: RawRoll | null;
  // Clears a check-level Overseer selection from an older editor.
  overseer?: null;
};
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
    // One target's recorded check on the occurrence, patched in place; an
    // entry left naming only its target is removed.
    function patchTargetCheck(
      eventId: string,
      target: TargetCheck['target'],
      patch: TargetCheckPatch,
    ) {
      const occurrence = current(eventId);
      if (!occurrence) return 'This event is not ready for its roll yet.';
      const entries = occurrence.targetChecks ?? [];
      const index = entries.findIndex((entry) =>
        sameTarget(entry.target, target),
      );
      const next = applyTargetPatch(
        index >= 0 ? entries[index]! : { target },
        patch,
      );
      const targetChecks =
        index >= 0
          ? entries.flatMap((entry, position) =>
              position === index ? (next ? [next] : []) : [entry],
            )
          : next
            ? [...entries, next]
            : entries;
      const { targetChecks: _previous, ...rest } = occurrence;
      return saveOccurrence(
        targetChecks.length ? { ...rest, targetChecks } : rest,
      );
    }
    return {
      saveOccurrence,
      /** Replaces the occurrence's targets of one kind; other kinds stay. */
      setTargets(
        eventId: string,
        kind: 'team' | 'settlement',
        ids: readonly string[],
      ) {
        const occurrence = current(eventId);
        if (!occurrence) return 'This event is not ready for its roll yet.';
        const targets = [
          ...(occurrence.targets ?? []).filter(
            (target) => target.kind !== kind,
          ),
          ...ids.map((id) =>
            kind === 'team' ? { kind, teamId: id } : { kind, settlementId: id },
          ),
        ];
        const { targets: _previous, ...rest } = occurrence;
        return saveOccurrence(targets.length ? { ...rest, targets } : rest);
      },
      /** The occurrence's own check die (for example Sickness's save). */
      setCheckRoll(eventId: string, roll: RawRoll | null) {
        const occurrence = current(eventId);
        if (!occurrence) return 'This event is not ready for its roll yet.';
        const { rolls, ...rest } = occurrence;
        const { check: _previous, ...others } = rolls ?? {};
        const next = roll ? { ...others, check: roll } : others;
        return saveOccurrence(
          Object.keys(next).length ? { ...rest, rolls: next } : rest,
        );
      },
      /** Attempt it / Let it happen, or a die, for one target's check. */
      setTargetCheck: patchTargetCheck,
      /** Removes one recorded target check, by its position. */
      removeTargetCheck(eventId: string, index: number) {
        const occurrence = current(eventId);
        if (!occurrence?.targetChecks?.[index])
          return 'This check is no longer recorded.';
        const targetChecks = occurrence.targetChecks.filter(
          (_entry, position) => position !== index,
        );
        const { targetChecks: _previous, ...rest } = occurrence;
        return saveOccurrence(
          targetChecks.length ? { ...rest, targetChecks } : rest,
        );
      },
      /**
       * Clears an event-level mitigation choice and check die an older
       * editor recorded for every target at once.
       */
      clearEventMitigation(eventId: string) {
        const occurrence = current(eventId);
        if (!occurrence) return 'This event is not ready for its roll yet.';
        const { mitigation: _mitigation, rolls, ...rest } = occurrence;
        const { check: _check, ...others } = rolls ?? {};
        return saveOccurrence(
          Object.keys(others).length ? { ...rest, rolls: others } : rest,
        );
      },
      /** What happened: the occurrence's acknowledgement, saved or cleared. */
      saveWhatHappened(eventId: string, outcome: string) {
        const block = blocks.get(eventId);
        if (!block?.saved) return 'This event is not ready for its roll yet.';
        const subjectId = `event:${eventId}`;
        const existing = view.acknowledgements.find(
          (entry) => entry.subjectId === subjectId,
        );
        const parsed = acknowledgementSchema.safeParse({
          acknowledgementId: existing?.acknowledgementId ?? subjectId,
          subjectId,
          outcome,
        });
        if (!parsed.success) return parsed.error.issues[0]!.message;
        edit({ kind: 'acknowledge', acknowledgement: parsed.data });
        return null;
      },
      clearWhatHappened(eventId: string) {
        const existing = view.acknowledgements.find(
          (entry) => entry.subjectId === `event:${eventId}`,
        );
        if (!blocks.get(eventId)?.saved || !existing) return;
        edit({
          kind: 'clear_acknowledgement',
          acknowledgementId: existing.acknowledgementId,
        });
      },
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

function sameTarget(a: TargetCheck['target'], b: TargetCheck['target']) {
  const id = (target: TargetCheck['target']) =>
    Object.entries(target).find(([key]) => key !== 'kind')?.[1];
  return a.kind === b.kind && id(a) === id(b);
}

// A target check with the patch applied, or null once only its target is left.
function applyTargetPatch(
  entry: TargetCheck,
  patch: TargetCheckPatch,
): TargetCheck | null {
  const next: TargetCheck = { ...entry };
  if (patch.mitigation) next.mitigation = patch.mitigation;
  if (patch.overseer === null) delete next.overseerCharacterId;
  const rolls = { ...entry.rolls };
  for (const field of ['check', 'loss'] as const) {
    const roll = patch[field];
    if (roll === null) delete rolls[field];
    else if (roll) rolls[field] = roll;
  }
  if (Object.keys(rolls).length) next.rolls = rolls;
  else delete next.rolls;
  return Object.keys(next).length > 1 ? next : null;
}
