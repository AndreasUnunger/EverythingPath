import type {
  ActivityPhaseViewModel,
  EventPhaseViewModel,
  PersistentPhaseViewModel,
  SummaryPhaseViewModel,
  UpkeepPhaseViewModel,
} from '~/components/week-board/phase-sections';
import {
  buildEventOccurrenceItems,
  buildOperationSummaryItems,
  buildStagedSlotItems,
  buildUpkeepSummaryItems,
  hasManualTotal,
} from '~/components/week-board/phase-sections/summary-phase-shared';
import { getManipulateEventsChoiceText } from '~/components/week-board/team-manager-effects';
import type { WeekBoardController } from '~/components/week-board/use-week-board-controller';
import { formatEventTypeLabel } from '~/lib/militia-state-options';
import { formatTeamIdLabel } from '~/lib/team-ids';
import type {
  TableAdjustment,
  WeeklyResolutionChange,
} from '~/lib/weekly-resolution-contract';

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
    officerEffects: controller.officerEffects,
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
}: {
  controller: WeekBoardController;
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
    stageAction: (slotIndex, actionId) => {
      void controller.setSlotAction(slotIndex, actionId);
    },
    militiaId: data.militiaId,
    rank: data.rank,
    focus: data.focus,
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
    activityAssetOperations: controller.activityAssetOperations,
    assignableCharacters: data.assignableCharacters ?? [],
    officerAssignments: data.officerAssignments ?? {},
    officerEffects: controller.officerEffects,
    strategistBonusActionId: controller.strategistBonusActionId,
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
    settlements: data.settlements ?? [],
    caches: data.caches ?? [],
    marketplaces: data.marketplaces ?? [],
    orders: data.orders ?? [],
    trackedPeople: data.trackedPeople ?? [],
    setRefugeSettlementForSlotAction: (slotIndex, settlementKey) => {
      controller.setRefugeSettlementForSlot(slotIndex, settlementKey);
    },
    setReduceDangerTargetForSlotAction: (slotIndex, settlementKey) => {
      controller.setReduceDangerTargetForSlot(slotIndex, settlementKey);
    },
    setSpreadPropagandaTargetForSlotAction: (slotIndex, settlementKey) => {
      controller.setSpreadPropagandaTargetForSlot(slotIndex, settlementKey);
    },
    setStrikeTeamForSlotAction: (args) => {
      controller.setStrikeTeamForSlot(args);
    },
    setCacheOperationForSlotAction: (args) => {
      controller.setCacheOperationForSlot(args);
    },
    setOrderForSlotAction: (args) => {
      controller.setOrderForSlot(args);
    },
    setMarketplaceForSlotAction: (args) => {
      controller.setMarketplaceForSlot(args);
    },
    setCovertActionForSlotAction: (args) => {
      controller.setCovertActionForSlot(args);
    },
    setRescueForSlotAction: (args) => {
      controller.setRescueForSlot(args);
    },
    setRestorationForSlotAction: (args) => {
      controller.setRestorationForSlot(args);
    },
    queueActivityRollTotalsPatchAction: ({ militiaId, activityRollTotals }) =>
      controller.actions.queueActivityRollTotalsPatch(militiaId, activityRollTotals),
    onErrorAction: (message) => controller.actions.setError(message),
  };
}

