import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { officerRoleLabels } from './types';
import type { CharacterRecord, CharacterId, MilitiaRecord } from './types';

export function CharacterListCard({
  activeCharacters,
  militia,
  onEdit,
  onArchive,
  archivingCharacterId,
}: {
  activeCharacters: CharacterRecord[];
  militia: MilitiaRecord | null | undefined;
  onEdit: (character: CharacterRecord) => void;
  onArchive: (characterId: CharacterId) => void;
  archivingCharacterId?: CharacterId;
}) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {activeCharacters.map((character) => {
        const role = officerRoleLabels.find(({ role }) => militia?.[role] === character._id);
        return (
          <Card
            key={character._id}
            className="bg-card border-2 border-x-0 border-t-0 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-sans text-xl font-bold">{character.name}</h3>
                  <Badge variant="outline" className="font-mono text-xs">
                    {character.kind ?? 'pc'}
                  </Badge>
                  {role ? (
                    <Badge variant="outline" className="font-mono text-xs">
                      {role.label}
                    </Badge>
                  ) : null}
                </div>
                <p className="text-muted-foreground mt-1 font-mono text-sm">
                  Level {character.level} | STR {character.strength} DEX {character.dexterity}{' '}
                  CON {character.constitution} INT {character.intelligence} WIS{' '}
                  {character.wisdom} CHA {character.charisma}
                </p>
                {character.description ? (
                  <p className="text-muted-foreground mt-1 font-mono text-xs">
                    {character.description}
                  </p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onEdit(character)}>
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={archivingCharacterId === character._id}
                  onClick={() => onArchive(character._id)}
                >
                  {archivingCharacterId === character._id ? 'Archiving...' : 'Archive'}
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
