import {
  BicepsFlexed,
  Calendar,
  ChartNoAxesCombined,
  Coins,
  Dumbbell,
  HandCoins,
  MapPin,
  Target,
} from 'lucide-react';
import { CampaignInfoCard } from './ui/campaignInfoCard';
import type { Doc } from '@convex/_generated/dataModel';
import type { WithoutSystemFields } from 'convex/server';
import { formatFantasyDate } from '~/helpers/ARDateConverter';

export function CampaignInfo({
  campaign,
}: {
  campaign: WithoutSystemFields<Doc<'campaign'>> | undefined;
}) {
  if (!campaign) {
    return null;
  }

  const campaignDate = campaign.inGameDate
    ? formatFantasyDate(new Date(campaign.inGameDate))
    : '';

  return (
    <div className="space-y-2 pb-4">
      {/* Campaign Stats */}
      <div className="grid gap-2 sm:grid-cols-4 2xl:grid-cols-8">
        <CampaignInfoCard title="Date" value={campaignDate}>
          <Calendar className="h-4 w-4" />
        </CampaignInfoCard>

        <CampaignInfoCard title="Rank" value={'47'}>
          <ChartNoAxesCombined className="h-4 w-4" />
        </CampaignInfoCard>

        <CampaignInfoCard title="Training" value={'5'}>
          <BicepsFlexed className="h-4 w-4" />
        </CampaignInfoCard>

        <CampaignInfoCard title="Next rank at Training" value={'5'}>
          <Dumbbell className="h-4 w-4" />
        </CampaignInfoCard>

        <CampaignInfoCard title="HQ Location" value={'Phaendar'}>
          <MapPin className="h-4 w-4" />
        </CampaignInfoCard>

        <CampaignInfoCard title="Focus" value={'Secrecy'}>
          <Target className="h-4 w-4" />
        </CampaignInfoCard>

        <CampaignInfoCard title="Treasury" value={'400gp'}>
          <Coins className="h-4 w-4" />
        </CampaignInfoCard>

        <CampaignInfoCard title="Minimun Treasury" value={'5'}>
          <HandCoins className="h-4 w-4" />
        </CampaignInfoCard>
      </div>
    </div>
  );
}
