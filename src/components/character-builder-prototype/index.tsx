'use client';
// PROTOTYPE (throwaway) for wayfinder ticket #208 'Prototype the character
// creation and level-up flow' — three variants of the Pathfinder 1e
// character builder, switchable via ?variant=A|B|C and ?page=..., on
// /prototype/character-builder. Primary target: tablet landscape
// (1180×820); desktop and phone must remain usable.
//
// Contract (details in CONTRACT.md). Every variant handles these pages:
//   ?page=list      The campaign's characters home: militia-only rows edited
//                   in place (name, level, scores), Full Character rows
//                   read-only and linking to the sheet, switching sheetMode,
//                   and — with &campaign=oneshot — where Full Characters
//                   live in a campaign without a militia.
//   ?page=create    A new Character from nothing.
//   ?page=buildout  Turn militia-only Sergeant Hessa (&character=hessa) into
//                   a Full Character by specifying her Unspecified Class Levels.
//   ?page=sheet     Kesh's sheet (&character=kesh) with derived statistics
//                   and their breakdowns.
//   ?page=levelup   Level Kesh from 7 to 8 (&character=kesh).
// Params: &campaign=ironfang|oneshot (default ironfang), &character=<id>
// (defaults per page), plus page-local params a variant may add (&step=…)
// through useProtoNav().set(). Navigation uses router.replace, so every
// state worth reviewing is URL-addressable.

import { useState, type ReactNode } from 'react';
import { PrototypeSwitcher } from '~/components/prototype-switcher';
import { PrototypeFrame, type FrameNavFn } from './frame';
import { HP_POLICIES } from './hp';
import { PAGES, useProtoNav } from './nav';
import { PrototypeStoreProvider, useBuilderStore } from './store';
import type { HpPolicy, VariantProps } from './types';
import * as A from './variant-a';
import * as B from './variant-b';
import * as C from './variant-c';

const variants: {
  key: string;
  name: string;
  Component: (props: VariantProps) => ReactNode;
  frameNav: FrameNavFn | undefined;
}[] = [
  {
    key: 'A',
    name: 'Guided steps',
    Component: A.VariantA,
    frameNav: A.frameNav,
  },
  {
    key: 'B',
    name: 'One living sheet',
    Component: B.VariantB,
    frameNav: B.frameNav,
  },
  {
    key: 'C',
    name: 'Level timeline + live sheet',
    Component: C.VariantC,
    frameNav: C.frameNav,
  },
];

function StatePanel() {
  const [open, setOpen] = useState(false);
  const store = useBuilderStore();
  const nav = useProtoNav();
  return (
    <aside className="fixed right-3 bottom-28 z-[100] border-2 border-dashed border-yellow-300 bg-black/90 p-2 font-mono text-sm text-yellow-200 md:bottom-3">
      <button className="w-full text-left" onClick={() => setOpen(!open)}>
        {open ? '▾' : '▸'} PROTOTYPE STATE
      </button>
      {open && (
        <div className="mt-1 w-72 space-y-1">
          <div className="flex flex-wrap gap-x-2">
            {PAGES.map((p) => (
              <button
                key={p}
                className={
                  p === nav.page ? 'underline' : 'opacity-70 hover:opacity-100'
                }
                onClick={() => nav.go(p)}
              >
                {p}
              </button>
            ))}
            <button
              className="opacity-70 hover:opacity-100"
              onClick={() => nav.go('list', { campaign: 'oneshot' })}
            >
              oneshot list
            </button>
          </div>
          <label className="flex items-center gap-2">
            hp
            <select
              value={store.state.hpPolicy}
              onChange={(e) => store.setHpPolicy(e.target.value as HpPolicy)}
              className="bg-black text-yellow-200"
            >
              {HP_POLICIES.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            point buy
            <select
              value={store.state.pointBuyBudget}
              onChange={(e) => store.setPointBuyBudget(Number(e.target.value))}
              className="bg-black text-yellow-200"
            >
              {[10, 15, 20, 25].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button className="block underline" onClick={store.resetPrototype}>
            reset all characters
          </button>
        </div>
      )}
    </aside>
  );
}

export function CharacterBuilderPrototype() {
  const nav = useProtoNav();
  const variant = variants.find((v) => v.key === nav.variant) ?? variants[0]!;
  const { Component } = variant;
  return (
    <PrototypeStoreProvider
      selectedCampaignId={nav.campaignId}
      selectedCharacterId={nav.characterId}
    >
      <PrototypeFrame nav={variant.frameNav}>
        <Component
          key={variant.key}
          page={nav.page}
          campaignId={nav.campaignId}
          characterId={nav.characterId}
        />
      </PrototypeFrame>
      <StatePanel />
      <div className="fixed bottom-16 left-1/2 z-[100] -translate-x-1/2 md:bottom-2">
        <PrototypeSwitcher variants={variants} />
      </div>
    </PrototypeStoreProvider>
  );
}
