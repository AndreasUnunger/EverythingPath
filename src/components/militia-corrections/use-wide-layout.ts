'use client';
import { useSyncExternalStore } from 'react';

// Index and detail side by side from 768px; one scrolling list below. Only
// one layout is mounted, so the open correction has exactly one set of
// controls; its entries live in the form and survive a resize.
const wide = '(min-width: 768px)';
function mediaQuery() {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia(wide)
    : null;
}
function subscribe(listener: () => void) {
  const query = mediaQuery();
  query?.addEventListener('change', listener);
  return () => query?.removeEventListener('change', listener);
}

export function useWideLayout() {
  return useSyncExternalStore(
    subscribe,
    () => mediaQuery()?.matches ?? true,
    () => true,
  );
}
