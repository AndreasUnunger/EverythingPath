'use client';

import type { Id } from '@convex/_generated/dataModel';
import {
  createEmptyActivityAssetOperationsDraft,
  type ActivityAssetOperationsDraft,
} from '~/components/week-board/activity-asset-operations';
import type { EventOverseerSupportTarget } from '~/components/week-board/officer-effects';
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
  activityAssetOperations: ActivityAssetOperationsDraft;
  cacheDiscoveredMitigationTotal: string;
  theftMitigationTotal: string;
  sicknessTwiceLoyaltyTotal: string;
  turncoatOfficerCheckTotal: string;
  turncoatSelectedTeamId: string;
  missingInActionSelectedTeamId: string;
  sicknessSelectedTeamId: string;
  turnAroundBoostTeamId: string;
  marketDayMarketplaceId: string;
  marketDayTownName: string;
  rivalrySelectedTeamIds: string[];
  overseerEventSupportTarget: EventOverseerSupportTarget | '';
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
    activityAssetOperations: createEmptyActivityAssetOperationsDraft(),
    cacheDiscoveredMitigationTotal: '',
    theftMitigationTotal: '',
    sicknessTwiceLoyaltyTotal: '',
    turncoatOfficerCheckTotal: '',
    turncoatSelectedTeamId: '',
    missingInActionSelectedTeamId: '',
    sicknessSelectedTeamId: '',
    turnAroundBoostTeamId: '',
    marketDayMarketplaceId: '',
    marketDayTownName: '',
    rivalrySelectedTeamIds: [],
    overseerEventSupportTarget: '',
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
    activityAssetOperations: mergeSyncedValue({
      currentValue: currentState.activityAssetOperations,
      previousServerValue: previousServerState.activityAssetOperations,
      nextServerValue: nextServerState.activityAssetOperations,
      resetToServer,
      isEqual: areActivityAssetOperationsEqual,
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
    marketDayMarketplaceId: mergeSyncedValue({
      currentValue: currentState.marketDayMarketplaceId,
      previousServerValue: previousServerState.marketDayMarketplaceId,
      nextServerValue: nextServerState.marketDayMarketplaceId,
      resetToServer,
    }),
    marketDayTownName: mergeSyncedValue({
      currentValue: currentState.marketDayTownName,
      previousServerValue: previousServerState.marketDayTownName,
      nextServerValue: nextServerState.marketDayTownName,
      resetToServer,
    }),
    rivalrySelectedTeamIds: mergeSyncedValue({
      currentValue: currentState.rivalrySelectedTeamIds,
      previousServerValue: previousServerState.rivalrySelectedTeamIds,
      nextServerValue: nextServerState.rivalrySelectedTeamIds,
      resetToServer,
      isEqual: areStringArraysEqual,
    }),
    overseerEventSupportTarget: mergeSyncedValue({
      currentValue: currentState.overseerEventSupportTarget,
      previousServerValue: previousServerState.overseerEventSupportTarget,
      nextServerValue: nextServerState.overseerEventSupportTarget,
      resetToServer,
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

function areActivityAssetOperationsEqual(
  left: ActivityAssetOperationsDraft,
  right: ActivityAssetOperationsDraft,
) {
  return (
    areRefugeSelectionsEqual(left.refuges, right.refuges) &&
    areCacheSelectionsEqual(left.caches, right.caches) &&
    areOrderSelectionsEqual(left.orders, right.orders) &&
    areMarketplaceSelectionsEqual(left.marketplaces, right.marketplaces) &&
    areCovertActionSelectionsEqual(left.covertActions, right.covertActions) &&
    areRescueSelectionsEqual(left.rescues, right.rescues) &&
    areRestorationSelectionsEqual(left.restorations, right.restorations)
  );
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

function areRefugeSelectionsEqual(
  left: Array<{ slotIndex: number; settlementKey: string }>,
  right: Array<{ slotIndex: number; settlementKey: string }>,
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
      entry.settlementKey === other.settlementKey
    );
  });
}

function areCacheSelectionsEqual(
  left: ActivityAssetOperationsDraft['caches'],
  right: ActivityAssetOperationsDraft['caches'],
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
      entry.mode === other.mode &&
      entry.cacheId === other.cacheId &&
      entry.label === other.label &&
      entry.cacheClass === other.cacheClass &&
      entry.location === other.location &&
      entry.contentsSummary === other.contentsSummary &&
      entry.isSecureLocation === other.isSecureLocation &&
      entry.checkTotal === other.checkTotal
    );
  });
}

function areOrderSelectionsEqual(
  left: ActivityAssetOperationsDraft['orders'],
  right: ActivityAssetOperationsDraft['orders'],
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
      entry.description === other.description &&
      entry.notes === other.notes &&
      entry.costPaid === other.costPaid &&
      entry.deliveryDays === other.deliveryDays
    );
  });
}

function areMarketplaceSelectionsEqual(
  left: ActivityAssetOperationsDraft['marketplaces'],
  right: ActivityAssetOperationsDraft['marketplaces'],
) {
  const leftEntries = [...left].sort((a, b) => a.slotIndex - b.slotIndex);
  const rightEntries = [...right].sort((a, b) => a.slotIndex - b.slotIndex);

  if (leftEntries.length !== rightEntries.length) {
    return false;
  }

  return leftEntries.every((entry, index) => {
    const other = rightEntries[index];
    if (!other) {
      return false;
    }
    return (
      entry.slotIndex === other.slotIndex &&
      entry.label === other.label &&
      entry.purchaseSummary === other.purchaseSummary &&
      entry.notes === other.notes
    );
  });
}

function areCovertActionSelectionsEqual(
  left: ActivityAssetOperationsDraft['covertActions'],
  right: ActivityAssetOperationsDraft['covertActions'],
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
      entry.mode === other.mode &&
      entry.targetSource === other.targetSource &&
      entry.followupSlotIndex === other.followupSlotIndex &&
      entry.characterId === other.characterId &&
      entry.displayName === other.displayName &&
      entry.personKind === other.personKind &&
      entry.siteName === other.siteName &&
      entry.notes === other.notes
    );
  });
}

function areRescueSelectionsEqual(
  left: ActivityAssetOperationsDraft['rescues'],
  right: ActivityAssetOperationsDraft['rescues'],
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
      entry.targetSource === other.targetSource &&
      entry.targetStatusId === other.targetStatusId &&
      entry.characterId === other.characterId &&
      entry.displayName === other.displayName &&
      entry.personKind === other.personKind &&
      entry.targetLevel === other.targetLevel &&
      entry.destinationType === other.destinationType &&
      entry.destinationSettlementKey === other.destinationSettlementKey
    );
  });
}

function areRestorationSelectionsEqual(
  left: ActivityAssetOperationsDraft['restorations'],
  right: ActivityAssetOperationsDraft['restorations'],
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
      entry.targetSource === other.targetSource &&
      entry.targetStatusId === other.targetStatusId &&
      entry.characterId === other.characterId &&
      entry.displayName === other.displayName &&
      entry.personKind === other.personKind &&
      entry.mode === other.mode &&
      entry.customCostTotal === other.customCostTotal
    );
  });
}
