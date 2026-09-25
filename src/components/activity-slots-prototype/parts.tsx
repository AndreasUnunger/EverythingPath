'use client';
// PROTOTYPE — pieces every Activity variant shares: the playing card, team
// chips, the allowance meter and the rough choice details. The variants
// disagree about where these live, not about what they show.

import { AlertTriangle, Check, CircleDot, Sparkles, Users } from 'lucide-react';
import type React from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { cn } from '~/lib/utils';
import {
  type Action,
  allowance,
  availability,
  checkBonus,
  type Edit,
  rankAllowance,
  rank,
  readyTeamsFor,
  settlements,
  type SlotFacts,
  type State,
  type Team,
  teams,
  teamStatusText,
  teamsFor,
  used,
} from './mock';

export type ActivityProps = {
  state: State;
  edit: (edit: Edit) => void;
  disabled: boolean;
};

const categoryStripe: Record<string, string> = {
  Espionage: 'bg-purple-500/70',
  Intelligence: 'bg-sky-500/70',
  Military: 'bg-red-500/70',
  Treasury: 'bg-amber-500/70',
};

function stripeFor(action: Action) {
  const team = teamsFor(action)[0];
  return team ? categoryStripe[team.category] : 'bg-foreground/30';
}

/** A playing-card face for an action. Tap-safe: no touch-action override. */
export function ActionCard({
  action,
  selected,
  onClick,
  size = 'md',
  className,
  handle,
  badge,
  teamNote,
}: {
  action: Action;
  selected?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md';
  className?: string;
  handle?: React.ReactNode;
  badge?: React.ReactNode;
  /** Replaces the ready-team chips, e.g. inside a team's own row. */
  teamNote?: string;
}) {
  const kind = availability(action);
  const ready = readyTeamsFor(action);
  return (
    <div
      className={cn(
        'bg-card relative flex flex-col overflow-hidden rounded-lg border-2 text-left shadow-sm transition-transform',
        selected ? 'border-primary ring-primary/40 -translate-y-1.5 shadow-lg ring-2' : 'border-foreground/25',
        kind === 'unavailable' && !selected && 'opacity-60',
        size === 'md' ? 'min-h-36' : 'min-h-24',
        className,
      )}
    >
      <span aria-hidden className={cn('h-1.5 w-full', stripeFor(action))} />
      <button
        type="button"
        aria-pressed={selected}
        onClick={onClick}
        className="flex flex-1 touch-manipulation flex-col gap-1 p-2.5 text-left select-none"
      >
        <span className={cn('leading-tight font-semibold', size === 'md' ? 'text-base' : 'text-sm')}>
          {action.name}
        </span>
        {size === 'md' && <span className="text-muted-foreground text-xs leading-snug">{action.effect}</span>}
        <span className="mt-auto flex flex-wrap gap-1 pt-1 text-xs">
          {teamNote !== undefined && <span className="text-muted-foreground">{teamNote}</span>}
          {teamNote === undefined && kind === 'no-team' && <span className="text-muted-foreground">No team needed</span>}
          {teamNote === undefined && kind === 'team' &&
            ready.map((t) => (
              <span key={t.id} className="bg-foreground/10 inline-flex items-center gap-1 rounded px-1">
                <Users className="size-3" />
                {t.name}
              </span>
            ))}
          {teamNote === undefined && kind === 'unavailable' && <span className="text-muted-foreground">No ready team</span>}
        </span>
        {size === 'md' && (action.check || action.cost) && (
          <span className="text-muted-foreground font-mono text-[11px]">
            {[action.check, action.cost].filter(Boolean).join(' · ')}
          </span>
        )}
      </button>
      {handle}
      {badge && <span className="absolute top-2.5 right-2">{badge}</span>}
    </div>
  );
}

export function TeamChip({ team, note, className }: { team: Team; note?: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-sm',
        team.status !== 'ready' && 'border-dashed opacity-70',
        className,
      )}
    >
      <span aria-hidden className={cn('size-2 rounded-full', categoryStripe[team.category])} />
      {team.name}
      {note && <span className="text-muted-foreground text-xs">{note}</span>}
    </span>
  );
}

export function StrategistBadge() {
  return (
    <span className="bg-primary/15 text-primary inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium">
      <Sparkles className="size-3" /> Strategist +2
    </span>
  );
}

export function SlotStatus({ facts }: { facts: SlotFacts }) {
  if (!facts.slot.choice) return <span className="text-muted-foreground text-xs">Empty</span>;
  if (facts.requirements.length)
    return (
      <span className="inline-flex items-center gap-1 text-xs">
        <CircleDot className="size-3.5" /> {facts.requirements.length} to do
      </span>
    );
  if (facts.warnings.length)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
        <AlertTriangle className="size-3.5" /> {facts.warnings.length}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <Check className="size-3.5" /> Ready
    </span>
  );
}

