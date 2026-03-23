'use client';

import type { Id } from '@convex/_generated/dataModel';
import { Badge } from '~/components/ui/badge';
import { Card } from '~/components/ui/card';
import { marketplaceLedgerQuery, militiaQuery } from '~/lib/sharedQueries';
import {
  formatMarketplaceAvailabilityTier,
  formatMarketplaceSourceAction,
} from '~/lib/militia-marketplace-rules';

export function MarketplaceLedger({
  selectedCampaignId,
  organizationId,
  canQuery,
}: {
  selectedCampaignId: Id<'campaign'> | undefined;
  organizationId: string;
  canQuery: boolean;
}) {
  const { data: militia, isLoading: isLoadingMilitia } = militiaQuery(
    selectedCampaignId,
    organizationId,
    canQuery,
  );
  const { data: marketplaceLedger, isLoading } = marketplaceLedgerQuery(
    selectedCampaignId,
    organizationId,
    canQuery,
  );

  if (!selectedCampaignId) {
    return (
      <p className="text-muted-foreground font-mono text-sm">
        Select a campaign to review marketplaces.
      </p>
    );
  }

  if (!canQuery) {
    return (
      <p className="text-muted-foreground font-mono text-sm">
        Waiting for organization access sync...
      </p>
    );
  }

  if (isLoadingMilitia) {
    return (
      <p className="text-muted-foreground font-mono text-sm">
        Loading militia...
      </p>
    );
  }

  if (!militia) {
    return (
      <p className="text-muted-foreground font-mono text-sm">
        Create a militia to track marketplaces.
      </p>
    );
  }

  const marketplaces = marketplaceLedger?.marketplaces ?? [];
  const currentWeek = marketplaceLedger?.currentWeek;
  const activeCount = marketplaces.filter((marketplace) => marketplace.isActive).length;

  return (
    <div className="space-y-4">
      <div className="bg-card border-2 border-b-0 p-4">
        <h2 className="text-primary font-sans text-2xl font-bold">
          Marketplace Ledger
        </h2>
        <p className="text-muted-foreground mt-1 font-mono text-sm">
          {isLoading
            ? 'Loading...'
            : `${marketplaces.length} tracked marketplace${marketplaces.length === 1 ? '' : 's'} • ${activeCount} active${currentWeek ? ` in week ${currentWeek}` : ''}`}
        </p>
        <p className="text-muted-foreground mt-1 font-mono text-xs">
          Review active and expired marketplaces here without opening the week board.
        </p>
      </div>

      {marketplaces.length === 0 ? (
        <Card className="bg-card border-2 p-4">
          <p className="text-muted-foreground font-mono text-sm">
            No tracked marketplaces yet. Brokered markets and black markets will
            appear here once the militia creates them.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {marketplaces.map((marketplace) => (
            <Card
              key={marketplace._id}
              className="bg-card border-2 border-x-0 border-t-0 p-4"
            >
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
                  Team: {marketplace.teamId} • {formatMarketplaceAvailabilityTier(marketplace.availabilityTier)} • Availability {marketplace.availabilityThreshold}% • Sale value {marketplace.saleValuePercent}%
                </p>
                <p className="text-muted-foreground font-mono text-sm">
                  Active through week {marketplace.activeUntilWeek} • Pending deliveries:{' '}
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
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
