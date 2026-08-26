import {
  clampPercent,
  computeNextUneventfulBonusCarry,
  getQueuedOrganizationCheckModifier,
  getResolvedActivityCheckModifier,
  getTeamQueuedCheckModifier,
  getWeekModifiers,
  resolveEventFromPercentile,
  resolveWeekEvents,
  shouldApplyBaseEffect,
  type EventType,
  type QueueEffect,
  type ResolvedEvent,
} from '../../convex/weekResolution';
import { getTeamCost } from '../../convex/weekBoardRules';
import teamDefinitions from '../../convex/data/teams';
import type { TeamId } from './team-ids';

export const WEEKLY_RESOLUTION_RULESET_VERSION = 1;

export const WEEKLY_RESOLUTION_RULE_SOURCES = {
  weeklySequence: 'docs/ai/ironfang-militia/militia-rules.md#weekly-sequence-militias-in-play',
  upkeep: 'docs/ai/ironfang-militia/militia-rules.md#upkeep-phase',
  activity: 'docs/ai/ironfang-militia/militia-rules.md#activity-phase',
  event: 'docs/ai/ironfang-militia/militia-rules.md#event-phase',
  persistent: 'docs/ai/ironfang-militia/militia-rules.md#persistent-events-rules',
  advancement: 'docs/ai/ironfang-militia/militia-tables.md#table-6-1-militia-advancement',
  reputation: 'docs/ai/ironfang-militia/militia-tables.md#table-6-2-reputation',
  events: 'docs/ai/ironfang-militia/militia-tables.md#table-6-3-militia-events-d',
} as const;

export type WeeklyResolutionWarning = {
  code: string;
  message: string;
  ruleSource?: string;
};

export type WeeklyResolutionMissingInput = {
  path: string;
  message: string;
  ruleSource?: string;
};

export type TableAdjustment =
  | {
      kind: 'militia_value';
      field: 'training' | 'treasury' | 'notoriety';
      operation: 'add' | 'set';
      value: number;
      reason: string;
    }
  | {
      kind: 'settlement_reputation';
      settlementKey: string;
      reputation: 'Hostile' | 'Unfriendly' | 'Indifferent' | 'Friendly' | 'Helpful';
      reason: string;
    }
  | {
      kind: 'team_status';
      teamId: TeamId;
      status: 'active' | 'disabled' | 'missing' | 'blocked';
      reason: string;
    }
  | {
      kind: 'event_status';
      eventType: EventType;
      operation: 'add';
      isPersistent: boolean;
      reason: string;
    }
  | {
      kind: 'event_status';
      eventType: EventType;
      operation: 'resolve';
      reason: string;
    };

export type WeeklyResolutionChange =
  | {
      kind: 'militia_values';
      training: number;
      treasury: number;
      notoriety: number;
    }
  | {
      kind: 'lower_settlement_reputation';
      settlementKey: string;
    }
  | {
      kind: 'set_settlement_reputation';
      settlementKey: string;
      reputation: 'Hostile' | 'Unfriendly' | 'Indifferent' | 'Friendly' | 'Helpful';
    }
  | {
      kind: 'set_team_status';
      teamId: TeamId;
      status: 'active' | 'disabled' | 'missing' | 'blocked';
    }
  | {
      kind: 'add_event';
      eventType: EventType;
      isPersistent: boolean;
    }
  | {
      kind: 'resolve_event';
      eventType: EventType;
    };

