'use client';
import type { Doc } from '@convex/_generated/dataModel';
import { ArchiveControl } from './archive-control';
import type { CharacterScope } from './character-scope';
import { DeleteCharacterControl } from './delete-character-control';
import {
  useCharacterLifecycle,
  type Deletion,
} from './use-character-lifecycle';

/**
 * The one lifecycle action a Character offers: a campaign Character is
 * archived or restored, a private one deleted. A private sheet is readable
 * only by its owner, so whoever sees it may delete it; the server still
 * decides.
 */
export function CharacterLifecycle({
  character,
  organizationId,
  campaignId,
  onDeletion,
}: Omit<CharacterScope, 'characterId'> & {
  character: Doc<'character'>;
  onDeletion: (deletion: Deletion) => void;
}) {
  const lifecycle = useCharacterLifecycle({
    organizationId,
    campaignId,
    characterId: character._id,
    characterName: character.name,
    onDeletion,
  });
  if (character.campaignId)
    return <ArchiveControl character={character} lifecycle={lifecycle} />;
  return (
    <DeleteCharacterControl name={character.name} lifecycle={lifecycle} />
  );
}
