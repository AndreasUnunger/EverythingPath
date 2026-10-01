'use client';
// PROTOTYPE (throwaway, #208) — Variant C "Level timeline + live sheet".
// The character is its history: a vertical timeline of cards (Foundation,
// one per Class Level, Now) on the left, a live derived sheet on the right.
// Every page but the list is the same two-pane builder with different
// defaults. Pieces live in ./variant-c/.

import { Users } from 'lucide-react';
import { defaultSections, type FrameNavFn } from './frame';
import type { VariantProps } from './types';
import { BuilderPage } from './variant-c/builder-page';
import { ListPage } from './variant-c/list-page';

export const name = 'Level timeline + live sheet';

/** Without a militia, "Characters & officers" and "Militia" give way to a plain "Characters" section. */
export const frameNav: FrameNavFn = ({ campaign }) => {
  const sections = defaultSections(campaign);
  if (campaign.militia) return { sections, activeKey: 'characters' };
  return {
    sections: [
      ...sections.filter((s) => s.key !== 'militia' && s.key !== 'characters'),
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

export function VariantC({ page, campaignId, characterId }: VariantProps) {
  if (page === 'list') return <ListPage campaignId={campaignId} />;
  return (
    <BuilderPage page={page} campaignId={campaignId} characterId={characterId} />
  );
}
