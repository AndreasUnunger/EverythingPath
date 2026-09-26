'use client';
// PROTOTYPE — Three ways the campaign list, Setup, Militia, Characters &
// officers and Finished weeks adapt to phone and desktop, switchable via
// `?variant=A|B|C` on /prototype/responsive-pages (Wayfinder #121, map #99).
// Tablet landscape (about 1180×820) is the settled reference and looks the
// same in every variant; only below 768px (phone) and from 1280px (desktop)
// do the variants differ. Resize the browser or use the device toolbar. The
// yellow panel switches the page and the #119 state, and shows the width.
// Mock data and in-memory reducers from the earlier prototypes only.

import { useSearchParams } from 'next/navigation';
import { useReducer, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import {
  initialCampaigns,
  type Campaign,
} from '~/components/campaign-home-prototype/mock';
import {
  initialState as coInitial,
  project,
  reduce as coReduce,
} from '~/components/characters-officers-prototype/mock';
import {
  effectiveEntry,
  finishedWeeks,
} from '~/components/finished-weeks-prototype/mock';
import type { Selection } from '~/components/finished-weeks-prototype/parts';
import { PrototypeSwitcher } from '~/components/prototype-switcher';
import {
  initialState as scInitial,
  reduce as scReduce,
} from '~/components/setup-correction-prototype/mock';
import type { Props } from './content';
import { StatusView, useWidth, type Status } from './primitives';
import { Shell, type Page } from './shell';
import * as A from './variant-a';
import * as B from './variant-b';
import * as C from './variant-c';

const variants = [
  { key: 'A', name: A.name, Component: A.VariantA },
  { key: 'B', name: B.name, Component: B.VariantB },
  { key: 'C', name: C.name, Component: C.VariantC },
];

const pages: Page[] = [
  'campaigns',
  'setup',
  'militia',
  'characters',
  'history',
  'week',
];
const statuses: Status[] = ['ready', 'loading', 'failed', 'empty'];

export function ResponsivePagesPrototype() {
  const params = useSearchParams();
  const variant =
    variants.find((v) => v.key === params.get('variant')) ?? variants[0]!;
  const [page, go] = useState<Page>(
    (params.get('page') as Page) ?? 'campaigns',
  );
  const [status, setStatus] = useState<Status>('ready');
  const [open, setOpen] = useState(false);
  const width = useWidth();

  const [scState, scDispatch] = useReducer(scReduce, undefined, () =>
    scInitial(),
  );
  const [coState, coEdit] = useReducer(coReduce, undefined, coInitial);
  const latest = finishedWeeks[finishedWeeks.length - 1]!;
  const [selection, select] = useState<Selection>({ week: latest.week });
  const [campaigns, setCampaigns] = useState<Campaign[]>(
    () => initialCampaigns()['Thursday Group'],
  );
  const [selectedId, selectCampaign] = useState<string | undefined>('ironfang');

  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  if (!mounted) return null;

  const record = finishedWeeks.find((w) => w.week === selection.week) ?? latest;
  const entry =
    record.entries.find((e) => e.recordId === selection.recordId) ??
    effectiveEntry(record);
  const props: Omit<Props, 'page'> = {
    go,
    sc: { state: scState, dispatch: scDispatch },
    co: { view: project(coState), edit: coEdit },
    fw: { weeks: finishedWeeks, record, entry, select },
    ch: {
      campaigns,
      selectedId,
      select: selectCampaign,
      create: (name, description) => {
        const c: Campaign = {
          id: `new-${Date.now()}`,
          name,
          description,
          createdAt: Date.now(),
          militia: null,
        };
        setCampaigns((prev) => [...prev, c]);
        return c;
      },
      update: (id, patch) =>
        setCampaigns((prev) =>
          prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        ),
    },
  };
  const { Component } = variant;
  const campaign = campaigns.find((c) => c.id === selectedId);
  const skeleton = variant.key === 'B' ? 'three' : 'split';

  const body =
    page === 'week' ? (
      <div className="text-muted-foreground m-auto max-w-md p-8 text-center font-mono text-sm">
        Week screen: its phone and desktop layout is ticket #120.
      </div>
    ) : status !== 'ready' ? (
      <StatusView
        status={status}
        page={page}
        onRetry={() => setStatus('ready')}
        skeleton={width === 'phone' ? 'stack' : skeleton}
      />
    ) : (
      <Component key={variant.key} page={page} {...props} />
    );

  return createPortal(
    <>
      <div className="bg-background fixed inset-x-0 top-0 bottom-12 z-40 overflow-y-auto">
        <Shell
          page={page}
          go={go}
          campaign={campaign?.name ?? 'Ironfang Invasion'}
          setupOnly={page === 'setup' || !campaign?.militia}
          feedback={scState.feedback}
        >
          {body}
        </Shell>
      </div>
      <aside className="fixed right-2 bottom-14 z-[100] max-w-[calc(100vw-1rem)] border-2 border-dashed border-yellow-300 bg-black/90 p-2 font-mono text-xs text-yellow-200 md:right-3 md:bottom-3 md:text-sm">
        <button className="w-full text-left" onClick={() => setOpen(!open)}>
          {open ? '▾' : '▸'} PROTOTYPE · {width}{' '}
          {typeof window !== 'undefined' && `${window.innerWidth}px`}
        </button>
        {open && (
          <div className="mt-1 w-64 space-y-1">
            <div className="flex flex-wrap gap-x-2">
              {pages.map((p) => (
                <button
                  key={p}
                  className={p === page ? 'text-white underline' : 'opacity-70'}
                  onClick={() => go(p)}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-2">
              {statuses.map((s) => (
                <button
                  key={s}
                  className={
                    s === status ? 'text-white underline' : 'opacity-70'
                  }
                  onClick={() => setStatus(s)}
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="opacity-70">
              phone &lt;768 · tablet 768–1279 · desktop ≥1280
            </p>
            <button
              className="block underline"
              onClick={() => coEdit({ kind: 'remote' })}
            >
              another player makes Kess the Spymaster
            </button>
            <button
              className="block underline"
              onClick={() => scDispatch({ kind: 'remote:teams' })}
            >
              Mira corrects Teams
            </button>
            <button
              className="block underline"
              onClick={() => {
                scDispatch({ kind: 'reset' });
                coEdit({ kind: 'reset' });
                setCampaigns(initialCampaigns()['Thursday Group']);
                selectCampaign('ironfang');
                select({ week: latest.week });
                setStatus('ready');
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
