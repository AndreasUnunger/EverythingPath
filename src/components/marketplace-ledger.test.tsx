import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MarketplaceLedger } from './marketplace-ledger';

const mockMilitiaQuery = vi.fn();
const mockMarketplaceLedgerQuery = vi.fn();
const mockUseMutation = vi.fn();

const mutationFns = {
  upsertMarketplaceState: vi.fn(),
  deleteMarketplaceState: vi.fn(),
};

vi.mock('~/lib/sharedQueries', () => ({
  militiaQuery: (...args: unknown[]) => mockMilitiaQuery(...args),
  marketplaceLedgerQuery: (...args: unknown[]) =>
    mockMarketplaceLedgerQuery(...args),
}));

vi.mock('convex/react', () => ({
  useMutation: (ref: unknown) => mockUseMutation(ref),
}));

vi.mock('@convex/_generated/api', () => ({
  api: {
    militia: {
      upsertMarketplaceState: 'militia.upsertMarketplaceState',
      deleteMarketplaceState: 'militia.deleteMarketplaceState',
    },
  },
}));

vi.mock('~/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <select
      data-testid="mock-select"
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => <option value={value}>{children}</option>,
}));

describe('MarketplaceLedger', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockMilitiaQuery.mockReturnValue({
      data: {
        _id: 'militia_1',
        teams: [{ id: 'merchants' }, { id: 'blackMarketeers' }],
      },
      isLoading: false,
    });
    mockMarketplaceLedgerQuery.mockReturnValue({
      data: {
        currentWeek: 6,
        marketplaces: [],
      },
      isLoading: false,
    });
    mockUseMutation.mockImplementation((ref: unknown) => {
      if (ref === 'militia.upsertMarketplaceState') {
        return mutationFns.upsertMarketplaceState;
      }
      if (ref === 'militia.deleteMarketplaceState') {
        return mutationFns.deleteMarketplaceState;
      }
      return vi.fn();
    });
    mutationFns.upsertMarketplaceState.mockResolvedValue(undefined);
    mutationFns.deleteMarketplaceState.mockResolvedValue(undefined);
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
            orders: [
              {
                _id: 'order_1',
                description: 'Healing potions',
                deliveryDays: 7,
                orderedWeek: 5,
                dueWeek: 6,
                status: 'pending',
                sourceAction: 'broker_market',
              },
            ],
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
      screen.getByText(/Team: Merchants • Small town • Availability 75% • Sale value 50%/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Active through week 6 • Pending deliveries: 1/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Healing potions • pending • due week 6/),
    ).toBeInTheDocument();
  });

  it('creates a marketplace with manual onboarding values', async () => {
    render(
      <MarketplaceLedger
        selectedCampaignId={'camp_1' as never}
        organizationId="org_1"
        canQuery
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Marketplace' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Marketplace label' }), {
      target: { value: ' South Gate Market ' },
    });
    fireEvent.change(screen.getAllByTestId('mock-select')[0]!, {
      target: { value: 'broker_market' },
    });
    fireEvent.change(screen.getAllByTestId('mock-select')[1]!, {
      target: { value: 'merchants' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Created week' }), {
      target: { value: '6' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Active through week' }), {
      target: { value: '7' },
    });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mutationFns.upsertMarketplaceState).toHaveBeenCalledWith({
        organizationId: 'org_1',
        militiaId: 'militia_1',
        marketplaceId: undefined,
        label: 'South Gate Market',
        sourceAction: 'broker_market',
        teamId: 'merchants',
        availabilityTier: 'small_town',
        availabilityThreshold: 75,
        saleValuePercent: 50,
        contrabandAllowed: false,
        createdWeek: 6,
        activeUntilWeek: 7,
        marketDayDiscountPercent: undefined,
        marketDayAppliedWeek: undefined,
        notes: undefined,
      });
    });
  });

  it('deletes a tracked marketplace', async () => {
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
            pendingOrderCount: 0,
            orders: [],
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

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(mutationFns.deleteMarketplaceState).toHaveBeenCalledWith({
        organizationId: 'org_1',
        militiaId: 'militia_1',
        marketplaceId: 'market_1',
      });
    });
  });
});
