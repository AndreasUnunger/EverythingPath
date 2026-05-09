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
import type { ITrackedMarketplace } from '~/lib/types';
import {
  formatMarketplaceAvailabilityTier,
  formatMarketplaceSourceAction,
} from '~/lib/militia-marketplace-rules';
import { formatTeamIdLabel, isTeamId } from '~/lib/team-ids';

export function MarketplaceListCard({
  marketplaces,
  onEdit,
  onDelete,
  pendingDeleteId,
}: {
  marketplaces: ITrackedMarketplace[];
  onEdit: (marketplace: ITrackedMarketplace) => void;
  onDelete: (marketplace: ITrackedMarketplace) => void;
  pendingDeleteId?: string;
}) {
  if (marketplaces.length === 0) {
    return (
      <Card className="bg-card border-2 p-4">
        <p className="text-muted-foreground font-mono text-sm">
          No tracked marketplaces yet. Add one here for mid-campaign setup or
          to correct table state.
        </p>
      </Card>
    );
  }

  return (
    <LedgerTable>
      <colgroup>
        <col style={{ width: '24%' }} />
        <col />
        <col />
        <col />
        <col style={{ width: '11rem' }} />
      </colgroup>
      <LedgerTableHead>
        <tr className="border-b border-primary/8">
          <LedgerTableHeaderCell>Marketplace</LedgerTableHeaderCell>
          <LedgerTableHeaderCell>Source</LedgerTableHeaderCell>
          <LedgerTableHeaderCell>Availability</LedgerTableHeaderCell>
          <LedgerTableHeaderCell>Orders</LedgerTableHeaderCell>
          <LedgerTableHeaderCell className="w-[11rem]" />
        </tr>
      </LedgerTableHead>
      <LedgerTableBody>
        {marketplaces.map((marketplace, index) => {
          const isDeleting = pendingDeleteId === marketplace._id;

          return (
            <LedgerTableRow key={marketplace._id} index={index}>
              <LedgerTableCell>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-sans text-xl font-bold">{marketplace.label}</h3>
                    <Badge variant="outline" className="font-mono text-xs">
                      {marketplace.isActive ? 'Active' : 'Expired'}
                    </Badge>
                  </div>
                  {marketplace.marketDayDiscountPercent ? (
                    <p className="text-muted-foreground font-mono text-sm">
                      Market Day discount +{marketplace.marketDayDiscountPercent}% applied
                      {marketplace.marketDayAppliedWeek
                        ? ` in week ${marketplace.marketDayAppliedWeek}`
                        : ''}
                    </p>
                  ) : null}
                  {marketplace.notes ? (
                    <p className="text-muted-foreground font-mono text-sm">
                      Notes: {marketplace.notes}
                    </p>
                  ) : null}
                </div>
              </LedgerTableCell>
              <LedgerTableCell>
                <div className="space-y-1">
                  <Badge variant="outline" className="font-mono text-xs">
                    {formatMarketplaceSourceAction(marketplace.sourceAction)}
                  </Badge>
                  <p className="text-muted-foreground font-mono text-sm">
                    Team:{' '}
                    {isTeamId(marketplace.teamId)
                      ? formatTeamIdLabel(marketplace.teamId)
                      : marketplace.teamId}{' '}
                    • {formatMarketplaceAvailabilityTier(marketplace.availabilityTier)} •
                    Availability {marketplace.availabilityThreshold}% • Sale value{' '}
                    {marketplace.saleValuePercent}%
                  </p>
                  <p className="text-muted-foreground font-mono text-sm">
                    Created week {marketplace.createdWeek} • Active through week{' '}
                    {marketplace.activeUntilWeek} • Pending deliveries:{' '}
                    {marketplace.pendingOrderCount}
                    {marketplace.contrabandAllowed ? ' • Contraband allowed' : ''}
                  </p>
                </div>
              </LedgerTableCell>
              <LedgerTableCell>
                <div className="space-y-1">
                  <p className="text-muted-foreground font-mono text-sm">
                    Availability window and price profile
                  </p>
                </div>
              </LedgerTableCell>
              <LedgerTableCell>
                <div className="space-y-1">
                  <p className="font-mono text-sm font-bold">Linked Orders</p>
                  {marketplace.orders.length > 0 ? (
                    <ul className="space-y-1">
                      {marketplace.orders.map((order) => (
                        <li
                          key={order._id}
                          className="text-muted-foreground font-mono text-sm"
                        >
                          {order.description} • {order.status} • due week {order.dueWeek}
                          {order.costPaid !== undefined ? ` • ${order.costPaid} gp` : ''}
                          {order.deliveredWeek ? ` • delivered week ${order.deliveredWeek}` : ''}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground font-mono text-sm">
                      No linked orders.
                    </p>
                  )}
                </div>
              </LedgerTableCell>
              <LedgerTableActionCell>
                <Button variant="outline" size="sm" onClick={() => onEdit(marketplace)}>
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(marketplace)}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
              </LedgerTableActionCell>
            </LedgerTableRow>
          );
        })}
      </LedgerTableBody>
    </LedgerTable>
  );
}
