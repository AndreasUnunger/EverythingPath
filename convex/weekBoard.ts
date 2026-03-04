import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import {
  activityActionIdValidator,
  campaignValidator,
  phaseValidator,
} from './schema';
import { hasAccessToOrg } from './user';
import type { MutationCtx, QueryCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import {
  clampPercent,
  consumeQueuedEffectsForWeek,
  deriveFutureEffectsAndPersistence,
  computeNextUneventfulBonusCarry,
  getWeekModifiers,
  resolveWeekEvents,
  resolveEventFromPercentile,
  shouldApplyBaseEffect,
} from './weekResolution';
import {
  lowerReputationWithFloorUnfriendly,
  validateStagedActionsLegality,
} from './weekBoardRules';

function getMaxActionsForRank(rank: number) {
  if (rank >= 19) return 6;
  if (rank >= 15) return 5;
  if (rank >= 11) return 4;
  if (rank >= 7) return 3;
  if (rank >= 1) return 2;
  return 1;
}

function getMinimumTrainingForRank(rank: number) {
  const thresholds: Record<number, number> = {
    1: 0,
    2: 10,
    3: 15,
    4: 20,
    5: 30,
    6: 40,
    7: 55,
    8: 75,
    9: 105,
    10: 160,
    11: 235,
    12: 330,
    13: 475,
    14: 665,
    15: 855,
    16: 1350,
    17: 1900,
    18: 2700,
    19: 3850,
    20: 5350,
  };
  return thresholds[rank];
}

async function getHighestActivePcLevel(
  ctx: QueryCtx | MutationCtx,
  campaignId: Id<'campaign'>,
) {
  const characters = await ctx.db
    .query('character')
    .filter((q) => q.eq(q.field('campaignId'), campaignId))
    .collect();

  const activePcs = characters.filter(
    (character) =>
      character.isActive !== false &&
      ((character.kind ?? 'pc') === 'pc'),
  );

  const levels = activePcs.map((character) => character.level);
  return levels.length ? Math.max(...levels) : 0;
}

function getRankUpEligibility({
  rank,
  training,
  highestPcLevel,
}: {
  rank: number;
  training: number;
  highestPcLevel: number;
}) {
  if (rank >= 20) {
    return { canRankUp: false, reason: 'Militia is already at maximum rank (20).' };
  }

  const nextRank = rank + 1;
  const requiredTraining = getMinimumTrainingForRank(nextRank);
  if (requiredTraining === undefined) {
    return { canRankUp: false, reason: 'Next rank threshold is not defined.' };
  }

  if (training < requiredTraining) {
    return {
      canRankUp: false,
      reason: `Need training ${requiredTraining} to reach rank ${nextRank}.`,
    };
  }

  if (rank >= highestPcLevel) {
    return {
      canRankUp: false,
      reason: `Militia rank cannot exceed highest active PC level (${highestPcLevel}).`,
    };
  }

  return { canRankUp: true, reason: '' };
}

async function assertMilitiaAccess(
  ctx: QueryCtx | MutationCtx,
  militiaId: Id<'militia'>,
  organizationId: string,
) {
  const access = await hasAccessToOrg(ctx, organizationId);
  if (!access) {
    throw new ConvexError('You do not have access to this org');
  }

  const militia = await ctx.db.get('militia', militiaId);
  if (!militia) {
    throw new ConvexError('Militia not found');
  }

  const campaign = await ctx.db.get('campaign', militia.campaignId);
  if (campaign?.organizationId !== organizationId) {
    throw new ConvexError('No campaign exists for this organization');
  }

  return militia;
}

function parseManualTotal(raw?: string) {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    throw new ConvexError('Roll totals must be numeric values');
  }
  return parsed;
}

