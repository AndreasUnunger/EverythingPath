import type { Id } from '@convex/_generated/dataModel';
import { CharacterManager } from './character-manager';
import { MarketplaceLedger } from './marketplace-ledger';
import { SettlementManager } from './settlement-manager';
import { TeamManager } from './teamManager';

export function Ledger({
  selectedCampaignId,
  organizationId,
  canQuery,
}: {
  selectedCampaignId: Id<'campaign'> | undefined;
  organizationId: string;
  canQuery: boolean;
}) {
  return (
    <div className="flex columns-1 flex-col gap-4">
      <CharacterManager
        selectedCampaignId={selectedCampaignId}
        organizationId={organizationId}
        canQuery={canQuery}
      />
      <SettlementManager
        selectedCampaignId={selectedCampaignId}
        organizationId={organizationId}
        canQuery={canQuery}
      />
      <MarketplaceLedger
        selectedCampaignId={selectedCampaignId}
        organizationId={organizationId}
        canQuery={canQuery}
      />
      <TeamManager
        selectedCampaignId={selectedCampaignId}
        organizationId={organizationId}
        canQuery={canQuery}
      />
    </div>
  );
}
