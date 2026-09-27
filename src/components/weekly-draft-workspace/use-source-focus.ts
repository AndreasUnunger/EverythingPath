'use client';
import { useEffect, useRef } from 'react';
import type { Phase, PersistentSourceLink } from './types';

// Follows a Persistent "Change it in Activity/Event" link: shows that phase
// in this player's Phase View, then brings the source slot or occurrence
// into view and focus once it has rendered. Other players are unaffected.
export function useSourceFocus(
  shown: Phase | null,
  choose: (phase: Phase) => void,
) {
  const pending = useRef<PersistentSourceLink | null>(null);
  useEffect(() => {
    const link = pending.current;
    if (!link) return;
    if (shown !== link.phase) return;
    pending.current = null;
    const anchor = link.anchor;
    if (!anchor) return;
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(anchor);
      if (!target) return;
      const reduced = window.matchMedia?.(
        '(prefers-reduced-motion: reduce)',
      ).matches;
      target.scrollIntoView({
        block: 'start',
        behavior: reduced ? 'auto' : 'smooth',
      });
      target.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [shown]);
  return (link: PersistentSourceLink) => {
    pending.current = link;
    choose(link.phase);
  };
}
