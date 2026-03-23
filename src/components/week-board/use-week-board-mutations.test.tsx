import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWeekBoardMutations } from '~/components/week-board/use-week-board-mutations';

const saveWeekBoardStateMock = vi.fn(async (_args: unknown) => undefined);
const commitCurrentPhaseMock = vi.fn(async (_args: unknown) => undefined);
const goToPreviousWeekMock = vi.fn(async (_args: unknown) => undefined);
const applyTreasuryTransactionMock = vi.fn(async (_args: unknown) => undefined);
const rankUpMilitiaMock = vi.fn(async (_args: unknown) => undefined);
const buyOffPersistentEventMock = vi.fn(async (_args: unknown) => undefined);

vi.mock('@convex/_generated/api', () => ({
  api: {
    weekBoard: {
      saveWeekBoardState: 'saveWeekBoardState',
      commitCurrentPhase: 'commitCurrentPhase',
      goToPreviousWeek: 'goToPreviousWeek',
      applyTreasuryTransaction: 'applyTreasuryTransaction',
      rankUpMilitia: 'rankUpMilitia',
      buyOffPersistentEvent: 'buyOffPersistentEvent',
    },
  },
}));

vi.mock('convex/react', () => ({
  useMutation: (ref: string) => {
    switch (ref) {
      case 'saveWeekBoardState':
        return saveWeekBoardStateMock;
      case 'commitCurrentPhase':
        return commitCurrentPhaseMock;
      case 'goToPreviousWeek':
        return goToPreviousWeekMock;
      case 'applyTreasuryTransaction':
        return applyTreasuryTransactionMock;
      case 'rankUpMilitia':
        return rankUpMilitiaMock;
      case 'buyOffPersistentEvent':
        return buyOffPersistentEventMock;
      default:
        throw new Error(`Unexpected mutation ref: ${ref}`);
    }
  },
}));

describe('useWeekBoardMutations', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('batches queued patches into a single save', async () => {
    const { result } = renderHook(() => useWeekBoardMutations('org1'));

    let firstPromise!: Promise<void>;
    let secondPromise!: Promise<void>;
    await act(async () => {
      firstPromise = result.current.queueUpkeepTotalsPatch('militia-1' as never, {
        attritionTotal: '7',
      });
      secondPromise = result.current.queueActivityRollTotalsPatch(
        'militia-1' as never,
        {
          earnGoldCheckTotal: '19',
        },
      );

      await vi.advanceTimersByTimeAsync(81);
      await Promise.all([firstPromise, secondPromise]);
    });

    expect(saveWeekBoardStateMock).toHaveBeenCalledTimes(1);
    expect(saveWeekBoardStateMock).toHaveBeenCalledWith({
      organizationId: 'org1',
      militiaId: 'militia-1',
      patch: {
        upkeepRollTotals: {
          attritionTotal: '7',
        },
        activityRollTotals: {
          earnGoldCheckTotal: '19',
        },
      },
    });
  });

  it('flushes a queued patch before direct slot saves', async () => {
    const { result } = renderHook(() => useWeekBoardMutations('org1'));

    await act(async () => {
      const queued = result.current.queueUpkeepTotalsPatch('militia-1' as never, {
        attritionTotal: '4',
      });
      await result.current.saveSlots(
        'militia-1' as never,
        ['earn_gold', null],
        ['merchants', null],
      );
      await queued;
    });

    expect(saveWeekBoardStateMock).toHaveBeenCalledTimes(2);
    expect(saveWeekBoardStateMock.mock.calls[0]?.[0]).toEqual({
      organizationId: 'org1',
      militiaId: 'militia-1',
      patch: {
        upkeepRollTotals: {
          attritionTotal: '4',
        },
      },
    });
    expect(saveWeekBoardStateMock.mock.calls[1]?.[0]).toEqual({
      organizationId: 'org1',
      militiaId: 'militia-1',
      patch: {
        stagedActivityActionIds: ['earn_gold', null],
        stagedActivityTeamIds: ['merchants', null],
      },
    });
  });

  it('flushes the previous militia queue before batching a new militia queue', async () => {
    const { result } = renderHook(() => useWeekBoardMutations('org1'));

    let firstPromise!: Promise<void>;
    let secondPromise!: Promise<void>;
    await act(async () => {
      firstPromise = result.current.queueUpkeepTotalsPatch('militia-1' as never, {
        attritionTotal: '3',
      });
      secondPromise = result.current.queueEventTotalsPatch('militia-2' as never, {
        eventChanceTotal: '45',
      });

      await vi.advanceTimersByTimeAsync(81);
      await Promise.all([firstPromise, secondPromise]);
    });

    expect(saveWeekBoardStateMock).toHaveBeenCalledTimes(2);
    expect(saveWeekBoardStateMock.mock.calls[0]?.[0]).toEqual({
      organizationId: 'org1',
      militiaId: 'militia-1',
      patch: {
        upkeepRollTotals: {
          attritionTotal: '3',
        },
      },
    });
    expect(saveWeekBoardStateMock.mock.calls[1]?.[0]).toEqual({
      organizationId: 'org1',
      militiaId: 'militia-2',
      patch: {
        eventRollTotals: {
          eventChanceTotal: '45',
        },
      },
    });
  });
});
