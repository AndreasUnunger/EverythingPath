import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MilitiaStateManager } from './militia-state-manager';

const mockMilitiaQuery = vi.fn();
const mockCampaignQuery = vi.fn();
const mockMilitiaStateSetupQuery = vi.fn();
const mockSettlementLedgerQuery = vi.fn();
const mockMarketplaceLedgerQuery = vi.fn();
const mockCharacterLedgerQuery = vi.fn();
const mockUseMutation = vi.fn();

const mutationFns = {
  createMilitia: vi.fn(),
  updateMilitiaCoreState: vi.fn(),
  updateCampaignInGameDate: vi.fn(),
  upsertWeekContextState: vi.fn(),
  upsertMilitiaTeamState: vi.fn(),
  assignTeamManager: vi.fn(),
  upsertCacheState: vi.fn(),
  deleteCacheState: vi.fn(),
  upsertOrderState: vi.fn(),
  deleteOrderState: vi.fn(),
  upsertTrackedPersonState: vi.fn(),
  deleteTrackedPersonState: vi.fn(),
  upsertEventState: vi.fn(),
  deleteEventState: vi.fn(),
};

vi.mock('~/lib/sharedQueries', () => ({
  campaignQuery: (...args: unknown[]) => mockCampaignQuery(...args),
  militiaQuery: (...args: unknown[]) => mockMilitiaQuery(...args),
  militiaStateSetupQuery: (...args: unknown[]) => mockMilitiaStateSetupQuery(...args),
  settlementLedgerQuery: (...args: unknown[]) => mockSettlementLedgerQuery(...args),
  marketplaceLedgerQuery: (...args: unknown[]) => mockMarketplaceLedgerQuery(...args),
  characterLedgerQuery: (...args: unknown[]) => mockCharacterLedgerQuery(...args),
}));

vi.mock('convex/react', () => ({
  useMutation: (ref: unknown) => mockUseMutation(ref),
}));

