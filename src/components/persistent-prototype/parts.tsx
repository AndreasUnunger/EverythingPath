'use client';
// PROTOTYPE — pieces every Persistent variant shares: the decision choices,
// the Loyalty / officer check inputs, the buyoff amount, the table ending,
// the staged line, Rules Exception reasons and warnings. The variants disagree
// about where these live and what leads, not about what they show.

import { AlertTriangle, Check, Pencil, Scale, X } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { cn } from '~/lib/utils';
import {
  buyoffGp,
  type Check as CheckFact,
  type Decision,
  type DecisionKind,
  type Edit,
  eventInfo,
  type EventView,
  people,
  type Projection,
  signed,
  type Skill,
  skills,
  type State,
  week,
} from './mock';

export type PersistentProps = {
  state: State;
  view: Projection;
  edit: (edit: Edit) => void;
  disabled: boolean;
};

export function DieField({
  value,
  label,
  disabled,
  onValue,
  className,
}: {
  value: number | null | undefined;
  label: string;
  disabled?: boolean;
  onValue: (value: number | null) => void;
  className?: string;
}) {
  return (
    <Input
      aria-label={label}
      inputMode="numeric"
      placeholder="—"
      disabled={disabled}
      value={value ?? ''}
      className={cn('h-11 w-16 text-center font-mono text-lg', className)}
      onChange={(e) => {
        const t = e.target.value;
        if (!/^-?[0-9]*$/.test(t)) return;
        onValue(t === '' || t === '-' ? null : Number(t));
      }}
    />
  );
}

/** "+8 = 22 vs DC 20", with the modifier breakdown on a second line. */
export function BonusLine({
  check,
  compact,
}: {
  check: CheckFact;
  compact?: boolean;
}) {
  return (
    <span className="text-sm">
      <span className="font-mono">{signed(check.bonus)}</span>
      {check.total !== null && (
        <>
          {' '}
          = <strong className="font-mono">{check.total}</strong>
        </>
      )}
      <span className="text-muted-foreground"> vs DC {check.dc}</span>
      {!compact && check.modifiers.length > 0 && (
        <span className="text-muted-foreground block text-xs">
          {check.modifiers
            .map((m) => `${m.label} ${signed(m.value)}`)
            .join(' · ')}
        </span>
      )}
    </span>
  );
}

/** The one-line result of this week's decision on the event. */
export function StagedLine({
  event,
  className,
}: {
  event: EventView;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-sm',
        event.stagedTone === 'ends' && 'text-emerald-300',
        event.stagedTone === 'open' && 'text-primary',
        event.stagedTone === 'stays' && 'text-muted-foreground',
        className,
      )}
    >
      {event.stagedTone === 'ends' && <Check className="size-3.5" />}
      {event.staged}
    </span>
  );
}

export function Meta({
  event,
  className,
}: {
  event: EventView;
  className?: string;
}) {
  return (
    <span className={cn('text-muted-foreground text-xs', className)}>
      Since week {event.startedWeek} · {event.ageWeeks} week
      {event.ageWeeks === 1 ? '' : 's'}
      {event.order > 0 && ` · ${event.order + 1}nd that week`}
      {event.targets.length > 0 && ` · ${event.targets.join(' & ')}`}
    </span>
  );
}

export function IssuesFor({
  event,
  className,
}: {
  event: EventView;
  className?: string;
}) {
  if (!event.warnings.length) return null;
  return (
    <div className={cn('space-y-1', className)}>
      {event.warnings.map((w) => (
        <p
          key={w.text}
          role="note"
          className="flex items-start gap-1.5 text-sm text-amber-300"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {w.text}
        </p>
      ))}
    </div>
  );
}

/** Inline reason for a Rules Exception. */
export function ReasonField({
  label,
  value,
  disabled,
  onSave,
  onClear,
  placeholder = 'Why the table allows this',
}: {
  label: React.ReactNode;
  value: string;
  disabled: boolean;
  onSave: (reason: string) => void;
  onClear: () => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(!value);
  if (value && !editing)
    return (
      <p className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground inline-flex items-center gap-1">
          <Scale className="size-3.5" />
          {label}:
        </span>
        <span className="italic">“{value}”</span>
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          aria-label="Edit reason"
          disabled={disabled}
          onClick={() => setEditing(true)}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          aria-label="Clear reason"
          disabled={disabled}
          onClick={() => {
            setDraft('');
            onClear();
            setEditing(true);
          }}
        >
          <X className="size-3.5" />
        </Button>
      </p>
    );
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.trim()) return;
        onSave(draft.trim());
        setEditing(false);
      }}
    >
      <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-sm">
        <Scale className="size-3.5" />
        {label}
      </span>
      <Input
        value={draft}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        className="h-10 min-w-0 flex-1"
      />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={disabled || !draft.trim()}
      >
        Save
      </Button>
    </form>
  );
}

