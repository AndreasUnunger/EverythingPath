'use client';
// PROTOTYPE — Three ways to combine character records, roster people and
// officer role cards on the Characters & officers page, switchable via
// `?variant=A|B|C` on /prototype/characters-officers (Wayfinder #114, map #99).
// Mock data and an in-memory reducer only. Review at tablet landscape
// (about 1180×820). The yellow panel switches scenarios and simulates
// another player.

import { useSearchParams } from 'next/navigation';
import { useReducer, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { PrototypeSwitcher } from '~/components/prototype-switcher';
import { PageFrame } from './frame';
import { initialState, project, reduce } from './mock';
import * as A from './variant-a';
import * as B from './variant-b';
import * as C from './variant-c';

const variants = [
  { key: 'A', name: A.name, Component: A.VariantA },
  { key: 'B', name: B.name, Component: B.VariantB },
  { key: 'C', name: C.name, Component: C.VariantC },
];

export function CharactersOfficersPrototype() {
  const params = useSearchParams();
  const variant =
    variants.find((v) => v.key === params.get('variant')) ?? variants[0]!;
  const [state, edit] = useReducer(reduce, undefined, initialState);
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
        <PageFrame view={view}>
          <Component key={variant.key} view={view} edit={edit} />
        </PageFrame>
      </div>
      <aside className="fixed right-3 bottom-3 z-[100] border-2 border-dashed border-yellow-300 bg-black/90 p-2 font-mono text-sm text-yellow-200">
        <button className="w-full text-left" onClick={() => setOpen(!open)}>
          {open ? '▾' : '▸'} PROTOTYPE STATE
        </button>
        {open && (
          <div className="mt-1 w-80 space-y-1">
            <label className="flex items-center gap-2">
              kind lives on
              <select
                value={state.scenario.kindHome}
                onChange={(e) =>
                  edit({
                    kind: 'scenario',
                    key: 'kindHome',
                    value: e.target.value as 'record' | 'roster',
                  })
                }
                className="bg-black text-yellow-200"
              >
                <option value="record">the character record</option>
                <option value="roster">the roster person</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={state.scenario.conflict}
                onChange={(e) =>
                  edit({
                    kind: 'scenario',
                    key: 'conflict',
                    value: e.target.checked,
                  })
                }
              />
              another player saves first (conflict on save)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={state.scenario.noPending}
                onChange={(e) =>
                  edit({
                    kind: 'scenario',
                    key: 'noPending',
                    value: e.target.checked,
                  })
                }
              />
              no pending Change Officer Role this week
            </label>
            <button
              className="block underline"
              onClick={() => edit({ kind: 'remote' })}
            >
              another player makes Kess the Spymaster
            </button>
            <button
              className="block underline"
              onClick={() => edit({ kind: 'reset' })}
            >
              reset
            </button>
            <pre className="max-h-40 overflow-auto text-[10px] leading-tight">
              {JSON.stringify(
                {
                  editing: state.edit?.section ?? null,
                  reason: state.edit?.reason,
                  officers: view.roster.officers,
                  people: view.roster.people.map(
                    (p) => `${p.characterId}:${p.kind}:${p.hitDice ?? '-'}`,
                  ),
                },
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
