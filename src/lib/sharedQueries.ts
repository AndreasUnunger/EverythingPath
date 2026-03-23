import { convexQuery } from '@convex-dev/react-query';
import { api as db } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useQuery } from '@tanstack/react-query';

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
    enabled: enabled && !!campaignId && !!orgId,
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
    enabled: enabled && !!campaignId && !!orgId,
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
    enabled: enabled && !!campaignId && !!orgId,
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
    enabled: enabled && !!campaignId && !!orgId,
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
    enabled: enabled && !!campaignId && !!orgId,
  });
}
