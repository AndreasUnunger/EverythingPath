'use client';
// PROTOTYPE — Four ways to lay out the Activity main column, switchable via
// `?variant=A|B|C|D` on /prototype/activity-slots (Wayfinder #106, map #99).
// The frame around it is settled (#101 variant A in the #102 shell). Mock data
// and an in-memory reducer only. Review at tablet landscape (about 1180×820),
// ideally on a real touch tablet. The yellow panel simulates other players.

import { useSearchParams } from 'next/navigation';
import { useReducer, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { PrototypeSwitcher } from '~/components/prototype-switcher';
import { WeekFrame } from './frame';
import { initialState, reduce } from './mock';
import * as A from './variant-a';
import * as B from './variant-b';
import * as C from './variant-c';
import * as D from './variant-d';

const variants = [
  { key: 'A', name: A.name, Component: A.VariantA },
  { key: 'B', name: B.name, Component: B.VariantB },
  { key: 'C', name: C.name, Component: C.VariantC },
  { key: 'D', name: D.name, Component: D.VariantD },
];

export function ActivitySlotsPrototype() {
  const params = useSearchParams();
  const variant = variants.find((v) => v.key === params.get('variant')) ?? variants[0]!;
  const [state, edit] = useReducer(reduce, undefined, initialState);
  const [confirming, setConfirming] = useState(false);
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  if (!mounted) return null;
  const { Component } = variant;

  return createPortal(
    <>
      <div className="bg-background fixed inset-0 z-40 overflow-y-auto">
        <WeekFrame state={state} confirming={confirming}>
          <Component key={variant.key} state={state} edit={edit} disabled={confirming} />
        </WeekFrame>
      </div>
      <aside className="fixed right-3 bottom-3 z-[100] border-2 border-dashed border-yellow-300 bg-black/90 p-2 font-mono text-sm text-yellow-200">
        <button className="w-full text-left" onClick={() => setOpen(!open)}>
          {open ? '▾' : '▸'} PROTOTYPE STATE
        </button>
        {open && (
          <div className="mt-1 w-64 space-y-1">
            <button className="block underline" onClick={() => edit({ kind: 'remote' })}>
              another player stages Reduce Danger
            </button>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={confirming} onChange={(e) => setConfirming(e.target.checked)} />
              confirming the week
            </label>
            <button className="block underline" onClick={() => edit({ kind: 'reset' })}>
              reset
            </button>
            <pre className="max-h-48 overflow-auto text-[10px] leading-tight">
              {state.slots
                .map((s, i) => `${i + 1}: ${s.choice ? `${s.choice.actionId}${s.choice.teamId ? ' / ' + s.choice.teamId : ''}${s.choice.roll !== undefined ? ' d20=' + s.choice.roll : ''}` : '—'}`)
                .join('\n')}
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