export function buildEventPhaseViewModel(
  controller: WeekBoardController,
): EventPhaseViewModel {
  const data = controller.data!;
  const manipulateEventsChoiceText = getManipulateEventsChoiceText({
    stagedActionIds: controller.stagedActionIds,
    slotTeams: controller.slotTeams,
  });
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
    marketplaces: data.marketplaces ?? [],
    manipulateEventsChoiceText,
    cacheDiscoveredMitigationTotal: controller.cacheDiscoveredMitigationTotal,
    setCacheDiscoveredMitigationTotalAction:
      controller.setCacheDiscoveredMitigationTotal,
    theftMitigationTotal: controller.theftMitigationTotal,
    setTheftMitigationTotalAction: controller.setTheftMitigationTotal,
    sicknessTwiceLoyaltyTotal: controller.sicknessTwiceLoyaltyTotal,
    setSicknessTwiceLoyaltyTotalAction: controller.setSicknessTwiceLoyaltyTotal,
    turncoatTrainingLossTotal: controller.turncoatTrainingLossTotal,
    setTurncoatTrainingLossTotalAction:
      controller.setTurncoatTrainingLossTotal,
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
    marketDayMarketplaceId: controller.marketDayMarketplaceId,
    setMarketDayMarketplaceIdAction: controller.setMarketDayMarketplaceId,
    marketDayTownName: controller.marketDayTownName,
    setMarketDayTownNameAction: controller.setMarketDayTownName,
    marketDayAppliesToAllTrackedMarketplaces:
      controller.marketDayAppliesToAllTrackedMarketplaces,
    rivalrySelectedTeamIds: controller.rivalrySelectedTeamIds,
    setRivalrySelectedTeamIdsAction: controller.setRivalrySelectedTeamIds,
    officerEffects: controller.officerEffects,
    overseerEventSupportTarget: controller.overseerEventSupportTarget,
    setOverseerEventSupportTargetAction: controller.setOverseerEventSupportTarget,
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
  const preview = data.resolutionPreview;
  const weekWarnings = readWeekWarnings(data.state);
  const marketDayMarketplaceLabel =
    (data.marketplaces ?? []).find(
      (marketplace) => marketplace._id === controller.marketDayMarketplaceId,
    )?.label ?? '';
  const eventInputItems = buildEventOccurrenceItems({
    eventChanceTotal: controller.eventChanceTotal,
    eventTriggerRollTotal: controller.eventTriggerRollTotal,
    hasGuaranteedEventAction: controller.hasGuaranteedEventAction,
    guaranteedEventFirstPercentileTotal:
      controller.guaranteedEventFirstPercentileTotal,
    guaranteedEventSecondPercentileTotal:
      controller.guaranteedEventSecondPercentileTotal,
    guaranteedEventChoice: controller.guaranteedEventChoice,
    sabotageCheckTotal: controller.sabotageCheckTotal,
    sabotageNotorietyIncreaseTotal:
      controller.sabotageNotorietyIncreaseTotal,
    cacheDiscoveredMitigationTotal:
      controller.cacheDiscoveredMitigationTotal,
    theftMitigationTotal: controller.theftMitigationTotal,
    sicknessTwiceLoyaltyTotal: controller.sicknessTwiceLoyaltyTotal,
    turncoatTrainingLossTotal: controller.turncoatTrainingLossTotal,
    turncoatOfficerCheckTotal: controller.turncoatOfficerCheckTotal,
    turncoatSelectedTeamId: controller.turncoatSelectedTeamId,
    missingInActionSelectedTeamId:
      controller.missingInActionSelectedTeamId,
    sicknessSelectedTeamId: controller.sicknessSelectedTeamId,
    turnAroundBoostTeamId: controller.turnAroundBoostTeamId,
    marketDayMarketplaceLabel,
    marketDayTownName: controller.marketDayTownName,
    marketDayAppliesToAllTrackedMarketplaces:
      controller.marketDayAppliesToAllTrackedMarketplaces,
    rivalrySelectedTeamIds: controller.rivalrySelectedTeamIds,
    overseerEventSupportTarget: controller.overseerEventSupportTarget,
    formatManualTotalForSummary: formatManualTotalForSummaryAction,
  });
  appendManualTotal(
    eventInputItems,
    'Event table roll',
    controller.eventPercentileTotal,
    formatManualTotalForSummaryAction,
  );
  appendManualTotal(
    eventInputItems,
    'Roll Twice: first roll',
    controller.eventRollTwiceFirst,
    formatManualTotalForSummaryAction,
  );
  appendManualTotal(
    eventInputItems,
    'Roll Twice: second roll',
    controller.eventRollTwiceSecond,
    formatManualTotalForSummaryAction,
  );

  return {
    startingMilitiaItems: [
      `Rank: ${data.rank}`,
      `Training: ${data.training}`,
      `Treasury: ${data.treasury}`,
      `Notoriety: ${data.notoriety}`,
    ],
    rulesBaselineItems: preview
      ? formatResolutionPlan(preview.baselinePlan)
      : [],
    tableAdjustmentItems:
      preview?.appliedAdjustments.map(formatTableAdjustment) ?? [],
    finalOutcomeItems: preview ? formatResolutionPlan(preview.finalPlan) : [],
    resolvedOutcomeItems: preview
      ? [
          `Next uneventful bonus: ${preview.summary.nextUneventfulBonusCarry}`,
          ...(preview.summary.resolvedEvents.length > 0
            ? preview.summary.resolvedEvents.map(
                (event) =>
                  `${event.rolledValue}: ${formatEventTypeLabel(event.eventType)}${event.isTwiceClause ? ' (Twice)' : ''}`,
              )
            : ['Events: None']),
        ]
      : [],
    attentionItems: [
      ...(data.resolutionPreviewWarnings ?? []),
      ...(preview?.missingInputs.map((input) => input.message) ?? []),
    ],
    warningItems: Array.from(
      new Set([
        ...weekWarnings.map((warning) => `Warning: ${warning.message}`),
        ...(preview?.warnings
          .filter((warning) => warning.code !== 'table_adjustment')
          .map((warning) => `Warning: ${warning.message}`) ?? []),
      ]),
    ),
    upkeepInputItems: buildUpkeepSummaryItems({
      upkeepAttritionTotal: controller.upkeepAttritionTotal,
      showMaxNotorietyPenalty: controller.showMaxNotorietyPenalty,
      upkeepNotorietyPenaltyTotal: controller.upkeepNotorietyPenaltyTotal,
      maxNotorietyLoyaltyCheckTotal:
        controller.maxNotorietyLoyaltyCheckTotal,
      nearestSettlementKey: controller.nearestSettlementKey,
      showTreasuryShortagePenalty: controller.showTreasuryShortagePenalty,
      upkeepTreasuryPenaltyTotal: controller.upkeepTreasuryPenaltyTotal,
      formatManualTotalForSummary: formatManualTotalForSummaryAction,
    }),
    activitySelectionItems: buildStagedSlotItems({
      slots: controller.slots,
      slotTeams: controller.slotTeams,
    }),
    stagedOperationItems: buildOperationSummaryItems({
      slots: controller.slots,
      activityTeamOperations: controller.activityTeamOperations,
      activityOfficerOperations: controller.activityOfficerOperations,
      activityAssetOperations: controller.activityAssetOperations,
    }),
    activityRollInputItems: controller.activityRollSummaryRows.map(
      (row) => `${row.label}: ${row.value}`,
    ),
    eventInputItems,
  };
}

