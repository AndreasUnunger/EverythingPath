'use client';
import { useState, type ReactNode } from 'react';
import { Button } from '~/components/ui/button';
import { RULE_ROLL_SPECS } from '~/lib/rules-roll-spec';
import { EventCheckRow } from './event-check-row';
import { EventMitigationChoice } from './event-mitigation-choice';
import { EventTargetCards } from './event-target-cards';
import { EventWhatHappenedLine } from './event-what-happened';
import { RollTotalField } from './roll-total-field';
import type {
  EventBlock,
  EventPanel,
  EventRaidPerson,
  EventTargetChoice,
} from './types';
import type { useEventEdits } from './use-event-edits';

type Edits = ReturnType<typeof useEventEdits>;
type Panel<Family extends EventPanel['family']> = Extract<
  EventPanel,
  { family: Family }
>;
// Every edit answers with a message when the draft refuses it.
type EditResult = string | null | undefined;

// The family-specific controls of one event position: its targets, checks
// and mitigation, then the outcome lines and the table's own account. Every
// input renders the panel's facts and hands the edit to the Event edits; the
// last refused edit's message stays visible until an edit is accepted.
export function EventFamilyPanel({
  block,
  panel,
  disabled,
  edits,
}: {
  block: EventBlock;
  panel: EventPanel;
  disabled: boolean;
  edits: Edits;
}) {
  const [error, setError] = useState<string | null>(null);
  function attempt(result: EditResult) {
    setError(result ?? null);
  }
  const id = block.eventId;
  function targetCards(kind: 'team' | 'settlement', choice: EventTargetChoice) {
    const set = (ids: readonly string[]) =>
      attempt(edits.setTargets(id, kind, ids));
    return (
      <EventTargetCards
        choice={choice}
        disabled={disabled}
        onSelect={(value) => set([value])}
        onClear={() => set([])}
        onClearRetained={(value) =>
          set(
            [choice.selected, ...choice.retained.map((r) => r.value)].filter(
              (x): x is string => !!x && x !== value,
            ),
          )
        }
      />
    );
  }
  return (
    <div className="min-w-0 space-y-4">
      {panel.family === 'team' ? (
        <TeamInputs
          panel={panel}
          id={id}
          disabled={disabled}
          edits={edits}
          attempt={attempt}
          targetCards={targetCards}
        />
      ) : (
        <RaidInputs
          panel={panel}
          id={id}
          disabled={disabled}
          edits={edits}
          attempt={attempt}
          targetCards={targetCards}
        />
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {panel.outcomes.length > 0 && (
        <ul aria-label={`${block.label} outcomes`} className="space-y-1">
          {panel.outcomes.map((line) => (
            <li
              key={line}
              className="flex min-w-0 gap-2 text-sm [overflow-wrap:anywhere]"
            >
              <span aria-hidden className="text-muted-foreground shrink-0">
                ›
              </span>
              <span className="min-w-0">{line}</span>
            </li>
          ))}
        </ul>
      )}
      <EventWhatHappenedLine
        facts={panel.whatHappened}
        disabled={disabled}
        // The line shows its own refusal at the field; only success clears
        // a message another input left here.
        onSave={(text) => {
          const result = edits.saveWhatHappened(id, text);
          if (!result) setError(null);
          return result;
        }}
        onClear={() => {
          edits.clearWhatHappened(id);
          setError(null);
        }}
      />
    </div>
  );
}

type InputsProps<Family extends EventPanel['family']> = {
  panel: Panel<Family>;
  id: string;
  disabled: boolean;
  edits: Edits;
  attempt: (result: EditResult) => void;
  targetCards: (
    kind: 'team' | 'settlement',
    choice: EventTargetChoice,
  ) => ReactNode;
};

// Missing in Action, Sickness and Turn Around: a team, and Sickness Twice's
// mandatory Loyalty save. Team events never offer Attempt it / Let it happen.
function TeamInputs({
  panel,
  id,
  disabled,
  edits,
  attempt,
  targetCards,
}: InputsProps<'team'>) {
  return (
    <>
      {panel.team && targetCards('team', panel.team)}
      {panel.check && (
        <EventCheckRow
          facts={panel.check}
          recorded={panel.checkRoll}
          disabled={disabled}
          onRoll={(roll) => attempt(edits.setCheckRoll(id, roll))}
        />
      )}
      {panel.retainedCheck && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p role="note" className="min-w-0 text-sm text-amber-300">
            A check roll is recorded here, but this event does not use it.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => attempt(edits.setCheckRoll(id, null))}
          >
            Clear unused check roll
          </Button>
        </div>
      )}
    </>
  );
}

