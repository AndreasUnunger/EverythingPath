import {
  LedgerTable,
  LedgerTableActionCell,
  LedgerTableBody,
  LedgerTableCell,
  LedgerTableHead,
  LedgerTableHeaderCell,
  LedgerTableRow,
} from '~/components/ledger-table';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import type { SettlementRecord } from './types';

function formatSignedNumber(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

export function SettlementListCard({
  settlements,
  onEdit,
  onDelete,
  pendingDeleteId,
}: {
  settlements: SettlementRecord[];
  onEdit: (settlement: SettlementRecord) => void;
  onDelete: (settlement: SettlementRecord) => void;
  pendingDeleteId?: string;
}) {
  if (settlements.length === 0) {
    return (
      <Card className="bg-card border-2 p-4">
        <p className="text-muted-foreground font-mono text-sm">
          No tracked settlements yet. Add one here before targeting it from week
          actions.
        </p>
      </Card>
    );
  }

  return (
    <LedgerTable>
        <colgroup>
          <col style={{ width: '28%' }} />
          <col />
          <col />
          <col />
          <col style={{ width: '11rem' }} />
        </colgroup>
        <LedgerTableHead>
          <tr className="border-b border-primary/8">
            <LedgerTableHeaderCell>
              Settlement
            </LedgerTableHeaderCell>
            <LedgerTableHeaderCell>
              Reputation
            </LedgerTableHeaderCell>
            <LedgerTableHeaderCell>
              Security
            </LedgerTableHeaderCell>
            <LedgerTableHeaderCell>
              Notes
            </LedgerTableHeaderCell>
            <LedgerTableHeaderCell className="w-[11rem]" />
          </tr>
        </LedgerTableHead>
        <LedgerTableBody>
          {settlements.map((settlement, index) => (
            <LedgerTableRow key={settlement._id} index={index}>
              <LedgerTableCell>
                <p className="font-sans text-xl font-bold">{settlement.settlementKey}</p>
              </LedgerTableCell>
              <LedgerTableCell>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {settlement.reputation}
                  </Badge>
                </div>
              </LedgerTableCell>
              <LedgerTableCell>
                <Badge variant="outline" className="font-mono text-xs">
                  {settlement.isSecured ? 'Secured' : 'Unsecured'}
                </Badge>
              </LedgerTableCell>
              <LedgerTableCell>
                <div className="space-y-1">
                  <p className="text-muted-foreground font-mono text-sm">
                    {settlement.temporaryShift
                      ? `Temporary reputation modifier ${formatSignedNumber(settlement.temporaryShift)}`
                      : 'No temporary reputation modifier'}
                  </p>
                  {settlement.refugeActiveUntilWeek ? (
                    <p className="text-muted-foreground font-mono text-sm">
                      Active refuge through week {settlement.refugeActiveUntilWeek}
                    </p>
                  ) : null}
                </div>
              </LedgerTableCell>
              <LedgerTableActionCell>
                <Button variant="outline" size="sm" onClick={() => onEdit(settlement)}>
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(settlement)}
                  disabled={pendingDeleteId === settlement._id}
                >
                  {pendingDeleteId === settlement._id ? 'Deleting...' : 'Delete'}
                </Button>
              </LedgerTableActionCell>
            </LedgerTableRow>
          ))}
        </LedgerTableBody>
    </LedgerTable>
  );
}
