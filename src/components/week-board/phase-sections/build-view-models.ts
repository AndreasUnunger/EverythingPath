import type {
  ActivityPhaseViewModel,
  EventPhaseViewModel,
  PersistentPhaseViewModel,
  SummaryPhaseViewModel,
  UpkeepPhaseViewModel,
} from '~/components/week-board/phase-sections';
import type { WeekBoardController } from '~/components/week-board/use-week-board-controller';

export function buildUpkeepPhaseViewModel(
  controller: WeekBoardController,
): UpkeepPhaseViewModel {
  const data = controller.data!;
  return {
    upkeepAttritionTotal: controller.upkeepAttritionTotal,
    setUpkeepAttritionTotalAction: controller.setUpkeepAttritionTotal,
    showMaxNotorietyPenalty: controller.showMaxNotorietyPenalty,
    upkeepNotorietyPenaltyTotal: controller.upkeepNotorietyPenaltyTotal,
    setUpkeepNotorietyPenaltyTotalAction: controller.setUpkeepNotorietyPenaltyTotal,
    maxNotorietyLoyaltyCheckTotal: controller.maxNotorietyLoyaltyCheckTotal,
    setMaxNotorietyLoyaltyCheckTotalAction:
      controller.setMaxNotorietyLoyaltyCheckTotal,
    nearestSettlementKey: controller.nearestSettlementKey,
    setNearestSettlementKeyAction: controller.setNearestSettlementKey,
    settlementKeys: data.settlementKeys ?? [],
    showTreasuryShortagePenalty: controller.showTreasuryShortagePenalty,
    upkeepTreasuryPenaltyTotal: controller.upkeepTreasuryPenaltyTotal,
    setUpkeepTreasuryPenaltyTotalAction: controller.setUpkeepTreasuryPenaltyTotal,
    minimumTreasury: controller.minimumTreasury,
    treasuryAmount: controller.treasuryAmount,
    setTreasuryAmountAction: controller.setTreasuryAmount,
    applyTreasuryUpdateAction: (mode) => {
      void controller.actions.applyTreasuryUpdate(mode);
    },
    applyRankUpAction: () => {
      void controller.actions.applyRankUp();
    },
    canRankUp: data.canRankUp,
    rankUpBlockedReason: data.rankUpBlockedReason,
  };
}

export function buildActivityPhaseViewModel({
  controller,
  organizationId,
}: {
  controller: WeekBoardController;
  organizationId: string;
}): ActivityPhaseViewModel {
  const data = controller.data!;
  return {
    dragState: controller.dragState,
    setDragStateAction: controller.setDragState,
    assignedActionIds: controller.assignedActionIds,
    hasNonLieLowStaged: controller.hasNonLieLowStaged,
    hasLieLowStaged: controller.hasLieLowStaged,
    slotRows: controller.slotRows,
    activeDropSlotId: controller.activeDropSlotId,
    slotRefs: controller.slotRefs,
    resetSlotsAction: () => {
      void controller.actions.resetSlots();
    },
    militiaId: data.militiaId,
    organizationId,
    rank: data.rank,
    treasury: data.treasury,
    maxTeams: data.maxTeams,
    stagedActionIds: controller.stagedActionIds,
    serverActivityTotals: controller.serverActivityTotals,
    slotTeams: controller.slotTeams,
    teams: controller.teams,
    activeTeamIds: controller.activeTeamIds,
    setSlotTeamAction: (slotIndex, teamId) => {
      void controller.setSlotTeam(slotIndex, teamId);
    },
    activityTeamOperations: controller.activityTeamOperations,
    activityOfficerOperations: controller.activityOfficerOperations,
    assignableCharacters: data.assignableCharacters ?? [],
    officerAssignments: data.officerAssignments ?? {},
    setRecruitTeamForSlotAction: (slotIndex, teamId) => {
      controller.setRecruitTeamForSlot(slotIndex, teamId);
    },
    setDismissTeamForSlotAction: (slotIndex, teamId) => {
      controller.setDismissTeamForSlot(slotIndex, teamId);
    },
    setUpgradeTeamsForSlotAction: (slotIndex, fromTeamId, toTeamId) => {
      controller.setUpgradeTeamsForSlot({ slotIndex, fromTeamId, toTeamId });
    },
    setOfficerChangeForSlotAction: ({ slotIndex, role, characterId }) => {
      controller.setOfficerChangeForSlot({ slotIndex, role, characterId });
    },
    onErrorAction: (message) => controller.actions.setError(message),
  };
}

