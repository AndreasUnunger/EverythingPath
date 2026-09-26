'use client';
// PROTOTYPE — shared content pieces for /prototype/setup-correction. The
// variants decide where these go; none of them decides layout.

import { AlertTriangle, CircleAlert, Lock, Plus, Trash2, UserPlus, Users } from 'lucide-react';
import type React from 'react';
import { type Dispatch, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { cn } from '~/lib/utils';
import {
  type Action,
  type Block,
  carriedBlocks,
  sectionByKey,
  type State,
  warningsFor,
  type Column,
  type Correction,
  errorsFor,
  impactOf,
  managerLimit,
  orElse,
  personName,
  type Problem,
  ROLE_EFFECT,
  ROLES,
  type Role,
  rolesOf,
  type Row,
  type Scenario,
  type Snapshot,
  summarize,
  teamName,
  type Value,
  type Warning,
} from './mock';

// ------------------------------------------------------------- small lines

export function WarningLine({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('flex items-start gap-1.5 text-sm text-amber-300', className)}>
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
export function ErrorLine({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('text-destructive flex items-start gap-1.5 text-sm', className)}>
      <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
export function ReadOnlyNote({ children = 'Changes through the week, not here.' }: { children?: React.ReactNode }) {
  return (
    <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
      <Lock className="size-3" /> {children}
    </p>
  );
}
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn('text-muted-foreground text-xs tracking-widest uppercase', className)}>{children}</h3>;
}

// ------------------------------------------------------------------ fields

type FieldProps = {
  col: Column;
  value: Value | undefined;
  onChange: (v: Value) => void;
  error?: string;
  snapshot: Snapshot;
  disabled?: boolean;
  dense?: boolean;
};

export function Field({ col, value, onChange, error, snapshot, disabled, dense }: FieldProps) {
  const options =
    col.kind === 'person'
      ? snapshot.people.filter((p) => p.onRoster !== false).map((p) => ({ value: p.id, label: p.name }))
      : col.kind === 'team'
        ? snapshot.teams.map((t) => ({ value: t.id, label: String(t.name) }))
        : col.kind === 'settlement'
          ? snapshot.settlements.map((t) => ({ value: t.id, label: String(t.name) }))
          : col.kind === 'choice'
            ? (col.options ?? []).map((o) => ({ value: o, label: o.replaceAll('_', ' ') }))
            : null;
  const label = (
    <span className="text-sm leading-tight font-medium">
      {col.label}
      {col.optional && <span className="text-muted-foreground font-normal"> (optional)</span>}
    </span>
  );
  if (col.kind === 'bool')
    return (
      <label className={cn('flex items-center gap-2', dense ? 'h-9' : 'h-9 self-end')}>
        <input type="checkbox" className="accent-primary size-4" checked={value === true} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
    );
  return (
    <div className={cn('min-w-0 space-y-1', col.wide && 'col-span-full')}>
      {label}
      {options ? (
        <Select value={value === '' || value === undefined ? undefined : String(value)} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger className={cn('w-full', error && 'border-destructive')} aria-label={col.label}>
            <SelectValue placeholder={col.optional ? 'None' : 'Choose…'} />
          </SelectTrigger>
          <SelectContent>
            {col.optional && <SelectItem value="__none">None</SelectItem>}
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          aria-label={col.label}
          inputMode={col.kind === 'number' ? 'numeric' : undefined}
          value={String(value ?? '')}
          disabled={disabled}
          aria-invalid={!!error}
          className={cn(error && 'border-destructive')}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {error && <ErrorLine className="text-xs">{error}</ErrorLine>}
    </div>
  );
}

// ------------------------------------------------------------ block editors

let seq = 100;
const newRow = (block: Block): Row => {
  const row: Row = { id: `${block.key}-${seq++}` };
  for (const c of block.columns) row[c.key] = c.kind === 'bool' ? false : '';
  return row;
};

export function BlockEditor({
  block,
  snapshot,
  patch,
  errors,
  disabled,
  columns = 3,
}: {
  block: Block;
  snapshot: Snapshot;
  patch: (fn: (s: Snapshot) => Snapshot) => void;
  errors: Problem[];
  disabled?: boolean;
  columns?: 2 | 3 | 4;
}) {
  const grid = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }[columns];
  const errorFor = (rowId: string, field: string) => errors.find((e) => e.block === block.key && e.rowId === rowId && e.field === field)?.text;
  const set = (rowId: string, key: string, v: Value) =>
    patch((s) => {
      const value = v === '__none' ? '' : v;
      if (block.single) return { ...s, [block.key]: { ...(s[block.key] as Row), [key]: value } };
      return { ...s, [block.key]: (s[block.key] as Row[]).map((r) => (r.id === rowId ? { ...r, [key]: value } : r)) };
    });
  if (block.single) {
    const row = snapshot[block.key] as Row;
    return (
      <div className={cn('grid gap-3', grid)}>
        {block.columns.map((col) => (
          <Field key={col.key} col={col} value={row[col.key]} onChange={(v) => set(row.id, col.key, v)} error={errorFor(row.id, col.key)} snapshot={snapshot} disabled={disabled} />
        ))}
      </div>
    );
  }
  const rows = snapshot[block.key] as Row[];
  return (
    <div className="space-y-2">
      {rows.length === 0 && <p className="text-muted-foreground text-sm">None yet.</p>}
      {rows.map((row, i) => (
        <fieldset key={row.id} aria-label={`${block.label} ${i + 1}`} className={cn('border-foreground/20 grid gap-3 border p-3', grid)}>
          {block.columns.map((col) => (
            <Field key={col.key} col={col} value={row[col.key]} onChange={(v) => set(row.id, col.key, v)} error={errorFor(row.id, col.key)} snapshot={snapshot} disabled={disabled} />
          ))}
          <div className="col-span-full flex justify-end">
            <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => patch((s) => ({ ...s, [block.key]: (s[block.key] as Row[]).filter((r) => r.id !== row.id) }))}>
              <Trash2 /> Remove
            </Button>
          </div>
        </fieldset>
      ))}
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => patch((s) => ({ ...s, [block.key]: [...(s[block.key] as Row[]), newRow(block)] }))}>
        <Plus /> {block.addLabel ?? 'Add'}
      </Button>
    </div>
  );
}

