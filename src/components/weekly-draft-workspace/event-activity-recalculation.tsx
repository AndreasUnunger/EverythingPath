'use client';
import { InlineAction } from './event-steps';
import type { EventActivityRecalculation as EventActivityRecalculationFacts } from './types';

// Hidden Agenda's recalculated Activity checks: each check's label and
// result, worded "Decided by this bonus" where the bonus turns the outcome,
// and Activity's own notes when its inputs are still missing. Read-only:
// the checks are edited in Activity. `subject` is the block label.
export function EventActivityRecalculation({
  activity,
  subject,
  openActivity,
}: {
  activity: EventActivityRecalculationFacts;
  subject: string;
  openActivity?: () => void;
}) {
  const needsActivity =
    activity.pending || activity.checks.some((check) => check.issues.length);
  return (
    <section
      role="group"
      aria-label={`Recalculated Activity checks · ${subject}`}
      className="min-w-0 space-y-2"
    >
      <p className="text-sm font-semibold">Recalculated Activity checks</p>
      {activity.checks.length > 0 && (
        <ul className="space-y-2">
          {activity.checks.map((check) => (
            <li
              key={check.slotId}
              className="min-w-0 space-y-1 text-sm [overflow-wrap:anywhere]"
            >
              <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="min-w-0 font-medium">{check.label}</span>
                {check.decided && (
                  <span className="text-foreground rounded-full border px-2 py-0.5 text-xs font-medium">
                    Decided by this bonus
                  </span>
                )}
              </p>
              <p className="min-w-0">{check.result}</p>
              {check.issues.map((issue) => (
                <p key={issue} role="note" className="text-amber-300">
                  {issue}
                </p>
              ))}
            </li>
          ))}
        </ul>
      )}
      {activity.pending && (
        <p className="text-muted-foreground min-w-0 text-sm [overflow-wrap:anywhere]">
          Activity still needs inputs, so these results are not final yet.
        </p>
      )}
      {activity.cycle && (
        <p
          role="note"
          className="min-w-0 text-sm [overflow-wrap:anywhere] text-amber-300"
        >
          The recalculated Activity keeps changing whether this event happens.
          Review the Activity checks with the table.
        </p>
      )}
      {needsActivity && openActivity && (
        <InlineAction
          onClick={openActivity}
          ariaLabel={`Open Activity for ${subject}`}
        >
          Open Activity
        </InlineAction>
      )}
    </section>
  );
}