function parseNonNegativeTotal(raw?: string) {
  const parsed = parseManualTotal(raw);
  if (parsed === undefined) return 0;
  if (parsed < 0) {
    throw new ConvexError('Values must be non-negative');
  }
  return parsed;
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

function applyWeekResolution({
  current,
  militia,
  activeQueuedEffects,
  activePersistentEventTypes,
}: {
  current: {
    weekNumber: number;
    uneventfulBonusCarry: number;
    stagedActivityActionIds: (string | null)[];
    upkeepRollTotals?: {
      attritionTotal?: number;
      notorietyPenaltyTotal?: number;
      maxNotorietyLoyaltyCheckTotal?: number;
      nearestSettlementKey?: string;
      treasuryPenaltyTotal?: number;
    };
    activityRollTotals?: {
      drillMilitiaTrainingGainTotal?: number;
      earnGoldTotal?: number;
      activateBlackMarketNotorietyIncreaseTotal?: number;
      dismissTeamNotorietyIncreaseTotal?: number;
      earnGoldNotorietyIncreaseTotal?: number;
      gatherInformationNotorietyIncreaseTotal?: number;
      recruitTeamNotorietyIncreaseTotal?: number;
      reduceDangerNotorietyIncreaseTotal?: number;
      rescueCharacterNotorietyIncreaseTotal?: number;
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
  };
  militia: {
    rank: number;
    training: number;
    treasury: number;
    notoriety: number;
  };
  activeQueuedEffects: Array<{
    kind:
      | 'week_of_pain_checks_penalty'
      | 'double_upkeep_attrition'
      | 'week_of_serenity_checks_bonus'
      | 'double_next_activity_training_gain'
      | 'all_is_calm_auto_next_week'
      | 'auto_event_roll_once'
      | 'auto_event_roll_twice';
    appliesWeek: number;
    note?: string;
  }>;
  activePersistentEventTypes: Array<
    | 'all_is_calm'
    | 'broke_the_code'
    | 'cache_discovered'
    | 'calm_before_the_storm'
    | 'double_agent'
    | 'festival'
    | 'found_fire'
    | 'hidden_agenda'
    | 'high_morale'
    | 'invasion'
    | 'low_morale'
    | 'market_day'
    | 'missing_in_action'
    | 'night_ops'
    | 'raid'
    | 'rivalry'
    | 'roll_twice'
    | 'sickness'
    | 'theft'
    | 'turn_around'
    | 'turncoat'
    | 'war_games'
    | 'week_of_pain'
    | 'week_of_serenity'
  >;
}) {
  const upkeep = current.upkeepRollTotals ?? {};
  const activity = current.activityRollTotals ?? {};
  const event = current.eventRollTotals ?? {};
  const modifiers = getWeekModifiers({
    activeQueuedEffects,
    activePersistentEventTypes,
  });

  let training = militia.training;
  let treasury = militia.treasury;
  let notoriety = militia.notoriety;

  training -= (upkeep.attritionTotal ?? 0) * modifiers.attritionMultiplier;
  training -= upkeep.notorietyPenaltyTotal ?? 0;
  training -= upkeep.treasuryPenaltyTotal ?? 0;
  training +=
    (activity.drillMilitiaTrainingGainTotal ?? 0) *
    modifiers.activityTrainingGainMultiplier;
  treasury += (activity.earnGoldTotal ?? 0) * modifiers.incomeMultiplier;

  notoriety += activity.activateBlackMarketNotorietyIncreaseTotal ?? 0;
  notoriety += activity.dismissTeamNotorietyIncreaseTotal ?? 0;
  notoriety += activity.earnGoldNotorietyIncreaseTotal ?? 0;
  notoriety += activity.gatherInformationNotorietyIncreaseTotal ?? 0;
  notoriety += activity.recruitTeamNotorietyIncreaseTotal ?? 0;
  notoriety += activity.reduceDangerNotorietyIncreaseTotal ?? 0;
  notoriety += activity.rescueCharacterNotorietyIncreaseTotal ?? 0;

  const guaranteedByAction =
    current.stagedActivityActionIds.includes('guarantee_event') ||
    current.stagedActivityActionIds.includes('manipulate_events');
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
    if (event.sabotageCheckTotal >= 15 + militia.rank) {
      eventOccurred = false;
    }
  }

  const resolvedEvents = modifiers.forceAllIsCalm
    ? ([{ eventType: 'all_is_calm', rolledValue: 45, isTwiceClause: true }] as Array<{
        eventType:
          | 'all_is_calm'
          | 'broke_the_code'
          | 'cache_discovered'
          | 'calm_before_the_storm'
          | 'double_agent'
          | 'festival'
          | 'found_fire'
          | 'hidden_agenda'
          | 'high_morale'
          | 'invasion'
          | 'low_morale'
          | 'market_day'
          | 'missing_in_action'
          | 'night_ops'
          | 'raid'
          | 'rivalry'
          | 'roll_twice'
          | 'sickness'
          | 'theft'
          | 'turn_around'
          | 'turncoat'
          | 'war_games'
          | 'week_of_pain'
          | 'week_of_serenity';
        rolledValue: number;
        isTwiceClause: boolean;
      }>)
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

  const autoEventCount = activeQueuedEffects.reduce((count, effect) => {
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

  for (const resolved of resolvedEvents) {
    if (resolved.eventType === 'war_games' && shouldApplyBaseEffect(resolved)) {
      training += militia.rank;
    }
    if (resolved.eventType === 'theft' && shouldApplyBaseEffect(resolved)) {
      treasury = Math.floor(treasury / 2);
    }
  }

  const nextUneventfulBonusCarry = computeNextUneventfulBonusCarry({
    weekNumber: current.weekNumber,
    currentCarry: current.uneventfulBonusCarry ?? 0,
    rank: militia.rank,
    eventOccurred,
    resolvedEvents,
  });

  const nearestSettlementKey = upkeep.nearestSettlementKey?.trim();
  let nearestSettlementKeyValue: string | undefined;
  if (nearestSettlementKey && nearestSettlementKey.length > 0) {
    nearestSettlementKeyValue = nearestSettlementKey;
  }

  return {
    militiaPatch: {
      training,
      treasury,
      notoriety,
    },
    nextUneventfulBonusCarry,
    resolvedEvents,
    shouldDropNearestSettlementReputation:
      militia.notoriety >= 100 &&
      upkeep.maxNotorietyLoyaltyCheckTotal !== undefined &&
      upkeep.maxNotorietyLoyaltyCheckTotal < 15 &&
      Boolean(nearestSettlementKey),
    nearestSettlementKey: nearestSettlementKeyValue,
  };
}

export const getWeekBoardState = query({
  args: {
    campaignId: v.optional(v.id('campaign')),
    organizationId: v.optional(campaignValidator.fields.organizationId),
  },
  async handler(ctx, args) {
    if (!args.campaignId || !args.organizationId) {
      return null;
    }

    const access = await hasAccessToOrg(ctx, args.organizationId);
    if (!access) {
      return null;
    }

    const campaign = await ctx.db.get('campaign', args.campaignId);
    if (campaign?.organizationId !== args.organizationId) {
      return null;
    }

    const militia = await ctx.db
      .query('militia')
      .withIndex('by_campaign', (q) => q.eq('campaignId', args.campaignId!))
      .first();

    if (!militia) {
      return null;
    }

    const states = await ctx.db
      .query('militiaWeekState')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
      .collect();
    const settlementStates = await ctx.db
      .query('militiaSettlementState')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
      .collect();
    const activePersistentEvents = await ctx.db
      .query('militiaEventState')
      .withIndex('by_militiaId_persistent', (q) =>
        q.eq('militiaId', militia._id).eq('isPersistent', true),
      )
      .collect();

    const currentState = states.sort((a, b) => b.weekNumber - a.weekNumber)[0];
    const unresolvedPersistent = activePersistentEvents
      .filter((event) => !event.resolved)
      .sort((a, b) => a.startedWeek - b.startedWeek);
    const currentWeekNumber = currentState?.weekNumber ?? 1;
    const lastPersistentBuyoffWeek = currentState?.lastPersistentBuyoffWeek ?? 0;
    const buyoffWeeksRemaining = Math.max(
      0,
      4 - (currentWeekNumber - lastPersistentBuyoffWeek),
    );
    const highestPcLevel = await getHighestActivePcLevel(ctx, militia.campaignId);
    const rankUp = getRankUpEligibility({
      rank: militia.rank,
      training: militia.training,
      highestPcLevel,
    });

    return {
      militiaId: militia._id,
      rank: militia.rank,
      training: militia.training,
      treasury: militia.treasury,
      notoriety: militia.notoriety,
      settlementKeys: settlementStates
        .map((settlement) => settlement.settlementKey)
        .sort((a, b) => a.localeCompare(b)),
      highestPcLevel,
      activePersistentEvents: unresolvedPersistent.map((event) => ({
        _id: event._id,
        eventType: event.eventType,
        startedWeek: event.startedWeek,
      })),
      persistentBuyoff: {
        cost: 2 * militia.rank * 10,
        weeksRemaining: buyoffWeeksRemaining,
        canBuyoffNow: buyoffWeeksRemaining === 0,
      },
      canRankUp: rankUp.canRankUp,
      rankUpBlockedReason: rankUp.reason,
      maxActions: getMaxActionsForRank(militia.rank),
      state:
        currentState ?? {
          weekNumber: 1,
          phase: 'activity' as const,
          isFirstWeek: true,
          skippedUpkeepThisWeek: true,
          uneventfulBonusCarry: 0,
          queuedEffects: [],
          lastPersistentBuyoffWeek: 0,
          stagedActivityActionIds: Array.from({ length: getMaxActionsForRank(militia.rank) }, () => null),
          lockVersion: 0,
          upkeepRollTotals: {},
          activityRollTotals: {},
          eventRollTotals: {},
        },
    };
  },
});

export const saveWeekBoardState = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    militiaId: v.id('militia'),
    patch: v.object({
      phase: v.optional(phaseValidator),
      weekNumber: v.optional(v.number()),
      stagedActivityActionIds: v.optional(v.array(v.union(v.null(), activityActionIdValidator))),
      upkeepRollTotals: v.optional(
        v.object({
          attritionTotal: v.optional(v.string()),
          notorietyPenaltyTotal: v.optional(v.string()),
          maxNotorietyLoyaltyCheckTotal: v.optional(v.string()),
          nearestSettlementKey: v.optional(v.string()),
          treasuryPenaltyTotal: v.optional(v.string()),
        }),
      ),
      activityRollTotals: v.optional(
        v.object({
          activateBlackMarketCheckTotal: v.optional(v.string()),
          activateBlackMarketNotorietyIncreaseTotal: v.optional(v.string()),
          dismissTeamCheckTotal: v.optional(v.string()),
          dismissTeamNotorietyIncreaseTotal: v.optional(v.string()),
          drillMilitiaCheckTotal: v.optional(v.string()),
          drillMilitiaTrainingGainTotal: v.optional(v.string()),
          earnGoldCheckTotal: v.optional(v.string()),
          earnGoldTotal: v.optional(v.string()),
          earnGoldNotorietyIncreaseTotal: v.optional(v.string()),
          gatherInformationCheckTotal: v.optional(v.string()),
          gatherInformationNotorietyIncreaseTotal: v.optional(v.string()),
          knowledgeCheckTotal: v.optional(v.string()),
          recruitTeamCheckTotal: v.optional(v.string()),
          recruitTeamNotorietyIncreaseTotal: v.optional(v.string()),
          reduceDangerCheckTotal: v.optional(v.string()),
          reduceDangerNotorietyIncreaseTotal: v.optional(v.string()),
          rescueCharacterCheckTotal: v.optional(v.string()),
          rescueCharacterTargetLevelTotal: v.optional(v.string()),
          rescueCharacterNotorietyIncreaseTotal: v.optional(v.string()),
          secureCacheCheckTotal: v.optional(v.string()),
          spreadPropagandaCheckTotal: v.optional(v.string()),
          specialOrderDeliveryDaysTotal: v.optional(v.string()),
        }),
      ),
      eventRollTotals: v.optional(
        v.object({
          eventChanceTotal: v.optional(v.string()),
          eventTriggerRollTotal: v.optional(v.string()),
          eventPercentileTotal: v.optional(v.string()),
          rollTwiceFirstTotal: v.optional(v.string()),
          rollTwiceSecondTotal: v.optional(v.string()),
          guaranteedFirstPercentileTotal: v.optional(v.string()),
          guaranteedSecondPercentileTotal: v.optional(v.string()),
          guaranteedChosen: v.optional(
            v.union(v.literal('first'), v.literal('second')),
          ),
          sabotageCheckTotal: v.optional(v.string()),
          sabotageNotorietyIncreaseTotal: v.optional(v.string()),
        }),
      ),
    }),
  },
  async handler(ctx, args) {
    const militia = await assertMilitiaAccess(ctx, args.militiaId, args.organizationId);

    const existing = await ctx.db
      .query('militiaWeekState')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
      .collect();
    const current = existing.sort((a, b) => b.weekNumber - a.weekNumber)[0];

    const maxActions = getMaxActionsForRank(militia.rank);

    const nextPatch: {
      phase?: 'upkeep' | 'activity' | 'event' | 'persistent' | 'week_closed';
      weekNumber?: number;
      stagedActivityActionIds?: (
        | 'activate_black_market'
        | 'activate_refuge'
        | 'broker_market'
        | 'change_officer_role'
        | 'covert_action'
        | 'dismiss_team'
        | 'drill_militia'
        | 'earn_gold'
        | 'gather_information'
        | 'guarantee_event'
        | 'knowledge_check'
        | 'lie_low'
        | 'manipulate_events'
        | 'recruit_team'
        | 'reduce_danger'
        | 'rescue_character'
        | 'restore_character'
        | 'secure_cache'
        | 'special'
        | 'special_order'
        | 'spread_propaganda'
        | 'strike_team'
        | 'upgrade_team'
        | null
      )[];
      upkeepRollTotals?: {
        attritionTotal?: number;
        notorietyPenaltyTotal?: number;
        maxNotorietyLoyaltyCheckTotal?: number;
        nearestSettlementKey?: string;
        treasuryPenaltyTotal?: number;
      };
      activityRollTotals?: {
        activateBlackMarketCheckTotal?: number;
        activateBlackMarketNotorietyIncreaseTotal?: number;
        dismissTeamCheckTotal?: number;
        dismissTeamNotorietyIncreaseTotal?: number;
        drillMilitiaCheckTotal?: number;
        drillMilitiaTrainingGainTotal?: number;
        earnGoldCheckTotal?: number;
        earnGoldTotal?: number;
        earnGoldNotorietyIncreaseTotal?: number;
        gatherInformationCheckTotal?: number;
        gatherInformationNotorietyIncreaseTotal?: number;
        knowledgeCheckTotal?: number;
        recruitTeamCheckTotal?: number;
        recruitTeamNotorietyIncreaseTotal?: number;
        reduceDangerCheckTotal?: number;
        reduceDangerNotorietyIncreaseTotal?: number;
        rescueCharacterCheckTotal?: number;
        rescueCharacterTargetLevelTotal?: number;
        rescueCharacterNotorietyIncreaseTotal?: number;
        secureCacheCheckTotal?: number;
        spreadPropagandaCheckTotal?: number;
        specialOrderDeliveryDaysTotal?: number;
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
      lockVersion: number;
    } = {
      lockVersion: (current?.lockVersion ?? 0) + 1,
    };

    if (args.patch.phase) {
      nextPatch.phase = args.patch.phase;
    }
    if (args.patch.weekNumber !== undefined) {
      nextPatch.weekNumber = args.patch.weekNumber;
    }
    if (args.patch.stagedActivityActionIds) {
      const teamRows = await ctx.db
        .query('militiaTeam')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
        .collect();
      const teamStates = await ctx.db
        .query('militiaTeamState')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
        .collect();
      const teamStatusById = new Map(teamStates.map((state) => [state.teamId, state.status]));
      const activeTeamIds = teamRows
        .map((row) => row.teamId)
        .filter((teamId) => (teamStatusById.get(teamId) ?? 'active') === 'active');
      validateStagedActionsLegality({
        stagedActions: args.patch.stagedActivityActionIds,
        activeTeamIds,
      });
      nextPatch.stagedActivityActionIds = args.patch.stagedActivityActionIds.slice(
        0,
        maxActions,
      );
    }
    if (args.patch.upkeepRollTotals) {
      nextPatch.upkeepRollTotals = {
        attritionTotal: parseManualTotal(args.patch.upkeepRollTotals.attritionTotal),
        notorietyPenaltyTotal: parseManualTotal(
          args.patch.upkeepRollTotals.notorietyPenaltyTotal,
        ),
        maxNotorietyLoyaltyCheckTotal: parseManualTotal(
          args.patch.upkeepRollTotals.maxNotorietyLoyaltyCheckTotal,
        ),
        nearestSettlementKey: args.patch.upkeepRollTotals.nearestSettlementKey
          ?.trim()
          ? args.patch.upkeepRollTotals.nearestSettlementKey.trim()
          : undefined,
        treasuryPenaltyTotal: parseManualTotal(
          args.patch.upkeepRollTotals.treasuryPenaltyTotal,
        ),
      };
    }
    if (args.patch.activityRollTotals) {
      nextPatch.activityRollTotals = {
        activateBlackMarketCheckTotal: parseManualTotal(
          args.patch.activityRollTotals.activateBlackMarketCheckTotal,
        ),
        activateBlackMarketNotorietyIncreaseTotal: parseManualTotal(
          args.patch.activityRollTotals.activateBlackMarketNotorietyIncreaseTotal,
        ),
        dismissTeamCheckTotal: parseManualTotal(
          args.patch.activityRollTotals.dismissTeamCheckTotal,
        ),
        dismissTeamNotorietyIncreaseTotal: parseManualTotal(
          args.patch.activityRollTotals.dismissTeamNotorietyIncreaseTotal,
        ),
        drillMilitiaCheckTotal: parseManualTotal(
          args.patch.activityRollTotals.drillMilitiaCheckTotal,
        ),
        drillMilitiaTrainingGainTotal: parseManualTotal(
          args.patch.activityRollTotals.drillMilitiaTrainingGainTotal,
        ),
        earnGoldCheckTotal: parseManualTotal(
          args.patch.activityRollTotals.earnGoldCheckTotal,
        ),
        earnGoldTotal: parseManualTotal(
          args.patch.activityRollTotals.earnGoldTotal,
        ),
        earnGoldNotorietyIncreaseTotal: parseManualTotal(
          args.patch.activityRollTotals.earnGoldNotorietyIncreaseTotal,
        ),
        gatherInformationCheckTotal: parseManualTotal(
          args.patch.activityRollTotals.gatherInformationCheckTotal,
        ),
        gatherInformationNotorietyIncreaseTotal: parseManualTotal(
          args.patch.activityRollTotals.gatherInformationNotorietyIncreaseTotal,
        ),
        knowledgeCheckTotal: parseManualTotal(
          args.patch.activityRollTotals.knowledgeCheckTotal,
        ),
        recruitTeamCheckTotal: parseManualTotal(
          args.patch.activityRollTotals.recruitTeamCheckTotal,
        ),
        recruitTeamNotorietyIncreaseTotal: parseManualTotal(
          args.patch.activityRollTotals.recruitTeamNotorietyIncreaseTotal,
        ),
        reduceDangerCheckTotal: parseManualTotal(
          args.patch.activityRollTotals.reduceDangerCheckTotal,
        ),
        reduceDangerNotorietyIncreaseTotal: parseManualTotal(
          args.patch.activityRollTotals.reduceDangerNotorietyIncreaseTotal,
        ),
        rescueCharacterCheckTotal: parseManualTotal(
          args.patch.activityRollTotals.rescueCharacterCheckTotal,
        ),
        rescueCharacterTargetLevelTotal: parseManualTotal(
          args.patch.activityRollTotals.rescueCharacterTargetLevelTotal,
        ),
        rescueCharacterNotorietyIncreaseTotal: parseManualTotal(
          args.patch.activityRollTotals.rescueCharacterNotorietyIncreaseTotal,
        ),
        secureCacheCheckTotal: parseManualTotal(
          args.patch.activityRollTotals.secureCacheCheckTotal,
        ),
        spreadPropagandaCheckTotal: parseManualTotal(
          args.patch.activityRollTotals.spreadPropagandaCheckTotal,
        ),
        specialOrderDeliveryDaysTotal: parseManualTotal(
          args.patch.activityRollTotals.specialOrderDeliveryDaysTotal,
        ),
      };
    }
    if (args.patch.eventRollTotals) {
      nextPatch.eventRollTotals = {
        eventChanceTotal: parseManualTotal(
          args.patch.eventRollTotals.eventChanceTotal,
        ),
        eventTriggerRollTotal: parseManualTotal(
          args.patch.eventRollTotals.eventTriggerRollTotal,
        ),
        eventPercentileTotal: parseManualTotal(
          args.patch.eventRollTotals.eventPercentileTotal,
        ),
        rollTwiceFirstTotal: parseManualTotal(
          args.patch.eventRollTotals.rollTwiceFirstTotal,
        ),
        rollTwiceSecondTotal: parseManualTotal(
          args.patch.eventRollTotals.rollTwiceSecondTotal,
        ),
        guaranteedFirstPercentileTotal: parseManualTotal(
          args.patch.eventRollTotals.guaranteedFirstPercentileTotal,
        ),
        guaranteedSecondPercentileTotal: parseManualTotal(
          args.patch.eventRollTotals.guaranteedSecondPercentileTotal,
        ),
        guaranteedChosen: args.patch.eventRollTotals.guaranteedChosen,
        sabotageCheckTotal: parseManualTotal(
          args.patch.eventRollTotals.sabotageCheckTotal,
        ),
        sabotageNotorietyIncreaseTotal: parseManualTotal(
          args.patch.eventRollTotals.sabotageNotorietyIncreaseTotal,
        ),
      };
    }

    if (!current) {
      const baseWeek = args.patch.weekNumber ?? 1;
      await ctx.db.insert('militiaWeekState', {
        militiaId: args.militiaId,
        weekNumber: baseWeek,
        phase: args.patch.phase ?? (baseWeek === 1 ? 'activity' : 'upkeep'),
        isFirstWeek: baseWeek === 1,
        skippedUpkeepThisWeek: baseWeek === 1,
        uneventfulBonusCarry: 0,
        queuedEffects: [],
        lastPersistentBuyoffWeek: 0,
        stagedActivityActionIds:
          nextPatch.stagedActivityActionIds ??
          Array.from({ length: maxActions }, () => null),
        upkeepRollTotals: nextPatch.upkeepRollTotals,
        activityRollTotals: nextPatch.activityRollTotals,
        eventRollTotals: nextPatch.eventRollTotals,
        lockVersion: nextPatch.lockVersion,
      });
      return;
    }

    await ctx.db.patch('militiaWeekState', current._id, nextPatch);
  },
});

export const commitCurrentPhase = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    militiaId: v.id('militia'),
  },
  async handler(ctx, args) {
    const militia = await assertMilitiaAccess(ctx, args.militiaId, args.organizationId);
    const maxActions = getMaxActionsForRank(militia.rank);

    const existing = await ctx.db
      .query('militiaWeekState')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
      .collect();
    const current = existing.sort((a, b) => b.weekNumber - a.weekNumber)[0];

    if (!current) {
      await ctx.db.insert('militiaWeekState', {
        militiaId: args.militiaId,
        weekNumber: 1,
        phase: 'activity',
        isFirstWeek: true,
        skippedUpkeepThisWeek: true,
        uneventfulBonusCarry: 0,
        queuedEffects: [],
        lastPersistentBuyoffWeek: 0,
        stagedActivityActionIds: Array.from({ length: maxActions }, () => null),
        activityRollTotals: {},
        lockVersion: 1,
      });
      return { nextPhase: 'activity', weekNumber: 1 };
    }

    let nextPhase: 'upkeep' | 'activity' | 'event' | 'persistent' | 'week_closed' =
      current.phase;
    let nextWeekNumber = current.weekNumber;
    let nextUneventfulBonusCarry = current.uneventfulBonusCarry ?? 0;
    let nextQueuedEffects = current.queuedEffects ?? [];

    if (current.phase === 'upkeep') {
      nextPhase = 'activity';
    } else if (current.phase === 'activity') {
      nextPhase = 'event';
    } else if (current.phase === 'event') {
      const activePersistentEvents = await ctx.db
        .query('militiaEventState')
        .withIndex('by_militiaId_persistent', (q) =>
          q.eq('militiaId', args.militiaId).eq('isPersistent', true),
        )
        .collect();
      nextPhase = activePersistentEvents.some((event) => !event.resolved)
        ? 'persistent'
        : 'week_closed';
    } else if (current.phase === 'persistent') {
      nextPhase = 'week_closed';
    } else if (current.phase === 'week_closed') {
      const allEventStates = await ctx.db
        .query('militiaEventState')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
        .collect();
      const activePersistentEventStates = allEventStates
        .filter((eventState) => eventState.isPersistent && !eventState.resolved)
        .sort((a, b) => a.startedWeek - b.startedWeek);
      const { active: activeQueuedEffects, remaining: remainingQueuedEffects } =
        consumeQueuedEffectsForWeek({
          queuedEffects: current.queuedEffects,
          weekNumber: current.weekNumber,
        });
      const resolution = applyWeekResolution({
        current: {
          weekNumber: current.weekNumber,
          uneventfulBonusCarry: current.uneventfulBonusCarry ?? 0,
          stagedActivityActionIds: current.stagedActivityActionIds,
          upkeepRollTotals: current.upkeepRollTotals,
          activityRollTotals: current.activityRollTotals,
          eventRollTotals: current.eventRollTotals,
        },
        militia: {
          rank: militia.rank,
          training: militia.training,
          treasury: militia.treasury,
          notoriety: militia.notoriety,
        },
        activeQueuedEffects,
        activePersistentEventTypes: activePersistentEventStates.map(
          (eventState) => eventState.eventType,
        ),
      });

      if (
        resolution.shouldDropNearestSettlementReputation &&
        resolution.nearestSettlementKey
      ) {
        const nearestSettlement = await ctx.db
          .query('militiaSettlementState')
          .withIndex('by_militiaId_settlement', (q) =>
            q
              .eq('militiaId', args.militiaId)
              .eq('settlementKey', resolution.nearestSettlementKey!),
          )
          .first();
        if (nearestSettlement) {
          await ctx.db.patch('militiaSettlementState', nearestSettlement._id, {
            reputation: lowerReputationWithFloorUnfriendly(
              nearestSettlement.reputation,
            ),
          });
        }
      }

      const derived = deriveFutureEffectsAndPersistence({
        resolvedEvents: resolution.resolvedEvents,
        currentWeek: current.weekNumber,
      });

      if (derived.endPersistentCount > 0) {
        const toEnd = activePersistentEventStates.slice(0, derived.endPersistentCount);
        for (const eventState of toEnd) {
          await ctx.db.patch('militiaEventState', eventState._id, {
            resolved: true,
            isPersistent: false,
            endedWeek: current.weekNumber,
          });
        }
      }

      for (const eventType of derived.persistentToAdd) {
        await ctx.db.insert('militiaEventState', {
          militiaId: args.militiaId,
          weekNumber: current.weekNumber,
          eventType,
          isPersistent: true,
          startedWeek: current.weekNumber,
          resolved: false,
        });
      }

      await ctx.db.patch('militia', args.militiaId, resolution.militiaPatch);
      nextPhase = 'upkeep';
      nextWeekNumber += 1;
      nextUneventfulBonusCarry = resolution.nextUneventfulBonusCarry;
      nextQueuedEffects = [...remainingQueuedEffects, ...derived.queuedToAdd];
    }

    await ctx.db.patch('militiaWeekState', current._id, {
      phase: nextPhase,
      weekNumber: nextWeekNumber,
      isFirstWeek: nextWeekNumber === 1,
      skippedUpkeepThisWeek: nextWeekNumber === 1,
      uneventfulBonusCarry: nextUneventfulBonusCarry,
      queuedEffects: nextQueuedEffects,
      lastPersistentBuyoffWeek: current.lastPersistentBuyoffWeek ?? 0,
      stagedActivityActionIds:
        nextPhase === 'upkeep'
          ? Array.from({ length: maxActions }, () => null)
          : current.stagedActivityActionIds,
      upkeepRollTotals: nextPhase === 'upkeep' ? {} : current.upkeepRollTotals,
      activityRollTotals: nextPhase === 'upkeep' ? {} : current.activityRollTotals,
      eventRollTotals: nextPhase === 'upkeep' ? {} : current.eventRollTotals,
      lockVersion: current.lockVersion + 1,
    });

    return { nextPhase, weekNumber: nextWeekNumber };
  },
});

