import type { Id } from '@convex/_generated/dataModel';
import type { CharacterSheetOrigin } from '~/lib/campaign-routes';
import type { CharacterOwner } from '~/lib/character-ownership';

/** Where a row's Companion Relationships are read, and the sheet links' Back. */
export type CompanionLinksSource = {
  characterId: Id<'character'>;
  origin: CharacterSheetOrigin;
};

export type OwnedCharacterListRow = {
  id: string;
  name: string;
  level: number;
  kind: string;
  active: boolean;
  href: string;
  /** Present while the Character has a sheet to relate Companions to. */
  companions?: CompanionLinksSource;
};

export type CampaignCharacterListRow = Omit<
  OwnedCharacterListRow,
  'href' | 'id'
> & {
  id: Id<'character'>;
  owner: CharacterOwner | null;
  ownershipAvailable: boolean;
  ownerLastOperationId?: string;
  href?: string;
  ownerName: string | null;
  isOnRoster: boolean;
};

export type CharacterListGroup = {
  key: string;
  title: string;
  organizationName?: string;
  characters: OwnedCharacterListRow[];
};
