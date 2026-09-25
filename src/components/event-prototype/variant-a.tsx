'use client';
// PROTOTYPE — Variant A: the rules order. Numbered sections from the chance
// roll to the week's outcome, like the chosen Upkeep layout. Events are one
// block each, nested under the event that produced them (Roll Twice children,
// replacements). Everything about an event sits inside its block.

import { Check, Minus } from 'lucide-react';
import type React from 'react';
import { cn } from '~/lib/utils';
import { type EventFact, rank, signed } from './mock';
import { ChoiceCard, DieField, EventBody, type EventProps, ExtraModifier, NeededChildren, OriginText, RemoveEvent, StatusChip, TableRoll } from './parts';

export const name = 'Rules order';

function Step({ n, title, effect, open, skipped, children }: { n: number; title: string; effect?: React.ReactNode; open: number; skipped?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section aria-label={title} className={cn('border-foreground/15 border-l-2 pb-1 pl-4', skipped && 'opacity-60')}>
      <header className="-ml-[1.6rem] flex items-center gap-3">
        <span className={cn('bg-background flex size-7 items-center justify-center rounded-full border font-mono text-sm', skipped ? 'border-foreground/30' : open ? 'border-primary text-primary' : 'border-emerald-400 text-emerald-300')}>
          {skipped ? <Minus className="size-3.5" /> : open ? n : <Check className="size-4" />}
        </span>
        <h3 className="font-semibold">{title}</h3>
        {skipped ? <span className="text-muted-foreground text-sm">{skipped}</span> : <span className="text-muted-foreground ml-auto text-sm">{effect}</span>}
      </header>
      {!skipped && <div className="mt-2 space-y-3 pb-4">{children}</div>}
    </section>
  );
}

