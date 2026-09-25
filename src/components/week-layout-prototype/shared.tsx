'use client';
// PROTOTYPE — rough phase bodies shared by every variant. Their content is
// deliberately undesigned: #101 settles only the frame around them.

import { AlertTriangle, ArrowDown, ArrowUp, Check, CircleDot, Loader2, Users, X } from 'lucide-react';
import type React from 'react';
import { cn } from '~/lib/utils';
import {
  confirmBlocker,
  canConfirm,
  feedbackText,
  type Feedback,
  type Knobs,
  type Phase,
  type Stat,
  weekRequirements,
  weekWarnings,
  phaseLabels,
} from './mock';
import { Button } from '~/components/ui/button';

function Rough({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="relative border border-dashed border-foreground/30 p-4 pt-6">
      <span className="bg-background text-muted-foreground absolute -top-2.5 left-3 px-1 font-mono text-sm">
        {label} · content designed later
      </span>
      {children}
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card flex min-h-12 items-center gap-3 border border-foreground/15 px-3 py-2 text-sm">
      {children}
    </div>
  );
}

function Die({ value }: { value?: number }) {
  return (
    <span className="bg-input inline-flex size-10 items-center justify-center border border-foreground/20 font-mono text-xl">
      {value ?? '–'}
    </span>
  );
}

