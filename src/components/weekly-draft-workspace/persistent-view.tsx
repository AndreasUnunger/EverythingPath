'use client';
import { eventRollSpec } from '~/lib/rules-roll-spec';
import { persistentDecisionSchema } from '~/lib/weekly-draft-facts';
import { Button } from '~/components/ui/button';
import { StructuredChoiceField } from './structured-choice-field';
import { eventRequirement } from './event-messages';
import {
  decisionCards,
  DecisionCards,
  EndingForm,
  ExceptionBlock,
  Overview,
  ProjectedResult,
  SectionMarker,
} from './persistent-parts';
import { persistentMessage, PersistentOutcomes } from './persistent-outcomes';
import { endingNeedsReason, exceptionInUse } from './persistent-sections';
import type { PersistentSourceLink, PersistentView as Facts } from './types';
import {
  usePersistentChoice,
  type PersistentEdit,
} from './use-persistent-choice';
import { phaseLabels } from './week-frame/labels';
import { formatGold } from './week-frame/reference-copy';

// Persistent as one numbered section per carried event, in the order the
// rules resolve them. Each section reads its facts from the view and sends
// its decision through the choice hook; the week frame carries readiness,
// the whole-week totals and saving.

type Props = {
  view: Facts;
  edit: PersistentEdit;
  disabled: boolean;
  openSource?: (link: PersistentSourceLink) => void;
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

export function PersistentView({ view, edit, disabled, openSource }: Props) {
  return (
    <section
      aria-label="Persistent preparation"
      className="min-w-0 space-y-6 [&_button]:h-auto [&_button]:max-w-full [&_button]:[overflow-wrap:anywhere] [&_button]:whitespace-normal"
    >
      <Overview view={view} />
      {view.events.map((event, index) => (
        <PersistentEvent
          key={event.eventId}
          number={index + 1}
          event={event}
          view={view}
          edit={edit}
          disabled={disabled}
          openSource={openSource}
        />
      ))}
    </section>
  );
}

function savedLabel(saved: string, event: Event) {
  if (saved === 'mitigate') return event.check?.label ?? 'The saved check';
  if (saved === 'buyoff') return 'Buy off';
  if (saved === 'end') return 'Ended at the table';
  return 'Leave it';
}

function PersistentEvent({
  number,
  event,
  view,
  edit,
  disabled,
  openSource,
}: Props & { number: number; event: Event }) {
  const choice = usePersistentChoice(event, edit);
  const decision = event.decision;
  const cost = view.buyoffCostCopper;
  const targets = event.targetNames.length
    ? event.targetNames.join(' & ')
    : 'Militia';
  const unsupportedCheck = choice.saved === 'mitigate' && event.check === null;
  const requirements = event.requirements.filter(
    (key) => !key.endsWith(':exception'),
  );
  return (
    <section
      role="group"
      aria-label={event.name}
      className="border-foreground/20 relative min-w-0 border-l-2 pl-6"
    >
      <SectionMarker number={number} ended={event.ended} />
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-lg font-semibold">{event.typeLabel}</h3>
        <p className="text-muted-foreground min-w-0 text-sm [overflow-wrap:anywhere]">
          since week {event.startedWeek} · {event.ageWeeks}{' '}
          {event.ageWeeks === 1 ? 'week' : 'weeks'} · {event.orderLabel} ·{' '}
          {targets}
        </p>
        <ProjectedResult result={event.result} />
      </header>
      <div className="mt-3 space-y-4 pb-2">
        {event.endedBy ? (
          <p className="text-sm [overflow-wrap:anywhere]">
            <span className="text-emerald-500">Ends this week</span> · staged by{' '}
            {event.endedBy.label}.
            {openSource && (
              <>
                {' '}
                <Button
                  type="button"
                  variant="link"
                  // Only navigates, so a locked week never disables it.
                  className="text-primary h-auto p-0 align-baseline underline underline-offset-4"
                  onClick={() => openSource(event.endedBy!.link)}
                >
                  Change it in {phaseLabels[event.endedBy.link.phase]}
                </Button>
              </>
            )}
          </p>
        ) : (
          <>
            <DecisionCards
              label={`${event.name} decision`}
              cards={decisionCards(event, cost)}
              selected={choice.selected}
              disabled={disabled}
              onChoose={choice.choose}
            />
            {unsupportedCheck && (
              <p role="note" className="text-sm text-amber-300">
                This saved check isn’t available for {event.typeLabel}. Choose
                another decision.
              </p>
            )}
            {choice.selected === 'buyoff' && (
              <p className="text-sm [overflow-wrap:anywhere]">
                {cost === null
                  ? 'Buyoff cost waits for earlier phases'
                  : `Buyoff cost ${formatGold(cost)} (2 × minimum treasury)`}{' '}
                · taken from the treasury at Confirmation
              </p>
            )}
            {choice.selected === 'mitigate' &&
              decision?.kind === 'mitigate' &&
              event.check && (
                <>
                  <p className="text-sm">
                    {event.eventType === 'rivalry'
                      ? 'An officer’s Diplomacy, Bluff or Intimidate check against DC 20 can end this Rivalry permanently.'
                      : 'A Loyalty check against DC 20 can reduce this week’s Theft loss to 10%. The event remains.'}
                  </p>
                  <StructuredChoiceField
                    name="persistentDecision"
                    schema={
                      event.eventType === 'rivalry'
                        ? officerDecision
                        : theftDecision
                    }
                    value={decision}
                    options={view.options}
                    rollSpec={(path) =>
                      eventRollSpec(
                        { kind: 'persistent', eventType: event.eventType },
                        path,
                      )
                    }
                    disabled={disabled}
                    onValue={(value) => {
                      if (value === undefined) {
                        void edit({
                          kind: 'clear_persistent_decision',
                          eventId: event.eventId,
                        });
                        return;
                      }
                      const parsed = persistentDecisionSchema.safeParse(value);
                      if (!parsed.success) return false;
                      void edit({
                        kind: 'persistent_decision',
                        decision: { ...parsed.data, eventId: event.eventId },
                      });
                    }}
                  />
                </>
              )}
            {choice.selected === 'end' && (
              <EndingForm
                key={event.eventId}
                saved={
                  decision?.kind === 'end'
                    ? decision.acknowledgement.outcome
                    : ''
                }
                notice={
                  choice.endingUnsaved
                    ? `Not saved yet. ${savedLabel(choice.saved, event)} still applies until you save how it ended.`
                    : null
                }
                needsReason={choice.endingUnsaved && endingNeedsReason(event)}
                disabled={disabled}
                onSave={choice.saveEnding}
              />
            )}
          </>
        )}
        <PersistentOutcomes event={event} options={view.options} />
        {event.warnings.map((key) => (
          <p key={key} role="note" className="text-sm text-amber-300">
            {persistentMessage(key)}
          </p>
        ))}
        {event.exceptions.map((exception) => (
          <ExceptionBlock
            key={exception.exceptionId}
            message={persistentMessage(`${event.eventId}:${exception.ruleId}`)}
            exception={exception}
            inUse={exceptionInUse(event, exception.ruleId)}
            disabled={disabled}
            onSave={choice.saveException}
            onRemove={choice.removeException}
          />
        ))}
        {requirements.length > 0 && (
          <ul className="text-muted-foreground space-y-1 text-sm">
            {requirements.map((key) => (
              <li key={key}>{eventRequirement(key)}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
