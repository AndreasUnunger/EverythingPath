'use client';
import type { CharacterOwner } from '~/lib/character-ownership';
import type { Doc } from '@convex/_generated/dataModel';
import { ArchiveControl } from './archive-control';
import { useCharacterOwnership } from './use-character-ownership';
import { CharacterOwnerControl } from './character-owner-control';
import type { CharacterScope } from './character-scope';
import { DeleteCharacterControl } from './delete-character-control';
import {
  useCharacterLifecycle,
  type Deletion,
} from './use-character-lifecycle';

/**
 * What a Character's campaign row offers: a campaign Character names its
 * owner, reassignable to any current member, and is archived or restored;
 * a private one is deleted. A private sheet is readable only by its owner,
 * so whoever sees it may delete it; the server still decides. The owner
 * control reads the persisted campaign, so an independent campaign sheet
 * offers it without a selected organization.
 */
export function CharacterLifecycle({
  character,
  owner,
  organizationId,
  campaignId,
  ownershipAvailable,
  onDeletion,
}: Omit<CharacterScope, 'characterId'> & {
  character: Doc<'character'>;
  owner: CharacterOwner | null;
  ownershipAvailable: boolean;
  onDeletion: (deletion: Deletion) => void;
}) {
  const lifecycle = useCharacterLifecycle({
    organizationId,
    campaignId,
    characterId: character._id,
    characterName: character.name,
    onDeletion,
  });
  const ownership = useCharacterOwnership(
    {
      characterId: character._id,
      campaignId: character.campaignId,
      organizationId,
    },
    owner,
    character.ownerLastOperationId,
    ownershipAvailable,
  );
  if (!character.campaignId)
    return (
      <DeleteCharacterControl name={character.name} lifecycle={lifecycle} />
    );
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
      <CharacterOwnerControl
        characterName={character.name}
        ownership={ownership}
      />
      <ArchiveControl character={character} lifecycle={lifecycle} />
    </div>
  );
}
