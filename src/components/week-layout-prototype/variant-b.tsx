'use client';
// PROTOTYPE — Variant B: militia status as a full-width HUD across the top,
// phases as a vertical checklist on the left, warnings as a banner above the
// phase. Summary is not a phase tab: "Review & confirm" in the HUD opens it as a
// wide sheet over whatever phase you were on.

import { AlertTriangle, Check, ChevronRight, History } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '~/components/ui/sheet';
import { cn } from '~/lib/utils';
import {
  confirmBlocker,
  feedbackText,
  militiaStatus,
  phaseLabels,
  readiness,
  setupNotesText,
  weekRequirements,
  type Phase,
} from './mock';
import { ConfirmBlock, FeedbackIcon, PhaseBody, RemoteEditNote, Trend } from './shared';
import type { VariantProps } from './types';

export const name = 'HUD + checklist + review sheet';

export function VariantB({ knobs, phase, setPhase }: VariantProps) {
  const [underneath, setUnderneath] = useState<Phase>(phase === 'summary' ? 'upkeep' : phase);
  const shown = phase === 'summary' ? underneath : phase;
  const go = (p: Phase) => {
    if (p !== 'summary') setUnderneath(p);
    setPhase(p);
  };
  const phases = readiness(knobs).filter((p) => p.phase !== 'summary');
  const current = phases.find((p) => p.phase === shown)!;
  const left = weekRequirements(knobs).length;

  return (
    <main className="flex min-h-svh flex-col">
      <header aria-label="Militia status" className="bg-card sticky top-0 z-10 flex items-stretch border-b border-foreground/20">
        <div className="flex flex-col justify-center border-r border-foreground/20 px-4 py-2">
          <p className="text-muted-foreground text-xs tracking-widest uppercase">Week</p>
          <p className="font-mono text-4xl leading-none">14</p>
        </div>
        <dl className="flex flex-1 items-stretch overflow-x-auto">
          {militiaStatus(knobs)
            .filter((s) => !['slots', 'event', 'persistent'].includes(s.key))
            .map((s) => (
              <div key={s.key} className="flex min-w-24 flex-col justify-center border-r border-foreground/10 px-3 py-2">
                <dt className="text-muted-foreground text-xs">{s.label}</dt>
                <dd className="whitespace-nowrap">
                  <span className="font-mono text-2xl leading-none">{s.now}</span>{' '}
                  <span className="text-sm"><Trend stat={s} /></span>
                </dd>
                {s.note && <dd className="text-muted-foreground text-xs whitespace-nowrap">{s.note}</dd>}
              </div>
            ))}
        </dl>
        <div className="flex flex-col items-end justify-center gap-1 px-4 py-2">
          <Button size="lg" onClick={() => go('summary')}>
            Review & confirm <ChevronRight />
          </Button>
          <p className="text-muted-foreground text-xs">{confirmBlocker(knobs)}</p>
        </div>
      </header>

      <div className="flex flex-1">
        <nav aria-label="Week phases" className="w-56 shrink-0 space-y-4 border-r border-foreground/15 p-3">
          <ol className="space-y-1">
            {phases
              .filter((p) => p.available)
              .map((p) => {
                const active = p.phase === shown;
                return (
                  <li key={p.phase}>
                    <button
                      aria-current={active ? 'page' : undefined}
                      onClick={() => go(p.phase)}
                      className={cn(
                        'flex min-h-14 w-full items-center gap-3 border px-3 text-left',
                        active ? 'bg-primary text-primary-foreground border-primary' : 'border-transparent hover:bg-foreground/10',
                      )}
                    >
                      <span className={cn('flex size-6 shrink-0 items-center justify-center border', active ? 'border-primary-foreground' : 'border-foreground/40')}>
                        {p.ready && <Check className="size-4" />}
                      </span>
                      <span className="leading-tight">
                        <span className="block">{phaseLabels[p.phase]}</span>
                        <span className={cn('block text-xs', active ? 'opacity-80' : 'text-muted-foreground')}>
                          {p.ready ? 'Ready' : `${p.requirements.length} to decide`}
                          {p.warnings.length > 0 && ` · ${p.warnings.length} ⚠`}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
          </ol>
          {!knobs.persistentEligible && (
            <p className="text-muted-foreground px-3 text-xs">No persistent events carried into this week.</p>
          )}
          <div className="space-y-2 border-t border-foreground/15 pt-3 text-sm">
            <p role="status" aria-live="polite" className={cn('flex items-start gap-2', knobs.feedback === 'failed' && 'text-destructive')}>
              <FeedbackIcon feedback={knobs.feedback} />
              <span>{feedbackText[knobs.feedback]}</span>
            </p>
            {knobs.remoteEdit && <RemoteEditNote />}
          </div>
          {knobs.setupNotes && (
            <details className="border-primary/40 bg-primary/10 border p-2 text-sm">
              <summary className="font-semibold">Setup notes</summary>
              <p className="mt-1">{setupNotesText}</p>
            </details>
          )}
          <Button variant="outline" className="w-full">
            <History /> Finished weeks
          </Button>
        </nav>

        <div className="min-w-0 flex-1 space-y-4 p-5 pb-20">
          <h1 className="text-2xl">
            Week 14 · {phaseLabels[shown]}
          </h1>
          {current.warnings.length > 0 && (
            <aside aria-label="Warnings" className="flex gap-3 border border-foreground/40 border-l-4 bg-foreground/5 p-3">
              <AlertTriangle className="size-5 shrink-0" />
              <ul className="space-y-1 text-sm">
                {current.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </aside>
          )}
          <PhaseBody phase={shown} knobs={knobs} />
          {current.requirements.length > 0 && (
            <p className="text-muted-foreground text-sm">
              Still to decide: {current.requirements.join(' · ')}
            </p>
          )}
        </div>
      </div>

      <Sheet open={phase === 'summary'} onOpenChange={(open) => !open && setPhase(underneath)}>
        <SheetContent className="w-[min(900px,90vw)] overflow-y-auto sm:max-w-none">
          <SheetHeader>
            <SheetTitle className="text-2xl">Review week 14</SheetTitle>
            <p className="text-muted-foreground text-sm">
              {left === 0 ? 'Every phase is ready.' : `${left} decisions left across the week.`}
            </p>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-20">
            <ConfirmBlock knobs={knobs} onReview={() => go('summary')} onGo={go} />
            <PhaseBody phase="summary" knobs={knobs} />
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}
