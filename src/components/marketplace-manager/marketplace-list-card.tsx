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
    <div className="grid grid-cols-1 gap-3">
      {marketplaces.map((marketplace) => (
        <Card
          key={marketplace._id}
          className="bg-card border-2 border-x-0 border-t-0 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-sans text-xl font-bold">{marketplace.label}</h3>
                <Badge variant="outline" className="font-mono text-xs">
                  {marketplace.isActive ? 'Active' : 'Expired'}
                </Badge>
                <Badge variant="outline" className="font-mono text-xs">
                  {formatMarketplaceSourceAction(marketplace.sourceAction)}
                </Badge>
              </div>
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
                {marketplace.activeUntilWeek}
                {' • Pending deliveries: '}
                {marketplace.pendingOrderCount}
                {marketplace.contrabandAllowed ? ' • Contraband allowed' : ''}
              </p>
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
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onEdit(marketplace)}>
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(marketplace)}
                disabled={pendingDeleteId === marketplace._id}
              >
                {pendingDeleteId === marketplace._id ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
