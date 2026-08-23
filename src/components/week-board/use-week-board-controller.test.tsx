import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWeekBoardController } from '~/components/week-board/use-week-board-controller';

const useDebouncedAutosaveMock = vi.fn();
const weekBoardReferenceQueryMock = vi.fn();
const weekBoardTrackedStateQueryMock = vi.fn();
const weekBoardLiveStateQueryMock = vi.fn();
const useActivityCardDragMock = vi.fn();

const mutationSpies = {
  queueUpkeepTotalsPatch: vi.fn(async (_militiaId: unknown, _patch: unknown) => undefined),
  queueActivityTeamOperationsPatch: vi.fn(
    async (_militiaId: unknown, _patch: unknown) => undefined,
  ),
  queueActivityOfficerOperationsPatch: vi.fn(
    async (_militiaId: unknown, _patch: unknown) => undefined,
  ),
  queueActivityAssetOperationsPatch: vi.fn(
    async (_militiaId: unknown, _patch: unknown) => undefined,
  ),
  queueEventMitigationsPatch: vi.fn(
    async (_militiaId: unknown, _patch: unknown) => undefined,
  ),
  queueActivityRollTotalsPatch: vi.fn(
    async (_militiaId: unknown, _patch: unknown) => undefined,
  ),
  queueEventTotalsPatch: vi.fn(async (_militiaId: unknown, _patch: unknown) => undefined),
  queueTableAdjustmentsPatch: vi.fn(
    async (_militiaId: unknown, _patch: unknown) => undefined,
  ),
  flushQueuedPatchAction: vi.fn(async (_militiaId: unknown) => undefined),
  savePhase: vi.fn(async (_militiaId: unknown, _phase: unknown) => undefined),
  saveSlots: vi.fn(
    async (_militiaId: unknown, _slots: unknown, _teams?: unknown) => undefined,
  ),
  saveStagedTeams: vi.fn(async (_militiaId: unknown, _teams: unknown) => undefined),
  continueToSummary: vi.fn(
    async (_militiaId: unknown, _phase: unknown, _eventTotals: unknown) => undefined,
  ),
  commitPhase: vi.fn(async (_militiaId: unknown) => undefined),
  goBackWeek: vi.fn(async (_militiaId: unknown) => undefined),
  applyTreasuryUpdate: vi.fn(
    async (_militiaId: unknown, _mode: unknown, _amount: unknown) => undefined,
  ),
  applyRankUp: vi.fn(async (_militiaId: unknown) => undefined),
  buyOffPersistentEventAction: vi.fn(
    async (_militiaId: unknown, _eventStateId: unknown) => undefined,
  ),
};

vi.mock('~/hooks/use-debounced-autosave', () => ({
  useDebouncedAutosave: (config: unknown) => useDebouncedAutosaveMock(config),
}));

vi.mock('~/lib/sharedQueries', () => ({
  weekBoardReferenceQuery: (...args: unknown[]) => weekBoardReferenceQueryMock(...args),
  weekBoardTrackedStateQuery: (...args: unknown[]) => weekBoardTrackedStateQueryMock(...args),
  weekBoardLiveStateQuery: (...args: unknown[]) => weekBoardLiveStateQueryMock(...args),
}));

vi.mock('~/hooks/use-activity-card-drag', () => ({
  useActivityCardDrag: (args: unknown) => useActivityCardDragMock(args),
}));

vi.mock('~/components/week-board/use-week-board-mutations', () => ({
  useWeekBoardMutations: () => mutationSpies,
}));

function buildBaseReferenceData() {
  return {
    militiaId: 'm1',
    rank: 2,
    training: 10,
    treasury: 25,
    notoriety: 30,
    focus: 'Loyalty',
    maxTeams: 4,
    teams: [
      {
        teamId: 'spies',
        status: 'active',
        unavailableUntilWeek: undefined,
        notes: undefined,
        manager: null,
      },
    ],
    settlementKeys: ['Tamran'],
    highestPcLevel: 5,
    canRankUp: false,
    rankUpBlockedReason: '',
    assignableCharacters: [
      {
        _id: 'char-1',
        name: 'Vell',
        kind: 'pc',
        level: 5,
        strength: 10,
        dexterity: 12,
        constitution: 12,
        intelligence: 14,
        wisdom: 10,
        charisma: 16,
      },
    ],
    officerAssignments: {},
  };
}

function buildBaseTrackedData() {
  return {
    settlements: [],
    caches: [],
    marketplaces: [
      {
        _id: 'market-1',
        label: 'Tamran Market',
        sourceAction: 'broker_market',
        teamId: 'merchants',
        availabilityTier: 'small_town',
        availabilityThreshold: 75,
        saleValuePercent: 50,
        contrabandAllowed: false,
        createdWeek: 2,
        activeUntilWeek: 3,
        marketDayDiscountPercent: undefined,
        marketDayAppliedWeek: undefined,
        notes: undefined,
      },
    ],
    orders: [],
    trackedPeople: [],
    activePersistentEvents: [],
  };
}