vi.mock('@convex/_generated/api', () => ({
  api: {
    militia: {
      createMilitia: 'militia.createMilitia',
      updateMilitiaCoreState: 'militia.updateMilitiaCoreState',
      upsertWeekContextState: 'militia.upsertWeekContextState',
      upsertMilitiaTeamState: 'militia.upsertMilitiaTeamState',
      assignTeamManager: 'militia.assignTeamManager',
      upsertCacheState: 'militia.upsertCacheState',
      deleteCacheState: 'militia.deleteCacheState',
      upsertOrderState: 'militia.upsertOrderState',
      deleteOrderState: 'militia.deleteOrderState',
      upsertTrackedPersonState: 'militia.upsertTrackedPersonState',
      deleteTrackedPersonState: 'militia.deleteTrackedPersonState',
      upsertEventState: 'militia.upsertEventState',
      deleteEventState: 'militia.deleteEventState',
    },
    campaign: {
      updateCampaignInGameDate: 'campaign.updateCampaignInGameDate',
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

describe('MilitiaStateManager', () => {
  function openLedger() {
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
  }

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockMilitiaQuery.mockReturnValue({
      data: null,
      isLoading: false,
    });
    mockCampaignQuery.mockReturnValue({
      data: {
        state: 'ready',
        campaigns: [
          {
            _id: 'camp_1',
            name: 'Alpha',
            description: '',
            ownerId: 'owner',
            organizationId: 'org_1',
            inGameDate: '2026-03-22T00:00:00.000Z',
          },
        ],
      },
      isLoading: false,
    });
    mockMilitiaStateSetupQuery.mockReturnValue({
      data: null,
      isLoading: false,
    });
    mockSettlementLedgerQuery.mockReturnValue({
      data: [],
      isLoading: false,
    });
    mockMarketplaceLedgerQuery.mockReturnValue({
      data: { currentWeek: 3, marketplaces: [] },
      isLoading: false,
    });
    mockCharacterLedgerQuery.mockReturnValue({
      data: [],
      isLoading: false,
    });
    mockUseMutation.mockImplementation((ref: unknown) => {
      const key = String(ref).split('.').pop() as keyof typeof mutationFns;
      return mutationFns[key] ?? vi.fn();
    });
    Object.values(mutationFns).forEach((fn) => fn.mockResolvedValue(undefined));
  });

  it('creates a militia from the initializer dialog', async () => {
    render(
      <MilitiaStateManager
        selectedCampaignId={'camp_1' as never}
        organizationId="org_1"
        canQuery
      />,
    );

    openLedger();
    fireEvent.click(screen.getByRole('button', { name: 'Initialize Militia' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Militia name' }), {
      target: { value: ' Ironfang Watch ' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Rank' }), {
      target: { value: '4' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Highest boon reached' }), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'HQ location' }), {
      target: { value: ' Longshadow ' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Training' }), {
      target: { value: '30' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Treasury' }), {
      target: { value: '120' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Notoriety' }), {
      target: { value: '4' },
    });
    fireEvent.change(screen.getByTestId('mock-select'), {
      target: { value: 'Security' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mutationFns.createMilitia).toHaveBeenCalledWith({
        organizationId: 'org_1',
        militia: {
          name: 'Ironfang Watch',
          campaignId: 'camp_1',
          rank: 4,
          highestBoonReached: 2,
          HQLocation: 'Longshadow',
          treasury: 120,
          notoriety: 4,
          focus: 'Security',
          training: 30,
        },
      });
    });
    expect(mutationFns.updateCampaignInGameDate).toHaveBeenCalledWith({
      organizationId: 'org_1',
      campaignId: 'camp_1',
      inGameDate: '2026-03-22T00:00:00.000Z',
    });
  });

  it('adds a queued effect through week context state', async () => {
    mockMilitiaQuery.mockReturnValue({
      data: {
        _id: 'militia_1',
        name: 'Watch',
        rank: 4,
        highestBoonReached: 2,
        HQLocation: 'Longshadow',
        treasury: 120,
        notoriety: 4,
        focus: 'Security',
        training: 30,
        teams: [],
      },
      isLoading: false,
    });
    mockMilitiaStateSetupQuery.mockReturnValue({
      data: {
        currentWeekState: {
          weekNumber: 3,
          phase: 'activity',
          isFirstWeek: false,
          skippedUpkeepThisWeek: false,
          uneventfulBonusCarry: 2,
          lastPersistentBuyoffWeek: 1,
          queuedEffects: [],
        },
        teamStates: [],
        caches: [],
        orders: [],
        trackedPeople: [],
        eventStates: [],
      },
      isLoading: false,
    });

    render(
      <MilitiaStateManager
        selectedCampaignId={'camp_1' as never}
        organizationId="org_1"
        canQuery
      />,
    );

    openLedger();
    fireEvent.click(screen.getByRole('button', { name: 'Add Queued Effect' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getAllByTestId('mock-select')[0]!, {
      target: { value: 'auto_event_roll_twice' },
    });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Applies week' }), {
      target: { value: '5' },
    });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Note' }), {
      target: { value: ' From last table session ' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mutationFns.upsertWeekContextState).toHaveBeenCalledWith({
        organizationId: 'org_1',
        militiaId: 'militia_1',
        weekNumber: 3,
        phase: 'activity',
        isFirstWeek: false,
        skippedUpkeepThisWeek: false,
        uneventfulBonusCarry: 2,
        lastPersistentBuyoffWeek: 1,
        queuedEffects: [
          {
            kind: 'auto_event_roll_twice',
            appliesWeek: 5,
            note: 'From last table session',
          },
        ],
      });
    });
  });

  it('adds a tracked person from the character ledger without requiring manual name input', async () => {
    mockMilitiaQuery.mockReturnValue({
      data: {
        _id: 'militia_1',
        name: 'Watch',
        rank: 4,
        highestBoonReached: 2,
        HQLocation: 'Longshadow',
        treasury: 120,
        notoriety: 4,
        focus: 'Security',
        training: 30,
        teams: [],
      },
      isLoading: false,
    });
    mockMilitiaStateSetupQuery.mockReturnValue({
      data: {
        currentWeekState: {
          weekNumber: 3,
          phase: 'activity',
          isFirstWeek: false,
          skippedUpkeepThisWeek: false,
          uneventfulBonusCarry: 2,
          lastPersistentBuyoffWeek: 1,
          queuedEffects: [],
        },
        teamStates: [],
        caches: [],
        orders: [],
        trackedPeople: [],
        eventStates: [],
      },
      isLoading: false,
    });
    mockCharacterLedgerQuery.mockReturnValue({
      data: [
        {
          _id: 'char_1',
          name: 'Kara Venn',
          kind: 'pc',
          level: 5,
        },
      ],
      isLoading: false,
    });

    render(
      <MilitiaStateManager
        selectedCampaignId={'camp_1' as never}
        organizationId="org_1"
        canQuery
      />,
    );

    openLedger();
    fireEvent.click(screen.getByRole('button', { name: 'Add Tracked Person' }));
    const dialog = await screen.findByRole('dialog');
    let selects = within(dialog).getAllByTestId('mock-select');
    fireEvent.change(selects[0]!, { target: { value: 'character' } });
    selects = within(dialog).getAllByTestId('mock-select');
    fireEvent.change(selects[1]!, { target: { value: 'char_1' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mutationFns.upsertTrackedPersonState).toHaveBeenCalledWith({
        organizationId: 'org_1',
        militiaId: 'militia_1',
        trackedPersonId: undefined,
        characterId: 'char_1',
        displayName: 'Kara Venn',
        personKind: 'pc',
        status: 'active',
        level: undefined,
        locationType: 'unknown',
        settlementKey: undefined,
        siteName: undefined,
        notes: undefined,
        activeUntilWeek: undefined,
        hiddenSinceWeek: undefined,
        capturedSinceWeek: undefined,
        rescuedWeek: undefined,
        restoredWeek: undefined,
        rescueDcOverride: undefined,
        sourceAction: 'manual',
      });
    });
  });
});
