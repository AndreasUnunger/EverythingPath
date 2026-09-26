'use client';
// PROTOTYPE — pieces every Event variant shares: die fields, the table roll
// with its modifiers, check rows, target choice cards, mitigation, officer
// pick, rewards, acknowledgement, Sabotage, outcomes, Rules Exception reason.
// The variants disagree about where these live, not about what they show.

import { AlertTriangle, Check, Pencil, Plus, Scale, X } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { cn } from '~/lib/utils';
import { type CheckFact, type Edit, type EventFact, type Input as InputFact, people, personName, type Projection, rank, type Reward, signed, type State } from './mock';

export type EventProps = { state: State; view: Projection; edit: (edit: Edit) => void; disabled: boolean };

export function DieField({ value, label, disabled, onValue, className, sides }: { value: number | null | undefined; label: string; disabled?: boolean; onValue: (value: number | null) => void; className?: string; sides?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
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
      {sides && <span className="text-muted-foreground font-mono text-xs">d{sides}</span>}
    </span>
  );
}

/** Small playing-card style choice (the product rule for player choices). */
export function ChoiceCard({ selected, onClick, title, note, disabled, tone, className }: { selected: boolean; onClick: () => void; title: React.ReactNode; note?: React.ReactNode; disabled?: boolean; tone?: 'warn'; className?: string }) {
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

export function IssuesFor({ fact, className }: { fact: Pick<EventFact, 'warnings'>; className?: string }) {
  if (!fact.warnings.length) return null;
  return (
    <div className={cn('space-y-1', className)}>
      {fact.warnings.map((w) => (
        <p key={w.text} role="note" className="flex items-start gap-1.5 text-sm text-amber-300">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {w.text}
        </p>
      ))}
    </div>
  );
}

/** Inline reason for a Rules Exception or other reasoned decision. */
export function ReasonField({ label, value, disabled, onSave, onClear, placeholder = 'Why the table allows this', icon = <Scale className="size-3.5" /> }: { label: string; value: string; disabled: boolean; onSave: (reason: string) => void; onClear: () => void; placeholder?: string; icon?: React.ReactNode }) {
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

export function ExceptionsFor({ fact, edit, disabled }: { fact: EventFact; edit: EventProps['edit']; disabled: boolean }) {
  return (
    <>
      {fact.exceptions.map((e) => (
        <div key={e.key} className="space-y-1 border-l-2 border-amber-500/60 pl-3">
          <p className="text-muted-foreground text-xs">{e.text}</p>
          <ReasonField label="Rules Exception" value={e.reason} disabled={disabled} onSave={(reason) => edit({ kind: 'exception', key: e.key, reason })} onClear={() => edit({ kind: 'exception', key: e.key, reason: null })} />
        </div>
      ))}
    </>
  );
}

/** "45 + 5 (Teilwood, Unfriendly) = 50 → Roll Twice", with the die editable. */
export function TableRoll({ fact, edit, disabled, showName = true, compact }: { fact: EventFact; edit: EventProps['edit']; disabled: boolean; showName?: boolean; compact?: boolean }) {
  const mods = [fact.settlementModifier, fact.extra ? { label: fact.extra.reason || 'table modifier', value: fact.extra.value } : null].filter(Boolean) as { label: string; value: number }[];
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <DieField label={`Event ${fact.number} table roll`} value={fact.tableRoll} disabled={disabled} sides={100} onValue={(v) => edit({ kind: 'table', id: fact.id, roll: v })} />
      {mods.map((m) => (
        <span key={m.label} className="text-sm">
          <span className="font-mono">{signed(m.value)}</span>
          {!compact && <span className="text-muted-foreground"> {m.label}</span>}
        </span>
      ))}
      {fact.total !== null && (mods.length > 0 || showName) && (
        <span className="text-sm">
          {mods.length > 0 && (
            <>
              = <strong className="font-mono">{fact.total}</strong>{' '}
            </>
          )}
          {showName && <span className={cn('font-semibold', mods.length > 0 && 'ml-1')}>→ {fact.name}</span>}
        </span>
      )}
    </span>
  );
}

/** "+ Modifier" for a table modifier beyond the settlement's, with a required reason. */
export function ExtraModifier({ fact, edit, disabled }: { fact: EventFact; edit: EventProps['edit']; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(fact.extra?.value ?? 0);
  if (fact.extra)
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-mono">{signed(fact.extra.value)}</span>
        <ReasonField label="Table modifier" icon={null} placeholder="Why the roll is modified" value={fact.extra.reason} disabled={disabled} onSave={(reason) => edit({ kind: 'occurrence', id: fact.id, patch: { extra: { value: fact.extra!.value, reason } } })} onClear={() => edit({ kind: 'occurrence', id: fact.id, patch: { extra: null } })} />
      </div>
    );
  if (!open)
    return (
      <Button size="sm" variant="ghost" className="text-muted-foreground h-8" disabled={disabled} onClick={() => setOpen(true)}>
        <Plus /> Table modifier
      </Button>
    );
  return (
    <form
      className="flex items-center gap-2 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        edit({ kind: 'occurrence', id: fact.id, patch: { extra: { value, reason: '' } } });
        setOpen(false);
      }}
    >
      <span className="text-muted-foreground">Table modifier</span>
      <Button type="button" size="icon" variant="outline" className="size-9" onClick={() => setValue(value - 1)}>−</Button>
      <span className="w-8 text-center font-mono">{signed(value)}</span>
      <Button type="button" size="icon" variant="outline" className="size-9" onClick={() => setValue(value + 1)}>+</Button>
      <Button type="submit" size="sm" variant="outline" disabled={value === 0}>Add</Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
    </form>
  );
}

