'use client';

import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import { FailedLoadCard } from '~/components/campaign-shell/failed-load';
import { CharacterSheetFrame } from '~/components/character-sheet/character-sheet-frame';

// Missing and inaccessible Characters use the same error presentation.
export default function IndependentCharacterError({
  reset,
}: {
  reset: () => void;
}) {
  const { reset: resetQueries } = useQueryErrorResetBoundary();
  return (
    <CharacterSheetFrame back={{ href: '/campaigns', label: 'Campaigns' }}>
      <FailedLoadCard
        noun="The character sheet"
        retry={() => {
          resetQueries();
          reset();
        }}
      />
    </CharacterSheetFrame>
  );
}
