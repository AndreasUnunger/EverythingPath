'use client';
// PROTOTYPE — pieces every Upkeep variant shares: die fields, the bonus line,
// team decision cards, recovery cost, nearest settlement, boon, Rules
// Exception reason and transfers. The variants disagree about where these
// live, not about what they show.

import { AlertTriangle, Check, Pencil, Plus, Scale, X } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { cn } from '~/lib/utils';
import {
  captainFeats,
  type Edit,
  minimumGp,
  type Projection,
  type RollFact,
  settlements,
  signed,
  type State,
  type Team,
} from './mock';

export type UpkeepProps = {
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
        if (!/^[0-9]*$/.test(t)) return;
        onValue(t === '' ? null : Number(t));
      }}
    />
  );
}

/** One field for the roll's total, e.g. "7" for 2d4. */
export function DiceFields({ fact, edit, disabled, className }: { fact: RollFact; edit: UpkeepProps['edit']; disabled: boolean; className?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <DieField
        value={fact.dice[0]}
        className={className}
        label={fact.label}
        disabled={disabled}
        onValue={(value) => edit({ kind: 'roll', id: fact.id, dice: [value] })}
      />
      <span className="text-muted-foreground font-mono text-xs">
        {fact.count}d{fact.sides}
      </span>
    </span>
  );
}

/** "+8 = 22 vs DC 10", with the modifier breakdown on a second line. */
export function BonusLine({ modifiers, bonus, total, dc, compact }: { modifiers: { label: string; value: number }[]; bonus: number; total: number | null; dc: number | null; compact?: boolean }) {
  return (
    <span className="text-sm">
      {modifiers.length > 0 && <span className="font-mono">{signed(bonus)}</span>}
      {total !== null && (
        <>
          {' '}= <strong className="font-mono">{total}</strong>
        </>
      )}
      {dc !== null && <span className="text-muted-foreground"> vs DC {dc}</span>}
      {!compact && modifiers.length > 0 && (
        <span className="text-muted-foreground block text-xs">
          {modifiers.map((m) => `${m.label} ${signed(m.value)}`).join(' · ')}
        </span>
      )}
    </span>
  );
}

export function Outcome({ text, className }: { text: string | null; className?: string }) {
  if (!text) return null;
  const bad = /Failure|−|lost|Stays/.test(text);
  return <span className={cn('text-sm', bad ? 'text-amber-200' : 'text-emerald-300', className)}>{text}</span>;
}

export function IssuesFor({ view, subject, className }: { view: Projection; subject: string; className?: string }) {
  const lines = view.warnings.filter((w) => w.subject === subject);
  if (!lines.length) return null;
  return (
    <div className={cn('space-y-1', className)}>
      {lines.map((w) => (
        <p key={w.text} role="note" className="flex items-start gap-1.5 text-sm text-amber-300">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {w.text}
        </p>
      ))}
    </div>
  );
}

/** Inline reason for a Rules Exception or other reasoned decision. */
export function ReasonField({
  label,
  value,
  disabled,
  onSave,
  onClear,
  placeholder = 'Why the table allows this',
  icon = <Scale className="size-3.5" />,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onSave: (reason: string) => void;
  onClear: () => void;
  placeholder?: string;
  icon?: React.ReactNode;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(!value);
  if (value && !editing)
    return (
      <p className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground inline-flex items-center gap-1">
          {icon}
          {label}:
        </span>
        <span className="italic">“{value}”</span>
        <Button size="icon" variant="ghost" className="size-8" aria-label={`Edit ${label}`} disabled={disabled} onClick={() => setEditing(true)}>
          <Pencil className="size-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="size-8" aria-label={`Clear ${label}`} disabled={disabled} onClick={() => { setDraft(''); onClear(); setEditing(true); }}>
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
        {icon}
        {label}
      </span>
      <Input value={draft} disabled={disabled} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} className="h-10 min-w-0 flex-1" />
      <Button type="submit" size="sm" variant="outline" disabled={disabled || !draft.trim()}>
        Save
      </Button>
    </form>
  );
}

export function ExceptionsFor({ view, subject, edit, disabled }: { view: Projection; subject: string; edit: UpkeepProps['edit']; disabled: boolean }) {
  const list = view.exceptions.filter((e) => e.subject === subject);
  return (
    <>
      {list.map((e) => (
        <div key={e.key} className="border-l-2 border-amber-500/60 pl-3">
          <ReasonField
            label="Rules Exception"
            value={e.reason}
            disabled={disabled}
            onSave={(reason) => edit({ kind: 'exception', key: e.key, reason })}
            onClear={() => edit({ kind: 'exception', key: e.key, reason: null })}
          />
        </div>
      ))}
    </>
  );
}