/** One check: die, bonus = total vs DC, outcome, and the modifier breakdown on a second line. */
export function CheckRow({ check, fact, edit, disabled, rollId, compact }: { check: CheckFact; fact: EventFact; edit: EventProps['edit']; disabled: boolean; rollId: string; compact?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={cn('text-sm', compact ? 'w-auto' : 'w-44')}>
          {check.label}
          <span className="text-muted-foreground block text-xs">{check.kind}</span>
        </span>
        <DieField label={`Event ${fact.number} ${check.label}`} value={check.die} disabled={disabled} sides={20} onValue={(v) => (rollId.startsWith('sabotage') ? edit({ kind: 'occurrence', id: fact.id, patch: { sabotage: { ...fact.sabotage.value!, roll: v } } }) : edit({ kind: 'roll', id: fact.id, rollId, value: v }))} />
        <span className="text-sm">
          <span className="font-mono">{signed(check.bonus)}</span>
          {check.total !== null && (
            <>
              {' '}= <strong className="font-mono">{check.total}</strong>
            </>
          )}
          <span className="text-muted-foreground"> vs DC {check.dc}</span>
          {!compact && check.modifiers.length > 0 && <span className="text-muted-foreground block text-xs">{check.modifiers.map((m) => `${m.label} ${signed(m.value)}`).join(' · ')}</span>}
        </span>
        {check.outcome && <span className={cn('ml-auto text-sm', check.outcome.startsWith('Success') ? 'text-emerald-300' : 'text-amber-200')}>{check.outcome}</span>}
      </div>
    </div>
  );
}

