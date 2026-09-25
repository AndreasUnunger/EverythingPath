'use client';
// PROTOTYPE — small pieces shared by the Summary variants: reason inputs,
// segmented choices, the Table Adjustment editor, and list items for
// adjustments, Rules Exceptions, recorded outcomes and consequences.

import {
  ArrowDown,
  ArrowUp,
  Check,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type { Dispatch } from 'react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { cn } from '~/lib/utils';
import {
  describe,
  kinds,
  newId,
  reputations,
  teamStatuses,
  valueFields,
  type Action,
  type Adjustment,
  type AdjustmentBody,
  type AdjustmentKind,
  type Consequence,
  type Exception,
  type Projection,
  type Recorded,
} from './mock';

export type SummaryProps = {
  view: Projection;
  edit: Dispatch<Action>;
  disabled: boolean;
};
export type Seed = AdjustmentBody;

export function Chip({
  children,
  tone = 'muted',
  className,
}: {
  children: React.ReactNode;
  tone?: 'muted' | 'change' | 'warn' | 'table';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-xs whitespace-nowrap',
        tone === 'muted' && 'border-foreground/20 text-muted-foreground',
        tone === 'change' && 'border-foreground/40 text-foreground',
        tone === 'warn' && 'border-amber-300/60 text-amber-300',
        tone === 'table' && 'border-sky-300/60 text-sky-300',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Seg<T extends string>({
  options,
  value,
  onChange,
  disabled,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className="aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:border-primary border-foreground/30 min-h-9 border px-3 text-sm"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ReasonField({
  value,
  onChange,
  disabled,
  placeholder = 'Reason (required)',
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  placeholder?: string;
}) {
  return (
    <div className="min-w-48 flex-1">
      <Input
        aria-label="Reason"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn('h-9', !value.trim() && 'border-amber-300/70')}
      />
      {!value.trim() && (
        <p className="mt-0.5 text-xs text-amber-300">
          A reason is required before the week can be confirmed.
        </p>
      )}
    </div>
  );
}

export function seedFor(kind: AdjustmentKind, view: Projection): Seed {
  const b = view.baseline;
  switch (kind) {
    case 'militia_value':
      return { kind, field: 'treasury', operation: 'add', value: 0 };
    case 'team_status':
      return { kind, teamId: b.teams[0]!.teamId, status: b.teams[0]!.status };
    case 'settlement_reputation':
      return {
        kind,
        settlementId: b.settlements[0]!.settlementId,
        reputation: b.settlements[0]!.reputation,
      };
    case 'event_end':
      return {
        kind,
        eventId:
          b.events.find((e) => !e.ended)?.eventId ?? b.events[0]!.eventId,
      };
  }
}

/** Four tap cards to choose what a new Table Adjustment changes. */
export function KindCards({
  onPick,
  disabled,
  compact,
}: {
  onPick: (kind: AdjustmentKind) => void;
  disabled: boolean;
  compact?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="New Table Adjustment"
      className={cn('grid gap-2', compact ? 'grid-cols-2' : 'grid-cols-4')}
    >
      {kinds.map((k) => (
        <button
          key={k.kind}
          type="button"
          disabled={disabled}
          onClick={() => onPick(k.kind)}
          className="border-foreground/30 hover:border-foreground/70 flex min-h-16 flex-col items-start gap-0.5 border p-2 text-left transition-transform hover:-translate-y-0.5"
        >
          <span className="flex items-center gap-1 text-sm">
            <Plus className="size-3.5" /> {k.label}
          </span>
          <span className="text-muted-foreground text-xs">{k.hint}</span>
        </button>
      ))}
    </div>
  );
}

/** The editor for one Table Adjustment. The kind is fixed by the seed. */
export function AdjustmentForm({
  initial,
  view,
  disabled,
  onSave,
  onCancel,
  title,
}: {
  initial: Seed & { adjustmentId?: string; reason?: string };
  view: Projection;
  disabled: boolean;
  onSave: (a: Adjustment) => void;
  onCancel: () => void;
  title?: string;
}) {
  const [draft, setDraft] = useState<Adjustment>({
    adjustmentId: initial.adjustmentId ?? newId(),
    reason: initial.reason ?? '',
    ...initial,
  } as Adjustment);
  const b = view.baseline;
  const set = (patch: Partial<Adjustment>) =>
    setDraft({ ...draft, ...patch } as Adjustment);
  const kind = kinds.find((k) => k.kind === draft.kind)!;
  return (
    <form
      className="border-foreground/40 bg-background space-y-3 border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft);
      }}
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{title ?? kind.label}</h4>
        <Chip tone="table">{describe(draft, b)}</Chip>
      </div>
      {draft.kind === 'militia_value' && (
        <div className="space-y-2">
          <Seg
            label="Value"
            options={valueFields.map((f) => ({ value: f.key, label: f.label }))}
            value={draft.field}
            onChange={(field) => set({ field })}
            disabled={disabled}
          />
          <div className="flex items-center gap-2">
            <Seg
              label="Operation"
              options={[
                { value: 'add', label: 'Add' },
                { value: 'set', label: 'Set to' },
              ]}
              value={draft.operation}
              onChange={(operation) => set({ operation })}
              disabled={disabled}
            />
            <Input
              aria-label="Value"
              type="number"
              inputMode="numeric"
              className="h-9 w-28 font-mono"
              value={draft.value}
              disabled={disabled}
              onChange={(e) => set({ value: Number(e.target.value) || 0 })}
            />
            <span className="text-muted-foreground text-sm">
              {valueFields.find((f) => f.key === draft.field)!.unit.trim()}
            </span>
          </div>
        </div>
      )}
      {draft.kind === 'team_status' && (
        <div className="space-y-2">
          <Seg
            label="Team"
            options={b.teams.map((t) => ({ value: t.teamId, label: t.name }))}
            value={draft.teamId}
            onChange={(teamId) => set({ teamId })}
            disabled={disabled}
          />
          <Seg
            label="Condition"
            options={teamStatuses.map((s) => ({ value: s, label: s }))}
            value={draft.status}
            onChange={(status) => set({ status })}
            disabled={disabled}
          />
        </div>
      )}
      {draft.kind === 'settlement_reputation' && (
        <div className="space-y-2">
          <Seg
            label="Settlement"
            options={b.settlements.map((s) => ({
              value: s.settlementId,
              label: s.name,
            }))}
            value={draft.settlementId}
            onChange={(settlementId) => set({ settlementId })}
            disabled={disabled}
          />
          <Seg
            label="Reputation"
            options={reputations.map((r) => ({ value: r, label: r }))}
            value={draft.reputation}
            onChange={(reputation) => set({ reputation })}
            disabled={disabled}
          />
        </div>
      )}
      {draft.kind === 'event_end' && (
        <Seg
          label="Event"
          options={b.events.map((e) => ({ value: e.eventId, label: e.name }))}
          value={draft.eventId}
          onChange={(eventId) => set({ eventId })}
          disabled={disabled}
        />
      )}
      <div className="flex flex-wrap items-start gap-2">
        <ReasonField
          value={draft.reason}
          onChange={(reason) => set({ reason })}
          disabled={disabled}
        />
        <Button type="submit" disabled={disabled}>
          <Check /> Save
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={disabled}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** One staged Table Adjustment: its effect, its reason inline, order and edit controls. */
export function AdjustmentItem({
  a,
  index,
  count,
  view,
  edit,
  disabled,
  order = true,
}: SummaryProps & {
  a: Adjustment;
  index: number;
  count: number;
  order?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  if (editing)
    return (
      <AdjustmentForm
        initial={a}
        view={view}
        disabled={disabled}
        title={`Adjustment ${index + 1}`}
        onSave={(next) => {
          edit({ kind: 'adjust:update', adjustment: next });
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  return (
    <li className="border-foreground/20 flex items-start gap-2 border p-2">
      {order && count > 1 && (
        <span className="flex flex-col">
          <button
            aria-label={`Move adjustment ${index + 1} earlier`}
            disabled={disabled || index === 0}
            onClick={() =>
              edit({
                kind: 'adjust:move',
                adjustmentId: a.adjustmentId,
                by: -1,
              })
            }
            className="disabled:opacity-30"
          >
            <ArrowUp className="size-4" />
          </button>
          <button
            aria-label={`Move adjustment ${index + 1} later`}
            disabled={disabled || index === count - 1}
            onClick={() =>
              edit({ kind: 'adjust:move', adjustmentId: a.adjustmentId, by: 1 })
            }
            className="disabled:opacity-30"
          >
            <ArrowDown className="size-4" />
          </button>
        </span>
      )}
      <span className="text-muted-foreground w-5 pt-1 font-mono text-sm">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="table">{describe(a, view.baseline)}</Chip>
          <span className="text-muted-foreground text-xs">
            {kinds.find((k) => k.kind === a.kind)!.label}
          </span>
        </div>
        <ReasonField
          value={a.reason}
          disabled={disabled}
          onChange={(reason) =>
            edit({ kind: 'adjust:update', adjustment: { ...a, reason } })
          }
        />
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Edit adjustment ${index + 1}`}
        disabled={disabled}
        onClick={() => setEditing(true)}
      >
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Remove adjustment ${index + 1}`}
        disabled={disabled}
        onClick={() =>
          edit({ kind: 'adjust:remove', adjustmentId: a.adjustmentId })
        }
      >
        <Trash2 />
      </Button>
    </li>
  );
}

/** One Rules Exception: what it permits, its reason, and clearing it. */
export function ExceptionItem({
  x,
  edit,
  disabled,
  showSubject = true,
}: {
  x: Exception;
  edit: Dispatch<Action>;
  disabled: boolean;
  showSubject?: boolean;
}) {
  return (
    <li
      className={cn(
        'border-foreground/20 space-y-1 border p-2',
        x.obsolete && 'border-amber-300/60',
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {showSubject && <span className="font-medium">{x.subject}</span>}
        <Chip tone="warn">{x.rule}</Chip>
        <span className="text-muted-foreground text-xs">Rules Exception</span>
      </div>
      {x.obsolete ? (
        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">“{x.reason}”</p>
          <p className="text-amber-300">
            This exception cannot permit an extra action. Move the choice to an
            available slot, clear it, or restore the allowance.
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() =>
              edit({ kind: 'exception:remove', exceptionId: x.exceptionId })
            }
          >
            Remove obsolete exception
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-2">
          <ReasonField
            value={x.reason}
            disabled={disabled}
            onChange={(reason) =>
              edit({
                kind: 'exception:reason',
                exceptionId: x.exceptionId,
                reason,
              })
            }
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Clear reason"
            disabled={disabled || !x.reason}
            onClick={() =>
              edit({
                kind: 'exception:reason',
                exceptionId: x.exceptionId,
                reason: '',
              })
            }
          >
            <X />
          </Button>
        </div>
      )}
    </li>
  );
}

export function RecordedItem({
  r,
  showSubject = true,
}: {
  r: Recorded;
  showSubject?: boolean;
}) {
  return (
    <li className="border-foreground/20 border-l-2 pl-2 text-sm">
      {showSubject && <span className="font-medium">{r.subject} · </span>}
      <span className="text-muted-foreground text-xs">Recorded outcome · </span>
      <span className="font-serif">{r.outcome}</span>
    </li>
  );
}

/** One consequence line; with `attach`, its exception and recorded outcome sit under it. */
export function ConsequenceItem({
  c,
  view,
  edit,
  disabled,
  attach,
}: SummaryProps & { c: Consequence; attach?: boolean }) {
  const exceptions = attach
    ? view.exceptions.filter((x) => x.itemId === c.id)
    : [];
  const recorded = attach ? view.recorded.filter((r) => r.itemId === c.id) : [];
  return (
    <li className="space-y-1.5 py-1.5">
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 text-sm">
          {c.text}
          {c.detail && (
            <span className="text-muted-foreground"> · {c.detail}</span>
          )}
        </span>
        {c.delta && <Chip tone="change">{c.delta}</Chip>}
      </div>
      {(exceptions.length > 0 || recorded.length > 0) && (
        <ul className="space-y-1 pl-4">
          {exceptions.map((x) => (
            <ExceptionItem
              key={x.exceptionId}
              x={x}
              edit={edit}
              disabled={disabled}
              showSubject={false}
            />
          ))}
          {recorded.map((r) => (
            <RecordedItem key={r.acknowledgementId} r={r} showSubject={false} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function SectionTitle({
  children,
  count,
  right,
}: {
  children: React.ReactNode;
  count?: number;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        {children}
        {count !== undefined && (
          <span className="text-muted-foreground font-mono text-sm">
            {count}
          </span>
        )}
      </h3>
      {right}
    </div>
  );
}
