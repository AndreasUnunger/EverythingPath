import { cn } from '~/lib/utils';

/**
 * The one situational marker (approved variant 3): a tiny sky diamond at a
 * number's corner, absolutely positioned so the number never shifts. Only a
 * number with contributions waiting on a Situation earns it.
 */
export function SituationMarker({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Has situational bonuses"
      className={cn(
        'pointer-events-none absolute size-1.5 rotate-45 bg-sky-300',
        className,
      )}
    />
  );
}
