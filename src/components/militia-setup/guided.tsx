'use client';
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  Flag,
  TriangleAlert,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { FormProvider } from 'react-hook-form';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';
import { warningText, wrap } from '~/components/week-review/review-parts';
import { SETUP_SECTIONS, type SetupSectionMessage } from '~/lib/setup-sections';
import type { SetupStep } from '~/lib/setup-steps';
import { cn } from '~/lib/utils';
import { SetupModeChoice } from './starting-point';
import { SetupNotes, SetupStepEditor } from './step-editors';
import {
  useGuidedSetup,
  type GuidedSetup,
  type GuidedSetupProps,
} from './use-guided-setup';

const eyebrow = 'text-muted-foreground text-xs tracking-widest uppercase';

// Guided Militia Setup: nine steps over one form. Below 768px every step is
// an accordion row; from 768px a step index sits beside one detail pane.
export function GuidedMilitiaSetup(props: GuidedSetupProps) {
  const g = useGuidedSetup(props);
  return (
    <FormProvider {...g.form}>
      <div {...g.rootProps} data-setup-layout={g.layout} className="min-w-0">
        <form
          noValidate
          onSubmit={(event) => event.preventDefault()}
          className="[&_button]:h-auto [&_button]:min-h-9 [&_button]:max-w-full [&_button]:[overflow-wrap:anywhere] [&_button]:whitespace-normal [&_fieldset]:min-w-0"
        >
          <fieldset disabled={g.pending} className="min-w-0">
            {g.layout === 'wide' ? <WideSetup g={g} /> : <PhoneSetup g={g} />}
          </fieldset>
        </form>
      </div>
    </FormProvider>
  );
}

// ---------- shared pieces ----------

// Decorative: the caption beside it says the same in words. The empty column
// keeps labels aligned. On the selected row the glyph takes the row's colour.
function StepGlyph({ step, current }: { step: SetupStep; current?: boolean }) {
  const tone = (colour: string) => (current ? undefined : colour);
  return (
    <span aria-hidden className="mt-0.5 flex size-4 shrink-0 items-center">
      {step.key === 'review' ? (
        <Flag className="size-4" />
      ) : step.state === 'error' ? (
        <CircleAlert className={cn('size-4', tone('text-destructive'))} />
      ) : step.state === 'warning' ? (
        <TriangleAlert className={cn('size-4', tone(warningText))} />
      ) : step.state === 'done' ? (
        <Check className="size-4" />
      ) : null}
    </span>
  );
}

function LinkButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-visible:ring-ring/50 inline-flex items-center text-left underline decoration-current/60 underline-offset-4 outline-none hover:decoration-current focus-visible:ring-[3px]"
    >
      {children}
    </button>
  );
}

// One warning, linked to its field when it names one. Lines share the
// 36px row height of the form's buttons so the glyph meets the first line.
function WarningLine({
  warning,
  open,
}: {
  warning: SetupSectionMessage;
  open: GuidedSetup['openProblem'];
}) {
  return (
    <p className={cn('flex gap-2 text-sm', warningText)}>
      <TriangleAlert aria-hidden className="mt-2.5 size-4 shrink-0" />
      <span className={cn('flex min-h-9 items-center', wrap)}>
        <span className="sr-only">Warning: </span>
        {warning.field ? (
          <LinkButton onClick={() => open(warning)}>
            {warning.message}
          </LinkButton>
        ) : (
          warning.message
        )}
      </span>
    </p>
  );
}

function WarningList({
  warnings,
  open,
  label,
}: {
  warnings: SetupSectionMessage[];
  open: GuidedSetup['openProblem'];
  label?: string;
}) {
  return (
    <ul aria-label={label} className="space-y-0.5">
      {warnings.map((warning) => (
        <li key={`${warning.field ?? ''}:${warning.message}`}>
          <WarningLine warning={warning} open={open} />
        </li>
      ))}
    </ul>
  );
}

