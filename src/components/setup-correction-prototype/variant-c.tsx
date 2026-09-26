'use client';
// PROTOTYPE — Variant C: overview first. Setup is one long page with a sticky
// jump bar and a sticky start bar; optional steps stay folded until opened.
// The Militia page is a grid of summary tiles; Correct opens the editor in a
// side sheet so the rest of the militia stays in view. Characters & officers
// is one table with the role strip on top; corrections use the same sheet.

import { ChevronDown, ChevronRight, Flag, Lock, Pencil } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '~/components/ui/sheet';
import { cn } from '~/lib/utils';
import { carriedBlocks, ROLES, rolesOf, type Row, sections, type Snapshot, summarize } from './mock';
import { assignRole, correctable, correctionLocked, removeRole, sectionWarnings, setupModel, startMilitia, type VariantProps } from './model';
import { CarriedRead, CorrectionBody, ErrorSummary, Eyebrow, managedLabel, ReadOnlyNote, RoleCards, SavedLocallyNote, SetupStepBody, WarningLine } from './parts';

const hitDice = (p: Row) => (String(p.hitDice).trim() === '' ? `${p.level} (level)` : String(p.hitDice));

export const name = 'Overview and side sheet';

export function VariantC(props: VariantProps) {
  if (props.screen === 'setup') return <Setup {...props} />;
  return (
    <>
      {props.screen === 'characters' ? <Characters {...props} /> : <Militia {...props} />}
      <CorrectionSheet {...props} />
    </>
  );
}

