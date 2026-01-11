'use client';

import { Card } from '~/components/ui/card';
import type { IMilitia } from '~/lib/types';
import { Button } from './ui/button';
import { useMutation } from 'convex/react';
import { api as db } from '@convex/_generated/api';
import { useOrganization } from '@clerk/nextjs';
import type { Doc } from '@convex/_generated/dataModel';

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
    <div>
      {/* Militia Resources */}
      <Card className="bg-card border-2 border-x-0 border-b-0 p-4">
        <h3 className="text-primary mb-3 font-sans text-lg font-bold">
          Available Resources
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4">
          <div className="bg-secondary border-2 border-r border-b p-4 text-center">
            <p className="text-primary font-mono text-2xl font-bold">
              {militia?.treasury}
            </p>
            <p className="text-muted-foreground font-mono text-sm">Supplies</p>
          </div>
          <div className="bg-secondary border-2 border-r border-b p-4 text-center md:border-r">
            <p className="text-primary font-mono text-2xl font-bold">18</p>
            <p className="text-muted-foreground font-mono text-sm">Weapons</p>
          </div>
          <div className="bg-secondary border-2 border-r border-b p-4 text-center">
            <p className="text-primary font-mono text-2xl font-bold">12</p>
            <p className="text-muted-foreground font-mono text-sm">
              Armor Sets
            </p>
          </div>
          <div className="bg-secondary border-2 border-b p-4 text-center">
            <p className="text-primary font-mono text-2xl font-bold">5</p>
            <p className="text-muted-foreground font-mono text-sm">Healers</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
