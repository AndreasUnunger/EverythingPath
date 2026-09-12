'use client';
import { z } from 'zod';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import {
  StructuredChoiceField,
  choiceFieldLabel,
} from './structured-choice-field';
import { SummaryAdjustments } from './summary-adjustments';
import { SummaryOutcome, SummaryFacts } from './summary-outcome';
import { summaryMessage } from './summary-messages';
import type { PhaseView, WeeklyDraftWorkspace } from './types';
type Summary = Extract<PhaseView, { phase: 'summary' }>;
export function SummaryView({
  view,
  edit,
  disabled,
  canConfirm,
  forecastPending,
  reviewRequired,
  confirm,
  review,
}: {
  view: Summary;
  edit: Extract<WeeklyDraftWorkspace, { status: 'ready' }>['edit'];
  disabled: boolean;
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
        <Button disabled={!canConfirm || disabled} onClick={confirm}>
          Confirm week
        </Button>
        <p className="text-muted-foreground text-xs">
          Confirmation applies the entire prepared week. These outcomes remain a
          preview until then.
        </p>
      </Card>
      <Card className="min-w-0 p-5">
        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          <SummaryOutcome
            title="Rules Baseline"
            state={view.baseline}
            view={view}
          />
          <SummaryOutcome
            title="Final preview"
            state={view.outcome}
            view={view}
          />
        </div>
      </Card>
      <Card className="min-w-0 space-y-3 p-5">
        <h2 className="text-lg font-semibold">Rules Exceptions</h2>
        <p className="text-muted-foreground text-sm">
          A reason permits an unusual choice. It does not change the rules
          calculation.
        </p>
        {view.exceptions.length === 0 && <p>No Rules Exceptions.</p>}
        {view.exceptions.map((exception) => (
          <section
            key={exception.exceptionId}
            className="min-w-0 space-y-2 rounded-md border p-3"
          >
            <h3 className="font-medium">
              {exception.name} ·{' '}
              {choiceFieldLabel(exception.ruleId.replaceAll('-', '_'))}
            </h3>
            <StructuredChoiceField
              name="exceptionReason"
              schema={z.string().trim().min(1, 'A reason is required.')}
              value={exception.reason || undefined}
              options={{}}
              disabled={disabled}
              onValue={(reason) => {
                if (reason === undefined) {
                  void edit({
                    kind: 'clear_rules_exception',
                    exceptionId: exception.exceptionId,
                  });
                  return false;
                }
                if (typeof reason === 'string')
                  void edit({
                    kind: 'rules_exception',
                    exception: {
                      exceptionId: exception.exceptionId,
                      subjectId: exception.subjectId,
                      ruleId: exception.ruleId,
                      reason,
                    },
                  });
              }}
            />
          </section>
        ))}
      </Card>
      <Card className="min-w-0 p-5">
        <SummaryAdjustments view={view} edit={edit} disabled={disabled} />
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
      <Card className="min-w-0 space-y-3 p-5">
        <h2 className="text-lg font-semibold">Weekly consequences</h2>
        <p className="text-muted-foreground text-sm">
          Ordered effects explain gains, losses, removals and narrative
          decisions included in the preview.
        </p>
        {view.effects &&
          Object.entries(view.effects).map(([phase, effects]) => (
            <details key={phase} className="min-w-0 rounded-md border p-3">
              <summary className="cursor-pointer font-medium">
                {choiceFieldLabel(phase)}
              </summary>
              <div className="mt-2 min-w-0">
                <SummaryFacts value={effects} field={phase} view={view} />
              </div>
            </details>
          ))}
      </Card>
      <Card className="min-w-0 space-y-3 p-5">
        <h2 className="text-lg font-semibold">Recorded table outcomes</h2>
        {view.acknowledgements.length === 0 ? (
          <p>No narrative outcomes recorded.</p>
        ) : (
          view.acknowledgements.map((item) => (
            <div key={item.acknowledgementId} className="break-words">
              <h3 className="font-medium">{item.name}</h3>
              <p>{item.outcome}</p>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
