'use client';
import { useCampaign } from '~/components/campaign-shell/campaign-context';
import { CharactersSection } from '~/components/campaign-sections/characters-section';
import { CharactersPageFrame } from '~/components/campaign-sections/page-frames';
import { CreateCharacterSheet } from '~/components/character-sheet/create-character-sheet';

export default function CharactersPage() {
  const { campaign, organizationId } = useCampaign();
  return (
    <CharactersPageFrame>
      <CharactersSection
        campaignId={campaign._id}
        organizationId={organizationId}
      />
      {/* Living sheets are created only in prepared demo campaigns; the
          production ledger stays as it is until the explicit cutover. */}
      {campaign.e2eFixture ? (
        <CreateCharacterSheet
          campaignId={campaign._id}
          organizationId={organizationId}
        />
      ) : null}
    </CharactersPageFrame>
  );
}