// Raid: the raided settlement, then each person hidden there with their own
// Attempt it / Let it happen, Security check and capture roll.
function RaidInputs({
  panel,
  id,
  disabled,
  edits,
  attempt,
  targetCards,
}: InputsProps<'raid'>) {
  return (
    <>
      {targetCards('settlement', panel.settlement)}
      {(panel.legacyMitigation !== null || panel.legacyCheckRoll) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p
            role="note"
            className="min-w-0 text-sm [overflow-wrap:anywhere] text-amber-300"
          >
            An older entry records mitigation for the whole Raid. Each hidden
            person follows it until their own choice is made.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => attempt(edits.clearEventMitigation(id))}
          >
            Clear whole-Raid mitigation
          </Button>
        </div>
      )}
      {panel.noPeople !== null && (
        <p className="text-muted-foreground min-w-0 text-sm [overflow-wrap:anywhere]">
          {panel.noPeople}
        </p>
      )}
      {panel.people.map((person) => (
        <RaidPerson
          key={person.characterId}
          person={person}
          id={id}
          disabled={disabled}
          edits={edits}
          attempt={attempt}
        />
      ))}
      {panel.retainedPeople.map((entry) => (
        <div
          key={entry.index}
          className="flex flex-wrap items-center gap-x-4 gap-y-2"
        >
          <p
            role="note"
            className="min-w-0 text-sm [overflow-wrap:anywhere] text-amber-300"
          >
            {entry.label}: {entry.reason}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`Remove recorded check for ${entry.label}`}
            disabled={disabled}
            onClick={() => attempt(edits.removeTargetCheck(id, entry.index))}
          >
            Remove
          </Button>
        </div>
      ))}
    </>
  );
}

function RaidPerson({
  person,
  id,
  disabled,
  edits,
  attempt,
}: {
  person: EventRaidPerson;
  id: string;
  disabled: boolean;
  edits: Edits;
  attempt: (result: EditResult) => void;
}) {
  const target = {
    kind: 'character' as const,
    characterId: person.characterId,
  };
  const patch = (change: Parameters<Edits['setTargetCheck']>[2]) =>
    attempt(edits.setTargetCheck(id, target, change));
  const attempted = person.mitigation === 'attempted';
  const capture = person.capture;
  return (
    <section
      role="group"
      aria-label={person.name}
      className="min-w-0 space-y-3 rounded-md border p-3"
    >
      <h5 className="min-w-0 font-semibold [overflow-wrap:anywhere]">
        {person.name}
      </h5>
      <EventMitigationChoice
        subject={person.name}
        value={person.mitigation}
        explicit={person.explicit}
        attemptDescription={`Security DC ${person.check.dc} to halve the capture chance.`}
        letDescription="No check; capture is certain."
        disabled={disabled}
        onChange={(mitigation) => patch({ mitigation })}
      />
      {attempted ? (
        <EventCheckRow
          facts={person.check}
          recorded={person.checkRoll}
          disabled={disabled}
          onRoll={(check) => patch({ check })}
          onClearOverseer={() => patch({ overseer: null })}
        />
      ) : (
        <>
          {person.checkRoll && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="text-muted-foreground min-w-0 text-sm">
                A Security check roll stays on record, unused.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => patch({ check: null })}
              >
                Clear unused check roll for {person.name}
              </Button>
            </div>
          )}
          {/* A check-level Overseer selection from an older editor stays editable. */}
          {person.check.overseerRecorded && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p role="note" className="min-w-0 text-sm text-amber-300">
                Overseer support is recorded on this check. It helps every check
                of this event once.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Remove Overseer support from ${person.check.label}`}
                disabled={disabled}
                onClick={() => patch({ overseer: null })}
              >
                Remove Overseer support
              </Button>
            </div>
          )}
        </>
      )}
      {(capture.applies || capture.recorded) && (
        <div className="min-w-0 space-y-1">
          <RollTotalField
            label={`Capture roll for ${person.name}`}
            spec={RULE_ROLL_SPECS.percentile}
            recorded={capture.recorded}
            required={capture.required}
            disabled={disabled}
            onRoll={(loss) => patch({ loss })}
          />
          {capture.applies ? (
            capture.chance !== null && (
              <p className="text-muted-foreground text-sm">
                Captured on {capture.chance} or less.
              </p>
            )
          ) : (
            <p className="text-muted-foreground text-sm">
              Not needed: this roll is kept on record, unused.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