export type WeeklyResolutionDraft = {
  revision: number;
  weekNumber: number;
  uneventfulBonusCarry: number;
  stagedActivityActionIds: (string | null)[];
  stagedActivityTeamIds?: (string | null)[];
  upkeepRollTotals?: {
    attritionTotal?: number;
    notorietyPenaltyTotal?: number;
    maxNotorietyLoyaltyCheckTotal?: number;
    nearestSettlementKey?: string;
    treasuryPenaltyTotal?: number;
  };
  activityRollTotals?: {
    activateBlackMarketCheckTotal?: number;
    drillMilitiaTrainingGainTotal?: number;
    dismissTeamCheckTotal?: number;
    earnGoldCheckTotal?: number;
    earnGoldTotal?: number;
    activateBlackMarketNotorietyIncreaseTotal?: number;
    dismissTeamNotorietyIncreaseTotal?: number;
    earnGoldNotorietyIncreaseTotal?: number;
    gatherInformationCheckTotal?: number;
    gatherInformationNotorietyIncreaseTotal?: number;
    guaranteeEventNotorietyIncreaseTotal?: number;
    recruitTeamCheckTotal?: number;
    recruitTeamNotorietyIncreaseTotal?: number;
    reduceDangerCheckTotal?: number;
    reduceDangerNotorietyIncreaseTotal?: number;
    rescueCharacterCheckTotal?: number;
    rescueCharacterTargetLevelTotal?: number;
    rescueCharacterNotorietyIncreaseTotal?: number;
    restoreCharacterCostTotal?: number;
    specialActionCostTotal?: number;
    specialOrderItemCostTotal?: number;
  };
  activityAssetOperations?: {
    covertActions?: Array<{
      slotIndex: number;
      mode?: 'augment_action' | 'place_contact';
      followupSlotIndex?: number;
    }>;
    rescues?: Array<{
      slotIndex: number;
      targetLevel?: number;
    }>;
    restorations?: Array<{
      slotIndex: number;
      mode?:
        | 'party_ability_damage'
        | 'party_hit_points'
        | 'party_lesser_restorative'
        | 'break_enchantment'
        | 'raise_dead'
        | 'restoration'
        | 'stone_to_flesh'
        | 'custom';
      customCostTotal?: number;
    }>;
    orders?: Array<{
      slotIndex: number;
      costPaid?: number;
    }>;
  };
  activityTeamOperations?: {
    recruits: Array<{ slotIndex: number; teamId: string }>;
    dismissals?: Array<{ slotIndex: number; teamId: string }>;
    upgrades?: Array<{ slotIndex: number; fromTeamId: string; toTeamId: string }>;
  };
  upkeepTeamOperations?: {
    disabledRecoveries?: Array<{ teamId: string; paid: boolean }>;
    missingChecks?: Array<{
      teamId: string;
      securityCheckTotal?: number;
      permanentlyLost?: boolean;
    }>;
  };
  eventMitigations?: {
    theftMitigationTotal?: number;
    turncoatTrainingLossTotal?: number;
  };
  eventRollTotals?: {
    eventChanceTotal?: number;
    eventTriggerRollTotal?: number;
    eventPercentileTotal?: number;
    rollTwiceFirstTotal?: number;
    rollTwiceSecondTotal?: number;
    guaranteedFirstPercentileTotal?: number;
    guaranteedSecondPercentileTotal?: number;
    guaranteedChosen?: 'first' | 'second';
    sabotageCheckTotal?: number;
    sabotageNotorietyIncreaseTotal?: number;
  };
  tableAdjustments?: TableAdjustment[];
};

export type WeeklyResolutionSnapshot = {
  militia: {
    rank: number;
    training: number;
    treasury: number;
    notoriety: number;
  };
  activeQueuedEffects: QueueEffect[];
  activePersistentEventTypes: EventType[];
  rosterTeamIds?: string[];
  teamStatuses?: Array<{
    teamId: string;
    status: 'active' | 'disabled' | 'missing' | 'blocked';
  }>;
};

export type WeeklyResolutionResult = {
  status: 'ready' | 'incomplete';
  rulesetVersion: number;
  draftRevision: number;
  missingInputs: WeeklyResolutionMissingInput[];
  warnings: WeeklyResolutionWarning[];
  baselinePlan: WeeklyResolutionChange[];
  appliedAdjustments: TableAdjustment[];
  finalPlan: WeeklyResolutionChange[];
  summary: {
    militia: {
      training: number;
      treasury: number;
      notoriety: number;
    };
    nextUneventfulBonusCarry: number;
    resolvedEvents: ResolvedEvent[];
  };
};

