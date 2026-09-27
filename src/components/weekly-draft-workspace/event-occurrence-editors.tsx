'use client';
import { useState } from 'react';
import { eventOccurrenceSchema } from '~/lib/weekly-draft-facts';
import { eventRollSpec } from '~/lib/rules-roll-spec';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import { Button } from '~/components/ui/button';
import { ActivityText } from './activity-text';
import { EventChecks } from './event-checks';
import { eventChange } from './event-messages';
import { resolvedEventType } from './roll-facts';
import { StructuredChoiceField } from './structured-choice-field';
import type { EventBlock, EventView } from './types';

type Occurrence = EventView['occurrences'][number]['occurrence'];
const detailsSchema = eventOccurrenceSchema.omit({
  origin: true,
  tableRoll: true,
  eventType: true,
});

// The event-specific inputs of one occurrence, unchanged from the earlier
// Event editor: every schema-supported detail, the outcome acknowledgement,
// checks, Rules Exceptions and outcomes. Family-specific panels replace parts
// of this body as they ship; the block around it owns identity, the table
// roll and nesting. `disabled` already includes an occurrence still being
// prepared, so no edit targets an occurrence the draft does not hold yet.
export function EventOccurrenceEditors({
  block,
  view,
  edit,
  disabled,
  saveOccurrence,
}: {
  block: EventBlock;
  view: EventView;
  edit: (edit: WeeklyDraftEdit) => unknown;
  disabled: boolean;
  saveOccurrence: (occurrence: Occurrence) => string | null;
}) {
  const [error, setError] = useState('');
  const item = block.item;
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
  function save(next: Occurrence) {
    const message = saveOccurrence(next);
    setError(message ?? '');
    return message === null;
  }
  return (
    <div className="space-y-3">
      {item.optionalMitigation !== 'unavailable' && (
        <p className="text-sm">
          Optional mitigation:{' '}
          {item.optionalMitigation === 'attempted'
            ? 'Attempted — supply any missing checks below.'
            : 'Unattempted — this does not block preparation.'}
        </p>
      )}
      <details>
        <summary className="cursor-pointer font-medium">
          Edit {block.label} details
        </summary>
        <div className="mt-3 space-y-3">
          <StructuredChoiceField
            name="occurrence"
            schema={detailsSchema}
            rollSpec={(path) =>
              eventRollSpec(
                {
                  kind: 'occurrence',
                  eventType: resolvedEventType(item.resolvedType),
                },
                path,
              )
            }
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
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
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
    </div>
  );
}
