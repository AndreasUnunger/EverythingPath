'use client';
import { Button } from '~/components/ui/button';
import { EventChoiceCard } from './event-choice-card';
import type { EventFamilyInputsProps } from './event-family-inputs';
import { EventNote } from './event-note';
import { endingsWithout, pressEnding } from './event-outcome-facts';
import { WholeNumberField } from './whole-number-field';

// Calm, morale, narrative and training events. Their only inputs besides
// What happened are High Morale's carried events that end here and Invasion's
// Average Party Level; anything else recorded on the occurrence is listed as
// unused until it is cleared on purpose. `subject` is the block label, which
// names the clear buttons for assistive technology.
export function EventOutcomeInputs({
  panel,
  id,
  disabled,
  edits,
  showRefusal,
  subject,
}: Omit<EventFamilyInputsProps<'outcome'>, 'targetCards'> & {
  subject: string;
}) {
  const { endings, partyLevel } = panel;
  return (
    <>
      {endings && (
        <fieldset className="min-w-0 space-y-2">
          <legend className="text-sm font-semibold [overflow-wrap:anywhere]">
            {endings.label}
            {endings.required && (
              <span className="text-muted-foreground text-xs font-normal">
                {' '}
                required
              </span>
            )}
          </legend>
          {endings.hint && (
            <p className="text-muted-foreground min-w-0 text-xs [overflow-wrap:anywhere]">
              {endings.hint}
            </p>
          )}
          {endings.choices.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {endings.choices.map((card) => (
                <EventChoiceCard
                  key={card.value}
                  label={card.label}
                  description={card.description}
                  // Two carried events can share a name; the description
                  // (its origin week) tells them apart.
                  ariaLabel={`${card.label} · ${card.description}`}
                  pressed={endings.selected.includes(card.value)}
                  disabled={disabled}
                  onPress={() =>
                    showRefusal(
                      edits.setTargets(
                        id,
                        'event',
                        pressEnding(endings, card.value),
                      ),
                    )
                  }
                />
              ))}
            </div>
          )}
          {endings.chosen && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              aria-label={`End the oldest instead for ${endings.label}`}
              onClick={() => showRefusal(edits.setTargets(id, 'event', []))}
            >
              End the oldest instead
            </Button>
          )}
          {endings.retained.map((entry) => (
            <EventNote
              key={entry.value}
              action="Clear"
              actionLabel={`Clear ${entry.label} from ${endings.label}`}
              disabled={disabled}
              onAction={() =>
                showRefusal(
                  edits.setTargets(
                    id,
                    'event',
                    endingsWithout(endings, entry.value),
                  ),
                )
              }
            >
              {entry.label}: {entry.reason}
            </EventNote>
          ))}
        </fieldset>
      )}
      {partyLevel && (
        // The level beside its CR, like the roll rows; stacked on a phone.
        <div className="grid min-w-0 items-start gap-x-6 gap-y-1 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
          <WholeNumberField
            label="Average Party Level"
            value={partyLevel.value}
            required={partyLevel.required}
            disabled={disabled}
            description="Encounter CR = APL + 1"
            onValue={(value) =>
              showRefusal(edits.setAveragePartyLevel(id, value))
            }
          />
          {partyLevel.challengeRating !== null && (
            <p className="min-w-0 text-sm [overflow-wrap:anywhere] sm:pt-7">
              → CR{' '}
              <strong className="font-mono">
                {partyLevel.challengeRating}
              </strong>
            </p>
          )}
        </div>
      )}
      {panel.retained.length > 0 && (
        <details className="min-w-0">
          <summary className="cursor-pointer text-sm font-medium">
            Recorded inputs this event does not use ({panel.retained.length})
          </summary>
          <div className="mt-2 space-y-2">
            {panel.retained.map((entry) => (
              <div
                key={entry.field}
                className="flex flex-wrap items-center gap-x-4 gap-y-2"
              >
                <p className="text-muted-foreground min-w-0 text-sm [overflow-wrap:anywhere]">
                  {entry.label}: {entry.value}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`Clear ${entry.label} from ${subject}`}
                  disabled={disabled}
                  onClick={() =>
                    showRefusal(
                      edits.clearRetained(
                        id,
                        entry.field,
                        // High Morale's own ended events are `event` targets
                        // and stay when its unused target kinds are cleared.
                        panel.eventType === 'high_morale' ? ['event'] : [],
                      ),
                    )
                  }
                >
                  Clear {entry.label.toLowerCase()}
                </Button>
              </div>
            ))}
          </div>
        </details>
      )}
    </>
  );
}
