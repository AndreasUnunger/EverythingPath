'use client';
import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { PhoneStatusStrip } from '~/components/campaign-shell/shell-slots';
import { cn } from '~/lib/utils';
import type { ReferenceFacts } from '../reference-facts';
import type { Phase, PhaseReadiness } from '../types';
import { phaseLabels, weekHeading } from './labels';
import { readinessLine } from './readiness-copy';
import {
  DockedReferencePanel,
  PhoneReferenceSheet,
  ReferencePanelToggle,
} from './reference-panel';
import { PhoneSteps, Stepper } from './steps';
import type { ReferencePanel } from './use-reference-panel';

export type WeekNavigation = { previous: Phase | null; next: Phase | null };

type Frame = {
  week: number;
  phase: Phase;
  phases: PhaseReadiness[];
  navigation: WeekNavigation;
  confirmationDisabledReason: string | null;
  choose: (phase: Phase) => void;
  /** The read-only reference facts and the surfaces' shared state. */
  reference: { facts: ReferenceFacts; panel: ReferencePanel };
};

// Previous/next never wrap: an endpoint keeps a disabled control so the
// footer keeps its shape. Names carry the direction so they never collide
// with the stepper's own phase buttons. The footer shows the target's label
// beside an arrow; the phone strip shows only a chevron.
const directions = {
  previous: { word: 'Previous', arrow: ArrowLeft, chevron: ChevronLeft },
  next: { word: 'Next', arrow: ArrowRight, chevron: ChevronRight },
};
function DirectionButton({
  direction,
  target,
  choose,
  compact,
}: {
  direction: keyof typeof directions;
  target: Phase | null;
  choose: (phase: Phase) => void;
  compact?: boolean;
}) {
  const { word, arrow, chevron } = directions[direction];
  const Icon = compact ? chevron : arrow;
  const label = target ? phaseLabels[target] : null;
  const content = [
    <Icon key="icon" aria-hidden />,
    !compact && label && (
      <span key="label" className="truncate">
        {label}
      </span>
    ),
  ];
  return (
    <Button
      variant={direction === 'next' && target ? 'default' : 'outline'}
      size={compact ? 'icon-lg' : 'lg'}
      aria-label={label ? `${word}: ${label}` : word}
      disabled={!target}
      onClick={() => target && choose(target)}
      className={cn(!compact && 'short:h-8 short:px-3 max-w-[40%] shrink')}
    >
      {direction === 'next' ? content.reverse() : content}
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
      className="bg-background/95 border-foreground/15 short:py-1 hidden shrink-0 items-center gap-3 border-t px-4 py-2.5 md:flex"
    >
      <DirectionButton
        direction="previous"
        target={frame.navigation.previous}
        choose={frame.choose}
      />
      <p
        data-week-readiness
        className="text-muted-foreground short:text-xs min-w-0 flex-1 text-center text-sm"
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
// The middle shows Training and Treasury now → after with the short
// readiness and opens the reference sheet; previous/next sit on its ends.
function Strip(frame: Frame) {
  const step = currentStep(frame);
  return (
    <PhoneStatusStrip>
      <div data-week-strip className="flex items-center gap-1 px-1 py-1">
        <DirectionButton
          direction="previous"
          target={frame.navigation.previous}
          choose={frame.choose}
          compact
        />
        {step && (
          <PhoneReferenceSheet
            phase={frame.phase}
            confirmationDisabledReason={frame.confirmationDisabledReason}
            facts={frame.reference.facts}
            step={step}
            panel={frame.reference.panel}
          />
        )}
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
 * status row with the setup-notes button and the panel toggle, the stepper
 * (tablet row / desktop rail / phone step button and sheet), the scrolling
 * editor with its footer, the docked reference panel beside them from
 * tablet width (a third column on desktop), and the phone strip.
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
  const step = currentStep(frame);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h1 className="sr-only">{weekHeading(frame.week, frame.phase)}</h1>
      <div className="short:pt-1 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 px-3 pt-2 md:px-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          {status}
        </div>
        {notes}
        <ReferencePanelToggle panel={frame.reference.panel} />
      </div>
      <PhoneSteps
        week={frame.week}
        phases={frame.phases}
        phase={frame.phase}
        choose={frame.choose}
      />
      <div className="flex min-h-0 flex-1 flex-col xl:grid xl:grid-cols-[15rem_minmax(0,1fr)_auto] xl:grid-rows-[minmax(0,1fr)]">
        <Stepper
          week={frame.week}
          phases={frame.phases}
          phase={frame.phase}
          choose={frame.choose}
          className="xl:border-foreground/15 short:pt-1 shrink-0 px-3 pt-2 md:px-4 xl:min-h-0 xl:overflow-y-auto xl:border-r xl:p-3"
        />
        {/* Tablet: editor column and panel side by side under the stepper.
            Desktop: the same two become the grid's middle and right columns. */}
        <div className="flex min-h-0 flex-1 xl:contents">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <main
              data-week-editor
              className="short:py-2 min-h-0 flex-1 overflow-y-auto px-3 py-3 md:px-5"
            >
              <div className="mx-auto w-full max-w-6xl">{children}</div>
            </main>
            <Footer {...frame} />
          </div>
          {step && (
            <DockedReferencePanel
              facts={frame.reference.facts}
              step={step}
              panel={frame.reference.panel}
            />
          )}
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
        <div className="md:grid md:grid-cols-[minmax(0,1fr)_20rem] md:gap-4 xl:grid-cols-[15rem_minmax(0,1fr)_20rem]">
          <div className="hidden flex-col gap-1 xl:flex">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
          <div className="hidden flex-col gap-3 md:flex">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
        </div>
        <Skeleton className="hidden h-12 w-full md:block" />
      </div>
    </div>
  );
}