function readWeekWarnings(state: unknown) {
  if (!state || typeof state !== 'object') return [];
  const warnings = (state as Record<string, unknown>).weekWarnings;
  if (!Array.isArray(warnings)) return [];
  return (warnings as unknown[]).filter(
    (warning: unknown): warning is { code: string; message: string } =>
      Boolean(
        warning &&
          typeof warning === 'object' &&
          'code' in warning &&
          'message' in warning &&
          typeof warning.code === 'string' &&
          typeof warning.message === 'string',
      ),
  );
}

function appendManualTotal(
  items: string[],
  label: string,
  raw: string,
  formatManualTotal: (raw: string) => string,
) {
  if (hasManualTotal(raw)) {
    items.push(`${label}: ${formatManualTotal(raw)}`);
  }
}

function formatResolutionPlan(plan: WeeklyResolutionChange[]) {
  return plan.map((change) => {
    switch (change.kind) {
      case 'militia_values':
        return `Militia: training ${change.training}, treasury ${change.treasury}, notoriety ${change.notoriety}`;
      case 'lower_settlement_reputation':
        return `Lower ${change.settlementKey} reputation by one step`;
      case 'set_settlement_reputation':
        return `Set ${change.settlementKey} reputation to ${change.reputation}`;
      case 'set_team_status':
        return `Set ${formatTeamIdLabel(change.teamId)} status to ${change.status}`;
      case 'add_event':
        return `Add ${formatEventTypeLabel(change.eventType)} event${change.isPersistent ? ' (persistent)' : ''}`;
      case 'resolve_event':
        return `Resolve ${formatEventTypeLabel(change.eventType)} event`;
      case 'recover_team':
        return `Recover ${formatTeamIdLabel(change.teamId)} (${change.source === 'paid_recovery' ? 'paid recovery' : 'returned from missing'})`;
      case 'remove_team':
        return `Remove ${formatTeamIdLabel(change.teamId)} (${change.source === 'permanently_lost' ? 'permanently lost' : 'dismissed'})`;
      case 'recruit_team':
        return `Recruit ${formatTeamIdLabel(change.teamId)}${change.addToRoster ? ' and add to roster' : ''}${change.initializeState ? ' with active state' : ''}`;
      case 'upgrade_team':
        return `Upgrade ${formatTeamIdLabel(change.fromTeamId)} to ${formatTeamIdLabel(change.toTeamId)}`;
    }
  });
}

function formatTableAdjustment(adjustment: TableAdjustment) {
  const reason = `Reason: ${adjustment.reason}`;
  switch (adjustment.kind) {
    case 'militia_value':
      return `${adjustment.operation === 'add' ? 'Add' : 'Set'} ${adjustment.value} ${adjustment.operation === 'add' ? 'to ' : 'as '}${adjustment.field}. ${reason}`;
    case 'settlement_reputation':
      return `Set ${adjustment.settlementKey} reputation to ${adjustment.reputation}. ${reason}`;
    case 'team_status':
      return `Set ${formatTeamIdLabel(adjustment.teamId)} status to ${adjustment.status}. ${reason}`;
    case 'event_status':
      return `${adjustment.operation === 'add' ? 'Add' : 'Resolve'} ${formatEventTypeLabel(adjustment.eventType)} event${adjustment.operation === 'add' && adjustment.isPersistent ? ' (persistent)' : ''}. ${reason}`;
  }
}
