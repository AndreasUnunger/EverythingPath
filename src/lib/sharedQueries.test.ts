import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  campaignQuery,
  characterLedgerQuery,
  marketplaceLedgerQuery,
  militiaQuery,
  militiaStateSetupQuery,
  settlementLedgerQuery,
  weekBoardLiveStateQuery,
  weekBoardReferenceQuery,
  weekBoardTrackedStateQuery,
} from './sharedQueries';

const mockUseQuery = vi.fn((options) => options);
const mockConvexQuery = vi.fn((_fnRef, args) => ({
  queryKey: ['mock-query'],
  queryFn: vi.fn(),
  meta: { args },
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => mockUseQuery(options),
}));

vi.mock('@convex-dev/react-query', () => ({
  convexQuery: (fnRef: unknown, args: unknown) => mockConvexQuery(fnRef, args),
}));

vi.mock('@convex/_generated/api', () => ({
  api: {
    campaign: { getCampaigns: 'getCampaigns' },
    character: { listByCampaign: 'listByCampaign' },
    militia: {
      getMilitia: 'getMilitia',
      getMilitiaStateSetup: 'getMilitiaStateSetup',
      listMarketplaces: 'listMarketplaces',
      listSettlements: 'listSettlements',
    },
    weekBoard: {
      getWeekBoardLiveState: 'getWeekBoardLiveState',
      getWeekBoardReferenceData: 'getWeekBoardReferenceData',
      getWeekBoardTrackedState: 'getWeekBoardTrackedState',
      getWeekBoardState: 'getWeekBoardState',
    },
  },
}));

describe('sharedQueries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('disables militia query when campaignId is missing', () => {
    militiaQuery(undefined, 'org_1', true);

    expect(mockConvexQuery).toHaveBeenCalledWith('getMilitia', {
      campaignId: undefined,
      organizationId: 'org_1',
    });
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });

  it('disables militia query when enabled is false', () => {
    militiaQuery('camp_1' as never, 'org_1', false);

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });

  it('keeps campaign query enabled even when organization is undefined', () => {
    campaignQuery(undefined, true);

    expect(mockConvexQuery).toHaveBeenCalledWith('getCampaigns', {
      organizationId: undefined,
    });
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    );
  });

  it('disables campaign query when enabled is false', () => {
    campaignQuery('org_1', false);

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });

  it('wires character ledger query with includeInactive and enabled guard', () => {
    characterLedgerQuery('camp_1' as never, 'org_1', true, true);

    expect(mockConvexQuery).toHaveBeenCalledWith('listByCampaign', {
      campaignId: 'camp_1',
      organizationId: 'org_1',
      includeInactive: true,
    });
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    );
  });

  it('wires settlement ledger query with enabled guard', () => {
    settlementLedgerQuery('camp_1' as never, 'org_1', true);

    expect(mockConvexQuery).toHaveBeenCalledWith('listSettlements', {
      campaignId: 'camp_1',
      organizationId: 'org_1',
    });
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    );
  });

  it('wires marketplace ledger query with enabled guard', () => {
    marketplaceLedgerQuery('camp_1' as never, 'org_1', true);

    expect(mockConvexQuery).toHaveBeenCalledWith('listMarketplaces', {
      campaignId: 'camp_1',
      organizationId: 'org_1',
    });
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    );
  });

  it('wires militia state setup query with enabled guard', () => {
    militiaStateSetupQuery('camp_1' as never, 'org_1', true);

    expect(mockConvexQuery).toHaveBeenCalledWith('getMilitiaStateSetup', {
      campaignId: 'camp_1',
      organizationId: 'org_1',
    });
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    );
  });

  it('wires week board reference query with enabled guard', () => {
    weekBoardReferenceQuery('camp_1' as never, 'org_1', true);

    expect(mockConvexQuery).toHaveBeenCalledWith('getWeekBoardReferenceData', {
      campaignId: 'camp_1',
      organizationId: 'org_1',
    });
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    );
  });

  it('wires week board tracked state query with enabled guard', () => {
    weekBoardTrackedStateQuery('camp_1' as never, 'org_1', true);

    expect(mockConvexQuery).toHaveBeenCalledWith('getWeekBoardTrackedState', {
      campaignId: 'camp_1',
      organizationId: 'org_1',
    });
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    );
  });

  it('wires week board live state query with enabled guard', () => {
    weekBoardLiveStateQuery('camp_1' as never, 'org_1', true);

    expect(mockConvexQuery).toHaveBeenCalledWith('getWeekBoardLiveState', {
      campaignId: 'camp_1',
      organizationId: 'org_1',
    });
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    );
  });
});
