'use client';
// PROTOTYPE — pieces every variant shares: the settled phase bodies, the
// reference panel's contents, the step glyph, the confirm block and the
// small top-bar bits. Variants decide where each piece goes at each width.

import {
  AlertTriangle,
  Check,
  ChevronDown,
  CircleDot,
  Flag,
  Loader2,
  Lock,
  Users,
  Wrench,
} from 'lucide-react';
import type React from 'react';
import { VariantE as ActivityBody } from '~/components/activity-slots-prototype/variant-e';
import { VariantA as EventBody } from '~/components/event-prototype/variant-a';
import { KeepIcon } from '~/components/keepIcon';
import { VariantA as PersistentBody } from '~/components/persistent-prototype/variant-a';
import { VariantB as SummaryBody } from '~/components/summary-prototype/variant-b';
import { Avatar, AvatarFallback } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
} from '~/components/ui/select';
import { VariantA as UpkeepBody } from '~/components/upkeep-prototype/variant-a';
import { cn } from '~/lib/utils';
import {
  campaigns,
  organizations,
  type Knobs,
  type Phase,
  phaseLabels,
  type Step,
  type WeekModel,
} from './model';

export type VariantProps = {
  model: WeekModel;
  knobs: Knobs;
  phase: Phase;
  setPhase: (phase: Phase) => void;
};

/* ---------- top bar bits ---------- */

export function Brand({ className }: { className?: string }) {
  return <KeepIcon className={cn('size-7 shrink-0', className)} />;
}

