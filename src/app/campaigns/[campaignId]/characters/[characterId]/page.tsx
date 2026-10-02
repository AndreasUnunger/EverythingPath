'use client';
import { useParams } from 'next/navigation';
import { useCampaign } from '~/components/campaign-shell/campaign-context';
import { CharacterSheetPage } from '~/components/character-sheet/character-sheet-page';
import { campaignPath, decodeRouteSegment } from '~/lib/campaign-routes';

// A Character's living sheet inside its campaign's shell: the top bar keeps
// Characters & officers lit and Back returns there. The server validates the
// id; a malformed one fails the sheet read into this route's error boundary.
export default function CharacterSheetRoute() {
  const { campaign, organizationId } = useCampaign();
  const { characterId } = useParams<{ characterId: string }>();
  return (
    <CharacterSheetPage
      organizationId={organizationId}
      characterId={decodeRouteSegment(characterId)}
      back={{
        href: campaignPath(campaign._id, 'characters'),
        label: 'Characters & officers',
      }}
      campaignName={campaign.name}
    />
  );
}
