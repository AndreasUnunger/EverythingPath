import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarketplaceLedger } from './marketplace-ledger';

const mockMilitiaQuery = vi.fn();
const mockMarketplaceLedgerQuery = vi.fn();

vi.mock('~/lib/sharedQueries', () => ({
  militiaQuery: (...args: unknown[]) => mockMilitiaQuery(...args),
  marketplaceLedgerQuery: (...args: unknown[]) =>
    mockMarketplaceLedgerQuery(...args),
}));

describe('MarketplaceLedger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMilitiaQuery.mockReturnValue({
      data: { _id: 'militia_1' },
      isLoading: false,
    });
    mockMarketplaceLedgerQuery.mockReturnValue({
      data: {
        currentWeek: 6,
        marketplaces: [],
      },
      isLoading: false,
    });
  });

  it('shows an empty-state message when no marketplaces are tracked', () => {
    render(
      <MarketplaceLedger
        selectedCampaignId={'camp_1' as never}
        organizationId="org_1"
        canQuery
      />,
    );

    expect(
      screen.getByText(/No tracked marketplaces yet\./),
    ).toBeInTheDocument();
  });

  it('renders tracked marketplace details', () => {
    mockMarketplaceLedgerQuery.mockReturnValue({
      data: {
        currentWeek: 6,
        marketplaces: [
          {
            _id: 'market_1',
            label: 'South Gate Market',
            sourceAction: 'broker_market',
            teamId: 'merchants',
            availabilityTier: 'small_town',
            availabilityThreshold: 75,
            saleValuePercent: 50,
            contrabandAllowed: false,
            createdWeek: 5,
            activeUntilWeek: 6,
            isActive: true,
            pendingOrderCount: 1,
          },
        ],
      },
      isLoading: false,
    });

    render(
      <MarketplaceLedger
        selectedCampaignId={'camp_1' as never}
        organizationId="org_1"
        canQuery
      />,
    );

    expect(screen.getByText('South Gate Market')).toBeInTheDocument();
    expect(
      screen.getByText(/Team: merchants • Small town • Availability 75% • Sale value 50%/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Active through week 6 • Pending deliveries: 1/),
    ).toBeInTheDocument();
  });
});
