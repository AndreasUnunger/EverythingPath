'use client';
import { Card } from '~/components/ui/card';
import {
  CharacterSheetFrame,
  CharacterSheetSkeleton,
  type BackLink,
} from './character-sheet-frame';
import { CharacterSheetView } from './character-sheet-view';
import { useCharacterSheet } from './use-character-sheet';

type PageProps = {
  organizationId: string;
  characterId: string;
  back: BackLink;
  campaignName: string;
};

// An existing Character whose sheet is not prepared: nothing is initialized
// here, the player goes back to where they came from.
function SheetUnavailable({ back }: { back: BackLink }) {
  return (
    <CharacterSheetFrame back={back}>
      <Card className="gap-3 p-4">
        <p>This character&apos;s sheet is not available here yet.</p>
      </Card>
    </CharacterSheetFrame>
  );
}

function SheetHost({
  organizationId,
  characterId,
  back,
  campaignName,
}: PageProps) {
  const controller = useCharacterSheet({ organizationId, characterId });
  if (controller.sheet === undefined)
    return <CharacterSheetSkeleton back={back} />;
  if (controller.sheet === null) return <SheetUnavailable back={back} />;
  return (
    <CharacterSheetView
      sheet={controller.sheet}
      controller={controller}
      back={back}
      campaignName={campaignName}
    />
  );
}

/**
 * The sheet for one Character in one organization. The controller is keyed
 * on both, so a late save reply after navigating away belongs to the
 * discarded instance. Authorization and query failures throw to the route's
 * error boundary rather than reading as an empty sheet.
 */
export function CharacterSheetPage(props: PageProps) {
  return (
    <SheetHost
      key={`${props.organizationId}:${props.characterId}`}
      {...props}
    />
  );
}