export function resolveWeeklyDraft({
  draft,
  snapshot,
}: {
  draft: WeeklyResolutionDraft;
  snapshot: WeeklyResolutionSnapshot;
}): WeeklyResolutionResult {
  const missingInputs = collectMissingInputs(draft);
  const warnings = collectAdjustmentWarnings(draft.tableAdjustments ?? []);
  const upkeep = draft.upkeepRollTotals ?? {};
  const activity = draft.activityRollTotals ?? {};
  const eventMitigations = draft.eventMitigations ?? {};
  const event = draft.eventRollTotals ?? {};
  const modifiers = getWeekModifiers({
    activeQueuedEffects: snapshot.activeQueuedEffects,
    activePersistentEventTypes: snapshot.activePersistentEventTypes,
  });

  let training = snapshot.militia.training;
  let treasury = snapshot.militia.treasury;
  let notoriety = normalizeNotoriety(snapshot.militia.notoriety);

  training -= (upkeep.attritionTotal ?? 0) * modifiers.attritionMultiplier;
  training -= upkeep.notorietyPenaltyTotal ?? 0;
  training -= upkeep.treasuryPenaltyTotal ?? 0;
  training +=
    (activity.drillMilitiaTrainingGainTotal ?? 0) *
    modifiers.activityTrainingGainMultiplier;
  treasury += (activity.earnGoldTotal ?? 0) * modifiers.incomeMultiplier;

  if (draft.stagedActivityActionIds.includes('guarantee_event')) {
    notoriety += activity.guaranteeEventNotorietyIncreaseTotal ?? 0;
  }

  const guaranteedByAction =
    draft.stagedActivityActionIds.includes('guarantee_event') ||
    draft.stagedActivityActionIds.includes('manipulate_events');
  const occurredBeforeSabotage = eventWouldOccur({
    chanceTotal: event.eventChanceTotal,
    triggerRollTotal: event.eventTriggerRollTotal,
    guaranteedByAction,
  });

  let eventOccurred = modifiers.forceAllIsCalm ? true : occurredBeforeSabotage;
  if (
    !modifiers.forceAllIsCalm &&
    occurredBeforeSabotage &&
    event.sabotageCheckTotal !== undefined
  ) {
    notoriety += event.sabotageNotorietyIncreaseTotal ?? 0;
    if (event.sabotageCheckTotal >= 15 + snapshot.militia.rank) {
      eventOccurred = false;
    }
  }

  const resolvedEvents = modifiers.forceAllIsCalm
    ? ([
        {
          eventType: 'all_is_calm',
          rolledValue: 45,
          isTwiceClause: true,
        },
      ] as ResolvedEvent[])
    : resolveWeekEvents({
        eventOccurred,
        guaranteedByAction,
        eventPercentileTotal: event.eventPercentileTotal,
        rollTwiceFirstTotal: event.rollTwiceFirstTotal,
        rollTwiceSecondTotal: event.rollTwiceSecondTotal,
        guaranteedFirstPercentileTotal: event.guaranteedFirstPercentileTotal,
        guaranteedSecondPercentileTotal: event.guaranteedSecondPercentileTotal,
        guaranteedChosen: event.guaranteedChosen,
      });

  const autoEventCount = snapshot.activeQueuedEffects.reduce((count, effect) => {
    if (effect.kind === 'auto_event_roll_once') return count + 1;
    if (effect.kind === 'auto_event_roll_twice') return count + 2;
    return count;
  }, 0);
  const autoEventRolls = [event.rollTwiceFirstTotal, event.rollTwiceSecondTotal]
    .slice(0, autoEventCount)
    .map((raw) => resolveEventFromPercentile(raw))
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .filter((value) => value.eventType !== 'roll_twice');
  resolvedEvents.push(...autoEventRolls);

  const resolvedActivityCheckModifier = getResolvedActivityCheckModifier({
    resolvedEvents,
  });
  const effectiveActivityCheckTotal = ({
    rawTotal,
    checkType,
    slotIndex,
  }: {
    rawTotal?: number;
    checkType: 'loyalty' | 'security' | 'secrecy';
    slotIndex?: number;
  }) => {
    if (rawTotal === undefined) return undefined;
    const teamId =
      slotIndex === undefined
        ? undefined
        : (draft.stagedActivityTeamIds?.[slotIndex] ?? undefined);
    return (
      rawTotal +
      resolvedActivityCheckModifier +
      getQueuedOrganizationCheckModifier({
        activeQueuedEffects: snapshot.activeQueuedEffects,
        activePersistentEventTypes: snapshot.activePersistentEventTypes,
        checkType,
      }) +
      getTeamQueuedCheckModifier({
        activeQueuedEffects: snapshot.activeQueuedEffects,
        teamId,
      })
    );
  };
  const successfulCovertAugmentTargets = getSuccessfulCovertAugmentTargets({
    draft,
    effectiveActivityCheckTotal,
  });

  notoriety += successfulCovertAugmentTargets.has('activate_black_market')
    ? 0
    : (activity.activateBlackMarketNotorietyIncreaseTotal ?? 0);
  notoriety += successfulCovertAugmentTargets.has('dismiss_team')
    ? 0
    : (activity.dismissTeamNotorietyIncreaseTotal ?? 0);
  notoriety += successfulCovertAugmentTargets.has('earn_gold')
    ? 0
    : (activity.earnGoldNotorietyIncreaseTotal ?? 0);
  notoriety += successfulCovertAugmentTargets.has('gather_information')
    ? 0
    : (activity.gatherInformationNotorietyIncreaseTotal ?? 0);
  notoriety += successfulCovertAugmentTargets.has('recruit_team')
    ? 0
    : (activity.recruitTeamNotorietyIncreaseTotal ?? 0);
  notoriety += successfulCovertAugmentTargets.has('reduce_danger')
    ? 0
    : (activity.reduceDangerNotorietyIncreaseTotal ?? 0);
  notoriety += successfulCovertAugmentTargets.has('rescue_character')
    ? 0
    : (activity.rescueCharacterNotorietyIncreaseTotal ?? 0);

  let usedTheftMitigation = false;
  for (const resolved of resolvedEvents) {
    if (resolved.eventType === 'war_games' && shouldApplyBaseEffect(resolved)) {
      training += snapshot.militia.rank;
    }
    if (resolved.eventType === 'theft' && shouldApplyBaseEffect(resolved)) {
      const canUseTheftMitigation: boolean =
        !usedTheftMitigation &&
        (eventMitigations.theftMitigationTotal ?? -Infinity) >= 20;
      treasury = canUseTheftMitigation
        ? Math.floor(treasury * 0.9)
        : Math.floor(treasury / 2);
      usedTheftMitigation = canUseTheftMitigation;
    }
    if (resolved.eventType === 'turncoat' && shouldApplyBaseEffect(resolved)) {
      training -= eventMitigations.turncoatTrainingLossTotal ?? 0;
    }
  }

  const resourceCosts = resolveMilitiaResourceCosts({
    draft,
    snapshot,
    effectiveActivityCheckTotal,
  });
  treasury -= resourceCosts.treasuryCost;
  notoriety -= resourceCosts.notorietyReduction;

  const nextUneventfulBonusCarry = computeNextUneventfulBonusCarry({
    weekNumber: draft.weekNumber,
    currentCarry: draft.uneventfulBonusCarry,
    rank: snapshot.militia.rank,
    eventOccurred,
    resolvedEvents,
  });
  const nearestSettlementKey = upkeep.nearestSettlementKey?.trim();
  const baselinePlan: WeeklyResolutionChange[] = [
    {
      kind: 'militia_values',
      training,
      treasury,
      notoriety,
    },
  ];
  if (
    normalizeNotoriety(snapshot.militia.notoriety) >= 100 &&
    upkeep.maxNotorietyLoyaltyCheckTotal !== undefined &&
    upkeep.maxNotorietyLoyaltyCheckTotal < 15 &&
    nearestSettlementKey
  ) {
    baselinePlan.push({
      kind: 'lower_settlement_reputation',
      settlementKey: nearestSettlementKey,
    });
  }

  const finalPlan = applyTableAdjustmentsToPlan(
    baselinePlan,
    draft.tableAdjustments ?? [],
  );
  const finalMilitia = getMilitiaValuesFromPlan(finalPlan);

  return {
    status: missingInputs.length === 0 ? 'ready' : 'incomplete',
    rulesetVersion: WEEKLY_RESOLUTION_RULESET_VERSION,
    draftRevision: draft.revision,
    missingInputs,
    warnings,
    baselinePlan,
    appliedAdjustments: draft.tableAdjustments ?? [],
    finalPlan,
    summary: {
      militia: finalMilitia,
      nextUneventfulBonusCarry,
      resolvedEvents,
    },
  };
}

