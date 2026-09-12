'use client';
import { persistentDecisionSchema } from '~/lib/weekly-draft-facts';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import { WholeNumberField } from './whole-number-field';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { ChoiceCards } from './choice-cards';
import { StructuredChoiceField } from './structured-choice-field';
import { ActivityText } from './activity-details';
import { eventRequirement } from './event-messages';
import type { PersistentView as Facts } from './types';
import { persistentMessage, PersistentOutcomes } from './persistent-outcomes';
type Props = {
  view: Facts;
  edit: (edit: WeeklyDraftEdit) => unknown;
  disabled: boolean;
};
type Event = Facts['events'][number];
const mitigation = persistentDecisionSchema.options[1];
const officerDecision = mitigation.omit({
  overseerCharacterId: true,
  rolls: true,
  targets: true,
  strategistCharacterId: true,
});
const theftDecision = mitigation.omit({
  officerCheck: true,
  targets: true,
  strategistCharacterId: true,
});

export function PersistentView({ view, edit, disabled }: Props) {
  return (
    <section
      aria-label="Persistent preparation"
      className="space-y-4 [&_button]:h-auto [&_button]:max-w-full [&_button]:[overflow-wrap:anywhere] [&_button]:whitespace-normal"
    >
      <Card className="space-y-2 p-5">
        <h2 className="text-lg font-semibold">Prepare carried events</h2>
        <p>
          Events are resolved oldest first. Their targets and order were
          recorded at the start of the week. Ending an event keeps it here for
          review.
        </p>
        {view.firstBuyoff && <p>First buyoff is available immediately.</p>}
        <p>
          Projected buyoff cost:{' '}
          {view.buyoffCostCopper === null
            ? 'Awaiting rank'
            : `${view.buyoffCostCopper} cp`}
          .
        </p>
        <p>
          Next buyoff:{' '}
          {view.nextBuyoffWeek === null
            ? 'Awaiting preparation'
            : `week ${view.nextBuyoffWeek}`}
          .
        </p>
        <p className="text-muted-foreground text-sm">
          The next buyoff includes staged buyoffs. Later buyoffs share a
          four-week wait. Costs and endings take effect when the whole week is
          confirmed.
        </p>
      </Card>
      {view.events.map((event) => (
        <PersistentEvent
          key={event.eventId}
          event={event}
          view={view}
          edit={edit}
          disabled={disabled}
        />
      ))}
      <Card className="space-y-2 p-5">
        <h2 className="font-semibold">Required preparation</h2>
        <p>
          {view.ready
            ? 'Persistent preparation is ready.'
            : 'Review the event requirements below and finish any earlier phases that need attention.'}
        </p>
        {view.requirements.filter(
          (key) =>
            !view.events.some((event) => key.startsWith(`${event.eventId}:`)),
        ).length > 0 && (
          <p>
            Earlier phases still need preparation. Review Upkeep, Activity and
            Event.
          </p>
        )}
        <p className="text-muted-foreground text-sm">
          Leaving mitigation unattempted does not block preparation.
        </p>
      </Card>
    </section>
  );
}
function PersistentEvent({
  event,
  view,
  edit,
  disabled,
}: Props & { event: Event }) {
  const decision = event.decision;
  function choose(kind: string) {
    if (kind === 'buyoff')
      edit({
        kind: 'persistent_decision',
        decision: {
          kind,
          eventId: event.eventId,
          ...(view.buyoffCostCopper === null
            ? {}
            : { costCopper: view.buyoffCostCopper }),
        },
      });
    else if (kind === 'mitigate' || kind === 'unattempted')
      edit({
        kind: 'persistent_decision',
        decision: { kind, eventId: event.eventId },
      });
  }
  return (
    <Card
      role="group"
      aria-label={event.name}
      className="min-w-0 space-y-3 p-5"
    >
      <h3 className="text-lg font-semibold">{event.name}</h3>
      <p className="text-muted-foreground text-sm">
        Started week {event.startedWeek} · {event.ageWeeks} weeks elapsed ·
        Recorded order {event.order + 1}
      </p>
      <p>
        Targets:{' '}
        {event.targetNames.length ? event.targetNames.join(', ') : 'Militia'}
      </p>
      {event.ended && <p>Ending staged for Confirmation.</p>}
      <ChoiceCards
        label="Persistent decision"
        value={decision?.kind ?? 'unattempted'}
        disabled={disabled}
        choices={[
          { value: 'unattempted', label: 'Leave unattempted' },
          ...(['theft', 'rivalry'].includes(event.eventType)
            ? [
                {
                  value: 'mitigate',
                  label:
                    event.eventType === 'rivalry'
                      ? 'Attempt officer ending'
                      : 'Attempt temporary mitigation',
                },
              ]
            : []),
          { value: 'buyoff', label: 'Buy off event' },
        ]}
        onChange={choose}
      />
      {decision?.kind === 'mitigate' && (
        <>
          <p className="text-sm">
            {event.eventType === 'rivalry'
              ? 'An officer’s Diplomacy, Bluff or Intimidate check against DC 20 can end this Rivalry permanently.'
              : 'A Loyalty check against DC 20 can reduce this week’s Theft loss to 10%. The event remains.'}
          </p>
          <StructuredChoiceField
            name="persistentDecision"
            schema={
              event.eventType === 'rivalry' ? officerDecision : theftDecision
            }
            value={decision}
            options={view.options}
            rollSides={{ roll: 20, check: 20 }}
            disabled={disabled}
            onValue={(value) => {
              if (value === undefined) {
                edit({
                  kind: 'clear_persistent_decision',
                  eventId: event.eventId,
                });
                return;
              }
              const parsed = persistentDecisionSchema.safeParse(value);
              if (!parsed.success) return false;
              edit({
                kind: 'persistent_decision',
                decision: { ...parsed.data, eventId: event.eventId },
              });
            }}
          />
        </>
      )}
      {decision?.kind === 'buyoff' && (
        <WholeNumberField
          label="Recorded buyoff cost (copper)"
          value={decision.costCopper ?? null}
          disabled={disabled}
          onValue={(value) =>
            edit({
              kind: 'persistent_decision',
              decision: {
                kind: 'buyoff',
                eventId: event.eventId,
                ...(value === null ? {} : { costCopper: value }),
              },
            })
          }
        />
      )}
      {decision?.kind === 'buyoff' && (
        <p className="text-sm">
          Recorded cost: {decision.costCopper ?? view.buyoffCostCopper} cp. The
          projected rules cost is used at Confirmation.
        </p>
      )}
      <ActivityText
        name="Ending outcome"
        required
        value={decision?.kind === 'end' ? decision.acknowledgement.outcome : ''}
        disabled={disabled}
        onValue={(outcome) =>
          edit({
            kind: 'persistent_decision',
            decision: {
              kind: 'end',
              eventId: event.eventId,
              acknowledgement: {
                acknowledgementId:
                  decision?.kind === 'end'
                    ? decision.acknowledgement.acknowledgementId
                    : crypto.randomUUID(),
                subjectId: event.eventId,
                outcome,
              },
            },
          })
        }
      />
      <p className="text-muted-foreground text-sm">
        Record a table-adjudicated ending with a reasoned exception. Use the
        officer check above for a rules-based Rivalry ending.
      </p>
      <PersistentOutcomes event={event} options={view.options} />
      {event.warnings.map((key) => (
        <p key={key} className="text-amber-700">
          {persistentMessage(key)}
        </p>
      ))}
      {event.exceptions.map((exception) => (
        <div
          key={exception.exceptionId}
          className="space-y-2 rounded-md border border-amber-500 p-3"
        >
          <p>{persistentMessage(`${event.eventId}:${exception.ruleId}`)}</p>
          <ActivityText
            name="Persistent exception reason"
            required
            value={exception.reason}
            disabled={disabled}
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
              Remove persistent exception
            </Button>
          )}
        </div>
      ))}
      {event.requirements.length > 0 && (
        <ul className="space-y-1 text-sm">
          {event.requirements.map((key) => (
            <li key={key}>{eventRequirement(key)}</li>
          ))}
        </ul>
      )}
      <Button
        variant="outline"
        disabled={disabled}
        onClick={() =>
          edit({ kind: 'clear_persistent_decision', eventId: event.eventId })
        }
      >
        Clear decision
      </Button>
    </Card>
  );
}
