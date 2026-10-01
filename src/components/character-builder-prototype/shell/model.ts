// PROTOTYPE (throwaway, #208) — the approved app shell's location model
// (variant C of #213, tag `prototype-approved/app-shell`,
// `app-shell-prototype/variant-c-parts.tsx`), keyed by this prototype's
// pages. Character pages (sheet, levelup, create, buildout) all play the
// shell's "sheet": no sub-header, a Back button, the Character's campaign.
import {
  History,
  House,
  LayoutGrid,
  Map as MapIcon,
  Settings,
  Shield,
  User,
  Users,
} from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { isCampaignPage, isCharacterPage, isMilitiaPage } from '../nav';
import type { Campaign, ProtoPage } from '../types';

export type Icon = ComponentType<SVGProps<SVGSVGElement>>;
export type Tab = { page: ProtoPage; label: string; icon: Icon };

export const TOP_TABS: Tab[] = [
  { page: 'campaigns', label: 'Campaigns', icon: MapIcon },
  { page: 'characters', label: 'Characters', icon: User },
];

/** Home · Characters (· Militia when the campaign has one). */
export function campaignTabs(campaign: Campaign): Tab[] {
  return [
    { page: 'campaign-home', label: 'Home', icon: House },
    { page: 'campaign-characters', label: 'Characters', icon: Users },
    ...(campaign.militia
      ? [{ page: 'militia' as ProtoPage, label: 'Militia', icon: Shield }]
      : []),
  ];
}

/** The militia's second level, Setup last. */
export function militiaTabs(campaign: Campaign): Tab[] {
  return [
    {
      page: 'week',
      label: `Week ${campaign.militia?.week ?? 0}`,
      icon: LayoutGrid,
    },
    { page: 'history', label: 'Finished weeks', icon: History },
    { page: 'militia', label: 'Militia', icon: Shield },
    { page: 'officers', label: 'Characters & officers', icon: Users },
    { page: 'setup', label: 'Setup', icon: Settings },
  ];
}

export const PAGE_LABEL: Record<ProtoPage, string> = {
  campaigns: 'Campaigns',
  characters: 'Characters',
  'campaign-home': 'Home',
  'campaign-characters': 'Characters',
  week: 'Week',
  history: 'Finished weeks',
  militia: 'Militia',
  officers: 'Characters & officers',
  setup: 'Setup',
  sheet: 'Sheet',
  levelup: 'Level up',
  create: 'New character',
  buildout: 'Build out',
};

/**
 * The section a page belongs to, for lighting the top-bar links and the
 * phone strip. A Character page borrows the page Back goes to, or its
 * campaign's Characters page when Back leaves the campaign.
 */
export function sectionOf(
  page: ProtoPage,
  back: ProtoPage,
  inCampaign: boolean,
): ProtoPage {
  if (!isCharacterPage(page)) return page;
  if (isCampaignPage(back) === inCampaign) return back;
  return inCampaign ? 'campaign-characters' : 'characters';
}

export type PhoneArea = 'campaign' | 'militia' | 'characters';

/**
 * Which phone tab a page belongs to. A Character page opened from the
 * Characters area keeps the Characters tab lit even when the Character is
 * in a campaign: the tab you came from is where Back goes.
 */
export function phoneAreaOf(page: ProtoPage, back: ProtoPage): PhoneArea {
  const p = isCharacterPage(page) ? back : page;
  if (p === 'characters') return 'characters';
  if (isMilitiaPage(p)) return 'militia';
  return 'campaign';
}
