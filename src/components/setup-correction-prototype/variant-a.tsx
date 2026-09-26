'use client';
// PROTOTYPE — Variant A: the week screen's language everywhere. Setup is the
// horizontal stepper with a previous/next footer; the Militia page is one
// column of section cards whose Correct button opens the editor in place;
// Characters & officers puts the six role cards above the roster.

import { ArrowLeft, ArrowRight, Check, Flag, Lock, Pencil } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { rolesOf, sections, type Row, type SectionKey, type Snapshot } from './mock';
import { assignRole, correctable, correctionLocked, removeRole, sectionWarnings, setupModel, startMilitia, stepForProblem, type VariantProps } from './model';
import { BlockRead, CarriedRead, CorrectionBody, ErrorSummary, Eyebrow, managedLabel, ReadOnlyNote, RoleCards, SavedLocallyNote, SectionWarnings, SetupStepBody, WarningLine } from './parts';

const hitDice = (p: Row) => (String(p.hitDice).trim() === '' ? `${p.level} (level)` : String(p.hitDice));

export const name = 'Stepper and inline sections';

export function VariantA(props: VariantProps) {
  if (props.screen === 'setup') return <Setup {...props} />;
  if (props.screen === 'characters') return <Characters {...props} />;
  return <Militia {...props} />;
}

