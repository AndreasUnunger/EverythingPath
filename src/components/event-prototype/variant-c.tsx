'use client';
// PROTOTYPE — Variant C: a dice ledger beside the event table. The left column
// is one line per roll in the order the table makes them (chance, table rolls,
// checks), each line expandable to its event's inputs and outcomes. The right
// column is Table 6-3 itself, with each rolled row marked, so the settlement's
// ±5 shift is visible as a move on the table.

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { cn } from '~/lib/utils';
import { type EventFact, eventTable, rank, signed } from './mock';
import { ChoiceCard, DieField, EventBody, type EventProps, ExtraModifier, NeededChildren, OriginText, RemoveEvent, StatusChip, TableRoll } from './parts';

export const name = 'Dice ledger + event table';

export function VariantC(p: EventProps) {
  const { view, state, edit, disabled } = p;
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setCollapsed({ ...collapsed, [id]: !collapsed[id] });
  const hits = new Map<string, EventFact[]>();
  for (const f of view.list) if (f.entry) hits.set(f.entry.type, [...(hits.get(f.entry.type) ?? []), f]);

  const Line = ({ fact }: { fact: EventFact }) => {
    const open = !collapsed[fact.id];
    const chosen = fact.candidateOf && view.guarantee?.selectedId === fact.id;
    return (
      <li className={cn('space-y-2 py-2', fact.status === 'not_selected' && 'opacity-60')} style={{ paddingLeft: `${fact.depth * 1.25}rem` }}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button type="button" aria-label={open ? `Collapse Event ${fact.number}` : `Expand Event ${fact.number}`} onClick={() => toggle(fact.id)} className="text-muted-foreground">
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
          <span className="w-24 text-sm">
            Event {fact.number}
            <span className="text-muted-foreground block text-xs">
              <OriginText fact={fact} list={view.list} />
            </span>
          </span>
          <TableRoll fact={fact} edit={edit} disabled={disabled} compact />
          <StatusChip fact={fact} className="ml-auto" />
        </div>
        {open && (
          <div className="ml-7 space-y-3">
            {fact.candidateOf && fact.entry && (
              <ChoiceCard className="w-full" selected={Boolean(chosen)} disabled={disabled} title={chosen ? 'This one happens' : 'Choose this event'} note={fact.statusText} onClick={() => edit({ kind: 'select_candidate', id: fact.id })} />
            )}
            <EventBody fact={fact} edit={edit} disabled={disabled} pickAs="select">
              <NeededChildren fact={fact} edit={edit} disabled={disabled} list={view.list} />
            </EventBody>
            <div className="flex flex-wrap items-center gap-2">
              <ExtraModifier fact={fact} edit={edit} disabled={disabled} />
              <span className="ml-auto" />
              <RemoveEvent fact={fact} edit={edit} disabled={disabled} />
            </div>
          </div>
        )}
        {fact.children.length > 0 && <ul className="divide-foreground/10 divide-y">{fact.children.map((c) => <Line key={c.id} fact={c} />)}</ul>}
      </li>
    );
  };

  const roots = [...(view.automatic?.events ?? []), ...(view.guarantee ? view.guarantee.candidates : view.roots.filter((r) => r.origin.kind === 'rolled'))];
  const missing: { label: string; add: (v: number) => void }[] = [];
  if (view.automatic && view.automatic.events.length < view.automatic.source.count) missing.push({ label: `Automatic event · ${view.automatic.source.label}`, add: (v) => edit({ kind: 'add', origin: { kind: 'automatic', sourceId: view.automatic!.source.id }, tableRoll: v }) });
  if (view.guarantee) for (let i = view.guarantee.candidates.length; i < 2; i++) missing.push({ label: `Candidate ${i + 1} · ${view.guarantee.choice.label}`, add: (v) => edit({ kind: 'add', origin: { kind: 'rolled' }, candidateOf: view.guarantee!.choice.id, tableRoll: v }) });
  else if (view.chanceOutcome === 'event' && !view.roots.some((r) => r.origin.kind === 'rolled')) missing.push({ label: 'Event table roll', add: (v) => edit({ kind: 'add', origin: { kind: 'rolled' }, tableRoll: v }) });

  return (
    <div className="flex gap-4">
      <ul aria-label="Dice ledger" className="divide-foreground/10 min-w-0 flex-1 divide-y">
        <li className="space-y-1 py-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="w-4" />
            <span className="w-24 text-sm">
              Chance
              <span className="text-muted-foreground block text-xs">d100</span>
            </span>
            {view.chanceOutcome === 'skipped' ? (
              <span className="text-muted-foreground text-sm">{view.chanceSkippedReason}</span>
            ) : (
              <>
                <DieField label="Event chance roll" value={state.chanceRoll} disabled={disabled} onValue={(v) => edit({ kind: 'chance', roll: v })} />
                <span className="text-sm">
                  vs <strong className="font-mono">{view.chance}%</strong>
                  <span className="text-muted-foreground block text-xs">{view.chanceModifiers.map((m) => `${m.label} ${m.value}`).join(' + ')}</span>
                </span>
                <span className={cn('ml-auto text-sm', view.chanceOutcome === 'event' ? 'text-amber-200' : view.chanceOutcome === 'quiet' ? 'text-emerald-300' : 'text-muted-foreground')}>
                  {view.chanceOutcome === 'event' ? 'An event happens' : view.chanceOutcome === 'quiet' ? `A quiet week · next week ${signed(rank)}` : '—'}
                </span>
              </>
            )}
          </div>
        </li>
        {roots.map((f) => (
          <Line key={f.id} fact={f} />
        ))}
        {missing.map((m) => (
          <li key={m.label} className="flex flex-wrap items-center gap-x-3 py-2">
            <span className="w-4" />
            <span className="text-sm">{m.label}</span>
            <DieField label={`${m.label} table roll`} sides={100} value={null} disabled={disabled} onValue={(v) => v !== null && m.add(v)} />
          </li>
        ))}
        {view.ready && (
          <li className="text-muted-foreground py-2 text-sm">
            {view.selected.filter((f) => f.status !== 'negated').length ? `This week: ${view.selected.filter((f) => f.status !== 'negated').map((f) => f.name).join(', ')}.` : 'No event this week.'} {view.nextUneventfulCarry ? `Uneventful: next week's chance ${signed(rank)}.` : ''}
          </li>
        )}
      </ul>

      <aside aria-label="Event table" className="bg-card border-foreground/20 sticky top-3 w-60 shrink-0 self-start border p-2">
        <h3 className="text-muted-foreground mb-1 flex items-baseline justify-between px-1 text-xs tracking-widest uppercase">
          Table 6-3 · d%
          {view.operating?.modifier ? <span className="font-mono normal-case">{signed(view.operating.modifier)} {view.operating.name}</span> : null}
        </h3>
        <ol className="text-xs">
          {eventTable.map((e) => {
            const here = hits.get(e.type) ?? [];
            const raw = view.list.filter((f) => f.tableRoll !== null && f.tableRoll >= e.min && f.tableRoll <= e.max && f.total !== null && f.total !== f.tableRoll && f.entry?.type !== e.type);
            return (
              <li key={e.type} className={cn('flex items-center gap-2 px-1 py-0.5', here.length && 'bg-primary/20 font-semibold', raw.length && !here.length && 'text-muted-foreground line-through decoration-amber-400')}>
                <span className="w-12 font-mono">{e.min === e.max ? e.min : `${e.min}–${e.max}`}</span>
                <span className="flex-1">{e.name}</span>
                {here.map((f) => (
                  <span key={f.id} className="bg-primary text-primary-foreground rounded px-1 font-mono">{f.number}</span>
                ))}
                {raw.map((f) => (
                  <span key={f.id} className="rounded border border-amber-400 px-1 font-mono text-amber-300" title={`Raw ${f.tableRoll}, shifted to ${f.total}`}>{f.number}↓</span>
                ))}
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
}