function resolveMilitiaResourceCosts({
  draft,
  snapshot,
  effectiveActivityCheckTotal,
}: {
  draft: WeeklyResolutionDraft;
  snapshot: WeeklyResolutionSnapshot;
  effectiveActivityCheckTotal: (args: {
    rawTotal?: number;
    checkType: 'loyalty' | 'security' | 'secrecy';
    slotIndex?: number;
  }) => number | undefined;
}) {
  const activity = draft.activityRollTotals ?? {};
  const activityAssets = draft.activityAssetOperations ?? {};
  const activityTeams = draft.activityTeamOperations ?? { recruits: [] };
  const upkeepTeams = draft.upkeepTeamOperations ?? {};
  const stagedActionIds = draft.stagedActivityActionIds.filter(
    (value): value is string => value !== null,
  );
  const countAction = (actionId: string) =>
    stagedActionIds.filter((value) => value === actionId).length;
  const minimumTreasury = snapshot.militia.rank * 10;

  let treasuryCost = 0;
  treasuryCost += countAction('activate_black_market') * 50;
  treasuryCost += countAction('broker_market') * 100;
  treasuryCost += countAction('spread_propaganda') * 100;
  treasuryCost += countAction('drill_militia') * minimumTreasury;
  treasuryCost += countAction('guarantee_event') * minimumTreasury;

  const stagedRestoreCost = (activityAssets.restorations ?? []).reduce(
    (sum, restoration) =>
      draft.stagedActivityActionIds[restoration.slotIndex] === 'restore_character'
        ? sum +
          (restoration.customCostTotal ??
            getRestoreCharacterCostForMode(restoration.mode))
        : sum,
    0,
  );
  treasuryCost +=
    stagedRestoreCost !== 0
      ? stagedRestoreCost
      : (activity.restoreCharacterCostTotal ?? 0);
  treasuryCost += activity.specialActionCostTotal ?? 0;

  const stagedOrderCost = (activityAssets.orders ?? []).reduce(
    (sum, order) =>
      draft.stagedActivityActionIds[order.slotIndex] === 'special_order'
        ? sum + (order.costPaid ?? 0)
        : sum,
    0,
  );
  treasuryCost +=
    stagedOrderCost !== 0
      ? stagedOrderCost
      : (activity.specialOrderItemCostTotal ?? 0);

  const rosterTeamIds = new Set(snapshot.rosterTeamIds ?? []);
  const teamStatuses = new Map(
    (snapshot.teamStatuses ?? []).map((state) => [state.teamId, state.status]),
  );

  for (const recovery of upkeepTeams.disabledRecoveries ?? []) {
    if (!recovery.paid || teamStatuses.get(recovery.teamId) !== 'disabled') continue;
    treasuryCost += minimumTreasury;
    teamStatuses.set(recovery.teamId, 'active');
  }

  for (const missingCheck of upkeepTeams.missingChecks ?? []) {
    if (teamStatuses.get(missingCheck.teamId) !== 'missing') continue;
    if (missingCheck.permanentlyLost) {
      rosterTeamIds.delete(missingCheck.teamId);
      teamStatuses.delete(missingCheck.teamId);
      continue;
    }
    if (
      missingCheck.securityCheckTotal !== undefined &&
      missingCheck.securityCheckTotal >= 15
    ) {
      teamStatuses.set(missingCheck.teamId, 'active');
    }
  }

  const dismissSucceeded =
    (effectiveActivityCheckTotal({
      rawTotal: activity.dismissTeamCheckTotal,
      checkType: 'loyalty',
    }) ?? -Infinity) >= 10;
  if (dismissSucceeded) {
    for (const dismissal of activityTeams.dismissals ?? []) {
      rosterTeamIds.delete(dismissal.teamId);
      teamStatuses.delete(dismissal.teamId);
    }
  }

  for (const recruit of activityTeams.recruits) {
    const recruitDc = RECRUITMENT_DC_BY_TEAM_ID.get(recruit.teamId);
    const checkType = RECRUITMENT_CHECK_TYPE_BY_TEAM_ID.get(recruit.teamId) ?? 'loyalty';
    const succeeded =
      recruitDc !== undefined &&
      (effectiveActivityCheckTotal({
        rawTotal: activity.recruitTeamCheckTotal,
        checkType,
        slotIndex: recruit.slotIndex,
      }) ?? -Infinity) >= recruitDc;
    if (!succeeded || rosterTeamIds.has(recruit.teamId)) continue;
    rosterTeamIds.add(recruit.teamId);
    teamStatuses.set(recruit.teamId, 'active');
    treasuryCost += getTeamCost(recruit.teamId);
  }

  for (const upgrade of activityTeams.upgrades ?? []) {
    if (!rosterTeamIds.has(upgrade.fromTeamId)) continue;
    treasuryCost += getTeamCost(upgrade.toTeamId);
    rosterTeamIds.delete(upgrade.fromTeamId);
    rosterTeamIds.add(upgrade.toTeamId);
    const status = teamStatuses.get(upgrade.fromTeamId);
    teamStatuses.delete(upgrade.fromTeamId);
    if (status) teamStatuses.set(upgrade.toTeamId, status);
  }

  return {
    treasuryCost,
    notorietyReduction:
      countAction('lie_low') > 0 ? (snapshot.rosterTeamIds?.length ?? 0) : 0,
  };
}

