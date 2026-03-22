'use client';

import type { Id } from '@convex/_generated/dataModel';
import { areStringArraysEqual, mergeSyncedValue } from '~/components/week-board/sync-merge';

export type OfficerRole =
  | 'ambassador'
  | 'commandant'
  | 'marshal'
  | 'overseer'
  | 'spymaster'
  | 'strategist';

export type ActivityTeamOperationsDraft = {
  recruits: Array<{ slotIndex: number; teamId: string }>;
  dismissals: Array<{ slotIndex: number; teamId: string }>;
  upgrades: Array<{ slotIndex: number; fromTeamId: string; toTeamId: string }>;
};

export type ActivityOfficerOperationsDraft = {
  changes: Array<{
    slotIndex: number;
    role: OfficerRole;
    characterId?: Id<'character'>;
  }>;
};

export type WeekBoardControllerSyncedState = {
  upkeepAttritionTotal: string;
  upkeepNotorietyPenaltyTotal: string;
  maxNotorietyLoyaltyCheckTotal: string;
  nearestSettlementKey: string;
  upkeepTreasuryPenaltyTotal: string;
  eventChanceTotal: string;
  eventTriggerRollTotal: string;
  eventPercentileTotal: string;
  eventRollTwiceFirst: string;
  eventRollTwiceSecond: string;
  guaranteedEventFirstPercentileTotal: string;
  guaranteedEventSecondPercentileTotal: string;
  guaranteedEventChoice: 'first' | 'second' | '';
  sabotageCheckTotal: string;
  sabotageNotorietyIncreaseTotal: string;
  activityTeamOperations: ActivityTeamOperationsDraft;
  activityOfficerOperations: ActivityOfficerOperationsDraft;
  cacheDiscoveredMitigationTotal: string;
  theftMitigationTotal: string;
  sicknessTwiceLoyaltyTotal: string;
  turncoatOfficerCheckTotal: string;
  turncoatSelectedTeamId: string;
  missingInActionSelectedTeamId: string;
  sicknessSelectedTeamId: string;
  turnAroundBoostTeamId: string;
  rivalrySelectedTeamIds: string[];
};

export function createEmptyWeekBoardControllerSyncedState(): WeekBoardControllerSyncedState {
  return {
    upkeepAttritionTotal: '',
    upkeepNotorietyPenaltyTotal: '',
    maxNotorietyLoyaltyCheckTotal: '',
    nearestSettlementKey: '',
    upkeepTreasuryPenaltyTotal: '',
    eventChanceTotal: '',
    eventTriggerRollTotal: '',
    eventPercentileTotal: '',
    eventRollTwiceFirst: '',
    eventRollTwiceSecond: '',
    guaranteedEventFirstPercentileTotal: '',
    guaranteedEventSecondPercentileTotal: '',
    guaranteedEventChoice: '',
    sabotageCheckTotal: '',
    sabotageNotorietyIncreaseTotal: '',
    activityTeamOperations: {
      recruits: [],
      dismissals: [],
      upgrades: [],
    },
    activityOfficerOperations: {
      changes: [],
    },
    cacheDiscoveredMitigationTotal: '',
    theftMitigationTotal: '',
    sicknessTwiceLoyaltyTotal: '',
    turncoatOfficerCheckTotal: '',
    turncoatSelectedTeamId: '',
    missingInActionSelectedTeamId: '',
    sicknessSelectedTeamId: '',
    turnAroundBoostTeamId: '',
    rivalrySelectedTeamIds: [],
  };
}

