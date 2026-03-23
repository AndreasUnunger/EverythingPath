import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MilitiaStateManager } from './militia-state-manager';

const mockMilitiaQuery = vi.fn();
const mockMilitiaStateSetupQuery = vi.fn();
const mockSettlementLedgerQuery = vi.fn();
const mockMarketplaceLedgerQuery = vi.fn();
const mockCharacterLedgerQuery = vi.fn();
const mockUseMutation = vi.fn();

const mutationFns = {
  createMilitia: vi.fn(),
  updateMilitiaCoreState: vi.fn(),
  upsertWeekContextState: vi.fn(),
  upsertMilitiaTeamState: vi.fn(),
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
      upsertCacheState: 'militia.upsertCacheState',
      deleteCacheState: 'militia.deleteCacheState',
      upsertOrderState: 'militia.upsertOrderState',
      deleteOrderState: 'militia.deleteOrderState',
      upsertTrackedPersonState: 'militia.upsertTrackedPersonState',
      deleteTrackedPersonState: 'militia.deleteTrackedPersonState',
      upsertEventState: 'militia.upsertEventState',
      deleteEventState: 'militia.deleteEventState',
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
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockMilitiaQuery.mockReturnValue({
      data: null,
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
  });

  it('adds a team roster state entry', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'Add Team' }));
    const selects = screen.getAllByTestId('mock-select');
    fireEvent.change(selects[0]!, { target: { value: 'spies' } });
    fireEvent.change(selects[1]!, { target: { value: 'missing' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Unavailable until week' }), {
      target: { value: '8' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mutationFns.upsertMilitiaTeamState).toHaveBeenCalledWith({
        organizationId: 'org_1',
        militiaId: 'militia_1',
        teamId: 'spies',
        inRoster: true,
        status: 'missing',
        unavailableUntilWeek: 8,
        notes: undefined,
      });
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

    fireEvent.click(screen.getByRole('button', { name: 'Add Queued Effect' }));
    fireEvent.change(screen.getAllByTestId('mock-select')[0]!, {
      target: { value: 'auto_event_roll_twice' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Applies week' }), {
      target: { value: '5' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Note' }), {
      target: { value: ' From last table session ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

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
});
