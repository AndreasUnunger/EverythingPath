'use client';
// PROTOTYPE — Four navigation structures for the live militia flow, switchable
// via `?variant=A|B|C|D|E` on /prototype/navigation (Wayfinder #102, map #99).
// Mock data only; nothing reads or writes Convex. Review at tablet landscape
// (about 1180×820). The yellow panel shows the proposed address and which
// capability-inventory ids the current screen hosts.

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { PrototypeSwitcher } from '~/components/prototype-switcher';
import { initialPlace, type Place } from './mock';
import * as A from './variant-a';
import * as B from './variant-b';
import * as C from './variant-c';
import * as D from './variant-d';
import * as E from './variant-e';

const variants = [
  { key: 'A', ...A, Component: A.VariantA },
  { key: 'B', ...B, Component: B.VariantB },
  { key: 'C', ...C, Component: C.VariantC },
  { key: 'D', ...D, Component: D.VariantD },
  { key: 'E', ...E, Component: E.VariantE },
];

export function NavigationPrototype() {
  const params = useSearchParams();
  const variant =
    variants.find((v) => v.key === params.get('variant')) ?? variants[0]!;
  const start = (): Place => ({
    ...initialPlace(),
    section: 'landing' in variant ? variant.landing : 'week',
  });
  const [place, setPlace] = useState<Place>(start);
  const [open, setOpen] = useState(true);
  const go = (patch: Partial<Place>) => setPlace((p) => ({ ...p, ...patch }));
  const { Component } = variant;

  return (
    <div className="bg-background fixed inset-0 z-50 overflow-auto">
      <Component key={variant.key} place={place} go={go} />
      <aside className="fixed right-3 bottom-3 z-[100] max-w-sm border-2 border-dashed border-yellow-300 bg-black/90 p-2 font-mono text-sm text-yellow-200">
        <button className="w-full text-left" onClick={() => setOpen(!open)}>
          {open ? '▾' : '▸'} PROTOTYPE STATE
        </button>
        <PrototypeSwitcher variants={variants} />
        {open && (
          <>
            <p>address: {variant.address(place)}</p>
            <p>covers: {variant.coverage(place).join(' · ')}</p>
            <button
              className="mt-1 underline"
              onClick={() => setPlace(start())}
            >
              reset to start
            </button>
          </>
        )}
      </aside>
    </div>
  );
}
