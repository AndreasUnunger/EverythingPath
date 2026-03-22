import { describe, expect, it } from 'vitest';
import {
  createEmptyWeekBoardControllerSyncedState,
  mergeWeekBoardControllerSyncedStateWithServer,
} from '~/components/week-board/week-board-controller-sync';

describe('week board controller synced state merging', () => {
  it('keeps local scalar edits when stale server updates arrive', () => {
    const previousServerState = {
      ...createEmptyWeekBoardControllerSyncedState(),
      eventTriggerRollTotal: '13',
    };
    const currentState = {
      ...previousServerState,
      eventTriggerRollTotal: '44',
    };
    const nextServerState = {
      ...previousServerState,
      eventTriggerRollTotal: '13',
    };

    const merged = mergeWeekBoardControllerSyncedStateWithServer({
      currentState,
      previousServerState,
      nextServerState,
    });

    expect(merged.eventTriggerRollTotal).toBe('44');
  });

  it('accepts new server defaults when local value was untouched', () => {
    const previousServerState = {
      ...createEmptyWeekBoardControllerSyncedState(),
      upkeepTreasuryPenaltyTotal: '',
    };
    const currentState = { ...previousServerState };
    const nextServerState = {
      ...previousServerState,
      upkeepTreasuryPenaltyTotal: '5',
    };

    const merged = mergeWeekBoardControllerSyncedStateWithServer({
      currentState,
      previousServerState,
      nextServerState,
    });

    expect(merged.upkeepTreasuryPenaltyTotal).toBe('5');
  });

  it('keeps local team-operation edits when stale server updates arrive', () => {
    const previousServerState = createEmptyWeekBoardControllerSyncedState();
    const currentState = {
      ...previousServerState,
      activityTeamOperations: {
        recruits: [{ slotIndex: 0, teamId: 'saboteurs' }],
        dismissals: [],
        upgrades: [],
      },
    };
    const nextServerState = createEmptyWeekBoardControllerSyncedState();

    const merged = mergeWeekBoardControllerSyncedStateWithServer({
      currentState,
      previousServerState,
      nextServerState,
    });

    expect(merged.activityTeamOperations.recruits).toEqual([
      { slotIndex: 0, teamId: 'saboteurs' },
    ]);
  });

  it('accepts canonical server officer-operation updates when local content matches', () => {
    const previousServerState = createEmptyWeekBoardControllerSyncedState();
    const currentState = {
      ...previousServerState,
      activityOfficerOperations: {
        changes: [
          { slotIndex: 1, role: 'marshal' as const, characterId: 'a' as never },
          { slotIndex: 0, role: 'strategist' as const, characterId: 'b' as never },
        ],
      },
    };
    const nextServerState = {
      ...previousServerState,
      activityOfficerOperations: {
        changes: [
          { slotIndex: 0, role: 'strategist' as const, characterId: 'b' as never },
          { slotIndex: 1, role: 'marshal' as const, characterId: 'a' as never },
        ],
      },
    };

    const merged = mergeWeekBoardControllerSyncedStateWithServer({
      currentState,
      previousServerState,
      nextServerState,
    });

    expect(merged.activityOfficerOperations).toEqual(
      nextServerState.activityOfficerOperations,
    );
  });

  it('keeps local mitigation multi-select edits when stale server updates arrive', () => {
    const previousServerState = createEmptyWeekBoardControllerSyncedState();
    const currentState = {
      ...previousServerState,
      rivalrySelectedTeamIds: ['defenders', 'saboteurs'],
    };
    const nextServerState = createEmptyWeekBoardControllerSyncedState();

    const merged = mergeWeekBoardControllerSyncedStateWithServer({
      currentState,
      previousServerState,
      nextServerState,
    });

    expect(merged.rivalrySelectedTeamIds).toEqual(['defenders', 'saboteurs']);
  });

  it('resets to server values when the sync scope changes', () => {
    const previousServerState = createEmptyWeekBoardControllerSyncedState();
    const currentState = {
      ...previousServerState,
      eventPercentileTotal: '91',
      turncoatSelectedTeamId: 'saboteurs',
    };
    const nextServerState = {
      ...previousServerState,
      eventPercentileTotal: '12',
      turncoatSelectedTeamId: 'informants',
    };

    const merged = mergeWeekBoardControllerSyncedStateWithServer({
      currentState,
      previousServerState,
      nextServerState,
      resetToServer: true,
    });

    expect(merged.eventPercentileTotal).toBe('12');
    expect(merged.turncoatSelectedTeamId).toBe('informants');
  });
});
