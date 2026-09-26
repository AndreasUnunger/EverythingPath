'use client';
// PROTOTYPE — Three ways for the shell and week screen to adapt to phone and
// desktop, switchable via `?variant=A|B|C` on /prototype/responsive-shell
// (Wayfinder #120, map #99). Tablet landscape is the reference. Chosen: B. This harness
// shows the screen in a frame at phone, tablet and desktop sizes (or fills the
// window with "Full") so every width can be reviewed without dev tools.

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PrototypeSwitcher } from '~/components/prototype-switcher';
import { cn } from '~/lib/utils';
import { type Phase, phaseLabels, phaseOrder } from './model';
import { variants } from './screen';

const frames = [
  { key: 'phone', label: 'Phone', width: 390, height: 844 },
  { key: 'phone-wide', label: 'Phone landscape', width: 844, height: 390 },
  { key: 'tablet', label: 'Tablet landscape', width: 1180, height: 820 },
  { key: 'desktop', label: 'Desktop', width: 1440, height: 900 },
  { key: 'full', label: 'Full window', width: 0, height: 0 },
];

export function ResponsiveShellPrototype() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const variant = variants.find((v) => v.key === params.get('variant')) ?? variants[0]!;
  const frame = frames.find((f) => f.key === params.get('frame')) ?? frames[0]!;
  const phase = (phaseOrder.includes(params.get('phase') as Phase) ? params.get('phase') : 'activity') as Phase;
  const areaRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const area = areaRef.current;
    if (!area || !frame.width) return;
    const fit = () =>
      setScale(Math.min(1, (area.clientWidth - 16) / frame.width, (area.clientHeight - 16) / frame.height));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(area);
    return () => observer.disconnect();
  }, [frame]);

  const set = (key: string, value: string) => {
    const search = new URLSearchParams(params);
    search.set(key, value);
    router.replace(`${pathname}?${search.toString()}`);
  };
  const src = `${pathname}/screen?variant=${variant.key}&phase=${phase}`;
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-40 flex flex-col bg-neutral-900 text-neutral-100">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-neutral-700 px-3 py-1.5 font-mono text-sm">
        <PrototypeSwitcher variants={variants} />
        <span className="flex gap-1">
          {frames.map((f) => (
            <button
              key={f.key}
              onClick={() => set('frame', f.key)}
              className={cn('rounded px-2 py-1', f.key === frame.key ? 'bg-yellow-300 text-black' : 'bg-neutral-800 hover:bg-neutral-700')}
            >
              {f.label}
              {f.width ? ` ${f.width}×${f.height}` : ''}
            </button>
          ))}
        </span>
        <span className="flex gap-1">
          {phaseOrder.map((p) => (
            <button
              key={p}
              onClick={() => set('phase', p)}
              className={cn('rounded px-2 py-1', p === phase ? 'bg-yellow-300 text-black' : 'bg-neutral-800 hover:bg-neutral-700')}
            >
              {phaseLabels[p]}
            </button>
          ))}
        </span>
        {frame.width > 0 && scale < 1 && <span className="text-neutral-400">shown at {Math.round(scale * 100)}%</span>}
      </div>
      <div ref={areaRef} className="flex min-h-0 flex-1 items-start justify-center overflow-auto p-2">
        {frame.width ? (
          <div style={{ width: frame.width * scale, height: frame.height * scale }} className="shrink-0">
            <iframe
              key={src}
              title={`${variant.name} at ${frame.label}`}
              src={src}
              style={{ width: frame.width, height: frame.height, transform: `scale(${scale})`, transformOrigin: 'top left' }}
              className="border border-neutral-600 bg-black"
            />
          </div>
        ) : (
          <iframe key={src} title={`${variant.name} in the full window`} src={src} className="h-full w-full border border-neutral-600 bg-black" />
        )}
      </div>
    </div>,
    document.body,
  );
}
