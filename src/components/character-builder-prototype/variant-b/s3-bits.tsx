'use client';
// PROTOTYPE (throwaway, #233) — spellcasting variant 3, "Spells page": small
// bits both the sheet summary and the spells page use. Contract:
// CONTRACT.md, "Round 4".

import type { MouseEvent, ReactNode } from 'react';
import { cn } from '~/lib/utils';
import { useProtoNav, type NavOptions } from '../nav';
import { isAccepted, useBuilderStore } from '../store';
import {
  ordinal,
  type ResolvedSpellcasting,
  type SlotRow,
} from '../spellcasting';
import type { ProtoPage, SchoolKey } from '../types';
import type { Warning } from '../warnings';

/** An in-prototype link: a real `href` (linkable), navigating in place on a plain click. */
export function ProtoLink({
  to,
  opts,
  className,
  children,
  title,
}: {
  to: ProtoPage;
  opts?: NavOptions;
  className?: string;
  children: ReactNode;
  title?: string;
}) {
  const nav = useProtoNav();
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    nav.go(to, opts);
  };
  return (
    <a
      href={nav.href(to, opts)}
      onClick={onClick}
      className={className}
      title={title}
    >
      {children}
    </a>
  );
}

/** The contract's school abbreviations; the full name goes in a `title`. */
export const SCHOOL_ABBR: Record<SchoolKey, string> = {
  abjuration: 'Abj',
  conjuration: 'Conj',
  divination: 'Div',
  enchantment: 'Ench',
  evocation: 'Evoc',
  illusion: 'Illus',
  necromancy: 'Necro',
  transmutation: 'Trans',
  universal: 'Univ',
};

/** "3 + 2 bonus + 1 school" — how a per-day number is made; null for a bare table number. */
export function perDayDetail(
  row: SlotRow,
  sc: ResolvedSpellcasting,
): string | null {
  if (row.perDay === null || (row.bonus === 0 && row.extra === 0)) return null;
  const parts = [String(row.base ?? 0)];
  if (row.bonus > 0) parts.push(`${row.bonus} bonus`);
  if (row.extra > 0)
    parts.push(`${row.extra} ${sc.extraSlot?.kind ?? 'extra'}`);
  return parts.join(' + ');
}

/**
 * One per-day number: "at will", or the total, with a dotted underline and a
 * title when bonus or extra slots are in it.
 */
export function PerDay({
  row,
  sc,
  className,
}: {
  row: SlotRow;
  sc: ResolvedSpellcasting;
  className?: string;
}) {
  if (row.perDay === null)
    return (
      <span className={cn('text-muted-foreground font-mono', className)}>
        at will
      </span>
    );
  const detail = perDayDetail(row, sc);
  return (
    <span
      title={
        detail ? `${row.perDay} per day: ${detail}` : `${row.perDay} per day`
      }
      className={cn(
        'font-mono',
        detail &&
          'decoration-foreground/40 underline decoration-dotted underline-offset-[3px]',
        className,
      )}
    >
      {row.perDay}
    </span>
  );
}

/** "22 in spellbook", "9 known", "prepares from the whole list". */
export function recordedCount(sc: ResolvedSpellcasting) {
  const n = sc.recorded.length;
  if (sc.casting.record === 'book')
    return `${n} in ${(sc.casting.bookName ?? 'spellbook').toLowerCase()}`;
  if (sc.casting.record === 'known') return `${n} known`;
  return `prepares from the whole ${sc.className.toLowerCase()} list`;
}

/**
 * The prestige share of a casting level in words: "+2 from Mystic theurge"
 * (advances grouped by class; a label is "Mystic theurge 1"). Null without.
 */
export function prestigeShare(sc: ResolvedSpellcasting): string | null {
  if (sc.advances.length === 0) return null;
  const by = new Map<string, number>();
  for (const a of sc.advances) {
    const name = a.label.replace(/\s+\d+$/, '');
    by.set(name, (by.get(name) ?? 0) + 1);
  }
  return [...by].map(([name, n]) => `+${n} from ${name}`).join(', ');
}

/** Warnings about one Spellcasting (its numbers and its recorded Spells). */
export function warningsFor(sc: ResolvedSpellcasting, warnings: Warning[]) {
  const entries = new Set(sc.recorded.map((r) => `entry:${r.entry.id}`));
  return warnings.filter(
    (w) => w.where === `spellcasting:${sc.classKey}` || entries.has(w.where),
  );
}

/** How many of a Spellcasting's warnings are still open (not accepted). */
export function useOpenWarningCount(
  characterId: string,
  sc: ResolvedSpellcasting,
  warnings: Warning[],
) {
  const { state } = useBuilderStore();
  return warningsFor(sc, warnings).filter(
    (w) => !(w.acceptable && isAccepted(state, characterId, w)),
  ).length;
}

/** "0", "1st", "2nd" as a level chip's text; "—" when unset. */
export const levelLabel = (level: number | null) =>
  level === null ? '—' : ordinal(level);
