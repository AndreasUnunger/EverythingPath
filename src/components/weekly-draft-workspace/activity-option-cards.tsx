'use client';
import { Check } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import type { DetailOption } from './activity-action-detail';

// One choice field as a radio group of compact playing cards: eligible
// options first, the rest under their own heading, and a recorded reference
// that is no longer known kept visible as a missing card. Every card stays
// selectable; the rules warn about mismatches afterwards. Tap or keyboard
// only, so touch scrolling can start on a card.

function OptionCard({
  option,
  checked,
  disabled,
  onSelect,
}: {
  option: DetailOption;
  checked: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const id = useId();
  const note = option.missing || option.description !== null;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-labelledby={`${id}-name`}
      aria-describedby={note ? `${id}-note` : undefined}
      disabled={disabled}
      onClick={() => {
        if (!checked) onSelect();
      }}
      className={cn(
        'bg-card flex min-h-14 min-w-0 touch-manipulation flex-col gap-0.5 rounded-lg border-2 p-2.5 text-left shadow-sm transition-transform outline-none',
        'hover:border-primary/60 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5 motion-reduce:transform-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked
          ? 'border-primary bg-primary/15 hover:border-primary'
          : option.missing
            ? 'border-amber-500'
            : option.eligible
              ? 'border-foreground/25'
              : 'border-foreground/25 border-dashed',
      )}
    >
      <span className="flex w-full min-w-0 items-start justify-between gap-2">
        <span
          id={`${id}-name`}
          className="min-w-0 text-sm leading-tight font-medium [overflow-wrap:anywhere]"
        >
          {option.label}
        </span>
        {checked && <Check aria-hidden className="mt-0.5 size-4 shrink-0" />}
      </span>
      {note && (
        <span
          id={`${id}-note`}
          className="text-muted-foreground min-w-0 text-xs leading-snug [overflow-wrap:anywhere]"
        >
          {option.missing && (
            <span className="font-medium text-amber-300">Missing</span>
          )}
          {option.missing && option.description !== null && ' · '}
          {option.description}
        </span>
      )}
    </button>
  );
}

function CardGrid({
  options,
  value,
  disabled,
  onSelect,
}: {
  options: DetailOption[];
  value: string | null;
  disabled: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 items-stretch gap-2 sm:grid-cols-3 xl:grid-cols-4">
      {options.map((option) => (
        <OptionCard
          key={option.value}
          option={option}
          checked={option.value === value}
          disabled={disabled}
          onSelect={() => onSelect(option.value)}
        />
      ))}
    </div>
  );
}

export function ActivityOptionCards({
  label,
  options,
  value,
  onSelect,
  onClear,
  disabled,
  otherLabel,
  description,
}: {
  label: string;
  // Already ordered: eligible first, then the rest; missing ones may lead.
  options: DetailOption[];
  value: string | null;
  onSelect: (value: string) => void;
  onClear: () => void;
  disabled: boolean;
  // Heading for the options the rules do not expect here.
  otherLabel: string;
  description?: ReactNode;
}) {
  const eligible = options.filter((option) => option.eligible);
  const other = options.filter((option) => !option.eligible && !option.missing);
  const missing = options.filter((option) => option.missing);
  // Without an eligible option the groups add nothing: one list.
  const grouped = eligible.length > 0 && other.length > 0;
  const unavailable =
    value !== null && !options.some((option) => option.value === value);
  return (
    <div className="min-w-0 space-y-2">
      <div className="space-y-1">
        <p className="text-sm font-semibold">{label}</p>
        {description && (
          <p className="text-muted-foreground text-xs">{description}</p>
        )}
      </div>
      <div role="radiogroup" aria-label={label} className="space-y-2">
        <CardGrid
          options={grouped ? [...missing, ...eligible] : options}
          value={value}
          disabled={disabled}
          onSelect={onSelect}
        />
        {grouped && (
          <>
            <p className="text-muted-foreground pt-1 text-xs font-medium">
              {otherLabel}
            </p>
            <CardGrid
              options={other}
              value={value}
              disabled={disabled}
              onSelect={onSelect}
            />
          </>
        )}
      </div>
      {unavailable && (
        <p role="note" className="text-sm text-amber-300">
          Selected option unavailable.
        </p>
      )}
      {value !== null && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={onClear}
        >
          Clear {label.toLowerCase()}
        </Button>
      )}
    </div>
  );
}