function buildBaseLiveState(overrides?: Record<string, unknown>) {
  return {
    militiaId: 'm1',
    maxActions: 2,
    persistentBuyoff: {
      cost: 40,
      weeksRemaining: 3,
      canBuyoffNow: false,
    },
    state: {
      weekNumber: 3,
      phase: 'activity',
      isFirstWeek: false,
      skippedUpkeepThisWeek: false,
      uneventfulBonusCarry: 0,
      queuedEffects: [],
      lastPersistentBuyoffWeek: 0,
      stagedActivityActionIds: ['covert_action', null],
      stagedActivityTeamIds: [null, null],
      activityTeamOperations: {
        recruits: [],
        dismissals: [],
        upgrades: [],
      },
      activityOfficerOperations: {
        changes: [],
      },
      activityAssetOperations: {
        refuges: [],
        caches: [],
        orders: [],
        marketplaces: [],
        covertActions: [],
        rescues: [],
        restorations: [],
      },
      upkeepTeamOperations: {
        disabledRecoveries: [],
        missingChecks: [],
      },
      eventMitigations: {},
      weekWarnings: [],
      lockVersion: 1,
      upkeepRollTotals: {},
      activityRollTotals: {},
      eventRollTotals: {
        eventChanceTotal: 30,
        eventTriggerRollTotal: 10,
        eventPercentileTotal: 38,
      },
      ...overrides,
    },
  };
}

function getLatestAutosaves() {
  return useDebouncedAutosaveMock.mock.calls
    .slice(-6)
    .map((call) => call[0] as {
      shouldSkip: () => boolean;
      run: () => Promise<void>;
    });
}

describe('useWeekBoardController sparse autosaves', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    weekBoardReferenceQueryMock.mockReturnValue({
      data: buildBaseReferenceData(),
      isLoading: false,
    });
    weekBoardTrackedStateQueryMock.mockReturnValue({
      data: buildBaseTrackedData(),
      isLoading: false,
    });
    weekBoardLiveStateQueryMock.mockReturnValue({
      data: buildBaseLiveState(),
      isLoading: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps phase navigation local and confirms the reviewed draft revision', async () => {
    const { result } = renderHook(() =>
      useWeekBoardController({
        campaignId: 'camp-1' as never,
        organizationId: 'org1',
        canQuery: true,
      }),
    );

    await act(async () => {
      await result.current.actions.changePhase('event');
    });

    expect(result.current.phase).toBe('event');
    expect(mutationSpies.savePhase).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.actions.commitPhase();
    });

    expect(mutationSpies.commitPhase).toHaveBeenCalledWith('m1', 1);
  });

  it('queues only changed upkeep totals', async () => {
    const { result } = renderHook(() =>
      useWeekBoardController({
        campaignId: 'camp-1' as never,
        organizationId: 'org1',
        canQuery: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.nearestSettlementKey).toBe('Tamran');
    });

    act(() => {
      result.current.setUpkeepAttritionTotal('7');
    });

    const [upkeepAutosave] = getLatestAutosaves();
    await act(async () => {
      await upkeepAutosave?.run();
    });

    expect(mutationSpies.queueUpkeepTotalsPatch).toHaveBeenCalledWith('m1', {
      attritionTotal: '7',
    });
  });

  it('queues only changed activity asset operations for staged covert actions', async () => {
    const { result } = renderHook(() =>
      useWeekBoardController({
        campaignId: 'camp-1' as never,
        organizationId: 'org1',
        canQuery: true,
      }),
    );

    act(() => {
      result.current.setCovertActionForSlot({
        slotIndex: 0,
        mode: 'place_contact',
        targetSource: 'freeform',
        displayName: 'Scout Nera',
        personKind: 'other_npc',
        siteName: 'Old Bridge',
      });
    });

    const assetAutosave = getLatestAutosaves()[3];
    await act(async () => {
      await assetAutosave?.run();
    });

    expect(mutationSpies.queueActivityAssetOperationsPatch).toHaveBeenCalledTimes(1);
    expect(
      mutationSpies.queueActivityAssetOperationsPatch.mock.calls[0]?.[0],
    ).toBe('m1');
    expect(
      mutationSpies.queueActivityAssetOperationsPatch.mock.calls[0]?.[1],
    ).toEqual({
      covertActions: [
        {
          slotIndex: 0,
          mode: 'place_contact',
          targetSource: 'freeform',
          displayName: 'Scout Nera',
          personKind: 'other_npc',
          siteName: 'Old Bridge',
        },
      ],
    });
  });

  it('queues explicit null clears for event mitigation selections', async () => {
    weekBoardLiveStateQueryMock.mockReturnValue({
      data: buildBaseLiveState({
        eventMitigations: {
          marketDayMarketplaceId: 'market-1',
        },
      }),
      isLoading: false,
    });

    const { result } = renderHook(() =>
      useWeekBoardController({
        campaignId: 'camp-1' as never,
        organizationId: 'org1',
        canQuery: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.marketDayMarketplaceId).toBe('market-1');
    });

    act(() => {
      result.current.setMarketDayMarketplaceId('');
    });

    const eventMitigationAutosave = getLatestAutosaves()[4];
    await act(async () => {
      await eventMitigationAutosave?.run();
    });

    expect(mutationSpies.queueEventMitigationsPatch).toHaveBeenCalledWith('m1', {
      marketDayMarketplaceId: null,
    });
  });
});
