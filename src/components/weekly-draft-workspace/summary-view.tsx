'use client';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { WeekReviewSections } from '~/components/week-review/week-review';
import { AddAdjustment, AdjustmentControls } from './summary-adjustments';
import { ExceptionControl } from './summary-exception-control';
import { summaryMessage } from './summary-messages';
import type { PhaseView, WeeklyDraftWorkspace } from './types';
type Summary = Extract<PhaseView, { phase: 'summary' }>;
export function SummaryView({
  view,
  edit,
  disabled,
  confirming = false,
  canConfirm,
  forecastPending,
  reviewRequired,
  confirm,
  review,
}: {
  view: Summary;
  edit: Extract<WeeklyDraftWorkspace, { status: 'ready' }>['edit'];
  disabled: boolean;
  /** This device's Confirmation is in flight until the next week is usable. */
  confirming?: boolean;
  canConfirm: boolean;
  forecastPending: boolean;
  reviewRequired: boolean;
  confirm: () => void;
  review: () => void;
}) {
  return (
    <div className="min-w-0 space-y-4 [&_button]:h-auto [&_button]:min-h-9 [&_button]:max-w-full [&_button]:break-words [&_button]:whitespace-normal">
      <Card className="min-w-0 space-y-3 p-5">
        <h2 className="text-lg font-semibold">Review the week</h2>
        <p>
          {forecastPending
            ? 'Review will be ready when your changes are saved.'
            : view.ready
              ? 'The week is ready for confirmation.'
              : 'Some rolls or decisions still need attention.'}
        </p>
        {view.requirements.length > 0 && (
          <section aria-label="Required decisions">
            <h3 className="font-medium">Required decisions</h3>
            <ul className="list-disc space-y-1 pl-5">
              {view.requirements.map((item) => (
                <li key={item}>{summaryMessage(item, view)}</li>
              ))}
            </ul>
          </section>
        )}
        {reviewRequired && (
          <>
            <p role="alert">
              The week could not be confirmed as reviewed. Review the updated
              outcomes and table decisions before trying again.
            </p>
            <Button disabled={disabled || forecastPending} onClick={review}>
              Review updated week
            </Button>
          </>
        )}
        <Button
          disabled={!canConfirm || disabled}
          aria-busy={confirming || undefined}
          onClick={confirm}
        >
          {confirming ? 'Confirming…' : 'Confirm week'}
        </Button>
        <p className="text-muted-foreground text-xs">
          Confirmation applies the entire prepared week. These outcomes remain a
          preview until then.
        </p>
      </Card>
      <Card className="min-w-0 space-y-3 p-5">
        <h2 className="text-lg font-semibold">Warnings</h2>
        {view.warnings.length === 0 ? (
          <p>No rules warnings.</p>
        ) : (
          <ul className="list-disc space-y-2 pl-5">
            {[...new Set(view.warnings)].map((warning) => (
              <li key={warning}>{summaryMessage(warning, view, true)}</li>
            ))}
          </ul>
        )}
      </Card>
      <WeekReviewSections
        facts={view.review}
        capabilities={{
          exception: (note) => (
            <ExceptionControl note={note} edit={edit} disabled={disabled} />
          ),
          adjustment: (_adjustment, index) => (
            <AdjustmentControls
              view={view}
              edit={edit}
              disabled={disabled}
              index={index}
            />
          ),
          addAdjustment: (
            <AddAdjustment view={view} edit={edit} disabled={disabled} />
          ),
        }}
      />
    </div>
  );
}
