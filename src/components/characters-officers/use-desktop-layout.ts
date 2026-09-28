'use client';
import { useSyncExternalStore } from 'react';

// The Assign picker floats beside the board from 1280px; below that it is a
// sheet (tablet) or an inline panel (phone). Without `matchMedia` (jsdom)
// the answer is false, so tests see the tablet layout.
const desktop = '(min-width: 1280px)';
function mediaQuery() {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function'
    ? window.matchMedia(desktop)
    : null;
}
function subscribe(listener: () => void) {
  const query = mediaQuery();
  query?.addEventListener('change', listener);
  return () => query?.removeEventListener('change', listener);
}

export function useDesktopLayout() {
  return useSyncExternalStore(
    subscribe,
    () => mediaQuery()?.matches ?? false,
    () => false,
  );
}
