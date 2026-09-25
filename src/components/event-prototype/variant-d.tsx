'use client';
// PROTOTYPE — Variant D: the rules as a script. The phase reads as the Event
// procedure written out in sentences, with the dice and choices filled in
// inline where the rules ask for them, so one player can read it aloud. Each
// event is a paragraph; branches are indented paragraphs.

import type React from 'react';
import { cn } from '~/lib/utils';
import { type EventFact, rank } from './mock';
import { AcknowledgementField, ChecksFor, ChoiceCard, DieField, type EventProps, ExceptionsFor, ExtraModifier, InputsFor, IssuesFor, MitigationChoice, NeededChildren, OutcomesList, PlainRolls, RemoveEvent, SabotagePanel, TableRoll } from './parts';

export const name = 'The rules as a script';

function Para({ children, depth = 0, muted }: { children: React.ReactNode; depth?: number; muted?: boolean }) {
  return (
    <div className={cn('space-y-3 text-[15px] leading-8', muted && 'text-muted-foreground', depth > 0 && 'border-foreground/15 border-l-2 pl-4')} style={{ marginLeft: depth ? `${(depth - 1) * 1.25}rem` : 0 }}>
      {children}
    </div>
  );
}

function EventPara({ fact, p, intro }: { fact: EventFact; p: EventProps; intro: React.ReactNode }) {
  const { view, edit, disabled } = p;
  const resolved = ['selected', 'twice', 'no_additional_effect', 'negated'].includes(fact.status);
  const chosen = fact.candidateOf && view.guarantee?.selectedId === fact.id;
  return (
    <Para depth={fact.depth + (fact.candidateOf ? 1 : 0)} muted={fact.status === 'not_selected'}>
      <p>
        {intro} <TableRoll fact={fact} edit={edit} disabled={disabled} showName={false} />
        {fact.entry && (
          <>
            {' '}
            : <strong>{fact.name}</strong>
            {fact.mode === 'twice' && <em> — rolled twice, so its Twice clause applies</em>}
            {fact.mode === 'no_additional_effect' && <em> — rolled twice, no additional effect</em>}
            {fact.status === 'expands' && <em>. Roll and resolve two events.</em>}
            {fact.status === 'rerolled' && <em>. Roll Twice already took effect this phase, so reroll.</em>}
            {fact.status === 'impossible' && <em>. It cannot occur right now: reroll, or keep it with a Rules Exception.</em>}
            {resolved && fact.entry && <>. {fact.mode === 'twice' && fact.entry.twice ? fact.entry.twice : fact.entry.text}</>}
          </>
        )}
        {fact.status === 'negated' && <em> The Sabotage succeeded, so it does not happen.</em>}
      </p>
      <span className="flex flex-wrap items-center gap-2">
        <ExtraModifier fact={fact} edit={edit} disabled={disabled} />
        <RemoveEvent fact={fact} edit={edit} disabled={disabled} />
      </span>
      <NeededChildren fact={fact} edit={edit} disabled={disabled} list={view.list} />
      {fact.candidateOf && fact.entry && (
        <ChoiceCard className="w-full" selected={Boolean(chosen)} disabled={disabled} title={chosen ? 'This one happens' : 'Choose this event'} note={fact.entry.text} onClick={() => edit({ kind: 'select_candidate', id: fact.id })} />
      )}
      {resolved && (
        <>
          <InputsFor fact={fact} edit={edit} disabled={disabled} />
          <PlainRolls fact={fact} edit={edit} disabled={disabled} />
          <MitigationChoice fact={fact} edit={edit} disabled={disabled} />
          <ChecksFor fact={fact} edit={edit} disabled={disabled} compact />
          {fact.outcomes.length > 0 && (
            <p>
              So: <OutcomesList fact={fact} className="inline-block align-top leading-7" />
            </p>
          )}
          {fact.type !== 'all_is_calm' && fact.type !== 'calm_before_the_storm' && <AcknowledgementField fact={fact} edit={edit} disabled={disabled} />}
          <SabotagePanel fact={fact} edit={edit} disabled={disabled} />
        </>
      )}
      <IssuesFor fact={fact} />
      <ExceptionsFor fact={fact} edit={edit} disabled={disabled} />
      {fact.children.map((c) => (
        <EventPara key={c.id} fact={c} p={p} intro={c.origin.kind === 'replacement' ? 'Reroll on the event table:' : `Roll ${c === fact.children[0] ? 'once' : 'again'}:`} />
      ))}
    </Para>
  );
}

