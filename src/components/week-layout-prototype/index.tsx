'use client';
// PROTOTYPE — Four page frames for the week screen, switchable via
// `?variant=A|B|C|D` on /prototype/week-layout (Wayfinder #101, map #99).
// Settles the frame only: phase navigation, militia status, save feedback,
// warnings, and the way to Summary/Confirmation. Phase content is rough on
// purpose. Mock data only. Review at tablet landscape (about 1180×820).
// The yellow panel flips the states the frame must handle.

import { useSearchParams } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { PrototypeSwitcher } from '~/components/prototype-switcher';
import { initialKnobs, phaseOrder, type Feedback, type Knobs, type Phase } from './mock';
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

const feedbacks: Feedback[] = ['idle', 'pending', 'saved', 'failed', 'confirming'];

const toggles: { key: keyof Knobs; label: string }[] = [
  { key: 'persistentEligible', label: 'persistent events carried in' },
  { key: 'allReady', label: 'every phase ready' },
  { key: 'reviewRequired', label: 'stale review (concurrent confirm)' },
  { key: 'remoteEdit', label: 'another player just edited' },
  { key: 'setupNotes', label: 'setup notes recorded' },
];

export function WeekLayoutPrototype() {
  const params = useSearchParams();
  const variant = variants.find((v) => v.key === params.get('variant')) ?? variants[0]!;
  const initialPhase = phaseOrder.find((p) => p === params.get('phase')) ?? 'activity';
  const [phase, setPhaseState] = useState<Phase>(initialPhase);
  const [knobs, setKnobs] = useState<Knobs>(initialKnobs);
  const [open, setOpen] = useState(false);
  const setPhase = (p: Phase) => {
    if (p === 'persistent' && !knobs.persistentEligible) return;
    setPhaseState(p);
  };
  const { Component } = variant;
  // Render above the app shell on <body>, client-only so hydration matches.
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  if (!mounted) return null;

  return createPortal(
    <>
      <div className="bg-background fixed inset-y-0 right-0 left-0 z-40 overflow-y-auto md:left-12">
        <Component key={variant.key} knobs={knobs} phase={phase} setPhase={setPhase} />
      </div>
      <aside className="fixed right-3 bottom-3 z-[100] border-2 border-dashed border-yellow-300 bg-black/90 p-2 font-mono text-sm text-yellow-200">
        <button className="w-full text-left" onClick={() => setOpen(!open)}>
          {open ? '▾' : '▸'} PROTOTYPE STATE
        </button>
        {open && (
          <div className="mt-1 w-64 space-y-1">
            <p>phase view: {phase}</p>
            <label className="flex items-center gap-2">
              save:
              <select
                className="bg-black"
                value={knobs.feedback}
                onChange={(e) => setKnobs({ ...knobs, feedback: e.target.value as Feedback })}
              >
                {feedbacks.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
            {toggles.map((t) => (
              <label key={t.key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={knobs[t.key] as boolean}
                  onChange={(e) => {
                    const next = { ...knobs, [t.key]: e.target.checked };
                    setKnobs(next);
                    if (!next.persistentEligible && phase === 'persistent') setPhaseState('event');
                  }}
                />
                {t.label}
              </label>
            ))}
            <button className="underline" onClick={() => setKnobs(initialKnobs())}>
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
