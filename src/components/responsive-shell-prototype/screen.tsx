'use client';
// PROTOTYPE — the week screen inside the shell, at whatever width the window
// (or the harness's iframe) gives it. `?variant=A|B|C` picks the responsive
// strategy, `?phase=` the step. Mock data only; the yellow panel switches the
// situation.

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { type Phase, phaseOrder, useKnobs, useWeekModel } from './model';
import * as A from './variant-a';
import * as B from './variant-b';
import * as C from './variant-c';

export const variants = [
  { key: 'A', name: A.name, Component: A.VariantA },
  { key: 'B', name: B.name, Component: B.VariantB },
  { key: 'C', name: C.name, Component: C.VariantC },
];

export function ResponsiveShellScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const variant = variants.find((v) => v.key === params.get('variant')) ?? variants[0]!;
  const phaseParam = params.get('phase');
  const phase: Phase = phaseOrder.includes(phaseParam as Phase) ? (phaseParam as Phase) : 'activity';
  const [knobs, setKnobs] = useKnobs();
  const [open, setOpen] = useState(false);
  const model = useWeekModel(knobs);
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  if (!mounted) return null;

  const setPhase = (next: Phase) => {
    const search = new URLSearchParams(params);
    search.set('phase', next);
    router.replace(`${pathname}?${search.toString()}`);
  };
  const { Component } = variant;
  const knob = (key: keyof typeof knobs, label: string) => (
    <label key={key} className="flex items-center gap-2">
      <input type="checkbox" checked={knobs[key]} onChange={(e) => setKnobs({ ...knobs, [key]: e.target.checked })} />
      {label}
    </label>
  );

  return createPortal(
    <>
      <div className="bg-background fixed inset-0 z-40 overflow-y-auto">
        <Component key={variant.key} model={model} knobs={knobs} phase={phase} setPhase={setPhase} />
      </div>
      <aside className="fixed top-2 right-2 z-[100] border-2 border-dashed border-yellow-300 bg-black/90 p-1.5 font-mono text-xs text-yellow-200">
        <button className="w-full text-left" onClick={() => setOpen(!open)}>
          {open ? '▾' : '▸'} STATE
        </button>
        {open && (
          <div className="mt-1 w-56 space-y-1">
            {knob('maintenance', 'maintenance pause')}
            {knob('remote', 'another player edited')}
            {knob('confirming', 'confirming the week')}
            {knob('noCarried', 'no carried events (Persistent locked)')}
            <button className="block underline" onClick={() => model.activity.edit({ kind: 'remote' })}>
              another player stages Reduce Danger
            </button>
            <p className="text-[10px] opacity-70">
              {typeof window === 'undefined' ? '' : `${window.innerWidth}×${window.innerHeight}`} · open decisions: {model.openDecisions}
            </p>
          </div>
        )}
      </aside>
    </>,
    document.body,
  );
}
