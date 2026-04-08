import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  LedgerTable,
  LedgerTableActionCell,
  LedgerTableBody,
  LedgerTableCell,
  LedgerTableHead,
  LedgerTableHeaderCell,
  getLedgerRowClassName,
} from '~/components/ledger-table';
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
  const draggingCharacter = activeCharacters.find(
    (character) => character._id === dragState?.actionId,
  );

  if (activeCharacters.length === 0) {
    return (
      <Card className="bg-card border-2 p-4">
        <p className="text-muted-foreground font-mono text-sm">
          No active characters in the ledger.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="font-mono text-sm font-bold tracking-wide">Active Characters</p>

      <LedgerTable>
          <colgroup>
            <col style={{ width: '25%' }} />
            <col />
            <col />
            <col />
            <col style={{ width: '11rem' }} />
          </colgroup>
          <LedgerTableHead>
            <tr className="border-b border-primary/8">
              <LedgerTableHeaderCell>
                Character
              </LedgerTableHeaderCell>
              <LedgerTableHeaderCell className="w-px whitespace-nowrap">
                Level
              </LedgerTableHeaderCell>
              <LedgerTableHeaderCell className="w-px whitespace-nowrap">
                Stats
              </LedgerTableHeaderCell>
              <LedgerTableHeaderCell className="w-px whitespace-nowrap">
                Role
              </LedgerTableHeaderCell>
              <LedgerTableHeaderCell className="w-[11rem]" />
            </tr>
          </LedgerTableHead>
          <LedgerTableBody>
            {activeCharacters.map((character, index) => {
              const role = officerRoleLabels.find(
                ({ role }) => militia?.[role] === character._id,
              );
              const isDraggingRow = dragState?.actionId === character._id;

              return (
                <tr
                  key={character._id}
                  data-slot="card"
                  className={getCharacterRowClassName(isDraggingRow, index)}
                  onPointerDown={(event) =>
                    handleCharacterCardPointerDown({
                      event,
                      characterId: character._id,
                      onStartDrag,
                    })
                  }
                >
                  <LedgerTableCell>
                    <p className="truncate font-sans text-lg font-bold">{character.name}</p>
                  </LedgerTableCell>
                  <LedgerTableCell className="whitespace-nowrap font-mono text-sm">
                    {character.level}
                  </LedgerTableCell>
                  <LedgerTableCell className="whitespace-nowrap font-mono text-sm">
                    {formatStats(character)}
                  </LedgerTableCell>
                  <LedgerTableCell className="whitespace-nowrap font-mono text-sm">
                    {role?.label ?? 'Open'}
                  </LedgerTableCell>
                  <LedgerTableActionCell>
                    <Button variant="outline" size="sm" onClick={() => onEdit(character)}>
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={archivingCharacterId === character._id}
                      onClick={() => onArchive(character._id)}
                    >
                      {archivingCharacterId === character._id
                        ? 'Archiving...'
                        : 'Archive'}
                    </Button>
                  </LedgerTableActionCell>
                </tr>
              );
            })}
          </LedgerTableBody>
      </LedgerTable>

      {draggingCharacter && dragState ? (
        <DragPreviewRow
          character={draggingCharacter}
          roleLabel={
            officerRoleLabels.find(({ role }) => militia?.[role] === draggingCharacter._id)
              ?.label ?? 'Open'
          }
          dragState={dragState}
          archivingCharacterId={archivingCharacterId}
        />
      ) : null}
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

function getCharacterRowClassName(isDraggingRow: boolean, index: number) {
  const tone = getLedgerRowClassName(index);

  if (isDraggingRow) {
    return `${tone} cursor-grabbing opacity-25`;
  }

  return `${tone} cursor-grab transition-colors hover:bg-background/24 active:cursor-grabbing`;
}

function DragPreviewRow({
  character,
  roleLabel,
  dragState,
  archivingCharacterId,
}: {
  character: CharacterRecord;
  roleLabel: string;
  dragState: PointerCardDragState<CharacterId>;
  archivingCharacterId?: CharacterId;
}) {
  return (
    <div
      className="border-primary bg-card border-2 shadow-2xl"
      style={getPointerCardDragStyle(dragState)}
    >
      <div className="grid grid-cols-[25%_max-content_max-content_max-content_11rem] gap-3 px-3 py-3">
        <p className="truncate font-sans text-lg font-bold">{character.name}</p>
        <p className="font-mono text-sm">{character.level}</p>
        <p className="font-mono text-sm">{formatStats(character)}</p>
        <p className="font-mono text-sm">{roleLabel}</p>
        <div className="flex flex-nowrap justify-end gap-2 whitespace-nowrap">
          <Button variant="outline" size="sm">
            Edit
          </Button>
          <Button variant="outline" size="sm" disabled={archivingCharacterId === character._id}>
            {archivingCharacterId === character._id ? 'Archiving...' : 'Archive'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatStats(character: CharacterRecord) {
  return [
    `STR ${character.strength}`,
    `DEX ${character.dexterity}`,
    `CON ${character.constitution}`,
    `INT ${character.intelligence}`,
    `WIS ${character.wisdom}`,
    `CHA ${character.charisma}`,
  ].join('  ');
}
