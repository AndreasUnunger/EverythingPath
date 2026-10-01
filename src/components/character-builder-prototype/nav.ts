'use client';
// PROTOTYPE (throwaway, #208) — URL-addressable navigation. Every page and
// sub-state a reviewer may screenshot lives in the query string.

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { IRONFANG } from './mock-characters';
import type { ProtoPage } from './types';

export const PAGES: ProtoPage[] = [
  'list',
  'create',
  'buildout',
  'sheet',
  'levelup',
];

/** Params that survive a page change; anything else (`step`, `tab`…) is page-local. */
const CORE = new Set(['variant', 'page', 'campaign', 'character']);

export function parsePage(value: string | null): ProtoPage {
  return PAGES.includes(value as ProtoPage) ? (value as ProtoPage) : 'list';
}

/** The character a page shows when `&character=` is absent. */
export function defaultCharacterFor(page: ProtoPage): string | null {
  if (page === 'sheet' || page === 'levelup') return 'kesh';
  if (page === 'buildout') return 'hessa';
  return null;
}

export type NavOptions = {
  /** Set or (null) clear `&character=`. Omitted: kept on the same page, cleared on a page change. */
  character?: string | null;
  /** Set `&campaign=`. Omitted: kept. */
  campaign?: string;
  /** Page-local params such as `step` or `tab`; null clears one. */
  params?: Record<string, string | null>;
};

export function useProtoNav() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const page = parsePage(search.get('page'));
  const campaignId = search.get('campaign') ?? IRONFANG;
  const characterId = search.get('character') ?? defaultCharacterFor(page);

  const href = useCallback(
    (to: ProtoPage, opts: NavOptions = {}) => {
      const next = new URLSearchParams(search);
      if (to !== page)
        for (const key of [...next.keys()])
          if (!CORE.has(key)) next.delete(key);
      if (to !== page && opts.character === undefined) next.delete('character');
      next.set('page', to);
      if (opts.campaign) next.set('campaign', opts.campaign);
      if (opts.character !== undefined) {
        if (opts.character === null) next.delete('character');
        else next.set('character', opts.character);
      }
      for (const [key, value] of Object.entries(opts.params ?? {})) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      return `${pathname}?${next.toString()}`;
    },
    [page, pathname, search],
  );

  return useMemo(
    () => ({
      page,
      variant: search.get('variant') ?? 'A',
      campaignId,
      characterId,
      /** Any query param, e.g. `nav.param('step')`. */
      param: (key: string) => search.get(key),
      /** The URL for a page (for <a href> / <Link>). */
      href,
      /** Go to a page: `router.replace`, no history entry, no scroll reset surprises. */
      go: (to: ProtoPage, opts?: NavOptions) =>
        router.replace(href(to, opts), { scroll: true }),
      /** Patch page-local params in place, e.g. `nav.set({ step: '3' })`. */
      set: (params: Record<string, string | null>) =>
        router.replace(href(page, { params }), { scroll: false }),
    }),
    [campaignId, characterId, href, page, router, search],
  );
}

export type ProtoNav = ReturnType<typeof useProtoNav>;
