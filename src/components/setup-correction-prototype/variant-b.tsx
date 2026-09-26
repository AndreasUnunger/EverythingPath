'use client';
// PROTOTYPE — Variant B: index and detail. Setup lists its steps down the left
// with their status and shows one step on the right. The Militia page lists
// sections down the left (carried state in its own read-only group) and shows
// the chosen one on the right; Correct turns that pane into the editor with a
// save bar. Characters & officers puts the roster beside compact role cards.

import { AlertTriangle, ArrowRight, Check, CircleAlert, Flag, Lock, Pencil } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { carriedBlocks, countOf, orElse, rolesOf, sections, type SectionKey, type Snapshot } from './mock';
import { assignRole, correctable, correctionLocked, removeRole, sectionWarnings, setupModel, startMilitia, stepForProblem, type VariantProps } from './model';
import { BlockRead, CarriedRead, CorrectionBody, ErrorSummary, Eyebrow, managedLabel, ReadOnlyNote, RoleCards, SavedLocallyNote, SectionWarnings, SetupStepBody, WarningLine } from './parts';

export const name = 'Index and detail';

export function VariantB(props: VariantProps) {
  if (props.screen === 'setup') return <Setup {...props} />;
  if (props.screen === 'characters') return <Characters {...props} />;
  return <Militia {...props} />;
}