export const goToPreviousWeek = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    militiaId: v.id('militia'),
  },
  async handler(ctx, args) {
    const militia = await assertMilitiaAccess(ctx, args.militiaId, args.organizationId);
    const maxActions = getMaxActionsForRank(militia.rank);

    const existing = await ctx.db
      .query('militiaWeekState')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
      .collect();
    const current = existing.sort((a, b) => b.weekNumber - a.weekNumber)[0];

    if (!current || current.weekNumber <= 1) {
      throw new ConvexError('Already at week 1.');
    }

    const nextWeekNumber = current.weekNumber - 1;

    await ctx.db.patch('militiaWeekState', current._id, {
      weekNumber: nextWeekNumber,
      phase: nextWeekNumber === 1 ? 'activity' : 'upkeep',
      isFirstWeek: nextWeekNumber === 1,
      skippedUpkeepThisWeek: nextWeekNumber === 1,
      lastPersistentBuyoffWeek: current.lastPersistentBuyoffWeek ?? 0,
      stagedActivityActionIds: Array.from({ length: maxActions }, () => null),
      upkeepRollTotals: {},
      activityRollTotals: {},
      eventRollTotals: {},
      lockVersion: current.lockVersion + 1,
    });

    return {
      weekNumber: nextWeekNumber,
      phase: nextWeekNumber === 1 ? ('activity' as const) : ('upkeep' as const),
    };
  },
});

