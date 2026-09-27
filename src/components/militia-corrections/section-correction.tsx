'use client';
import { useId, type ComponentType } from 'react';
import { Controller, FormProvider } from 'react-hook-form';
import { CircleAlert, TriangleAlert } from 'lucide-react';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import {
  PhoneStatusStrip,
  useShellSlotHost,
} from '~/components/campaign-shell/shell-slots';
import { SetupMilitiaValues } from '~/components/militia-setup/starting-point';
import { Button } from '~/components/ui/button';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import type { MilitiaSectionKey } from '~/lib/militia-correction-sections';
import { cn } from '~/lib/utils';
import {
  AFFECTS_WEEK_HEADING,
  CHECKING_MESSAGE,
  CONFLICT_HEADING,
  RESTART_FROM_THEIRS,
  RESTART_FROM_WEEK,
  SAVING_MESSAGE,
  WEEK_CHANGED_MESSAGE,
} from './correction-copy';
import { FactsView } from './facts-view';
import type { SectionCorrection } from './use-militia-corrections';

// The editor of each section with its own isolated correction. Sections
// missing here still open the temporary full editor.
export const sectionEditors: Partial<Record<MilitiaSectionKey, ComponentType>> =
  { values: SetupMilitiaValues };

const action = 'min-h-11 md:min-h-9';
const advisory = 'border-primary/40 bg-primary/10 space-y-1 border p-3';

/** Advisory rules warnings, on the read view and on an open correction. */
export function RulesWarnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <aside aria-label="Rules warnings" className={advisory}>
      <h3 className="text-sm font-semibold">Rules warnings</h3>
      {warnings.map((message) => (
        <p key={message} className="flex items-start gap-2 text-sm">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 [overflow-wrap:anywhere]">{message}</span>
        </p>
      ))}
    </aside>
  );
}

function AffectsWeek({ phases }: { phases: SectionCorrection['affectsWeek'] }) {
  if (phases.length === 0) return null;
  return (
    <aside aria-label={AFFECTS_WEEK_HEADING} className={advisory}>
      <h3 className="text-sm font-semibold">{AFFECTS_WEEK_HEADING}</h3>
      <ul role="list" className="space-y-1 text-sm">
        {phases.map((phase) => (
          <li key={phase.phase}>
            <GuardedLink
              href={phase.href}
              className="underline underline-offset-4"
            >
              {phase.label}
            </GuardedLink>{' '}
            ({phase.count} {phase.count === 1 ? 'choice' : 'choices'})
          </li>
        ))}
      </ul>
    </aside>
  );
}

