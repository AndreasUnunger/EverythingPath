'use client';
import { CanonicalCampaignDashboard } from './canonical-campaign-dashboard';

// Maintenance no longer hides the list: the shell shows a non-blocking banner
// and writes fail through their ordinary feedback.
export function CampaignDashboard() {
  return <CanonicalCampaignDashboard />;
}
