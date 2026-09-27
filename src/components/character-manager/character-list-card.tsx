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
import { formatCharacterKind } from '~/lib/character-kind';
import type { CharacterId, CharacterRecord } from './types';

export function CharacterListCard({
  activeCharacters,
  onEdit,
  onArchive,
  archivingCharacterId,
}: {
  activeCharacters: CharacterRecord[];
  onEdit: (character: CharacterRecord) => void;
  onArchive: (characterId: CharacterId) => void;
  archivingCharacterId?: CharacterId;
}) {
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
      <p className="font-mono text-sm font-bold tracking-wide">
        Active Characters
      </p>

      <LedgerTable>
        <colgroup>
          <col style={{ width: '25%' }} />
          <col />
          <col />
          <col />
          <col style={{ width: '11rem' }} />
        </colgroup>
        <LedgerTableHead>
          <tr className="border-primary/8 border-b">
            <LedgerTableHeaderCell>Character</LedgerTableHeaderCell>
            <LedgerTableHeaderCell className="w-px whitespace-nowrap">
              Level
            </LedgerTableHeaderCell>
            <LedgerTableHeaderCell className="w-px whitespace-nowrap">
              Stats
            </LedgerTableHeaderCell>
            <LedgerTableHeaderCell className="w-px whitespace-nowrap">
              Kind
            </LedgerTableHeaderCell>
            <LedgerTableHeaderCell className="w-[11rem]" />
          </tr>
        </LedgerTableHead>
        <LedgerTableBody>
          {activeCharacters.map((character, index) => {
            return (
              <tr
                key={character._id}
                data-slot="card"
                className={getLedgerRowClassName(index)}
              >
                <LedgerTableCell>
                  <p className="truncate font-sans text-lg font-bold">
                    {character.name}
                  </p>
                </LedgerTableCell>
                <LedgerTableCell className="font-mono text-sm whitespace-nowrap">
                  {character.level}
                </LedgerTableCell>
                <LedgerTableCell className="font-mono text-sm whitespace-nowrap">
                  {formatStats(character)}
                </LedgerTableCell>
                <LedgerTableCell className="font-mono text-sm whitespace-nowrap">
                  {formatCharacterKind(character.kind)}
                </LedgerTableCell>
                <LedgerTableActionCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(character)}
                  >
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
