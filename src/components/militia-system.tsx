'use client';

import type { IMilitia } from '~/lib/types';
import { Button } from './ui/button';
import { useMutation } from 'convex/react';
import { api as db } from '@convex/_generated/api';
import { useOrganization } from '@clerk/nextjs';
import type { Doc } from '@convex/_generated/dataModel';
import { WeekBoard } from './week-board';

export function MilitiaSystem({
  militia,
  campaign,
}: {
  militia?: IMilitia;
  campaign?: Doc<'campaign'>;
}) {
  const createMilitia = useMutation(db.militia.createMilitia);
  const orgId = useOrganization().organization?.id;
  if (!campaign) {
    return null;
  }
  if (!militia) {
    return (
      <Button
        onClick={() =>
          createMilitia({
            militia: {
              name: 'Lantmäteriet',
              campaignId: campaign._id,
              rank: 1,
              highestBoonReached: 1,
              HQLocation: 'Southern Fangwood',
              treasury: 0,
              notoriety: 0,
              training: 0,
              focus: 'Secrecy',
            },
            organizationId: orgId ?? 'skip',
          })
        }
      >
        Create Militia
      </Button>
    );
  }
  return (
    <WeekBoard
      campaignId={campaign?._id}
      organizationId={orgId ?? ''}
      canQuery={Boolean(orgId)}
    />
  );
}
