'use client';

import { useParams } from 'next/navigation';
import { CharacterSheetPage } from '~/components/character-sheet/character-sheet-page';
import { decodeRouteSegment } from '~/lib/campaign-routes';

// Independent sheets derive access from the Character, without an active organization.
export default function IndependentCharacterSheetRoute() {
  const { characterId } = useParams<{ characterId: string }>();
  return (
    <CharacterSheetPage
      characterId={decodeRouteSegment(characterId)}
      back={{ href: '/campaigns', label: 'Campaigns' }}
    />
  );
}