export function buildEventPhaseViewModel(
  controller: WeekBoardController,
): EventPhaseViewModel {
  const data = controller.data!;
  return {
    eventChanceTotal: controller.eventChanceTotal,
    setEventChanceTotalAction: controller.setEventChanceTotal,
    eventTriggerRollTotal: controller.eventTriggerRollTotal,
    setEventTriggerRollTotalAction: controller.setEventTriggerRollTotal,
    eventPercentileTotal: controller.eventPercentileTotal,
    setEventPercentileTotalAction: controller.setEventPercentileTotal,
    effectiveEventPercentileTotal: controller.effectiveEventPercentileTotal,
    guaranteedEventFirstPercentileTotal:
      controller.guaranteedEventFirstPercentileTotal,
    setGuaranteedEventFirstPercentileTotalAction:
      controller.setGuaranteedEventFirstPercentileTotal,
    guaranteedEventSecondPercentileTotal:
      controller.guaranteedEventSecondPercentileTotal,
    setGuaranteedEventSecondPercentileTotalAction:
      controller.setGuaranteedEventSecondPercentileTotal,
    guaranteedEventChoice: controller.guaranteedEventChoice,
    setGuaranteedEventChoiceAction: controller.setGuaranteedEventChoice,
    showRollTwiceFields: controller.showRollTwiceFields,
    eventRollTwiceFirst: controller.eventRollTwiceFirst,
    setEventRollTwiceFirstAction: controller.setEventRollTwiceFirst,
    eventRollTwiceSecond: controller.eventRollTwiceSecond,
    setEventRollTwiceSecondAction: controller.setEventRollTwiceSecond,
    suggestedEventChanceTotal: controller.suggestedEventChanceTotal,
    rank: data.rank,
    eventWouldOccurBeforeSabotage: controller.eventWouldOccurBeforeSabotage,
    sabotageCheckTotal: controller.sabotageCheckTotal,
    setSabotageCheckTotalAction: controller.setSabotageCheckTotal,
    sabotageNotorietyIncreaseTotal: controller.sabotageNotorietyIncreaseTotal,
    setSabotageNotorietyIncreaseTotalAction:
      controller.setSabotageNotorietyIncreaseTotal,
    sabotageNegatesEvent: controller.sabotageNegatesEvent,
    shouldResolveEventTable: controller.shouldResolveEventTable,
    resolvedEventTrigger: controller.resolvedEventTrigger,
    hasGuaranteedEventAction: controller.hasGuaranteedEventAction,
    resolvedEvent: controller.resolvedEvent,
    resolvedRollTwiceFirst: controller.resolvedRollTwiceFirst,
    resolvedRollTwiceSecond: controller.resolvedRollTwiceSecond,
    resolvedEventNames: controller.resolvedEventNames,
    teams: controller.teams,
    cacheDiscoveredMitigationTotal: controller.cacheDiscoveredMitigationTotal,
    setCacheDiscoveredMitigationTotalAction:
      controller.setCacheDiscoveredMitigationTotal,
    theftMitigationTotal: controller.theftMitigationTotal,
    setTheftMitigationTotalAction: controller.setTheftMitigationTotal,
    sicknessTwiceLoyaltyTotal: controller.sicknessTwiceLoyaltyTotal,
    setSicknessTwiceLoyaltyTotalAction: controller.setSicknessTwiceLoyaltyTotal,
    turncoatOfficerCheckTotal: controller.turncoatOfficerCheckTotal,
    setTurncoatOfficerCheckTotalAction: controller.setTurncoatOfficerCheckTotal,
    turncoatSelectedTeamId: controller.turncoatSelectedTeamId,
    setTurncoatSelectedTeamIdAction: controller.setTurncoatSelectedTeamId,
    missingInActionSelectedTeamId: controller.missingInActionSelectedTeamId,
    setMissingInActionSelectedTeamIdAction:
      controller.setMissingInActionSelectedTeamId,
    sicknessSelectedTeamId: controller.sicknessSelectedTeamId,
    setSicknessSelectedTeamIdAction: controller.setSicknessSelectedTeamId,
    turnAroundBoostTeamId: controller.turnAroundBoostTeamId,
    setTurnAroundBoostTeamIdAction: controller.setTurnAroundBoostTeamId,
    rivalrySelectedTeamIds: controller.rivalrySelectedTeamIds,
    setRivalrySelectedTeamIdsAction: controller.setRivalrySelectedTeamIds,
    onPreviousWeekAction: () => {
      void controller.actions.goBackWeek();
    },
    previousWeekDisabled: data.state.weekNumber <= 1,
    continueLabel: controller.hasActivePersistentEvents
      ? 'Continue to Persistent'
      : 'Continue to Summary',
    onContinueAction: () => {
      void controller.actions.continueToSummary();
    },
  };
}

