'use client';
import type { ReactNode } from 'react';
import { Button } from '~/components/ui/button';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import { RollTotalField } from './roll-total-field';
import type { EventCheckFacts } from './types';
import { signed } from './upkeep-parts';

// One Event check: the dice total on the left, the calculated bonus, the
// total against the DC, the breakdown and the result beside it; stacked on
// a phone. Shared by every event family's checks. The entered dice never
// include the bonus. `support` hosts a control rendered under the row.
export function EventCheckRow({
  facts,
  recorded,
  disabled,
  onRoll,
  support,
  onClearOverseer,
  children,
}: {
  facts: EventCheckFacts;
  recorded: RawRoll | undefined;
  disabled: boolean;
  onRoll: (roll: RawRoll | null) => void;
  support?: ReactNode;
  onClearOverseer?: () => void;
  children?: ReactNode;
}) {
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold [overflow-wrap:anywhere]">
        <span className="min-w-0">{facts.label}</span>
        {facts.mandatory && (
          <span className="rounded-full border px-2 py-0.5 text-xs font-medium">
            Mandatory
          </span>
        )}
      </legend>
      <p className="text-muted-foreground min-w-0 text-xs [overflow-wrap:anywhere]">
        {facts.legend}
      </p>
      <div className="grid min-w-0 items-start gap-x-6 gap-y-1 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <RollTotalField
          label={facts.label}
          spec={facts.spec}
          recorded={recorded}
          required={facts.required}
          disabled={disabled}
          onRoll={onRoll}
        />
        <div className="min-w-0 space-y-1 text-sm [overflow-wrap:anywhere] sm:pt-6">
          {facts.modifier === null ? (
            <p className="text-muted-foreground">
              The bonus is calculated once the event&apos;s other inputs are in.
            </p>
          ) : (
            <p className="flex flex-wrap gap-x-3">
              <span>
                Bonus{' '}
                <strong className="font-mono">{signed(facts.modifier)}</strong>
              </span>
              {facts.total !== null ? (
                <span>
                  = <strong className="font-mono">{facts.total}</strong> vs DC{' '}
                  {facts.dc}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  vs DC {facts.dc} · total after the roll
                </span>
              )}
            </p>
          )}
          {facts.breakdown.length > 0 && (
            <p className="text-muted-foreground text-xs">
              {facts.breakdown
                .map((entry) => `${entry.label} ${signed(entry.value)}`)
                .join(' · ')}
            </p>
          )}
          {facts.resultText !== null && (
            <p>
              {facts.succeeded ? 'Success' : 'Failure'} · {facts.resultText}
            </p>
          )}
        </div>
      </div>
      {facts.overseerRecorded && onClearOverseer && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p role="note" className="min-w-0 text-sm text-amber-300">
            Overseer support is recorded on this check. It helps every check of
            this event once.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`Remove Overseer support from ${facts.label}`}
            disabled={disabled}
            onClick={onClearOverseer}
          >
            Remove Overseer support
          </Button>
        </div>
      )}
      {support}
      {children}
    </fieldset>
  );
}
