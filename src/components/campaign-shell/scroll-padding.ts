'use client';
import { useEffect, type RefObject } from 'react';

// Bars pinned to the viewport's bottom edge (the phone bottom bar, the
// Characters save point from 768px) cover the end of a document-scrolled
// page, and the browser counts a control under one as in view, so focus
// never scrolls it clear. Each bar reserves its measured height (as it grows
// and shrinks) as document scroll padding while it is shown; one that is
// display:none measures 0 and reserves nothing. The reservations add up, so
// one bar coming or going never clears another's.
const reserved = new Map<object, number>();

function applyReserved() {
  let total = 0;
  for (const height of reserved.values()) total += height;
  document.documentElement.style.scrollPaddingBottom =
    total > 0 ? `${total + 16}px` : '';
}

export function useScrollPaddingFor(bar: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const cover = bar.current;
    if (!cover || typeof ResizeObserver === 'undefined') return;
    const key = {};
    const observer = new ResizeObserver(() => {
      reserved.set(key, cover.offsetHeight);
      applyReserved();
    });
    observer.observe(cover);
    return () => {
      observer.disconnect();
      reserved.delete(key);
      applyReserved();
    };
  }, [bar]);
}
