'use client';
// PROTOTYPE (throwaway, #208) — Variant B "One living sheet", round 2,
// inside the approved app shell (variant C of #213). There is no wizard:
// creating, building out and levelling up all happen on one dense editable
// sheet; `create`, `buildout` and `levelup` are URL actions that end on it.
// The list pages (Characters, a campaign's Characters, Characters &
// officers) follow the shell's own pages.

import type { ReactNode } from 'react';
import { useProtoNav } from './nav';
import { Missing } from './shell/placeholders';
import type { ProtoPage } from './types';
import { CampaignCharactersPage } from './variant-b/campaign-characters-page';
import {
  BuildoutPage,
  CreatePage,
  LevelUpPage,
  SheetPage,
} from './variant-b/character-pages';
import { CharactersPage } from './variant-b/characters-page';
import { OfficersPage } from './variant-b/officers-page';

export const name = 'Living sheet in shell C, round 2';

export function VariantB({ page }: { page: ProtoPage }): ReactNode {
  const nav = useProtoNav();
  switch (page) {
    case 'characters':
      return <CharactersPage />;
    case 'campaign-characters':
      return <CampaignCharactersPage />;
    case 'officers':
      return <OfficersPage />;
    case 'create':
      return <CreatePage />;
    case 'buildout':
      return <BuildoutPage characterId={nav.characterId ?? 'hessa'} />;
    case 'levelup':
      return <LevelUpPage characterId={nav.characterId ?? 'kesh'} />;
    case 'sheet':
      return <SheetPage characterId={nav.characterId ?? 'kesh'} />;
    case 'spells':
      return <SheetPage characterId={nav.characterId ?? 'seren'} spellsPage />;
    default:
      return <Missing noun="page" />;
  }
}
