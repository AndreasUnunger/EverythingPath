import type { CampaignScope } from '~/lib/campaign-scope';

export type CharacterScope<CharacterId extends string = string> =
  Partial<CampaignScope> & {
    characterId: CharacterId;
  };
