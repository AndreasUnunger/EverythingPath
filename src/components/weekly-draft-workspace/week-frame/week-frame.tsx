'use client';
import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { PhoneStatusStrip } from '~/components/campaign-shell/shell-slots';
import { cn } from '~/lib/utils';
import type { Phase, PhaseReadiness } from '../types';
import { phaseLabels, weekHeading } from './labels';
import { readinessLine } from './readiness-copy';
import { PhoneSteps, Stepper } from './steps';

export type WeekNavigation = { previous: Phase | null; next: Phase | null };

type Frame = {
  week: number;
  phase: Phase;
  phases: PhaseReadiness[];
  navigation: WeekNavigation;
  confirmationDisabledReason: string | null;
  choose: (phase: Phase) => void;
};

// Previous/next never wrap: an endpoint keeps a disabled control so the
// footer keeps its shape. Names carry the direction so they never collide
// with the stepper's own phase buttons.
function DirectionButton({
  direction,
  target,
  choose,
  compact,
}: {
  direction: 'previous' | 'next';
  target: Phase | null;
  choose: (phase: Phase) => void;
  compact?: boolean;
}) {
  const word = direction === 'previous' ? 'Previous' : 'Next';
  const label = target ? `${word}: ${phaseLabels[target]}` : word;
  const Icon = compact
    ? direction === 'previous'
      ? ChevronLeft
      : ChevronRight
    : direction === 'previous'
      ? ArrowLeft
      : ArrowRight;
  return (
    <Button
      variant={direction === 'next' && target ? 'default' : 'outline'}
      size={compact ? 'icon-lg' : 'lg'}
      aria-label={label}
      disabled={!target}
      onClick={() => target && choose(target)}
      className={cn(!compact && 'max-w-[40%] shrink')}
    >
      {direction === 'previous' && <Icon aria-hidden />}
      {!compact && target && (
        <span className="truncate">{phaseLabels[target]}</span>
      )}
      {direction === 'next' && <Icon aria-hidden />}
    </Button>
  );
}

function currentStep(frame: Frame) {
  return frame.phases.find((step) => step.phase === frame.phase);
}

// Tablet and desktop: pinned under the phase content. The readiness line is
// plain text (not a live region) so the shell's single save status stays the
// only announced status; counts change too often to announce while typing.
function Footer(frame: Frame) {
  const step = currentStep(frame);
  return (
    <footer
      data-week-footer
      className="bg-background/95 border-foreground/15 sticky bottom-0 z-30 hidden shrink-0 items-center gap-3 border-t px-4 py-2.5 backdrop-blur md:flex xl:static"
    >
      <DirectionButton
        direction="previous"
        target={frame.navigation.previous}
        choose={frame.choose}
      />
      <p
        data-week-readiness
        className="text-muted-foreground min-w-0 flex-1 text-center text-sm"
      >
        {step ? readinessLine(step, frame.confirmationDisabledReason) : ''}
      </p>
      <DirectionButton
        direction="next"
        target={frame.navigation.next}
        choose={frame.choose}
      />
    </footer>
  );
}

// Phone: fills the shell's strip host immediately above the bottom tabs.
// The reference values and the sheet that opens from the middle belong to
// the reference panel delivery; until then the middle is the readiness line.
function Strip(frame: Frame) {
  const step = currentStep(frame);
  return (
    <PhoneStatusStrip>
      <div className="flex items-center gap-1 px-1 py-1">
        <DirectionButton
          direction="previous"
          target={frame.navigation.previous}
          choose={frame.choose}
          compact
        />
        <p
          data-week-readiness
          className="text-muted-foreground min-w-0 flex-1 truncate text-center text-sm"
        >
          {step ? readinessLine(step, frame.confirmationDisabledReason) : ''}
        </p>
        <DirectionButton
          direction="next"
          target={frame.navigation.next}
          choose={frame.choose}
          compact
        />
      </div>
    </PhoneStatusStrip>
  );
}

/**
 * The shared frame around one mounted phase editor: an accessible heading
 * (the visible week and step live in the shell tab and the stepper), the
 * status row, the stepper (tablet row / desktop rail / phone step button
 * and sheet), the scrolling editor and the footer or phone strip.
 */
export function WeekFrame({
  status,
  notes,
  children,
  ...frame
}: Frame & {
  status: ReactNode;
  notes?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h1 className="sr-only">{weekHeading(frame.week, frame.phase)}</h1>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 pt-2 md:px-4">
        {status}
      </div>
      {notes}
      <PhoneSteps
        week={frame.week}
        phases={frame.phases}
        phase={frame.phase}
        choose={frame.choose}
      />
      <div className="flex min-h-0 flex-1 flex-col xl:grid xl:grid-cols-[15rem_minmax(0,1fr)] xl:grid-rows-[minmax(0,1fr)]">
        <Stepper
          week={frame.week}
          phases={frame.phases}
          phase={frame.phase}
          choose={frame.choose}
          className="xl:border-foreground/15 shrink-0 px-3 pt-2 md:px-4 xl:min-h-0 xl:overflow-y-auto xl:border-r xl:p-3"
        />
        <div className="flex min-h-0 flex-1 flex-col">
          <main className="min-h-0 flex-1 px-3 py-3 md:px-5 xl:overflow-y-auto">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
          <Footer {...frame} />
        </div>
      </div>
      <Strip {...frame} />
    </div>
  );
}

/** Loading: the frame's shape inside the already-rendered shell. */
export function WeekSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-week-skeleton>
      <p role="status" className="sr-only">
        Loading the week…
      </p>
      <div aria-hidden className="flex flex-col gap-3 px-3 pt-3 md:px-4">
        <Skeleton className="h-11 w-full md:hidden" />
        <div className="hidden gap-1 md:flex xl:hidden">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-12 flex-1" />
          ))}
        </div>
        <div className="xl:grid xl:grid-cols-[15rem_minmax(0,1fr)] xl:gap-4">
          <div className="hidden flex-col gap-1 xl:flex">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
        <Skeleton className="hidden h-12 w-full md:block" />
      </div>
    </div>
  );
}