const anchor = (key: string) => document.getElementById(`step-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

function Setup(props: VariantProps) {
  const { state, dispatch } = props;
  const m = setupModel(state);
  const [opened, setOpened] = useState<string[]>([]);
  const patch = (fn: (s: Snapshot) => Snapshot) => dispatch({ kind: 'setup:patch', fn });
  const showAll = state.setup.attempted;
  return (
    <div className="flex flex-1 flex-col">
      <nav className="bg-background/95 sticky top-0 z-10 flex items-center gap-1 overflow-x-auto border-b px-5 py-2 text-sm backdrop-blur">
        {m.steps.map((s) => (
          <button key={s.key} onClick={() => anchor(s.key)} className={cn('rounded-full border px-2.5 py-1 whitespace-nowrap', showAll && s.errors.length ? 'border-destructive text-destructive' : s.optional && s.empty ? 'text-muted-foreground border-dashed' : 'border-foreground/25')}>
            {s.label}
            {showAll && s.errors.length > 0 && ` · ${s.errors.length}`}
          </button>
        ))}
      </nav>
      <div className="mx-auto w-full max-w-4xl flex-1 space-y-8 px-5 py-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl">Set up militia</h1>
            <SavedLocallyNote savedAt={state.setup.savedAt} />
          </div>
          <div className="flex overflow-hidden rounded-md border text-sm" role="radiogroup" aria-label="Starting point">
            {(['new', 'existing'] as const).map((mode) => (
              <button key={mode} role="radio" aria-checked={state.scenario.mode === mode} onClick={() => dispatch({ kind: 'scenario', key: 'mode', value: mode })} className={cn('px-4 py-2', state.scenario.mode === mode && 'bg-primary text-primary-foreground')}>
                {mode === 'new' ? 'New militia' : 'Existing militia'}
              </button>
            ))}
          </div>
        </div>
        {m.steps.slice(0, -1).map((s) => {
          const folded = s.optional && s.empty && !opened.includes(s.key);
          return (
            <section key={s.key} id={`step-${s.key}`} className="scroll-mt-14 space-y-3">
              <button className="flex w-full items-baseline gap-2 border-b pb-1 text-left" onClick={() => s.optional && setOpened(folded ? [...opened, s.key] : opened.filter((k) => k !== s.key))}>
                {s.optional && (folded ? <ChevronRight className="size-4 self-center" /> : <ChevronDown className="size-4 self-center" />)}
                <h2 className="text-xl">{s.label}</h2>
                {s.optional && <span className="text-muted-foreground text-sm">{folded ? 'Optional · nothing added' : 'Optional'}</span>}
              </button>
              {!folded && <SetupStepBody stepKey={s.key} blocks={s.blocks} draft={m.draft} mode={state.scenario.mode} patch={patch} errors={m.errors.filter(() => showAll || s.visited)} warnings={s.warnings} columns={3} />}
            </section>
          );
        })}
        <section id="step-review" className="scroll-mt-14 space-y-3">
          <h2 className="border-b pb-1 text-xl">Review & start</h2>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Setup notes</span>
            <textarea className="border-input bg-background min-h-24 w-full rounded-md border p-2 text-sm" value={m.draft.notes} onChange={(e) => patch((s) => ({ ...s, notes: e.target.value }))} />
          </label>
        </section>
      </div>
      <footer className="bg-background sticky bottom-0 space-y-2 border-t px-5 py-3">
        <ErrorSummary errors={showAll ? m.errors : []} onGo={(p) => anchor(m.steps.find((s) => s.sections.includes(p.section as never))!.key)} />
        {m.warnings.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm text-amber-300">{m.warnings.length} warnings · never block</summary>
            <div className="mt-1 space-y-0.5">
              {m.warnings.map((w) => (
                <WarningLine key={w.text}>{w.text}</WarningLine>
              ))}
            </div>
          </details>
        )}
        <div className="flex items-center justify-end gap-3">
          <span className="text-sm">{m.errors.length ? `${m.errors.length} to fix` : 'Ready to start'}</span>
          <Button size="lg" onClick={() => startMilitia(props)}>
            <Flag /> Start militia week
          </Button>
        </div>
      </footer>
    </div>
  );
}

function Militia({ state, dispatch }: VariantProps) {
  const list = sections.filter((s) => correctable().includes(s.key));
  return (
    <div className="space-y-5 px-5 py-5">
      <div className="flex items-baseline gap-4">
        <h1 className="text-2xl">Militia</h1>
        <span className="text-muted-foreground">
          Rank {state.latest.values.rank} · Training {state.latest.values.training} · {state.latest.values.treasury} gp · Notoriety {state.latest.values.notoriety}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {list.map((s) => {
          const lines = summarize(state.latest, s.key);
          const warnings = sectionWarnings(state.latest, s.key);
          const open = state.correction?.section === s.key;
          return (
            <section key={s.key} aria-label={s.label} className={cn('bg-card flex flex-col border p-3', open ? 'border-primary' : 'border-foreground/20', s.key === 'teams' && 'row-span-2')}>
              <div className="flex items-center justify-between">
                <h2 className="font-medium">{s.label}</h2>
                <Button variant="ghost" size="sm" disabled={correctionLocked(state, s.key)} onClick={() => dispatch({ kind: 'correct:open', section: s.key })}>
                  <Pencil /> Correct
                </Button>
              </div>
              <ul className="flex-1 space-y-0.5 text-sm">
                {lines.length === 0 && <li className="text-muted-foreground">None</li>}
                {lines.slice(0, s.key === 'teams' ? 10 : 4).map((l) => (
                  <li key={l} className="truncate">
                    {l}
                  </li>
                ))}
                {lines.length > 4 && s.key !== 'teams' && <li className="text-muted-foreground">+{lines.length - 4} more</li>}
              </ul>
              {warnings.map((w) => (
                <WarningLine key={w.text} className="mt-2 text-xs">
                  {w.text}
                </WarningLine>
              ))}
            </section>
          );
        })}
      </div>
      <section className="border-foreground/20 space-y-2 border border-dashed p-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg">
            <Lock className="size-4" /> Week {state.latest.week.week} and what it carries
          </h2>
          <ReadOnlyNote />
        </div>
        <details>
          <summary className="cursor-pointer text-sm">
            {carriedBlocks.map((b) => `${(state.latest[b.key] as unknown[]).length} ${b.label.toLowerCase()}`).join(' · ')}
          </summary>
          <div className="mt-3">
            <CarriedRead snapshot={state.latest} />
          </div>
        </details>
      </section>
    </div>
  );
}

export function Characters({ state, dispatch }: VariantProps) {
  const snap = state.latest;
  return (
    <div className="space-y-5 px-5 py-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Characters & officers</h1>
        <Button variant="outline" disabled={correctionLocked(state, 'people')} onClick={() => dispatch({ kind: 'correct:open', section: 'people' })}>
          <Pencil /> Correct officers & roster
        </Button>
      </div>
      <div className="grid grid-cols-6 border">
        {ROLES.map((r) => {
          const holders = snap.people.filter((p) => p.onRoster !== false && rolesOf(p).includes(r));
          return (
            <div key={r} className="border-foreground/10 border-r p-2 last:border-r-0">
              <Eyebrow>{r}</Eyebrow>
              <p className={cn('text-sm', !holders.length && 'text-muted-foreground')}>{holders.map((h) => h.name).join(', ') || 'Vacant'}</p>
            </div>
          );
        })}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground text-left text-xs">
            <th className="pb-1 font-normal">Character</th>
            <th className="pb-1 font-normal">Level · Cha</th>
            <th className="pb-1 font-normal">In militia</th>
            <th className="pb-1 font-normal">Kind</th>
            <th className="pb-1 font-normal">Hit Dice</th>
            <th className="pb-1 font-normal">Roles</th>
            <th className="pb-1 font-normal">Teams</th>
          </tr>
        </thead>
        <tbody>
          {snap.people.map((p) => {
            const on = p.onRoster !== false;
            return (
              <tr key={p.id} className={cn('border-foreground/10 border-t', !on && 'text-muted-foreground')}>
                <td className="py-2">{p.name}</td>
                <td>
                  {p.level} · {p.cha}
                </td>
                <td>{on ? 'Yes' : 'No'}</td>
                <td className="uppercase">{on ? p.kind : ''}</td>
                <td>{on ? hitDice(p) : ''}</td>
                <td className="capitalize">{rolesOf(p).join(', ')}</td>
                <td className="text-muted-foreground text-xs">{managedLabel(snap, p)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function CorrectionSheet({ state, dispatch }: VariantProps) {
  const c = state.correction;
  const people = c?.section === 'people';
  const label = !c ? '' : people ? 'Officers & roster' : sections.find((s) => s.key === c.section)!.label;
  return (
    <Sheet open={!!c} onOpenChange={(o) => !o && dispatch({ kind: 'correct:cancel' })}>
      <SheetContent className="w-[42rem] overflow-y-auto sm:max-w-[42rem]">
        <SheetHeader>
          <SheetTitle>Correct {label.toLowerCase()}</SheetTitle>
        </SheetHeader>
        {c && (
          <div className="space-y-4 px-4 pb-6">
            {people && <RoleCards snapshot={c.draft} editing compact onAssign={(r, id) => dispatch({ kind: 'correct:patch', fn: assignRole(r, id) })} onRemove={(r, id) => dispatch({ kind: 'correct:patch', fn: removeRole(r, id) })} />}
            <CorrectionBody state={state} dispatch={dispatch} columns={2} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