// A compact read view of a block: label/value pairs for single, a table otherwise.
export function BlockRead({ block, snapshot, dense }: { block: Block; snapshot: Snapshot; dense?: boolean }) {
  const show = (col: Column, v: Value | undefined) => {
    if (col.kind === 'bool') return v ? 'Yes' : '—';
    if (v === '' || v === undefined) return '—';
    if (col.kind === 'person') return personName(snapshot, v);
    if (col.kind === 'team') return teamName(snapshot, v);
    if (col.kind === 'settlement') return snapshot.settlements.find((s) => s.id === v)?.name ?? '—';
    return String(v).replaceAll('_', ' ');
  };
  if (block.single) {
    const row = snapshot[block.key] as Row;
    return (
      <dl className={cn('grid gap-x-4 gap-y-1 text-sm', dense ? 'grid-cols-[auto_1fr]' : 'grid-cols-[auto_1fr_auto_1fr]')}>
        {block.columns.map((col) => (
          <div key={col.key} className="contents">
            <dt className="text-muted-foreground">{col.label}</dt>
            <dd className="font-mono text-xs leading-5">{show(col, row[col.key])}</dd>
          </div>
        ))}
      </dl>
    );
  }
  const rows = snapshot[block.key] as Row[];
  const cols = block.columns.filter((c) => c.kind !== 'long');
  if (rows.length === 0) return <p className="text-muted-foreground text-sm">None.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-muted-foreground text-left text-xs">
          {cols.map((c) => (
            <th key={c.key} className="pr-3 pb-1 font-normal">
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-foreground/10 border-t">
            {cols.map((c) => (
              <td key={c.key} className="py-1 pr-3">
                {show(c, row[c.key])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// --------------------------------------------------------- correction bits

export function ReasonField({ value, onChange, missing, autoFocus }: { value: string; onChange: (v: string) => void; missing: boolean; autoFocus?: boolean }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium" htmlFor="reason">
        Reason for this correction
      </label>
      <Input id="reason" autoFocus={autoFocus} value={value} onChange={(e) => onChange(e.target.value)} placeholder="What happened at the table?" className={cn(missing && 'border-destructive')} />
      {missing ? <ErrorLine className="text-xs">A reason is required.</ErrorLine> : <p className="text-muted-foreground text-xs">Saved with the change so later sessions know why it differs.</p>}
    </div>
  );
}

export function ConflictBlock({ correction, latest, by, onRedo }: { correction: Correction; latest: Snapshot; by: string; onRedo: () => void }) {
  return (
    <div className="border-destructive/60 bg-destructive/10 space-y-2 border p-3" role="alert">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Users className="size-4" /> Another player changed this section
      </p>
      <p className="text-muted-foreground text-sm">{by} saved a correction while you were editing. Their values are what the militia has now; yours were not saved.</p>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <Eyebrow className="mb-1">Theirs (current)</Eyebrow>
          <ul className="space-y-0.5">
            {summarize(latest, correction.section).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
        <div>
          <Eyebrow className="mb-1">Yours (not saved)</Eyebrow>
          <ul className="space-y-0.5 opacity-70">
            {summarize(correction.draft, correction.section).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      </div>
      <Button size="sm" onClick={onRedo}>
        Start again from their values
      </Button>
    </div>
  );
}

export function ImpactBlock({ lines }: { lines: string[] }) {
  if (!lines.length) return null;
  return (
    <div className="space-y-1 border border-amber-300/50 bg-amber-300/10 p-3">
      <p className="text-sm font-medium text-amber-300">This affects the open week</p>
      {lines.map((l) => (
        <WarningLine key={l}>{l}</WarningLine>
      ))}
      <p className="text-muted-foreground text-xs">You can still save. The week screen will flag the affected slots until someone changes them.</p>
    </div>
  );
}

export function SectionWarnings({ warnings }: { warnings: Warning[] }) {
  if (!warnings.length) return null;
  return (
    <div className="space-y-1">
      {warnings.map((w) => (
        <WarningLine key={w.text}>{w.text}</WarningLine>
      ))}
      <p className="text-muted-foreground text-xs">Warnings never block. Keep the value and explain it in the reason if it’s intentional.</p>
    </div>
  );
}

// Everything the correction save point needs, derived once.
export function correctionStatus(c: Correction, latest: Snapshot, scenario: Scenario, warningsFor: (s: Snapshot) => Warning[]) {
  const errors = c.section === 'people' ? [] : errorsFor(c.draft, [c.section]);
  const warnings = warningsFor(c.draft).filter((w) => w.section === c.section || (c.section === 'people' && w.section === 'teams'));
  const impact = impactOf(latest, c.draft, scenario);
  const reasonMissing = c.attempted && !c.reason.trim();
  return { errors: c.attempted ? errors : [], allErrors: errors, warnings, impact, reasonMissing };
}

// --------------------------------------------------------- setup progress

export function SavedLocallyNote({ savedAt }: { savedAt: string | null }) {
  return <p className="text-muted-foreground text-xs">{savedAt ? `Kept in this browser · ${savedAt}` : 'Entries are kept in this browser until you start the militia.'}</p>;
}

export function ErrorSummary({ errors, onGo }: { errors: Problem[]; onGo: (p: Problem) => void }) {
  if (!errors.length) return null;
  return (
    <div className="border-destructive/60 bg-destructive/10 space-y-1 border p-3" role="alert">
      <p className="text-sm font-medium">
        {errors.length} thing{errors.length > 1 ? 's' : ''} to fix before starting
      </p>
      <ul className="space-y-0.5 text-sm">
        {errors.map((e) => (
          <li key={`${e.rowId}-${e.field}`}>
            <button className="underline underline-offset-2" onClick={() => onGo(e)}>
              {e.text}
            </button>
            <span className="text-muted-foreground"> · {e.block}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------ characters pieces

export function RoleCards({ snapshot, editing, onAssign, onRemove, compact }: { snapshot: Snapshot; editing: boolean; onAssign?: (role: Role, personId: string) => void; onRemove?: (role: Role, personId: string) => void; compact?: boolean }) {
  return (
    <div className={cn('grid gap-3', compact ? 'grid-cols-2' : 'grid-cols-3')}>
      {ROLES.map((role) => {
        const holders = snapshot.people.filter((p) => rolesOf(p).includes(role) && p.onRoster !== false);
        const counts = holders[0];
        const effect =
          role === 'commandant'
            ? holders.length
              ? `+${holders.reduce((n, h) => n + Number(orElse(h.hitDice, h.level ?? '')), 0)} training on a successful Drill (${holders.map((h) => `${String(h.name).split(' ')[0]} ${String(orElse(h.hitDice, h.level ?? ''))} HD`).join(' + ')})`
              : 'Vacant: Drill Militia adds nothing'
            : counts
              ? `${ROLE_EFFECT[role]} (${String(counts.name).split(' ')[0]}${role === 'strategist' || role === 'overseer' ? '' : `, Cha ${counts.cha}`})`
              : `Vacant: ${ROLE_EFFECT[role].replace('+1 militia action; that action gets +2', 'no extra action').replace(/bonus equal to Cha modifier/, 'bonus not applied').replace('+1 to both secondary checks', 'no secondary bonus')}`;
        return (
          <section key={role} aria-label={role} className="bg-card border-foreground/20 space-y-2 border p-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium capitalize">{role}</h3>
              {editing && (
                <Select onValueChange={(id) => onAssign?.(role, id)} value="">
                  <SelectTrigger size="sm" aria-label={`Assign ${role}`} className="h-7 w-auto">
                    <span>Assign</span>
                  </SelectTrigger>
                  <SelectContent>
                    {snapshot.people
                      .filter((p) => p.onRoster !== false && !rolesOf(p).includes(role))
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} · {String(p.kind).toUpperCase()} · Cha {p.cha}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {holders.length === 0 && <span className="text-muted-foreground text-sm">Vacant</span>}
              {holders.map((h, i) => (
                <span key={h.id} className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm', i > 0 && role !== 'commandant' && 'text-muted-foreground border-dashed')}>
                  {h.name}
                  {i > 0 && role !== 'commandant' && <span className="text-xs">(does not stack)</span>}
                  {editing && (
                    <button aria-label={`Remove ${h.name} from ${role}`} className="ml-0.5 opacity-60 hover:opacity-100" onClick={() => onRemove?.(role, h.id)}>
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">{effect}</p>
          </section>
        );
      })}
    </div>
  );
}

export function personWarnings(snapshot: Snapshot, p: Row): string[] {
  const out: string[] = [];
  const managed = snapshot.teams.filter((t) => t.manager === p.id).length;
  if (managed > managerLimit(p)) out.push(`Manages ${managed} teams; an NPC without an officer role normally manages 1.`);
  if (rolesOf(p).length > 1) out.push('Holds more than one officer role.');
  return out;
}

export const managedLabel = (snapshot: Snapshot, p: Row) => {
  const n = snapshot.teams.filter((t) => t.manager === p.id).length;
  return n ? `Manages ${n} of ${snapshot.teams.length} teams` : '';
};

// ------------------------------------------------------- shared step bodies

// Roster people: membership, kind, Hit Dice and officer roles. Name, level and
// Cha come from the character record and aren't edited here.
export function PeopleEditor({ snapshot, patch, disabled, roles = true }: { snapshot: Snapshot; patch: (fn: (s: Snapshot) => Snapshot) => void; disabled?: boolean; roles?: boolean }) {
  const set = (id: string, key: string, v: Value) => patch((s) => ({ ...s, people: s.people.map((p) => (p.id === id ? { ...p, [key]: v } : p)) }));
  return (
    <ul className="divide-foreground/10 border-foreground/20 divide-y border">
      {snapshot.people.map((p) => {
        const on = p.onRoster !== false;
        return (
          <li key={p.id} className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2', !on && 'opacity-60')}>
            <label className="flex w-52 items-center gap-2">
              <input type="checkbox" className="accent-primary size-4" checked={on} disabled={disabled} onChange={(e) => set(p.id, 'onRoster', e.target.checked)} />
              <span>
                <span className="block leading-tight">{p.name}</span>
                <span className="text-muted-foreground text-xs">
                  Level {p.level} · Cha {Number(p.cha) >= 0 ? '+' : ''}
                  {p.cha}
                </span>
              </span>
            </label>
            {on && (
              <>
                <div className="flex overflow-hidden rounded-md border text-sm" role="radiogroup" aria-label={`${p.name} kind`}>
                  {(['pc', 'npc'] as const).map((k) => (
                    <button key={k} role="radio" aria-checked={p.kind === k} disabled={disabled} onClick={() => set(p.id, 'kind', k)} className={cn('px-3 py-1.5 uppercase', p.kind === k && 'bg-primary text-primary-foreground')}>
                      {k}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-sm">
                  Hit Dice
                  <Input className="h-8 w-16" inputMode="numeric" placeholder={String(p.level)} value={String(p.hitDice ?? '')} disabled={disabled} onChange={(e) => set(p.id, 'hitDice', e.target.value)} />
                </label>
                {roles && (
                  <div className="flex flex-wrap gap-1" aria-label={`${p.name} officer roles`}>
                    {ROLES.map((r) => {
                      const has = rolesOf(p).includes(r);
                      return (
                        <button
                          key={r}
                          disabled={disabled}
                          aria-pressed={has}
                          onClick={() => set(p.id, 'roles', (has ? rolesOf(p).filter((x) => x !== r) : [...rolesOf(p), r]).join(', '))}
                          className={cn('rounded-full border px-2 py-0.5 text-xs capitalize', has ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground border-dashed')}
                        >
                          {r}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
            {!on && <span className="text-muted-foreground text-sm">Not in the militia</span>}
          </li>
        );
      })}
    </ul>
  );
}

// What leaving the roster also clears.
export function rosterRemovalNotes(latest: Snapshot, draft: Snapshot): string[] {
  return draft.people
    .filter((p) => p.onRoster === false && latest.people.find((l) => l.id === p.id)?.onRoster !== false)
    .flatMap((p) => {
      const teams = latest.teams.filter((t) => t.manager === p.id).map((t) => t.name);
      const roles = rolesOf(latest.people.find((l) => l.id === p.id)!);
      return [
        teams.length ? `Removing ${p.name} also clears them as manager of ${teams.join(', ')}.` : '',
        roles.length ? `Removing ${p.name} also leaves ${roles.join(' and ')} vacant.` : '',
      ].filter(Boolean);
    });
}

// Add character: the existing character dialog, reduced to its fields.
export function AddCharacterButton({ onAdd }: { onAdd: (row: Row) => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', level: '1', cha: '0', kind: 'npc' });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus /> Add character
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add character</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {(['name', 'level', 'cha'] as const).map((k) => (
            <label key={k} className={cn('space-y-1 text-sm', k === 'name' && 'col-span-2')}>
              {k === 'cha' ? 'Cha modifier' : k[0]!.toUpperCase() + k.slice(1)}
              <Input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button
            disabled={!f.name.trim()}
            onClick={() => {
              onAdd({ id: `p-${Date.now()}`, ...f, hitDice: '', roles: '', onRoster: true });
              setF({ name: '', level: '1', cha: '0', kind: 'npc' });
              setOpen(false);
            }}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// The content of one setup step. Layout around it is the variant's.
export function SetupStepBody({ stepKey, blocks, draft, mode, patch, errors, warnings, columns = 3 }: { stepKey: string; blocks: Block[]; draft: Snapshot; mode: 'new' | 'existing'; patch: (fn: (s: Snapshot) => Snapshot) => void; errors: Problem[]; warnings: Warning[]; columns?: 2 | 3 | 4 }) {
  if (stepKey === 'people')
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">Tick who belongs to the militia. People come from the campaign’s character records.</p>
          <AddCharacterButton onAdd={(row) => patch((s) => ({ ...s, people: [...s.people, row] }))} />
        </div>
        <PeopleEditor snapshot={draft} patch={patch} />
        <SectionWarnings warnings={warnings} />
      </div>
    );
  const shown = [...blocks, ...(stepKey === 'carried' ? carriedBlocks : [])].map((b) => (b.key === 'week' && mode === 'existing' ? { ...b, columns: b.columns.filter((c) => c.key !== 'firstWeek') } : b));
  return (
    <div className="space-y-5">
      {shown.map((b) => (
        <div key={b.key} className="space-y-2">
          {shown.length > 1 && <Eyebrow>{b.label}</Eyebrow>}
          <BlockEditor block={b} snapshot={draft} patch={patch} errors={errors} columns={columns} />
        </div>
      ))}
      <SectionWarnings warnings={warnings} />
    </div>
  );
}

// The body of an open correction: editor, warnings, impact, conflict, reason
// and the save buttons. Where it opens is the variant's.
export function CorrectionBody({ state, dispatch, columns = 3, autoFocusReason }: { state: State; dispatch: Dispatch<Action>; columns?: 2 | 3 | 4; autoFocusReason?: boolean }) {
  const c = state.correction!;
  const st = correctionStatus(c, state.latest, state.scenario, warningsFor);
  const patch = (fn: (s: Snapshot) => Snapshot) => dispatch({ kind: 'correct:patch', fn });
  const by = [...state.changedSince].reverse().find((ch) => ch.section === c.section)?.by ?? 'Another player';
  const removals = c.section === 'people' ? rosterRemovalNotes(state.latest, c.draft) : [];
  return (
    <div className="space-y-4">
      {c.conflict ? (
        <ConflictBlock correction={c} latest={state.latest} by={by} onRedo={() => dispatch({ kind: 'correct:redo' })} />
      ) : c.section === 'people' ? (
        <PeopleEditor snapshot={c.draft} patch={patch} roles={false} />
      ) : (
        sectionByKey(c.section).blocks.map((b) => (
          <div key={b.key} className="space-y-2">
            {sectionByKey(c.section).blocks.length > 1 && <Eyebrow>{b.label}</Eyebrow>}
            <BlockEditor block={b} snapshot={c.draft} patch={patch} errors={st.errors} columns={columns} />
          </div>
        ))
      )}
      {!c.conflict && (
        <>
          {removals.map((r) => (
            <WarningLine key={r}>{r}</WarningLine>
          ))}
          <SectionWarnings warnings={st.warnings} />
          <ImpactBlock lines={st.impact} />
          <ReasonField value={c.reason} onChange={(reason) => dispatch({ kind: 'correct:reason', reason })} missing={st.reasonMissing} autoFocus={autoFocusReason} />
          {st.errors.length > 0 && <ErrorLine>{st.errors.length} field{st.errors.length > 1 ? 's' : ''} to fix above.</ErrorLine>}
        </>
      )}
      <div className="flex gap-2">
        {!c.conflict && <Button onClick={() => dispatch({ kind: 'correct:save' })}>Save correction</Button>}
        <Button variant="ghost" onClick={() => dispatch({ kind: 'correct:cancel' })}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// Carried state: week context and what the week carries. Never edited here.
export function CarriedRead({ snapshot, dense }: { snapshot: Snapshot; dense?: boolean }) {
  return (
    <div className="space-y-4">
      <BlockRead block={sectionByKey('week').blocks[0]!} snapshot={snapshot} dense={dense} />
      {carriedBlocks.map((b) => (
        <div key={b.key} className="space-y-1">
          <Eyebrow>{b.label}</Eyebrow>
          <BlockRead block={b} snapshot={snapshot} dense={dense} />
        </div>
      ))}
    </div>
  );
}
