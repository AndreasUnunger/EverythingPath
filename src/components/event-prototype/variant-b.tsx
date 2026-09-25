'use client';
// PROTOTYPE — Variant B: an event board with details underneath, like the
// chosen Activity layout. One compact chance line on top, then a row of event
// cards in resolution order (children carry a "from Event N" mark and sit in a
// bracket after their parent). Tapping a card shows everything about that
// event under the board. Placeholders for rolls still needed are cards too.

import { useState } from 'react';
import { cn } from '~/lib/utils';
import { type EventFact, type Origin, rank, signed } from './mock';
import { ChoiceCard, DieField, EventBody, type EventProps, ExtraModifier, NeededChildren, OriginText, RemoveEvent, StatusChip, TableRoll } from './parts';

export const name = 'Event board + details';

type Card = { kind: 'event'; fact: EventFact } | { kind: 'placeholder'; parent: EventFact | null; label: string; origin: Origin; candidateOf?: string };

export function VariantB(p: EventProps) {
  const { view, state, edit, disabled } = p;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Board order: resolution order, with placeholders for what's still missing.
  const cards: Card[] = [];
  const push = (f: EventFact) => {
    cards.push({ kind: 'event', fact: f });
    if (f.needsChildren) {
      const have = view.list.filter((c) => c.parentId === f.id && c.origin.kind === f.needsChildren!.kind).length;
      for (let i = have; i < f.needsChildren.count; i++) cards.push({ kind: 'placeholder', parent: f, label: f.needsChildren.kind === 'replacement' ? 'Replacement' : `Roll ${i + 1} of 2`, origin: { kind: f.needsChildren.kind, parentId: f.id }, candidateOf: f.candidateOf ?? undefined });
    }
    f.children.forEach(push);
  };
  if (view.automatic) {
    view.automatic.events.forEach(push);
    if (view.automatic.events.length < view.automatic.source.count) cards.push({ kind: 'placeholder', parent: null, label: 'Automatic event', origin: { kind: 'automatic', sourceId: view.automatic.source.id } });
  }
  if (view.guarantee) {
    view.guarantee.candidates.forEach(push);
    for (let i = view.guarantee.candidates.length; i < 2; i++) cards.push({ kind: 'placeholder', parent: null, label: `Candidate ${i + 1}`, origin: { kind: 'rolled' }, candidateOf: view.guarantee.choice.id });
  } else if (view.chanceOutcome === 'event') {
    const roots = view.roots.filter((r) => r.origin.kind === 'rolled');
    roots.forEach(push);
    if (!roots.length) cards.push({ kind: 'placeholder', parent: null, label: 'Event table roll', origin: { kind: 'rolled' } });
  }
  const events = cards.filter((c): c is Extract<Card, { kind: 'event' }> => c.kind === 'event');
  const selected = events.find((c) => c.fact.id === selectedId) ?? events.find((c) => c.fact.requirements.length) ?? events[0];

  return (
    <section aria-label="Event phase" className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {view.chanceOutcome === 'skipped' ? (
          <p className="text-sm">
            <span className="text-muted-foreground">Event chance {view.chance}% · </span>
            {view.chanceSkippedReason}
          </p>
        ) : (
          <>
            <span className="text-sm">
              Event chance <strong className="font-mono">{view.chance}%</strong>
              <span className="text-muted-foreground block text-xs">{view.chanceModifiers.map((m) => `${m.label} ${m.value}`).join(' + ')}</span>
            </span>
            <DieField label="Event chance roll" value={state.chanceRoll} disabled={disabled} sides={100} onValue={(v) => edit({ kind: 'chance', roll: v })} />
            <span className={cn('text-sm', view.chanceOutcome === 'event' ? 'text-amber-200' : view.chanceOutcome === 'quiet' ? 'text-emerald-300' : 'text-muted-foreground')}>
              {view.chanceOutcome === 'event' ? '→ an event happens' : view.chanceOutcome === 'quiet' ? `→ a quiet week · next week ${signed(rank)}` : '→ below the chance means an event'}
            </span>
          </>
        )}
        {view.operating && (
          <span className="text-muted-foreground ml-auto text-xs">
            Table rolls {view.operating.modifier ? `${signed(view.operating.modifier)} · ${view.operating.name} (${view.operating.reputation})` : `±0 · ${view.operating.name}`}
          </span>
        )}
      </div>

      {view.guarantee && (
        <p className="text-muted-foreground text-sm">
          {view.guarantee.choice.label} in Action Slot {view.guarantee.choice.slot} ({view.guarantee.choice.team}): roll two candidates, then choose which happens.
        </p>
      )}

      {cards.length > 0 && (
        <ol aria-label="Events" className="flex flex-wrap gap-2">
          {cards.map((card) => {
            if (card.kind === 'placeholder')
              return (
                <li key={`ph-${card.parent?.id ?? 'root'}-${card.label}`} className="border-foreground/30 bg-background/40 flex min-h-24 w-40 flex-col justify-between rounded-md border-2 border-dashed p-2">
                  <span className="text-muted-foreground text-xs">{card.parent ? `From Event ${card.parent.number}` : card.candidateOf ? 'Activity candidate' : card.origin.kind === 'automatic' ? 'Automatic' : 'Rolled'}</span>
                  <span className="text-sm font-semibold">{card.label}</span>
                  <DieField label={`${card.label} table roll`} sides={100} value={null} disabled={disabled} className="w-full" onValue={(v) => v !== null && edit({ kind: 'add', origin: card.origin, candidateOf: card.candidateOf, tableRoll: v })} />
                </li>
              );
            const f = card.fact;
            const isSelected = selected?.fact.id === f.id;
            const open = f.requirements.length;
            return (
              <li key={f.id} className="flex items-stretch gap-2">
                {f.origin.kind === 'roll_twice' && view.list.find((x) => x.id === f.parentId)?.children[0]?.id === f.id && <span className="bg-foreground/30 w-0.5 self-stretch" />}
                <button
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={`Event ${f.number}`}
                  onClick={() => setSelectedId(f.id)}
                  className={cn(
                    'bg-card flex min-h-24 w-40 touch-manipulation flex-col justify-between rounded-md border-2 p-2 text-left transition-transform',
                    isSelected ? 'border-primary ring-primary/40 -translate-y-0.5 shadow-md ring-2' : 'border-foreground/20',
                    f.status === 'not_selected' && 'opacity-60',
                  )}
                >
                  <span className="flex items-center justify-between gap-1">
                    <span className="text-muted-foreground text-xs">
                      {f.number} · <OriginText fact={f} list={view.list} />
                    </span>
                  </span>
                  <span className="text-sm leading-tight font-semibold">{f.name}</span>
                  <span className="flex items-center justify-between gap-1">
                    <span className="font-mono text-xs">{f.tableRoll === null ? '—' : f.total !== f.tableRoll ? `${f.tableRoll}→${f.total}` : f.tableRoll}</span>
                    <StatusChip fact={f} />
                  </span>
                  <span className={cn('text-xs', open ? 'text-primary' : f.warnings.length ? 'text-amber-300' : 'text-emerald-300')}>{open ? `${open} to do` : f.warnings.length ? `${f.warnings.length} warning` : 'Ready'}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {cards.length === 0 && <p className="text-muted-foreground text-sm">{view.chanceOutcome === 'quiet' ? 'A quiet week: nothing to resolve.' : view.chanceOutcome === 'skipped' ? 'No events this week.' : 'Enter the chance roll first.'}</p>}

      {selected && (
        <div className="bg-card border-foreground/15 space-y-3 border p-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold">Event {selected.fact.number}</span>
            <TableRoll fact={selected.fact} edit={edit} disabled={disabled} />
            <span className="ml-auto flex items-center gap-2">
              <ExtraModifier fact={selected.fact} edit={edit} disabled={disabled} />
              <RemoveEvent fact={selected.fact} edit={edit} disabled={disabled} />
            </span>
          </div>
          <p className="text-muted-foreground -mt-2 text-xs">
            <OriginText fact={selected.fact} list={view.list} /> · {selected.fact.statusText}
          </p>
          {selected.fact.candidateOf && selected.fact.entry && (
            <ChoiceCard className="w-full" selected={view.guarantee?.selectedId === selected.fact.id} disabled={disabled} title={view.guarantee?.selectedId === selected.fact.id ? 'This one happens' : 'Choose this event'} note="The other candidate is recorded but does not happen" onClick={() => edit({ kind: 'select_candidate', id: selected.fact.id })} />
          )}
          <EventBody fact={selected.fact} edit={edit} disabled={disabled}>
            <NeededChildren fact={selected.fact} edit={edit} disabled={disabled} list={view.list} />
          </EventBody>
        </div>
      )}
    </section>
  );
}
