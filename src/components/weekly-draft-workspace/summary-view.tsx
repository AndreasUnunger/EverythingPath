'use client';
import { useId, useMemo } from 'react';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { WeekReviewSections } from '~/components/week-review/week-review';
import {
  adjustmentTargets,
  type TableAdjustment,
} from './summary-adjustment-form';
import { AdjustmentRow } from './summary-adjustment-row';
import { AddAdjustment } from './summary-adjustments';
import { ExceptionControl } from './summary-exception-control';
import { summaryMessage } from './summary-messages';
import type { PhaseView, WeeklyDraftWorkspace } from './types';
import {
  focusLocalForm,
  removedAdjustmentDrafts,
  useForgetGoneExceptions,
  type LocalFormGuard,
} from './use-summary-forms';
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
  localForms = [],
  localFormGuard,
  latestAdjustments,
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
  /** This device's open or invalid local forms, each a Required decision. */
  localForms?: { id: string; message: string }[];
  /** The Workspace's Confirm guard for this device's local forms. */
  localFormGuard?: LocalFormGuard;
  /** The latest ordered Table Adjustments this device knows, read at Save time. */
  latestAdjustments?: () => readonly TableAdjustment[];
}) {
  const targets = useMemo(() => adjustmentTargets(view), [view]);
  const latest = latestAdjustments ?? (() => view.adjustments);
  const guard = localFormGuard;
  const removedDrafts = removedAdjustmentDrafts(
    guard,
    localForms,
    view.adjustments,
  );
  useForgetGoneExceptions(guard, localForms, view.exceptions);
  const subjectOf = (exceptionId: string) =>
    view.exceptions.find((exception) => exception.exceptionId === exceptionId)
      ?.name ?? 'Rules Exception';
  const localFormId = useId();
  const count = view.review.adjustments.length;
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
        {(view.requirements.length > 0 || localForms.length > 0) && (
          <section aria-label="Required decisions">
            <h3 className="font-medium">Required decisions</h3>
            <ul className="list-disc space-y-1 pl-5">
              {view.requirements.map((item) => (
                <li key={item}>{summaryMessage(item, view)}</li>
              ))}
              {localForms.map((form, index) => {
                const messageId = `${localFormId}-${index}`;
                return (
                  <li
                    key={form.id}
                    className="min-w-0 [overflow-wrap:anywhere]"
                  >
                    <span id={messageId}>{form.message}</span>{' '}
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      aria-describedby={messageId}
                      className="h-auto min-h-0 px-1 py-0 text-sm"
                      onClick={() => focusLocalForm(form.id)}
                    >
                      Go to form
                    </Button>
                  </li>
                );
              })}
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
            <ExceptionControl
              note={note}
              subject={subjectOf(note.exceptionId)}
              edit={edit}
              guard={guard}
              disabled={disabled}
            />
          ),
          adjustment: (adjustment, index) => {
            const accepted = view.adjustments.find(
              (item) => item.adjustmentId === adjustment.adjustmentId,
            );
            if (!accepted) return null;
            return (
              <AdjustmentRow
                adjustment={adjustment}
                index={index}
                count={count}
                accepted={accepted}
                targets={targets}
                latest={latest}
                edit={edit}
                guard={guard}
                disabled={disabled}
              />
            );
          },
          addAdjustment: (
            <AddAdjustment
              targets={targets}
              latest={latest}
              edit={edit}
              guard={guard}
              disabled={disabled}
              localForms={localForms}
              removedDrafts={removedDrafts}
            />
          ),
        }}
      />
    </div>
  );
}
