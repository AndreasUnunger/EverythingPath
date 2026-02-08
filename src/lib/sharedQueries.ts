import { convexQuery } from '@convex-dev/react-query';
import { api as db } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useQuery } from '@tanstack/react-query';

export function militiaQuery(
  campaignId: Id<'campaign'> | undefined,
  orgId: string | undefined,
) {
  return useQuery({
    ...convexQuery(db.militia.getMilitia, {
      campaignId: campaignId!,
      organizationId: orgId!,
    }),
    enabled: !!campaignId && !!orgId,
  });
}

export function campaignQuery(orgId: string | undefined) {
  return useQuery({
    ...convexQuery(db.campaign.getCampaigns, {
      organizationId: orgId ?? '',
    }),
    enabled: !!orgId,
  });
}
