'use client';
// PROTOTYPE — Variant C: app-style. Phases are a bottom tab bar within thumb
// reach; Confirm is the last tab. A slim top bar shows three key numbers and
// expands to full militia status. "Needs attention" opens one drawer listing
// every decision and warning in the week, with jumps.

import { AlertTriangle, ChevronDown, ChevronUp, History, ListChecks } from 'lucide-react';
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
  reputation,
  setupNotesText,
  weekRequirements,
  weekWarnings,
  type Phase,
} from './mock';
import { ConfirmBlock, FeedbackIcon, PhaseBody, RemoteEditNote, RequirementItem, Trend, WarningItem } from './shared';
import type { VariantProps } from './types';

export const name = 'Bottom tabs + attention drawer';

export function VariantC({ knobs, phase, setPhase }: VariantProps) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [attentionOpen, setAttentionOpen] = useState(false);
  const phases = readiness(knobs);
  const stats = militiaStatus(knobs);
  const key = stats.filter((s) => ['training', 'treasury', 'notoriety'].includes(s.key));
  const requirements = weekRequirements(knobs);
  const warnings = weekWarnings(knobs);
  const jump = (p: Phase) => {
    setAttentionOpen(false);
    setPhase(p);
  };

  return (
    <main className="flex min-h-svh flex-col pb-40">
      <header className="bg-background/95 sticky top-0 z-10 border-b border-foreground/20 backdrop-blur">
        <div className="flex items-center gap-4 px-4 py-2">
          <h1 className="text-xl whitespace-nowrap">
            Week 14 <span className="text-muted-foreground">·</span> {phaseLabels[phase]}
          </h1>
          <button
            className="flex flex-1 items-center gap-4 border border-foreground/20 px-3 py-1.5 text-left hover:bg-foreground/10"
            aria-expanded={statusOpen}
            onClick={() => setStatusOpen(!statusOpen)}
          >
            {key.map((s) => (
              <span key={s.key} className="whitespace-nowrap text-sm">
                <span className="text-muted-foreground">{s.label} </span>
                <span className="font-mono text-lg">{s.now}</span> <Trend stat={s} />
              </span>
            ))}
            <span className="text-muted-foreground ml-auto flex items-center gap-1 text-xs">
              Militia {statusOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </span>
          </button>
          <span role="status" aria-live="polite" className="flex items-center gap-1 text-sm" title={feedbackText[knobs.feedback]}>
            <FeedbackIcon feedback={knobs.feedback} />
            <span className="hidden xl:inline">{knobs.feedback === 'idle' ? '' : feedbackText[knobs.feedback]}</span>
          </span>
          <Button variant="outline" onClick={() => setAttentionOpen(true)}>
            <ListChecks /> Attention
            <span className="bg-primary text-primary-foreground ml-1 px-1.5 font-mono">
              {requirements.length + warnings.length}
            </span>
          </Button>
        </div>
        {statusOpen && (
          <section aria-label="Militia status" className="bg-card grid grid-cols-5 gap-3 border-t border-foreground/15 px-4 py-3 text-sm">
            {stats.map((s) => (
              <div key={s.key}>
                <p className="text-muted-foreground text-xs">{s.label}</p>
                <p>
                  <span className="font-mono text-xl">{s.now}</span> <Trend stat={s} />
                </p>
                {s.note && <p className="text-muted-foreground text-xs">{s.note}</p>}
              </div>
            ))}
            <div>
              <p className="text-muted-foreground text-xs">Reputation</p>
              {reputation.map((r) => (
                <p key={r.name}>
                  {r.name} <span className="font-mono text-lg">{r.value}</span>
                </p>
              ))}
            </div>
            <div className="col-span-5 flex items-center gap-3 border-t border-foreground/10 pt-2">
              {knobs.setupNotes && <p className="flex-1"><span className="font-semibold">Setup notes: </span>{setupNotesText}</p>}
              <Button variant="outline" size="sm">
                <History /> Finished weeks
              </Button>
            </div>
          </section>
        )}
        {knobs.feedback === 'failed' && (
          <p role="alert" className="bg-destructive text-destructive-foreground px-4 py-2 text-sm">
            {feedbackText.failed}
          </p>
        )}
        {knobs.remoteEdit && (
          <p className="bg-foreground/10 px-4 py-1.5">
            <RemoteEditNote />
          </p>
        )}
      </header>

      <div className="flex-1 p-4">
        {phase === 'summary' ? (
          <div className="grid grid-cols-[1fr_20rem] gap-4">
            <PhaseBody phase="summary" knobs={knobs} />
            <div className="bg-card self-start border border-foreground/20 p-3">
              <ConfirmBlock knobs={knobs} onReview={() => setPhase('summary')} onGo={setPhase} />
            </div>
          </div>
        ) : (
          <PhaseBody phase={phase} knobs={knobs} />
        )}
      </div>

      <nav aria-label="Week phases" className="bg-card fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-foreground/25 pb-14 md:left-12">
        {phases.map((p) => {
          const active = p.phase === phase;
          const isConfirm = p.phase === 'summary';
          return (
            <button
              key={p.phase}
              disabled={!p.available}
              aria-current={active ? 'page' : undefined}
              onClick={() => setPhase(p.phase)}
              className={cn(
                'relative flex min-h-16 flex-col items-center justify-center gap-0.5 border-r border-foreground/10 disabled:opacity-35',
                active && 'bg-primary text-primary-foreground',
                isConfirm && !active && 'bg-foreground/10',
              )}
            >
              <span className="text-base">{isConfirm ? 'Confirm' : phaseLabels[p.phase]}</span>
              <span className={cn('text-xs', active ? 'opacity-80' : 'text-muted-foreground')}>
                {!p.available
                  ? 'None this week'
                  : isConfirm
                    ? confirmBlocker(knobs)
                    : p.ready
                      ? 'Ready'
                      : `${p.requirements.length} to decide`}
              </span>
              {p.warnings.length > 0 && (
                <AlertTriangle className="absolute top-2 right-3 size-4" aria-label={`${p.warnings.length} warnings`} />
              )}
              {!p.ready && p.available && !isConfirm && (
                <span className="absolute top-2 left-3 size-2 rounded-full bg-current" />
              )}
            </button>
          );
        })}
      </nav>

      <Sheet open={attentionOpen} onOpenChange={setAttentionOpen}>
        <SheetContent className="w-[26rem] overflow-y-auto sm:max-w-none">
          <SheetHeader>
            <SheetTitle>Needs attention</SheetTitle>
          </SheetHeader>
          <div className="space-y-5 px-4">
            {phases
              .filter((p) => p.requirements.length + p.warnings.length > 0)
              .map((p) => (
                <section key={p.phase}>
                  <h3 className="mb-1 flex items-center justify-between font-medium">
                    {phaseLabels[p.phase]}
                    <Button size="sm" variant="outline" onClick={() => jump(p.phase)}>
                      Go to {phaseLabels[p.phase]}
                    </Button>
                  </h3>
                  <ul className="space-y-1">
                    {p.requirements.map((r) => (
                      <RequirementItem key={r} text={r} />
                    ))}
                    {p.warnings.map((w) => (
                      <WarningItem key={w} text={w} />
                    ))}
                  </ul>
                </section>
              ))}
            {requirements.length + warnings.length === 0 && <p>Nothing needs attention. The week is ready to confirm.</p>}
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}
