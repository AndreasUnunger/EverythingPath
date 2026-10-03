import type { Id } from '@convex/_generated/dataModel';
import type { CharacterOwner } from '~/lib/character-ownership';

export type OwnedCharacterListRow = {
  id: string;
  name: string;
  level: number;
  kind: string;
  active: boolean;
  href: string;
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