export function CampaignSwitcher({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <Select value="c1">
      <SelectTrigger
        className={cn(
          'min-h-10 border-0 bg-transparent px-1 shadow-none dark:bg-transparent [&>svg]:hidden',
          compact ? 'max-w-[11rem] text-sm' : 'text-base',
          className,
        )}
      >
        <span className="truncate">Ironfang Invasion</span>
        <ChevronDown className="size-4 shrink-0 opacity-60" />
      </SelectTrigger>
      <SelectContent>
        {campaigns.map((c) => (
          <SelectItem key={c.id} value={c.id} className="min-h-11">
            {c.name}
          </SelectItem>
        ))}
        <SelectSeparator />
        <SelectItem value="__all" className="min-h-11">
          All campaigns…
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

export function OrganizationSwitcher({ className }: { className?: string }) {
  return (
    <Select value="o1">
      <SelectTrigger
        aria-label="Organization"
        className={cn('min-h-10 border-0 bg-transparent px-1 text-sm shadow-none dark:bg-transparent [&>svg]:hidden', className)}
      >
        <span className="text-muted-foreground truncate">Thursday table</span>
        <ChevronDown className="size-4 shrink-0 opacity-60" />
      </SelectTrigger>
      <SelectContent>
        {organizations.map((o) => (
          <SelectItem key={o.id} value={o.id} className="min-h-11">
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function Account() {
  return (
    <Avatar className="size-8">
      <AvatarFallback>AU</AvatarFallback>
    </Avatar>
  );
}

export function SaveStatus({ knobs, compact }: { knobs: Knobs; compact?: boolean }) {
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center gap-1.5 text-sm">
      {knobs.confirming ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
      {!compact && <span>{knobs.confirming ? 'Confirming the week…' : 'Saved'}</span>}
    </span>
  );
}

export function RemoteNote({ knobs, compact }: { knobs: Knobs; compact?: boolean }) {
  if (!knobs.remote) return null;
  return (
    <span className="inline-flex items-center gap-1 text-sm" title="Another player changed Activity">
      <Users className="size-4" />
      {!compact && 'Another player changed Activity'}
    </span>
  );
}

export function MaintenanceBanner({ knobs }: { knobs: Knobs }) {
  if (!knobs.maintenance) return null;
  return (
    <div role="status" className="flex items-center gap-2 border-b border-amber-500/50 bg-amber-500/15 px-4 py-2 text-sm">
      <Wrench className="size-4 shrink-0" />
      <span>Maintenance in progress. Changes are paused for a few minutes; everything stays readable.</span>
    </div>
  );
}

/* ---------- stepper ---------- */

export function StepGlyph({ step, active, className }: { step: Step; active?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'flex size-7 shrink-0 items-center justify-center border font-mono text-base',
        active ? 'border-current' : 'border-foreground/40',
        className,
      )}
    >
      {step.locked ? (
        <Lock className="size-3.5" />
      ) : step.key === 'summary' ? (
        <Flag className="size-3.5" />
      ) : step.count ? (
        step.count
      ) : (
        <Check className="size-4" />
      )}
    </span>
  );
}

export function usePrevNext(model: WeekModel, phase: Phase) {
  const available = model.steps.filter((s) => !s.locked);
  const index = available.findIndex((s) => s.key === phase);
  return { prev: available[index - 1], next: available[index + 1], index, total: available.length };
}

export function readinessLine(model: WeekModel, phase: Phase) {
  const step = model.steps.find((s) => s.key === phase)!;
  if (phase === 'summary') return model.blocker ?? 'The week is ready to confirm.';
  return step.count
    ? `Complete the rolls and decisions to finish ${phaseLabels[phase]}.`
    : `${phaseLabels[phase]} is ready.`;
}

/* ---------- reference panel contents ---------- */

export function ReferenceValues({ model, className, dense }: { model: WeekModel; className?: string; dense?: boolean }) {
  return (
    <section aria-label="Militia status" className={cn('bg-card border-foreground/20 border p-3', className)}>
      <h2 className="text-muted-foreground mb-2 text-xs tracking-widest uppercase">Militia · now → after week</h2>
      <dl className={cn('grid grid-cols-[auto_1fr] gap-x-3 text-sm', dense ? 'gap-y-0.5' : 'gap-y-1')}>
        {model.values.map((v) => (
          <div key={v.label} className="contents">
            <dt className="text-muted-foreground">{v.label}</dt>
            <dd className="text-right font-mono">
              {v.changed && v.now.length + v.after.length > 22 ? (
                <>
                  <span className="text-muted-foreground block text-xs">{v.now} →</span>
                  {v.after}
                </>
              ) : v.changed ? (
                <>
                  <span className="text-muted-foreground">{v.now}</span> → {v.after}
                </>
              ) : (
                v.now
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function ThisPhase({ model, phase, className }: { model: WeekModel; phase: Phase; className?: string }) {
  if (phase === 'summary') return null;
  const { requirements, warnings } = model.issues[phase];
  if (requirements.length === 0 && warnings.length === 0) {
    return (
      <section aria-label="This phase" className={cn('bg-card border-foreground/20 border p-3', className)}>
        <h2 className="text-muted-foreground text-xs tracking-widest uppercase">This phase</h2>
        <p className="mt-1 flex items-center gap-1.5 text-sm">
          <Check className="size-4" /> Nothing left to decide.
        </p>
      </section>
    );
  }
  return (
    <section aria-label="This phase" className={cn('bg-card border-foreground/20 space-y-2 border p-3', className)}>
      <h2 className="text-muted-foreground text-xs tracking-widest uppercase">This phase</h2>
      <ul className="space-y-1">
        {requirements.map((r) => (
          <li key={r} className="flex items-start gap-1.5 text-sm">
            <CircleDot className="text-primary mt-0.5 size-3.5 shrink-0" />
            <span>{r}</span>
          </li>
        ))}
        {warnings.map((w) => (
          <li key={w} className="flex items-start gap-1.5 text-sm text-amber-300">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>{w}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One line that stands in for the panel where there is no room for it. */
export function ReferenceGist({ model, phase }: { model: WeekModel; phase: Phase }) {
  const key = ['Training', 'Treasury'];
  const shown = model.values.filter((v) => key.includes(v.label));
  const count = phase === 'summary' ? model.openDecisions : model.issues[phase].requirements.length;
  const warnings = phase === 'summary' ? 0 : model.issues[phase].warnings.length;
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
      {shown.map((v) => (
        <span key={v.label} className="whitespace-nowrap">
          <span className="text-muted-foreground">{v.label} </span>
          <span className="font-mono">{v.changed ? `${v.now} → ${v.after}` : v.now}</span>
        </span>
      ))}
      {count > 0 && (
        <span className="text-primary inline-flex items-center gap-1 whitespace-nowrap">
          <CircleDot className="size-3.5" /> {count} to decide
        </span>
      )}
      {count === 0 && warnings > 0 && (
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-amber-300">
          <AlertTriangle className="size-3.5" /> {warnings} warning{warnings > 1 ? 's' : ''}
        </span>
      )}
    </span>
  );
}

/* ---------- confirm block and phase bodies ---------- */

export function ConfirmBlock({ model, knobs }: { model: WeekModel; knobs: Knobs }) {
  const { requirements, warnings } = model.summary.view;
  return (
    <section aria-label="Review the week" className="bg-card border-foreground/20 space-y-3 border p-4">
      <h2 className="text-lg font-semibold">Review the week</h2>
      {requirements.length > 0 && (
        <div>
          <h3 className="text-muted-foreground text-xs tracking-widest uppercase">Required decisions</h3>
          <ul className="mt-1 space-y-1">
            {requirements.map((r) => (
              <li key={r.id} className="flex items-start gap-1.5 text-sm">
                <CircleDot className="text-primary mt-0.5 size-3.5 shrink-0" />
                <span>
                  {r.text} <button className="underline underline-offset-2">Go to {phaseLabels[r.phase]} →</button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div>
          <h3 className="text-muted-foreground text-xs tracking-widest uppercase">Warnings</h3>
          <ul className="mt-1 space-y-1">
            {warnings.map((w) => (
              <li key={w.id} className="flex items-start gap-1.5 text-sm text-amber-300">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  {w.text} <span className="text-muted-foreground">· {phaseLabels[w.phase]}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" className="w-full sm:w-auto" disabled={knobs.confirming || model.blocker !== null}>
          <Flag /> Confirm week
        </Button>
        {model.blocker && <span className="text-muted-foreground text-sm">{model.blocker}</span>}
      </div>
    </section>
  );
}

export function PhaseBody({ model, knobs, phase }: { model: WeekModel; knobs: Knobs; phase: Phase }) {
  const disabled = knobs.confirming || knobs.maintenance;
  return (
    <div className={cn('space-y-4', disabled && 'opacity-70')}>
      {phase === 'upkeep' && <UpkeepBody state={model.upkeep.state} view={model.upkeep.view} edit={model.upkeep.edit} disabled={disabled} />}
      {phase === 'activity' && <ActivityBody state={model.activity.state} edit={model.activity.edit} disabled={disabled} />}
      {phase === 'event' && <EventBody state={model.event.state} view={model.event.view} edit={model.event.edit} disabled={disabled} />}
      {phase === 'persistent' && (
        <PersistentBody state={model.persistent.state} view={model.persistent.view} edit={model.persistent.edit} disabled={disabled} />
      )}
      {phase === 'summary' && (
        <>
          <ConfirmBlock model={model} knobs={knobs} />
          <SummaryBody view={model.summary.view} edit={model.summary.edit} disabled={disabled} />
        </>
      )}
    </div>
  );
}

export function PhaseHeading({ phase, children }: { phase: Phase; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h1 className="text-xl">{phaseLabels[phase]}</h1>
      {children}
    </div>
  );
}
