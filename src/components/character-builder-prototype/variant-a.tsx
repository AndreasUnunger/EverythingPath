'use client';
// PROTOTYPE (throwaway, #208) — Variant A "Guided steps": building is a
// step-by-step wizard with a step rail, one decision per screen and a sticky
// live sheet beside it. Level-up is a focused level wizard ending in a
// before/after diff. The sheet is read-mostly; every section's Edit reopens
// the matching step. Pages live under variant-a/.

import { BookOpen, Users } from 'lucide-react';
import { defaultSections, type FrameNavFn } from './frame';
import type { VariantProps } from './types';
import { LevelUpPage } from './variant-a/levelup';
import { ListPage } from './variant-a/list-page';
import { SheetPage } from './variant-a/sheet-page';
import { WizardPage } from './variant-a/wizard';

export const name = 'Guided steps';

/**
 * With a militia the real four sections apply and Characters & officers is
 * home. Without one there is no Week/Militia; Full Characters get their own
 * "Characters" section next to the campaign's sessions.
 */
export const frameNav: FrameNavFn = ({ campaign }) => {
  if (campaign.militia)
    return { sections: defaultSections(campaign), activeKey: 'characters' };
  return {
    sections: [
      { key: 'sessions', label: 'Sessions', short: 'Sessions', icon: BookOpen },
      {
        key: 'characters',
        label: 'Characters',
        short: 'Characters',
        icon: Users,
        to: { page: 'list' },
      },
    ],
    activeKey: 'characters',
  };
};

export function VariantA(props: VariantProps) {
  const { page, campaignId, characterId } = props;
  if (page === 'list') return <ListPage campaignId={campaignId} />;
  if (page === 'sheet' && characterId) return <SheetPage characterId={characterId} />;
  if (page === 'levelup' && characterId)
    return <LevelUpPage characterId={characterId} />;
  return <WizardPage {...props} />;
}
