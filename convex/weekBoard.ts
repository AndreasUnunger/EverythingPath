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

function clampPercent(raw: number) {
  return Math.max(1, Math.min(100, Math.floor(raw)));
}

function resolveEventFromPercentile(percentile?: number) {
  if (percentile === undefined) return undefined;
  const value = clampPercent(percentile);
  if (value <= 4) return 'week_of_serenity';
  if (value <= 12) return 'war_games';
  if (value <= 16) return 'night_ops';
  if (value <= 20) return 'broke_the_code';
  if (value <= 24) return 'found_fire';
  if (value <= 28) return 'high_morale';
  if (value <= 32) return 'turn_around';
  if (value <= 36) return 'festival';
  if (value <= 40) return 'market_day';
  if (value <= 44) return 'hidden_agenda';
  if (value <= 48) return 'all_is_calm';
  if (value <= 52) return 'roll_twice';
  if (value <= 56) return 'calm_before_the_storm';
  if (value <= 60) return 'turncoat';
  if (value <= 64) return 'cache_discovered';
  if (value <= 68) return 'rivalry';
  if (value <= 72) return 'missing_in_action';
  if (value <= 76) return 'theft';
  if (value <= 80) return 'raid';
  if (value <= 84) return 'invasion';
  if (value <= 88) return 'low_morale';
  if (value <= 96) return 'sickness';
  if (value <= 99) return 'double_agent';
  return 'week_of_pain';
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
}: {
  current: {
    weekNumber: number;
    stagedActivityActionIds: (string | null)[];
    upkeepRollTotals?: {
      attritionTotal?: number;
      notorietyPenaltyTotal?: number;
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
}) {
  const upkeep = current.upkeepRollTotals ?? {};
  const activity = current.activityRollTotals ?? {};
  const event = current.eventRollTotals ?? {};

  let training = militia.training;
  let treasury = militia.treasury;
  let notoriety = militia.notoriety;

  training -= upkeep.attritionTotal ?? 0;
  training -= upkeep.notorietyPenaltyTotal ?? 0;
  training -= upkeep.treasuryPenaltyTotal ?? 0;
  training += activity.drillMilitiaTrainingGainTotal ?? 0;
  treasury += activity.earnGoldTotal ?? 0;

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

  let eventOccurred = occurredBeforeSabotage;
  if (occurredBeforeSabotage && event.sabotageCheckTotal !== undefined) {
    notoriety += event.sabotageNotorietyIncreaseTotal ?? 0;
    if (event.sabotageCheckTotal >= 15 + militia.rank) {
      eventOccurred = false;
    }
  }

  const resolvedEventType = eventOccurred
    ? resolveEventFromPercentile(event.eventPercentileTotal)
    : undefined;

  if (resolvedEventType === 'war_games') {
    training += militia.rank;
  }

  const countsAsUneventful =
    !eventOccurred || resolvedEventType === 'all_is_calm';
  const nextUneventfulBonusCarry =
    countsAsUneventful && current.weekNumber > 1 ? militia.rank : 0;

  return {
    militiaPatch: {
      training,
      treasury,
      notoriety,
    },
    nextUneventfulBonusCarry,
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

    const currentState = states.sort((a, b) => b.weekNumber - a.weekNumber)[0];
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
      highestPcLevel,
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
      phase?: 'upkeep' | 'activity' | 'event' | 'week_closed';
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
        stagedActivityActionIds: Array.from({ length: maxActions }, () => null),
        activityRollTotals: {},
        lockVersion: 1,
      });
      return { nextPhase: 'activity', weekNumber: 1 };
    }

    let nextPhase: 'upkeep' | 'activity' | 'event' | 'week_closed' = current.phase;
    let nextWeekNumber = current.weekNumber;

    if (current.phase === 'upkeep') {
      nextPhase = 'activity';
    } else if (current.phase === 'activity') {
      nextPhase = 'event';
    } else if (current.phase === 'event') {
      nextPhase = 'week_closed';
    } else if (current.phase === 'week_closed') {
      const resolution = applyWeekResolution({
        current: {
          weekNumber: current.weekNumber,
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
      });
      await ctx.db.patch('militia', args.militiaId, resolution.militiaPatch);
      nextPhase = 'upkeep';
      nextWeekNumber += 1;
      await ctx.db.patch('militiaWeekState', current._id, {
        uneventfulBonusCarry: resolution.nextUneventfulBonusCarry,
      });
    }

    await ctx.db.patch('militiaWeekState', current._id, {
      phase: nextPhase,
      weekNumber: nextWeekNumber,
      isFirstWeek: nextWeekNumber === 1,
      skippedUpkeepThisWeek: nextWeekNumber === 1,
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
      stagedActivityActionIds: Array.from({ length: maxActions }, () => null),
      upkeepRollTotals: {},
      activityRollTotals: {},
      eventRollTotals: {},
      lockVersion: current.lockVersion + 1,
    });

    return { weekNumber: nextWeekNumber, phase: 'upkeep' as const };
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