function getRestoreCharacterCostForMode(
  mode:
    | 'party_ability_damage'
    | 'party_hit_points'
    | 'party_lesser_restorative'
    | 'break_enchantment'
    | 'raise_dead'
    | 'restoration'
    | 'stone_to_flesh'
    | 'custom'
    | undefined,
) {
  if (mode === 'party_ability_damage') return 0;
  if (mode === 'party_hit_points') return 0;
  if (mode === 'party_lesser_restorative') return 0;
  if (mode === 'break_enchantment') return 1125;
  if (mode === 'raise_dead') return 6125;
  if (mode === 'restoration') return 1700;
  if (mode === 'stone_to_flesh') return 1650;
  return 0;
}

function collectMissingInputs(
  draft: WeeklyResolutionDraft,
): WeeklyResolutionMissingInput[] {
  const missing: WeeklyResolutionMissingInput[] = [];
  for (const [index, adjustment] of (draft.tableAdjustments ?? []).entries()) {
    if (adjustment.reason.trim().length === 0) {
      missing.push({
        path: `tableAdjustments.${index}.reason`,
        message: 'Table Adjustments require a reason.',
      });
    }
  }
  return missing;
}

function collectAdjustmentWarnings(
  adjustments: TableAdjustment[],
): WeeklyResolutionWarning[] {
  return adjustments.map((adjustment) => ({
    code: 'table_adjustment',
    message: adjustment.reason,
  }));
}