function Setup(props: VariantProps) {
  const { state, dispatch } = props;
  const m = setupModel(state);
  const go = (step: number) => dispatch({ kind: 'setup:step', step });
  const patch = (fn: (s: Snapshot) => Snapshot) => dispatch({ kind: 'setup:patch', fn });
  return (
    <div className="grid flex-1 grid-cols-[15rem_1fr]">
      <aside className="bg-sidebar/40 flex flex-col border-r p-3">
        <div className="mb-3 grid grid-cols-2 overflow-hidden rounded-md border text-sm" role="radiogroup" aria-label="Starting point">
          {(['new', 'existing'] as const).map((mode) => (
            <button key={mode} role="radio" aria-checked={state.scenario.mode === mode} onClick={() => dispatch({ kind: 'scenario', key: 'mode', value: mode })} className={cn('py-1.5', state.scenario.mode === mode && 'bg-primary text-primary-foreground')}>
              {mode === 'new' ? 'New' : 'Existing'}
            </button>
          ))}
        </div>
        <ol className="space-y-0.5">
          {m.steps.map((s, i) => {
            const bad = s.errors.length > 0 && (s.visited || state.setup.attempted);
            return (
              <li key={s.key}>
                {s.key === 'conditions' && state.scenario.mode === 'new' && <p className="text-muted-foreground mt-2 mb-1 px-2 text-[11px] tracking-widest uppercase">Optional</p>}
                {s.key === 'review' && <div className="bg-foreground/15 my-2 h-px" />}
                <button onClick={() => go(i)} className={cn('flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm', i === m.current.index ? 'bg-primary text-primary-foreground' : 'hover:bg-foreground/5')}>
                  <span className="w-4 shrink-0">
                    {s.key === 'review' ? <Flag className="size-3.5" /> : bad ? <CircleAlert className="text-destructive size-3.5" /> : s.warnings.length ? <AlertTriangle className="size-3.5 text-amber-300" /> : s.visited ? <Check className="size-3.5" /> : null}
                  </span>
                  <span className="flex-1">{s.label}</span>
                  <span className="text-xs opacity-70">{s.caption}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="mt-auto pt-4">
          <SavedLocallyNote savedAt={state.setup.savedAt} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <div className="flex-1 space-y-4 p-5">
          <h1 className="text-2xl">{m.current.label}</h1>
          {m.current.key === 'review' ? (
            <div className="space-y-4">
              <ErrorSummary errors={state.setup.attempted ? m.errors : []} onGo={(p) => go(stepForProblem(p))} />
              <div className="space-y-1">
                <Eyebrow>Warnings by step</Eyebrow>
                {m.steps
                  .filter((s) => s.warnings.length)
                  .map((s) => (
                    <div key={s.key} className="space-y-0.5">
                      <button className="text-sm underline underline-offset-2" onClick={() => go(s.index)}>
                        {s.label}
                      </button>
                      {s.warnings.map((w) => (
                        <WarningLine key={w.text}>{w.text}</WarningLine>
                      ))}
                    </div>
                  ))}
                {m.warnings.length === 0 && <p className="text-muted-foreground text-sm">None.</p>}
                <p className="text-muted-foreground text-xs">Warnings never block. Keep a value if it’s intentional and say why in the setup notes.</p>
              </div>
              <label className="block space-y-1">
                <span className="text-sm font-medium">Setup notes</span>
                <textarea className="border-input bg-background min-h-28 w-full rounded-md border p-2 text-sm" value={m.draft.notes} onChange={(e) => patch((s) => ({ ...s, notes: e.target.value }))} />
              </label>
            </div>
          ) : (
            <SetupStepBody stepKey={m.current.key} blocks={m.current.blocks} draft={m.draft} mode={state.scenario.mode} patch={patch} errors={m.showErrors ? m.errors : []} warnings={m.current.warnings} columns={2} />
          )}
        </div>
        <footer className="bg-background sticky bottom-0 flex items-center justify-end gap-3 border-t px-5 py-3">
          {m.current.key === 'review' ? (
            <Button size="lg" onClick={() => startMilitia(props)}>
              <Flag /> Start militia week
            </Button>
          ) : (
            <Button onClick={() => go(m.current.index + 1)}>
              Next: {m.steps[m.current.index + 1]!.label} <ArrowRight />
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
}

type Pick_ = SectionKey | 'carried';

function Militia({ state, dispatch }: VariantProps) {
  const [picked, setPicked] = useState<Pick_>('values');
  const current: Pick_ = state.correction && state.correction.section !== 'people' ? state.correction.section : picked;
  const list = sections.filter((s) => correctable().includes(s.key));
  const editing = !!state.correction && state.correction.section === current;
  const section = current === 'carried' ? null : sections.find((s) => s.key === current)!;
  return (
    <div className="grid flex-1 grid-cols-[15rem_1fr]">
      <aside className="bg-sidebar/40 border-r p-3">
        <ul className="space-y-0.5">
          {list.map((s) => {
            const n = countOf(state.latest, s.key);
            const w = sectionWarnings(state.latest, s.key).length;
            return (
              <li key={s.key}>
                <button disabled={!!state.correction && state.correction.section !== s.key} onClick={() => setPicked(s.key)} className={cn('flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm disabled:opacity-40', current === s.key ? 'bg-primary text-primary-foreground' : 'hover:bg-foreground/5')}>
                  <span className="flex-1">{s.label}</span>
                  {state.correction?.section === s.key && <Pencil className="size-3.5" />}
                  {w > 0 && <AlertTriangle className="size-3.5 text-amber-300" />}
                  {n !== null && <span className="text-xs opacity-70">{n}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="text-muted-foreground mt-4 mb-1 flex items-center gap-1 px-2 text-[11px] tracking-widest uppercase">
          <Lock className="size-3" /> Changes through the week
        </p>
        <button disabled={!!state.correction} onClick={() => setPicked('carried')} className={cn('flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm disabled:opacity-40', current === 'carried' ? 'bg-primary text-primary-foreground' : 'hover:bg-foreground/5')}>
          <span className="flex-1">Week & carried effects</span>
          <span className="text-xs opacity-70">{carriedBlocks.reduce((n, b) => n + (state.latest[b.key] as unknown[]).length, 0)}</span>
        </button>
      </aside>
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h1 className="text-2xl">{section ? section.label : `Week ${state.latest.week.week} & carried effects`}</h1>
          {section && !editing && (
            <Button onClick={() => dispatch({ kind: 'correct:open', section: section.key })} disabled={correctionLocked(state, section.key)}>
              <Pencil /> Correct {section.label.toLowerCase()}
            </Button>
          )}
          {!section && <ReadOnlyNote />}
        </div>
        <div className="flex-1 space-y-4 p-5">
          {!section ? (
            <CarriedRead snapshot={state.latest} />
          ) : editing ? (
            <CorrectionBody state={state} dispatch={dispatch} columns={3} />
          ) : (
            <>
              {section.blocks.map((b) => (
                <div key={b.key} className="space-y-1">
                  {section.blocks.length > 1 && <Eyebrow>{b.label}</Eyebrow>}
                  <BlockRead block={b} snapshot={state.latest} />
                </div>
              ))}
              <SectionWarnings warnings={sectionWarnings(state.latest, section.key)} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Characters({ state, dispatch }: VariantProps) {
  const editing = state.correction?.section === 'people';
  const snap = editing ? state.correction!.draft : state.latest;
  const [picked, setPicked] = useState(snap.people[0]!.id);
  const person = snap.people.find((p) => p.id === picked) ?? snap.people[0]!;
  return (
    <div className="grid flex-1 grid-cols-[1fr_26rem]">
      <div className="min-w-0 space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl">Characters & officers</h1>
          {!editing && (
            <Button variant="outline" disabled={correctionLocked(state, 'people')} onClick={() => dispatch({ kind: 'correct:open', section: 'people' })}>
              <Pencil /> Correct officers & roster
            </Button>
          )}
        </div>
        {editing ? (
          <CorrectionBody state={state} dispatch={dispatch} />
        ) : (
          <ul className="divide-foreground/10 border-foreground/20 divide-y border">
            {snap.people.map((p) => (
              <li key={p.id}>
                <button onClick={() => setPicked(p.id)} className={cn('flex w-full items-center gap-3 px-3 py-2 text-left', p.id === person.id && 'bg-foreground/5', p.onRoster === false && 'text-muted-foreground')}>
                  <span className="flex-1">
                    {p.name}
                    <span className="text-muted-foreground block text-xs">{p.onRoster === false ? 'Not in the militia' : `${String(p.kind).toUpperCase()} · ${String(orElse(p.hitDice, p.level ?? ''))} HD${managedLabel(snap, p) ? ` · ${managedLabel(snap, p)}` : ''}`}</span>
                  </span>
                  {rolesOf(p).map((r) => (
                    <span key={r} className="rounded-full border px-2 text-xs capitalize">
                      {r}
                    </span>
                  ))}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <aside className="bg-sidebar/40 space-y-3 border-l p-4">
        <Eyebrow>Officer roles</Eyebrow>
        <RoleCards snapshot={snap} editing={editing} compact onAssign={(r, id) => dispatch({ kind: 'correct:patch', fn: assignRole(r, id) })} onRemove={(r, id) => dispatch({ kind: 'correct:patch', fn: removeRole(r, id) })} />
      </aside>
    </div>
  );
}