export function PickInput({ input, fact, edit, disabled, as = 'cards' }: { input: Extract<InputFact, { kind: 'pick' }>; fact: EventFact; edit: EventProps['edit']; disabled: boolean; as?: 'cards' | 'select' }) {
  const toggle = (id: string) => {
    const has = input.value.includes(id);
    const next = has ? input.value.filter((v) => v !== id) : input.count === 1 ? [id] : [...input.value, id].slice(-input.count);
    edit({ kind: 'occurrence', id: fact.id, patch: { targets: next } });
  };
  if (as === 'select' && input.count === 1)
    return (
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground w-44">{input.label}</span>
        <Select value={input.value[0] ?? '__none'} disabled={disabled} onValueChange={(v) => edit({ kind: 'occurrence', id: fact.id, patch: { targets: v === '__none' ? [] : [v] } })}>
          <SelectTrigger className={cn('h-10 w-56', !input.value.length && 'border-primary')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[70]">
            <SelectItem value="__none" className="min-h-11">Not chosen</SelectItem>
            {input.options.map((o) => (
              <SelectItem key={o.id} value={o.id} className="min-h-11">{o.title}{o.note ? ` · ${o.note}` : ''}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
    );
  return (
    <div className="space-y-1.5">
      <p className="text-sm">
        {input.label}
        {input.count > 1 && <span className="text-muted-foreground"> · choose {input.count}</span>}
        {!input.value.length && <span className="text-primary ml-2 text-xs">required</span>}
      </p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-2">
        {input.options.map((o) => (
          <ChoiceCard key={o.id} selected={input.value.includes(o.id)} disabled={disabled} title={o.title} note={o.note} onClick={() => toggle(o.id)} />
        ))}
        {input.options.length === 0 && <p className="text-muted-foreground text-sm">Nothing eligible.</p>}
      </div>
    </div>
  );
}

export function AplInput({ input, fact, edit, disabled }: { input: Extract<InputFact, { kind: 'apl' }>; fact: EventFact; edit: EventProps['edit']; disabled: boolean }) {
  return (
    <label className="flex flex-wrap items-center gap-3 text-sm">
      <span className="w-44">
        {input.label}
        <span className="text-muted-foreground block text-xs">Encounter CR = APL + 1</span>
      </span>
      <DieField label={`Event ${fact.number} average party level`} value={input.value} disabled={disabled} onValue={(v) => edit({ kind: 'occurrence', id: fact.id, patch: { apl: v } })} />
      {input.value !== null && <span>→ CR {input.value + 1}</span>}
    </label>
  );
}

export function OfficerInput({ input, fact, edit, disabled }: { input: Extract<InputFact, { kind: 'officer' }>; fact: EventFact; edit: EventProps['edit']; disabled: boolean }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm">
        {input.label} <span className="text-muted-foreground">· {input.skills.length === 1 ? 'Diplomacy' : 'Bluff, Diplomacy or Intimidate'} DC {input.dc}</span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {people.map((p) => (
          <ChoiceCard key={p.id} className="min-h-12" selected={input.value.officerId === p.id} disabled={disabled} title={p.name} note={`${p.role} · ${input.skills.map((s) => `${s[0]!.toUpperCase() + s.slice(1)} ${signed(p.skills[s])}`).join(' · ')}`} onClick={() => edit({ kind: 'occurrence', id: fact.id, patch: { officerId: input.value.officerId === p.id ? null : p.id } })} />
        ))}
        {input.skills.length > 1 && (
          <Select value={input.value.skill} disabled={disabled} onValueChange={(v) => edit({ kind: 'occurrence', id: fact.id, patch: { skill: v as typeof input.value.skill } })}>
            <SelectTrigger className="h-10 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[70]">
              {input.skills.map((s) => (
                <SelectItem key={s} value={s} className="min-h-11">{s[0]!.toUpperCase() + s.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}

export function RewardsInput({ input, fact, edit, disabled }: { input: Extract<InputFact, { kind: 'rewards' }>; fact: EventFact; edit: EventProps['edit']; disabled: boolean }) {
  const [personId, setPersonId] = useState<string>(people.find((p) => p.pc)!.id);
  const [name, setName] = useState('');
  const [gp, setGp] = useState('');
  const save = (rewards: Reward[]) => edit({ kind: 'occurrence', id: fact.id, patch: { rewards } });
  return (
    <div className="space-y-2">
      <p className="text-sm">
        {input.label} <span className="text-muted-foreground">· {input.value.length} of {input.count}</span>
      </p>
      {input.value.length > 0 && (
        <ul className="divide-foreground/10 divide-y text-sm">
          {input.value.map((r, i) => (
            <li key={`${r.personId}:${r.name}:${r.gp}`} className="flex items-center gap-3 py-1.5">
              <span className="flex-1">{personName(r.personId)}: {r.name}</span>
              <span className="font-mono">{r.gp} gp</span>
              <Button size="icon" variant="ghost" className="size-8" aria-label="Remove item" disabled={disabled} onClick={() => save(input.value.filter((_, j) => j !== i))}>
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {input.value.length < input.count && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name || !gp) return;
            save([...input.value, { personId, name, gp: Number(gp) }]);
            setName('');
            setGp('');
          }}
        >
          <Select value={personId} disabled={disabled} onValueChange={setPersonId}>
            <SelectTrigger className="h-10 w-36"><SelectValue /></SelectTrigger>
            <SelectContent className="z-[70]">
              {people.filter((p) => p.pc).map((p) => (
                <SelectItem key={p.id} value={p.id} className="min-h-11">{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input aria-label="Item" placeholder="Item" value={name} disabled={disabled} onChange={(e) => setName(e.target.value)} className="h-10 w-44" />
          <Input aria-label="Value (gp)" placeholder="gp" inputMode="numeric" value={gp} disabled={disabled} onChange={(e) => /^[0-9]*$/.test(e.target.value) && setGp(e.target.value)} className="h-10 w-20 text-center font-mono" />
          <Button type="submit" size="sm" variant="outline" disabled={disabled || !name || !gp}><Plus /> Add</Button>
        </form>
      )}
    </div>
  );
}

export function InputsFor({ fact, edit, disabled, pickAs }: { fact: EventFact; edit: EventProps['edit']; disabled: boolean; pickAs?: 'cards' | 'select' }) {
  return (
    <>
      {fact.inputs.map((input) => {
        switch (input.kind) {
          case 'pick':
            return <PickInput key={input.kind} input={input} fact={fact} edit={edit} disabled={disabled} as={pickAs} />;
          case 'apl':
            return <AplInput key={input.kind} input={input} fact={fact} edit={edit} disabled={disabled} />;
          case 'officer':
            return <OfficerInput key={input.kind} input={input} fact={fact} edit={edit} disabled={disabled} />;
          case 'rewards':
            return <RewardsInput key={input.kind} input={input} fact={fact} edit={edit} disabled={disabled} />;
          default:
            return null;
        }
      })}
    </>
  );
}

/** Optional mitigation as two cards; the check appears only when attempted. */
export function MitigationChoice({ fact, edit, disabled }: { fact: EventFact; edit: EventProps['edit']; disabled: boolean }) {
  if (fact.mitigation.state === 'unavailable') return null;
  const set = (m: 'attempted' | 'unattempted') => edit({ kind: 'occurrence', id: fact.id, patch: { mitigation: m } });
  return (
    <div className="space-y-2">
      <p className="text-sm">
        Mitigation <span className="text-muted-foreground">· optional · {fact.mitigation.label}</span>
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <ChoiceCard selected={fact.mitigation.state === 'attempted'} disabled={disabled} title="Attempt it" note={fact.mitigation.label ?? ''} onClick={() => set('attempted')} />
        <ChoiceCard selected={fact.mitigation.state === 'unattempted'} disabled={disabled} title="Let it happen" note="No check; the event applies in full" onClick={() => set('unattempted')} />
      </div>
    </div>
  );
}

export function ChecksFor({ fact, edit, disabled, compact }: { fact: EventFact; edit: EventProps['edit']; disabled: boolean; compact?: boolean }) {
  const checks = fact.checks.filter((c) => c.id !== 'sabotage');
  if (!checks.length) return null;
  return (
    <div className="space-y-2">
      {checks.map((c) => (
        <CheckRow key={c.id} check={c} fact={fact} edit={edit} disabled={disabled} rollId={c.id} compact={compact} />
      ))}
    </div>
  );
}

/** Raw dice that aren't checks (training loss, capture rolls). */
export function PlainRolls({ fact, edit, disabled }: { fact: EventFact; edit: EventProps['edit']; disabled: boolean }) {
  const rolls: { id: string; label: string; note: string; sides: number }[] = [];
  if (fact.type === 'turncoat') rolls.push({ id: 'loss', label: 'Training loss', note: `1d6 + ${rank}`, sides: 6 });
  if (fact.type === 'raid' && fact.inputs.some((i) => i.kind === 'pick' && i.value.length)) rolls.push({ id: 'capture:h-wren', label: 'Capture roll for Wren Ashby', note: 'd100 · captured on 50 or less (25 if mitigated)', sides: 100 });
  if (!rolls.length) return null;
  return (
    <div className="space-y-2">
      {rolls.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-3 text-sm">
          <span className="w-44">
            {r.label}
            <span className="text-muted-foreground block text-xs">{r.note}</span>
          </span>
          <DieField label={`Event ${fact.number} ${r.label}`} value={rollValue(fact, r.id)} disabled={disabled} sides={r.sides} onValue={(v) => edit({ kind: 'roll', id: fact.id, rollId: r.id, value: v })} />
        </div>
      ))}
    </div>
  );
}
/** The projection doesn't carry raw plain rolls, so variants read them from state via this hook-free helper. */
let currentState: State | null = null;
export function bindState(state: State) {
  currentState = state;
}
function rollValue(fact: EventFact, rollId: string) {
  return currentState?.occurrences.find((o) => o.id === fact.id)?.rolls[rollId] ?? null;
}

export function AcknowledgementField({ fact, edit, disabled }: { fact: EventFact; edit: EventProps['edit']; disabled: boolean }) {
  const [draft, setDraft] = useState(fact.acknowledgement.text);
  const [editing, setEditing] = useState(!fact.acknowledgement.text);
  if (fact.acknowledgement.text && !editing)
    return (
      <p className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">What happened:</span>
        <span className="italic">“{fact.acknowledgement.text}”</span>
        <Button size="icon" variant="ghost" className="size-8" aria-label="Edit what happened" disabled={disabled} onClick={() => setEditing(true)}><Pencil className="size-3.5" /></Button>
        <Button size="icon" variant="ghost" className="size-8" aria-label="Clear what happened" disabled={disabled} onClick={() => { setDraft(''); edit({ kind: 'acknowledge', id: fact.id, text: null }); setEditing(true); }}><X className="size-3.5" /></Button>
      </p>
    );
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.trim()) return;
        edit({ kind: 'acknowledge', id: fact.id, text: draft.trim() });
        setEditing(false);
      }}
    >
      <span className="text-muted-foreground shrink-0 text-sm">
        What happened{fact.acknowledgement.required ? <span className="text-primary ml-1 text-xs">required</span> : <span className="ml-1 text-xs">optional</span>}
      </span>
      <Input value={draft} disabled={disabled} placeholder="The table's outcome, in a sentence" onChange={(e) => setDraft(e.target.value)} className="h-10 min-w-0 flex-1" />
      <Button type="submit" size="sm" variant="outline" disabled={disabled || !draft.trim()}>Save</Button>
    </form>
  );
}

export function OutcomesList({ fact, className }: { fact: EventFact; className?: string }) {
  if (!fact.outcomes.length) return null;
  return (
    <ul aria-label={`Event ${fact.number} outcomes`} className={cn('space-y-0.5 text-sm', className)}>
      {fact.outcomes.map((o) => (
        <li key={o} className="flex items-start gap-1.5">
          <span className="text-muted-foreground">›</span>
          <span className={cn(/lost|−|captured|defects|disabled|halved|deactivate/.test(o) ? 'text-amber-200' : '')}>{o}</span>
        </li>
      ))}
    </ul>
  );
}

/** Sabotage: the Event-phase reactive action. A quiet button until used. */
export function SabotagePanel({ fact, edit, disabled }: { fact: EventFact; edit: EventProps['edit']; disabled: boolean }) {
  const sb = fact.sabotage;
  if (!sb.available) return null;
  const patch = (p: Partial<NonNullable<typeof sb.value>>) => edit({ kind: 'occurrence', id: fact.id, patch: { sabotage: { ...(sb.value ?? { teamId: null, check: null, roll: null, notorietyRoll: null }), ...p } } });
  if (!sb.value)
    return (
      <Button size="sm" variant="ghost" className="text-muted-foreground h-8" disabled={disabled} onClick={() => patch({})}>
        <Plus /> Sabotage this event
      </Button>
    );
  return (
    <div className="border-foreground/15 bg-background/40 space-y-2 border border-dashed p-3">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold">
          Sabotage <span className="text-muted-foreground font-normal">· reactive action · DC {sb.dc} · costs 1d6 notoriety</span>
        </p>
        <Button size="sm" variant="ghost" className="ml-auto h-8" disabled={disabled} onClick={() => edit({ kind: 'occurrence', id: fact.id, patch: { sabotage: null } })}>
          <X /> Cancel Sabotage
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {sb.teams.map((t) => (
          <ChoiceCard key={t.id} className="min-h-12" selected={sb.value?.teamId === t.id} disabled={disabled} title={t.title} note={t.note} onClick={() => patch({ teamId: t.id })} />
        ))}
        <span className="border-foreground/20 inline-flex self-center rounded-md border p-0.5">
          {(['loyalty', 'secrecy', 'security'] as const).map((c) => (
            <button key={c} type="button" disabled={disabled} aria-pressed={sb.value?.check === c} onClick={() => patch({ check: c })} className={cn('h-9 rounded px-3 text-sm', sb.value?.check === c ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
              {c[0]!.toUpperCase() + c.slice(1)}
            </button>
          ))}
        </span>
      </div>
      {sb.check && <CheckRow check={sb.check} fact={fact} edit={edit} disabled={disabled} rollId="sabotage" compact />}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="w-44">Notoriety roll</span>
        <DieField label={`Event ${fact.number} Sabotage notoriety roll`} value={sb.notorietyRoll} disabled={disabled} sides={6} onValue={(v) => patch({ notorietyRoll: v })} />
        {sb.result && <span className={cn('ml-auto', sb.result.startsWith('Sabotage succeeds') ? 'text-emerald-300' : 'text-amber-200')}>{sb.result}</span>}
      </div>
    </div>
  );
}

/** Everything about one resolved event below its table roll: inputs, mitigation, checks, outcomes, what happened, Sabotage, warnings, exceptions. */
export function EventBody({ fact, edit, disabled, pickAs, children }: { fact: EventFact; edit: EventProps['edit']; disabled: boolean; pickAs?: 'cards' | 'select'; children?: React.ReactNode }) {
  const inputs = fact.inputs.filter((i) => i.kind !== 'extra_modifier');
  const resolved = ['selected', 'twice', 'no_additional_effect', 'negated'].includes(fact.status);
  return (
    <div className="space-y-3">
      {fact.entry && (
        <p className="text-muted-foreground text-sm">
          {fact.mode === 'twice' && fact.entry.twice ? (
            <>
              <span className="text-foreground">Twice:</span> {fact.entry.twice}
            </>
          ) : (
            fact.entry.text
          )}
        </p>
      )}
      {children}
      {resolved && (
        <>
          {inputs.length > 0 && <InputsFor fact={fact} edit={edit} disabled={disabled} pickAs={pickAs} />}
          <PlainRolls fact={fact} edit={edit} disabled={disabled} />
          <MitigationChoice fact={fact} edit={edit} disabled={disabled} />
          <ChecksFor fact={fact} edit={edit} disabled={disabled} />
          <OutcomesList fact={fact} />
          {fact.type !== 'all_is_calm' && fact.type !== 'calm_before_the_storm' && <AcknowledgementField fact={fact} edit={edit} disabled={disabled} />}
          <SabotagePanel fact={fact} edit={edit} disabled={disabled} />
        </>
      )}
      <IssuesFor fact={fact} />
      <ExceptionsFor fact={fact} edit={edit} disabled={disabled} />
    </div>
  );
}

export function StatusChip({ fact, className }: { fact: EventFact; className?: string }) {
  const tone =
    fact.status === 'awaiting' ? 'bg-primary/20 text-primary-foreground'
      : fact.status === 'twice' ? 'bg-fuchsia-500/25'
        : fact.status === 'impossible' || fact.status === 'rerolled' ? 'bg-amber-500/25'
          : fact.status === 'negated' || fact.status === 'not_selected' ? 'bg-foreground/10 text-muted-foreground'
            : fact.status === 'expands' ? 'bg-sky-500/20'
              : 'bg-emerald-500/20';
  const label =
    fact.status === 'awaiting' ? 'Awaiting roll'
      : fact.status === 'twice' ? 'Twice'
        : fact.status === 'no_additional_effect' ? 'No extra effect'
          : fact.status === 'impossible' ? 'Cannot occur'
            : fact.status === 'rerolled' ? 'Reroll'
              : fact.status === 'negated' ? 'Sabotaged'
                : fact.status === 'not_selected' ? 'Not chosen'
                  : fact.status === 'expands' ? 'Two more'
                    : 'Happens';
  return <span className={cn('rounded px-1.5 py-0.5 text-xs whitespace-nowrap', tone, className)}>{label}</span>;
}

export function OriginText({ fact, list }: { fact: EventFact; list: EventFact[] }) {
  const parent = list.find((f) => f.id === fact.parentId);
  if (fact.origin.kind === 'automatic') return <>Automatic</>;
  if (fact.origin.kind === 'roll_twice') return <>From Event {parent?.number} (Roll Twice)</>;
  if (fact.origin.kind === 'replacement') return <>Replaces Event {parent?.number}</>;
  if (fact.candidateOf) return <>Activity candidate</>;
  return <>Rolled</>;
}

/** The branch a parent needs: placeholder dice for Roll Twice children or a replacement. Entering a die creates the child. */
export function NeededChildren({ fact, edit, disabled, list }: { fact: EventFact; edit: EventProps['edit']; disabled: boolean; list: EventFact[] }) {
  if (!fact.needsChildren) return null;
  const have = list.filter((f) => f.parentId === fact.id && f.origin.kind === fact.needsChildren!.kind).length;
  const missing = fact.needsChildren.count - have;
  if (missing <= 0) return null;
  const isReplacement = fact.needsChildren.kind === 'replacement';
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm">{isReplacement ? (fact.status === 'impossible' ? 'Roll a replacement' : 'Reroll') : `Roll ${missing === 2 ? 'two more' : 'one more'}`}</span>
      {Array.from({ length: missing }, (_, i) => (
        <DieField key={i} label={`Event ${fact.number} ${isReplacement ? 'replacement' : `child ${have + i + 1}`} table roll`} sides={100} value={null} disabled={disabled} onValue={(v) => v !== null && edit({ kind: 'add', origin: { kind: fact.needsChildren!.kind, parentId: fact.id }, candidateOf: fact.candidateOf ?? undefined, tableRoll: v })} />
      ))}
    </div>
  );
}

export function RemoveEvent({ fact, edit, disabled }: { fact: EventFact; edit: EventProps['edit']; disabled: boolean }) {
  return (
    <Button size="sm" variant="ghost" className="text-muted-foreground h-8" disabled={disabled} onClick={() => edit({ kind: 'remove', id: fact.id })}>
      <X /> Remove{fact.children.length ? ' with its branches' : ''}
    </Button>
  );
}
