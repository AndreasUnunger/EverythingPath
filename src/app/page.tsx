'use client';

import { useOrganization } from '@clerk/nextjs';
import { api as db } from '../../convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { Button } from '~/components/ui/button';

export default function Home() {
  const spellCount = useQuery(db.spell.getCount);
  const createCampaign = useMutation(db.campaign.createCampaign);
  const { organization } = useOrganization();
  const campaigns = useQuery(
    db.campaign.getCampaigns,
    !!organization?.id ? { organizationId: organization.id } : 'skip',
  );

  const onCreateCampaign = async () => {
    await createCampaign({
      name: 'ironfang',
      description: 'the one',
      ownerId: '',
      organizationId: organization?.id ?? 'skip',
    });
  };

  return (
    <main className="container mx-auto pt-24">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
        spellcount: {spellCount}
      </div>
      <Button onClick={() => onCreateCampaign()}>create campaign</Button>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
        {campaigns?.map((campaign) => {
          return <div key={campaign._id}>{campaign.name}</div>;
        })}
      </div>
      <div>{organization?.name}</div>
    </main>
  );
}