export function mergeWeekBoardControllerSyncedStateWithServer({
  currentState,
  previousServerState,
  nextServerState,
  resetToServer = false,
}: {
  currentState: WeekBoardControllerSyncedState;
  previousServerState: WeekBoardControllerSyncedState;
  nextServerState: WeekBoardControllerSyncedState;
  resetToServer?: boolean;
}) {
  return {
    upkeepAttritionTotal: mergeSyncedValue({
      currentValue: currentState.upkeepAttritionTotal,
      previousServerValue: previousServerState.upkeepAttritionTotal,
      nextServerValue: nextServerState.upkeepAttritionTotal,
      resetToServer,
    }),
    upkeepNotorietyPenaltyTotal: mergeSyncedValue({
      currentValue: currentState.upkeepNotorietyPenaltyTotal,
      previousServerValue: previousServerState.upkeepNotorietyPenaltyTotal,
      nextServerValue: nextServerState.upkeepNotorietyPenaltyTotal,
      resetToServer,
    }),
    maxNotorietyLoyaltyCheckTotal: mergeSyncedValue({
      currentValue: currentState.maxNotorietyLoyaltyCheckTotal,
      previousServerValue: previousServerState.maxNotorietyLoyaltyCheckTotal,
      nextServerValue: nextServerState.maxNotorietyLoyaltyCheckTotal,
      resetToServer,
    }),
    nearestSettlementKey: mergeSyncedValue({
      currentValue: currentState.nearestSettlementKey,
      previousServerValue: previousServerState.nearestSettlementKey,
      nextServerValue: nextServerState.nearestSettlementKey,
      resetToServer,
    }),
    upkeepTreasuryPenaltyTotal: mergeSyncedValue({
      currentValue: currentState.upkeepTreasuryPenaltyTotal,
      previousServerValue: previousServerState.upkeepTreasuryPenaltyTotal,
      nextServerValue: nextServerState.upkeepTreasuryPenaltyTotal,
      resetToServer,
    }),
    eventChanceTotal: mergeSyncedValue({
      currentValue: currentState.eventChanceTotal,
      previousServerValue: previousServerState.eventChanceTotal,
      nextServerValue: nextServerState.eventChanceTotal,
      resetToServer,
    }),
    eventTriggerRollTotal: mergeSyncedValue({
      currentValue: currentState.eventTriggerRollTotal,
      previousServerValue: previousServerState.eventTriggerRollTotal,
      nextServerValue: nextServerState.eventTriggerRollTotal,
      resetToServer,
    }),
    eventPercentileTotal: mergeSyncedValue({
      currentValue: currentState.eventPercentileTotal,
      previousServerValue: previousServerState.eventPercentileTotal,
      nextServerValue: nextServerState.eventPercentileTotal,
      resetToServer,
    }),
    eventRollTwiceFirst: mergeSyncedValue({
      currentValue: currentState.eventRollTwiceFirst,
      previousServerValue: previousServerState.eventRollTwiceFirst,
      nextServerValue: nextServerState.eventRollTwiceFirst,
      resetToServer,
    }),
    eventRollTwiceSecond: mergeSyncedValue({
      currentValue: currentState.eventRollTwiceSecond,
      previousServerValue: previousServerState.eventRollTwiceSecond,
      nextServerValue: nextServerState.eventRollTwiceSecond,
      resetToServer,
    }),
    guaranteedEventFirstPercentileTotal: mergeSyncedValue({
      currentValue: currentState.guaranteedEventFirstPercentileTotal,
      previousServerValue: previousServerState.guaranteedEventFirstPercentileTotal,
      nextServerValue: nextServerState.guaranteedEventFirstPercentileTotal,
      resetToServer,
    }),
    guaranteedEventSecondPercentileTotal: mergeSyncedValue({
      currentValue: currentState.guaranteedEventSecondPercentileTotal,
      previousServerValue:
        previousServerState.guaranteedEventSecondPercentileTotal,
      nextServerValue: nextServerState.guaranteedEventSecondPercentileTotal,
      resetToServer,
    }),
    guaranteedEventChoice: mergeSyncedValue({
      currentValue: currentState.guaranteedEventChoice,
      previousServerValue: previousServerState.guaranteedEventChoice,
      nextServerValue: nextServerState.guaranteedEventChoice,
      resetToServer,
    }),
    sabotageCheckTotal: mergeSyncedValue({
      currentValue: currentState.sabotageCheckTotal,
      previousServerValue: previousServerState.sabotageCheckTotal,
      nextServerValue: nextServerState.sabotageCheckTotal,
      resetToServer,
    }),
    sabotageNotorietyIncreaseTotal: mergeSyncedValue({
      currentValue: currentState.sabotageNotorietyIncreaseTotal,
      previousServerValue: previousServerState.sabotageNotorietyIncreaseTotal,
      nextServerValue: nextServerState.sabotageNotorietyIncreaseTotal,
      resetToServer,
    }),
    activityTeamOperations: mergeSyncedValue({
      currentValue: currentState.activityTeamOperations,
      previousServerValue: previousServerState.activityTeamOperations,
      nextServerValue: nextServerState.activityTeamOperations,
      resetToServer,
      isEqual: areActivityTeamOperationsEqual,
    }),
    activityOfficerOperations: mergeSyncedValue({
      currentValue: currentState.activityOfficerOperations,
      previousServerValue: previousServerState.activityOfficerOperations,
      nextServerValue: nextServerState.activityOfficerOperations,
      resetToServer,
      isEqual: areActivityOfficerOperationsEqual,
    }),
    cacheDiscoveredMitigationTotal: mergeSyncedValue({
      currentValue: currentState.cacheDiscoveredMitigationTotal,
      previousServerValue: previousServerState.cacheDiscoveredMitigationTotal,
      nextServerValue: nextServerState.cacheDiscoveredMitigationTotal,
      resetToServer,
    }),
    theftMitigationTotal: mergeSyncedValue({
      currentValue: currentState.theftMitigationTotal,
      previousServerValue: previousServerState.theftMitigationTotal,
      nextServerValue: nextServerState.theftMitigationTotal,
      resetToServer,
    }),
    sicknessTwiceLoyaltyTotal: mergeSyncedValue({
      currentValue: currentState.sicknessTwiceLoyaltyTotal,
      previousServerValue: previousServerState.sicknessTwiceLoyaltyTotal,
      nextServerValue: nextServerState.sicknessTwiceLoyaltyTotal,
      resetToServer,
    }),
    turncoatOfficerCheckTotal: mergeSyncedValue({
      currentValue: currentState.turncoatOfficerCheckTotal,
      previousServerValue: previousServerState.turncoatOfficerCheckTotal,
      nextServerValue: nextServerState.turncoatOfficerCheckTotal,
      resetToServer,
    }),
    turncoatSelectedTeamId: mergeSyncedValue({
      currentValue: currentState.turncoatSelectedTeamId,
      previousServerValue: previousServerState.turncoatSelectedTeamId,
      nextServerValue: nextServerState.turncoatSelectedTeamId,
      resetToServer,
    }),
    missingInActionSelectedTeamId: mergeSyncedValue({
      currentValue: currentState.missingInActionSelectedTeamId,
      previousServerValue: previousServerState.missingInActionSelectedTeamId,
      nextServerValue: nextServerState.missingInActionSelectedTeamId,
      resetToServer,
    }),
    sicknessSelectedTeamId: mergeSyncedValue({
      currentValue: currentState.sicknessSelectedTeamId,
      previousServerValue: previousServerState.sicknessSelectedTeamId,
      nextServerValue: nextServerState.sicknessSelectedTeamId,
      resetToServer,
    }),
    turnAroundBoostTeamId: mergeSyncedValue({
      currentValue: currentState.turnAroundBoostTeamId,
      previousServerValue: previousServerState.turnAroundBoostTeamId,
      nextServerValue: nextServerState.turnAroundBoostTeamId,
      resetToServer,
    }),
    rivalrySelectedTeamIds: mergeSyncedValue({
      currentValue: currentState.rivalrySelectedTeamIds,
      previousServerValue: previousServerState.rivalrySelectedTeamIds,
      nextServerValue: nextServerState.rivalrySelectedTeamIds,
      resetToServer,
      isEqual: areStringArraysEqual,
    }),
  } satisfies WeekBoardControllerSyncedState;
}

