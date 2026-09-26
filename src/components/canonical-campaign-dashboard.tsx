'use client';
import { useOrganization } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { campaignQuery } from '~/lib/sharedQueries';
import { campaignPath } from '~/lib/campaign-routes';
import { Card } from './ui/card';
import CampaignSelector from './campaign-selector';
import CreateCampaignDialog from '~/app/campaigns/createCampaignDialog';
import { FailedLoadCard } from './campaign-shell/failed-load';
import { CampaignHomeLinks } from './campaign-sections/campaign-home';

// Temporary list scaffold: the existing picker and create dialog, with the
// first campaign selected by default. Choosing a campaign opens its own
// address; the week editor is no longer embedded here.
export function CanonicalCampaignDashboard() {
  const { organization, isLoaded } = useOrganization();
  const { data, error, refetch } = campaignQuery(organization?.id, isLoaded);
  const router = useRouter();
  if (error)
    return (
      <FailedLoadCard
        noun="Campaigns"
        retry={() => {
          void refetch();
        }}
      />
    );
  if (!isLoaded || !data) return <p role="status">Loading campaigns…</p>;
  if (data.state !== 'ready' || !organization)
    return (
      <Card className="p-4">Select an organization with campaign access.</Card>
    );
  const campaign = data.campaigns[0];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <CampaignSelector
          campaigns={data.campaigns}
          selectedCampaign={campaign?._id}
          setSelectedCampaign={(id) => router.push(campaignPath(id))}
        />
        <CreateCampaignDialog />
      </div>
      {campaign ? (
        <CampaignHomeLinks campaign={campaign} />
      ) : (
        <p>Create a campaign to get started.</p>
      )}
    </div>
  );
}
