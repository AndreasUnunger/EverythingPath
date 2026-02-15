import type { Id } from '@convex/_generated/dataModel';
import { CharacterManager } from './character-manager';
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
      <CharacterManager />
      <TeamManager
        selectedCampaignId={selectedCampaignId}
        organizationId={organizationId}
        canQuery={canQuery}
      />
    </div>
  );
}
