'use client';
// PROTOTYPE — the settled week frame (navigation #102 variant E + week layout
// #101 variant A) around the Summary step, including the review-and-confirm
// block that #101 fixed at the top of Summary. Not under review here: only what
// comes below the confirm block changes between variants.

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
import { minimumGp, phaseLabels, type Projection } from './mock';

export function RequirementLine({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-1.5 text-sm">
      <CircleDot className="text-primary mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </li>
  );
}
export function WarningLine({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-1.5 text-sm text-amber-300">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </li>
  );
}

function ConfirmBlock({
  view,
  disabled,
}: {
  view: Projection;
  disabled: boolean;
}) {
  const { requirements, warnings, blocker, forecastPending } = view;
  const stale =
    view.state.scenario.stale && !blocker?.startsWith('Review will');
  return (
    <section
      aria-label="Review the week"
      className="bg-card border-foreground/20 space-y-3 border p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">Review the week</h2>
        <p className="text-muted-foreground text-sm">
          {forecastPending
            ? 'Review will be ready when your changes are saved.'
            : requirements.length
              ? 'Some rolls or decisions still need attention.'
              : 'The week is ready for confirmation.'}
        </p>
      </div>
      {requirements.length > 0 && (
        <div>
          <h3 className="text-muted-foreground text-xs tracking-widest uppercase">
            Required decisions
          </h3>
          <ul className="mt-1 space-y-1">
            {requirements.map((r) => (
              <RequirementLine key={r.id}>
                {r.text}{' '}
                <button className="underline underline-offset-2">
                  Go to {phaseLabels[r.phase]} →
                </button>
              </RequirementLine>
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div>
          <h3 className="text-muted-foreground text-xs tracking-widest uppercase">
            Warnings
          </h3>
          <ul className="mt-1 space-y-1">
            {warnings.map((w) => (
              <WarningLine key={w.id}>
                {w.text}{' '}
                <span className="text-muted-foreground">
                  · {phaseLabels[w.phase]}
                </span>
              </WarningLine>
            ))}
          </ul>
        </div>
      )}
      {stale && (
        <div
          className="border-destructive/60 space-y-2 border p-3"
          role="alert"
        >
          <p className="text-sm">
            The week could not be confirmed as reviewed. Review the updated
            outcomes and table decisions before trying again.
          </p>
          <Button variant="outline" disabled={disabled}>
            Review updated week
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" disabled={disabled || blocker !== null}>
          <Flag /> Confirm week
        </Button>
        <span className="text-sm">
          {blocker ? (
            <span className="text-muted-foreground">{blocker}</span>
          ) : (
            <span>
              Applies the entire prepared week. Everything below stays a preview
              until then.
            </span>
          )}
        </span>
      </div>
    </section>
  );
}

export function WeekFrame({
  view,
  confirming,
  children,
}: {
  view: Projection;
  confirming: boolean;
  children: React.ReactNode;
}) {
  const { requirements, warnings, blocker, final, start } = view;
  const count = (phase: string) =>
    requirements.filter((r) => r.phase === phase).length;
  const warn = (phase: string) =>
    warnings.filter((w) => w.phase === phase).length;
  const caption = (phase: string) =>
    count(phase)
      ? `${count(phase)} to decide`
      : warn(phase)
        ? `Ready · ${warn(phase)} warning${warn(phase) > 1 ? 's' : ''}`
        : 'Ready';
  const steps = [
    { key: 'upkeep', label: 'Upkeep', caption: caption('upkeep') },
    { key: 'activity', label: 'Activity', caption: caption('activity') },
    { key: 'event', label: 'Event', caption: caption('event') },
    { key: 'persistent', label: 'Persistent', caption: caption('persistent') },
    {
      key: 'summary',
      label: 'Review & confirm',
      caption: blocker ?? 'Ready to confirm',
    },
  ];
  const teams = (s: typeof final) =>
    ['active', 'disabled', 'missing']
      .map((st) => [st, s.teams.filter((t) => t.status === st).length] as const)
      .filter(([, n]) => n)
      .map(([st, n]) => `${n} ${st}`)
      .join(' · ');
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
            'Week 14',
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
          {view.state.remote && (
            <span className="inline-flex items-center gap-1">
              <Users className="size-4" /> Another player changed Review &
              confirm
            </span>
          )}
          {confirming || view.forecastPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          <span role="status" aria-live="polite">
            {confirming ? 'Confirming the week…' : view.state.feedback}
          </span>
        </span>
        <Button variant="ghost" size="icon" aria-label="Setup notes">
          <StickyNote />
        </Button>
      </header>

      <nav aria-label="Week phases" className="px-5 pt-3">
        <ol className="flex items-stretch">
          {steps.map((s, i) => {
            const active = s.key === 'summary';
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
                    ) : (
                      count(s.key) || <Check className="size-3.5" />
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
            'min-w-0 flex-1 space-y-4',
            confirming && 'pointer-events-none opacity-50',
          )}
        >
          <ConfirmBlock view={view} disabled={confirming} />
          {children}
        </div>
        <aside className="sticky top-3 w-64 shrink-0 space-y-3 self-start">
          <section
            aria-label="Militia status"
            className="bg-card border-foreground/20 border p-3"
          >
            <h2 className="text-muted-foreground mb-2 text-xs tracking-widest uppercase">
              Militia · now → after
            </h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              {[
                ['Rank', `${start.rank} → ${final.rank}`],
                ['Training', `${start.training} → ${final.training}`],
                ['Treasury', `${start.treasury} → ${final.treasury} gp`],
                ['Minimum', `${minimumGp} gp`],
                ['Notoriety', `${start.notoriety} → ${final.notoriety}`],
                ['Focus', start.focus],
                ['Teams', teams(final)],
                ['Actions', '4 of 4'],
                ['Event chance', '35%'],
                [
                  'Carried events',
                  `${start.events.length} → ${final.events.filter((e) => !e.ended).length}`,
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
        <Button variant="outline" size="lg">
          <ArrowLeft /> Persistent
        </Button>
        <p className="text-muted-foreground flex flex-1 items-center justify-center gap-1.5 text-sm">
          <CircleDot className="size-4" />
          {blocker ?? 'The week is ready for confirmation.'}
        </p>
        <span className="inline-flex w-32 items-center justify-end gap-1 text-sm opacity-0">
          <ArrowRight />
        </span>
      </footer>
    </main>
  );
}
