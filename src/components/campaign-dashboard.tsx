'use client';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { CanonicalCampaignDashboard } from './canonical-campaign-dashboard';
import { Card } from './ui/card';

export function CampaignDashboard() {
  const mode = useQuery(api.cutover.status, {});
  if (mode === undefined) return <p role="status">Loading campaigns…</p>;
  if (mode !== 'canonical')
    return (
      <Card role="status" className="p-6">
        Campaign editing is paused for maintenance. Please try again shortly.
      </Card>
    );
  return <CanonicalCampaignDashboard />;
}
