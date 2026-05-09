import { convexQuery } from '@convex-dev/react-query';
import { api as db } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useQuery } from '@tanstack/react-query';

function isCampaignScopedQueryEnabled({
  campaignId,
  orgId,
  enabled = true,
}: {
  campaignId: Id<'campaign'> | undefined;
  orgId: string | undefined;
  enabled?: boolean;
}) {
  return enabled && Boolean(campaignId) && Boolean(orgId);
}

export function militiaQuery(
  campaignId: Id<'campaign'> | undefined,
  orgId: string | undefined,
  enabled = true,
) {
  return useQuery({
    ...convexQuery(db.militia.getMilitia, {
      campaignId,
      organizationId: orgId ?? '',
    }),
    enabled: isCampaignScopedQueryEnabled({ campaignId, orgId, enabled }),
  });
}

export function campaignQuery(orgId: string | undefined, enabled = true) {
  return useQuery({
    ...convexQuery(db.campaign.getCampaigns, {
      organizationId: orgId,
    }),
    enabled,
  });
}

export function characterLedgerQuery(
  campaignId: Id<'campaign'> | undefined,
  orgId: string | undefined,
  enabled = true,
  includeInactive = false,
) {
  return useQuery({
    ...convexQuery(db.character.listByCampaign, {
      campaignId,
      organizationId: orgId,
      includeInactive,
    }),
    enabled: isCampaignScopedQueryEnabled({ campaignId, orgId, enabled }),
  });
}

export function settlementLedgerQuery(
  campaignId: Id<'campaign'> | undefined,
  orgId: string | undefined,
  enabled = true,
) {
  return useQuery({
    ...convexQuery(db.militia.listSettlements, {
      campaignId,
      organizationId: orgId,
    }),
    enabled: isCampaignScopedQueryEnabled({ campaignId, orgId, enabled }),
  });
}

export function marketplaceLedgerQuery(
  campaignId: Id<'campaign'> | undefined,
  orgId: string | undefined,
  enabled = true,
) {
  return useQuery({
    ...convexQuery(db.militia.listMarketplaces, {
      campaignId,
      organizationId: orgId,
    }),
    enabled: isCampaignScopedQueryEnabled({ campaignId, orgId, enabled }),
  });
}

export function militiaStateSetupQuery(
  campaignId: Id<'campaign'> | undefined,
  orgId: string | undefined,
  enabled = true,
) {
  return useQuery({
    ...convexQuery(db.militia.getMilitiaStateSetup, {
      campaignId,
      organizationId: orgId,
    }),
    enabled: isCampaignScopedQueryEnabled({ campaignId, orgId, enabled }),
  });
}

export function weekBoardStateQuery(
  campaignId: Id<'campaign'> | undefined,
  orgId: string | undefined,
  enabled = true,
) {
  return useQuery({
    ...convexQuery(db.weekBoard.getWeekBoardState, {
      campaignId,
      organizationId: orgId,
    }),
    enabled: isCampaignScopedQueryEnabled({ campaignId, orgId, enabled }),
  });
}

export function weekBoardReferenceQuery(
  campaignId: Id<'campaign'> | undefined,
  orgId: string | undefined,
  enabled = true,
) {
  return useQuery({
    ...convexQuery(db.weekBoard.getWeekBoardReferenceData, {
      campaignId,
      organizationId: orgId,
    }),
    enabled: isCampaignScopedQueryEnabled({ campaignId, orgId, enabled }),
  });
}

export function weekBoardTrackedStateQuery(
  campaignId: Id<'campaign'> | undefined,
  orgId: string | undefined,
  enabled = true,
) {
  return useQuery({
    ...convexQuery(db.weekBoard.getWeekBoardTrackedState, {
      campaignId,
      organizationId: orgId,
    }),
    enabled: isCampaignScopedQueryEnabled({ campaignId, orgId, enabled }),
  });
}

export function weekBoardLiveStateQuery(
  campaignId: Id<'campaign'> | undefined,
  orgId: string | undefined,
  enabled = true,
) {
  return useQuery({
    ...convexQuery(db.weekBoard.getWeekBoardLiveState, {
      campaignId,
      organizationId: orgId,
    }),
    enabled: isCampaignScopedQueryEnabled({ campaignId, orgId, enabled }),
  });
}
