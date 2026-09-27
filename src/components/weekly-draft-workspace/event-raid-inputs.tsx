'use client';
import type { EventFamilyInputsProps } from './event-family-inputs';
import { EventNote } from './event-note';
import { EventRaidPerson } from './event-raid-person';

// Raid: the raided settlement, then each person hidden there with their own
// Attempt it / Let it happen, Security check and capture roll.
export function EventRaidInputs({
  panel,
  id,
  disabled,
  edits,
  showRefusal,
  targetCards,
}: EventFamilyInputsProps<'raid'>) {
  return (
    <>
      {targetCards('settlement', panel.settlement)}
      {(panel.legacyMitigation !== null || panel.legacyCheckRoll) && (
        <EventNote
          action="Clear whole-Raid mitigation"
          disabled={disabled}
          onAction={() => showRefusal(edits.clearEventMitigation(id))}
        >
          An older entry records mitigation for the whole Raid. Each hidden
          person follows it until their own choice is made.
        </EventNote>
      )}
      {panel.noPeople !== null && (
        <p className="text-muted-foreground min-w-0 text-sm [overflow-wrap:anywhere]">
          {panel.noPeople}
        </p>
      )}
      {panel.people.map((person) => (
        <EventRaidPerson
          key={person.characterId}
          person={person}
          id={id}
          disabled={disabled}
          edits={edits}
          showRefusal={showRefusal}
        />
      ))}
      {panel.retainedPeople.map((entry) => (
        <EventNote
          key={entry.index}
          action="Remove"
          actionLabel={`Remove recorded check for ${entry.label}`}
          disabled={disabled}
          onAction={() => showRefusal(edits.removeTargetCheck(id, entry.index))}
        >
          {entry.label}: {entry.reason}
        </EventNote>
      ))}
    </>
  );
}
