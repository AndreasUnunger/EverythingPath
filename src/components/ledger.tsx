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
  const sharedProps = {
    selectedCampaignId,
    organizationId,
    canQuery,
  } as const;

  return (
    <div className="flex flex-col gap-4">
      <MilitiaStateManager {...sharedProps} />
      <CharacterManager {...sharedProps} />
      <TeamLedger {...sharedProps} />
      <SettlementManager {...sharedProps} />
      <MarketplaceLedger {...sharedProps} />
    </div>
  );
}
