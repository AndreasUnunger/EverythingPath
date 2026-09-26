'use client';
// PROTOTYPE — Variant C "Menu and phase-first": phone shows one thing at a
// time. A menu button opens a side sheet with the campaign, organization,
// sections and account; the top bar itself reads "Week 14 · Activity" with
// five tappable dots for the steps. The reference panel becomes a second
// view of the same screen: a Phase / Militia switch at the top of the body
// swaps the phase content for the values and This phase. The footer keeps
// previous/next with the readiness line between them.
// Tablet: the settled layout. Desktop: the panel widens into two columns
// (values beside This phase) and starts at the top, with the stepper spanning
// only the main column.

import { ArrowLeft, ArrowRight, Menu } from 'lucide-react';
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
  ReferenceValues,
  RemoteNote,
  SaveStatus,
  StepGlyph,
  ThisPhase,
  usePrevNext,
  type VariantProps,
} from './parts';

export const name = 'Menu and phase-first';

export function VariantC({ model, knobs, phase, setPhase }: VariantProps) {
  const { prev, next } = usePrevNext(model, phase);
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState<'phase' | 'militia'>('phase');
  const current = model.steps.find((s) => s.key === phase)!;
  const open = phase === 'summary' ? model.openDecisions : model.issues[phase].requirements.length;

  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-sidebar border-b">
        <MaintenanceBanner knobs={knobs} />
        {/* Phone bar */}
        <div className="flex items-center gap-2 px-2 py-1.5 md:hidden">
          <Button variant="ghost" size="icon" aria-label="Menu" onClick={() => setMenuOpen(true)}>
            <Menu />
          </Button>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm">
              Week 14 <span className="text-muted-foreground">·</span> {current.label}
            </p>
            <ol className="mt-1 flex items-center gap-1.5" aria-label="Week phases">
              {model.steps.map((s) => {
                const active = s.key === phase;
                return (
                  <li key={s.key} className="flex items-center">
                    <button
                      type="button"
                      aria-label={`${s.label} · ${s.caption}`}
                      aria-current={active ? 'step' : undefined}
                      disabled={s.locked}
                      onClick={() => {
                        setPhase(s.key);
                        setView('phase');
                      }}
                      className={cn(
                        'flex size-6 items-center justify-center rounded-full border font-mono text-[11px] disabled:opacity-40',
                        active ? 'bg-primary text-primary-foreground border-primary' : s.count ? 'border-foreground/50' : 'border-emerald-400/70 text-emerald-300',
                      )}
                    >
                      {s.locked ? '·' : s.key === 'summary' ? '⚑' : s.count || '✓'}
                    </button>
                  </li>
                );
              })}
              <li className="text-muted-foreground ml-1 truncate text-xs">{current.caption}</li>
            </ol>
          </div>
          <RemoteNote knobs={knobs} compact />
          <SaveStatus knobs={knobs} compact />
        </div>
        {/* Tablet and desktop bar */}
        <div className="hidden items-center gap-4 px-4 py-2 md:flex">
          <Brand />
          <span className="text-muted-foreground">/</span>
          <CampaignSwitcher />
          <nav aria-label="Sections" className="flex gap-1 text-sm">
            {sections.map((s, i) => (
              <span key={s.key} className={cn('px-3 py-1.5 whitespace-nowrap', i === 0 ? 'bg-background rounded-md shadow-sm' : 'text-muted-foreground')}>
                {s.label}
              </span>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <RemoteNote knobs={knobs} />
            <SaveStatus knobs={knobs} />
            <OrganizationSwitcher />
            <Account />
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <div className="flex min-w-0 flex-1 flex-col">
          <nav aria-label="Week phases" className="hidden px-5 pt-3 md:block">
            <ol className="flex items-stretch">
              {model.steps.map((s, i) => {
                const active = s.key === phase;
                return (
                  <li key={s.key} className="flex flex-1 items-center">
                    <button
                      disabled={s.locked}
                      aria-current={active ? 'step' : undefined}
                      onClick={() => setPhase(s.key)}
                      className={cn(
                        'flex min-h-12 flex-1 items-center gap-2 border px-3 text-left disabled:opacity-40',
                        active ? 'bg-primary text-primary-foreground border-primary' : 'border-foreground/25 hover:bg-foreground/10',
                      )}
                    >
                      <StepGlyph step={s} active={active} />
                      <span className="min-w-0 leading-tight">
                        <span className="block text-sm">{s.label}</span>
                        <span className={cn('block text-xs', active ? 'opacity-80' : 'text-muted-foreground')}>{s.caption}</span>
                      </span>
                    </button>
                    {i < model.steps.length - 1 && <span className="bg-foreground/30 h-px w-3 shrink-0" />}
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="flex-1 px-3 py-3 md:px-5">
            <div role="tablist" aria-label="View" className="border-foreground/25 mb-3 grid grid-cols-2 border md:hidden">
              {(['phase', 'militia'] as const).map((v) => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className={cn('min-h-11 text-sm', view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
                >
                  {v === 'phase' ? current.label : 'Militia'}
                  {v === 'militia' && open > 0 && (
                    <span className={cn('ml-1.5 rounded-full px-1.5 font-mono text-xs', view === v ? 'bg-primary-foreground/20' : 'bg-primary/20 text-primary')}>{open}</span>
                  )}
                </button>
              ))}
            </div>
            <div className={cn(view !== 'phase' && 'hidden md:block')}>
              <PhaseBody model={model} knobs={knobs} phase={phase} />
            </div>
            <div className={cn('space-y-3', view !== 'militia' && 'hidden', 'md:hidden')}>
              <ReferenceValues model={model} />
              <ThisPhase model={model} phase={phase} />
            </div>
          </div>
        </div>

        <aside className="bg-sidebar hidden w-64 shrink-0 border-l p-3 md:block xl:w-[36rem]">
          <div className="sticky top-3 grid gap-3 xl:grid-cols-[17rem_1fr] xl:items-start">
            <ReferenceValues model={model} />
            <ThisPhase model={model} phase={phase} />
          </div>
        </aside>
      </div>

      <footer className="bg-background/95 border-foreground/15 sticky bottom-0 z-10 flex items-center gap-2 border-t px-3 py-2 backdrop-blur md:gap-3 md:px-5 md:py-2.5">
        <Button variant="outline" size="lg" disabled={!prev} onClick={() => prev && setPhase(prev.key)}>
          <ArrowLeft /> <span className="hidden sm:inline">{prev ? phaseLabels[prev.key] : 'Back'}</span>
        </Button>
        <p className="text-muted-foreground min-w-0 flex-1 text-center text-xs md:text-sm">{readinessLine(model, phase)}</p>
        {next ? (
          <Button size="lg" onClick={() => setPhase(next.key)}>
            <span className="hidden sm:inline">{phaseLabels[next.key]}</span> <ArrowRight />
          </Button>
        ) : (
          <span className="w-11 md:w-32" />
        )}
      </footer>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-80">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Brand /> Keepnet
            </SheetTitle>
            <SheetDescription>Campaign, sections, organization and account.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6">
            <div>
              <p className="text-muted-foreground text-xs tracking-widest uppercase">Campaign</p>
              <CampaignSwitcher className="w-full px-0" />
            </div>
            <nav aria-label="Sections" className="flex flex-col">
              {sections.map((s, i) => (
                <span key={s.key} className={cn('min-h-11 border-b py-2.5 text-base', i === 0 ? 'text-primary' : '')}>
                  {s.label}
                </span>
              ))}
            </nav>
            <div>
              <p className="text-muted-foreground text-xs tracking-widest uppercase">Organization</p>
              <OrganizationSwitcher className="w-full px-0" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Signed in as Andreas</span>
              <Account />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
