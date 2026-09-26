'use client';
// PROTOTYPE — Three ways to pick a finished week and read its record,
// switchable via `?variant=A|B|C` on /prototype/finished-weeks (Wayfinder
// #117, map #99). The navigation shell around it is settled (#102). Mock data
// only; nothing persists. Review at tablet landscape (about 1180×820). The
// yellow panel switches the page state (loading, failed, empty, unavailable).

import { useSearchParams } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { PrototypeSwitcher } from '~/components/prototype-switcher';
import { Button } from '~/components/ui/button';
import { Shell } from './frame';
import { effectiveEntry, finishedWeeks, type Scenario } from './mock';
import type { Selection } from './parts';
import * as A from './variant-a';
import * as B from './variant-b';
import * as C from './variant-c';

const variants = [
  { key: 'A', name: A.name, Component: A.VariantA },
  { key: 'B', name: B.name, Component: B.VariantB },
  { key: 'C', name: C.name, Component: C.VariantC },
];

const states: { key: keyof Scenario; label: string }[] = [
  { key: 'loading', label: 'history still loading' },
  { key: 'failed', label: 'history could not be loaded' },
  { key: 'empty', label: 'no finished weeks yet' },
  { key: 'unavailable', label: 'campaign history unavailable' },
];

export function FinishedWeeksPrototype() {
  const params = useSearchParams();
  const variant =
    variants.find((v) => v.key === params.get('variant')) ?? variants[0]!;
  const latest = finishedWeeks[finishedWeeks.length - 1]!;
  const [selection, select] = useState<Selection>({ week: latest.week });
  const [scenario, setScenario] = useState<Scenario>({
    loading: false,
    failed: false,
    empty: false,
    unavailable: false,
  });
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  if (!mounted) return null;

  const record =
    finishedWeeks.find((w) => w.week === selection.week) ?? latest;
  const entry =
    record.entries.find((e) => e.recordId === selection.recordId) ??
    effectiveEntry(record);
  const { Component } = variant;

  const body = scenario.unavailable ? (
    <p role="alert" className="p-6">
      Campaign history is unavailable.
    </p>
  ) : scenario.failed ? (
    <div role="alert" className="bg-card border-foreground/20 space-y-2 border p-4 text-sm">
      <p>History could not be loaded. Check campaign access and try again.</p>
      <Button variant="outline" size="sm">
        Reload history
      </Button>
    </div>
  ) : scenario.loading ? (
    <p role="status" className="text-muted-foreground p-6">
      Loading history…
    </p>
  ) : scenario.empty ? (
    <div className="text-muted-foreground m-auto max-w-md space-y-2 text-center text-sm">
      <p className="text-foreground text-lg">No finished weeks yet.</p>
      <p>
        The first one appears here when week 15 is confirmed. Until then the
        Week tab holds everything in play.
      </p>
    </div>
  ) : (
    <Component
      key={variant.key}
      weeks={finishedWeeks}
      record={record}
      entry={entry}
      select={select}
    />
  );

  return createPortal(
    <>
      <div className="bg-background fixed inset-0 z-40 overflow-y-auto">
        <Shell>{body}</Shell>
      </div>
      <aside className="fixed right-3 bottom-3 z-[100] border-2 border-dashed border-yellow-300 bg-black/90 p-2 font-mono text-sm text-yellow-200">
        <button className="w-full text-left" onClick={() => setOpen(!open)}>
          {open ? '▾' : '▸'} PROTOTYPE STATE
        </button>
        {open && (
          <div className="mt-1 w-72 space-y-1">
            {states.map((s) => (
              <label key={s.key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={scenario[s.key]}
                  onChange={(e) =>
                    setScenario({ ...scenario, [s.key]: e.target.checked })
                  }
                />
                {s.label}
              </label>
            ))}
            <button
              className="block underline"
              onClick={() => select({ week: 12 })}
            >
              go to week 12 (corrected twice)
            </button>
            <button
              className="block underline"
              onClick={() => select({ week: 12, recordId: 'w12-r0' })}
            >
              go to week 12, original entry
            </button>
            <button
              className="block underline"
              onClick={() => select({ week: 10 })}
            >
              go to week 10 (reconstructed)
            </button>
            <pre className="text-[10px] leading-tight">
              {JSON.stringify(
                { selection, showing: entry.recordId },
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
