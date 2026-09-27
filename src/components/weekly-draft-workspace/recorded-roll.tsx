'use client';
import { Button } from '~/components/ui/button';
import type { NormalizedRoll } from '~/lib/raw-roll';
import { rollNotation, type TotalRawRoll } from './roll-facts';

// Transitional numeric presentation for a roll that another editor recorded
// as a dice total. It shows exactly what was recorded (zero included) and
// what the current step needs. Editing the number belongs to a later
// delivery; the only write here is the existing whole-roll clear.
export function RecordedRollTotal({
  label,
  recorded,
  normalized = null,
  disabled = false,
  onClear,
}: {
  label: string;
  recorded: TotalRawRoll;
  normalized?: NormalizedRoll | null;
  disabled?: boolean;
  onClear?: () => void;
}) {
  const recordedNotation = rollNotation({
    count: recorded.diceCount,
    sides: recorded.sides,
  });
  return (
    <div
      role="group"
      aria-label={label}
      className="min-w-0 space-y-2 rounded-md border p-3 text-sm"
    >
      <p>
        <span className="text-muted-foreground text-xs">Recorded total</span>{' '}
        <strong className="font-mono">{recorded.diceTotal}</strong>{' '}
        <span className="text-muted-foreground font-mono text-xs">
          {recordedNotation}
        </span>
      </p>
      <p className="text-muted-foreground text-xs">
        {recorded.provenance.kind === 'generated'
          ? 'Recorded roll.'
          : 'Rolled at the table.'}
      </p>
      {normalized?.status === 'incomplete' && (
        <p role="note" className="text-amber-300">
          This step needs {rollNotation(normalized)}, but the recorded total is
          for {recordedNotation}. Clear it to enter the required roll.
        </p>
      )}
      {normalized?.status === 'complete' &&
        normalized.rangeWarning === 'total' && (
          <p role="note" className="text-amber-300">
            The usual range for {rollNotation(normalized)} is {normalized.count}
            –{normalized.count * normalized.sides}. The recorded total is
            retained for the table.
          </p>
        )}
      {onClear && (
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={onClear}
        >
          Clear {label.toLowerCase()}
        </Button>
      )}
    </div>
  );
}
