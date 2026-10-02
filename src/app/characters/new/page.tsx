'use client';

import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';
import {
  CharacterSheetFrame,
  CharacterSheetSkeleton,
  type BackLink,
} from '~/components/character-sheet/character-sheet-frame';
import { CreateCharacterSheet } from '~/components/character-sheet/create-character-sheet';
import { Card } from '~/components/ui/card';

const back: BackLink = { href: '/campaigns', label: 'Campaigns' };

// This entry is available only to identities prepared by the isolated demo
// harness; everyone else reads that creating here is not open yet, with no
// hint of how it opens.
export default function NewPrivateCharacterRoute() {
  const user = useQuery(api.user.getMe, {});
  if (user === undefined) return <CharacterSheetSkeleton back={back} />;
  return (
    <CharacterSheetFrame back={back}>
      {user?.characterSheetDemo ? (
        <CreateCharacterSheet />
      ) : (
        <Card className="gap-3 p-4">
          <p>Creating characters here is not available yet.</p>
        </Card>
      )}
    </CharacterSheetFrame>
  );
}
