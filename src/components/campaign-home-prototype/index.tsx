'use client';
// PROTOTYPE — Three layouts for the campaign list, campaign creation and a
// campaign home, switchable via `?variant=A|B|C` on /prototype/campaign-home
// (Wayfinder #118, map #99). The top bar is settled (#102). Mock data and
// in-memory state only. Review at tablet landscape (about 1180×820). The
// yellow panel shows the simulated address and switches the scenario.

import { useSearchParams } from 'next/navigation';
import { useCallback, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { PrototypeSwitcher } from '~/components/prototype-switcher';
import { Destination, ListStates, Shell } from './frame';
import {
  address,
  initialCampaigns,
  organizations,
  type Campaign,
  type Organization,
  type Place,
  type Scenario,
} from './mock';
import * as A from './variant-a';
import * as B from './variant-b';
import * as C from './variant-c';

const variants = [
  { key: 'A', name: A.name, Component: A.VariantA, shell: A.shell },
  { key: 'B', name: B.name, Component: B.VariantB, shell: B.shell },
  { key: 'C', name: C.name, Component: C.VariantC, shell: C.shell },
];

function initialScenario(params: URLSearchParams): Scenario {
  const org = params.get('org');
  return {
    org: org === 'empty' ? 'Sunday Pathfinders' : 'Thursday Group',
    orgState:
      org === 'none' || org === 'denied' || org === 'error' ? org : 'ready',
    loading: params.get('loading') === '1',
    signedOut: params.get('signedout') === '1',
    createReturnsId: params.get('returnsId') !== '0',
  };
}

export function CampaignHomePrototype() {
  const params = useSearchParams();
  const variant =
    variants.find((v) => v.key === params.get('variant')) ?? variants[0]!;
  const [byOrg, setByOrg] = useState(initialCampaigns);
  const [scenario, setScenario] = useState(() => initialScenario(params));
  const [single, setSingle] = useState(params.get('single') === '1');
  const [place, setPlace] = useState<Place>({ page: 'list' });
  const [highlight, setHighlight] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  const all = byOrg[scenario.org];
  const campaigns = single ? all.slice(0, 1) : all;

  const go = useCallback((next: Place) => {
    setHighlight(null);
    setPlace(next);
  }, []);

  function create(name: string, description: string): Campaign {
    const c: Campaign = {
      id: `new-${Date.now()}`,
      name,
      description,
      createdAt: Date.now(),
      militia: null,
    };
    setByOrg((prev) => ({
      ...prev,
      [scenario.org]: [...prev[scenario.org], c],
    }));
    if (single) setSingle(false);
    return c;
  }

  function update(
    id: string,
    patch: { description?: string; inGameDate?: string },
  ) {
    setByOrg((prev) => ({
      ...prev,
      [scenario.org]: prev[scenario.org].map((c) =>
        c.id === id ? { ...c, ...patch } : c,
      ),
    }));
  }

  function setOrg(org: Organization) {
    setScenario((s) => ({ ...s, org, orgState: 'ready' }));
    setPlace({ page: 'list' });
  }

  if (!mounted) return null;
  const { Component, shell } = variant;
  const onListOrHome = place.page === 'list' || place.page === 'home';
  const states =
    place.page === 'list' ? (
      <ListStates scenario={scenario} setOrg={setOrg} />
    ) : null;
  const blocked =
    place.page === 'list' &&
    (scenario.loading || scenario.signedOut || scenario.orgState !== 'ready');

  return createPortal(
    <>
      <div className="bg-background fixed inset-0 z-40 flex flex-col overflow-y-auto">
        <Shell
          key={variant.key}
          place={place}
          campaigns={campaigns}
          scenario={scenario}
          go={go}
          setOrg={setOrg}
          {...shell}
        >
          {blocked ? (
            <div className="mx-auto w-full max-w-5xl p-6">{states}</div>
          ) : onListOrHome ? (
            <Component
              key={variant.key}
              campaigns={campaigns}
              scenario={scenario}
              place={place}
              go={go}
              create={create}
              update={update}
              highlight={highlight}
              setHighlight={setHighlight}
            />
          ) : (
            <Destination
              place={place}
              campaign={campaigns.find((c) => c.id === place.id)}
            />
          )}
        </Shell>
      </div>
      <aside className="fixed right-3 bottom-3 z-[100] border-2 border-dashed border-yellow-300 bg-black/90 p-2 font-mono text-sm text-yellow-200">
        <button className="w-full text-left" onClick={() => setOpen(!open)}>
          {open ? '▾' : '▸'} PROTOTYPE STATE
        </button>
        {open && (
          <div className="mt-1 w-72 space-y-1">
            <p className="text-white">{address(place)}</p>
            <label className="flex items-center gap-2">
              org
              <select
                className="bg-black"
                value={
                  scenario.orgState === 'ready'
                    ? scenario.org
                    : scenario.orgState
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if ((organizations as readonly string[]).includes(v))
                    setOrg(v as Organization);
                  else {
                    setScenario((s) => ({
                      ...s,
                      orgState: v as Scenario['orgState'],
                    }));
                    setPlace({ page: 'list' });
                  }
                }}
              >
                <option value="Thursday Group">Thursday Group (3)</option>
                <option value="Sunday Pathfinders">
                  Sunday Pathfinders (empty)
                </option>
                <option value="none">no org selected</option>
                <option value="denied">no access</option>
                <option value="error">load error</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={single}
                onChange={(e) => setSingle(e.target.checked)}
              />
              only one campaign
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={scenario.loading}
                onChange={(e) =>
                  setScenario((s) => ({ ...s, loading: e.target.checked }))
                }
              />
              loading
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={scenario.signedOut}
                onChange={(e) =>
                  setScenario((s) => ({ ...s, signedOut: e.target.checked }))
                }
              />
              signed out
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={scenario.createReturnsId}
                onChange={(e) =>
                  setScenario((s) => ({
                    ...s,
                    createReturnsId: e.target.checked,
                  }))
                }
              />
              createCampaign returns id (payload change)
            </label>
            <button
              className="block underline"
              onClick={() => go({ page: 'home', id: campaigns[0]?.id ?? '' })}
            >
              open /campaigns/&lt;id&gt; directly
            </button>
            <button
              className="block underline"
              onClick={() => {
                setByOrg(initialCampaigns());
                setScenario(initialScenario(new URLSearchParams()));
                setSingle(false);
                setPlace({ page: 'list' });
              }}
            >
              reset
            </button>
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
