import type { PointerEvent as ReactPointerEvent } from 'react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import {
  createPointerCardDragState,
  getPointerCardDragStyle,
  shouldIgnorePointerCardDragStart,
  type PointerCardDragState,
} from '~/lib/pointer-card-drag';
import { officerRoleLabels } from './types';
import type { CharacterId, CharacterRecord, MilitiaRecord } from './types';

export function CharacterListCard({
  activeCharacters,
  militia,
  dragState,
  onEdit,
  onArchive,
  onStartDrag,
  archivingCharacterId,
}: {
  activeCharacters: CharacterRecord[];
  militia: MilitiaRecord | null | undefined;
  dragState: PointerCardDragState<CharacterId> | null;
  onEdit: (character: CharacterRecord) => void;
  onArchive: (characterId: CharacterId) => void;
  onStartDrag: (dragState: PointerCardDragState<CharacterId>) => void;
  archivingCharacterId?: CharacterId;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {activeCharacters.map((character) => {
        const role = officerRoleLabels.find(({ role }) => militia?.[role] === character._id);
        const isDraggingCard = dragState?.actionId === character._id;
        return (
          <div
            key={character._id}
            style={isDraggingCard && dragState ? { height: dragState.height } : undefined}
          >
            <Card
              className={getCharacterCardClassName(isDraggingCard)}
              style={isDraggingCard ? getPointerCardDragStyle(dragState) : undefined}
              onPointerDown={(event) =>
                handleCharacterCardPointerDown({
                  event,
                  characterId: character._id,
                  onStartDrag,
                })
              }
            >
              <div className="flex h-full flex-col gap-4">
                <div className="border-b-2 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-sans text-xl font-bold leading-tight">{character.name}</h3>
                    </div>
                    <div className="flex shrink-0 gap-2">
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
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      {character.kind ?? 'pc'}
                    </Badge>
                    <Badge variant="outline" className="font-mono text-xs">
                      {role?.label ?? 'No Role'}
                    </Badge>
                  </div>
                </div>

                <div className="border-b-2 pb-3">
                  <p className="font-mono text-sm font-bold">Level {character.level}</p>
                  <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2 font-mono text-sm xl:grid-cols-6">
                    <StatCell label="STR" value={character.strength} />
                    <StatCell label="DEX" value={character.dexterity} />
                    <StatCell label="CON" value={character.constitution} />
                    <StatCell label="INT" value={character.intelligence} />
                    <StatCell label="WIS" value={character.wisdom} />
                    <StatCell label="CHA" value={character.charisma} />
                  </div>
                </div>

                <div className="min-h-10">
                  {character.description ? (
                    <p className="text-muted-foreground line-clamp-4 font-mono text-xs leading-relaxed">
                      {character.description}
                    </p>
                  ) : (
                    <p className="text-muted-foreground/60 font-mono text-xs">
                      No notes
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </div>
        );
      })}
    </div>
  );
}

function handleCharacterCardPointerDown({
  event,
  characterId,
  onStartDrag,
}: {
  event: ReactPointerEvent<HTMLDivElement>;
  characterId: CharacterId;
  onStartDrag: (dragState: PointerCardDragState<CharacterId>) => void;
}) {
  if (event.button !== 0 || shouldIgnorePointerCardDragStart(event.target)) {
    return;
  }

  event.preventDefault();
  onStartDrag(
    createPointerCardDragState({
      event,
      actionId: characterId,
      source: 'deck',
    }),
  );
}

function getCharacterCardClassName(isDraggingCard: boolean) {
  if (isDraggingCard) {
    return 'bg-card border-primary border-2 p-4 shadow-2xl transition-none select-none cursor-grabbing';
  }

  return 'bg-card border-2 p-4 transition-transform duration-200 ease-out hover:-translate-y-1 hover:cursor-grab hover:border-primary hover:shadow-[0_0_0_1px_hsl(var(--primary)),6px_6px_0_0_hsl(var(--primary)/0.16)] active:cursor-grabbing';
}

function StatCell({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="border-b-2 pb-1 font-mono text-sm">
      <span className="text-muted-foreground text-[10px] uppercase">{label}</span>{' '}
      <span>{value}</span>
    </div>
  );
}
