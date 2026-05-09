import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CampaignDashboard } from './campaign-dashboard';

const mockUseOrganization = vi.fn();
const mockCampaignQuery = vi.fn();
const mockCharacterLedgerQuery = vi.fn();
const mockMarketplaceLedgerQuery = vi.fn();
const mockMilitiaQuery = vi.fn();
const mockMilitiaStateSetupQuery = vi.fn();
const campaignInfoSpy = vi.fn();
const ledgerSpy = vi.fn();
const militiaSystemSpy = vi.fn();

vi.mock('@clerk/nextjs', () => ({
  useOrganization: () => mockUseOrganization(),
}));

vi.mock('~/lib/sharedQueries', () => ({
  campaignQuery: (...args: unknown[]) => mockCampaignQuery(...args),
  characterLedgerQuery: (...args: unknown[]) => mockCharacterLedgerQuery(...args),
  marketplaceLedgerQuery: (...args: unknown[]) =>
    mockMarketplaceLedgerQuery(...args),
  militiaQuery: (...args: unknown[]) => mockMilitiaQuery(...args),
  militiaStateSetupQuery: (...args: unknown[]) => mockMilitiaStateSetupQuery(...args),
}));

vi.mock('~/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  TabsContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('./campaign-selector', () => ({
  default: () => <div data-testid="campaign-selector">CampaignSelector</div>,
}));

vi.mock('~/app/campaigns/createCampaignDialog', () => ({
  default: () => <div data-testid="create-campaign-dialog">CreateCampaign</div>,
}));

vi.mock('./campaignInfo', () => ({
  CampaignInfo: (props: {
    campaign?: { name?: string };
    militia?: unknown;
    militiaStateSetup?: unknown;
    marketplaceLedger?: unknown;
    characters?: unknown;
  }) => {
    campaignInfoSpy(props);
    return (
      <div data-testid="campaign-info">
        CampaignInfo: {props.campaign?.name ?? 'none'}
      </div>
    );
  },
}));

vi.mock('./ledger', () => ({
  Ledger: (props: unknown) => {
    ledgerSpy(props);
    return <div data-testid="ledger">Ledger</div>;
  },
}));

vi.mock('~/components/militia-system', () => ({
  MilitiaSystem: (props: unknown) => {
    militiaSystemSpy(props);
    return <div data-testid="militia-system">MilitiaSystem</div>;
  },
}));

describe('CampaignDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMilitiaQuery.mockReturnValue({ data: undefined });
    mockMilitiaStateSetupQuery.mockReturnValue({ data: undefined });
    mockCharacterLedgerQuery.mockReturnValue({ data: [] });
    mockMarketplaceLedgerQuery.mockReturnValue({
      data: { currentWeek: undefined, marketplaces: [] },
    });
    mockCampaignQuery.mockReturnValue({
      data: { state: 'ready', campaigns: [] },
      isLoading: false,
      error: undefined,
    });
  });

  it('shows loading while organization context is not loaded', () => {
    mockUseOrganization.mockReturnValue({
      organization: undefined,
      isLoaded: false,
    });

    render(<CampaignDashboard />);

    expect(screen.getByText('Loading organization context...')).toBeInTheDocument();
  });

  it('shows no-organization message from campaign context', () => {
    mockUseOrganization.mockReturnValue({
      organization: undefined,
      isLoaded: true,
    });
    mockCampaignQuery.mockReturnValue({
      data: { state: 'no_org_selected' },
      isLoading: false,
      error: undefined,
    });

    render(<CampaignDashboard />);

    expect(screen.getByText('No active organization selected')).toBeInTheDocument();
  });

  it('shows no-access message from campaign context', () => {
    mockUseOrganization.mockReturnValue({
      organization: { id: 'org_1' },
      isLoaded: true,
    });
    mockCampaignQuery.mockReturnValue({
      data: { state: 'no_access' },
      isLoading: false,
      error: undefined,
    });

    render(<CampaignDashboard />);

    expect(
      screen.getByText('Organization access not synced yet'),
    ).toBeInTheDocument();
  });

  it('renders ready state and wires selected campaign to child queries', async () => {
    mockUseOrganization.mockReturnValue({
      organization: { id: 'org_1' },
      isLoaded: true,
    });
    mockCampaignQuery.mockReturnValue({
      data: {
        state: 'ready',
        campaigns: [
          {
            _id: 'camp_1',
            _creationTime: 1,
            name: 'Alpha',
            ownerId: 'owner',
            description: 'desc',
            organizationId: 'org_1',
          },
        ],
      },
      isLoading: false,
      error: undefined,
    });
    mockMilitiaQuery.mockReturnValue({
      data: {
        _id: 'militia_1',
        name: 'Ironfang Resistance',
        campaignId: 'camp_1',
        rank: 8,
        highestBoonReached: 8,
        HQLocation: 'Southern Fangwood',
        treasury: 1220,
        notoriety: 4,
        focus: 'Secrecy',
        training: 82,
        teams: [],
      },
    });
    mockMilitiaStateSetupQuery.mockReturnValue({
      data: {
        currentWeekState: {
          weekNumber: 14,
          phase: 'activity',
          isFirstWeek: false,
          skippedUpkeepThisWeek: false,
          uneventfulBonusCarry: 0,
          queuedEffects: [],
        },
        teamStates: [],
        caches: [],
        orders: [],
        trackedPeople: [],
        eventStates: [],
      },
    });
    mockMarketplaceLedgerQuery.mockReturnValue({
      data: {
        currentWeek: 14,
        marketplaces: [],
      },
    });
    mockCharacterLedgerQuery.mockReturnValue({
      data: [],
    });

    render(<CampaignDashboard />);

    await waitFor(() => {
      expect(screen.getByText('CampaignInfo: Alpha')).toBeInTheDocument();
    });

    expect(mockCampaignQuery).toHaveBeenCalledWith('org_1', true);
    expect(mockMilitiaQuery).toHaveBeenCalledWith('camp_1', 'org_1', true);
    expect(mockMarketplaceLedgerQuery).toHaveBeenCalledWith(
      'camp_1',
      'org_1',
      true,
    );
    expect(mockMilitiaStateSetupQuery).toHaveBeenCalledWith(
      'camp_1',
      'org_1',
      true,
    );
    expect(mockCharacterLedgerQuery).toHaveBeenCalledWith(
      'camp_1',
      'org_1',
      true,
    );
    expect(campaignInfoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        campaign: expect.objectContaining({ name: 'Alpha' }),
        militia: expect.objectContaining({
          HQLocation: 'Southern Fangwood',
          focus: 'Secrecy',
          training: 82,
        }),
        militiaStateSetup: expect.objectContaining({
          currentWeekState: expect.objectContaining({
            weekNumber: 14,
            phase: 'activity',
          }),
        }),
        marketplaceLedger: expect.objectContaining({
          currentWeek: 14,
        }),
        characters: [],
      }),
    );
    expect(ledgerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        canQuery: true,
      }),
    );
  });
});
