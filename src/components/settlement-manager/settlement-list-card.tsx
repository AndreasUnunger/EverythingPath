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
}: {
  settlements: SettlementRecord[];
  onEdit: (settlement: SettlementRecord) => void;
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
    <div className="grid grid-cols-1 gap-3">
      {settlements.map((settlement) => (
        <SettlementRow
          key={settlement._id}
          settlement={settlement}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}

function SettlementRow({
  settlement,
  onEdit,
}: {
  settlement: SettlementRecord;
  onEdit: (settlement: SettlementRecord) => void;
}) {
  return (
    <Card className="bg-card border-2 border-x-0 border-t-0 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-sans text-xl font-bold">{settlement.settlementKey}</h3>
            <Badge variant="outline" className="font-mono text-xs">
              {settlement.reputation}
            </Badge>
            <Badge variant="outline" className="font-mono text-xs">
              {settlement.isSecured ? 'Secured' : 'Unsecured'}
            </Badge>
          </div>
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

        <Button variant="outline" size="sm" onClick={() => onEdit(settlement)}>
          Edit
        </Button>
      </div>
    </Card>
  );
}
