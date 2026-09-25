'use client';
// PROTOTYPE — Variant A: horizontal phase stepper, sticky militia status rail on
// the right, Back/Next footer. Summary is the last step and holds Confirmation.

import { ArrowLeft, ArrowRight, Check, Flag, History, Lock, StickyNote } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import {
  confirmBlocker,
  feedbackText,
  militiaStatus,
  phaseLabels,
  readiness,
  setupNotesText,
} from './mock';
import {
  ConfirmBlock,
  FeedbackIcon,
  PhaseBody,
  RemoteEditNote,
  RequirementItem,
  Trend,
  WarningItem,
} from './shared';
import type { VariantProps } from './types';

export const name = 'Stepper + status rail';

export function VariantA({ knobs, phase, setPhase }: VariantProps) {
  const [notesOpen, setNotesOpen] = useState(false);
  const phases = readiness(knobs);
  const available = phases.filter((p) => p.available);
  const index = available.findIndex((p) => p.phase === phase);
  const prev = available[index - 1];
  const next = available[index + 1];
  const current = phases.find((p) => p.phase === phase)!;

  return (
    <main className="flex min-h-svh flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-foreground/15 px-5 py-3">
        <div className="mr-auto">
          <p className="text-muted-foreground text-xs tracking-widest uppercase">Weekly militia</p>
          <h1 className="text-2xl">
            Week 14 · {phaseLabels[phase]}
          </h1>
        </div>
        {knobs.remoteEdit && <RemoteEditNote />}
        <p
          role="status"
          aria-live="polite"
          className={cn(
            'flex items-center gap-2 border px-3 py-1 text-sm',
            knobs.feedback === 'failed' ? 'border-destructive text-destructive' : 'border-foreground/20',
          )}
        >
          <FeedbackIcon feedback={knobs.feedback} />
          {feedbackText[knobs.feedback]}
        </p>
        {knobs.setupNotes && (
          <Button variant="ghost" size="icon" aria-label="Setup notes" onClick={() => setNotesOpen(!notesOpen)}>
            <StickyNote />
          </Button>
        )}
        <Button variant="ghost" size="icon" aria-label="Finished weeks">
          <History />
        </Button>
      </header>
      {notesOpen && knobs.setupNotes && (
        <aside aria-label="Setup notes" className="border-primary/40 bg-primary/10 mx-5 mt-3 border p-3 text-sm">
          <h2 className="font-semibold">Setup notes</h2>
          <p>{setupNotesText}</p>
        </aside>
      )}

      <nav aria-label="Week phases" className="px-5 pt-4">
        <ol className="flex items-stretch">
          {phases.map((p, i) => {
            const active = p.phase === phase;
            return (
              <li key={p.phase} className="flex flex-1 items-center">
                <button
                  disabled={!p.available}
                  aria-current={active ? 'step' : undefined}
                  onClick={() => setPhase(p.phase)}
                  className={cn(
                    'flex min-h-14 flex-1 items-center gap-2 border px-3 text-left disabled:opacity-40',
                    active ? 'bg-primary text-primary-foreground border-primary' : 'border-foreground/25 hover:bg-foreground/10',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center border font-mono text-lg',
                      active ? 'border-primary-foreground' : 'border-foreground/40',
                    )}
                  >
                    {!p.available ? (
                      <Lock className="size-4" />
                    ) : p.phase === 'summary' ? (
                      <Flag className="size-4" />
                    ) : p.ready ? (
                      <Check className="size-4" />
                    ) : (
                      p.requirements.length
                    )}
                  </span>
                  <span className="leading-tight">
                    <span className="block">{p.phase === 'summary' ? 'Review & confirm' : phaseLabels[p.phase]}</span>
                    <span className={cn('block text-xs', active ? 'opacity-80' : 'text-muted-foreground')}>
                      {!p.available
                        ? 'No carried events'
                        : p.phase === 'summary'
                          ? confirmBlocker(knobs)
                          : p.ready
                            ? p.warnings.length
                              ? `Ready · ${p.warnings.length} warning${p.warnings.length > 1 ? 's' : ''}`
                              : 'Ready'
                            : `${p.requirements.length} to decide`}
                    </span>
                  </span>
                </button>
                {i < phases.length - 1 && <span className="h-px w-3 shrink-0 bg-foreground/30" />}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="flex flex-1 gap-5 px-5 py-4">
        <div className="min-w-0 flex-1 space-y-4">
          {phase === 'summary' && (
            <section className="bg-card border border-foreground/20 p-4">
              <ConfirmBlock knobs={knobs} onReview={() => setPhase('summary')} onGo={setPhase} />
            </section>
          )}
          <PhaseBody phase={phase} knobs={knobs} />
        </div>
        <aside className="sticky top-4 w-72 shrink-0 space-y-4 self-start">
          <section aria-label="Militia status" className="bg-card border border-foreground/20 p-3">
            <h2 className="text-muted-foreground mb-2 text-xs tracking-widest uppercase">Militia · now → after week</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
              {militiaStatus(knobs).map((s) => (
                <div key={s.key} className="contents">
                  <dt className="text-muted-foreground">{s.label}</dt>
                  <dd className="text-right">
                    <span className="font-mono text-lg">{s.now}</span> <Trend stat={s} />
                    {s.note && <span className="text-muted-foreground block text-xs">{s.note}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          {phase !== 'summary' && (current.requirements.length > 0 || current.warnings.length > 0) && (
            <section aria-label="This phase" className="bg-card space-y-2 border border-foreground/20 p-3">
              <h2 className="text-muted-foreground text-xs tracking-widest uppercase">This phase</h2>
              <ul className="space-y-1">
                {current.requirements.map((r) => (
                  <RequirementItem key={r} text={r} />
                ))}
                {current.warnings.map((w) => (
                  <WarningItem key={w} text={w} />
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>

      <footer className="bg-background/95 sticky bottom-0 flex items-center gap-3 border-t border-foreground/15 px-5 py-3 pb-16 backdrop-blur">
        <Button variant="outline" size="lg" disabled={!prev} onClick={() => prev && setPhase(prev.phase)}>
          <ArrowLeft /> {prev ? phaseLabels[prev.phase] : 'Back'}
        </Button>
        <p className="text-muted-foreground flex-1 text-center text-sm">
          {phase === 'summary'
            ? confirmBlocker(knobs)
            : current.ready
              ? `${phaseLabels[phase]} is ready.`
              : `Complete the required rolls and decisions to finish ${phaseLabels[phase]}.`}
        </p>
        {next ? (
          <Button size="lg" onClick={() => setPhase(next.phase)}>
            {next.phase === 'summary' ? 'Review & confirm' : phaseLabels[next.phase]} <ArrowRight />
          </Button>
        ) : (
          <span className="w-32" />
        )}
      </footer>
    </main>
  );
}