export function PhaseBody({ phase, knobs }: { phase: Phase; knobs: Knobs }) {
  const busy = knobs.feedback === 'confirming';
  return (
    <div className={cn(busy && 'pointer-events-none opacity-50')} aria-disabled={busy}>
      {phase === 'upkeep' && (
        <Rough label="Upkeep">
          <div className="space-y-2">
            <Row>
              <span className="flex-1">Attrition Loyalty check · DC 14</span>
              <Die value={23} /> <span className="font-mono text-lg">+6 = 29</span>
            </Row>
            <Row>
              <span className="flex-1">Attrition training check · DC 12</span>
              <Die value={11} /> <span className="font-mono text-lg">+4 = 15</span>
            </Row>
            <Row>
              <span className="flex-1">Disabled team: Ashen Scouts</span>
              <Button size="sm" variant="outline">Recover</Button>
              <Button size="sm" variant="outline">Leave</Button>
              <Button size="sm" variant="outline">Remove</Button>
            </Row>
            <Row>
              <span className="flex-1">Missing team: Night Runners · return die</span>
              <Die value={14} />
            </Row>
            <Row>
              <span className="flex-1">Treasury transfers</span>
              <Button size="sm" variant="outline">Stage transfer</Button>
            </Row>
          </div>
        </Rough>
      )}
      {phase === 'activity' && (
        <Rough label="Activity">
          <p className="text-muted-foreground mb-2 text-sm">Action deck</p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {['Earn Gold', 'Drill Militia', 'Recruit Team', 'Strike Team', 'Gather Information', 'Reduce Danger', 'Lie Low', 'Covert Action', 'Secure Cache'].map((name) => (
              <div key={name} className="bg-card flex h-32 w-24 shrink-0 items-end border border-foreground/30 p-2 text-xs">
                {name}
              </div>
            ))}
          </div>
          <p className="text-muted-foreground mt-3 mb-2 text-sm">Action Slots</p>
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
            {['Drill Militia · Iron Wardens', 'Earn Gold · (choose team)', 'Gather Information · d20 –', 'Recruit Team · over allowance'].map((s, i) => (
              <div key={s} className="bg-card min-h-28 border border-foreground/30 p-2 text-sm">
                <p className="text-muted-foreground font-mono">Action Slot {i + 1}</p>
                <p>{s}</p>
              </div>
            ))}
          </div>
        </Rough>
      )}
      {phase === 'event' && (
        <Rough label="Event">
          <div className="space-y-2">
            <Row>
              <span className="flex-1">Event chance 35% · roll d100</span>
              <Die />
            </Row>
            <Row>
              <span className="flex-1">Event 1 · Awaiting roll</span>
              <Button size="sm" variant="outline">Add rolled event</Button>
            </Row>
            <Row>
              <span className="flex-1">Automatic event: Guarantee Event (Action Slot 3)</span>
              <Button size="sm" variant="outline">Add automatic event</Button>
            </Row>
          </div>
        </Rough>
      )}
      {phase === 'persistent' && (
        <Rough label="Persistent">
          <p className="text-muted-foreground mb-2 text-sm">Oldest first · first buyoff available · 60 gp</p>
          <Row>
            <span className="flex-1">Theft · started week 9 · 5 weeks</span>
            <Button size="sm" variant="outline">Leave unattempted</Button>
            <Button size="sm" variant="outline">Attempt mitigation</Button>
            <Button size="sm" variant="outline">Buy off</Button>
          </Row>
        </Rough>
      )}
      {phase === 'summary' && (
        <Rough label="Summary">
          <div className="grid grid-cols-2 gap-3">
            {['Rules Baseline', 'Final preview'].map((title, i) => (
              <div key={title} className="bg-card border border-foreground/15 p-3 text-sm">
                <p className="font-semibold">{title}</p>
                <p>Training {i ? 45 : 45} · Treasury {i ? '96 gp' : '86 gp'} · Week 15</p>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            <Row><span className="flex-1">Rules Exceptions (1)</span></Row>
            <Row>
              <span className="flex-1">Table Adjustments (1): +10 gp treasury · “Ekkerd reward”</span>
              <Button size="sm" variant="outline">Add adjustment</Button>
            </Row>
            <Row><span className="flex-1">Weekly consequences by phase</span></Row>
          </div>
        </Rough>
      )}
    </div>
  );
}

export function FeedbackIcon({ feedback }: { feedback: Feedback }) {
  if (feedback === 'pending' || feedback === 'confirming')
    return <Loader2 className="size-4 animate-spin" />;
  if (feedback === 'failed') return <X className="text-destructive size-4" />;
  if (feedback === 'saved') return <Check className="size-4" />;
  return <CircleDot className="size-4 opacity-50" />;
}

export function RemoteEditNote({ where }: { where?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <Users className="size-4" /> Another player changed {where ?? 'Activity'}
    </span>
  );
}

export function Trend({ stat }: { stat: Stat }) {
  if (!stat.forecast) return null;
  const Icon = stat.trend === 'down' ? ArrowDown : ArrowUp;
  return (
    <span className="text-muted-foreground inline-flex items-center gap-0.5">
      <Icon className="size-3" />
      {stat.forecast}
    </span>
  );
}

export function WarningItem({ text, phase }: { text: string; phase?: Phase }) {
  return (
    <li className="flex gap-2 text-sm">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>
        {phase && <span className="text-muted-foreground">{phaseLabels[phase]}: </span>}
        {text}
      </span>
    </li>
  );
}

export function RequirementItem({ text, phase, onGo }: { text: string; phase?: Phase; onGo?: () => void }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <CircleDot className="mt-0.5 size-4 shrink-0" />
      <span className="flex-1">
        {phase && <span className="text-muted-foreground">{phaseLabels[phase]}: </span>}
        {text}
      </span>
      {onGo && (
        <button className="underline underline-offset-2" onClick={onGo}>
          Go
        </button>
      )}
    </li>
  );
}

/** The confirm control and its stale-review alert. Variants decide where it lives. */
export function ConfirmBlock({
  knobs,
  onReview,
  onGo,
  compact,
}: {
  knobs: Knobs;
  onReview: () => void;
  onGo: (phase: Phase) => void;
  compact?: boolean;
}) {
  const requirements = weekRequirements(knobs);
  const warnings = weekWarnings(knobs);
  return (
    <div className="space-y-3">
      <p>
        {knobs.feedback === 'pending'
          ? 'Review will be ready when your changes are saved.'
          : requirements.length === 0
            ? 'The week is ready for confirmation.'
            : 'Some rolls or decisions still need attention.'}
      </p>
      {!compact && requirements.length > 0 && (
        <section aria-label="Required decisions">
          <h3 className="font-medium">Required decisions</h3>
          <ul className="mt-1 space-y-1">
            {requirements.map((r) => (
              <RequirementItem key={r.text} {...r} onGo={() => onGo(r.phase)} />
            ))}
          </ul>
        </section>
      )}
      {!compact && warnings.length > 0 && (
        <section aria-label="Warnings">
          <h3 className="font-medium">Warnings</h3>
          <ul className="mt-1 space-y-1">
            {warnings.map((w) => (
              <WarningItem key={w.text} {...w} />
            ))}
          </ul>
        </section>
      )}
      {knobs.reviewRequired && (
        <div role="alert" className="border-destructive space-y-2 border p-3 text-sm">
          <p>
            The week could not be confirmed as reviewed. Review the updated outcomes and table
            decisions before trying again.
          </p>
          <Button size="sm" onClick={onReview}>
            Review updated week
          </Button>
        </div>
      )}
      <Button size="lg" className="w-full" disabled={!canConfirm(knobs)}>
        {knobs.feedback === 'confirming' ? 'Confirming the week…' : 'Confirm week'}
      </Button>
      {!canConfirm(knobs) && (
        <p className="text-muted-foreground text-center text-sm">{confirmBlocker(knobs)}</p>
      )}
    </div>
  );
}

export { feedbackText };
