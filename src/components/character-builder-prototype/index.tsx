'use client';
// PROTOTYPE (throwaway) for wayfinder ticket #208 'Prototype the character
// creation and level-up flow', round 2: variant B ("One living sheet")
// inside the approved app shell (variant C of #213), on
// /prototype/character-builder. Primary target: tablet landscape
// (1180×820); desktop and phone must remain usable. Details in CONTRACT.md.
//
// URL: ?variant=B&page=<page>&campaign=<id>&character=<id>&from=<page>
//   campaigns            the homepage: pick a campaign            (shell placeholder)
//   characters           my Characters, "No campaign" first, then per campaign
//   campaign-home        a campaign's home                        (shell placeholder)
//   campaign-characters  a campaign's Characters (with or without a militia)
//   week, history, militia, setup                                  (shell placeholders)
//   officers             Characters & officers: Militia-only rows edited in
//                        place, Full rows read-only, status + Build out
//   sheet, levelup, create, buildout   Character pages (Back to `from`)
// Page-local params (`level`, `as`, …) go through useProtoNav().set().

import { useState, type ReactNode } from 'react';
import { PrototypeSwitcher } from '~/components/prototype-switcher';
import { useProtoNav } from './nav';
import { AppShell } from './shell/shell';
import {
  CampaignHomePage,
  CampaignsPage,
  HistoryPage,
  MilitiaPage,
  SetupPage,
  WeekPage,
} from './shell/placeholders';
import { PrototypeStoreProvider, useBuilderStore } from './store';
import type { ProtoPage } from './types';
import * as B from './variant-b';

const variants: {
  key: string;
  name: string;
  Component: (props: { page: ProtoPage }) => ReactNode;
}[] = [{ key: 'B', name: B.name, Component: B.VariantB }];

/** Pages outside the builder: the shell's own placeholder bodies. */
const PLACEHOLDERS: Partial<Record<ProtoPage, () => ReactNode>> = {
  campaigns: CampaignsPage,
  'campaign-home': CampaignHomePage,
  week: WeekPage,
  history: HistoryPage,
  militia: MilitiaPage,
  setup: SetupPage,
};

/** Shortcuts to the states worth reviewing. */
const SHORTCUTS: {
  label: string;
  page: ProtoPage;
  campaign?: string;
  character?: string;
  from?: ProtoPage;
}[] = [
  { label: 'campaigns', page: 'campaigns' },
  { label: 'my characters', page: 'characters' },
  {
    label: 'ironfang chars',
    page: 'campaign-characters',
    campaign: 'ironfang',
  },
  { label: 'oneshot chars', page: 'campaign-characters', campaign: 'oneshot' },
  { label: 'officers', page: 'officers', campaign: 'ironfang' },
  { label: 'kesh sheet', page: 'sheet', character: 'kesh', from: 'officers' },
  {
    label: 'kesh levelup',
    page: 'levelup',
    character: 'kesh',
    from: 'officers',
  },
  {
    label: 'hessa sheet (militia-only)',
    page: 'sheet',
    character: 'hessa',
    from: 'officers',
  },
  {
    label: 'hessa buildout',
    page: 'buildout',
    character: 'hessa',
    from: 'officers',
  },
  {
    label: 'brannoc (no militia)',
    page: 'sheet',
    character: 'brannoc',
    from: 'campaign-characters',
  },
  {
    label: 'ilsa (no campaign)',
    page: 'sheet',
    character: 'ilsa',
    from: 'characters',
  },
  {
    label: 'tobin (no campaign, minimal)',
    page: 'sheet',
    character: 'tobin',
    from: 'characters',
  },
  { label: 'create (no campaign)', page: 'create', from: 'characters' },
  {
    label: 'create (oneshot)',
    page: 'create',
    campaign: 'oneshot',
    from: 'campaign-characters',
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
          <p className="opacity-70">
            page={nav.page}
            {nav.campaignId && ` campaign=${nav.campaignId}`}
            {nav.characterId && ` character=${nav.characterId}`}
            {nav.from && ` from=${nav.from}`}
          </p>
          <div className="flex flex-wrap gap-x-2">
            {SHORTCUTS.map((s) => (
              <button
                key={s.label}
                className="opacity-70 hover:opacity-100"
                onClick={() =>
                  nav.go(s.page, {
                    campaign: s.campaign ?? null,
                    character: s.character ?? null,
                    from: s.from ?? null,
                  })
                }
              >
                {s.label}
              </button>
            ))}
          </div>
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

function Page() {
  const nav = useProtoNav();
  const variant = variants.find((v) => v.key === nav.variant) ?? variants[0]!;
  const Placeholder = PLACEHOLDERS[nav.page];
  const { Component } = variant;
  return (
    <AppShell>
      {Placeholder ? (
        <Placeholder />
      ) : (
        <Component key={variant.key} page={nav.page} />
      )}
    </AppShell>
  );
}

export function CharacterBuilderPrototype() {
  return (
    <PrototypeStoreProvider>
      <Page />
      <StatePanel />
      <div className="fixed bottom-16 left-1/2 z-[100] -translate-x-1/2 md:bottom-2">
        <PrototypeSwitcher variants={variants} />
      </div>
    </PrototypeStoreProvider>
  );
}
