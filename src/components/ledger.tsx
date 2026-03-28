import type { Id } from '@convex/_generated/dataModel';
import { CharacterManager } from './character-manager';
import { MarketplaceLedger } from './marketplace-ledger';
import { MilitiaStateManager } from './militia-state-manager';
import { SettlementManager } from './settlement-manager';
import { TeamLedger } from './team-ledger';

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
    <div className="flex flex-col gap-4">
      <MilitiaStateManager
        selectedCampaignId={selectedCampaignId}
        organizationId={organizationId}
        canQuery={canQuery}
      />
      <CharacterManager
        selectedCampaignId={selectedCampaignId}
        organizationId={organizationId}
        canQuery={canQuery}
      />
      <TeamLedger
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
    </div>
  );
}
