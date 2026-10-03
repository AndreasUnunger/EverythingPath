export type OwnedCharacterListRow = {
  id: string;
  name: string;
  level: number;
  kind: string;
  active: boolean;
  href: string;
};

export type CampaignCharacterListRow = Omit<OwnedCharacterListRow, 'href'> & {
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
