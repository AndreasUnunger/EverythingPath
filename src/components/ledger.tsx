import { CharacterManager } from './character-manager';
import { TeamManager } from './teamManager';

export function Ledger({
  selectedCampaignId,
}: {
  selectedCampaignId: string | undefined;
}) {
  return (
    <div className="flex columns-1 flex-col gap-4">
      <CharacterManager />
      <TeamManager selectedCampaignId={selectedCampaignId} />
    </div>
  );
}
