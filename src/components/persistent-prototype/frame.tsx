'use client';
// PROTOTYPE — the settled week frame (navigation #102 variant E + week layout
// #101 variant A), reduced to what Persistent needs. Not under review here:
// only the main column changes between variants.

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CircleDot,
  Flag,
  Loader2,
  StickyNote,
  Users,
} from 'lucide-react';
import type React from 'react';
import { KeepIcon } from '~/components/keepIcon';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { minimumGp, type Projection, rank, type State, week } from './mock';

export function RequirementLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-sm">
      <CircleDot className="text-primary mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
export function WarningLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-sm text-amber-300">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function WeekFrame({
  state,
  view,
  confirming,
  children,
}: {
  state: State;
  view: Projection;
  confirming: boolean;
  children: React.ReactNode;
}) {
  const own = view.requirements.filter((r) => r.subject !== 'phases');
  const { warnings } = view;
  const caption = own.length
    ? `${own.length} to decide`
    : warnings.length
      ? `Ready · ${warnings.length} warning${warnings.length > 1 ? 's' : ''}`
      : 'Ready';
  const earlier = view.earlierPhasesOpen ? 3 : 0;
  const steps = [
    {
      key: 'upkeep',
      label: 'Upkeep',
      caption: view.earlierPhasesOpen ? '2 to decide' : 'Ready',
    },
    { key: 'activity', label: 'Activity', caption: 'Ready · 1 warning' },
    {
      key: 'event',
      label: 'Event',
      caption: view.earlierPhasesOpen ? '1 to decide' : 'Ready',
    },
    { key: 'persistent', label: 'Persistent', caption },
    {
      key: 'summary',
      label: 'Review & confirm',
      caption:
        own.length + earlier
          ? `${own.length + earlier} decisions left`
          : 'Ready to confirm',
    },
  ];
  return (
    <main className="flex min-h-svh flex-col">
      <header className="bg-sidebar flex items-center gap-4 border-b px-4 py-2">
        <KeepIcon className="size-8" />
        <span className="text-muted-foreground">/</span>
        <span className="flex items-center gap-1">
          Ironfang Invasion <ChevronDown className="size-4 opacity-60" />
        </span>
        <nav className="flex gap-1 text-sm">
          {[
            `Week ${week}`,
            'Finished weeks',
            'Militia',
            'Characters & officers',
          ].map((t, i) => (
            <span
              key={t}
              className={cn(
                'px-3 py-1.5',
                i === 0
                  ? 'bg-background rounded-md shadow-sm'
                  : 'text-muted-foreground',
              )}
            >
              {t}
            </span>
          ))}
        </nav>
        <span className="ml-auto flex items-center gap-2 text-sm">
          {state.remote && (
            <span className="inline-flex items-center gap-1">
              <Users className="size-4" /> Another player changed Persistent
            </span>
          )}
          {confirming ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          <span role="status" aria-live="polite">
            {confirming ? 'Confirming the week…' : state.feedback}
          </span>
        </span>
        <Button variant="ghost" size="icon" aria-label="Setup notes">
          <StickyNote />
        </Button>
      </header>

      <nav aria-label="Week phases" className="px-5 pt-3">
        <ol className="flex items-stretch">
          {steps.map((s, i) => {
            const active = s.key === 'persistent';
            return (
              <li key={s.key} className="flex flex-1 items-center">
                <span
                  className={cn(
                    'flex min-h-12 flex-1 items-center gap-2 border px-3',
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-foreground/25',
                  )}
                >
                  <span className="flex size-6 items-center justify-center border border-current/40 font-mono">
                    {s.key === 'summary' ? (
                      <Flag className="size-3.5" />
                    ) : active ? (
                      own.length || <Check className="size-3.5" />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="leading-tight">
                    <span className="block text-sm">{s.label}</span>
                    <span
                      className={cn(
                        'block text-xs',
                        active ? 'opacity-80' : 'text-muted-foreground',
                      )}
                    >
                      {s.caption}
                    </span>
                  </span>
                </span>
                {i < steps.length - 1 && (
                  <span className="bg-foreground/30 h-px w-3" />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="flex flex-1 gap-4 px-5 py-3">
        <div
          className={cn(
            'min-w-0 flex-1',
            confirming && 'pointer-events-none opacity-50',
          )}
        >
          {children}
        </div>
        <aside className="sticky top-3 w-64 shrink-0 space-y-3 self-start">
          <section
            aria-label="This phase"
            className="bg-card border-foreground/20 space-y-1.5 border p-3"
          >
            <h2 className="text-muted-foreground text-xs tracking-widest uppercase">
              This phase
            </h2>
            {view.requirements.length === 0 && warnings.length === 0 && (
              <p className="text-sm">Nothing open.</p>
            )}
            {view.requirements.map((r) => (
              <RequirementLine key={r.subject + r.text}>
                {r.subject !== 'phases' && (
                  <span className="text-muted-foreground">
                    {view.events.find((e) => e.id === r.subject)?.name} ·{' '}
                  </span>
                )}
                {r.text}
              </RequirementLine>
            ))}
            {warnings.map((w) => (
              <WarningLine key={w.subject + w.text}>{w.text}</WarningLine>
            ))}
          </section>
          <section
            aria-label="Militia status"
            className="bg-card border-foreground/20 border p-3"
          >
            <h2 className="text-muted-foreground mb-2 text-xs tracking-widest uppercase">
              Militia · now → after
            </h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              {[
                ['Rank', `${rank} → ${rank}`],
                ['Training', '82 → 78'],
                [
                  'Treasury',
                  `${view.treasuryStartGp} → ${view.treasuryAfterGp} gp`,
                ],
                ['Minimum', `${minimumGp} gp`],
                ['Notoriety', '64'],
                ['Teams', '4 · 2 in a Rivalry'],
                ['Actions', '3 of 4'],
                ['Event chance', '35%'],
                [
                  'Carried events',
                  `${view.events.length} → ${view.carriedAfter}`,
                ],
              ].map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right font-mono">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>
      </div>

      <footer className="bg-background/95 border-foreground/15 sticky bottom-0 z-10 flex items-center gap-3 border-t px-5 py-2.5 pb-14 backdrop-blur">
        <Button variant="ghost" size="lg" className="w-32">
          <ArrowLeft /> Event
        </Button>
        <p className="text-muted-foreground flex flex-1 items-center justify-center gap-1.5 text-sm">
          <CircleDot className="size-4" />
          {own.length
            ? 'Complete the required checks and decisions to finish Persistent.'
            : 'Persistent is ready.'}
        </p>
        <Button size="lg">
          Review & confirm <ArrowRight />
        </Button>
      </footer>
    </main>
  );
}