/** Small playing-card style choice (the product rule for player choices). */
export function ChoiceCard({
  selected,
  onClick,
  title,
  note,
  disabled,
  tone,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  title: React.ReactNode;
  note?: React.ReactNode;
  disabled?: boolean;
  tone?: 'warn';
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
        selected ? 'border-primary ring-primary/40 -translate-y-0.5 shadow-md ring-2' : 'border-foreground/20',
        tone === 'warn' && !selected && 'border-dashed',
        className,
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-semibold">
        {selected && <Check className="size-3.5" />}
        {title}
      </span>
      {note && <span className="text-muted-foreground text-xs leading-snug">{note}</span>}
    </button>
  );
}

/** Only a disabled team has a choice here; removing a team is a Militia Correction. */
export function TeamDecision({ team, edit, disabled, className }: { team: Team; edit: UpkeepProps['edit']; disabled: boolean; className?: string }) {
  const options = [
    { value: 'recover' as const, title: 'Recover', note: `Pay ${team.costGp} gp now` },
    { value: 'leave' as const, title: 'Leave disabled', note: 'Can’t act this week' },
  ];
  return (
    <div className={cn('grid grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] gap-2', className)}>
      {options.map((o) => (
        <ChoiceCard
          key={o.value}
          selected={team.decision === o.value}
          disabled={disabled}
          title={o.title}
          note={o.note}
          onClick={() => edit({ kind: 'team', teamId: team.id, decision: o.value })}
        />
      ))}
    </div>
  );
}

/** Prefilled rules cost; a change needs a reason and becomes a treasury Table Adjustment. */
export function RecoveryCost({ team, edit, disabled }: { team: Team; edit: UpkeepProps['edit']; disabled: boolean }) {
  const changed = team.costGp !== team.ruleCostGp;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Cost</span>
        <Input
          aria-label={`${team.name} recovery cost (gp)`}
          inputMode="numeric"
          disabled={disabled}
          value={team.costGp}
          className="h-10 w-20 text-center font-mono"
          onChange={(e) => /^[0-9]+$/.test(e.target.value) && edit({ kind: 'team', teamId: team.id, costGp: Number(e.target.value) })}
        />
        <span>gp</span>
        {changed ? (
          <>
            <span className="text-muted-foreground">
              rules cost {team.ruleCostGp} gp · <strong>Table Adjustment {signed(team.ruleCostGp - team.costGp)} gp</strong>
            </span>
            <Button size="sm" variant="ghost" disabled={disabled} onClick={() => edit({ kind: 'team', teamId: team.id, costGp: team.ruleCostGp, costReason: '' })}>
              Use rules cost
            </Button>
          </>
        ) : (
          <span className="text-muted-foreground">the rules cost (minimum treasury at rank 8)</span>
        )}
      </div>
      {changed && (
        <ReasonField
          label="Reason"
          placeholder="Why the cost differs"
          icon={null}
          value={team.costReason}
          disabled={disabled}
          onSave={(reason) => edit({ kind: 'team', teamId: team.id, costReason: reason })}
          onClear={() => edit({ kind: 'team', teamId: team.id, costReason: '' })}
        />
      )}
    </div>
  );
}

export function ReturnCheck({ team, edit, disabled }: { team: Team; edit: UpkeepProps['edit']; disabled: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-muted-foreground text-sm">Return check · Security DC 15</span>
      <DieField
        label={`${team.name} return die`}
        value={team.roll}
        disabled={disabled}
        onValue={(v) => edit({ kind: 'team', teamId: team.id, roll: v })}
      />
      <BonusLine modifiers={team.rollModifiers} bonus={team.rollBonus} total={team.rollTotal} dc={null} compact />
      <Outcome text={team.rollOutcome} />
    </div>
  );
}