/** Actions used against the allowance, with the Strategist bonus called out. */
export function AllowanceMeter({ state, compact }: { state: State; compact?: boolean }) {
  const n = used(state);
  const boxes = Math.max(allowance, state.slots.length);
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: boxes }, (_, i) => (
          <span
            key={i}
            className={cn(
              'h-5 w-4 border',
              i >= allowance ? 'border-dashed border-amber-600' : 'border-foreground/40',
              state.slots[i]?.choice && (i >= allowance ? 'bg-amber-500/60' : 'bg-primary/70'),
              i === allowance - 1 && 'ring-primary/50 ring-1 ring-offset-1',
            )}
          />
        ))}
      </div>
      <p className="text-sm">
        <span className="font-mono text-lg">
          {n} of {allowance}
        </span>{' '}
        actions
        {!compact && (
          <span className="text-muted-foreground">
            {' '}
            · {rankAllowance} from rank {rank} + 1 Strategist
          </span>
        )}
      </p>
    </div>
  );
}

export function WarningLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-1.5 text-sm text-amber-700 dark:text-amber-300">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function RequirementLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-1.5 text-sm">
      <CircleDot className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Team choice as cards: teams that can act first, the rest behind a toggle. */
export function TeamPicker({
  facts,
  edit,
  disabled,
  state,
}: {
  facts: SlotFacts;
  edit: ActivityProps['edit'];
  disabled: boolean;
  state: State;
}) {
  const action = facts.action!;
  if (!action.teamTypes) return null;
  const eligible = teamsFor(action);
  const others = teams.filter((t) => !eligible.includes(t));
  const busy = (team: Team) => {
    const i = state.slots.findIndex((s) => s.choice?.teamId === team.id && s.slotId !== facts.slot.slotId);
    return i === -1 ? null : `acts in Action Slot ${i + 1}`;
  };
  const card = (team: Team) => {
    const selected = facts.slot.choice?.teamId === team.id;
    return (
      <button
        key={team.id}
        type="button"
        disabled={disabled}
        aria-pressed={selected}
        onClick={() => edit({ kind: 'team', slotId: facts.slot.slotId, teamId: selected ? undefined : team.id })}
        className={cn(
          'flex min-h-16 touch-manipulation flex-col items-start gap-0.5 rounded-lg border-2 p-2 text-left text-sm',
          selected ? 'border-primary bg-primary/10' : 'border-foreground/20',
          team.status !== 'ready' && 'border-dashed',
        )}
      >
        <span className="font-medium">{team.name}</span>
        <span className="text-muted-foreground text-xs">
          {team.type} · tier {team.tier}
        </span>
        <span className="text-xs">{team.status !== 'ready' ? teamStatusText[team.status] : (busy(team) ?? 'Free')}</span>
      </button>
    );
  };
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">Team</legend>
      <div className="grid grid-cols-3 gap-2">{eligible.map(card)}</div>
      {eligible.length === 0 && <p className="text-muted-foreground text-sm">None of your teams can take this action.</p>}
      <details>
        <summary className="text-muted-foreground cursor-pointer text-xs">Other teams ({others.length})</summary>
        <div className="mt-2 grid grid-cols-3 gap-2">{others.map(card)}</div>
      </details>
    </fieldset>
  );
}

/** Team choice as a plain dropdown: eligible teams first, then the rest below a divider (still selectable). */
export function TeamSelect({
  facts,
  edit,
  disabled,
  state,
}: {
  facts: SlotFacts;
  edit: ActivityProps['edit'];
  disabled: boolean;
  state: State;
}) {
  const action = facts.action!;
  if (!action.teamTypes) return null;
  const eligible = teamsFor(action);
  const others = teams.filter((t) => !eligible.includes(t));
  const note = (team: Team) => {
    if (team.status !== 'ready') return teamStatusText[team.status].split(' · ')[0];
    const i = state.slots.findIndex((s) => s.choice?.teamId === team.id && s.slotId !== facts.slot.slotId);
    return i === -1 ? 'Free' : `Acts in Action Slot ${i + 1}`;
  };
  const item = (team: Team) => (
    <SelectItem key={team.id} value={team.id} className="min-h-11">
      {team.name}
      <span className="text-muted-foreground">
        {' '}
        · {team.type} {team.tier} · {note(team)}
      </span>
    </SelectItem>
  );
  return (
    <label className="block space-y-1">
      <span className="text-sm font-semibold">Team</span>
      <Select
        value={facts.slot.choice?.teamId ?? ''}
        disabled={disabled}
        onValueChange={(teamId) =>
          edit({ kind: 'team', slotId: facts.slot.slotId, teamId: teamId === '__none' ? undefined : teamId })
        }
      >
        <SelectTrigger className="h-12 w-full max-w-md">
          <SelectValue placeholder="Choose a team" />
        </SelectTrigger>
        <SelectContent className="z-[70]">
          <SelectGroup>
            <SelectLabel>Can take {action.name}</SelectLabel>
            {eligible.map(item)}
            {eligible.length === 0 && <SelectLabel className="font-normal">None of your teams</SelectLabel>}
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Other teams</SelectLabel>
            {others.map(item)}
          </SelectGroup>
          <SelectSeparator />
          <SelectItem value="__none" className="min-h-11">
            No team
          </SelectItem>
        </SelectContent>
      </Select>
    </label>
  );
}