export function buildPersistentPhaseViewModel(
  controller: WeekBoardController,
): PersistentPhaseViewModel {
  const data = controller.data!;
  return {
    persistentEvents: data.activePersistentEvents ?? [],
    currentTreasury: data.treasury,
    buyoffCost: data.persistentBuyoff?.cost ?? 0,
    buyoffWeeksRemaining: data.persistentBuyoff?.weeksRemaining ?? 0,
    canBuyoffNow: data.persistentBuyoff?.canBuyoffNow ?? false,
    onBuyOffPersistentEventAction: (eventStateId) => {
      void controller.actions.buyOffPersistentEvent(eventStateId);
    },
  };
}

export function buildSummaryPhaseViewModel({
  controller,
  formatManualTotalForSummaryAction,
}: {
  controller: WeekBoardController;
  formatManualTotalForSummaryAction: (raw: string) => string;
}): SummaryPhaseViewModel {
  const data = controller.data!;
  return {
    rank: data.rank,
    training: data.training,
    treasury: data.treasury,
    notoriety: data.notoriety,
    upkeepAttritionTotal: controller.upkeepAttritionTotal,
    showMaxNotorietyPenalty: controller.showMaxNotorietyPenalty,
    upkeepNotorietyPenaltyTotal: controller.upkeepNotorietyPenaltyTotal,
    maxNotorietyLoyaltyCheckTotal: controller.maxNotorietyLoyaltyCheckTotal,
    nearestSettlementKey: controller.nearestSettlementKey,
    showTreasuryShortagePenalty: controller.showTreasuryShortagePenalty,
    upkeepTreasuryPenaltyTotal: controller.upkeepTreasuryPenaltyTotal,
    slots: controller.slots,
    activityRollSummaryRows: controller.activityRollSummaryRows,
    eventChanceTotal: controller.eventChanceTotal,
    eventTriggerRollTotal: controller.eventTriggerRollTotal,
    resolvedEventTrigger: controller.resolvedEventTrigger,
    shouldResolveEventTable: controller.shouldResolveEventTable,
    eventPercentileTotal: controller.eventPercentileTotal,
    effectiveEventPercentileTotal: controller.effectiveEventPercentileTotal,
    hasGuaranteedEventAction: controller.hasGuaranteedEventAction,
    guaranteedEventFirstPercentileTotal:
      controller.guaranteedEventFirstPercentileTotal,
    guaranteedEventSecondPercentileTotal:
      controller.guaranteedEventSecondPercentileTotal,
    guaranteedEventChoice: controller.guaranteedEventChoice,
    showRollTwiceFields: controller.showRollTwiceFields,
    eventRollTwiceFirst: controller.eventRollTwiceFirst,
    eventRollTwiceSecond: controller.eventRollTwiceSecond,
    sabotageCheckTotal: controller.sabotageCheckTotal,
    sabotageNotorietyIncreaseTotal: controller.sabotageNotorietyIncreaseTotal,
    activityTeamOperations: controller.activityTeamOperations,
    activityOfficerOperations: controller.activityOfficerOperations,
    slotTeams: controller.slotTeams,
    weekWarnings: Array.isArray(
      (controller.data?.state as Record<string, unknown>)?.weekWarnings,
    )
      ? ((controller.data?.state as Record<string, unknown>)
          .weekWarnings as unknown[]).filter(
          (warning): warning is { code: string; message: string } =>
            Boolean(
              warning &&
                typeof warning === 'object' &&
                'code' in warning &&
                'message' in warning &&
                typeof warning.code === 'string' &&
                typeof warning.message === 'string',
            ),
        )
      : [],
    cacheDiscoveredMitigationTotal: controller.cacheDiscoveredMitigationTotal,
    theftMitigationTotal: controller.theftMitigationTotal,
    sicknessTwiceLoyaltyTotal: controller.sicknessTwiceLoyaltyTotal,
    turncoatOfficerCheckTotal: controller.turncoatOfficerCheckTotal,
    turncoatSelectedTeamId: controller.turncoatSelectedTeamId,
    missingInActionSelectedTeamId: controller.missingInActionSelectedTeamId,
    sicknessSelectedTeamId: controller.sicknessSelectedTeamId,
    turnAroundBoostTeamId: controller.turnAroundBoostTeamId,
    rivalrySelectedTeamIds: controller.rivalrySelectedTeamIds,
    formatManualTotalForSummaryAction,
  };
}
