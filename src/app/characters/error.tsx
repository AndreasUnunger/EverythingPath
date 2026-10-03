'use client';

import { usePathname } from 'next/navigation';
import { resolveNavigationLocation } from '~/lib/campaign-routes';
import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import { FailedLoadCard } from '~/components/campaign-shell/failed-load';
import { useCharacterSheetNavigation } from '~/components/character-sheet/use-character-sheet-navigation';
import { CharacterSheetFrame } from '~/components/character-sheet/character-sheet-frame';

// Missing and inaccessible Characters use the same error presentation.
export default function IndependentCharacterError({
  reset,
}: {
  reset: () => void;
}) {
  const isSheet =
    resolveNavigationLocation(usePathname())?.kind === 'character-sheet';
  const navigation = useCharacterSheetNavigation();
  const { reset: resetQueries } = useQueryErrorResetBoundary();
  return (
    <CharacterSheetFrame back={navigation.back}>
      <FailedLoadCard
        noun={isSheet ? 'The character sheet' : 'The characters'}
        retry={() => {
          resetQueries();
          reset();
        }}
      />
    </CharacterSheetFrame>
  );
}