export function VariantD(p: EventProps) {
  const { view, state, edit, disabled } = p;
  const mods = view.operating?.modifier ? ` Operating from ${view.operating.name} (${view.operating.reputation}) ${view.operating.modifier > 0 ? 'adds' : 'subtracts'} ${Math.abs(view.operating.modifier)} on the table.` : '';
  const happened = view.selected.filter((f) => f.status !== 'negated');
  return (
    <article className="max-w-3xl space-y-5 pr-2">
      {view.automatic && (
        <Para>
          <p>
            Last week's <strong>{view.automatic.source.label}</strong> means {view.automatic.source.count === 1 ? 'one event happens' : 'two events happen'} automatically before the usual roll. A Roll Twice here is rerolled.{mods}
          </p>
          {view.automatic.events.map((f) => (
            <EventPara key={f.id} fact={f} p={p} intro="Roll on the event table:" />
          ))}
          {view.automatic.events.length < view.automatic.source.count && (
            <p>
              Roll on the event table: <DieField label="Automatic event table roll" sides={100} value={null} disabled={disabled} onValue={(v) => v !== null && edit({ kind: 'add', origin: { kind: 'automatic', sourceId: view.automatic!.source.id }, tableRoll: v })} />
            </p>
          )}
        </Para>
      )}

      {view.chanceOutcome === 'skipped' ? (
        <Para>
          <p>{view.chanceSkippedReason}{view.guarantee ? ` Roll on the event table twice${mods ? ',' : '.'}${mods} Then the table chooses which of the two happens.` : ''}</p>
        </Para>
      ) : (
        <Para>
          <p>
            Roll d% against the event chance of <strong className="font-mono">{view.chance}%</strong> ({view.chanceModifiers.map((m) => `${m.label.toLowerCase()} ${m.value}`).join(', plus ')}):{' '}
            <DieField label="Event chance roll" value={state.chanceRoll} disabled={disabled} onValue={(v) => edit({ kind: 'chance', roll: v })} />
            {view.chanceOutcome === 'event' && (
              <>
                {' '}
                — lower than {view.chance}, so <strong>an event happens</strong>.{mods}
              </>
            )}
            {view.chanceOutcome === 'quiet' && (
              <>
                {' '}
                — not lower than {view.chance}, so <strong>no event this week</strong>. Next week's chance rises by {rank}.
              </>
            )}
          </p>
        </Para>
      )}

      {view.guarantee?.candidates.map((f, i) => <EventPara key={f.id} fact={f} p={p} intro={`Candidate ${i + 1}:`} />)}
      {view.guarantee && view.guarantee.candidates.length < 2 && (
        <Para depth={1}>
          <p>
            Candidate {view.guarantee.candidates.length + 1}: <DieField label={`Candidate ${view.guarantee.candidates.length + 1} table roll`} sides={100} value={null} disabled={disabled} onValue={(v) => v !== null && edit({ kind: 'add', origin: { kind: 'rolled' }, candidateOf: view.guarantee!.choice.id, tableRoll: v })} />
          </p>
        </Para>
      )}

      {!view.guarantee &&
        view.chanceOutcome === 'event' &&
        (view.roots.filter((r) => r.origin.kind === 'rolled').length ? (
          view.roots.filter((r) => r.origin.kind === 'rolled').map((f) => <EventPara key={f.id} fact={f} p={p} intro="Roll on the event table:" />)
        ) : (
          <Para>
            <p>
              Roll on the event table: <DieField label="Event table roll" sides={100} value={null} disabled={disabled} onValue={(v) => v !== null && edit({ kind: 'add', origin: { kind: 'rolled' }, tableRoll: v })} />
            </p>
          </Para>
        ))}

      {view.ready && (
        <Para muted>
          <p>
            {happened.length ? `That is the Event phase: ${happened.map((f) => f.name + (f.mode === 'twice' ? ' (twice)' : '')).join(', ')}.` : 'That is the Event phase: nothing happened.'}{' '}
            {view.nextUneventfulCarry ? `It was uneventful, so next week's chance rises by ${rank}.` : 'It was not uneventful, so there is no chance bonus next week.'}
          </p>
        </Para>
      )}
    </article>
  );
}
