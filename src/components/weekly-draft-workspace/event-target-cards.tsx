'use client';
import { Check } from 'lucide-react';
import { Button } from '~/components/ui/button';
import type { EventTargetChoice } from './types';

// One pressable choice card in the Event panels: a visible label, a muted
// description and a check mark while pressed. Hover only lifts and tints the
// border, so it never resembles the pressed card. The owner decides what a
// press on the pressed card means: clearing is a separate, worded control.
export function EventChoiceCard({
  label,
  description,
  pressed,
  disabled,
  onPress,
  ariaLabel,
}: {
  label: string;
  description: string | null;
  pressed: boolean;
  disabled: boolean;
  onPress: () => void;
  ariaLabel?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      aria-label={ariaLabel}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onPress}
      className="hover:border-primary/60 aria-pressed:border-primary aria-pressed:bg-primary/15 aria-pressed:hover:border-primary aria-pressed:hover:bg-primary/15 hover:bg-background hover:text-foreground flex h-auto min-h-14 w-full min-w-0 flex-col items-start justify-start gap-1 rounded-lg border-2 p-3 text-left whitespace-normal transition-transform hover:-translate-y-1 focus-visible:-translate-y-1 motion-reduce:transform-none"
    >
      <span className="flex w-full min-w-0 items-start justify-between gap-2">
        <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
        {pressed && <Check aria-hidden className="size-4 shrink-0" />}
      </span>
      {description && (
        <span className="text-muted-foreground min-w-0 text-xs font-normal [overflow-wrap:anywhere]">
          {description}
        </span>
      )}
    </Button>
  );
}

// The team, settlement or person an event targets, chosen from cards. A
// recorded target the current choices no longer include stays as a note
// until it is cleared on purpose.
export function EventTargetCards({
  choice,
  disabled,
  onSelect,
  onClear,
  onClearRetained,
}: {
  choice: EventTargetChoice;
  disabled: boolean;
  onSelect: (value: string) => void;
  onClear: () => void;
  onClearRetained: (value: string) => void;
}) {
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-sm font-semibold [overflow-wrap:anywhere]">
        {choice.label}
        {choice.required && (
          <span className="text-muted-foreground text-xs font-normal">
            {' '}
            required
          </span>
        )}
      </legend>
      {choice.hint && (
        <p className="text-muted-foreground min-w-0 text-xs [overflow-wrap:anywhere]">
          {choice.hint}
        </p>
      )}
      {choice.choices.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {choice.choices.map((card) => (
            <EventChoiceCard
              key={card.value}
              label={card.label}
              ariaLabel={card.label}
              description={card.description}
              pressed={card.value === choice.selected}
              disabled={disabled}
              onPress={() => {
                if (card.value !== choice.selected) onSelect(card.value);
              }}
            />
          ))}
        </div>
      )}
      {choice.selected !== null && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={onClear}
        >
          Clear {choice.label.toLowerCase()}
        </Button>
      )}
      {choice.retained.map((entry) => (
        <div
          key={entry.value}
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
            aria-label={`Clear ${entry.label} from ${choice.label}`}
            disabled={disabled}
            onClick={() => onClearRetained(entry.value)}
          >
            Clear
          </Button>
        </div>
      ))}
    </fieldset>
  );
}