/** Everything a staged choice needs, rough. Real fields come from the choice schema. */
export function ChoiceDetails({
  facts,
  state,
  edit,
  disabled,
  hideTeam,
  hideClear,
  teamControl = 'cards',
}: {
  facts: SlotFacts;
  state: State;
  edit: ActivityProps['edit'];
  disabled: boolean;
  hideTeam?: boolean;
  hideClear?: boolean;
  teamControl?: 'cards' | 'select';
}) {
  const { action, slot } = facts;
  if (!action || !slot.choice) return null;
  const choice = slot.choice;
  return (
    <div className={cn('space-y-4', disabled && 'pointer-events-none opacity-50')}>
      {facts.requirements.map((r) => (
        <RequirementLine key={r}>{r}</RequirementLine>
      ))}
      {facts.warnings.map((w) => (
        <WarningLine key={w}>{w}</WarningLine>
      ))}
      {!hideTeam &&
        (teamControl === 'select' ? (
          <TeamSelect facts={facts} state={state} edit={edit} disabled={disabled} />
        ) : (
          <TeamPicker facts={facts} state={state} edit={edit} disabled={disabled} />
        ))}
      {action.check && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Check · {action.check} · 1d20</legend>
          <div className="flex items-center gap-3">
            <Input
              aria-label={`${action.name} check die`}
              inputMode="numeric"
              className="h-12 w-20 text-center font-mono text-xl"
              value={choice.roll ?? ''}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                edit({ kind: 'roll', slotId: slot.slotId, roll: Number.isNaN(n) ? undefined : n });
              }}
            />
            <span className="font-mono text-lg">
              + {checkBonus(facts)} = {facts.checkTotal ?? '–'}
            </span>
          </div>
          <p className="text-muted-foreground text-xs">
            Rank and focus +5 · Officers +2{facts.strategist && ' · Strategist +2'}
          </p>
          <details>
            <summary className="text-muted-foreground cursor-pointer text-xs">Sources and modifiers</summary>
            <p className="text-muted-foreground mt-1 text-xs">
              Settlement support, available bonuses, custom table modifier with reason. (Unchanged from today.)
            </p>
          </details>
        </fieldset>
      )}
      {action.cost && <p className="text-sm">Calculated cost: {action.cost}</p>}
      {facts.warnings.length > 0 && (
        <label className="block space-y-1 rounded-md border border-amber-500 p-2 text-sm">
          <span>Rules Exception reason (allows this choice without changing its outcome)</span>
          <Input
            value={choice.exceptionReason ?? ''}
            placeholder="Why the table allows it"
            onChange={(e) => edit({ kind: 'exception', slotId: slot.slotId, reason: e.target.value || undefined })}
          />
        </label>
      )}
      {!hideClear && (
        <Button variant="outline" disabled={disabled} onClick={() => edit({ kind: 'clear', slotId: slot.slotId })}>
          Clear {action.name}
        </Button>
      )}
    </div>
  );
}

export function SettlementPicker({ state, edit, disabled }: ActivityProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Operating from</span>
      {settlements.map((o) => (
        <button
          key={o.id}
          type="button"
          disabled={disabled}
          aria-pressed={state.settlementId === o.id}
          onClick={() => edit({ kind: 'settlement', settlementId: o.id })}
          className={cn(
            'min-h-10 touch-manipulation rounded-md border-2 px-3',
            state.settlementId === o.id ? 'border-primary bg-primary/10' : 'border-foreground/20',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function RemoteMark() {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-sky-500/15 px-1.5 py-0.5 text-xs text-sky-700 dark:text-sky-300">
      <Users className="size-3" /> Another player
    </span>
  );
}
