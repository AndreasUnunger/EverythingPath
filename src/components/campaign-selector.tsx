import type { Id } from '@convex/_generated/dataModel';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';

type Props = {
  campaigns:
    | {
        _id: Id<'campaign'>;
        _creationTime: number;
        name: string;
        ownerId: string;
        description: string;
        organizationId: string;
      }[]
    | undefined;
  selectedCampaign: Id<'campaign'> | undefined;
  setSelectedCampaign: (value: Id<'campaign'>) => void;
};

export default function CampaignSelector({
  campaigns,
  selectedCampaign,
  setSelectedCampaign,
}: Props) {
  return (
    <div className="flex w-full items-center gap-3">
      <span className="text-muted-foreground font-mono text-sm tracking-wider">
        ACTIVE CAMPAIGN:
      </span>
      <Select
        value={selectedCampaign}
        onValueChange={(event) => setSelectedCampaign(event as Id<'campaign'>)}
      >
        <SelectTrigger
          aria-label="Active campaign"
          className="border-primary bg-card w-full max-w-[320px] border-2 font-mono text-base tracking-wider"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="border-primary bg-card border-2 font-mono">
          {!campaigns ? (
            <p>Loading Campaigns...</p>
          ) : (
            campaigns.map((campaign) => (
              <SelectItem
                key={campaign._id}
                value={campaign._id}
                className="hover:bg-primary/20 cursor-pointer font-mono text-base tracking-wider"
              >
                <div className="flex items-center justify-between gap-4">
                  <span>{campaign.name}</span>
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
