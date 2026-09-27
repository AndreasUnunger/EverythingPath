'use client';
import { Button } from '~/components/ui/button';
import type { RollSpec } from '~/lib/raw-roll';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import { WholeNumberField } from './whole-number-field';
import {
  editableTotal,
  isLegacyRoll,
  recordedDiceCount,
  rollNotation,
  rollReadFacts,
  totalRoll,
} from './roll-facts';

// The one dice-only total control for every supported roll. It reads either
// recorded form through the shared normalizer and writes only the strict total
// form against the rule's expected specification. A blank clears through the
// owning operation supplied by the caller; incomplete recorded data (partial
// legacy dice, another specification) stays untouched and visible until the
// player types a replacement or clears it deliberately.
export function RollTotalField({
  label,
  spec,
  recorded,
  disabled = false,
  required = false,
  onRoll,
  onInvalid,
}: {
  label: string;
  spec: RollSpec;
  recorded: RawRoll | null | undefined;
  disabled?: boolean;
  required?: boolean;
  onRoll: (roll: RawRoll | null) => void;
  onInvalid?: (message: string | null) => void;
}) {
  const facts = rollReadFacts(recorded, spec);
  const { normalized } = facts;
  const value = editableTotal(facts);
  const retained = recorded && normalized.status === 'incomplete';
  return (
    <div className="min-w-0 space-y-1">
      <WholeNumberField
        label={label}
        value={value}
        required={required}
        disabled={disabled}
        onInvalid={onInvalid}
        onValue={(total) =>
          onRoll(total === null ? null : totalRoll(total, spec, recorded))
        }
      />
      <p className="text-muted-foreground font-mono text-xs">
        {rollNotation(spec)} · total of the dice only
      </p>
      {recorded && (
        <p className="text-muted-foreground text-xs">
          {recorded.provenance.kind === 'generated'
            ? 'Recorded roll.'
            : 'Rolled at the table.'}
        </p>
      )}
      {retained && (
        <p role="note" className="text-sm text-amber-300">
          {isLegacyRoll(recorded)
            ? recorded.sides === spec.sides && recorded.dice.length < spec.count
              ? `Recorded dice ${recorded.dice.join(', ')} are incomplete for ${rollNotation(spec)}. Enter the total of all dice or clear the recorded roll.`
              : `Recorded dice ${recorded.dice.join(', ')} were entered for ${rollNotation({ count: recorded.dice.length, sides: recorded.sides })}, but this step needs ${rollNotation(spec)}. Enter the total or clear the recorded roll.`
            : `Recorded total ${recorded.diceTotal} was entered for ${rollNotation({ count: recordedDiceCount(recorded), sides: recorded.sides })}, but this step needs ${rollNotation(spec)}. Enter the total or clear the recorded roll.`}
        </p>
      )}
      {retained && (
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => onRoll(null)}
        >
          Clear {label.toLowerCase()}
        </Button>
      )}
      {normalized.status === 'complete' &&
        normalized.rangeWarning === 'total' && (
          <p role="note" className="text-sm text-amber-300">
            The usual range for {rollNotation(spec)} is {spec.count}–
            {spec.count * spec.sides}. Your entered total is retained for the
            table.
          </p>
        )}
      {normalized.status === 'complete' &&
        normalized.rangeWarning === 'legacy-die' && (
          <p role="note" className="text-sm text-amber-300">
            The recorded dice include a value outside 1–{spec.sides}. They are
            retained for the table until you enter a new total.
          </p>
        )}
    </div>
  );
}
