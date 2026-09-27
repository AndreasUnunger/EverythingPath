import { acknowledgementSchema, type RawRoll } from '~/lib/weekly-draft-facts';
import type { OrganizationCheck } from '~/lib/rules-officers';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { EventSabotageFacts } from './event-sabotage-facts';
import type { EventView } from './types';
import type { useEventEdits } from './use-event-edits';

type Occurrence = EventView['occurrences'][number]['occurrence'];
type Sabotage = NonNullable<Occurrence['sabotage']>;
export type SabotagePatch = {
  teamId?: string | null;
  check?: OrganizationCheck | null;
  checkRoll?: RawRoll | null;
  notorietyRoll?: RawRoll | null;
};

/**
 * One occurrence's Sabotage edits. The reaction lives on the occurrence, so
 * every input is the existing occurrence edit with the reaction patched and
 * everything else kept; What happened is the reaction's own acknowledgement.
 * The first input records the reaction under its stable identity. Each edit
 * answers with a refusal message or null.
 */
export function sabotageEdits({
  view,
  edit,
  saveOccurrence,
  facts,
}: {
  view: EventView;
  edit: (edit: WeeklyDraftEdit) => unknown;
  saveOccurrence: ReturnType<typeof useEventEdits>['saveOccurrence'];
  facts: EventSabotageFacts;
}) {
  const occurrence = () =>
    view.occurrences.find((item) => item.occurrence.eventId === facts.eventId)
      ?.occurrence ?? null;
  function update(change: (sabotage: Sabotage) => Sabotage | null) {
    const current = occurrence();
    if (!current) return 'This event is not ready for its roll yet.';
    const next = change(
      structuredClone(current.sabotage ?? { choiceId: facts.choiceId }),
    );
    const { sabotage: _previous, ...rest } = current;
    return saveOccurrence(next ? { ...rest, sabotage: next } : rest);
  }
  const note = facts.whatHappened;
  return {
    patch(patch: SabotagePatch) {
      return update((sabotage) => {
        if (patch.teamId !== undefined) {
          if (patch.teamId === null) delete sabotage.teamId;
          else sabotage.teamId = patch.teamId;
        }
        if (patch.check !== undefined) {
          if (patch.check === null) delete sabotage.check;
          else sabotage.check = patch.check;
        }
        const rolls = { ...sabotage.rolls };
        for (const [key, field] of [
          ['checkRoll', 'check'],
          ['notorietyRoll', 'notoriety'],
        ] as const) {
          const roll = patch[key];
          if (roll === null) delete rolls[field];
          else if (roll) rolls[field] = roll;
        }
        if (Object.keys(rolls).length) sabotage.rolls = rolls;
        else delete sabotage.rolls;
        return sabotage;
      });
    },
    saveNote(outcome: string) {
      if (!facts.recorded) return 'Choose the Saboteurs team first.';
      const parsed = acknowledgementSchema.safeParse({
        // A note nested by an older editor is replaced by the shared one.
        acknowledgementId: facts.nestedAcknowledgement
          ? note.subjectId
          : (note.acknowledgement?.acknowledgementId ?? note.subjectId),
        subjectId: note.subjectId,
        outcome,
      });
      if (!parsed.success) return parsed.error.issues[0]!.message;
      edit({ kind: 'acknowledge', acknowledgement: parsed.data });
      return null;
    },
    clearNote() {
      if (!note.acknowledgement) return null;
      if (!facts.nestedAcknowledgement) {
        edit({
          kind: 'clear_acknowledgement',
          acknowledgementId: note.acknowledgement.acknowledgementId,
        });
        return null;
      }
      // An older editor nested it inside the reaction.
      return update((sabotage) => {
        const kept = (sabotage.acknowledgements ?? []).filter(
          (entry) => entry.subjectId !== note.subjectId,
        );
        if (kept.length) sabotage.acknowledgements = kept;
        else delete sabotage.acknowledgements;
        return sabotage;
      });
    },
    /**
     * Cancels the attempt: its What happened first, then the reaction, as
     * two ordinary edits. If the second is refused the reaction stays
     * recorded (and asks for its note again) rather than half-vanishing.
     */
    async cancel(): Promise<string | null> {
      if (!facts.recorded) return null;
      if (note.acknowledgement && !facts.nestedAcknowledgement) {
        const cleared = await edit({
          kind: 'clear_acknowledgement',
          acknowledgementId: note.acknowledgement.acknowledgementId,
        });
        if (cleared === 'failed')
          return 'The Sabotage could not be cancelled. Try again.';
      }
      return update(() => null);
    },
  };
}