function Setup(props: VariantProps) {
  const { state, dispatch } = props;
  const m = setupModel(state);
  const go = (step: number) => dispatch({ kind: 'setup:step', step });
  const patch = (fn: (s: Snapshot) => Snapshot) => dispatch({ kind: 'setup:patch', fn });
  const last = m.current.key === 'review';
  return (
    <div className="flex flex-1 flex-col">
      <nav aria-label="Setup steps" className="px-5 pt-3">
        <ol className="flex items-stretch">
          {m.steps.map((s, i) => {
            const active = i === m.current.index;
            return (
              <li key={s.key} className="flex min-w-0 flex-1 items-center">
                <button onClick={() => go(i)} className={cn('flex min-h-12 min-w-0 flex-1 items-center gap-1.5 border px-2 text-left', active ? 'bg-primary text-primary-foreground border-primary' : 'border-foreground/25', s.optional && s.empty && !active && 'border-dashed')}>
                  <span className="flex size-5 shrink-0 items-center justify-center border border-current/40 font-mono text-xs">
                    {s.key === 'review' ? <Flag className="size-3" /> : s.errors.length && (s.visited || state.setup.attempted) ? s.errors.length : s.visited ? <Check className="size-3" /> : i + 1}
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate text-xs">{s.label}</span>
                    {s.caption && <span className={cn('block truncate text-[11px]', active ? 'opacity-80' : s.errors.length && (s.visited || state.setup.attempted) ? 'text-destructive' : 'text-muted-foreground')}>{s.caption}</span>}
                  </span>
                </button>
                {i < m.steps.length - 1 && <span className="bg-foreground/30 h-px w-1.5 shrink-0" />}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-5 py-5">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl">
            {m.current.index + 1}. {m.current.label}
          </h1>
          {m.current.optional && (
            <span className="text-muted-foreground text-sm">Optional for a new militia. Leave it empty to skip.</span>
          )}
        </div>
        {m.current.key === 'starting' && (
          <div className="flex gap-2" role="radiogroup" aria-label="Starting point">
            {(['new', 'existing'] as const).map((mode) => (
              <button key={mode} role="radio" aria-checked={state.scenario.mode === mode} onClick={() => dispatch({ kind: 'scenario', key: 'mode', value: mode })} className={cn('flex-1 border p-3 text-left', state.scenario.mode === mode ? 'border-primary bg-primary/10' : 'border-foreground/20')}>
                <span className="block font-medium">{mode === 'new' ? 'New militia' : 'Existing militia'}</span>
                <span className="text-muted-foreground text-sm">{mode === 'new' ? 'Starting from rank 1 this week.' : 'Already running at the table; enter where it stands.'}</span>
              </button>
            ))}
          </div>
        )}
        {last ? (
          <Review {...props} />
        ) : (
          <SetupStepBody stepKey={m.current.key} blocks={m.current.blocks} draft={m.draft} mode={state.scenario.mode} patch={patch} errors={m.showErrors ? m.errors : []} warnings={m.current.warnings} />
        )}
      </div>

      <footer className="bg-background sticky bottom-0 flex items-center gap-3 border-t px-5 py-3">
        <Button variant="outline" disabled={m.current.index === 0} onClick={() => go(m.current.index - 1)}>
          <ArrowLeft /> Previous
        </Button>
        <SavedLocallyNote savedAt={state.setup.savedAt} />
        <span className="ml-auto text-sm">
          {m.errors.length ? <span className="text-destructive">{m.errors.length} to fix before starting</span> : 'Ready to start'}
          {m.warnings.length > 0 && <span className="text-muted-foreground"> · {m.warnings.length} warnings</span>}
        </span>
        {last ? (
          <Button onClick={() => startMilitia(props)}>
            <Flag /> Start militia week
          </Button>
        ) : (
          <Button onClick={() => go(m.current.index + 1)}>
            {m.current.optional && m.current.empty ? 'Skip' : 'Next'} <ArrowRight />
          </Button>
        )}
      </footer>
    </div>
  );
}

function Review({ state, dispatch }: VariantProps) {
  const m = setupModel(state);
  return (
    <div className="space-y-5">
      {state.setup.attempted ? <ErrorSummary errors={m.errors} onGo={(p) => dispatch({ kind: 'setup:step', step: stepForProblem(p) })} /> : m.errors.length > 0 && <p className="text-sm">{m.errors.length} things still to fix. Start militia week lists them.</p>}
      <div className="space-y-1">
        <Eyebrow>Warnings</Eyebrow>
        {m.warnings.length === 0 && <p className="text-muted-foreground text-sm">None.</p>}
        {m.warnings.map((w) => (
          <WarningLine key={w.text}>
            {w.text}{' '}
            <button className="text-muted-foreground underline underline-offset-2" onClick={() => dispatch({ kind: 'setup:step', step: stepForProblem({ ...w, block: '', rowId: '', field: '' }) })}>
              Go to {m.steps[stepForProblem({ ...w, block: '', rowId: '', field: '' })]?.label}
            </button>
          </WarningLine>
        ))}
        <p className="text-muted-foreground text-xs">Warnings never block. If a value is intentional, keep it and explain it in the setup notes.</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {m.steps.slice(0, -1).map((s) => (
          <button key={s.key} onClick={() => dispatch({ kind: 'setup:step', step: s.index })} className="border-foreground/20 hover:border-foreground/50 border p-3 text-left">
            <span className="flex justify-between text-sm font-medium">
              {s.label}
              <span className={cn('text-xs font-normal', s.errors.length ? 'text-destructive' : 'text-muted-foreground')}>{s.errors.length ? `${s.errors.length} to fix` : s.optional && s.empty ? 'Skipped' : ''}</span>
            </span>
          </button>
        ))}
      </div>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Setup notes</span>
        <textarea className="border-input bg-background min-h-24 w-full rounded-md border p-2 text-sm" value={m.draft.notes} onChange={(e) => dispatch({ kind: 'setup:patch', fn: (s) => ({ ...s, notes: e.target.value }) })} placeholder="Anything the table should know about where these numbers came from" />
      </label>
    </div>
  );
}

function Militia({ state, dispatch }: VariantProps) {
  const list = sections.filter((s) => correctable().includes(s.key));
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-5 py-5">
      <h1 className="text-2xl">Militia</h1>
      <section aria-label="Carried into this week" className="border-foreground/20 space-y-2 border border-dashed p-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg">
            <Lock className="size-4" /> Carried into week {state.latest.week.week}
          </h2>
          <ReadOnlyNote />
        </div>
        <CarriedRead snapshot={state.latest} />
      </section>
      {list.map((s) => (
        <SectionCard key={s.key} sectionKey={s.key} state={state} dispatch={dispatch} />
      ))}
    </div>
  );
}

function SectionCard({ sectionKey, state, dispatch }: { sectionKey: SectionKey } & Pick<VariantProps, 'state' | 'dispatch'>) {
  const s = sections.find((x) => x.key === sectionKey)!;
  const editing = state.correction?.section === sectionKey;
  const locked = correctionLocked(state, sectionKey);
  return (
    <section aria-label={s.label} className={cn('bg-card space-y-3 border p-4', editing ? 'border-primary' : 'border-foreground/20')}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg">{s.label}</h2>
        {!editing && (
          <Button variant="outline" size="sm" disabled={locked} title={locked ? 'Finish the open correction first' : undefined} onClick={() => dispatch({ kind: 'correct:open', section: sectionKey })}>
            <Pencil /> Correct
          </Button>
        )}
      </div>
      {editing ? (
        <CorrectionBody state={state} dispatch={dispatch} autoFocusReason={false} />
      ) : (
        <>
          {s.blocks.map((b) => (
            <div key={b.key} className="space-y-1">
              {s.blocks.length > 1 && <Eyebrow>{b.label}</Eyebrow>}
              <BlockRead block={b} snapshot={state.latest} />
            </div>
          ))}
          <SectionWarnings warnings={sectionWarnings(state.latest, sectionKey)} />
        </>
      )}
    </section>
  );
}

function Characters({ state, dispatch }: VariantProps) {
  const editing = state.correction?.section === 'people';
  const snap = editing ? state.correction!.draft : state.latest;
  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-5 py-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Characters & officers</h1>
        {!editing && (
          <Button variant="outline" disabled={correctionLocked(state, 'people')} onClick={() => dispatch({ kind: 'correct:open', section: 'people' })}>
            <Pencil /> Correct officers & roster
          </Button>
        )}
      </div>
      <RoleCards snapshot={snap} editing={editing} onAssign={(r, id) => dispatch({ kind: 'correct:patch', fn: assignRole(r, id) })} onRemove={(r, id) => dispatch({ kind: 'correct:patch', fn: removeRole(r, id) })} />
      <section className="space-y-2">
        <h2 className="text-lg">Militia roster</h2>
        {editing ? (
          <div className="border-primary bg-card border p-4">
            <CorrectionBody state={state} dispatch={dispatch} />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-left text-xs">
                <th className="pb-1 font-normal">Character</th>
                <th className="pb-1 font-normal">Kind</th>
                <th className="pb-1 font-normal">Hit Dice</th>
                <th className="pb-1 font-normal">Officer roles</th>
                <th className="pb-1 font-normal">Teams</th>
              </tr>
            </thead>
            <tbody>
              {snap.people.map((p) => (
                <tr key={p.id} className={cn('border-foreground/10 border-t', p.onRoster === false && 'text-muted-foreground')}>
                  <td className="py-2">
                    {p.name} <span className="text-muted-foreground text-xs">L{p.level}</span>
                  </td>
                  <td className="uppercase">{p.onRoster === false ? '—' : p.kind}</td>
                  <td>{p.onRoster === false ? '—' : hitDice(p)}</td>
                  <td>
                    {p.onRoster === false ? (
                      'Not in the militia'
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {rolesOf(p).map((r) => (
                          <span key={r} className="rounded-full border px-2 text-xs capitalize">
                            {r}
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="text-muted-foreground text-xs">{managedLabel(snap, p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
