'use client';
// PROTOTYPE (throwaway, #208) — URL-addressable navigation. Every page and
// sub-state a reviewer may screenshot lives in the query string:
//   ?variant=1|2|3&page=<ProtoPage>&campaign=<id>&character=<id>&from=<ProtoPage>
// plus page-local params (`level`, `as`, `tab`…). `from` is where a
// Character page (sheet, levelup, create, buildout) was opened from, so its
// Back button returns there; it survives moving between Character pages.

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { IRONFANG } from './mock-characters';
import { useBuilderStore } from './store';
import type { Campaign, Character, ProtoPage } from './types';

export const MILITIA_PAGES: ProtoPage[] = [
  'week',
  'history',
  'militia',
  'officers',
  'setup',
];
export const CAMPAIGN_PAGES: ProtoPage[] = [
  'campaign-home',
  'campaign-characters',
  ...MILITIA_PAGES,
];
/** Pages about one Character; their campaign is the Character's own. */
export const CHARACTER_PAGES: ProtoPage[] = [
  'sheet',
  'levelup',
  'create',
  'buildout',
];
export const PAGES: ProtoPage[] = [
  'campaigns',
  'characters',
  ...CAMPAIGN_PAGES,
  ...CHARACTER_PAGES,
];

export const isMilitiaPage = (p: ProtoPage) => MILITIA_PAGES.includes(p);
export const isCampaignPage = (p: ProtoPage) => CAMPAIGN_PAGES.includes(p);
export const isCharacterPage = (p: ProtoPage) => CHARACTER_PAGES.includes(p);

/** Params that survive a page change; anything else (`level`, `tab`…) is page-local. */
const CORE = new Set(['variant', 'page', 'campaign', 'character', 'from']);

export function parsePage(value: string | null): ProtoPage | undefined {
  return PAGES.find((p) => p === value);
}

/** The character a page shows when `&character=` is absent. */
export function defaultCharacterFor(page: ProtoPage): string | null {
  if (page === 'sheet' || page === 'levelup') return 'kesh';
  if (page === 'buildout') return 'hessa';
  return null;
}

export type NavOptions = {
  /**
   * Set or (null) clear `&campaign=`. Omitted: kept between campaign pages,
   * cleared on top-level and Character pages (`create` keeps it: it is where
   * the new Character goes).
   */
  campaign?: string | null;
  /**
   * Set or (null) clear `&character=`. Omitted: kept between Character
   * pages, cleared otherwise.
   */
  character?: string | null;
  /** Set or (null) clear `&from=`. Omitted: kept between Character pages. */
  from?: ProtoPage | null;
  /** Page-local params; null clears one. */
  params?: Record<string, string | null>;
};

/**
 * Where Back on a Character page goes: the page it was opened from, in the
 * Character's current campaign (it may have left or moved), else its list.
 */
export function backTarget(
  from: ProtoPage | undefined,
  character: Character | undefined,
  campaign: Campaign | undefined,
): { page: ProtoPage; campaign?: string } {
  const page = from && !isCharacterPage(from) ? from : undefined;
  if (!campaign)
    return { page: page === 'campaigns' ? 'campaigns' : 'characters' };
  if (!page) return { page: 'campaign-characters', campaign: campaign.id };
  if (!isCampaignPage(page)) return { page };
  if (isMilitiaPage(page) && !campaign.militia)
    return { page: 'campaign-characters', campaign: campaign.id };
  return { page, campaign: campaign.id };
}

export function useProtoNav() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const { state } = useBuilderStore();
  const page = parsePage(search.get('page')) ?? 'campaigns';
  const characterId = search.get('character') ?? defaultCharacterFor(page);
  const from = parsePage(search.get('from'));
  const campaignParam = search.get('campaign') ?? undefined;
  const character = state.characters.find((c) => c.id === characterId);

  // The campaign the page is in: a campaign page's own (default Ironfang); a
  // Character page's Character's (before `create` has made one, the param);
  // none on the top-level areas.
  const campaignId = isCampaignPage(page)
    ? (campaignParam ?? IRONFANG)
    : isCharacterPage(page)
      ? character
        ? character.campaignId
        : page === 'create'
          ? campaignParam
          : undefined
      : undefined;
  const campaign = state.campaigns.find((c) => c.id === campaignId);

  const href = useCallback(
    (to: ProtoPage, opts: NavOptions = {}) => {
      const next = new URLSearchParams(search);
      const samePage = to === page;
      const betweenCharacterPages =
        isCharacterPage(page) && isCharacterPage(to);
      if (!samePage)
        for (const key of [...next.keys()])
          if (!CORE.has(key)) next.delete(key);
      next.set('page', to);

      if (opts.campaign !== undefined) {
        if (opts.campaign === null) next.delete('campaign');
        else next.set('campaign', opts.campaign);
      } else if (
        !samePage &&
        !(isCampaignPage(to) && isCampaignPage(page)) &&
        to !== 'create'
      )
        next.delete('campaign');

      if (opts.character !== undefined) {
        if (opts.character === null) next.delete('character');
        else next.set('character', opts.character);
      } else if (!samePage && !betweenCharacterPages) next.delete('character');

      if (opts.from !== undefined) {
        if (opts.from === null) next.delete('from');
        else next.set('from', opts.from);
      } else if (!samePage && !betweenCharacterPages) next.delete('from');

      for (const [key, value] of Object.entries(opts.params ?? {})) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      return `${pathname}?${next.toString()}`;
    },
    [page, pathname, search],
  );

  const back = backTarget(from, character, campaign);

  return useMemo(
    () => ({
      page,
      /** `?variant=` as given; sheet-variants.tsx maps anything unknown to '1'. */
      variant: search.get('variant') ?? '1',
      /** The campaign this page is in, or undefined (top-level areas, a Character in no campaign). */
      campaignId,
      campaign,
      /** `&campaign=` as given (create uses it for the new Character's campaign). */
      campaignParam,
      characterId,
      /** Where a Character page was opened from. */
      from,
      /** Where Back on a Character page goes. */
      back,
      /** Any query param, e.g. `nav.param('level')`. */
      param: (key: string) => search.get(key),
      /** The URL for a page (for <a href>). */
      href,
      /** Go to a page (router.replace: no history entry). */
      go: (to: ProtoPage, opts?: NavOptions) =>
        router.replace(href(to, opts), { scroll: true }),
      /** Back on a Character page. */
      goBack: () =>
        router.replace(href(back.page, { campaign: back.campaign ?? null }), {
          scroll: true,
        }),
      /** Patch page-local params in place, e.g. `nav.set({ tab: 'skills' })`. */
      set: (params: Record<string, string | null>) =>
        router.replace(href(page, { params }), { scroll: false }),
    }),
    [
      back,
      campaign,
      campaignId,
      campaignParam,
      characterId,
      from,
      href,
      page,
      router,
      search,
    ],
  );
}

export type ProtoNav = ReturnType<typeof useProtoNav>;