function EventBlock({ fact, p, candidate }: { fact: EventFact; p: EventProps; candidate?: boolean }) {
  const { view, edit, disabled } = p;
  const chosen = candidate && view.guarantee?.selectedId === fact.id;
  return (
    <div className={cn('bg-card border-foreground/15 space-y-3 border p-3', fact.status === 'not_selected' && 'opacity-60')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold">Event {fact.number}</span>
        <TableRoll fact={fact} edit={edit} disabled={disabled} />
        <StatusChip fact={fact} className="ml-auto" />
      </div>
      <p className="text-muted-foreground -mt-2 text-xs">
        <OriginText fact={fact} list={view.list} />
        {fact.mode === 'twice' && ' · rolled twice this phase'}
        {' · '}
        {fact.statusText}
      </p>
      {candidate && fact.entry && (
        <ChoiceCard className="w-full" selected={Boolean(chosen)} disabled={disabled} title={chosen ? 'This one happens' : 'Choose this event'} note={`${fact.name}: ${fact.entry.text}`} onClick={() => edit({ kind: 'select_candidate', id: fact.id })} />
      )}
      <EventBody fact={fact} edit={edit} disabled={disabled}>
        <NeededChildren fact={fact} edit={edit} disabled={disabled} list={view.list} />
      </EventBody>
      <div className="flex flex-wrap items-center gap-2">
        <ExtraModifier fact={fact} edit={edit} disabled={disabled} />
        <span className="ml-auto" />
        <RemoveEvent fact={fact} edit={edit} disabled={disabled} />
      </div>
      {fact.children.length > 0 && (
        <div className="border-foreground/20 ml-3 space-y-3 border-l-2 pl-3">
          {fact.children.map((c) => (
            <EventBlock key={c.id} fact={c} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}

export function VariantA(p: EventProps) {
  const { view, state, edit, disabled } = p;
  const openFor = (subjects: string[]) => view.requirements.filter((r) => subjects.includes(r.subject)).length;
  const eventIds = view.list.map((f) => f.id);
  const rolledRoots = view.roots.filter((r) => r.origin.kind === 'rolled');
  const happened = view.selected.filter((f) => f.status !== 'negated');
  let n = 0;

  return (
    <div className="space-y-2 pl-4">
      <Step
        n={++n}
        title="Event chance"
        open={openFor(['chance'])}
        skipped={view.chanceOutcome === 'skipped' ? view.chanceSkippedReason : undefined}
        effect={view.chanceOutcome === 'event' ? 'An event happens' : view.chanceOutcome === 'quiet' ? `No event · next week ${signed(rank)}` : 'waiting for dice'}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="w-52 text-sm">
            Chance roll
            <span className="text-muted-foreground block text-xs">below {view.chance}% means an event</span>
          </span>
          <DieField label="Event chance roll" value={state.chanceRoll} disabled={disabled} sides={100} onValue={(v) => edit({ kind: 'chance', roll: v })} />
          <span className="text-sm">
            vs <strong className="font-mono">{view.chance}%</strong>
            <span className="text-muted-foreground block text-xs">{view.chanceModifiers.map((m) => `${m.label} ${m.value}`).join(' + ')}</span>
          </span>
          {view.chanceOutcome !== 'pending' && (
            <span className={cn('ml-auto text-sm', view.chanceOutcome === 'event' ? 'text-amber-200' : 'text-emerald-300')}>
              {view.chanceOutcome === 'event' ? `${state.chanceRoll} is below ${view.chance}: an event happens` : `${state.chanceRoll} is not below ${view.chance}: a quiet week`}
            </span>
          )}
        </div>
        {view.operating && (
          <p className="text-muted-foreground text-xs">
            Table rolls take {view.operating.modifier ? `${signed(view.operating.modifier)} from operating in ${view.operating.name} (${view.operating.reputation})` : `no modifier: ${view.operating.name} is ${view.operating.reputation}`}. Change the settlement in Activity.
          </p>
        )}
      </Step>

      {view.automatic && (
        <Step n={++n} title="Automatic events" open={openFor(['automatic', ...view.automatic.events.map((e) => e.id)])} effect={`${view.automatic.source.label} (week ${view.automatic.source.week})`}>
          <p className="text-muted-foreground text-sm">Last week's {view.automatic.source.label} brings {view.automatic.source.count} automatic event before the normal roll. A Roll Twice here is rerolled.</p>
          {view.automatic.events.map((f) => (
            <EventBlock key={f.id} fact={f} p={p} />
          ))}
          {view.automatic.events.length < view.automatic.source.count && (
            <div className="flex items-center gap-3 text-sm">
              Roll the automatic event
              <DieField label="Automatic event table roll" sides={100} value={null} disabled={disabled} onValue={(v) => v !== null && edit({ kind: 'add', origin: { kind: 'automatic', sourceId: view.automatic!.source.id }, tableRoll: v })} />
            </div>
          )}
        </Step>
      )}

      {view.guarantee ? (
        <Step n={++n} title="Event candidates" open={openFor(['guarantee', ...view.guarantee.candidates.map((c) => c.id)])} effect={`${view.guarantee.choice.label} · Action Slot ${view.guarantee.choice.slot} · ${view.guarantee.choice.team}`}>
          <p className="text-muted-foreground text-sm">Roll on the event table twice. Both rolls are needed, then the table chooses which event happens.</p>
          <div className="grid grid-cols-2 gap-3">
            {view.guarantee.candidates.map((c) => (
              <EventBlock key={c.id} fact={c} p={p} candidate />
            ))}
            {view.guarantee.candidates.length < 2 && (
              <div className="border-foreground/20 flex items-center gap-3 border border-dashed p-3 text-sm">
                Roll candidate {view.guarantee.candidates.length + 1}
                <DieField label={`Candidate ${view.guarantee.candidates.length + 1} table roll`} sides={100} value={null} disabled={disabled} onValue={(v) => v !== null && edit({ kind: 'add', origin: { kind: 'rolled' }, candidateOf: view.guarantee!.choice.id, tableRoll: v })} />
              </div>
            )}
          </div>
        </Step>
      ) : (
        <Step
          n={++n}
          title="The event"
          open={openFor(eventIds.filter((id) => !view.automatic?.events.some((e) => e.id === id)))}
          skipped={view.chanceOutcome === 'skipped' ? 'No rolled event this week' : view.chanceOutcome === 'quiet' ? 'A quiet week' : view.chanceOutcome === 'pending' ? 'Waiting for the chance roll' : undefined}
          effect={happened.length ? happened.map((f) => f.name).join(' · ') : 'waiting for dice'}
        >
          {rolledRoots.map((f) => (
            <EventBlock key={f.id} fact={f} p={p} />
          ))}
          {rolledRoots.length === 0 && (
            <div className="flex items-center gap-3 text-sm">
              Roll on the event table
              <DieField label="Event table roll" sides={100} value={null} disabled={disabled} onValue={(v) => v !== null && edit({ kind: 'add', origin: { kind: 'rolled' }, tableRoll: v })} />
            </div>
          )}
        </Step>
      )}

      <Step n={++n} title="Week outcome" open={0} effect={view.ready ? '' : 'waiting for the steps above'}>
        {view.ready ? (
          <ul className="space-y-1 text-sm">
            <li>{happened.length ? `This week: ${happened.map((f) => f.name + (f.mode === 'twice' ? ' (twice)' : '')).join(', ')}.` : 'No event this week.'}</li>
            {view.selected.filter((f) => f.status === 'negated').map((f) => (
              <li key={f.id}>{f.name} was sabotaged and does not happen.</li>
            ))}
            <li className="text-muted-foreground">{view.nextUneventfulCarry ? `Uneventful: next week's event chance rises by ${rank}.` : 'Not an uneventful week: no chance bonus next week.'}</li>
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">The outcome is summarised here once every roll and decision above is in.</p>
        )}
      </Step>
    </div>
  );
}