function StepWarnings({ g }: { g: GuidedSetup }) {
  if (g.current.warnings.length === 0) return null;
  return (
    <WarningList
      label="Rules warnings"
      warnings={g.current.warnings}
      open={g.openProblem}
    />
  );
}

function StepBody({ g }: { g: GuidedSetup }) {
  const { current } = g;
  if (current.key === 'review') return <ReviewBody g={g} />;
  return (
    <>
      <StepWarnings g={g} />
      <SetupStepEditor step={current.key} characters={g.characters} />
    </>
  );
}

// Next step, or on Review the start action.
function ForwardButton({
  g,
  className,
}: {
  g: GuidedSetup;
  className?: string;
}) {
  if (!g.next)
    return (
      <Button
        type="button"
        id={g.ids.next}
        size="lg"
        onClick={g.start}
        disabled={g.pending}
        className={className}
      >
        <Flag aria-hidden />
        {g.pending ? 'Starting militia…' : 'Start militia week'}
      </Button>
    );
  return (
    <Button
      type="button"
      id={g.ids.next}
      onClick={g.goNext}
      className={className}
    >
      Next: {g.next.label}
      <ArrowRight aria-hidden />
    </Button>
  );
}

// ---------- Review & start ----------

function ErrorSummary({ g }: { g: GuidedSetup }) {
  const n = g.summary.length;
  return (
    <div
      id={g.ids.summary}
      tabIndex={-1}
      role="alert"
      className="border-destructive/60 bg-destructive/10 focus-visible:ring-destructive/40 space-y-1 border p-3 outline-none focus-visible:ring-[3px]"
    >
      <h3 className="text-base font-medium">
        {n} {n === 1 ? 'thing' : 'things'} to fix before starting
      </h3>
      <ul className="space-y-0.5 text-sm">
        {g.summary.map((error) => (
          <li
            key={`${error.field ?? ''}:${error.message}`}
            className={cn('flex flex-wrap items-center gap-x-1', wrap)}
          >
            {error.section ? (
              <>
                <LinkButton onClick={() => g.openProblem(error)}>
                  {error.message}
                </LinkButton>
                <span className="text-muted-foreground">
                  · {SETUP_SECTIONS[error.section]}
                </span>
              </>
            ) : (
              error.message
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewBody({ g }: { g: GuidedSetup }) {
  const warned = g.steps.filter((step) => step.warnings.length > 0);
  return (
    <div className="space-y-6">
      {g.summary.length > 0 && <ErrorSummary g={g} />}
      <section className="space-y-1">
        <h3 className={eyebrow}>Warnings by step</h3>
        {warned.length === 0 ? (
          <p className="text-sm">None.</p>
        ) : (
          warned.map((step) => (
            <div key={step.key} className="text-sm">
              <LinkButton onClick={() => g.openProblem({ section: step.key })}>
                {step.label}
              </LinkButton>
              <WarningList warnings={step.warnings} open={g.openProblem} />
            </div>
          ))
        )}
      </section>
      <SetupNotes />
      {g.submitError && (
        <p role="alert" className="text-destructive text-sm">
          {g.submitError}
        </p>
      )}
    </div>
  );
}

// ---------- wide: index and detail ----------

// Its accessible name is exactly the step label; the status caption is its
// description. From 1280px a preview of the entered values sits under the
// label.
function StepButton({ g, step }: { g: GuidedSetup; step: SetupStep }) {
  const id = g.ids.header(step.key);
  const current = step.key === g.current.key;
  const preview = g.preview(step.key);
  return (
    <Button
      type="button"
      variant="ghost"
      id={id}
      aria-current={current ? 'step' : undefined}
      aria-labelledby={`${id}-label`}
      aria-describedby={step.caption ? `${id}-caption` : undefined}
      onClick={() => g.select(step.key)}
      className={cn(
        'h-auto min-h-10 w-full items-start justify-start rounded-none px-2 py-2 text-left font-normal whitespace-normal',
        current &&
          'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
      )}
    >
      <StepGlyph step={step} current={current} />
      {/* Labels wrap between words only; the caption folds onto two lines. */}
      <span className="flex-1 leading-tight break-normal">
        <span id={`${id}-label`} className="block text-sm">
          {step.label}
        </span>
        {preview && (
          <span
            className={cn(
              'mt-0.5 hidden text-xs xl:block',
              current ? 'opacity-80' : 'text-muted-foreground',
              wrap,
            )}
          >
            {preview}
          </span>
        )}
      </span>
      {step.caption && (
        <span
          id={`${id}-caption`}
          className={cn(
            'shrink text-right text-xs leading-tight break-normal',
            current ? 'opacity-80' : 'text-muted-foreground',
          )}
        >
          {step.caption}
        </span>
      )}
    </Button>
  );
}

function WideSetup({ g }: { g: GuidedSetup }) {
  const { current } = g;
  return (
    <div className="grid gap-6 md:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)]">
      <div className="space-y-4 md:border-r md:pr-4">
        <SetupModeChoice />
        <nav aria-label="Setup steps">
          <ol className="space-y-0.5">
            {g.steps.map((step, index) => (
              <li key={step.key}>
                {step.optional && !g.steps[index - 1]?.optional && (
                  <p className={cn(eyebrow, 'mt-3 mb-1 px-2')}>Optional</p>
                )}
                {step.key === 'review' && <Separator className="my-2" />}
                <StepButton g={g} step={step} />
              </li>
            ))}
          </ol>
        </nav>
      </div>
      <div className="flex min-w-0 flex-col">
        <div className="flex-1 space-y-4">
          <h2
            id={g.ids.heading(current.key)}
            tabIndex={-1}
            className="focus-visible:ring-ring/50 text-2xl font-bold outline-none focus-visible:ring-[3px]"
          >
            {current.label}
          </h2>
          <StepBody g={g} />
        </div>
        <footer className="bg-background sticky bottom-0 mt-6 flex justify-end border-t py-3">
          <ForwardButton g={g} />
        </footer>
      </div>
    </div>
  );
}

// ---------- phone: accordion rows ----------

function PhoneRow({ g, step }: { g: GuidedSetup; step: SetupStep }) {
  const id = g.ids.header(step.key);
  const open = step.key === g.current.key;
  return (
    <li className="border-b">
      <h2 className="text-base font-normal">
        <Button
          type="button"
          variant="ghost"
          id={id}
          aria-expanded={open}
          aria-controls={g.ids.panel(step.key)}
          aria-labelledby={`${id}-label`}
          aria-describedby={step.caption ? `${id}-caption` : undefined}
          onClick={() => g.select(step.key)}
          className={cn(
            'h-auto min-h-12 w-full items-start justify-start rounded-none px-2 py-3 text-left font-normal whitespace-normal',
            open && 'bg-primary/10',
          )}
        >
          <StepGlyph step={step} />
          <span className="flex-1 text-sm leading-tight break-normal">
            <span aria-hidden>{step.number}. </span>
            <span id={`${id}-label`}>{step.label}</span>
          </span>
          {step.caption && (
            <span
              id={`${id}-caption`}
              className="text-muted-foreground shrink text-right text-xs leading-tight break-normal"
            >
              {step.caption}
            </span>
          )}
          <ChevronDown
            aria-hidden
            className={cn(
              'size-4 shrink-0 opacity-60 transition-transform',
              open && 'rotate-180',
            )}
          />
        </Button>
      </h2>
      {open && (
        <div
          id={g.ids.panel(step.key)}
          role="region"
          aria-labelledby={`${id}-label`}
          className="space-y-4 px-2 pt-2 pb-4"
        >
          <StepBody g={g} />
          <ForwardButton g={g} className="w-full" />
        </div>
      )}
    </li>
  );
}

function PhoneSetup({ g }: { g: GuidedSetup }) {
  return (
    <div className="space-y-4">
      <SetupModeChoice />
      <ol className="border-t">
        {g.steps.map((step) => (
          <PhoneRow key={step.key} g={g} step={step} />
        ))}
      </ol>
    </div>
  );
}
