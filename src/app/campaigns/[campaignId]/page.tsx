'use client';
import { useCampaign } from '~/components/campaign-shell/campaign-context';
import { CampaignHome } from '~/components/campaign-sections/campaign-home';

export default function CampaignHomePage() {
  const { campaign } = useCampaign();
  return <CampaignHome campaign={campaign} />;
}