function ErrorList({
  title,
  items,
  focusField,
}: {
  title: string;
  items: SectionCorrection['errors'];
  focusField: SectionCorrection['focusField'];
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1">
      <h4 className="text-sm font-medium">{title}</h4>
      <ul role="list" className="space-y-1 text-sm">
        {items.map(({ field, message }) => (
          <li key={`${field}:${message}`}>
            {field ? (
              <button
                type="button"
                className="min-h-11 text-left underline underline-offset-4 md:min-h-0"
                onClick={() => focusField(field)}
              >
                {message}
              </button>
            ) : (
              message
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ErrorSummary({ correction }: { correction: SectionCorrection }) {
  const { errors, focusField } = correction;
  if (errors.length === 0) return null;
  return (
    <div
      role="alert"
      className="border-destructive/60 text-destructive space-y-2 border p-3"
    >
      <h3 className="font-semibold">Fix these before saving</h3>
      <ErrorList
        title="Required"
        items={errors.filter((item) => item.kind === 'required')}
        focusField={focusField}
      />
      <ErrorList
        title="Invalid"
        items={errors.filter((item) => item.kind !== 'required')}
        focusField={focusField}
      />
    </div>
  );
}

function Notice({ correction }: { correction: SectionCorrection }) {
  const { view, notice } = correction;
  if (!notice) return null;
  const failed =
    view.kind === 'editing' &&
    (view.notice === 'rejected' || view.notice === 'unconfirmed');
  return (
    <p
      role="status"
      className={cn(
        'text-sm',
        failed ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {notice}
    </p>
  );
}

// The reason and Save/Cancel. Inline at the end of the form from 768px; on
// the phone in the shell's strip above the bottom tabs, which sits outside
// the form, so Save submits through `form={formId}`.
function ReasonBar({
  correction,
  formId,
  inStrip,
}: {
  correction: SectionCorrection;
  formId: string;
  inStrip: boolean;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const { view, reason } = correction;
  const editing = view.kind === 'editing';
  return (
    <div
      data-reason-bar
      className={cn('grid gap-3', inStrip && 'bg-background px-3 py-2')}
    >
      <div className="grid gap-1.5">
        <Label htmlFor={id}>{reason.label}</Label>
        <Controller
          control={correction.form.control}
          name="notes"
          render={({ field }) => (
            <Textarea
              {...field}
              ref={field.ref}
              id={id}
              rows={2}
              value={field.value ?? ''}
              disabled={!editing}
              aria-invalid={reason.error ? true : undefined}
              aria-describedby={reason.error ? errorId : undefined}
            />
          )}
        />
        {reason.error && (
          <p
            id={errorId}
            className="text-destructive flex items-start gap-1.5 text-sm"
          >
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 [overflow-wrap:anywhere]">
              {reason.error}
            </span>
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          form={formId}
          className={action}
          disabled={!editing}
        >
          {view.kind === 'saving' ? SAVING_MESSAGE : 'Save correction'}
        </Button>
        <Button
          type="button"
          variant="outline"
          className={action}
          disabled={!editing}
          onClick={correction.cancel}
        >
          Cancel
        </Button>
        {view.kind === 'checking' && (
          <p role="status" className="text-muted-foreground text-sm">
            {CHECKING_MESSAGE}
          </p>
        )}
      </div>
    </div>
  );
}

function Editor({
  correction,
  wide,
}: {
  correction: SectionCorrection;
  wide: boolean;
}) {
  const id = useId();
  const formId = `${id}-form`;
  const strip = useShellSlotHost('phone-status-strip');
  // Exactly one bar: the phone strip when the shell offers it, else inline.
  const inStrip = !wide && strip;
  const SectionEditor = sectionEditors[correction.entry];
  const { view } = correction;
  return (
    <FormProvider {...correction.form}>
      <form
        noValidate
        id={formId}
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          correction.save();
        }}
      >
        <fieldset
          disabled={view.kind !== 'editing'}
          className="min-w-0 space-y-4"
        >
          {SectionEditor && <SectionEditor />}
        </fieldset>
        <RulesWarnings warnings={correction.warnings} />
        <AffectsWeek phases={correction.affectsWeek} />
        <ErrorSummary correction={correction} />
        <Notice correction={correction} />
        {!inStrip && (
          <ReasonBar correction={correction} formId={formId} inStrip={false} />
        )}
      </form>
      {inStrip && (
        <PhoneStatusStrip>
          <ReasonBar correction={correction} formId={formId} inStrip />
        </PhoneStatusStrip>
      )}
    </FormProvider>
  );
}

function Conflict({ correction }: { correction: SectionCorrection }) {
  const id = useId();
  const theirsId = `${id}-theirs`;
  const yoursId = `${id}-yours`;
  const { comparison } = correction;
  return (
    <div className="space-y-4">
      <div role="alert">
        <h3 className="font-semibold">{CONFLICT_HEADING}</h3>
      </div>
      {comparison && (
        <div className="grid gap-4 md:grid-cols-2">
          <section
            aria-labelledby={theirsId}
            className="border-foreground/15 min-w-0 space-y-3 border p-3"
          >
            <h4 id={theirsId} className="font-medium">
              Their values
            </h4>
            <FactsView facts={comparison.theirs} />
          </section>
          <section
            aria-labelledby={yoursId}
            className="border-foreground/15 min-w-0 space-y-3 border p-3"
          >
            <h4 id={yoursId} className="font-medium">
              Your values
            </h4>
            <FactsView facts={comparison.yours} />
          </section>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" className={action} onClick={correction.restart}>
          {RESTART_FROM_THEIRS}
        </Button>
        <Button
          type="button"
          variant="outline"
          className={action}
          onClick={correction.cancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function WeekChanged({ correction }: { correction: SectionCorrection }) {
  return (
    <div className="space-y-4">
      <p role="alert">{WEEK_CHANGED_MESSAGE}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" className={action} onClick={correction.restart}>
          {RESTART_FROM_WEEK}
        </Button>
        <Button
          type="button"
          variant="outline"
          className={action}
          onClick={correction.cancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

// One section's correction in place of its read view: the editor, then the
// conflict comparison or the week-changed notice when the militia moved.
export function SectionCorrectionView({
  correction,
  wide,
}: {
  correction: SectionCorrection;
  wide: boolean;
}) {
  const { view } = correction;
  return (
    <section className="min-w-0 space-y-4">
      <h2 className="text-xl [overflow-wrap:anywhere]">{correction.heading}</h2>
      {view.kind === 'conflict' ? (
        <Conflict correction={correction} />
      ) : view.kind === 'weekChanged' ? (
        <WeekChanged correction={correction} />
      ) : (
        <Editor correction={correction} wide={wide} />
      )}
    </section>
  );
}
