import { redirect } from 'next/navigation';
import { decodeCampaignId } from '~/components/campaign-shell/legacy-redirect';
import { campaignPath } from '~/lib/campaign-routes';

// Corrections happen in place on Militia; no separate correction page exists.
export default async function MilitiaCorrectPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  redirect(campaignPath(decodeCampaignId(campaignId), 'militia'));
}
