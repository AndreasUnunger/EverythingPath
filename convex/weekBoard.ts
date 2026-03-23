import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import {
  activityActionIdValidator,
  covertActionModeValidator,
  cacheClassValidator,
  cacheModeValidator,
  campaignValidator,
  officerRoleValidator,
  phaseValidator,
  restoreCharacterModeValidator,
  teamIdValidator,
  trackedPersonKindValidator,
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
  buildTeamOperationWarnings,
  getTeamCost,
  getMaxTeamsForRank,
  lowerReputationWithFloorUnfriendly,
  validateStagedActionsLegality,
} from './weekBoardRules';
import { buildResolvedTeamManagers } from '../src/lib/team-manager-rules';
import {
  getMarketplaceDefaultLabel,
  getMarketplaceProfile,
} from '../src/lib/militia-marketplace-rules';
import { getMinimumTrainingForRank } from '../src/lib/militia-progression-rules';
import teamDefinitions from './data/teams';

function getMaxActionsForRank(rank: number) {
  if (rank >= 19) return 6;
  if (rank >= 15) return 5;
  if (rank >= 11) return 4;
  if (rank >= 7) return 3;
  if (rank >= 1) return 2;
  return 1;
}

function getMaxActionsForMilitia({
  rank,
  strategist,
}: {
  rank: number;
  strategist?: Id<'character'>;
}) {
  return getMaxActionsForRank(rank) + (strategist ? 1 : 0);
}

function isStrategistOfficerChangeActive({
  stagedActivityActionIds,
  slotIndex,
}: {
  stagedActivityActionIds?: Array<string | null>;
  slotIndex: number;
}) {
  return stagedActivityActionIds?.[slotIndex] === 'change_officer_role';
}

function hasCurrentWeekStrategistBonus({
  strategist,
  stagedActivityActionIds,
  activityOfficerOperations,
}: {
  strategist?: Id<'character'>;
  stagedActivityActionIds?: Array<string | null>;
  activityOfficerOperations?:
    | {
        changes?: Array<{
          slotIndex: number;
          role: string;
          characterId?: Id<'character'>;
        }>;
      }
    | undefined;
}) {
  if (strategist) {
    return true;
  }

  return (activityOfficerOperations?.changes ?? []).some(
    (change) =>
      change.role === 'strategist' &&
      Boolean(change.characterId) &&
      isStrategistOfficerChangeActive({
        stagedActivityActionIds,
        slotIndex: change.slotIndex,
      }),
  );
}

function getCurrentWeekMaxActions({
  rank,
  strategist,
  stagedActivityActionIds,
  activityOfficerOperations,
}: {
  rank: number;
  strategist?: Id<'character'>;
  stagedActivityActionIds?: Array<string | null>;
  activityOfficerOperations?:
    | {
        changes?: Array<{
          slotIndex: number;
          role: string;
          characterId?: Id<'character'>;
        }>;
      }
    | undefined;
}) {
  return (
    getMaxActionsForRank(rank) +
    (hasCurrentWeekStrategistBonus({
      strategist,
      stagedActivityActionIds,
      activityOfficerOperations,
    })
      ? 1
      : 0)
  );
}

function getFinalStrategistAssignmentForWeek({
  strategist,
  stagedActivityActionIds,
  activityOfficerOperations,
}: {
  strategist?: Id<'character'>;
  stagedActivityActionIds?: Array<string | null>;
  activityOfficerOperations?:
    | {
        changes?: Array<{
          slotIndex: number;
          role: string;
          characterId?: Id<'character'>;
        }>;
      }
    | undefined;
}) {
  let nextStrategist = strategist;
  const strategistChanges = [...(activityOfficerOperations?.changes ?? [])]
    .filter(
      (change) =>
        change.role === 'strategist' &&
        isStrategistOfficerChangeActive({
          stagedActivityActionIds,
          slotIndex: change.slotIndex,
        }),
    )
    .sort((a, b) => a.slotIndex - b.slotIndex);

  for (const change of strategistChanges) {
    nextStrategist = change.characterId;
  }

  return nextStrategist;
}

