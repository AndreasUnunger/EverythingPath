'use client';
// PROTOTYPE — Variant B "Bottom bar and sheets": phone gets an app-style
// frame. The sections move to a bottom tab bar (with a More tab holding the
// organization and account), the stepper collapses to one "Step 2 of 5" button
// that opens a sheet listing every step with its readiness, and the reference
// panel becomes a status strip above the bottom bar (previous/next arrows on
// its ends) that opens a bottom sheet with the values and This phase.
// Tablet: the settled layout. Desktop: three columns, the stepper standing
// down the left as a rail, the phase body scrolling in the middle, the panel
// on the right; the page itself never scrolls.

import { ArrowLeft, ArrowRight, ChevronDown, ChevronLeft, ChevronRight, History, LayoutGrid, MoreHorizontal, Shield, Users } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '~/components/ui/sheet';
import { cn } from '~/lib/utils';
import { phaseLabels, sections } from './model';
import {
  Account,
  Brand,
  CampaignSwitcher,
  MaintenanceBanner,
  OrganizationSwitcher,
  PhaseBody,
  readinessLine,
  ReferenceGist,
  ReferenceValues,
  RemoteNote,
  SaveStatus,
  StepGlyph,
  ThisPhase,
  usePrevNext,
  type VariantProps,
} from './parts';

export const name = 'Bottom bar and sheets';

const sectionIcons = [LayoutGrid, History, Shield, Users];

