'use client';
// PROTOTYPE — the settled week frame (navigation #102 variant E + week layout
// #101 variant A), reduced to what Activity needs. Not under review here: only
// the main column changes between variants.

import { ArrowLeft, ArrowRight, Check, ChevronDown, CircleDot, Flag, Loader2, StickyNote, Users } from 'lucide-react';
import type React from 'react';
import { KeepIcon } from '~/components/keepIcon';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { allowance, phaseLists, used, type State } from './mock';
import { RequirementLine, WarningLine } from './parts';

const steps = [
  { key: 'upkeep', label: 'Upkeep', caption: 'Ready · 1 warning', done: true },
  { key: 'activity', label: 'Activity' },
  { key: 'event', label: 'Event', caption: '1 to decide' },
  { key: 'persistent', label: 'Persistent', caption: '1 to decide' },
  { key: 'summary', label: 'Review & confirm' },
];

export function WeekFrame({
  state,
  confirming,
  children,
}: {
  state: State;
  confirming: boolean;
  children: React.ReactNode;
}) {
  const { requirements, warnings } = phaseLists(state);
  const n = used(state);
  return (
    <main className="flex min-h-svh flex-col">
      <header className="bg-sidebar flex items-center gap-4 border-b px-4 py-2">
        <KeepIcon className="size-8" />
        <span className="text-muted-foreground">/</span>
        <span className="flex items-center gap-1">
          Ironfang Invasion <ChevronDown className="size-4 opacity-60" />
        </span>
        <nav className="flex gap-1 text-sm">
          {['Week 14', 'Finished weeks', 'Militia', 'Characters & officers'].map((t, i) => (
            <span key={t} className={cn('px-3 py-1.5', i === 0 ? 'bg-background rounded-md shadow-sm' : 'text-muted-foreground')}>
              {t}
            </span>
          ))}
        </nav>
        <span className="ml-auto flex items-center gap-2 text-sm">
          {state.remoteSlotId && (
            <span className="inline-flex items-center gap-1">
              <Users className="size-4" /> Another player changed Activity
            </span>
          )}
          {confirming ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
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
            const active = s.key === 'activity';
            const caption = active
              ? requirements.length
                ? `${requirements.length} to decide`
                : warnings.length
                  ? `Ready · ${warnings.length} warning${warnings.length > 1 ? 's' : ''}`
                  : 'Ready'
              : s.key === 'summary'
                ? `${requirements.length + 2} decisions left`
                : s.caption;
            return (
              <li key={s.key} className="flex flex-1 items-center">
                <span
                  className={cn(
                    'flex min-h-12 flex-1 items-center gap-2 border px-3',
                    active ? 'bg-primary text-primary-foreground border-primary' : 'border-foreground/25',
                  )}
                >
                  <span className="flex size-6 items-center justify-center border border-current/40 font-mono">
                    {s.key === 'summary' ? <Flag className="size-3.5" /> : s.done ? <Check className="size-3.5" /> : active ? requirements.length || <Check className="size-3.5" /> : 1}
                  </span>
                  <span className="leading-tight">
                    <span className="block text-sm">{s.label}</span>
                    <span className={cn('block text-xs', active ? 'opacity-80' : 'text-muted-foreground')}>{caption}</span>
                  </span>
                </span>
                {i < steps.length - 1 && <span className="h-px w-3 bg-foreground/30" />}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="flex flex-1 gap-4 px-5 py-3">
        <div className={cn('min-w-0 flex-1', confirming && 'pointer-events-none opacity-50')}>{children}</div>
        <aside className="sticky top-3 w-64 shrink-0 space-y-3 self-start">
          <section aria-label="This phase" className="bg-card space-y-1.5 border border-foreground/20 p-3">
            <h2 className="text-muted-foreground text-xs tracking-widest uppercase">This phase</h2>
            {requirements.length === 0 && warnings.length === 0 && <p className="text-sm">Nothing open.</p>}
            {requirements.map((r) => (
              <RequirementLine key={r}>{r}</RequirementLine>
            ))}
            {warnings.map((w) => (
              <WarningLine key={w}>{w}</WarningLine>
            ))}
          </section>
          <section aria-label="Militia status" className="bg-card border border-foreground/20 p-3">
            <h2 className="text-muted-foreground mb-2 text-xs tracking-widest uppercase">Militia · now → after</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              {[
                ['Rank', '8'],
                ['Training', '78 → 81'],
                ['Treasury', '118 → 96 gp'],
                ['Notoriety', '12 → 14'],
                ['Teams', '3 ready · 1 disabled · 1 missing'],
                ['Actions', `${n} of ${allowance}`],
                ['Event chance', '35%'],
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

      <footer className="bg-background/95 sticky bottom-0 z-10 flex items-center gap-3 border-t border-foreground/15 px-5 py-2.5 pb-14 backdrop-blur">
        <Button variant="outline" size="lg">
          <ArrowLeft /> Upkeep
        </Button>
        <p className="text-muted-foreground flex flex-1 items-center justify-center gap-1.5 text-sm">
          <CircleDot className="size-4" />
          {requirements.length
            ? 'Complete the required rolls and decisions to finish Activity.'
            : 'Activity is ready.'}
        </p>
        <Button size="lg">
          Event <ArrowRight />
        </Button>
      </footer>
    </main>
  );
}
