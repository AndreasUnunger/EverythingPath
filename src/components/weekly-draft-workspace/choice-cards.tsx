'use client';
import { Check } from 'lucide-react';
import { Button } from '~/components/ui/button';
export function ChoiceCards({
  label,
  value,
  choices,
  onChange,
  disabled,
}: {
  label: string;
  value: string | null;
  choices: { value: string; label: string; description?: string }[];
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="min-w-0 space-y-2" disabled={disabled}>
      <legend className="text-sm font-semibold">{label}</legend>
      <div className="grid grid-cols-2 items-stretch gap-3">
        {choices.map((choice) => (
          <Button
            key={choice.value}
            type="button"
            variant="outline"
            aria-label={choice.label}
            aria-pressed={choice.value === value}
            onClick={() => onChange(choice.value)}
            className="aria-pressed:border-primary aria-pressed:bg-primary/10 h-auto min-h-24 min-w-0 flex-col items-start justify-start gap-2 rounded-lg border-2 p-3 text-left whitespace-normal transition-transform hover:-translate-y-1 focus-visible:-translate-y-1 motion-reduce:transform-none"
          >
            <span className="flex w-full min-w-0 items-start justify-between gap-2">
              <span className="min-w-0 [overflow-wrap:anywhere] break-words">
                {choice.label}
              </span>
              {choice.value === value && (
                <Check aria-hidden className="size-4 shrink-0" />
              )}
            </span>
            {choice.description && (
              <span className="text-muted-foreground text-xs font-normal">
                {choice.description}
              </span>
            )}
          </Button>
        ))}
      </div>
    </fieldset>
  );
}
