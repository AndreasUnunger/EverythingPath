import { CharacterSheetSkeleton } from '~/components/character-sheet/character-sheet-frame';

// The sheet route's fallback inside the kept campaign shell, in the same
// frame as the sheet. The origin link arrives with the page.
export default function Loading() {
  return <CharacterSheetSkeleton back={null} />;
}
