import type { Id } from '@convex/_generated/dataModel';

export type CharacterScope<CharacterId extends string = string> = {
  organizationId?: string;
  campaignId?: Id<'campaign'>;
  characterId: CharacterId;
};