export function ExceptionsFor({
  event,
  edit,
  disabled,
  className,
}: {
  event: EventView;
  edit: PersistentProps['edit'];
  disabled: boolean;
  className?: string;
}) {
  if (!event.exceptions.length) return null;
  return (
    <div className={cn('space-y-2', className)}>
      {event.exceptions.map((e) => (
        <div
          key={e.key}
          className="space-y-1 border-l-2 border-amber-500/60 pl-3"
        >
          <p className="text-sm text-amber-300">{e.text}</p>
          <ReasonField
            label="Rules Exception"
            value={e.reason}
            disabled={disabled}
            onSave={(reason) => edit({ kind: 'exception', key: e.key, reason })}
            onClear={() =>
              edit({ kind: 'exception', key: e.key, reason: null })
            }
          />
        </div>
      ))}
    </div>
  );
}

/** Small playing-card style choice (the product rule for player choices). */
export function ChoiceCard({
  selected,
  onClick,
  title,
  note,
  disabled,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  title: React.ReactNode;
  note?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'bg-card flex min-h-14 touch-manipulation flex-col items-start rounded-md border-2 px-3 py-2 text-left transition-transform',
        selected
          ? 'border-primary ring-primary/40 -translate-y-0.5 shadow-md ring-2'
          : 'border-foreground/20',
        className,
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-semibold">
        {selected && <Check className="size-3.5" />}
        {title}
      </span>
      {note && (
        <span className="text-muted-foreground text-xs leading-snug">
          {note}
        </span>
      )}
    </button>
  );
}

/** The decision choices an event offers, with notes for the current situation. */
export function decisionChoices(event: EventView, view: Projection) {
  const info = eventInfo[event.type];
  const cooldown =
    view.lastBuyoffWeek !== null && week < view.lastBuyoffWeek + 4;
  const choices: { value: DecisionKind; title: string; note: string }[] = [
    { value: 'unattempted', title: 'Leave it', note: info.effect },
  ];
  if (info.mitigateLabel)
    choices.push({
      value: 'mitigate',
      title: info.mitigateLabel,
      note: info.mitigation!,
    });
  choices.push({
    value: 'buyoff',
    title: `Buy off · ${buyoffGp} gp`,
    note: cooldown
      ? `Last buyoff was week ${view.lastBuyoffWeek}, next allowed week ${view.lastBuyoffWeek! + 4}. Needs a Rules Exception.`
      : 'Once every four weeks, 2 × the minimum treasury.',
  });
  choices.push({
    value: 'end',
    title: 'Ended at the table',
    note: 'Record what happened. Needs a Rules Exception.',
  });
  return choices;
}

export function choose(
  event: EventView,
  kind: DecisionKind,
  edit: PersistentProps['edit'],
) {
  const keep = event.decision.kind === kind ? event.decision : {};
  const decision: Decision = { ...keep, kind };
  if (kind === 'buyoff' && decision.costGp == null) decision.costGp = buyoffGp;
  edit({ kind: 'decide', eventId: event.id, decision });
}

