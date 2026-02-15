import { beforeEach, describe, expect, it, vi } from 'vitest';
import { campaignQuery, militiaQuery } from './sharedQueries';

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
  convexQuery: (...args: unknown[]) => mockConvexQuery(...args),
}));

vi.mock('@convex/_generated/api', () => ({
  api: {
    militia: { getMilitia: 'getMilitia' },
    campaign: { getCampaigns: 'getCampaigns' },
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
});