async function getHighestActivePcLevel(
  ctx: QueryCtx | MutationCtx,
  campaignId: Id<'campaign'>,
) {
  const characters = (await ctx.db.query('character').collect()).filter(
    (character) => character.campaignId === campaignId,
  );

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

function parseOptionalNonNegativeTotal(raw?: string) {
  const parsed = parseManualTotal(raw);
  if (parsed === undefined) return undefined;
  if (parsed < 0) {
    throw new ConvexError('Values must be non-negative');
  }
  return parsed;
}

function trimToUndefined(raw?: string) {
  if (!raw) {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed ? trimmed : undefined;
}

function appendUniqueWarnings(
  current: Array<{ code: string; message: string }> | undefined,
  incoming: Array<{ code: string; message: string }>,
) {
  const merged = [...(current ?? [])];

  for (const warning of incoming) {
    if (
      merged.some(
        (existing) =>
          existing.code === warning.code && existing.message === warning.message,
      )
    ) {
      continue;
    }
    merged.push(warning);
  }

  return merged;
}

function getCacheDc({
  cacheClass,
  isSecureLocation,
}: {
  cacheClass: 'minor' | 'intermediate' | 'major';
  isSecureLocation?: boolean;
}) {
  const base =
    cacheClass === 'minor'
      ? 15
      : cacheClass === 'intermediate'
        ? 20
        : 30;
  return base + (isSecureLocation ? 5 : 0);
}

function normalizeTeamStatus(raw: unknown): 'active' | 'disabled' | 'missing' | 'blocked' {
  if (
    raw === 'active' ||
    raw === 'disabled' ||
    raw === 'missing' ||
    raw === 'blocked'
  ) {
    return raw;
  }
  return 'active';
}

function normalizeTrackedPersonKind(raw: unknown): 'pc' | 'officer_npc' | 'other_npc' {
  if (raw === 'pc' || raw === 'officer_npc' || raw === 'other_npc') {
    return raw;
  }
  return 'other_npc';
}

function coerceTrackedPersonKindFromCharacter(
  raw: unknown,
): 'pc' | 'officer_npc' | 'other_npc' {
  if (raw === 'officer_npc') {
    return 'officer_npc';
  }
  return 'pc';
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
  if (mode === 'break_enchantment') return 1125;
  if (mode === 'raise_dead') return 6125;
  if (mode === 'restoration') return 1700;
  if (mode === 'stone_to_flesh') return 1650;
  return 0;
}

function getTeamStatusRowsByTeamId<
  T extends { teamId: string; status: unknown; unavailableUntilWeek?: number; notes?: string },
>(teamStates: T[]) {
  return new Map(
    teamStates.map((state) => [
      state.teamId,
      {
        ...state,
        status: normalizeTeamStatus(state.status),
      },
    ]),
  );
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

function getSuccessfulCovertAugmentTargets({
  current,
}: {
  current: {
    stagedActivityActionIds: (string | null)[];
    activityRollTotals?: {
      activateBlackMarketCheckTotal?: number;
      dismissTeamCheckTotal?: number;
      earnGoldCheckTotal?: number;
      gatherInformationCheckTotal?: number;
      recruitTeamCheckTotal?: number;
      reduceDangerCheckTotal?: number;
      rescueCharacterCheckTotal?: number;
      rescueCharacterTargetLevelTotal?: number;
    };
    activityTeamOperations?: {
      recruits: Array<{ slotIndex: number; teamId: string }>;
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
      marketplaces?: Array<{
        slotIndex: number;
        label?: string;
        purchaseSummary?: string;
        notes?: string;
      }>;
    };
  };
}) {
  const suppressedActionIds = new Set<string>();
  const activity = current.activityRollTotals ?? {};
  const covertActions = current.activityAssetOperations?.covertActions ?? [];
  const rescueEntries = current.activityAssetOperations?.rescues ?? [];
  const recruitEntries = current.activityTeamOperations?.recruits ?? [];

  for (const covertAction of covertActions) {
    if (
      current.stagedActivityActionIds[covertAction.slotIndex] !== 'covert_action' ||
      covertAction.mode !== 'augment_action'
    ) {
      continue;
    }

    const targetSlotIndex =
      covertAction.followupSlotIndex ??
      current.stagedActivityActionIds.findIndex(
        (actionId, index) => index > covertAction.slotIndex && actionId !== null,
      );
    if (targetSlotIndex < 0) {
      continue;
    }

    const targetActionId = current.stagedActivityActionIds[targetSlotIndex];
    if (!targetActionId) {
      continue;
    }

    let succeeded = false;
    if (targetActionId === 'activate_black_market') {
      succeeded = (activity.activateBlackMarketCheckTotal ?? -Infinity) >= 20;
    } else if (targetActionId === 'dismiss_team') {
      succeeded = (activity.dismissTeamCheckTotal ?? -Infinity) >= 10;
    } else if (targetActionId === 'earn_gold') {
      succeeded = activity.earnGoldCheckTotal !== undefined;
    } else if (targetActionId === 'gather_information') {
      succeeded = (activity.gatherInformationCheckTotal ?? -Infinity) >= 15;
    } else if (targetActionId === 'recruit_team') {
      const recruitEntry = recruitEntries.find(
        (entry) => entry.slotIndex === targetSlotIndex,
      );
      const dc = recruitEntry?.teamId
        ? RECRUITMENT_DC_BY_TEAM_ID.get(recruitEntry.teamId)
        : undefined;
      succeeded =
        dc !== undefined && (activity.recruitTeamCheckTotal ?? -Infinity) >= dc;
    } else if (targetActionId === 'reduce_danger') {
      succeeded = (activity.reduceDangerCheckTotal ?? -Infinity) >= 15;
    } else if (targetActionId === 'rescue_character') {
      const rescueEntry = rescueEntries.find(
        (entry) => entry.slotIndex === targetSlotIndex,
      );
      const targetLevel =
        rescueEntry?.targetLevel ?? activity.rescueCharacterTargetLevelTotal;
      succeeded =
        targetLevel !== undefined &&
        (activity.rescueCharacterCheckTotal ?? -Infinity) >= 10 + targetLevel;
    }

    if (succeeded) {
      suppressedActionIds.add(targetActionId);
    }
  }

  return suppressedActionIds;
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
      recruitTeamCheckTotal?: number;
      recruitTeamNotorietyIncreaseTotal?: number;
      reduceDangerCheckTotal?: number;
      reduceDangerNotorietyIncreaseTotal?: number;
      rescueCharacterCheckTotal?: number;
      rescueCharacterTargetLevelTotal?: number;
      rescueCharacterNotorietyIncreaseTotal?: number;
    };
    activityTeamOperations?: {
      recruits: Array<{ slotIndex: number; teamId: string }>;
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
  const successfulCovertAugmentTargets = getSuccessfulCovertAugmentTargets({
    current,
  });

  training -= (upkeep.attritionTotal ?? 0) * modifiers.attritionMultiplier;
  training -= upkeep.notorietyPenaltyTotal ?? 0;
  training -= upkeep.treasuryPenaltyTotal ?? 0;
  training +=
    (activity.drillMilitiaTrainingGainTotal ?? 0) *
    modifiers.activityTrainingGainMultiplier;
  treasury += (activity.earnGoldTotal ?? 0) * modifiers.incomeMultiplier;

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
    const teamRows = await ctx.db
      .query('militiaTeam')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
      .collect();
    const teamStates = await ctx.db
      .query('militiaTeamState')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
      .collect();
    const settlementStates = await ctx.db
      .query('militiaSettlementState')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
      .collect();
    const cacheRows = await ctx.db
      .query('militiaCache')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
      .collect();
    const marketplaceRows = await ctx.db
      .query('militiaMarketplace')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
      .collect();
    const orderRows = await ctx.db
      .query('militiaOrder')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
      .collect();
    const trackedPeopleRows = await ctx.db
      .query('militiaCharacterStatus')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
      .collect();
    const characters = (await ctx.db.query('character').collect()).filter(
      (character) => character.campaignId === militia.campaignId,
    );
    const activePersistentEvents = await ctx.db
      .query('militiaEventState')
      .withIndex('by_militiaId_persistent', (q) =>
        q.eq('militiaId', militia._id).eq('isPersistent', true),
      )
      .collect();

    const currentState = states.sort((a, b) => b.weekNumber - a.weekNumber)[0];
    const currentStateAny = currentState as
      | (typeof currentState & {
          stagedActivityTeamIds?: (string | null)[];
          activityTeamOperations?: {
            recruits: Array<{ slotIndex: number; teamId: string }>;
            dismissals: Array<{ slotIndex: number; teamId: string }>;
            upgrades: Array<{
              slotIndex: number;
              fromTeamId: string;
              toTeamId: string;
            }>;
          };
          activityOfficerOperations?: {
            changes: Array<{
              slotIndex: number;
              role:
                | 'ambassador'
                | 'commandant'
                | 'marshal'
                | 'overseer'
                | 'spymaster'
                | 'strategist';
              characterId?: Id<'character'>;
            }>;
          };
          activityAssetOperations?: {
            refuges: Array<{ slotIndex: number; settlementKey: string }>;
            caches: Array<{
              slotIndex: number;
              mode: 'place' | 'retrieve';
              cacheId?: string;
              label?: string;
              cacheClass?: 'minor' | 'intermediate' | 'major';
              location?: string;
              contentsSummary?: string;
              isSecureLocation?: boolean;
              checkTotal?: number;
            }>;
            orders: Array<{
              slotIndex: number;
              description: string;
              notes?: string;
              costPaid?: number;
              deliveryDays?: number;
            }>;
            marketplaces: Array<{
              slotIndex: number;
              label?: string;
              purchaseSummary?: string;
              notes?: string;
            }>;
            covertActions: Array<{
              slotIndex: number;
              mode?: 'augment_action' | 'place_contact';
              targetSource?: 'character' | 'freeform';
              followupSlotIndex?: number;
              characterId?: Id<'character'>;
              displayName?: string;
              personKind?: 'pc' | 'officer_npc' | 'other_npc';
              siteName?: string;
              notes?: string;
            }>;
            rescues: Array<{
              slotIndex: number;
              targetSource?: 'tracked' | 'character' | 'freeform';
              targetStatusId?: string;
              characterId?: Id<'character'>;
              displayName?: string;
              personKind?: 'pc' | 'officer_npc' | 'other_npc';
              targetLevel?: number;
              destinationType?: 'hq' | 'refuge' | 'settlement';
              destinationSettlementKey?: string;
            }>;
            restorations: Array<{
              slotIndex: number;
              targetSource?: 'tracked' | 'character' | 'freeform';
              targetStatusId?: string;
              characterId?: Id<'character'>;
              displayName?: string;
              personKind?: 'pc' | 'officer_npc' | 'other_npc';
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
          };
          upkeepTeamOperations?: {
            disabledRecoveries: Array<{ teamId: string; paid: boolean }>;
            missingChecks: Array<{
              teamId: string;
              securityCheckTotal?: number;
              permanentlyLost?: boolean;
            }>;
          };
          eventMitigations?: Record<string, unknown>;
          weekWarnings?: Array<{ code: string; message: string }>;
        })
      | undefined;
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
    const currentMaxActions = getCurrentWeekMaxActions({
      rank: militia.rank,
      strategist: militia.strategist,
      stagedActivityActionIds: currentState?.stagedActivityActionIds,
      activityOfficerOperations: currentStateAny?.activityOfficerOperations,
    });
    const resolvedManagersByTeamId = buildResolvedTeamManagers({
      teams: teamRows.map((teamRow) => ({
        teamId: teamRow.teamId,
        managerSource: teamRow.managerSource,
        managerCharacterId: teamRow.managerCharacterId,
        managerName: teamRow.managerName,
        managerKind: teamRow.managerKind,
        managerCharisma: teamRow.managerCharisma,
      })),
      characters: characters.map((character) => ({
        _id: character._id,
        name: character.name,
        kind: character.kind,
        charisma: character.charisma,
        isActive: character.isActive,
      })),
    });

    return {
      militiaId: militia._id,
      rank: militia.rank,
      training: militia.training,
      treasury: militia.treasury,
      notoriety: militia.notoriety,
      focus: militia.focus,
      maxTeams: getMaxTeamsForRank(militia.rank),
      teams: teamRows
        .map((teamRow) => {
          const state = teamStates.find((row) => row.teamId === teamRow.teamId);
          return {
            teamId: teamRow.teamId,
            status: normalizeTeamStatus(state?.status),
            unavailableUntilWeek: state?.unavailableUntilWeek,
            notes: state?.notes,
            manager: resolvedManagersByTeamId.get(teamRow.teamId) ?? null,
          };
        })
        .sort((a, b) => a.teamId.localeCompare(b.teamId)),
      settlementKeys: settlementStates
        .map((settlement) => settlement.settlementKey)
        .sort((a, b) => a.localeCompare(b)),
      settlements: settlementStates
        .map((settlement) => ({
          _id: settlement._id,
          settlementKey: settlement.settlementKey,
          reputation: settlement.reputation,
          isSecured: settlement.isSecured,
          temporaryShift: settlement.temporaryShift,
          refugeActiveUntilWeek: settlement.refugeActiveUntilWeek,
          refugeActivatedWeek: settlement.refugeActivatedWeek,
        }))
        .sort((a, b) => a.settlementKey.localeCompare(b.settlementKey)),
      caches: cacheRows
        .map((cache) => ({
          _id: cache._id,
          label: cache.label,
          cacheClass: cache.cacheClass,
          location: cache.location,
          contentsSummary: cache.contentsSummary,
          status: cache.status,
          isSecureLocation: cache.isSecureLocation,
          createdWeek: cache.createdWeek,
          updatedWeek: cache.updatedWeek,
          retrievedWeek: cache.retrievedWeek,
          lostWeek: cache.lostWeek,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      marketplaces: marketplaceRows
        .map((marketplace) => ({
          _id: marketplace._id,
          label: marketplace.label,
          sourceAction: marketplace.sourceAction,
          teamId: marketplace.teamId,
          availabilityTier: marketplace.availabilityTier,
          availabilityThreshold: marketplace.availabilityThreshold,
          saleValuePercent: marketplace.saleValuePercent,
          contrabandAllowed: marketplace.contrabandAllowed,
          createdWeek: marketplace.createdWeek,
          activeUntilWeek: marketplace.activeUntilWeek,
          marketDayDiscountPercent: marketplace.marketDayDiscountPercent,
          marketDayAppliedWeek: marketplace.marketDayAppliedWeek,
          notes: marketplace.notes,
        }))
        .sort((a, b) => a.createdWeek - b.createdWeek || a.label.localeCompare(b.label)),
      orders: orderRows
        .map((order) => ({
          _id: order._id,
          description: order.description,
          notes: order.notes,
          costPaid: order.costPaid,
          deliveryDays: order.deliveryDays,
          orderedWeek: order.orderedWeek,
          dueWeek: order.dueWeek,
          status: order.status,
          deliveredWeek: order.deliveredWeek,
          sourceAction: order.sourceAction,
          marketplaceId: order.marketplaceId,
        }))
        .sort((a, b) => a.orderedWeek - b.orderedWeek),
      trackedPeople: trackedPeopleRows
        .map((person) => ({
          _id: person._id,
          characterId: person.characterId,
          displayName: person.displayName,
          personKind: person.personKind,
          status: person.status,
          level: person.level,
          locationType: person.locationType,
          settlementKey: person.settlementKey,
          siteName: person.siteName,
          notes: person.notes,
          activeUntilWeek: person.activeUntilWeek,
          hiddenSinceWeek: person.hiddenSinceWeek,
          capturedSinceWeek: person.capturedSinceWeek,
          rescuedWeek: person.rescuedWeek,
          restoredWeek: person.restoredWeek,
          rescueDcOverride: person.rescueDcOverride,
          sourceAction: person.sourceAction,
        }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
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
      maxActions: currentMaxActions,
      assignableCharacters: characters
        .filter((character) => character.isActive !== false)
        .map((character) => ({
          _id: character._id,
          name: character.name,
          kind: character.kind ?? 'pc',
          level: character.level,
          strength: character.strength,
          dexterity: character.dexterity,
          constitution: character.constitution,
          intelligence: character.intelligence,
          wisdom: character.wisdom,
          charisma: character.charisma,
        })),
      officerAssignments: {
        ambassador: militia.ambassador,
        commandant: militia.commandant,
        marshal: militia.marshal,
        overseer: militia.overseer,
        spymaster: militia.spymaster,
        strategist: militia.strategist,
      },
      state: currentStateAny
        ? {
            ...currentStateAny,
            stagedActivityTeamIds:
              currentStateAny.stagedActivityTeamIds ??
              Array.from({ length: currentMaxActions }, () => null),
            activityTeamOperations: currentStateAny.activityTeamOperations ?? {
              recruits: [],
              dismissals: [],
              upgrades: [],
            },
            activityOfficerOperations: currentStateAny.activityOfficerOperations ?? {
              changes: [],
            },
            activityAssetOperations: {
              refuges: currentStateAny.activityAssetOperations?.refuges ?? [],
              caches: currentStateAny.activityAssetOperations?.caches ?? [],
              orders: currentStateAny.activityAssetOperations?.orders ?? [],
              marketplaces:
                currentStateAny.activityAssetOperations?.marketplaces ?? [],
              covertActions:
                currentStateAny.activityAssetOperations?.covertActions ?? [],
              rescues: currentStateAny.activityAssetOperations?.rescues ?? [],
              restorations:
                currentStateAny.activityAssetOperations?.restorations ?? [],
            },
            upkeepTeamOperations: currentStateAny.upkeepTeamOperations ?? {
              disabledRecoveries: [],
              missingChecks: [],
            },
            eventMitigations: currentStateAny.eventMitigations ?? {},
            weekWarnings: currentStateAny.weekWarnings ?? [],
          }
        : {
            weekNumber: 1,
            phase: 'activity' as const,
            isFirstWeek: true,
            skippedUpkeepThisWeek: true,
            uneventfulBonusCarry: 0,
            queuedEffects: [],
            lastPersistentBuyoffWeek: 0,
            stagedActivityActionIds: Array.from(
              { length: currentMaxActions },
              () => null,
            ),
            stagedActivityTeamIds: Array.from(
              { length: currentMaxActions },
              () => null,
            ),
            activityTeamOperations: {
              recruits: [],
              dismissals: [],
              upgrades: [],
            },
            activityOfficerOperations: {
              changes: [],
            },
            activityAssetOperations: {
              refuges: [],
              caches: [],
              orders: [],
              marketplaces: [],
              covertActions: [],
              rescues: [],
              restorations: [],
            },
            upkeepTeamOperations: {
              disabledRecoveries: [],
              missingChecks: [],
            },
            eventMitigations: {},
            weekWarnings: [],
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
      stagedActivityTeamIds: v.optional(v.array(v.union(v.null(), teamIdValidator))),
      activityTeamOperations: v.optional(
        v.object({
          recruits: v.optional(
            v.array(
              v.object({
                slotIndex: v.number(),
                teamId: teamIdValidator,
              }),
            ),
          ),
          dismissals: v.optional(
            v.array(
              v.object({
                slotIndex: v.number(),
                teamId: teamIdValidator,
              }),
            ),
          ),
          upgrades: v.optional(
            v.array(
              v.object({
                slotIndex: v.number(),
                fromTeamId: teamIdValidator,
                toTeamId: teamIdValidator,
              }),
            ),
          ),
        }),
      ),
      activityOfficerOperations: v.optional(
        v.object({
          changes: v.optional(
            v.array(
              v.object({
                slotIndex: v.number(),
                role: officerRoleValidator,
                characterId: v.optional(v.id('character')),
              }),
            ),
          ),
        }),
      ),
      activityAssetOperations: v.optional(
        v.object({
          refuges: v.optional(
            v.array(
              v.object({
                slotIndex: v.number(),
                settlementKey: v.string(),
              }),
            ),
          ),
          caches: v.optional(
            v.array(
              v.object({
                slotIndex: v.number(),
                mode: cacheModeValidator,
                cacheId: v.optional(v.string()),
                label: v.optional(v.string()),
                cacheClass: v.optional(cacheClassValidator),
                location: v.optional(v.string()),
                contentsSummary: v.optional(v.string()),
                isSecureLocation: v.optional(v.boolean()),
                checkTotal: v.optional(v.string()),
              }),
            ),
          ),
          orders: v.optional(
            v.array(
              v.object({
                slotIndex: v.number(),
                description: v.string(),
                notes: v.optional(v.string()),
                costPaid: v.optional(v.string()),
                deliveryDays: v.optional(v.string()),
              }),
            ),
          ),
          marketplaces: v.optional(
            v.array(
              v.object({
                slotIndex: v.number(),
                label: v.optional(v.string()),
                purchaseSummary: v.optional(v.string()),
                notes: v.optional(v.string()),
              }),
            ),
          ),
          covertActions: v.optional(
            v.array(
              v.object({
                slotIndex: v.number(),
                mode: v.optional(covertActionModeValidator),
                targetSource: v.optional(
                  v.union(v.literal('character'), v.literal('freeform')),
                ),
                followupSlotIndex: v.optional(v.number()),
                characterId: v.optional(v.id('character')),
                displayName: v.optional(v.string()),
                personKind: v.optional(trackedPersonKindValidator),
                siteName: v.optional(v.string()),
                notes: v.optional(v.string()),
              }),
            ),
          ),
          rescues: v.optional(
            v.array(
              v.object({
                slotIndex: v.number(),
                targetSource: v.optional(
                  v.union(
                    v.literal('tracked'),
                    v.literal('character'),
                    v.literal('freeform'),
                  ),
                ),
                targetStatusId: v.optional(v.string()),
                characterId: v.optional(v.id('character')),
                displayName: v.optional(v.string()),
                personKind: v.optional(trackedPersonKindValidator),
                targetLevel: v.optional(v.string()),
                destinationType: v.optional(
                  v.union(
                    v.literal('hq'),
                    v.literal('refuge'),
                    v.literal('settlement'),
                  ),
                ),
                destinationSettlementKey: v.optional(v.string()),
              }),
            ),
          ),
          restorations: v.optional(
            v.array(
              v.object({
                slotIndex: v.number(),
                targetSource: v.optional(
                  v.union(
                    v.literal('tracked'),
                    v.literal('character'),
                    v.literal('freeform'),
                  ),
                ),
                targetStatusId: v.optional(v.string()),
                characterId: v.optional(v.id('character')),
                displayName: v.optional(v.string()),
                personKind: v.optional(trackedPersonKindValidator),
                mode: v.optional(restoreCharacterModeValidator),
                customCostTotal: v.optional(v.string()),
              }),
            ),
          ),
        }),
      ),
      upkeepTeamOperations: v.optional(
        v.object({
          disabledRecoveries: v.optional(
            v.array(
              v.object({
                teamId: teamIdValidator,
                paid: v.boolean(),
              }),
            ),
          ),
          missingChecks: v.optional(
            v.array(
              v.object({
                teamId: teamIdValidator,
                securityCheckTotal: v.optional(v.string()),
                permanentlyLost: v.optional(v.boolean()),
              }),
            ),
          ),
        }),
      ),
      eventMitigations: v.optional(
        v.object({
          cacheDiscoveredMitigationTotal: v.optional(v.string()),
          theftMitigationTotal: v.optional(v.string()),
          sicknessTwiceLoyaltyTotal: v.optional(v.string()),
          turncoatOfficerCheckTotal: v.optional(v.string()),
          turncoatSelectedTeamId: v.optional(teamIdValidator),
          rivalrySelectedTeamIds: v.optional(v.array(teamIdValidator)),
          missingInActionSelectedTeamId: v.optional(teamIdValidator),
          sicknessSelectedTeamId: v.optional(teamIdValidator),
          turnAroundBoostTeamId: v.optional(teamIdValidator),
          marketDayMarketplaceId: v.optional(v.string()),
          marketDayTownName: v.optional(v.string()),
          overseerEventSupportTarget: v.optional(
            v.union(
              v.literal('sabotage'),
              v.literal('cache_discovered'),
              v.literal('theft'),
              v.literal('sickness_twice'),
            ),
          ),
        }),
      ),
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
          restoreCharacterCostTotal: v.optional(v.string()),
          secureCacheCheckTotal: v.optional(v.string()),
          specialActionCostTotal: v.optional(v.string()),
          specialOrderItemCostTotal: v.optional(v.string()),
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
    const currentAny = current as
      | (typeof current & {
          activityOfficerOperations?: {
            changes?: Array<{
              slotIndex: number;
              role: string;
              characterId?: Id<'character'>;
            }>;
          };
        })
      | undefined;
    const maxActions = getCurrentWeekMaxActions({
      rank: militia.rank,
      strategist: militia.strategist,
      stagedActivityActionIds:
        args.patch.stagedActivityActionIds ?? current?.stagedActivityActionIds,
      activityOfficerOperations:
        args.patch.activityOfficerOperations ?? currentAny?.activityOfficerOperations,
    });

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
      stagedActivityTeamIds?: (string | null)[];
      activityTeamOperations?: {
        recruits: Array<{ slotIndex: number; teamId: string }>;
        dismissals: Array<{ slotIndex: number; teamId: string }>;
        upgrades: Array<{ slotIndex: number; fromTeamId: string; toTeamId: string }>;
      };
      activityOfficerOperations?: {
        changes: Array<{
          slotIndex: number;
          role:
            | 'ambassador'
            | 'commandant'
            | 'marshal'
            | 'overseer'
            | 'spymaster'
            | 'strategist';
          characterId?: Id<'character'>;
        }>;
      };
      activityAssetOperations?: {
        refuges: Array<{ slotIndex: number; settlementKey: string }>;
        caches: Array<{
          slotIndex: number;
          mode: 'place' | 'retrieve';
          cacheId?: string;
          label?: string;
          cacheClass?: 'minor' | 'intermediate' | 'major';
          location?: string;
          contentsSummary?: string;
          isSecureLocation?: boolean;
          checkTotal?: number;
        }>;
        orders: Array<{
          slotIndex: number;
          description: string;
          notes?: string;
          costPaid?: number;
          deliveryDays?: number;
        }>;
        marketplaces: Array<{
          slotIndex: number;
          label?: string;
          purchaseSummary?: string;
          notes?: string;
        }>;
        covertActions: Array<{
          slotIndex: number;
          mode?: 'augment_action' | 'place_contact';
          targetSource?: 'character' | 'freeform';
          followupSlotIndex?: number;
          characterId?: Id<'character'>;
          displayName?: string;
          personKind?: 'pc' | 'officer_npc' | 'other_npc';
          siteName?: string;
          notes?: string;
        }>;
        rescues: Array<{
          slotIndex: number;
          targetSource?: 'tracked' | 'character' | 'freeform';
          targetStatusId?: string;
          characterId?: Id<'character'>;
          displayName?: string;
          personKind?: 'pc' | 'officer_npc' | 'other_npc';
          targetLevel?: number;
          destinationType?: 'hq' | 'refuge' | 'settlement';
          destinationSettlementKey?: string;
        }>;
        restorations: Array<{
          slotIndex: number;
          targetSource?: 'tracked' | 'character' | 'freeform';
          targetStatusId?: string;
          characterId?: Id<'character'>;
          displayName?: string;
          personKind?: 'pc' | 'officer_npc' | 'other_npc';
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
      };
      upkeepTeamOperations?: {
        disabledRecoveries: Array<{ teamId: string; paid: boolean }>;
        missingChecks: Array<{
          teamId: string;
          securityCheckTotal?: number;
          permanentlyLost?: boolean;
        }>;
      };
      eventMitigations?: {
        cacheDiscoveredMitigationTotal?: number;
        theftMitigationTotal?: number;
        sicknessTwiceLoyaltyTotal?: number;
        turncoatOfficerCheckTotal?: number;
        turncoatSelectedTeamId?: string;
        rivalrySelectedTeamIds?: string[];
        missingInActionSelectedTeamId?: string;
        sicknessSelectedTeamId?: string;
        turnAroundBoostTeamId?: string;
        marketDayMarketplaceId?: string;
        marketDayTownName?: string;
        overseerEventSupportTarget?:
          | 'sabotage'
          | 'cache_discovered'
          | 'theft'
          | 'sickness_twice';
      };
      weekWarnings?: Array<{ code: string; message: string }>;
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
        restoreCharacterCostTotal?: number;
        secureCacheCheckTotal?: number;
        specialActionCostTotal?: number;
        specialOrderItemCostTotal?: number;
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
      const stagedLegalityWarnings = validateStagedActionsLegality({
        stagedActions: args.patch.stagedActivityActionIds,
        activeTeamIds,
      });
      nextPatch.weekWarnings = stagedLegalityWarnings;
      nextPatch.stagedActivityActionIds = args.patch.stagedActivityActionIds.slice(
        0,
        maxActions,
      );
    }
    if (args.patch.stagedActivityTeamIds) {
      nextPatch.stagedActivityTeamIds = args.patch.stagedActivityTeamIds
        .slice(0, maxActions)
        .map((value) => value ?? null);
    }
    if (args.patch.activityTeamOperations) {
      const recruits = args.patch.activityTeamOperations.recruits ?? [];
      const dismissals = args.patch.activityTeamOperations.dismissals ?? [];
      const upgrades = args.patch.activityTeamOperations.upgrades ?? [];
      nextPatch.activityTeamOperations = {
        recruits,
        dismissals,
        upgrades,
      };

      const teamRows = await ctx.db
        .query('militiaTeam')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
        .collect();
      const warnings = buildTeamOperationWarnings({
        rank: militia.rank,
        rosterTeamIds: teamRows.map((row) => row.teamId),
        recruits,
        dismissals,
        upgrades,
      });
      nextPatch.weekWarnings = appendUniqueWarnings(nextPatch.weekWarnings, warnings);
    }
    if (args.patch.activityOfficerOperations) {
      nextPatch.activityOfficerOperations = {
        changes: (args.patch.activityOfficerOperations.changes ?? []).map(
          (change) => ({
            slotIndex: change.slotIndex,
            role: change.role,
            characterId: change.characterId,
          }),
        ),
      };
    }
    if (args.patch.activityAssetOperations) {
      nextPatch.activityAssetOperations = {
        refuges: (args.patch.activityAssetOperations.refuges ?? []).map((entry) => ({
          slotIndex: entry.slotIndex,
          settlementKey: entry.settlementKey.trim(),
        })),
        caches: (args.patch.activityAssetOperations.caches ?? []).map((entry) => ({
          slotIndex: entry.slotIndex,
          mode: entry.mode,
          ...(trimToUndefined(entry.cacheId)
            ? { cacheId: trimToUndefined(entry.cacheId) }
            : {}),
          label: trimToUndefined(entry.label),
          cacheClass: entry.cacheClass,
          location: trimToUndefined(entry.location),
          contentsSummary: trimToUndefined(entry.contentsSummary),
          isSecureLocation: entry.isSecureLocation ?? false,
          checkTotal: parseManualTotal(entry.checkTotal),
        })),
        orders: (args.patch.activityAssetOperations.orders ?? []).map((entry) => ({
          slotIndex: entry.slotIndex,
          description: entry.description.trim(),
          notes: trimToUndefined(entry.notes),
          costPaid: parseOptionalNonNegativeTotal(entry.costPaid),
          deliveryDays: parseOptionalNonNegativeTotal(entry.deliveryDays),
        })),
        marketplaces: (args.patch.activityAssetOperations.marketplaces ?? []).map(
          (entry) => ({
            slotIndex: entry.slotIndex,
            label: trimToUndefined(entry.label),
            purchaseSummary: trimToUndefined(entry.purchaseSummary),
            notes: trimToUndefined(entry.notes),
          }),
        ),
        covertActions: (args.patch.activityAssetOperations.covertActions ?? []).map(
          (entry) => ({
            slotIndex: entry.slotIndex,
            mode: entry.mode,
            targetSource: entry.targetSource,
            followupSlotIndex: entry.followupSlotIndex,
            characterId: entry.characterId,
            displayName: trimToUndefined(entry.displayName),
            personKind: entry.personKind,
            siteName: trimToUndefined(entry.siteName),
            notes: trimToUndefined(entry.notes),
          }),
        ),
        rescues: (args.patch.activityAssetOperations.rescues ?? []).map((entry) => ({
          slotIndex: entry.slotIndex,
          targetSource: entry.targetSource,
          targetStatusId: trimToUndefined(entry.targetStatusId),
          characterId: entry.characterId,
          displayName: trimToUndefined(entry.displayName),
          personKind: entry.personKind,
          targetLevel: parseOptionalNonNegativeTotal(entry.targetLevel),
          destinationType: entry.destinationType,
          destinationSettlementKey: trimToUndefined(entry.destinationSettlementKey),
        })),
        restorations: (args.patch.activityAssetOperations.restorations ?? []).map(
          (entry) => ({
            slotIndex: entry.slotIndex,
            targetSource: entry.targetSource,
            targetStatusId: trimToUndefined(entry.targetStatusId),
            characterId: entry.characterId,
            displayName: trimToUndefined(entry.displayName),
            personKind: entry.personKind,
            mode: entry.mode,
            customCostTotal: parseOptionalNonNegativeTotal(entry.customCostTotal),
          }),
        ),
      };

      const settlementStates = await ctx.db
        .query('militiaSettlementState')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
        .collect();
      const knownSettlementKeys = new Set(
        settlementStates.map((settlement) => settlement.settlementKey),
      );
      const missingSettlementWarnings = Array.from(
        new Set(
          nextPatch.activityAssetOperations.refuges
            .map((entry) => entry.settlementKey)
            .filter(
              (settlementKey) =>
                Boolean(settlementKey) && !knownSettlementKeys.has(settlementKey),
            ),
        ),
      ).map((settlementKey) => ({
        code: 'refuge_requires_tracked_settlement',
        message: `Activate Refuge requires a tracked settlement in the ledger. Add "${settlementKey}" there first.`,
      }));
      nextPatch.weekWarnings = appendUniqueWarnings(
        nextPatch.weekWarnings,
        missingSettlementWarnings,
      );
    }
    if (args.patch.upkeepTeamOperations) {
      nextPatch.upkeepTeamOperations = {
        disabledRecoveries: args.patch.upkeepTeamOperations.disabledRecoveries ?? [],
        missingChecks: (args.patch.upkeepTeamOperations.missingChecks ?? []).map(
          (entry) => ({
            teamId: entry.teamId,
            securityCheckTotal: parseManualTotal(entry.securityCheckTotal),
            permanentlyLost: entry.permanentlyLost,
          }),
        ),
      };
    }
    if (args.patch.eventMitigations) {
      nextPatch.eventMitigations = {
        cacheDiscoveredMitigationTotal: parseManualTotal(
          args.patch.eventMitigations.cacheDiscoveredMitigationTotal,
        ),
        theftMitigationTotal: parseManualTotal(
          args.patch.eventMitigations.theftMitigationTotal,
        ),
        sicknessTwiceLoyaltyTotal: parseManualTotal(
          args.patch.eventMitigations.sicknessTwiceLoyaltyTotal,
        ),
        turncoatOfficerCheckTotal: parseManualTotal(
          args.patch.eventMitigations.turncoatOfficerCheckTotal,
        ),
        turncoatSelectedTeamId: args.patch.eventMitigations.turncoatSelectedTeamId,
        rivalrySelectedTeamIds: args.patch.eventMitigations.rivalrySelectedTeamIds,
        missingInActionSelectedTeamId:
          args.patch.eventMitigations.missingInActionSelectedTeamId,
        sicknessSelectedTeamId: args.patch.eventMitigations.sicknessSelectedTeamId,
        turnAroundBoostTeamId: args.patch.eventMitigations.turnAroundBoostTeamId,
        marketDayMarketplaceId: trimToUndefined(
          args.patch.eventMitigations.marketDayMarketplaceId,
        ),
        marketDayTownName: trimToUndefined(args.patch.eventMitigations.marketDayTownName),
        overseerEventSupportTarget:
          args.patch.eventMitigations.overseerEventSupportTarget,
      };
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
        restoreCharacterCostTotal: parseOptionalNonNegativeTotal(
          args.patch.activityRollTotals.restoreCharacterCostTotal,
        ),
        secureCacheCheckTotal: parseManualTotal(
          args.patch.activityRollTotals.secureCacheCheckTotal,
        ),
        specialActionCostTotal: parseOptionalNonNegativeTotal(
          args.patch.activityRollTotals.specialActionCostTotal,
        ),
        specialOrderItemCostTotal: parseOptionalNonNegativeTotal(
          args.patch.activityRollTotals.specialOrderItemCostTotal,
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
        stagedActivityTeamIds:
          (nextPatch.stagedActivityTeamIds ??
            Array.from({ length: maxActions }, () => null)) as never,
        activityTeamOperations: (nextPatch.activityTeamOperations ?? {
          recruits: [],
          dismissals: [],
          upgrades: [],
        }) as never,
        activityOfficerOperations: (nextPatch.activityOfficerOperations ?? {
          changes: [],
        }) as never,
        activityAssetOperations: (nextPatch.activityAssetOperations ?? {
          refuges: [],
          caches: [],
          orders: [],
        }) as never,
        upkeepTeamOperations: (nextPatch.upkeepTeamOperations ?? {
          disabledRecoveries: [],
          missingChecks: [],
        }) as never,
        eventMitigations: (nextPatch.eventMitigations ?? {}) as never,
        weekWarnings: (nextPatch.weekWarnings ?? []) as never,
        upkeepRollTotals: nextPatch.upkeepRollTotals,
        activityRollTotals: nextPatch.activityRollTotals,
        eventRollTotals: nextPatch.eventRollTotals,
        lockVersion: nextPatch.lockVersion,
      });
      return;
    }

    await ctx.db.patch('militiaWeekState', current._id, nextPatch as never);
  },
});

export const commitCurrentPhase = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    militiaId: v.id('militia'),
  },
  async handler(ctx, args) {
    const militia = await assertMilitiaAccess(ctx, args.militiaId, args.organizationId);
    const baseMaxActions = getMaxActionsForMilitia({
      rank: militia.rank,
      strategist: militia.strategist,
    });

    const existing = await ctx.db
      .query('militiaWeekState')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
      .collect();
    const current = existing.sort((a, b) => b.weekNumber - a.weekNumber)[0];
    const currentAny = current as
      | (typeof current & {
          stagedActivityTeamIds?: (string | null)[];
          activityTeamOperations?: {
            recruits: Array<{ slotIndex: number; teamId: string }>;
            dismissals: Array<{ slotIndex: number; teamId: string }>;
            upgrades: Array<{
              slotIndex: number;
              fromTeamId: string;
              toTeamId: string;
            }>;
          };
          activityOfficerOperations?: {
            changes: Array<{
              slotIndex: number;
              role:
                | 'ambassador'
                | 'commandant'
                | 'marshal'
                | 'overseer'
                | 'spymaster'
                | 'strategist';
              characterId?: Id<'character'>;
            }>;
          };
          activityAssetOperations?: {
            refuges: Array<{ slotIndex: number; settlementKey: string }>;
            caches: Array<{
              slotIndex: number;
              mode: 'place' | 'retrieve';
              cacheId?: string;
              label?: string;
              cacheClass?: 'minor' | 'intermediate' | 'major';
              location?: string;
              contentsSummary?: string;
              isSecureLocation?: boolean;
              checkTotal?: number;
            }>;
            orders: Array<{
              slotIndex: number;
              description: string;
              notes?: string;
              costPaid?: number;
              deliveryDays?: number;
            }>;
            marketplaces: Array<{
              slotIndex: number;
              label?: string;
              purchaseSummary?: string;
              notes?: string;
            }>;
            covertActions: Array<{
              slotIndex: number;
              mode?: 'augment_action' | 'place_contact';
              targetSource?: 'character' | 'freeform';
              followupSlotIndex?: number;
              characterId?: Id<'character'>;
              displayName?: string;
              personKind?: 'pc' | 'officer_npc' | 'other_npc';
              siteName?: string;
              notes?: string;
            }>;
            rescues: Array<{
              slotIndex: number;
              targetSource?: 'tracked' | 'character' | 'freeform';
              targetStatusId?: string;
              characterId?: Id<'character'>;
              displayName?: string;
              personKind?: 'pc' | 'officer_npc' | 'other_npc';
              targetLevel?: number;
              destinationType?: 'hq' | 'refuge' | 'settlement';
              destinationSettlementKey?: string;
            }>;
            restorations: Array<{
              slotIndex: number;
              targetSource?: 'tracked' | 'character' | 'freeform';
              targetStatusId?: string;
              characterId?: Id<'character'>;
              displayName?: string;
              personKind?: 'pc' | 'officer_npc' | 'other_npc';
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
          };
          upkeepTeamOperations?: {
            disabledRecoveries: Array<{ teamId: string; paid: boolean }>;
            missingChecks: Array<{
              teamId: string;
              securityCheckTotal?: number;
              permanentlyLost?: boolean;
            }>;
          };
          eventMitigations?: {
            cacheDiscoveredMitigationTotal?: number;
            theftMitigationTotal?: number;
            sicknessTwiceLoyaltyTotal?: number;
            turncoatOfficerCheckTotal?: number;
            turncoatSelectedTeamId?: string;
            rivalrySelectedTeamIds?: string[];
            missingInActionSelectedTeamId?: string;
            sicknessSelectedTeamId?: string;
            turnAroundBoostTeamId?: string;
            marketDayMarketplaceId?: string;
            marketDayTownName?: string;
            overseerEventSupportTarget?:
              | 'sabotage'
              | 'cache_discovered'
              | 'theft'
              | 'sickness_twice';
          };
          weekWarnings?: Array<{ code: string; message: string }>;
        })
      | undefined;
    const nextWeekMaxActions = getMaxActionsForMilitia({
      rank: militia.rank,
      strategist: current
        ? getFinalStrategistAssignmentForWeek({
            strategist: militia.strategist,
            stagedActivityActionIds: current.stagedActivityActionIds,
            activityOfficerOperations: currentAny?.activityOfficerOperations,
          })
        : militia.strategist,
    });

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
        stagedActivityActionIds: Array.from({ length: baseMaxActions }, () => null),
        stagedActivityTeamIds: Array.from({ length: baseMaxActions }, () => null),
        activityTeamOperations: {
          recruits: [],
          dismissals: [],
          upgrades: [],
        },
        activityOfficerOperations: {
          changes: [],
        },
        activityAssetOperations: {
          refuges: [],
          caches: [],
          orders: [],
          covertActions: [],
          rescues: [],
          restorations: [],
        },
        upkeepTeamOperations: {
          disabledRecoveries: [],
          missingChecks: [],
        },
        eventMitigations: {},
        weekWarnings: [],
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
      const teamRows = await ctx.db
        .query('militiaTeam')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
        .collect();
      const teamStateRows = await ctx.db
        .query('militiaTeamState')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
        .collect();
      const settlementRows = await ctx.db
        .query('militiaSettlementState')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
        .collect();
      const cacheRows = await ctx.db
        .query('militiaCache')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
        .collect();
      const marketplaceRows = await ctx.db
        .query('militiaMarketplace')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
        .collect();
      const orderRows = await ctx.db
        .query('militiaOrder')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
        .collect();
      const trackedPeopleRows = await ctx.db
        .query('militiaCharacterStatus')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
        .collect();
      const characterRows = (await ctx.db.query('character').collect()).filter(
        (character) => character.campaignId === militia.campaignId,
      );
      const teamById = new Map<string, (typeof teamRows)[number]>(
        teamRows.map((row) => [row.teamId, row]),
      );
      const teamStateById = getTeamStatusRowsByTeamId(teamStateRows) as Map<
        string,
        (typeof teamStateRows)[number]
      >;
      const settlementByKey = new Map<string, (typeof settlementRows)[number]>(
        settlementRows.map((row) => [row.settlementKey, row]),
      );
      const cacheById = new Map<string, (typeof cacheRows)[number]>(
        cacheRows.map((row) => [row._id, row]),
      );
      const marketplaceById = new Map<string, (typeof marketplaceRows)[number]>(
        marketplaceRows.map((row) => [row._id, row]),
      );
      const orderById = new Map<string, (typeof orderRows)[number]>(
        orderRows.map((row) => [row._id, row]),
      );
      const trackedPersonById = new Map<
        string,
        (typeof trackedPeopleRows)[number]
      >(trackedPeopleRows.map((row) => [row._id, row]));
      const trackedPersonByCharacterId = new Map<
        string,
        (typeof trackedPeopleRows)[number]
      >(
        trackedPeopleRows
          .filter((row) => Boolean(row.characterId))
          .map((row) => [row.characterId!, row]),
      );
      const characterById = new Map<string, (typeof characterRows)[number]>(
        characterRows.map((row) => [row._id, row]),
      );

      const ensureTeamState = async (teamId: string) => {
        const currentState = teamStateById.get(teamId);
        if (currentState) return currentState;
        const insertedId = await ctx.db.insert('militiaTeamState', {
          militiaId: args.militiaId,
          teamId: teamId as never,
          status: 'active',
        });
        const inserted = await ctx.db.get('militiaTeamState', insertedId);
        if (!inserted) {
          throw new ConvexError('Failed to initialize team state.');
        }
        teamStateById.set(teamId, inserted);
        return inserted;
      };

      const resolveTrackedPersonIdentity = ({
        targetStatusId,
        characterId,
        displayName,
        personKind,
      }: {
        targetStatusId?: string;
        characterId?: Id<'character'>;
        displayName?: string;
        personKind?: 'pc' | 'officer_npc' | 'other_npc';
      }) => {
        const existingTracked =
          (targetStatusId ? trackedPersonById.get(targetStatusId) : undefined) ??
          (characterId ? trackedPersonByCharacterId.get(characterId) : undefined);
        if (existingTracked) {
          return {
            existingTracked,
            characterId: existingTracked.characterId,
            displayName: existingTracked.displayName,
            personKind: existingTracked.personKind,
            level: existingTracked.level,
          };
        }
        if (characterId) {
          const character = characterById.get(characterId);
          if (!character) {
            throw new ConvexError('Tracked person references unknown character.');
          }
          return {
            existingTracked: undefined,
            characterId,
            displayName: character.name,
            personKind: coerceTrackedPersonKindFromCharacter(character.kind),
            level: character.level,
          };
        }
        return {
          existingTracked: undefined,
          characterId: undefined,
          displayName: trimToUndefined(displayName),
          personKind: normalizeTrackedPersonKind(personKind),
          level: undefined,
        };
      };

      const upsertTrackedPerson = async ({
        targetStatusId,
        characterId,
        displayName,
        personKind,
        level,
        patch,
      }: {
        targetStatusId?: string;
        characterId?: Id<'character'>;
        displayName?: string;
        personKind?: 'pc' | 'officer_npc' | 'other_npc';
        level?: number;
        patch: {
          status: 'active' | 'hidden' | 'captured' | 'recovering' | 'contact';
          locationType: 'hq' | 'refuge' | 'settlement' | 'site' | 'unknown';
          settlementKey?: string;
          siteName?: string;
          notes?: string;
          activeUntilWeek?: number;
          hiddenSinceWeek?: number;
          capturedSinceWeek?: number;
          rescuedWeek?: number;
          restoredWeek?: number;
          rescueDcOverride?: number;
          sourceAction?: 'manual' | 'covert_action' | 'rescue_character' | 'restore_character' | 'event_raid';
        };
      }) => {
        const resolved = resolveTrackedPersonIdentity({
          targetStatusId,
          characterId,
          displayName,
          personKind,
        });
        const nextDisplayName = resolved.displayName ?? trimToUndefined(displayName);
        if (!nextDisplayName) {
          throw new ConvexError('Tracked person requires a name.');
        }
        const nextLevel = level ?? resolved.level;
        const nextPersonKind = resolved.personKind ?? normalizeTrackedPersonKind(personKind);

        if (resolved.existingTracked) {
          await ctx.db.patch('militiaCharacterStatus', resolved.existingTracked._id, {
            characterId: resolved.characterId,
            displayName: nextDisplayName,
            personKind: nextPersonKind,
            level: nextLevel,
            ...patch,
          });
          const updated = {
            ...resolved.existingTracked,
            characterId: resolved.characterId,
            displayName: nextDisplayName,
            personKind: nextPersonKind,
            level: nextLevel,
            ...patch,
          };
          trackedPersonById.set(resolved.existingTracked._id, updated);
          if (resolved.characterId) {
            trackedPersonByCharacterId.set(resolved.characterId, updated);
          }
          return updated;
        }

        const insertedId = await ctx.db.insert('militiaCharacterStatus', {
          militiaId: args.militiaId,
          characterId: resolved.characterId,
          displayName: nextDisplayName,
          personKind: nextPersonKind,
          level: nextLevel,
          ...patch,
        });
        const inserted = await ctx.db.get('militiaCharacterStatus', insertedId);
        if (!inserted) {
          throw new ConvexError('Failed to create tracked person status.');
        }
        trackedPersonById.set(inserted._id, inserted);
        if (inserted.characterId) {
          trackedPersonByCharacterId.set(inserted.characterId, inserted);
        }
        return inserted;
      };

      // Week boundary: release teams whose unavailability expires this week.
      for (const teamState of teamStateRows) {
        if (
          teamState.unavailableUntilWeek !== undefined &&
          teamState.unavailableUntilWeek <= current.weekNumber
        ) {
          if (
            teamState.status === 'missing' &&
            teamState.notes?.includes('return_disabled')
          ) {
            await ctx.db.patch('militiaTeamState', teamState._id, {
              status: 'disabled',
              unavailableUntilWeek: undefined,
              notes: teamState.notes.replace('return_disabled', '').trim(),
            });
          } else {
            await ctx.db.patch('militiaTeamState', teamState._id, {
              status: 'active',
              unavailableUntilWeek: undefined,
            });
          }
        }
      }

      const activityTeamOperations = currentAny?.activityTeamOperations ?? {
        recruits: [],
        dismissals: [],
        upgrades: [],
      };
      const activityOfficerOperations = currentAny?.activityOfficerOperations ?? {
        changes: [],
      };
      const activityAssetOperations = {
        refuges: currentAny?.activityAssetOperations?.refuges ?? [],
        caches: currentAny?.activityAssetOperations?.caches ?? [],
        orders: currentAny?.activityAssetOperations?.orders ?? [],
        marketplaces: currentAny?.activityAssetOperations?.marketplaces ?? [],
        covertActions: currentAny?.activityAssetOperations?.covertActions ?? [],
        rescues: currentAny?.activityAssetOperations?.rescues ?? [],
        restorations:
          currentAny?.activityAssetOperations?.restorations ?? [],
      };
      const upkeepTeamOperations = currentAny?.upkeepTeamOperations ?? {
        disabledRecoveries: [],
        missingChecks: [],
      };
      const eventMitigations = currentAny?.eventMitigations ?? {};

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
          activityTeamOperations: currentAny?.activityTeamOperations,
          activityAssetOperations: currentAny?.activityAssetOperations,
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

      let adjustedTreasury = resolution.militiaPatch.treasury;

      const minimumTreasuryValue = militia.rank * 10;
      const stagedActionIds = current.stagedActivityActionIds.filter(
        (value): value is NonNullable<typeof value> => value !== null,
      );
      const countAction = (actionId: NonNullable<(typeof stagedActionIds)[number]>) =>
        stagedActionIds.filter((value) => value === actionId).length;

      // Fixed treasury costs from staged activity actions.
      adjustedTreasury -= countAction('activate_black_market') * 50;
      adjustedTreasury -= countAction('broker_market') * 100;
      adjustedTreasury -= countAction('spread_propaganda') * 100;
      adjustedTreasury -= countAction('drill_militia') * minimumTreasuryValue;
      adjustedTreasury -= countAction('guarantee_event') * minimumTreasuryValue;

      // Variable activity costs entered during activity flow.
      const stagedRestoreCostTotal = activityAssetOperations.restorations.reduce(
        (sum, restoration) =>
          current.stagedActivityActionIds[restoration.slotIndex] === 'restore_character'
            ? sum +
              (restoration.customCostTotal ??
                getRestoreCharacterCostForMode(restoration.mode))
            : sum,
        0,
      );
      adjustedTreasury -=
        stagedRestoreCostTotal || (current.activityRollTotals?.restoreCharacterCostTotal ?? 0);
      adjustedTreasury -= current.activityRollTotals?.specialActionCostTotal ?? 0;
      const stagedOrderCostTotal = activityAssetOperations.orders.reduce(
        (sum, order) =>
          current.stagedActivityActionIds[order.slotIndex] === 'special_order'
            ? sum + (order.costPaid ?? 0)
            : sum,
        0,
      );
      adjustedTreasury -=
        stagedOrderCostTotal || (current.activityRollTotals?.specialOrderItemCostTotal ?? 0);

      for (const recovery of upkeepTeamOperations.disabledRecoveries) {
        if (!recovery.paid) continue;
        const state = await ensureTeamState(recovery.teamId);
        if (state.status !== 'disabled') continue;
        adjustedTreasury -= minimumTreasuryValue;
        await ctx.db.patch('militiaTeamState', state._id, {
          status: 'active',
          unavailableUntilWeek: undefined,
          notes: state.notes,
        });
      }

      for (const missingCheck of upkeepTeamOperations.missingChecks) {
        const state = await ensureTeamState(missingCheck.teamId);
        if (state.status !== 'missing') continue;
        if (missingCheck.permanentlyLost) {
          const teamRow = teamById.get(missingCheck.teamId);
          if (teamRow) {
            await ctx.db.delete('militiaTeam', teamRow._id);
            teamById.delete(missingCheck.teamId);
          }
          await ctx.db.delete('militiaTeamState', state._id);
          teamStateById.delete(missingCheck.teamId);
          continue;
        }
        if (
          missingCheck.securityCheckTotal !== undefined &&
          missingCheck.securityCheckTotal >= 15
        ) {
          await ctx.db.patch('militiaTeamState', state._id, {
            status: 'active',
            unavailableUntilWeek: undefined,
          });
        }
      }

      for (const dismiss of activityTeamOperations.dismissals) {
        const teamRow = teamById.get(dismiss.teamId);
        if (teamRow) {
          await ctx.db.delete('militiaTeam', teamRow._id);
          teamById.delete(dismiss.teamId);
        }
        const state = teamStateById.get(dismiss.teamId);
        if (state) {
          await ctx.db.delete('militiaTeamState', state._id);
          teamStateById.delete(dismiss.teamId);
        }
      }

      for (const recruit of activityTeamOperations.recruits) {
        let recruitedThisWeek = false;
        if (!teamById.has(recruit.teamId)) {
          const teamDocId = await ctx.db.insert('militiaTeam', {
            militiaId: args.militiaId,
            teamId: recruit.teamId as never,
          });
          const teamRow = await ctx.db.get('militiaTeam', teamDocId);
          if (teamRow) {
            teamById.set(recruit.teamId, teamRow);
            recruitedThisWeek = true;
          }
        }
        const currentTeamState = teamStateById.get(recruit.teamId);
        if (!currentTeamState) {
          const stateDocId = await ctx.db.insert('militiaTeamState', {
            militiaId: args.militiaId,
            teamId: recruit.teamId as never,
            status: 'active',
          });
          const inserted = await ctx.db.get('militiaTeamState', stateDocId);
          if (inserted) {
            teamStateById.set(recruit.teamId, inserted);
          }
        }
        if (recruitedThisWeek) {
          adjustedTreasury -= getTeamCost(recruit.teamId);
        }
      }

      for (const upgrade of activityTeamOperations.upgrades) {
        const teamRow = teamById.get(upgrade.fromTeamId);
        if (!teamRow) continue;
        adjustedTreasury -= getTeamCost(upgrade.toTeamId);
        await ctx.db.patch('militiaTeam', teamRow._id, {
          teamId: upgrade.toTeamId as never,
        });
        teamById.delete(upgrade.fromTeamId);
        teamById.set(upgrade.toTeamId, { ...teamRow, teamId: upgrade.toTeamId });
        const state = teamStateById.get(upgrade.fromTeamId);
        if (state) {
          await ctx.db.patch('militiaTeamState', state._id, {
            teamId: upgrade.toTeamId as never,
          });
          teamStateById.delete(upgrade.fromTeamId);
          teamStateById.set(upgrade.toTeamId, { ...state, teamId: upgrade.toTeamId });
        }
      }

      for (const officerChange of activityOfficerOperations.changes) {
        if (
          current.stagedActivityActionIds[officerChange.slotIndex] !==
          'change_officer_role'
        ) {
          continue;
        }
        if (officerChange.characterId) {
          const character = await ctx.db.get('character', officerChange.characterId);
          if (!character) {
            throw new ConvexError('Officer change references unknown character.');
          }
          if (character.campaignId !== militia.campaignId) {
            throw new ConvexError(
              'Officer change character must belong to this campaign.',
            );
          }
          if (character.isActive === false) {
            throw new ConvexError(
              'Officer change character must be active (not archived).',
            );
          }
        }
        await ctx.db.patch('militia', args.militiaId, {
          [officerChange.role]: officerChange.characterId,
        } as Partial<{
          ambassador: Id<'character'> | undefined;
          commandant: Id<'character'> | undefined;
          marshal: Id<'character'> | undefined;
          overseer: Id<'character'> | undefined;
          spymaster: Id<'character'> | undefined;
          strategist: Id<'character'> | undefined;
        }>);
      }

      for (const refuge of activityAssetOperations.refuges) {
        if (current.stagedActivityActionIds[refuge.slotIndex] !== 'activate_refuge') {
          continue;
        }
        const settlementKey = trimToUndefined(refuge.settlementKey);
        if (!settlementKey) {
          continue;
        }
        const settlement = settlementByKey.get(settlementKey);
        if (!settlement) {
          throw new ConvexError(
            `Activate Refuge requires an existing tracked settlement: ${settlementKey}`,
          );
        }
        await ctx.db.patch('militiaSettlementState', settlement._id, {
          refugeActiveUntilWeek: current.weekNumber + 1,
          refugeActivatedWeek: current.weekNumber,
        });
        settlementByKey.set(settlementKey, {
          ...settlement,
          refugeActiveUntilWeek: current.weekNumber + 1,
          refugeActivatedWeek: current.weekNumber,
        });
      }

      for (const cacheOperation of activityAssetOperations.caches) {
        if (current.stagedActivityActionIds[cacheOperation.slotIndex] !== 'secure_cache') {
          continue;
        }

        if (cacheOperation.mode === 'retrieve') {
          const cacheId = trimToUndefined(cacheOperation.cacheId);
          if (!cacheId || cacheOperation.checkTotal === undefined) {
            continue;
          }
          const cache = cacheById.get(cacheId);
          if (cache?.status !== 'hidden') {
            continue;
          }
          const dc = getCacheDc({
            cacheClass: cache.cacheClass,
            isSecureLocation: cache.isSecureLocation,
          });
          if (cacheOperation.checkTotal >= dc) {
            await ctx.db.patch('militiaCache', cache._id, {
              status: 'retrieved',
              retrievedWeek: current.weekNumber,
              updatedWeek: current.weekNumber,
            });
            cacheById.set(cache._id, {
              ...cache,
              status: 'retrieved',
              retrievedWeek: current.weekNumber,
              updatedWeek: current.weekNumber,
            });
          }
          continue;
        }

        const cacheClass = cacheOperation.cacheClass;
        const label = trimToUndefined(cacheOperation.label);
        const location = trimToUndefined(cacheOperation.location);
        const contentsSummary = trimToUndefined(cacheOperation.contentsSummary);
        if (
          !cacheClass ||
          !label ||
          !location ||
          !contentsSummary ||
          cacheOperation.checkTotal === undefined
        ) {
          continue;
        }
        const status =
          cacheOperation.checkTotal >=
          getCacheDc({
            cacheClass,
            isSecureLocation: cacheOperation.isSecureLocation,
          })
            ? 'hidden'
            : 'pending_return';
        const insertedId = await ctx.db.insert('militiaCache', {
          militiaId: args.militiaId,
          label,
          cacheClass,
          location,
          contentsSummary,
          status,
          isSecureLocation: cacheOperation.isSecureLocation ?? false,
          createdWeek: current.weekNumber,
          updatedWeek: current.weekNumber,
        });
        const inserted = await ctx.db.get('militiaCache', insertedId);
        if (inserted) {
          cacheById.set(inserted._id, inserted);
        }
      }

      for (const order of activityAssetOperations.orders) {
        if (current.stagedActivityActionIds[order.slotIndex] !== 'special_order') {
          continue;
        }
        const description = trimToUndefined(order.description);
        if (!description || order.costPaid === undefined || order.deliveryDays === undefined) {
          continue;
        }
        const dueWeek =
          current.weekNumber + Math.max(1, Math.ceil(order.deliveryDays / 7));
        const insertedId = await ctx.db.insert('militiaOrder', {
          militiaId: args.militiaId,
          description,
          notes: trimToUndefined(order.notes),
          costPaid: order.costPaid,
          deliveryDays: order.deliveryDays,
          orderedWeek: current.weekNumber,
          dueWeek,
          status: 'pending',
        });
        const inserted = await ctx.db.get('militiaOrder', insertedId);
        if (inserted) {
          orderById.set(inserted._id, inserted);
        }
      }

      for (const [slotIndex, stagedActionId] of current.stagedActivityActionIds.entries()) {
        if (
          stagedActionId !== 'broker_market' &&
          stagedActionId !== 'activate_black_market'
        ) {
          continue;
        }

        const teamId = current.stagedActivityTeamIds?.[slotIndex] ?? undefined;
        const profile = getMarketplaceProfile({
          actionId: stagedActionId,
          teamId,
        });
        if (!profile || !teamId) {
          continue;
        }
        if (
          stagedActionId === 'activate_black_market' &&
          (current.activityRollTotals?.activateBlackMarketCheckTotal ?? 0) < 20
        ) {
          continue;
        }

        const marketEntry = activityAssetOperations.marketplaces.find(
          (entry) => entry.slotIndex === slotIndex,
        );
        const label = getMarketplaceDefaultLabel({
          actionId: stagedActionId,
          customLabel: marketEntry?.label,
          weekNumber: current.weekNumber,
          slotIndex,
        });
        const insertedMarketplaceId = await ctx.db.insert('militiaMarketplace', {
          militiaId: args.militiaId,
          label,
          sourceAction: stagedActionId,
          teamId: teamId as never,
          availabilityTier: profile.availabilityTier,
          availabilityThreshold: profile.availabilityThreshold,
          saleValuePercent: profile.saleValuePercent,
          contrabandAllowed: profile.contrabandAllowed,
          createdWeek: current.weekNumber,
          activeUntilWeek: current.weekNumber + 1,
          notes: trimToUndefined(marketEntry?.notes),
        });
        const insertedMarketplace = await ctx.db.get(
          'militiaMarketplace',
          insertedMarketplaceId,
        );
        if (insertedMarketplace) {
          marketplaceById.set(insertedMarketplace._id, insertedMarketplace);
        }

        const purchaseSummary = trimToUndefined(marketEntry?.purchaseSummary);
        if (!purchaseSummary) {
          continue;
        }

        const orderNotes = [trimToUndefined(marketEntry?.notes), `Marketplace: ${label}`]
          .filter((value): value is string => Boolean(value))
          .join(' • ');
        const insertedOrderId = await ctx.db.insert('militiaOrder', {
          militiaId: args.militiaId,
          description: purchaseSummary,
          notes: orderNotes || undefined,
          deliveryDays: 7,
          orderedWeek: current.weekNumber,
          dueWeek: current.weekNumber + 1,
          status: 'pending',
          sourceAction: stagedActionId,
          marketplaceId: insertedMarketplaceId,
        });
        const insertedOrder = await ctx.db.get('militiaOrder', insertedOrderId);
        if (insertedOrder) {
          orderById.set(insertedOrder._id, insertedOrder);
        }
      }

      for (const covertAction of activityAssetOperations.covertActions) {
        if (current.stagedActivityActionIds[covertAction.slotIndex] !== 'covert_action') {
          continue;
        }
        if (covertAction.mode !== 'place_contact') {
          continue;
        }
        const siteName = trimToUndefined(covertAction.siteName);
        if (!siteName) {
          continue;
        }
        const hasTarget =
          covertAction.characterId ?? trimToUndefined(covertAction.displayName);
        if (!hasTarget) {
          continue;
        }
        await upsertTrackedPerson({
          characterId: covertAction.characterId,
          displayName: covertAction.displayName,
          personKind: covertAction.personKind,
          patch: {
            status: 'contact',
            locationType: 'site',
            siteName,
            notes: trimToUndefined(covertAction.notes),
            activeUntilWeek: current.weekNumber + 1,
            sourceAction: 'covert_action',
          },
        });
      }

      for (const rescue of activityAssetOperations.rescues) {
        if (current.stagedActivityActionIds[rescue.slotIndex] !== 'rescue_character') {
          continue;
        }
        const hasTarget =
          rescue.targetStatusId ??
          rescue.characterId ??
          trimToUndefined(rescue.displayName);
        if (!hasTarget) {
          continue;
        }
        const resolvedIdentity = resolveTrackedPersonIdentity({
          targetStatusId: rescue.targetStatusId,
          characterId: rescue.characterId,
          displayName: rescue.displayName,
          personKind: rescue.personKind,
        });
        const effectiveLevel =
          rescue.targetLevel ??
          resolvedIdentity.level ??
          current.activityRollTotals?.rescueCharacterTargetLevelTotal;
        const checkTotal = current.activityRollTotals?.rescueCharacterCheckTotal;
        if (effectiveLevel === undefined || checkTotal === undefined) {
          continue;
        }
        const existingTracked = resolvedIdentity.existingTracked;
        const requiredDc = existingTracked?.rescueDcOverride ?? 10 + effectiveLevel;
        const isSuccessful = checkTotal >= requiredDc;
        const destinationType = rescue.destinationType ?? 'hq';
        const destinationSettlementKey =
          destinationType === 'hq'
            ? undefined
            : trimToUndefined(rescue.destinationSettlementKey);

        await upsertTrackedPerson({
          targetStatusId: rescue.targetStatusId,
          characterId: rescue.characterId,
          displayName: rescue.displayName,
          personKind: rescue.personKind,
          level: effectiveLevel,
          patch: isSuccessful
            ? {
                status: 'active',
                locationType: destinationType,
                settlementKey: destinationSettlementKey,
                rescuedWeek: current.weekNumber,
                capturedSinceWeek: undefined,
                rescueDcOverride: undefined,
                sourceAction: 'rescue_character',
              }
            : {
                status: 'captured',
                locationType: existingTracked?.locationType ?? 'unknown',
                settlementKey: existingTracked?.settlementKey,
                siteName: existingTracked?.siteName,
                notes: existingTracked?.notes,
                capturedSinceWeek:
                  existingTracked?.capturedSinceWeek ?? current.weekNumber,
                rescueDcOverride: existingTracked?.rescueDcOverride,
                sourceAction: existingTracked?.sourceAction ?? 'rescue_character',
              },
        });
      }

      for (const restoration of activityAssetOperations.restorations) {
        if (current.stagedActivityActionIds[restoration.slotIndex] !== 'restore_character') {
          continue;
        }
        const hasTarget =
          restoration.targetStatusId ??
          restoration.characterId ??
          trimToUndefined(restoration.displayName);
        const hasMeaningfulRestore =
          hasTarget !== undefined ||
          restoration.mode !== undefined ||
          restoration.customCostTotal !== undefined;
        if (!hasMeaningfulRestore) {
          continue;
        }
        if (!hasTarget) {
          continue;
        }
        const resolvedIdentity = resolveTrackedPersonIdentity({
          targetStatusId: restoration.targetStatusId,
          characterId: restoration.characterId,
          displayName: restoration.displayName,
          personKind: restoration.personKind,
        });
        await upsertTrackedPerson({
          targetStatusId: restoration.targetStatusId,
          characterId: restoration.characterId,
          displayName: restoration.displayName,
          personKind: restoration.personKind,
          level: resolvedIdentity.level,
          patch: {
            status: 'recovering',
            locationType: resolvedIdentity.existingTracked?.locationType ?? 'hq',
            settlementKey: resolvedIdentity.existingTracked?.settlementKey,
            siteName: resolvedIdentity.existingTracked?.siteName,
            notes: resolvedIdentity.existingTracked?.notes,
            restoredWeek: current.weekNumber,
            capturedSinceWeek: undefined,
            rescueDcOverride: undefined,
            sourceAction: 'restore_character',
          },
        });
      }

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

      const setTeamStatus = async ({
        teamId,
        status,
        unavailableUntilWeek,
        notes,
      }: {
        teamId?: string;
        status: 'active' | 'disabled' | 'missing' | 'blocked';
        unavailableUntilWeek?: number;
        notes?: string;
      }) => {
        if (!teamId) return;
        if (!teamById.has(teamId)) return;
        const state = await ensureTeamState(teamId);
        await ctx.db.patch('militiaTeamState', state._id, {
          status,
          unavailableUntilWeek,
          notes,
        });
      };

      for (const event of resolution.resolvedEvents) {
        if (event.eventType === 'cache_discovered') {
          const hiddenCaches = Array.from(cacheById.values())
            .filter((cache) => cache.status === 'hidden')
            .sort((a, b) => a.createdWeek - b.createdWeek);
          const cachesToLose = event.isTwiceClause ? hiddenCaches : hiddenCaches.slice(0, 1);
          for (const cache of cachesToLose) {
            await ctx.db.patch('militiaCache', cache._id, {
              status: 'lost',
              lostWeek: current.weekNumber,
              updatedWeek: current.weekNumber,
            });
            cacheById.set(cache._id, {
              ...cache,
              status: 'lost',
              lostWeek: current.weekNumber,
              updatedWeek: current.weekNumber,
            });
          }
        }
        if (event.eventType === 'missing_in_action') {
          const isTwice = event.isTwiceClause;
          await setTeamStatus({
            teamId: eventMitigations.missingInActionSelectedTeamId,
            status: 'missing',
            unavailableUntilWeek: current.weekNumber + (isTwice ? 2 : 1),
            notes: isTwice ? 'return_disabled' : undefined,
          });
        }
        if (event.eventType === 'sickness') {
          if (event.isTwiceClause) {
            const loyalty = eventMitigations.sicknessTwiceLoyaltyTotal;
            const succeeded = loyalty !== undefined && loyalty >= 20;
            if (!succeeded) {
              const teamId = eventMitigations.sicknessSelectedTeamId;
              const teamRow = teamId ? teamById.get(teamId) : undefined;
              if (teamRow) {
                await ctx.db.delete('militiaTeam', teamRow._id);
                teamById.delete(teamId!);
              }
              const state = teamId ? teamStateById.get(teamId) : undefined;
              if (state) {
                await ctx.db.delete('militiaTeamState', state._id);
                teamStateById.delete(teamId!);
              }
            }
          } else {
            await setTeamStatus({
              teamId: eventMitigations.sicknessSelectedTeamId,
              status: 'disabled',
            });
          }
        }
        if (event.eventType === 'turn_around') {
          const disabledStates = Array.from(teamStateById.values()).filter(
            (state) => state.status === 'disabled',
          );
          if (disabledStates.length > 0) {
            for (const disabledState of disabledStates) {
              await ctx.db.patch('militiaTeamState', disabledState._id, {
                status: 'active',
                unavailableUntilWeek: undefined,
              });
            }
          } else {
            const boostTeamId = eventMitigations.turnAroundBoostTeamId;
            if (boostTeamId) {
              await setTeamStatus({
                teamId: boostTeamId,
                status: 'active',
                notes: `turn_around_boost_week_${current.weekNumber + 1}`,
              });
            }
          }
        }
        if (event.eventType === 'market_day') {
          const activeMarketplaceRows = Array.from(marketplaceById.values()).filter(
            (marketplace) => marketplace.activeUntilWeek >= current.weekNumber,
          );
          const marketplacesToDiscount = event.isTwiceClause
            ? activeMarketplaceRows
            : activeMarketplaceRows.filter(
                (marketplace) =>
                  marketplace._id === eventMitigations.marketDayMarketplaceId,
              );
          for (const marketplace of marketplacesToDiscount) {
            await ctx.db.patch('militiaMarketplace', marketplace._id, {
              marketDayDiscountPercent: 5,
              marketDayAppliedWeek: current.weekNumber,
            });
            marketplaceById.set(marketplace._id, {
              ...marketplace,
              marketDayDiscountPercent: 5,
              marketDayAppliedWeek: current.weekNumber,
            });
          }
        }
        if (event.eventType === 'rivalry') {
          const selected = eventMitigations.rivalrySelectedTeamIds?.slice(0, 2) ?? [];
          for (const teamId of selected) {
            await setTeamStatus({
              teamId,
              status: 'blocked',
              unavailableUntilWeek: current.weekNumber + 1,
            });
          }
        }
        if (event.eventType === 'turncoat' && event.isTwiceClause) {
          const teamId = eventMitigations.turncoatSelectedTeamId;
          if (!teamId) continue;
          const checkTotal = eventMitigations.turncoatOfficerCheckTotal;
          const succeeded =
            checkTotal !== undefined && checkTotal >= 10 + militia.rank;
          if (succeeded) {
            await setTeamStatus({
              teamId,
              status: 'blocked',
              unavailableUntilWeek: current.weekNumber + 1,
            });
          } else {
            const teamRow = teamById.get(teamId);
            if (teamRow) {
              await ctx.db.delete('militiaTeam', teamRow._id);
              teamById.delete(teamId);
            }
            const state = teamStateById.get(teamId);
            if (state) {
              await ctx.db.delete('militiaTeamState', state._id);
              teamStateById.delete(teamId);
            }
          }
        }
        if (event.eventType === 'raid') {
          const activeRefuges = Array.from(settlementByKey.values()).filter(
            (settlement) =>
              settlement.refugeActiveUntilWeek !== undefined &&
              settlement.refugeActiveUntilWeek >= current.weekNumber,
          );
          const raidedSettlementKeys = new Set(
            activeRefuges.map((settlement) => settlement.settlementKey),
          );
          for (const settlement of activeRefuges) {
            await ctx.db.patch('militiaSettlementState', settlement._id, {
              refugeActiveUntilWeek: undefined,
            });
            settlementByKey.set(settlement.settlementKey, {
              ...settlement,
              refugeActiveUntilWeek: undefined,
            });
          }
          for (const person of trackedPersonById.values()) {
            if (
              person.status !== 'hidden' ||
              person.locationType !== 'refuge' ||
              !person.settlementKey ||
              !raidedSettlementKeys.has(person.settlementKey)
            ) {
              continue;
            }
            await ctx.db.patch('militiaCharacterStatus', person._id, {
              status: 'captured',
              capturedSinceWeek: current.weekNumber,
              rescueDcOverride: 5 + militia.rank,
              sourceAction: 'event_raid',
            });
            trackedPersonById.set(person._id, {
              ...person,
              status: 'captured',
              capturedSinceWeek: current.weekNumber,
              rescueDcOverride: 5 + militia.rank,
              sourceAction: 'event_raid',
            });
          }
        }
      }

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

      await ctx.db.patch('militia', args.militiaId, {
        ...resolution.militiaPatch,
        treasury: adjustedTreasury,
      });

      const upcomingWeekNumber = current.weekNumber + 1;
      for (const settlement of settlementByKey.values()) {
        if (
          settlement.refugeActiveUntilWeek !== undefined &&
          settlement.refugeActiveUntilWeek < upcomingWeekNumber
        ) {
          await ctx.db.patch('militiaSettlementState', settlement._id, {
            refugeActiveUntilWeek: undefined,
          });
          settlementByKey.set(settlement.settlementKey, {
            ...settlement,
            refugeActiveUntilWeek: undefined,
          });
        }
      }
      for (const order of orderById.values()) {
        if (order.status === 'pending' && order.dueWeek <= upcomingWeekNumber) {
          await ctx.db.patch('militiaOrder', order._id, {
            status: 'delivered',
            deliveredWeek: upcomingWeekNumber,
          });
          orderById.set(order._id, {
            ...order,
            status: 'delivered',
            deliveredWeek: upcomingWeekNumber,
          });
        }
      }
      for (const trackedPerson of trackedPersonById.values()) {
        if (
          trackedPerson.status === 'contact' &&
          trackedPerson.activeUntilWeek !== undefined &&
          trackedPerson.activeUntilWeek < upcomingWeekNumber
        ) {
          await ctx.db.delete('militiaCharacterStatus', trackedPerson._id);
          trackedPersonById.delete(trackedPerson._id);
          if (trackedPerson.characterId) {
            trackedPersonByCharacterId.delete(trackedPerson.characterId);
          }
        }
      }
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
          ? Array.from({ length: nextWeekMaxActions }, () => null)
          : current.stagedActivityActionIds,
      stagedActivityTeamIds:
        nextPhase === 'upkeep'
          ? Array.from({ length: nextWeekMaxActions }, () => null)
          : currentAny?.stagedActivityTeamIds,
      activityTeamOperations:
        nextPhase === 'upkeep'
          ? { recruits: [], dismissals: [], upgrades: [] }
          : currentAny?.activityTeamOperations,
      activityOfficerOperations:
        nextPhase === 'upkeep'
          ? { changes: [] }
          : currentAny?.activityOfficerOperations,
      activityAssetOperations:
        nextPhase === 'upkeep'
          ? {
              refuges: [],
              caches: [],
              orders: [],
              marketplaces: [],
              covertActions: [],
              rescues: [],
              restorations: [],
            }
          : {
              refuges: currentAny?.activityAssetOperations?.refuges ?? [],
              caches: currentAny?.activityAssetOperations?.caches ?? [],
              orders: currentAny?.activityAssetOperations?.orders ?? [],
              marketplaces:
                currentAny?.activityAssetOperations?.marketplaces ?? [],
              covertActions:
                currentAny?.activityAssetOperations?.covertActions ?? [],
              rescues: currentAny?.activityAssetOperations?.rescues ?? [],
              restorations:
                currentAny?.activityAssetOperations?.restorations ?? [],
            },
      upkeepTeamOperations:
        nextPhase === 'upkeep'
          ? { disabledRecoveries: [], missingChecks: [] }
          : currentAny?.upkeepTeamOperations,
      eventMitigations: nextPhase === 'upkeep' ? {} : currentAny?.eventMitigations,
      weekWarnings: nextPhase === 'upkeep' ? [] : currentAny?.weekWarnings,
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
    const maxActions = getMaxActionsForMilitia({
      rank: militia.rank,
      strategist: militia.strategist,
    });

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
      stagedActivityTeamIds: Array.from({ length: maxActions }, () => null),
      activityTeamOperations: { recruits: [], dismissals: [], upgrades: [] },
      activityOfficerOperations: { changes: [] },
      activityAssetOperations: {
        refuges: [],
        caches: [],
        orders: [],
        covertActions: [],
        rescues: [],
        restorations: [],
      },
      upkeepTeamOperations: { disabledRecoveries: [], missingChecks: [] },
      eventMitigations: {},
      weekWarnings: [],
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
