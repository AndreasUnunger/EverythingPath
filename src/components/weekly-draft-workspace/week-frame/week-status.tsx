'use client';
import { X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { historyPath } from '~/lib/campaign-routes';
import type { Phase, WeeklyDraftWorkspace } from '../types';
import { phaseLabels } from './labels';

type Ready = Extract<WeeklyDraftWorkspace, { status: 'ready' }>;
type Feedback = Pick<Ready, 'feedback' | 'failureReason'>;

// The frame's status row shows nothing in the normal state: no idle, saving
// or saved sentence, no glyphs. Saving is shown where it happens (fields,
// forms, Confirm buttons). Only a failed save and the other-player note
// appear here, as plain text at every size.

/** The exact failure sentence plus the safe server reason, when there is one. */
function saveFailureText(failureReason: Feedback['failureReason']) {
  const text = 'Changes could not be saved. The latest saved values are shown.';
  return failureReason ? `${text} ${failureReason}` : text;
}

/**
 * Rendered only while a save has failed: an alert (assertive, announced when
 * it appears) in red with the exact text. Nothing is mounted otherwise.
 */
export function SaveFailureAlert({ feedback, failureReason }: Feedback) {
  if (feedback !== 'failed') return null;
  return (
    <p
      role="alert"
      data-week-save-failure
      className="text-destructive min-w-0 text-sm"
    >
      {saveFailureText(failureReason)}
    </p>
  );
}

/** "Another player changed …" for the evidenced phases, in rules order. */
export function remoteChangeText(phases: readonly Phase[]) {
  const labels = phases.map((phase) => phaseLabels[phase]);
  const list =
    labels.length <= 1
      ? labels.join('')
      : `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`;
  return `Another player changed ${list}.`;
}

// WEEK-04: its own polite region that stays mounted, empty, so a later note
// is announced. The content is keyed by the batch sequence: a new accepted
// remote change in the same phase replaces the text node, so it is
// announced again although the words are identical; a rerender of the same
// batch changes nothing and stays silent. Focus is never moved.
export function RemoteChangeNote({
  change,
}: {
  change: Ready['remoteChange'];
}) {
  return (
    <p
      role="status"
      aria-live="polite"
      aria-atomic
      data-week-remote-note
      data-week-remote-sequence={change?.sequence}
      className="text-muted-foreground min-w-0 text-sm empty:hidden"
    >
      {change && change.phases.length > 0 && (
        <span key={change.sequence}>{remoteChangeText(change.phases)}</span>
      )}
    </p>
  );
}

// WEEK-19: after the successor arrives, every device shows the old week's
// notice once with the exact Finished weeks link. Transient client UI; the
// store owns when it appears and clears, this only renders and dismisses.
export function ConfirmedWeekNotice({
  notice,
  campaignId,
  dismiss,
}: {
  notice: Ready['confirmedWeek'];
  campaignId: string | null;
  dismiss: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic
      data-week-confirmed
      className="bg-accent/40 border-foreground/15 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-1.5 text-sm empty:hidden"
    >
      {notice && (
        <div
          key={notice.transitionId}
          className="contents"
          data-week-confirmed-transition={notice.transitionId}
        >
          <span>Week {notice.week} confirmed.</span>
          {campaignId && (
            <Button asChild variant="link" size="sm" className="h-auto p-0">
              <GuardedLink
                href={historyPath(campaignId, { week: notice.week })}
              >
                Open in Finished weeks
              </GuardedLink>
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Dismiss"
            className="ml-auto"
            onClick={dismiss}
          >
            <X aria-hidden />
          </Button>
        </div>
      )}
    </div>
  );
}
