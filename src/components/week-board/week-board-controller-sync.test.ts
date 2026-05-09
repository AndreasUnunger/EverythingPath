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

  it('keeps local overseer event support selection when stale server updates arrive', () => {
    const previousServerState = createEmptyWeekBoardControllerSyncedState();
    const currentState = {
      ...previousServerState,
      overseerEventSupportTarget: 'sickness_twice' as const,
    };
    const nextServerState = createEmptyWeekBoardControllerSyncedState();

    const merged = mergeWeekBoardControllerSyncedStateWithServer({
      currentState,
      previousServerState,
      nextServerState,
    });

    expect(merged.overseerEventSupportTarget).toBe('sickness_twice');
  });

  it('keeps local asset-operation edits when stale server updates arrive', () => {
    const previousServerState = createEmptyWeekBoardControllerSyncedState();
    const currentState = {
      ...previousServerState,
      activityAssetOperations: {
        ...previousServerState.activityAssetOperations,
        refuges: [{ slotIndex: 0, settlementKey: 'Longshadow' }],
        caches: [
          {
            slotIndex: 1,
            mode: 'place' as const,
            label: 'Temple cache',
            cacheClass: 'minor' as const,
            location: 'Crypt',
            contentsSummary: 'Potions',
            checkTotal: '18',
          },
        ],
        orders: [],
        marketplaces: [],
        covertActions: [],
        rescues: [],
        restorations: [],
      },
    };
    const nextServerState = createEmptyWeekBoardControllerSyncedState();

    const merged = mergeWeekBoardControllerSyncedStateWithServer({
      currentState,
      previousServerState,
      nextServerState,
    });

    expect(merged.activityAssetOperations).toEqual(currentState.activityAssetOperations);
  });

  it('accepts canonical server asset-operation updates when local content matches', () => {
    const previousServerState = createEmptyWeekBoardControllerSyncedState();
    const currentState = {
      ...previousServerState,
      activityAssetOperations: {
        ...previousServerState.activityAssetOperations,
        refuges: [{ slotIndex: 1, settlementKey: 'Kraggodan' }],
        caches: [],
        orders: [
          {
            slotIndex: 2,
            description: 'Wand of cure light wounds',
            costPaid: '375',
            deliveryDays: '8',
          },
        ],
        marketplaces: [],
        covertActions: [],
        rescues: [],
        restorations: [],
      },
    };
    const nextServerState = {
      ...previousServerState,
      activityAssetOperations: {
        ...previousServerState.activityAssetOperations,
        refuges: [{ slotIndex: 1, settlementKey: 'Kraggodan' }],
        caches: [],
        orders: [
          {
            slotIndex: 2,
            description: 'Wand of cure light wounds',
            deliveryDays: '8',
            costPaid: '375',
          },
        ],
        marketplaces: [],
        covertActions: [],
        rescues: [],
        restorations: [],
      },
    };

    const merged = mergeWeekBoardControllerSyncedStateWithServer({
      currentState,
      previousServerState,
      nextServerState,
    });

    expect(merged.activityAssetOperations).toEqual(
      nextServerState.activityAssetOperations,
    );
  });

  it('keeps local tracked-person asset edits when stale server updates arrive', () => {
    const previousServerState = createEmptyWeekBoardControllerSyncedState();
    const currentState = {
      ...previousServerState,
      activityAssetOperations: {
        ...previousServerState.activityAssetOperations,
        rescues: [
          {
            slotIndex: 0,
            displayName: 'Captured villager',
            personKind: 'other_npc' as const,
            targetLevel: '2',
            destinationType: 'hq' as const,
          },
        ],
      },
    };
    const nextServerState = createEmptyWeekBoardControllerSyncedState();

    const merged = mergeWeekBoardControllerSyncedStateWithServer({
      currentState,
      previousServerState,
      nextServerState,
    });

    expect(merged.activityAssetOperations.rescues).toEqual([
      {
        slotIndex: 0,
        displayName: 'Captured villager',
        personKind: 'other_npc',
        targetLevel: '2',
        destinationType: 'hq',
      },
    ]);
  });

  it('keeps explicit source selection for covert action when no concrete target is chosen yet', () => {
    const previousServerState = createEmptyWeekBoardControllerSyncedState();
    const currentState = {
      ...previousServerState,
      activityAssetOperations: {
        ...previousServerState.activityAssetOperations,
        covertActions: [
          {
            slotIndex: 0,
            mode: 'place_contact' as const,
            targetSource: 'character' as const,
          },
        ],
      },
    };
    const nextServerState = createEmptyWeekBoardControllerSyncedState();

    const merged = mergeWeekBoardControllerSyncedStateWithServer({
      currentState,
      previousServerState,
      nextServerState,
    });

    expect(merged.activityAssetOperations.covertActions).toEqual([
      {
        slotIndex: 0,
        mode: 'place_contact',
        targetSource: 'character',
      },
    ]);
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

  it('keeps local marketplace asset edits when stale server updates arrive', () => {
    const previousServerState = createEmptyWeekBoardControllerSyncedState();
    const currentState = {
      ...previousServerState,
      activityAssetOperations: {
        ...previousServerState.activityAssetOperations,
        marketplaces: [
          {
            slotIndex: 1,
            label: 'South Gate Market',
            purchaseSummary: 'Healing potions',
          },
        ],
      },
    };
    const nextServerState = createEmptyWeekBoardControllerSyncedState();

    const merged = mergeWeekBoardControllerSyncedStateWithServer({
      currentState,
      previousServerState,
      nextServerState,
    });

    expect(merged.activityAssetOperations.marketplaces).toEqual([
      {
        slotIndex: 1,
        label: 'South Gate Market',
        purchaseSummary: 'Healing potions',
      },
    ]);
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
