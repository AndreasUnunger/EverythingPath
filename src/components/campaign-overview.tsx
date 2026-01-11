'use client';

import { Card } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import type { WithoutSystemFields } from 'convex/server';
import type { Doc } from '@convex/_generated/dataModel';

type Props = {
  campaign: WithoutSystemFields<Doc<'campaign'>> | undefined;
};

export function CampaignOverview({ campaign }: Props) {
  return (
    <Card className="bg-card corner-brackets p-4">
      <h2 className="text-primary mb-3 font-sans text-2xl font-bold">
        {campaign?.name ?? null}
      </h2>
      <div className="space-y-3">
        <div>
          <h3 className="text-muted-foreground mb-1 font-mono text-sm">
            STATUS
          </h3>
          <Badge className="bg-primary/20 text-primary border-primary/50">
            Active - Book 1
          </Badge>
        </div>
        <div>
          <h3 className="text-muted-foreground mb-1 font-mono text-sm">
            DESCRIPTION
          </h3>
          <p className="text-foreground font-mono text-sm">
            {campaign?.description ?? null}
          </p>
        </div>
      </div>
    </Card>
  );
}
