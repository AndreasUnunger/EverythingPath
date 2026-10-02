import { CharacterSheetSkeleton } from '~/components/character-sheet/character-sheet-frame';

export default function IndependentCharacterLoading() {
  return (
    <CharacterSheetSkeleton back={{ href: '/campaigns', label: 'Campaigns' }} />
  );
}
