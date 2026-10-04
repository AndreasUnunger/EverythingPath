'use client';
import { useId } from 'react';
import { cn } from '~/lib/utils';
import { fieldLabel } from './sheet-parts';
import type { useCharacterSheet } from './use-character-sheet';

type FamiliarView = NonNullable<
  ReturnType<typeof useCharacterSheet>['familiar']['view']
>;
type Statistic = FamiliarView['statistics'][number];

const isUnresolved = (label: string) => label === 'Unresolved';

/**
 * One familiar rule value as a summary cell: its name, the current value
 * (Unresolved rather than a partial number), the permanent value beside it
 * while a temporary effect changes it, and what it means. The cell is a
 * group named by the statistic and described by its meaning.
 */
export function FamiliarStatistic({ statistic }: { statistic: Statistic }) {
  const labelId = useId();
  const descriptionId = useId();
  const value = (label: string, size: string) => (
    <span
      className={cn(
        'font-mono leading-none',
        isUnresolved(label) ? 'text-muted-foreground text-sm' : size,
      )}
    >
      {label}
    </span>
  );
  return (
    <li className="min-w-0">
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        className="border-foreground/15 flex h-full min-w-0 flex-col gap-1 border p-2"
      >
        <span
          id={labelId}
          className={cn(fieldLabel, '[overflow-wrap:anywhere]')}
        >
          {statistic.label}
        </span>
        {statistic.hasTemporaryChange ? (
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="flex items-baseline gap-1">
              <span className={fieldLabel}>Current</span>
              {value(statistic.valueLabel, 'text-xl')}
            </span>
            <span className="text-muted-foreground flex items-baseline gap-1">
              <span className={fieldLabel}>Permanent</span>
              {value(statistic.permanentValueLabel, 'text-base')}
            </span>
          </span>
        ) : (
          value(statistic.valueLabel, 'text-xl')
        )}
        <span
          id={descriptionId}
          className="text-muted-foreground text-xs [overflow-wrap:anywhere]"
        >
          {statistic.description}
        </span>
      </div>
    </li>
  );
}
