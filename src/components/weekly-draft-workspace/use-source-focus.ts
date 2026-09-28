'use client';
import { useEffect, useRef } from 'react';
import { weekEditorAnchor } from './source-anchors';
import type { Phase } from './types';

/** A link to a phase and, where it can be named, the item within it. */
export type SourceLink = { phase: Phase; anchor: string | null };

// A focusable target takes focus itself; a form wrapper passes it to its
// first invalid field, else its first enabled control.
function focusTarget(target: HTMLElement) {
  if (target.hasAttribute('tabindex')) return target;
  return (
    target.querySelector<HTMLElement>('[aria-invalid="true"]') ??
    target.querySelector<HTMLElement>(
      'input:not(:disabled), textarea:not(:disabled), select:not(:disabled), button:not(:disabled)',
    ) ??
    target
  );
}

function bringIntoView(anchor: string | null) {
  const item = anchor ? document.getElementById(anchor) : null;
  const reduced = window.matchMedia?.(
    '(prefers-reduced-motion: reduce)',
  ).matches;
  const behavior = reduced ? 'auto' : 'smooth';
  if (item) {
    item.scrollIntoView({ block: 'start', behavior });
    focusTarget(item).focus({ preventScroll: true });
    return;
  }
  // A phase-wide decision, or an item no longer shown: the phase itself.
  const editor = document.getElementById(weekEditorAnchor);
  if (!editor) return;
  editor.scrollTo?.({ top: 0, behavior });
  editor.focus({ preventScroll: true });
}

// Follows a source link (a Persistent "Change it in Activity/Event" link or a
// Review & confirm Go link): shows that phase in this player's Phase View,
// then brings the item into view and focus once it has rendered. Other
// players are unaffected. A link within the phase already shown does not
// choose it again, so a Go link in Review never counts as reviewing the
// updated week.
export function useSourceFocus(
  shown: Phase | null,
  choose: (phase: Phase) => void,
) {
  const pending = useRef<SourceLink | null>(null);
  useEffect(() => {
    const link = pending.current;
    if (link?.phase !== shown || !link) return;
    pending.current = null;
    const frame = requestAnimationFrame(() => bringIntoView(link.anchor));
    return () => cancelAnimationFrame(frame);
  }, [shown]);
  return (link: SourceLink) => {
    if (link.phase === shown) {
      pending.current = null;
      requestAnimationFrame(() => bringIntoView(link.anchor));
      return;
    }
    pending.current = link;
    choose(link.phase);
  };
}
