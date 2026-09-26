'use client';
// PROTOTYPE — Variant A "Squeeze in place": one structure at every width.
// Phone: the top bar becomes two rows (brand and campaign, then the tabs
// scrolling sideways with the organization at the end), the stepper is a
// sideways-scrolling strip that keeps the current step in view, the reference
// panel folds into a one-line block above the phase body that opens in place,
// and the footer keeps its buttons with the readiness line above them.
// Desktop: the tablet layout centred at a maximum width with a wider panel.

import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
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

export const name = 'Squeeze in place';

export function VariantA({ model, knobs, phase, setPhase }: VariantProps) {
  const { prev, next } = usePrevNext(model, phase);
  const [panelOpen, setPanelOpen] = useState(false);
  const activeRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [phase]);

  const tabs = (
    <nav aria-label="Sections" className="flex gap-1 text-sm">
      {sections.map((s, i) => (
        <span
          key={s.key}
          className={cn('px-3 py-1.5 whitespace-nowrap', i === 0 ? 'bg-background rounded-md shadow-sm' : 'text-muted-foreground')}
        >
          {s.label}
        </span>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-sidebar border-b">
        <MaintenanceBanner knobs={knobs} />
        <div className="flex items-center gap-2 px-3 py-1.5 md:gap-4 md:px-4 md:py-2">
          <Brand />
          <span className="text-muted-foreground">/</span>
          <CampaignSwitcher compact />
          <div className="hidden md:block">{tabs}</div>
          <div className="ml-auto flex items-center gap-2 md:gap-3">
            <RemoteNote knobs={knobs} compact />
            <span className="hidden md:inline-flex">
              <RemoteNote knobs={knobs} />
            </span>
            <SaveStatus knobs={knobs} compact />
            <span className="hidden md:inline-flex">
              <OrganizationSwitcher />
            </span>
            <Account />
          </div>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto px-3 pb-1.5 md:hidden">
          {tabs}
          <OrganizationSwitcher className="ml-auto shrink-0" />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
        <nav aria-label="Week phases" className="overflow-x-auto px-3 pt-3 md:px-5">
          <ol className="flex items-stretch md:w-full">
            {model.steps.map((s, i) => {
              const active = s.key === phase;
              return (
                <li key={s.key} ref={active ? activeRef : undefined} className="flex shrink-0 items-center md:flex-1">
                  <button
                    disabled={s.locked}
                    aria-current={active ? 'step' : undefined}
                    onClick={() => setPhase(s.key)}
                    className={cn(
                      'flex min-h-12 w-40 items-center gap-2 border px-3 text-left disabled:opacity-40 md:w-auto md:flex-1',
                      active ? 'bg-primary text-primary-foreground border-primary' : 'border-foreground/25 hover:bg-foreground/10',
                    )}
                  >
                    <StepGlyph step={s} active={active} />
                    <span className="min-w-0 leading-tight">
                      <span className="block truncate text-sm">{s.label}</span>
                      <span className={cn('block truncate text-xs', active ? 'opacity-80' : 'text-muted-foreground')}>{s.caption}</span>
                    </span>
                  </button>
                  {i < model.steps.length - 1 && <span className="bg-foreground/30 h-px w-3 shrink-0" />}
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="flex flex-1 flex-col gap-3 px-3 py-3 md:flex-row md:gap-4 md:px-5">
          <div className="min-w-0 flex-1 space-y-4">
            <section aria-label="Reference" className="border-foreground/20 border md:hidden">
              <button
                type="button"
                aria-expanded={panelOpen}
                onClick={() => setPanelOpen(!panelOpen)}
                className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left"
              >
                <ReferenceGist model={model} phase={phase} />
                {panelOpen ? <ChevronUp className="ml-auto size-4 shrink-0" /> : <ChevronDown className="ml-auto size-4 shrink-0" />}
              </button>
              {panelOpen && (
                <div className="space-y-3 border-t border-foreground/20 p-3">
                  <ReferenceValues model={model} />
                  <ThisPhase model={model} phase={phase} />
                </div>
              )}
            </section>
            <PhaseBody model={model} knobs={knobs} phase={phase} />
          </div>
          <aside className="sticky top-3 hidden w-64 shrink-0 space-y-3 self-start md:block xl:w-72">
            <ReferenceValues model={model} />
            <ThisPhase model={model} phase={phase} />
          </aside>
        </div>
      </div>

      <footer className="bg-background/95 border-foreground/15 sticky bottom-0 z-10 flex flex-wrap items-center gap-2 border-t px-3 py-2 backdrop-blur md:gap-3 md:px-5 md:py-2.5">
        <p className="text-muted-foreground order-first basis-full text-center text-xs md:order-2 md:flex-1 md:basis-auto md:text-sm">
          {readinessLine(model, phase)}
        </p>
        <Button variant="outline" size="lg" className="flex-1 md:order-1 md:flex-none" disabled={!prev} onClick={() => prev && setPhase(prev.key)}>
          <ArrowLeft /> <span className="truncate">{prev ? phaseLabels[prev.key] : 'Back'}</span>
        </Button>
        {next ? (
          <Button size="lg" className="flex-1 md:order-3 md:flex-none" onClick={() => setPhase(next.key)}>
            <span className="truncate">{phaseLabels[next.key]}</span> <ArrowRight />
          </Button>
        ) : (
          <span className="flex-1 md:order-3 md:w-32 md:flex-none" />
        )}
      </footer>
    </div>
  );
}
