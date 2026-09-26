'use client';
import {
  Check,
  CircleAlert,
  CircleDashed,
  Hourglass,
  Users,
  X,
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { historyPath } from '~/lib/campaign-routes';
import { cn } from '~/lib/utils';
import type { Phase, WeeklyDraftWorkspace } from '../types';
import { phaseLabels } from './labels';

type Ready = Extract<WeeklyDraftWorkspace, { status: 'ready' }>;
type Feedback = Pick<Ready, 'feedback' | 'failureReason'>;

// The one save/confirmation status (WEEK-06). Every message is the exact
// agreed sentence. Below 768px the sentences sit behind glyphs and the
// Status details button (see FeedbackDetails); from 768px they are visible.
const messages = {
  idle: { text: 'Prepare the week together.', Icon: CircleDashed },
  pending: { text: 'Saving changes…', Icon: Hourglass },
  saved: { text: 'Changes saved.', Icon: Check },
  failed: {
    text: 'Changes could not be saved. The latest saved values are shown.',
    Icon: CircleAlert,
  },
  confirming: { text: 'Confirming the week…', Icon: Hourglass },
} satisfies Record<Ready['feedback'], unknown>;

function feedbackText({ feedback, failureReason }: Feedback) {
  const { text } = messages[feedback];
  return feedback === 'failed' && failureReason
    ? `${text} ${failureReason}`
    : text;
}

/**
 * Ordinary feedback is one polite status that stays mounted so each change
 * is announced. A failure is an alert (assertive, announced when it appears)
 * in red with the same exact text plus the safe server reason; the polite
 * status is emptied meanwhile so nothing is announced twice. Exactly one of
 * the two carries `data-week-status` at any time.
 */
export function SaveStatus(props: Feedback) {
  const failed = props.feedback === 'failed';
  const { Icon } = messages[props.feedback];
  const text = feedbackText(props);
  return (
    <>
      <p
        role="status"
        aria-live="polite"
        aria-atomic
        data-week-status={failed ? undefined : ''}
        className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-sm empty:hidden"
      >
        {!failed && (
          <>
            <Icon aria-hidden className="size-4 shrink-0 md:hidden" />
            <span className="min-w-0 max-md:sr-only">{text}</span>
          </>
        )}
      </p>
      {failed && (
        <p
          role="alert"
          data-week-status=""
          data-week-status-failed=""
          className="text-destructive flex min-w-0 items-center gap-1.5 text-sm"
        >
          <Icon aria-hidden className="size-4 shrink-0 md:hidden" />
          <span className="min-w-0 max-md:sr-only">{text}</span>
        </p>
      )}
    </>
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

// Beside the status (WEEK-04): its own polite region so the save status
// helper stays specific. It stays mounted, empty, so a later note is
// announced. The content is keyed by the batch sequence: a new accepted
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
      className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-sm empty:hidden"
    >
      {change && change.phases.length > 0 && (
        <span key={change.sequence} className="contents">
          <Users aria-hidden className="size-4 shrink-0 md:hidden" />
          <span className="min-w-0 max-md:sr-only">
            {remoteChangeText(change.phases)}
          </span>
        </span>
      )}
    </p>
  );
}

/**
 * Below 768px the status and note are glyphs, so a sighted phone user gets
 * this button: "Not saved" is visible on failure, and the dialog shows the
 * full current status, its reason and the other-player note as plain text
 * (not a live region, so nothing is announced twice). Hidden from 768px,
 * where the sentences themselves are visible.
 */
export function FeedbackDetails({
  change,
  ...feedback
}: Feedback & { change: Ready['remoteChange'] }) {
  const failed = feedback.feedback === 'failed';
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={failed ? 'outline' : 'ghost'}
          size="sm"
          aria-label={
            failed ? 'Not saved. Show status details' : 'Show status details'
          }
          data-week-status-details
          className={cn(
            'short:h-7 md:hidden',
            failed && 'border-destructive text-destructive',
          )}
        >
          {failed ? (
            <span aria-hidden>Not saved</span>
          ) : (
            <CircleDashed aria-hidden />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Status</DialogTitle>
          <DialogDescription>
            Saving and other players&apos; changes in this week.
          </DialogDescription>
        </DialogHeader>
        <p
          data-week-status-detail
          className={cn('text-sm', failed && 'text-destructive')}
        >
          {feedbackText(feedback)}
        </p>
        {change && change.phases.length > 0 && (
          <p data-week-remote-detail className="text-sm">
            {remoteChangeText(change.phases)}
          </p>
        )}
      </DialogContent>
    </Dialog>
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