export function SettlementChoice({ state, view, edit, disabled, variant = 'cards' }: UpkeepProps & { variant?: 'cards' | 'select' }) {
  if (variant === 'select')
    return (
      <Select
        value={state.settlementId ?? '__none'}
        disabled={disabled}
        onValueChange={(v) => edit({ kind: 'settlement', settlementId: v === '__none' ? null : v })}
      >
        <SelectTrigger className={cn('h-10 w-44', view.settlementRequired && !state.settlementId && 'border-primary')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="z-[70]">
          <SelectItem value="__none" className="min-h-11">
            No selection
          </SelectItem>
          {settlements.map((s) => (
            <SelectItem key={s.id} value={s.id} className="min-h-11">
              {s.name} · {s.reputation}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  return (
    <div className="grid grid-cols-3 gap-2">
      {settlements.map((s) => (
        <ChoiceCard
          key={s.id}
          selected={state.settlementId === s.id}
          disabled={disabled}
          title={s.name}
          note={s.reputation}
          onClick={() => edit({ kind: 'settlement', settlementId: state.settlementId === s.id ? null : s.id })}
        />
      ))}
    </div>
  );
}

/** Captain (rank 9) title: one feat per PC. The outcome stays free text in the payload. */
export function BoonChoice({ boon, edit, disabled }: { boon: Projection['boons'][number]; edit: UpkeepProps['edit']; disabled: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-28 shrink-0 text-sm">{boon.person.name}</span>
      {captainFeats.map((feat) => (
        <ChoiceCard
          key={feat}
          className="min-h-11 flex-1"
          selected={boon.outcome === feat}
          disabled={disabled}
          title={feat}
          onClick={() => edit({ kind: 'boon', personId: boon.person.id, outcome: boon.outcome === feat ? null : feat })}
        />
      ))}
    </div>
  );
}

export function TransferForm({ edit, disabled, className }: { edit: UpkeepProps['edit']; disabled: boolean; className?: string }) {
  const [direction, setDirection] = useState<'deposit' | 'withdraw'>('deposit');
  const [gp, setGp] = useState('');
  return (
    <form
      className={cn('flex flex-wrap items-center gap-2', className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (!gp) return;
        edit({ kind: 'transfer_add', transfer: { direction, gp: Number(gp) } });
        setGp('');
      }}
    >
      <span className="border-foreground/20 inline-flex rounded-md border p-0.5">
        {(['deposit', 'withdraw'] as const).map((d) => (
          <button
            key={d}
            type="button"
            disabled={disabled}
            aria-pressed={direction === d}
            onClick={() => setDirection(d)}
            className={cn('h-9 rounded px-3 text-sm', direction === d ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
          >
            {d === 'deposit' ? 'Deposit' : 'Withdraw'}
          </button>
        ))}
      </span>
      <Input
        aria-label="Amount (gp)"
        inputMode="numeric"
        placeholder="gp"
        disabled={disabled}
        value={gp}
        onChange={(e) => /^[0-9]*$/.test(e.target.value) && setGp(e.target.value)}
        className="h-10 w-24 text-center font-mono"
      />
      <Button type="submit" size="sm" variant="outline" disabled={disabled || !gp}>
        <Plus /> Add
      </Button>
    </form>
  );
}

export function TransferList({ state, view, edit, disabled, inlineExceptions = true }: UpkeepProps & { inlineExceptions?: boolean }) {
  if (!state.transfers.length) return <p className="text-muted-foreground text-sm">No deposits or withdrawals this week.</p>;
  return (
    <ul className="divide-foreground/10 divide-y">
      {state.transfers.map((t) => (
        <li key={t.id} className="space-y-1.5 py-2">
          <div className="flex items-center gap-3 text-sm">
            <span className="flex-1">{t.direction === 'deposit' ? 'Deposit' : 'Withdrawal'}</span>
            <span className="font-mono">{signed(t.direction === 'deposit' ? t.gp : -t.gp)} gp</span>
            <Button size="icon" variant="ghost" className="size-8" aria-label="Remove transfer" disabled={disabled} onClick={() => edit({ kind: 'transfer_remove', id: t.id })}>
              <X className="size-4" />
            </Button>
          </div>
          <IssuesFor view={view} subject={t.id} />
          {inlineExceptions && <ExceptionsFor view={view} subject={t.id} edit={edit} disabled={disabled} />}
        </li>
      ))}
    </ul>
  );
}

export function SkippedNotice() {
  return (
    <div className="bg-card border-foreground/20 border p-6">
      <p className="text-lg">Upkeep is skipped for the militia’s first week.</p>
      <p className="text-muted-foreground mt-1 text-sm">
        No attrition, recovery, rank or transfers this week. Go on to Activity.
      </p>
    </div>
  );
}

export const gp = (n: number) => `${n} gp`;
export { minimumGp };
