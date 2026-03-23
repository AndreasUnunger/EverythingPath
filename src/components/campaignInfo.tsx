import {
  BicepsFlexed,
  Calendar,
  ChartNoAxesCombined,
  Coins,
  Dumbbell,
  HandCoins,
  MapPin,
  Package,
  Store,
  Target,
} from 'lucide-react';
import type { Doc } from '@convex/_generated/dataModel';
import type { WithoutSystemFields } from 'convex/server';
import { formatFantasyDate } from '~/helpers/ARDateConverter';
import type { IMarketplaceLedgerState, IMilitia } from '~/lib/types';
import {
  getMinimumTrainingForRank,
  getMinimumTreasuryForRank,
} from '~/lib/militia-progression-rules';
import {
  formatMarketplaceAvailabilityTier,
  formatMarketplaceSourceAction,
} from '~/lib/militia-marketplace-rules';
import { Card } from './ui/card';
import { CampaignInfoCard } from './ui/campaignInfoCard';

export function CampaignInfo({
  campaign,
  militia,
  marketplaceLedger,
}: {
  campaign: WithoutSystemFields<Doc<'campaign'>> | undefined;
  militia?: IMilitia | null;
  marketplaceLedger?: IMarketplaceLedgerState;
}) {
  if (!campaign) {
    return null;
  }

  const campaignDate = campaign.inGameDate
    ? formatFantasyDate(new Date(campaign.inGameDate))
    : '';
  const nextRankTraining = militia
    ? getMinimumTrainingForRank(militia.rank + 1)
    : undefined;
  const minimumTreasury = militia
    ? getMinimumTreasuryForRank(militia.rank)
    : undefined;
  const activeMarketplaces =
    marketplaceLedger?.marketplaces.filter((marketplace) => marketplace.isActive) ?? [];
  const inactiveMarketplacesCount =
    (marketplaceLedger?.marketplaces.length ?? 0) - activeMarketplaces.length;
  const pendingMarketplaceOrders = activeMarketplaces.reduce(
    (sum, marketplace) => sum + marketplace.pendingOrderCount,
    0,
  );

  return (
    <div className="space-y-2 pb-4">
      <div className="grid gap-2 sm:grid-cols-5 2xl:grid-cols-10">
        <CampaignInfoCard title="Date" value={campaignDate}>
          <Calendar className="h-4 w-4" />
        </CampaignInfoCard>

        <CampaignInfoCard title="Rank" value={militia?.rank ?? '—'}>
          <ChartNoAxesCombined className="h-4 w-4" />
        </CampaignInfoCard>

        <CampaignInfoCard title="Training" value={militia?.training ?? '—'}>
          <BicepsFlexed className="h-4 w-4" />
        </CampaignInfoCard>

        <CampaignInfoCard
          title="Next rank at Training"
          value={nextRankTraining ?? 'Max'}
        >
          <Dumbbell className="h-4 w-4" />
        </CampaignInfoCard>

        <CampaignInfoCard title="HQ Location" value={militia?.HQLocation ?? '—'}>
          <MapPin className="h-4 w-4" />
        </CampaignInfoCard>

        <CampaignInfoCard title="Focus" value={militia?.focus ?? 'Unset'}>
          <Target className="h-4 w-4" />
        </CampaignInfoCard>

        <CampaignInfoCard
          title="Treasury"
          value={militia ? `${militia.treasury} gp` : '—'}
        >
          <Coins className="h-4 w-4" />
        </CampaignInfoCard>

        <CampaignInfoCard
          title="Minimum Treasury"
          value={minimumTreasury !== undefined ? `${minimumTreasury} gp` : '—'}
        >
          <HandCoins className="h-4 w-4" />
        </CampaignInfoCard>

        <CampaignInfoCard title="Active Markets" value={activeMarketplaces.length}>
          <Store className="h-4 w-4" />
        </CampaignInfoCard>

        <CampaignInfoCard
          title="Pending Deliveries"
          value={pendingMarketplaceOrders}
        >
          <Package className="h-4 w-4" />
        </CampaignInfoCard>
      </div>

      {marketplaceLedger && marketplaceLedger.marketplaces.length > 0 ? (
        <Card className="bg-card border-2 p-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-sans text-xl font-bold">Tracked Marketplaces</h2>
                <p className="text-muted-foreground font-mono text-sm">
                  {activeMarketplaces.length > 0
                    ? `Active in week ${marketplaceLedger.currentWeek ?? 'now'}`
                    : `No active marketplaces${marketplaceLedger.currentWeek ? ` in week ${marketplaceLedger.currentWeek}` : ''}`}
                </p>
              </div>
              {inactiveMarketplacesCount > 0 ? (
                <p className="text-muted-foreground font-mono text-xs">
                  {inactiveMarketplacesCount} inactive still tracked in ledger
                </p>
              ) : null}
            </div>

            {activeMarketplaces.length > 0 ? (
              <div className="grid gap-2 md:grid-cols-2">
                {activeMarketplaces.map((marketplace) => (
                  <div
                    key={marketplace._id}
                    className="border-primary/40 bg-card border-2 p-2"
                  >
                    <p className="font-mono text-sm font-bold">{marketplace.label}</p>
                    <p className="text-muted-foreground font-mono text-xs">
                      {formatMarketplaceSourceAction(marketplace.sourceAction)} •{' '}
                      {formatMarketplaceAvailabilityTier(marketplace.availabilityTier)} •{' '}
                      {marketplace.teamId}
                    </p>
                    <p className="text-muted-foreground font-mono text-xs">
                      Through week {marketplace.activeUntilWeek} • Pending deliveries:{' '}
                      {marketplace.pendingOrderCount}
                      {marketplace.contrabandAllowed ? ' • Contraband' : ''}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
