'use client';
// PROTOTYPE — Four ways to lay out the Persistent main column, switchable via
// `?variant=A|B|C|D` on /prototype/persistent (Wayfinder #109, map #99). The
// frame around it is settled (#101 variant A in the #102 shell). Mock data and
// an in-memory reducer only. Review at tablet landscape (about 1180×820). The
// yellow panel switches the week's situation and simulates another player.

import { useSearchParams } from 'next/navigation';
import { useReducer, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { PrototypeSwitcher } from '~/components/prototype-switcher';
import { WeekFrame } from './frame';
import { initialState, project, reduce, type State } from './mock';
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

const scenarios: { key: keyof State['scenario']; label: string }[] = [
  { key: 'cooldown', label: 'last buyoff was week 12 (wait until 16)' },
  { key: 'lowTreasury', label: 'treasury 120 gp (one buyoff affordable)' },
  { key: 'endedInActivity', label: 'Reduce Danger in Activity ends Theft 2' },
  { key: 'earlierPhasesOpen', label: 'Upkeep and Event still open' },
];

export function PersistentPrototype() {
  const params = useSearchParams();
  const variant =
    variants.find((v) => v.key === params.get('variant')) ?? variants[0]!;
  const [state, edit] = useReducer(reduce, undefined, initialState);
  const [confirming, setConfirming] = useState(false);
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  if (!mounted) return null;
  const view = project(state);
  const { Component } = variant;

  return createPortal(
    <>
      <div className="bg-background fixed inset-0 z-40 overflow-y-auto">
        <WeekFrame state={state} view={view} confirming={confirming}>
          <Component
            key={variant.key}
            state={state}
            view={view}
            edit={edit}
            disabled={confirming}
          />
        </WeekFrame>
      </div>
      <aside className="fixed right-3 bottom-3 z-[100] border-2 border-dashed border-yellow-300 bg-black/90 p-2 font-mono text-sm text-yellow-200">
        <button className="w-full text-left" onClick={() => setOpen(!open)}>
          {open ? '▾' : '▸'} PROTOTYPE STATE
        </button>
        {open && (
          <div className="mt-1 w-80 space-y-1">
            {scenarios.map((s) => (
              <label key={s.key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={state.scenario[s.key]}
                  onChange={(e) =>
                    edit({ kind: 'scenario', key: s.key, on: e.target.checked })
                  }
                />
                {s.label}
              </label>
            ))}
            <button
              className="block underline"
              onClick={() => edit({ kind: 'remote' })}
            >
              another player enters the Rivalry die
            </button>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={confirming}
                onChange={(e) => setConfirming(e.target.checked)}
              />
              confirming the week
            </label>
            <button
              className="block underline"
              onClick={() => edit({ kind: 'reset' })}
            >
              reset
            </button>
            <pre className="max-h-40 overflow-auto text-[10px] leading-tight">
              {JSON.stringify(
                { decisions: state.decisions, exceptions: state.exceptions },
                null,
                1,
              )}
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