export const buyOffPersistentEvent = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    militiaId: v.id('militia'),
    eventStateId: v.id('militiaEventState'),
  },
  async handler(ctx, args) {
    const militia = await assertMilitiaAccess(ctx, args.militiaId, args.organizationId);
    const eventState = await ctx.db.get('militiaEventState', args.eventStateId);
    if (eventState?.militiaId !== args.militiaId) {
      throw new ConvexError('Persistent event not found for militia.');
    }
    if (!eventState.isPersistent || eventState.resolved) {
      throw new ConvexError('Event is not an active persistent event.');
    }

    const existing = await ctx.db
      .query('militiaWeekState')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
      .collect();
    const current = existing.sort((a, b) => b.weekNumber - a.weekNumber)[0];
    if (!current) {
      throw new ConvexError('Week state not found.');
    }

    const lastBuyoffWeek = current.lastPersistentBuyoffWeek ?? 0;
    if (current.weekNumber - lastBuyoffWeek < 4) {
      throw new ConvexError('Persistent event buyoff is available only once every 4 weeks.');
    }

    const cost = 2 * militia.rank * 10;
    if (militia.treasury < cost) {
      throw new ConvexError(`Need ${cost} gp in militia treasury for persistent-event buyoff.`);
    }

    await ctx.db.patch('militia', args.militiaId, {
      treasury: militia.treasury - cost,
    });
    await ctx.db.patch('militiaEventState', args.eventStateId, {
      resolved: true,
      isPersistent: false,
      endedWeek: current.weekNumber,
    });
    await ctx.db.patch('militiaWeekState', current._id, {
      lastPersistentBuyoffWeek: current.weekNumber,
      lockVersion: current.lockVersion + 1,
    });

    return { endedEventType: eventState.eventType, buyoffCost: cost };
  },
});

