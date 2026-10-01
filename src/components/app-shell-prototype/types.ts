// PROTOTYPE — shared location model for the app-shell prototype. Variants
// render chrome around `content`; the harness in index.tsx owns the URL.
import type { ReactNode } from 'react';
import { getCharacter } from './mock';

export type Page =
  | 'campaigns'
  | 'characters'
  | 'campaign-home'
  | 'campaign-characters'
  | 'week'
  | 'history'
  | 'militia'
  | 'officers'
  | 'setup'
  | 'sheet';

export type Location = {
  page: Page;
  campaignId?: string;
  characterId?: string;
  /** Where the user came from, so a variant can render a back link on the sheet. */
  from?: Page;
};

export type ShellProps = {
  location: Location;
  go: (to: Location) => void;
  orgId: string;
  setOrgId: (id: string) => void;
  /** The rendered page body for `location` (already wrapped in `<main>`). */
  content: ReactNode;
};

const MILITIA_PAGES: Page[] = [
  'week',
  'history',
  'militia',
  'officers',
  'setup',
];
const CAMPAIGN_PAGES: Page[] = [
  'campaign-home',
  'campaign-characters',
  ...MILITIA_PAGES,
];

/** A page inside Militia (second bar), Setup included. */
export function isMilitiaPage(page: Page) {
  return MILITIA_PAGES.includes(page);
}

/** A page inside a campaign (Home, Characters, and every Militia page). */
export function isCampaignPage(page: Page) {
  return CAMPAIGN_PAGES.includes(page);
}

/** The campaign the character is in, or undefined. */
export function sheetCampaignId(characterId: string) {
  return getCharacter(characterId)?.campaignId;
}

/**
 * The campaign the location is in: the explicit campaign on campaign pages,
 * the character's campaign on a sheet, none on the top-level areas.
 */
export function campaignOf(location: Location) {
  if (location.page === 'sheet' && location.characterId)
    return sheetCampaignId(location.characterId);
  return isCampaignPage(location.page) ? location.campaignId : undefined;
}
