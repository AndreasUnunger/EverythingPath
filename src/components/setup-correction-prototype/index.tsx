'use client';
// PROTOTYPE — Three layouts for guided Militia Setup, in-place Militia
// Corrections and roster people on Characters & officers, switchable via
// `?variant=A|B|C` on /prototype/setup-correction (Wayfinder #113, map #99).
// The top bar is settled (#102). Mock data and an in-memory reducer only.
// Review at tablet landscape (about 1180×820). The yellow panel switches the
// screen and scenario and simulates another player.

import { useSearchParams } from 'next/navigation';
import { useEffect, useReducer, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { PrototypeSwitcher } from '~/components/prototype-switcher';
import { Shell } from './frame';
import { initialState, reduce, type Screen } from './mock';
import * as A from './variant-a';
import * as B from './variant-b';
import * as C from './variant-c';

const variants = [
  { key: 'A', name: A.name, Component: A.VariantA },
  { key: 'B', name: B.name, Component: B.VariantB },
  { key: 'C', name: C.name, Component: C.VariantC },
];

const screens: Screen[] = ['setup', 'militia', 'characters'];

export function SetupCorrectionPrototype() {
  const params = useSearchParams();
  const variant = variants.find((v) => v.key === params.get('variant')) ?? variants[0]!;
  const [state, dispatch] = useReducer(reduce, undefined, () => initialState());
  const [screen, go] = useState<Screen>((params.get('screen') as Screen) ?? 'setup');
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  // Another player finishing setup redirects to the week (here: Militia).
  useEffect(() => {
    if (!state.scenario.setupDoneElsewhere || screen !== 'setup') return;
    const t = setTimeout(() => go('militia'), 2500);
    return () => clearTimeout(t);
  }, [state.scenario.setupDoneElsewhere, screen]);

  if (!mounted) return null;
  const { Component } = variant;

  return createPortal(
    <>
      <div className="bg-background fixed inset-0 z-40 overflow-y-auto">
        <Shell state={state} screen={screen} onScreen={go}>
          <Component key={variant.key} state={state} dispatch={dispatch} screen={screen} go={go} />
        </Shell>
      </div>
      <aside className="fixed right-3 bottom-3 z-[100] border-2 border-dashed border-yellow-300 bg-black/90 p-2 font-mono text-sm text-yellow-200">
        <button className="w-full text-left" onClick={() => setOpen(!open)}>
          {open ? '▾' : '▸'} PROTOTYPE STATE
        </button>
        {open && (
          <div className="mt-1 w-72 space-y-1">
            <div className="flex gap-2">
              {screens.map((s) => (
                <button key={s} className={s === screen ? 'text-white underline' : 'opacity-70'} onClick={() => go(s)}>
                  {s}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={state.scenario.mode === 'new'} onChange={(e) => dispatch({ kind: 'scenario', key: 'mode', value: e.target.checked ? 'new' : 'existing' })} />
              new militia (resets)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={state.scenario.stagedSlot} onChange={(e) => dispatch({ kind: 'scenario', key: 'stagedSlot', value: e.target.checked })} />
              open week uses Scouts, Teilwood, Grom
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={state.scenario.setupDoneElsewhere} onChange={(e) => dispatch({ kind: 'scenario', key: 'setupDoneElsewhere', value: e.target.checked })} />
              another player finishes setup
            </label>
            <button className="block underline" onClick={() => dispatch({ kind: 'remote:teams' })}>
              Mira corrects Teams
            </button>
            <button className="block underline" onClick={() => dispatch({ kind: 'remote:values' })}>
              Mira corrects Values
            </button>
            <button className="block underline" onClick={() => dispatch({ kind: 'reset' })}>
              reset
            </button>
            <pre className="max-h-32 overflow-auto text-[10px] leading-tight">
              {JSON.stringify({ revision: state.revision, correction: state.correction && { section: state.correction.section, reason: state.correction.reason, conflict: state.correction.conflict }, saved: state.savedCorrections, setupStep: state.setup.step }, null, 1)}
            </pre>
          </div>
        )}
      </aside>
      <div className="fixed bottom-2 left-1/2 z-[100] -translate-x-1/2">
        <PrototypeSwitcher variants={variants} />
      </div>
    </>,
    document.body,
  );
}