export const applyTreasuryTransaction = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    militiaId: v.id('militia'),
    depositTotal: v.optional(v.string()),
    withdrawalTotal: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const militia = await assertMilitiaAccess(ctx, args.militiaId, args.organizationId);

    const depositTotal = parseNonNegativeTotal(args.depositTotal);
    const withdrawalTotal = parseNonNegativeTotal(args.withdrawalTotal);

    const nextTreasury = militia.treasury + depositTotal - withdrawalTotal;

    await ctx.db.patch('militia', args.militiaId, {
      treasury: nextTreasury,
    });

    return { treasury: nextTreasury };
  },
});

export const rankUpMilitia = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    militiaId: v.id('militia'),
  },
  async handler(ctx, args) {
    const militia = await assertMilitiaAccess(ctx, args.militiaId, args.organizationId);
    const highestPcLevel = await getHighestActivePcLevel(ctx, militia.campaignId);
    const rankUp = getRankUpEligibility({
      rank: militia.rank,
      training: militia.training,
      highestPcLevel,
    });

    if (!rankUp.canRankUp) {
      throw new ConvexError(rankUp.reason || 'Militia cannot rank up.');
    }

    const nextRank = militia.rank + 1;
    await ctx.db.patch('militia', args.militiaId, {
      rank: nextRank,
      highestBoonReached: Math.max(militia.highestBoonReached, nextRank),
    });

    return { rank: nextRank };
  },
});