export function VariantB({ model, knobs, phase, setPhase }: VariantProps) {
  const { prev, next, index, total } = usePrevNext(model, phase);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const current = model.steps.find((s) => s.key === phase)!;

  const stepButton = (s: (typeof model.steps)[number], layout: 'row' | 'rail') => {
    const active = s.key === phase;
    return (
      <button
        key={s.key}
        disabled={s.locked}
        aria-current={active ? 'step' : undefined}
        onClick={() => {
          setPhase(s.key);
          setStepsOpen(false);
        }}
        className={cn(
          'flex min-h-12 items-center gap-2 border px-3 text-left disabled:opacity-40',
          layout === 'row' ? 'flex-1' : 'w-full',
          active ? 'bg-primary text-primary-foreground border-primary' : 'border-foreground/25 hover:bg-foreground/10',
        )}
      >
        <StepGlyph step={s} active={active} />
        <span className="min-w-0 leading-tight">
          <span className="block text-sm">{s.label}</span>
          <span className={cn('block text-xs', active ? 'opacity-80' : 'text-muted-foreground')}>{s.caption}</span>
        </span>
      </button>
    );
  };

  return (
    <div className="flex h-svh flex-col">
      <header className="bg-sidebar shrink-0 border-b">
        <MaintenanceBanner knobs={knobs} />
        <div className="flex items-center gap-2 px-3 py-1.5 md:gap-4 md:px-4 md:py-2">
          <Brand />
          <span className="text-muted-foreground hidden md:inline">/</span>
          <CampaignSwitcher compact />
          <nav aria-label="Sections" className="hidden gap-1 text-sm md:flex">
            {sections.map((s, i) => (
              <span key={s.key} className={cn('px-3 py-1.5 whitespace-nowrap', i === 0 ? 'bg-background rounded-md shadow-sm' : 'text-muted-foreground')}>
                {s.label}
              </span>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 md:gap-3">
            <RemoteNote knobs={knobs} compact />
            <span className="hidden md:inline-flex">
              <RemoteNote knobs={knobs} />
            </span>
            <SaveStatus knobs={knobs} compact />
            <span className="hidden md:inline-flex">
              <OrganizationSwitcher />
            </span>
            <span className="hidden md:inline-flex">
              <Account />
            </span>
          </div>
        </div>
        {/* Phone: one button for the stepper, plus a five-segment progress line. */}
        <div className="px-3 pb-2 md:hidden">
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setStepsOpen(true)}
            className="bg-primary text-primary-foreground flex min-h-11 w-full items-center gap-2 px-3 text-left"
          >
            <StepGlyph step={current} active />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block text-sm">
                Step {index + 1} of {total} · {current.label}
              </span>
              <span className="block truncate text-xs opacity-80">{current.caption}</span>
            </span>
            <ChevronDown className="size-4 shrink-0" />
          </button>
          <ol className="mt-1 flex gap-1" aria-hidden>
            {model.steps.map((s) => (
              <li key={s.key} className={cn('h-1 flex-1', s.key === phase ? 'bg-primary' : s.locked ? 'bg-foreground/10' : s.count ? 'bg-foreground/30' : 'bg-emerald-400/60')} />
            ))}
          </ol>
        </div>
        {/* Tablet: the settled full-width stepper. Desktop moves it to the rail. */}
        <nav aria-label="Week phases" className="hidden px-4 pb-2 md:block xl:hidden">
          <ol className="flex items-stretch">
            {model.steps.map((s, i) => (
              <li key={s.key} className="flex flex-1 items-center">
                {stepButton(s, 'row')}
                {i < model.steps.length - 1 && <span className="bg-foreground/30 h-px w-3 shrink-0" />}
              </li>
            ))}
          </ol>
        </nav>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav aria-label="Week phases" className="bg-sidebar hidden w-60 shrink-0 flex-col gap-1 overflow-y-auto border-r p-3 xl:flex">
          <p className="text-muted-foreground px-1 pb-1 text-xs tracking-widest uppercase">Week 14</p>
          {model.steps.map((s) => stepButton(s, 'rail'))}
        </nav>
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="min-h-0 flex-1 overflow-y-auto px-3 py-3 md:px-5">
            <div className="mx-auto max-w-4xl">
              <PhaseBody model={model} knobs={knobs} phase={phase} />
            </div>
          </main>
          {/* Tablet and desktop footer. On phone the strip below does its job. */}
          <footer className="bg-background/95 border-foreground/15 hidden shrink-0 items-center gap-3 border-t px-5 py-2.5 backdrop-blur md:flex">
            <Button variant="outline" size="lg" disabled={!prev} onClick={() => prev && setPhase(prev.key)}>
              <ArrowLeft /> {prev ? phaseLabels[prev.key] : 'Back'}
            </Button>
            <p className="text-muted-foreground flex-1 text-center text-sm">{readinessLine(model, phase)}</p>
            {next ? (
              <Button size="lg" onClick={() => setPhase(next.key)}>
                {phaseLabels[next.key]} <ArrowRight />
              </Button>
            ) : (
              <span className="w-32" />
            )}
          </footer>
        </div>
        <aside className="bg-sidebar hidden w-72 shrink-0 space-y-3 overflow-y-auto border-l p-3 md:block xl:w-80">
          <ReferenceValues model={model} />
          <ThisPhase model={model} phase={phase} />
        </aside>
      </div>

      {/* Phone: status strip with previous/next, then the bottom tab bar. */}
      <div className="bg-background/95 border-foreground/15 shrink-0 border-t backdrop-blur md:hidden">
        <div className="flex items-center gap-1 px-1 py-1">
          <Button variant="ghost" size="icon" aria-label={prev ? `Back to ${phaseLabels[prev.key]}` : 'Back'} disabled={!prev} onClick={() => prev && setPhase(prev.key)}>
            <ChevronLeft />
          </Button>
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setPanelOpen(true)}
            className="flex min-h-11 min-w-0 flex-1 items-center justify-center px-1 text-left"
          >
            <ReferenceGist model={model} phase={phase} />
          </button>
          <Button variant={next ? 'default' : 'ghost'} size="icon" aria-label={next ? `Next: ${phaseLabels[next.key]}` : 'Next'} disabled={!next} onClick={() => next && setPhase(next.key)}>
            <ChevronRight />
          </Button>
        </div>
        <nav aria-label="Sections" className="border-foreground/15 grid grid-cols-5 border-t">
          {sections.map((s, i) => {
            const Icon = sectionIcons[i]!;
            return (
              <span key={s.key} className={cn('flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px]', i === 0 ? 'text-primary' : 'text-muted-foreground')}>
                <Icon className="size-5" />
                {s.short}
              </span>
            );
          })}
          <button type="button" onClick={() => setMoreOpen(true)} className="text-muted-foreground flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px]">
            <MoreHorizontal className="size-5" />
            More
          </button>
        </nav>
      </div>

      <Sheet open={stepsOpen} onOpenChange={setStepsOpen}>
        <SheetContent side="bottom" className="max-h-[80svh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Week 14</SheetTitle>
            <SheetDescription>Jump to any step. The number is how much is still to decide.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-1 px-4 pb-6">{model.steps.map((s) => stepButton(s, 'rail'))}</div>
        </SheetContent>
      </Sheet>

      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent side="bottom" className="max-h-[85svh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Militia · now → after week</SheetTitle>
            <SheetDescription>What the week does to the militia so far, and what {phaseLabels[phase]} still needs.</SheetDescription>
          </SheetHeader>
          <div className="space-y-3 px-4 pb-6">
            <ReferenceValues model={model} />
            <ThisPhase model={model} phase={phase} />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
            <SheetDescription>Organization and account.</SheetDescription>
          </SheetHeader>
          <div className="space-y-3 px-4 pb-6">
            <div className="flex items-center justify-between border-b py-2">
              <span className="text-sm">Organization</span>
              <OrganizationSwitcher />
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Signed in as Andreas</span>
              <Account />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