export function applyTableAdjustmentsToPlan(
  baselinePlan: WeeklyResolutionChange[],
  adjustments: TableAdjustment[],
) {
  const finalPlan = baselinePlan.map((change) => ({ ...change }));
  const militia = getMilitiaValuesFromPlan(finalPlan);

  for (const adjustment of adjustments) {
    if (adjustment.kind === 'militia_value') {
      militia[adjustment.field] =
        adjustment.operation === 'set'
          ? adjustment.value
          : militia[adjustment.field] + adjustment.value;
      continue;
    }
    if (adjustment.kind === 'settlement_reputation') {
      finalPlan.push({
        kind: 'set_settlement_reputation',
        settlementKey: adjustment.settlementKey,
        reputation: adjustment.reputation,
      });
      continue;
    }
    if (adjustment.kind === 'team_status') {
      finalPlan.push({
        kind: 'set_team_status',
        teamId: adjustment.teamId,
        status: adjustment.status,
      });
      continue;
    }
    if (adjustment.operation === 'add') {
      finalPlan.push({
        kind: 'add_event',
        eventType: adjustment.eventType,
        isPersistent: adjustment.isPersistent,
      });
    } else {
      finalPlan.push({
        kind: 'resolve_event',
        eventType: adjustment.eventType,
      });
    }
  }

  const militiaChangeIndex = finalPlan.findIndex(
    (change) => change.kind === 'militia_values',
  );
  finalPlan[militiaChangeIndex] = { kind: 'militia_values', ...militia };
  return finalPlan;
}

