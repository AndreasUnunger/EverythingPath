'use client';
// PROTOTYPE — Variant D: the whole week on one scrolling page. Phases are stacked
// sections; a sticky index on the left follows your scroll (that is your Phase
// View). Status ticker on top; a sticky Confirm bar at the bottom jumps to the
// first open decision until the week is ready.

import { AlertTriangle, Check, History } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import {
  canConfirm,
  confirmBlocker,
  feedbackText,
  militiaStatus,
  phaseLabels,
  readiness,
  setupNotesText,
  weekRequirements,
  type Phase,
} from './mock';
import { ConfirmBlock, FeedbackIcon, PhaseBody, RemoteEditNote, RequirementItem, Trend, WarningItem } from './shared';
import type { VariantProps } from './types';

export const name = 'One scroll + sticky index';

export function VariantD({ knobs, phase, setPhase }: VariantProps) {
  const phases = readiness(knobs);
  const sections = useRef(new Map<Phase, HTMLElement>());
  const first = weekRequirements(knobs)[0];

  const scrollTo = (p: Phase) => sections.current.get(p)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  useEffect(() => {
    sections.current.get(phase)?.scrollIntoView({ block: 'start' });
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setPhase(top.target.id.replace('phase-', '') as Phase);
      },
      { rootMargin: '-120px 0px -60% 0px' },
    );
    sections.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <main className="min-h-svh">
      <header className="bg-background/95 sticky top-0 z-10 flex items-center gap-5 border-b border-foreground/20 px-5 py-2 backdrop-blur">
        <h1 className="text-xl whitespace-nowrap">Week 14</h1>
        <dl aria-label="Militia status" className="flex flex-1 gap-5 overflow-x-auto text-sm">
          {militiaStatus(knobs)
            .filter((s) => ['training', 'treasury', 'notoriety', 'event'].includes(s.key))
            .map((s) => (
              <div key={s.key} className="whitespace-nowrap">
                <dt className="text-muted-foreground inline">{s.label} </dt>
                <dd className="inline">
                  <span className="font-mono text-lg">{s.now}</span> <Trend stat={s} />
                </dd>
              </div>
            ))}
        </dl>
        {knobs.remoteEdit && <RemoteEditNote />}
        <p role="status" aria-live="polite" className={cn('flex items-center gap-1 text-sm', knobs.feedback === 'failed' && 'text-destructive')}>
          <FeedbackIcon feedback={knobs.feedback} />
          {feedbackText[knobs.feedback]}
        </p>
      </header>

      <div className="flex gap-6 px-5">
        <nav aria-label="Week phases" className="sticky top-16 w-48 shrink-0 self-start space-y-1 py-4">
          {phases.map((p) => {
            const active = p.phase === phase;
            return (
              <button
                key={p.phase}
                aria-current={active ? 'location' : undefined}
                onClick={() => scrollTo(p.phase)}
                className={cn(
                  'flex min-h-11 w-full items-center gap-2 border-l-4 px-3 text-left',
                  active ? 'border-primary bg-foreground/10' : 'border-transparent hover:bg-foreground/5',
                  !p.available && 'text-muted-foreground',
                )}
              >
                <span className="flex-1">{p.phase === 'summary' ? 'Review' : phaseLabels[p.phase]}</span>
                {p.available && p.phase !== 'summary' && (p.ready ? <Check className="size-4" /> : <span className="font-mono text-lg">{p.requirements.length}</span>)}
                {p.warnings.length > 0 && <AlertTriangle className="size-4" />}
              </button>
            );
          })}
          <div className="space-y-2 pt-4">
            {knobs.setupNotes && (
              <details className="border-primary/40 bg-primary/10 border p-2 text-sm">
                <summary className="font-semibold">Setup notes</summary>
                <p className="mt-1">{setupNotesText}</p>
              </details>
            )}
            <Button variant="outline" size="sm" className="w-full">
              <History /> Finished weeks
            </Button>
          </div>
        </nav>

        <div className="min-w-0 flex-1 space-y-10 py-4 pb-48">
          {phases.map((p) => (
            <section
              key={p.phase}
              id={`phase-${p.phase}`}
              ref={(el) => {
                if (el) sections.current.set(p.phase, el);
              }}
              className="scroll-mt-16 space-y-3"
            >
              <h2 className="flex items-baseline gap-3 border-b border-foreground/20 pb-1 text-2xl">
                {p.phase === 'summary' ? 'Review & confirm' : phaseLabels[p.phase]}
                <span className="text-muted-foreground text-sm">
                  {!p.available ? 'No persistent events carried into this week' : p.phase === 'summary' ? '' : p.ready ? 'Ready' : `${p.requirements.length} to decide`}
                </span>
              </h2>
              {p.available && (
                <>
                  {(p.requirements.length > 0 || p.warnings.length > 0) && (
                    <ul className="space-y-1">
                      {p.requirements.map((r) => <RequirementItem key={r} text={r} />)}
                      {p.warnings.map((w) => <WarningItem key={w} text={w} />)}
                    </ul>
                  )}
                  {p.phase === 'summary' ? (
                    <div className="grid grid-cols-[1fr_20rem] gap-4">
                      <PhaseBody phase="summary" knobs={knobs} />
                      <div className="bg-card self-start border border-foreground/20 p-3">
                        <ConfirmBlock knobs={knobs} compact onReview={() => scrollTo('summary')} onGo={scrollTo} />
                      </div>
                    </div>
                  ) : (
                    <PhaseBody phase={p.phase} knobs={knobs} />
                  )}
                </>
              )}
            </section>
          ))}
        </div>
      </div>

      <footer className="bg-card fixed inset-x-0 bottom-0 z-20 flex items-center gap-4 border-t border-foreground/25 px-5 py-3 pb-16 md:left-12">
        <p className="flex-1 text-sm">
          {first ? (
            <>
              <span className="text-muted-foreground">Next open decision · {phaseLabels[first.phase]}: </span>
              {first.text}
            </>
          ) : (
            confirmBlocker(knobs)
          )}
        </p>
        {first && (
          <Button variant="outline" onClick={() => scrollTo(first.phase)}>
            Go to it
          </Button>
        )}
        <Button size="lg" variant={canConfirm(knobs) ? 'default' : 'outline'} onClick={() => scrollTo('summary')}>
          Review & confirm
        </Button>
      </footer>
    </main>
  );
}