export function DecisionCards({
  event,
  view,
  edit,
  disabled,
  columns = 4,
  className,
}: {
  event: EventView;
  view: Projection;
  edit: PersistentProps['edit'];
  disabled: boolean;
  columns?: number;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={`${event.name} decision`}
      className={cn('grid gap-2', className)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {decisionChoices(event, view).map((c) => (
        <ChoiceCard
          key={c.value}
          selected={event.decision.kind === c.value}
          disabled={disabled}
          title={c.title}
          note={c.note}
          onClick={() => choose(event, c.value, edit)}
        />
      ))}
    </div>
  );
}

function update(
  event: EventView,
  patch: Partial<Decision>,
  edit: PersistentProps['edit'],
) {
  edit({
    kind: 'decide',
    eventId: event.id,
    decision: { ...event.decision, ...patch },
  });
}

/** The inputs behind the chosen decision: check, buyoff amount or table ending. */
export function DecisionInputs({
  event,
  edit,
  disabled,
  className,
}: {
  event: EventView;
  edit: PersistentProps['edit'];
  disabled: boolean;
  className?: string;
}) {
  const d = event.decision;
  if (d.kind === 'mitigate' && event.type === 'theft' && event.check)
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">Loyalty check</span>
          <span className="inline-flex items-center gap-1.5">
            <DieField
              value={d.die}
              label="Loyalty check die"
              disabled={disabled}
              onValue={(die) => update(event, { die }, edit)}
            />
            <span className="text-muted-foreground font-mono text-xs">d20</span>
          </span>
          <BonusLine check={event.check} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Overseer</span>
          <Select
            value={d.overseerId ?? 'none'}
            disabled={disabled}
            onValueChange={(v) =>
              update(event, { overseerId: v === 'none' ? null : v }, edit)
            }
          >
            <SelectTrigger className="h-9 w-56" aria-label="Overseer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No overseer</SelectItem>
              {people
                .filter((p) => p.role)
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} · {p.role} (+2)
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </label>
      </div>
    );
  if (d.kind === 'mitigate' && event.type === 'rivalry' && event.check)
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={d.officerId ?? ''}
            disabled={disabled}
            onValueChange={(officerId) => update(event, { officerId }, edit)}
          >
            <SelectTrigger className="h-10 w-60" aria-label="Officer">
              <SelectValue placeholder="Officer" />
            </SelectTrigger>
            <SelectContent>
              {people.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} · {p.role ?? 'not an officer'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={d.skill ?? 'diplomacy'}
            disabled={disabled}
            onValueChange={(skill) =>
              update(event, { skill: skill as Skill }, edit)
            }
          >
            <SelectTrigger className="h-10 w-36" aria-label="Skill">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {skills.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-muted-foreground text-xs">skill bonus</span>
            <DieField
              value={d.skillBonus}
              label="Skill bonus"
              className="h-10 w-14 text-base"
              disabled={disabled}
              onValue={(skillBonus) => update(event, { skillBonus }, edit)}
            />
          </span>
          <span className="inline-flex items-center gap-1.5">
            <DieField
              value={d.die}
              label="Officer check die"
              disabled={disabled}
              onValue={(die) => update(event, { die }, edit)}
            />
            <span className="text-muted-foreground font-mono text-xs">d20</span>
          </span>
          <BonusLine check={event.check} compact />
        </div>
      </div>
    );
  if (d.kind === 'buyoff')
    return (
      <div
        className={cn('flex flex-wrap items-center gap-3 text-sm', className)}
      >
        <span>
          Rules cost <strong className="font-mono">{buyoffGp} gp</strong>
          <span className="text-muted-foreground"> (2 × minimum treasury)</span>
        </span>
        <label className="inline-flex items-center gap-1.5">
          <span className="text-muted-foreground">Recorded</span>
          <DieField
            value={d.costGp}
            label="Recorded buyoff cost"
            className="w-20 text-base"
            disabled={disabled}
            onValue={(costGp) => update(event, { costGp }, edit)}
          />
          <span className="text-muted-foreground">gp</span>
        </label>
      </div>
    );
  if (d.kind === 'end')
    return (
      <EndingField
        className={className}
        value={d.outcome ?? ''}
        disabled={disabled}
        onSave={(outcome) => update(event, { outcome }, edit)}
      />
    );
  return null;
}

function EndingField({
  value,
  disabled,
  onSave,
  className,
}: {
  value: string;
  disabled: boolean;
  onSave: (outcome: string) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <form
      className={cn('flex items-center gap-2', className)}
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft.trim());
      }}
    >
      <span className="text-muted-foreground shrink-0 text-sm">
        How it ended
      </span>
      <Input
        value={draft}
        disabled={disabled}
        placeholder="What happened at the table"
        onChange={(e) => setDraft(e.target.value)}
        className="h-10 min-w-0 flex-1"
      />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={disabled || draft.trim() === value}
      >
        Save
      </Button>
    </form>
  );
}

export function ClearDecision({
  event,
  edit,
  disabled,
  className,
}: {
  event: EventView;
  edit: PersistentProps['edit'];
  disabled: boolean;
  className?: string;
}) {
  if (event.decision.kind === 'unattempted' || event.endedElsewhere)
    return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn('text-muted-foreground', className)}
      disabled={disabled}
      onClick={() =>
        edit({ kind: 'decide', eventId: event.id, decision: null })
      }
    >
      <X className="size-3.5" /> Clear decision
    </Button>
  );
}

/** Shown instead of the decision when another phase already ends the event. */
export function EndedElsewhere({ event }: { event: EventView }) {
  return (
    <p className="text-sm">
      <span className="text-emerald-300">Ends this week</span>
      <span className="text-muted-foreground">
        {' '}
        · staged by {event.endedElsewhere}. Change it in Activity.
      </span>
    </p>
  );
}

/** "Buyoff available · 160 gp · next after this week: week 18" */
export function buyoffSummary(view: Projection) {
  const cooldown =
    view.lastBuyoffWeek !== null && week < view.lastBuyoffWeek + 4;
  const head = cooldown
    ? `Buyoff waits until week ${view.lastBuyoffWeek! + 4}`
    : view.lastBuyoffWeek === null
      ? 'First buyoff available now'
      : 'Buyoff available';
  const next = view.buyoffsStaged
    ? `after this week’s ${view.buyoffsStaged > 1 ? `${view.buyoffsStaged} buyoffs` : 'buyoff'}: week ${view.nextBuyoffWeek}`
    : cooldown
      ? `week ${view.nextBuyoffWeek}`
      : `week ${week + 4} once one is used`;
  return { cooldown, head, cost: `${buyoffGp} gp`, next };
}
