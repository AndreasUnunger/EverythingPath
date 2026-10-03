'use client';
import { useCampaign } from '~/components/campaign-shell/campaign-context';
import { CampaignCharactersView } from '~/components/character-navigation/campaign-characters-view';
import { CharactersListLoading } from '~/components/character-navigation/characters-list-loading';
import { useCampaignCharacters } from '~/components/character-navigation/use-character-lists';
export default function CharactersPage() {
  const { campaign, organizationId } = useCampaign();
  const { characters, newHref } = useCampaignCharacters({
    campaignId: campaign._id,
    organizationId,
  });
  return characters === undefined ? (
    <CharactersListLoading />
  ) : (
    <CampaignCharactersView
      campaignName={campaign.name}
      characters={characters}
      newHref={newHref}
    />
  );
}
