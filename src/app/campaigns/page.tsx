'use client';

import { useOrganization } from '@clerk/nextjs';
import { useQuery } from 'convex-helpers/react/cache';
import { api as db } from '@convex/_generated/api';
import CreateCampaignDialog from './CreateCampaignDialog';

export default function Home() {
  const { organization } = useOrganization();
  const campaigns = useQuery(
    db.campaign.getCampaigns,
    !!organization?.id ? { organizationId: organization.id } : 'skip',
  );

  return (
    <main className="container mx-auto pt-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Campaigns</h1>
        <CreateCampaignDialog />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
        {campaigns?.map((campaign) => {
          return <div key={campaign._id}>{campaign.name}</div>;
        })}
      </div>
    </main>
  );
}
