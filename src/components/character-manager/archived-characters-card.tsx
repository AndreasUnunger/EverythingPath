import { Button } from '~/components/ui/button';
import type { CharacterId, CharacterRecord } from './types';

export function ArchivedCharactersCard({
  archivedCharacters,
  onUnarchive,
  onRequestDelete,
  archivingCharacterId,
  deletingCharacterId,
}: {
  archivedCharacters: CharacterRecord[];
  onUnarchive: (characterId: CharacterId) => void;
  onRequestDelete: (character: CharacterRecord) => void;
  archivingCharacterId?: CharacterId;
  deletingCharacterId?: CharacterId;
}) {
  if (archivedCharacters.length === 0) {
    return (
      <p className="text-muted-foreground font-mono text-sm">
        No archived characters.
      </p>
    );
  }

  return (
    <div className="w-full">
      <div className="space-y-2">
        {archivedCharacters.map((character) => (
          <div
            key={character._id}
            className="flex items-center justify-between border p-2"
          >
            <p className="font-mono text-sm">
              {character.name} (Level {character.level})
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={archivingCharacterId === character._id}
                onClick={() => onUnarchive(character._id)}
              >
                {archivingCharacterId === character._id
                  ? 'Un-archiving...'
                  : 'Un-archive'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={deletingCharacterId === character._id}
                onClick={() => onRequestDelete(character)}
              >
                {deletingCharacterId === character._id
                  ? 'Deleting...'
                  : 'Delete'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
