'use client';

import { Card } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Calendar, MapPin, Users, Trophy } from 'lucide-react';
import type { WithoutSystemFields } from 'convex/server';
import type { Doc } from '@convex/_generated/dataModel';
import type { ReactNode } from 'react';

type Props = {
  campaign: WithoutSystemFields<Doc<'campaign'>> | undefined;
};

function CampaignInfoCard({
  title,
  value,
  children,
}: {
  title: string;
  value: string | number;
  children: ReactNode;
}) {
  return (
    <Card className="bg-card corner-brackets p-2">
      <div className="flex items-center justify-between px-2">
        <div>
          <span className="text-muted-foreground pr-2 font-mono">{title}</span>
          <span className="text-primary font-mono font-bold">{value}</span>
        </div>
        {children}
      </div>
    </Card>
  );
}

export function CampaignOverview({ campaign }: Props) {
  return (
    <div className="space-y-2">
      {/* Campaign Stats */}
      <div className="grid grid-cols-1 space-x-2 md:grid-cols-4">
        <CampaignInfoCard title="Session" value={12}>
          <Calendar className="text-primary/50 h-4 w-4" />
        </CampaignInfoCard>

        <CampaignInfoCard title="Location" value={'Phaendar'}>
          <MapPin className="text-primary/50 h-4 w-4" />
        </CampaignInfoCard>

        <CampaignInfoCard title="Milita size" value={'47'}>
          <Users className="text-primary/50 h-4 w-4" />
        </CampaignInfoCard>

        <CampaignInfoCard title="Victories" value={'5'}>
          <Trophy className="text-primary/50 h-4 w-4" />
        </CampaignInfoCard>
      </div>

      {/* Campaign Info */}
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
    </div>
  );
}