export function getMilitiaValuesFromPlan(plan: WeeklyResolutionChange[]) {
  const change = plan.find(
    (candidate): candidate is Extract<WeeklyResolutionChange, { kind: 'militia_values' }> =>
      candidate.kind === 'militia_values',
  );
  if (!change) {
    throw new Error('Weekly Resolution plan is missing militia values.');
  }
  return {
    training: change.training,
    treasury: change.treasury,
    notoriety: change.notoriety,
  };
}

function eventWouldOccur({
  chanceTotal,
  triggerRollTotal,
  guaranteedByAction,
}: {
  chanceTotal?: number;
  triggerRollTotal?: number;
  guaranteedByAction: boolean;
}) {
  if (guaranteedByAction) return true;
  if (chanceTotal === undefined || triggerRollTotal === undefined) return false;
  return clampPercent(triggerRollTotal) < clampPercent(chanceTotal);
}

const RECRUITMENT_DC_BY_TEAM_ID = new Map(
  teamDefinitions
    .filter((team) => team.recruitment)
    .map((team) => [team.id, team.recruitment!.dc]),
);
const RECRUITMENT_CHECK_TYPE_BY_TEAM_ID = new Map(
  teamDefinitions
    .filter((team) => team.recruitment)
    .map((team) => [
      team.id,
      team.recruitment!.check.toLowerCase() as
        | 'loyalty'
        | 'security'
        | 'secrecy',
    ]),
);