function areActivityTeamOperationsEqual(
  left: ActivityTeamOperationsDraft,
  right: ActivityTeamOperationsDraft,
) {
  return (
    areTeamSelectionsEqual(left.recruits, right.recruits) &&
    areTeamSelectionsEqual(left.dismissals, right.dismissals) &&
    areUpgradeSelectionsEqual(left.upgrades, right.upgrades)
  );
}

function areActivityOfficerOperationsEqual(
  left: ActivityOfficerOperationsDraft,
  right: ActivityOfficerOperationsDraft,
) {
  const leftChanges = [...left.changes].sort((a, b) => a.slotIndex - b.slotIndex);
  const rightChanges = [...right.changes].sort((a, b) => a.slotIndex - b.slotIndex);

  if (leftChanges.length !== rightChanges.length) {
    return false;
  }

  return leftChanges.every((entry, index) => {
    const other = rightChanges[index];
    if (!other) {
      return false;
    }
    return (
      entry.slotIndex === other.slotIndex &&
      entry.role === other.role &&
      entry.characterId === other.characterId
    );
  });
}

function areTeamSelectionsEqual(
  left: Array<{ slotIndex: number; teamId: string }>,
  right: Array<{ slotIndex: number; teamId: string }>,
) {
  const leftSelections = [...left].sort((a, b) => a.slotIndex - b.slotIndex);
  const rightSelections = [...right].sort((a, b) => a.slotIndex - b.slotIndex);

  if (leftSelections.length !== rightSelections.length) {
    return false;
  }

  return leftSelections.every((entry, index) => {
    const other = rightSelections[index];
    if (!other) {
      return false;
    }
    return entry.slotIndex === other.slotIndex && entry.teamId === other.teamId;
  });
}

function areUpgradeSelectionsEqual(
  left: Array<{ slotIndex: number; fromTeamId: string; toTeamId: string }>,
  right: Array<{ slotIndex: number; fromTeamId: string; toTeamId: string }>,
) {
  const leftSelections = [...left].sort((a, b) => a.slotIndex - b.slotIndex);
  const rightSelections = [...right].sort((a, b) => a.slotIndex - b.slotIndex);

  if (leftSelections.length !== rightSelections.length) {
    return false;
  }

  return leftSelections.every((entry, index) => {
    const other = rightSelections[index];
    if (!other) {
      return false;
    }
    return (
      entry.slotIndex === other.slotIndex &&
      entry.fromTeamId === other.fromTeamId &&
      entry.toTeamId === other.toTeamId
    );
  });
}
