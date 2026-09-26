'use client';
// PROTOTYPE — floating variant switcher for throwaway UI prototypes.
// Rendered inside the prototype's state panel. Cycles `?variant=` with the arrows or ← / → keys. Never shown in production.

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect } from 'react';

export function PrototypeSwitcher({
  variants,
}: {
  variants: { key: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = variants.findIndex((v) => v.key === params.get('variant'));
  const index = current === -1 ? 0 : current;

  const step = useCallback(
    (delta: number) => {
      const next =
        variants[(index + delta + variants.length) % variants.length]!;
      const search = new URLSearchParams(params);
      search.set('variant', next.key);
      router.replace(`${pathname}?${search.toString()}`);
    },
    [index, params, pathname, router, variants],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      )
        return;
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);

  if (process.env.NODE_ENV === 'production') return null;
  const v = variants[index]!;
  return (
    <div className="my-1 flex w-fit items-center gap-2 rounded-full bg-yellow-300 px-2 py-1 font-mono text-lg text-black shadow-lg">
      <button aria-label="Previous variant" onClick={() => step(-1)}>
        <ChevronLeft />
      </button>
      <span className="px-2 whitespace-nowrap">
        {v.key} ({v.name})
      </span>
      <button aria-label="Next variant" onClick={() => step(1)}>
        <ChevronRight />
      </button>
    </div>
  );
}
