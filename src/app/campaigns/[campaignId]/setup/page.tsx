'use client';
import { useCampaign } from '~/components/campaign-shell/campaign-context';
import { MilitiaSetupScreen } from '~/components/militia-setup/screen';

export default function SetupPage() {
  const { campaign } = useCampaign();
  return <MilitiaSetupScreen campaign={campaign._id} />;
}
