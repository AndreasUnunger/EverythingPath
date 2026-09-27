'use client';
import { eventRequirement, eventWarning, eventChange } from './event-messages';
import { EventChecks } from './event-checks';
import { useState } from 'react';
import {
  rawRollModifiersSchema,
  eventOccurrenceSchema,
  eventTreeSchema,
} from '~/lib/weekly-draft-facts';
import { normalizeRawRoll } from '~/lib/raw-roll';
import { RecordedRollTotal } from './recorded-roll';
import { isTotalRoll } from './roll-facts';
import type { WeeklyDraftEdit, WeeklyDraft } from '~/lib/weekly-draft-contract';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { WholeNumberField } from './whole-number-field';
import { StructuredChoiceField } from './structured-choice-field';
import { ActivityText } from './activity-details';
import { activityLabel } from './activity-labels';
import type { EventView as Facts } from './types';
type Occurrence = WeeklyDraft['event']['occurrences'][number];
type Props = {
  view: Facts;
  edit: (edit: WeeklyDraftEdit) => unknown;
  disabled: boolean;
};
const detailsSchema = eventOccurrenceSchema.omit({
  origin: true,
  tableRoll: true,
  eventType: true,
});
const PERCENTILE = { count: 1, sides: 100 };
function percentile(value: number | null, previous?: Occurrence['tableRoll']) {
  return value === null
    ? null
    : {
        dice: [value],
        sides: 100,
        provenance: previous?.provenance ?? { kind: 'table' as const },
        modifiers: previous?.modifiers ?? [],
      };
}
export function EventView({ view, edit, disabled }: Props) {
  const [error, setError] = useState('');
  function saveTree(
    occurrences: Occurrence[],
    owner: Facts['occurrences'][number]['owner'],
  ) {
    const parsed = eventTreeSchema.safeParse(occurrences);
    if (!parsed.success) {
      setError(parsed.error.issues[0]!.message);
      return false;
    }
    setError('');
    if (owner && 'candidates' in owner.choice)
      edit({
        kind: 'detail',
        slotId: owner.slotId,
        choiceId: owner.choice.choiceId,
        choice: { ...owner.choice, candidates: parsed.data },
      });
    else edit({ kind: 'event_tree', occurrences: parsed.data });
    return true;
  }
  function tree(owner: Facts['occurrences'][number]['owner']) {
    return view.occurrences
      .filter((item) => item.owner?.choice.choiceId === owner?.choice.choiceId)
      .map((item) => item.occurrence);
  }
  function add(
    origin: Occurrence['origin'],
    owner: Facts['occurrences'][number]['owner'] = null,
  ) {
    saveTree([...tree(owner), { eventId: crypto.randomUUID(), origin }], owner);
  }
  return (
    <section
      aria-label="Event preparation"
      className="space-y-4 [&_button]:h-auto [&_button]:max-w-full [&_button]:[overflow-wrap:anywhere] [&_button]:whitespace-normal"
    >
      <Card className="space-y-3 p-5">
        <h2 className="text-lg font-semibold">Prepare events</h2>
        <p>Event chance: {view.chance}%</p>
        {view.guaranteed && (
          <p>
            An Activity choice guarantees an event. Review its candidate
            occurrences below.
          </p>
        )}
        {view.chanceRoll && isTotalRoll(view.chanceRoll) ? (
          <RecordedRollTotal
            label="Event chance roll"
            recorded={view.chanceRoll}
            normalized={normalizeRawRoll(view.chanceRoll, PERCENTILE)}
            disabled={disabled}
            onClear={() => edit({ kind: 'event_chance', roll: null })}
          />
        ) : (
          <WholeNumberField
            label="Event chance roll"
            value={view.chanceRoll?.dice[0] ?? null}
            required={view.requirements.includes('event:chance:1d100')}
            disabled={disabled}
            onValue={(value) =>
              edit({
                kind: 'event_chance',
                roll: percentile(value, view.chanceRoll ?? undefined),
              })
            }
          />
        )}
        {view.chanceModifier ? (
          <p className="text-sm">
            Operating settlement reputation:{' '}
            {view.chanceModifier > 0 ? '+' : ''}
            {view.chanceModifier} to the event chance roll.
          </p>
        ) : null}
        <p className="text-muted-foreground text-sm">
          Enter raw percentile dice. Event types and outcomes recalculate as the
          week changes. Optional mitigation may remain unattempted.
        </p>
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() => add({ kind: 'rolled' })}
        >
          Add rolled event
        </Button>
        {(view.options.automaticSources ?? []).map((source) => (
          <Button
            key={source.value}
            variant="outline"
            disabled={disabled}
            onClick={() => add({ kind: 'automatic', sourceId: source.value })}
          >
            Add automatic event: {source.label}
          </Button>
        ))}
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </Card>
      {view.occurrences.map((item, index) => (
        <EventOccurrence
          key={item.occurrence.eventId}
          item={item}
          index={index}
          view={view}
          edit={edit}
          disabled={disabled}
          save={(occurrence) => {
            const parsed = eventTreeSchema.safeParse(
              tree(item.owner).map((entry) =>
                entry.eventId === occurrence.eventId ? occurrence : entry,
              ),
            );
            if (!parsed.success) {
              setError(parsed.error.issues[0]!.message);
              return false;
            }
            setError('');
            edit({ kind: 'event_occurrence', occurrence });
            return true;
          }}
          remove={() => {
            const removed = new Set([item.occurrence.eventId]);
            const current = tree(item.owner);
            for (const occurrence of current)
              if (
                'parentEventId' in occurrence.origin &&
                removed.has(occurrence.origin.parentEventId)
              )
                removed.add(occurrence.eventId);
            saveTree(
              current.filter((occurrence) => !removed.has(occurrence.eventId)),
              item.owner,
            );
          }}
          add={(kind) =>
            add({ kind, parentEventId: item.occurrence.eventId }, item.owner)
          }
        />
      ))}
      <Card className="space-y-2 p-5">
        <h2 className="font-semibold">Required preparation</h2>
        <p>
          {view.ready
            ? 'Event preparation is ready.'
            : 'Complete the missing inputs below. Optional mitigation is separate.'}
        </p>
        <ul className="space-y-1 text-sm">
          {view.requirements.map((key) => (
            <li key={key}>{eventRequirement(key)}</li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
function EventOccurrence({
  item,
  index,
  view,
  edit,
  disabled,
  save,
  remove,
  add,
}: Props & {
  item: Facts['occurrences'][number];
  index: number;
  save: (occurrence: Occurrence) => boolean;
  remove: () => void;
  add: (kind: 'roll_twice' | 'replacement') => void;
}) {
  const occurrence = item.occurrence;
  const acknowledgement = view.acknowledgements.find(
    (entry) => entry.subjectId === `event:${occurrence.eventId}`,
  );
  const {
    origin: _origin,
    tableRoll: _tableRoll,
    eventType: _eventType,
    ...details
  } = occurrence;
  const parentId =
    'parentEventId' in occurrence.origin
      ? occurrence.origin.parentEventId
      : null;
  const parentIndex = view.occurrences.findIndex(
    (entry) => entry.occurrence.eventId === parentId,
  );
  return (
    <Card
      className="space-y-3 p-5"
      role="group"
      aria-label={`Event ${index + 1}`}
    >
      <h3 className="text-lg font-semibold">
        Event {index + 1}:{' '}
        {item.resolvedType ? activityLabel(item.resolvedType) : 'Awaiting roll'}
      </h3>
      <p className="text-muted-foreground text-sm">
        {activityLabel(occurrence.origin.kind)}
        {parentIndex >= 0 ? ` · From Event ${parentIndex + 1}` : ''}
        {item.owner ? ' · Activity candidate' : ''} ·{' '}
        {item.negated
          ? 'Negated'
          : item.selected
            ? item.mode === 'twice'
              ? 'Twice outcome'
              : item.mode === 'no_additional_effect'
                ? 'No additional effect'
                : 'Selected outcome'
            : 'Not selected'}
      </p>
      {occurrence.tableRoll && isTotalRoll(occurrence.tableRoll) ? (
        <RecordedRollTotal
          label={`Event ${index + 1} table roll`}
          recorded={occurrence.tableRoll}
          normalized={normalizeRawRoll(occurrence.tableRoll, PERCENTILE)}
          disabled={disabled}
          onClear={() => {
            const { tableRoll: _previous, ...rest } = occurrence;
            save(rest);
          }}
        />
      ) : (
        <WholeNumberField
          label={`Event ${index + 1} table roll`}
          value={occurrence.tableRoll?.dice[0] ?? null}
          disabled={disabled}
          required
          onValue={(value) => {
            const { tableRoll: _previous, ...rest } = occurrence;
            const roll = percentile(value, occurrence.tableRoll);
            save(roll ? { ...rest, tableRoll: roll } : rest);
          }}
        />
      )}
      {item.optionalMitigation !== 'unavailable' && (
        <p className="text-sm">
          Optional mitigation:{' '}
          {item.optionalMitigation === 'attempted'
            ? 'Attempted — supply any missing checks below.'
            : 'Unattempted — this does not block preparation.'}
        </p>
      )}
      {occurrence.tableRoll && (
        <details>
          <summary className="cursor-pointer text-sm">
            Event table modifiers
          </summary>
          <StructuredChoiceField
            name="modifiers"
            schema={rawRollModifiersSchema}
            value={occurrence.tableRoll.modifiers}
            options={view.options}
            disabled={disabled}
            onValue={(value) => {
              const parsed = rawRollModifiersSchema.safeParse(value ?? []);
              return (
                parsed.success &&
                save({
                  ...occurrence,
                  tableRoll: {
                    ...occurrence.tableRoll!,
                    modifiers: parsed.data,
                  },
                })
              );
            }}
          />
        </details>
      )}
      {item.owner &&
        occurrence.origin.kind === 'rolled' &&
        'candidates' in item.owner.choice && (
          <Button
            variant="outline"
            disabled={disabled}
            aria-pressed={
              item.owner.choice.selectedEventId === occurrence.eventId
            }
            onClick={() => {
              const owner = item.owner!;
              if ('candidates' in owner.choice)
                edit({
                  kind: 'detail',
                  slotId: owner.slotId,
                  choiceId: owner.choice.choiceId,
                  choice: {
                    ...owner.choice,
                    selectedEventId: occurrence.eventId,
                  },
                });
            }}
          >
            Select this Activity event
          </Button>
        )}
      <details>
        <summary className="cursor-pointer font-medium">
          Edit Event {index + 1} details
        </summary>
        <div className="mt-3 space-y-3">
          <StructuredChoiceField
            name="occurrence"
            schema={detailsSchema}
            rollSides={item.rollSides}
            value={details}
            options={view.options}
            disabled={disabled}
            onValue={(value) => {
              if (value === undefined)
                return save({
                  eventId: occurrence.eventId,
                  origin: occurrence.origin,
                  ...(occurrence.tableRoll
                    ? { tableRoll: occurrence.tableRoll }
                    : {}),
                });
              const parsed = detailsSchema.safeParse(value);
              return (
                parsed.success &&
                save({
                  ...parsed.data,
                  origin: occurrence.origin,
                  ...(occurrence.tableRoll
                    ? { tableRoll: occurrence.tableRoll }
                    : {}),
                })
              );
            }}
          />
        </div>
      </details>
      {(Boolean(acknowledgement) ||
        item.requirements.includes(
          `${occurrence.eventId}:acknowledgement`,
        )) && (
        <div className="space-y-2">
          <ActivityText
            name="Event outcome acknowledgement"
            value={acknowledgement?.outcome ?? ''}
            required
            disabled={disabled}
            onValue={(outcome) =>
              edit({
                kind: 'acknowledge',
                acknowledgement: {
                  acknowledgementId:
                    acknowledgement?.acknowledgementId ??
                    `event:${occurrence.eventId}`,
                  subjectId: `event:${occurrence.eventId}`,
                  outcome,
                },
              })
            }
          />
          {acknowledgement && (
            <Button
              variant="outline"
              disabled={disabled}
              onClick={() =>
                edit({
                  kind: 'clear_acknowledgement',
                  acknowledgementId: acknowledgement.acknowledgementId,
                })
              }
            >
              Clear event acknowledgement
            </Button>
          )}
        </div>
      )}
      <EventChecks item={item} view={view} />
      {item.warnings.map((warning) => (
        <p key={warning} className="text-amber-700">
          {eventWarning(warning)}
        </p>
      ))}
      {item.exceptionChoices.map((exception) => (
        <div
          key={exception.exceptionId}
          className="space-y-2 rounded-md border border-amber-500 p-3"
        >
          <p className="text-sm">
            Table exception: {exception.ruleId.replaceAll('-', ' ')}.
          </p>
          <ActivityText
            name="Event exception reason"
            required
            disabled={disabled}
            value={exception.reason}
            onValue={(reason) =>
              edit({
                kind: 'rules_exception',
                exception: { ...exception, reason },
              })
            }
          />
          {exception.reason && (
            <Button
              variant="outline"
              disabled={disabled}
              onClick={() =>
                edit({
                  kind: 'clear_rules_exception',
                  exceptionId: exception.exceptionId,
                })
              }
            >
              Remove event exception
            </Button>
          )}
        </div>
      ))}
      {item.changes.length > 0 && (
        <ul aria-label="Event outcomes" className="space-y-1 text-sm">
          {item.changes.map((change) => (
            <li key={JSON.stringify(change)}>{eventChange(change)}</li>
          ))}
        </ul>
      )}
      {item.requirements.length > 0 && (
        <ul className="text-sm">
          {item.requirements.map((key) => (
            <li key={key}>{eventRequirement(key)}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() => add('roll_twice')}
        >
          Add Roll Twice child
        </Button>
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() => add('replacement')}
        >
          Add replacement event
        </Button>
        <Button variant="outline" disabled={disabled} onClick={remove}>
          Remove Event {index + 1} and its branches
        </Button>
      </div>
    </Card>
  );
}