function getSuccessfulCovertAugmentTargets({
  draft,
  effectiveActivityCheckTotal,
}: {
  draft: WeeklyResolutionDraft;
  effectiveActivityCheckTotal: (args: {
    rawTotal?: number;
    checkType: 'loyalty' | 'security' | 'secrecy';
    slotIndex?: number;
  }) => number | undefined;
}) {
  const successfulTargets = new Set<string>();
  const covertActions = draft.activityAssetOperations?.covertActions ?? [];
  const rescueEntries = draft.activityAssetOperations?.rescues ?? [];
  const recruitEntries = draft.activityTeamOperations?.recruits ?? [];
  const activity = draft.activityRollTotals ?? {};

  for (const covertAction of covertActions) {
    if (
      draft.stagedActivityActionIds[covertAction.slotIndex] !== 'covert_action' ||
      covertAction.mode !== 'augment_action'
    ) {
      continue;
    }
    const targetSlotIndex =
      covertAction.followupSlotIndex ??
      draft.stagedActivityActionIds.findIndex(
        (actionId, index) => index > covertAction.slotIndex && actionId !== null,
      );
    if (targetSlotIndex < 0) continue;

    const targetActionId = draft.stagedActivityActionIds[targetSlotIndex];
    if (!targetActionId) continue;

    let succeeded = false;
    if (targetActionId === 'activate_black_market') {
      succeeded =
        (effectiveActivityCheckTotal({
          rawTotal: activity.activateBlackMarketCheckTotal,
          checkType: 'secrecy',
          slotIndex: targetSlotIndex,
        }) ?? -Infinity) >= 20;
    } else if (targetActionId === 'dismiss_team') {
      succeeded =
        (effectiveActivityCheckTotal({
          rawTotal: activity.dismissTeamCheckTotal,
          checkType: 'loyalty',
          slotIndex: targetSlotIndex,
        }) ?? -Infinity) >= 10;
    } else if (targetActionId === 'earn_gold') {
      succeeded = activity.earnGoldCheckTotal !== undefined;
    } else if (targetActionId === 'gather_information') {
      succeeded =
        (effectiveActivityCheckTotal({
          rawTotal: activity.gatherInformationCheckTotal,
          checkType: 'secrecy',
          slotIndex: targetSlotIndex,
        }) ?? -Infinity) >= 15;
    } else if (targetActionId === 'recruit_team') {
      const recruitEntry = recruitEntries.find(
        (entry) => entry.slotIndex === targetSlotIndex,
      );
      const dc = recruitEntry?.teamId
        ? RECRUITMENT_DC_BY_TEAM_ID.get(recruitEntry.teamId)
        : undefined;
      const checkType = recruitEntry?.teamId
        ? (RECRUITMENT_CHECK_TYPE_BY_TEAM_ID.get(recruitEntry.teamId) ??
          'loyalty')
        : 'loyalty';
      succeeded =
        dc !== undefined &&
        (effectiveActivityCheckTotal({
          rawTotal: activity.recruitTeamCheckTotal,
          checkType,
          slotIndex: targetSlotIndex,
        }) ?? -Infinity) >= dc;
    } else if (targetActionId === 'reduce_danger') {
      succeeded =
        (effectiveActivityCheckTotal({
          rawTotal: activity.reduceDangerCheckTotal,
          checkType: 'security',
          slotIndex: targetSlotIndex,
        }) ?? -Infinity) >= 15;
    } else if (targetActionId === 'rescue_character') {
      const rescueEntry = rescueEntries.find(
        (entry) => entry.slotIndex === targetSlotIndex,
      );
      const targetLevel =
        rescueEntry?.targetLevel ?? activity.rescueCharacterTargetLevelTotal;
      succeeded =
        targetLevel !== undefined &&
        (effectiveActivityCheckTotal({
          rawTotal: activity.rescueCharacterCheckTotal,
          checkType: 'security',
          slotIndex: targetSlotIndex,
        }) ?? -Infinity) >= 10 + targetLevel;
    }

    if (succeeded) {
      successfulTargets.add(targetActionId);
    }
  }
  return successfulTargets;
}

function normalizeNotoriety(notoriety: number | undefined) {
  return typeof notoriety === 'number' && Number.isFinite(notoriety)
    ? notoriety
    : 0;
}
