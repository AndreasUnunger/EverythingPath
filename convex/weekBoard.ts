import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import {
  covertActionModeValidator,
  cacheClassValidator,
  cacheModeValidator,
  campaignValidator,
  officerRoleValidator,
  phaseValidator,
  restoreCharacterModeValidator,
  strikeTeamModeValidator,
  trackedPersonKindValidator,
} from './schema';
import { hasAccessToOrg } from './user';
import type { MutationCtx, QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import {
  consumeQueuedEffectsForWeek,
  deriveFutureEffectsAndPersistence,
  isActivityActionBlocked,
  type QueueEffect,
} from './weekResolution';
import {
  buildTeamOperationWarnings,
  getMaxTeamsForRank,
  lowerReputationWithFloorUnfriendly,
  validateStagedActionsLegality,
} from './weekBoardRules';
import { buildResolvedTeamManagers } from '../src/lib/team-manager-rules';
import {
  getMarketplaceDefaultLabel,
  getMarketplaceProfile,
} from '../src/lib/militia-marketplace-rules';
import {
  getMaxActionsForMilitia as getSharedMaxActionsForMilitia,
  getMaxActionsForRank,
  getMilitiaNotoriety,
  getMinimumTrainingForRank,
} from '../src/lib/militia-progression-rules';
import {
  activityActionIdValidator,
  tableAdjustmentValidator,
  teamIdValidator,
  type TableAdjustment,
  type WeeklyResolutionChange,
} from '../src/lib/weekly-resolution-contract';
import {
  type EventType,
  type TeamId,
  type TeamStatus,
} from '../src/lib/militia-domain';
import {
  resolveEffectiveActivityCheckTotal,
  resolveWeeklyDraft,
} from '../src/lib/weekly-resolution';
import { isTeamId } from '../src/lib/team-ids';

function getMaxActionsForMilitia({
  rank,
  strategist,
}: {
  rank: number;
  strategist?: Id<'character'>;
}) {
  return getSharedMaxActionsForMilitia({
    rank,
    strategistAssigned: Boolean(strategist),
  });
}

function normalizeMilitiaNotorietyValue(notoriety?: number) {
  return getMilitiaNotoriety(notoriety);
}

const RESOLUTION_PREVIEW_TEAM_LIMIT = 64;
const RESOLUTION_PREVIEW_EVENT_LIMIT = 100;

async function applyResolvedTeamOperationPlan({
  ctx,
  militiaId,
  plan,
  teamById,
  teamStateById,
}: {
  ctx: MutationCtx;
  militiaId: Id<'militia'>;
  plan: WeeklyResolutionChange[];
  teamById: Map<TeamId, Doc<'militiaTeam'>>;
  teamStateById: Map<TeamId, Doc<'militiaTeamState'>>;
}) {
  for (const change of plan) {
    if (change.kind === 'recover_team') {
      const state = teamStateById.get(change.teamId);
      if (!state) {
        throw new ConvexError(
          `Resolved team recovery references missing state: ${change.teamId}`,
        );
      }
      await ctx.db.patch('militiaTeamState', state._id, {
        status: 'active',
        unavailableUntilWeek: undefined,
        notes: state.notes,
      });
      teamStateById.set(change.teamId, {
        ...state,
        status: 'active',
        unavailableUntilWeek: undefined,
      });
      continue;
    }

    if (change.kind === 'remove_team') {
      const team = teamById.get(change.teamId);
      if (team) {
        await ctx.db.delete('militiaTeam', team._id);
        teamById.delete(change.teamId);
      }
      const state = teamStateById.get(change.teamId);
      if (state) {
        await ctx.db.delete('militiaTeamState', state._id);
        teamStateById.delete(change.teamId);
      }
      continue;
    }

    if (change.kind === 'recruit_team') {
      if (change.addToRoster && !teamById.has(change.teamId)) {
        const teamId = await ctx.db.insert('militiaTeam', {
          militiaId,
          teamId: change.teamId,
        });
        const team = await ctx.db.get('militiaTeam', teamId);
        if (!team) {
          throw new ConvexError('Failed to persist resolved team recruitment.');
        }
        teamById.set(change.teamId, team);
      }
      if (change.initializeState && !teamStateById.has(change.teamId)) {
        const stateId = await ctx.db.insert('militiaTeamState', {
          militiaId,
          teamId: change.teamId,
          status: 'active',
        });
        const state = await ctx.db.get('militiaTeamState', stateId);
        if (!state) {
          throw new ConvexError('Failed to persist recruited team state.');
        }
        teamStateById.set(change.teamId, state);
      }
      continue;
    }

    if (change.kind === 'upgrade_team') {
      const team = teamById.get(change.fromTeamId);
      if (!team) {
        throw new ConvexError(
          `Resolved team upgrade references missing team: ${change.fromTeamId}`,
        );
      }
      await ctx.db.patch('militiaTeam', team._id, {
        teamId: change.toTeamId,
      });
      teamById.delete(change.fromTeamId);
      teamById.set(change.toTeamId, { ...team, teamId: change.toTeamId });
      const state = teamStateById.get(change.fromTeamId);
      if (state) {
        await ctx.db.patch('militiaTeamState', state._id, {
          teamId: change.toTeamId,
        });
        teamStateById.delete(change.fromTeamId);
        teamStateById.set(change.toTeamId, {
          ...state,
          teamId: change.toTeamId,
        });
      }
    }
  }
}

async function applyTableAdjustmentPlan({
  ctx,
  militiaId,
  weekNumber,
  finalPlan,
}: {
  ctx: MutationCtx;
  militiaId: Id<'militia'>;
  weekNumber: number;
  finalPlan: WeeklyResolutionChange[];
}) {
  for (const change of finalPlan) {
    if (change.kind === 'set_settlement_reputation') {
      const settlement = await ctx.db
        .query('militiaSettlementState')
        .withIndex('by_militiaId_settlement', (q) =>
          q
            .eq('militiaId', militiaId)
            .eq('settlementKey', change.settlementKey),
        )
        .unique();
      if (settlement) {
        await ctx.db.patch('militiaSettlementState', settlement._id, {
          reputation: change.reputation,
        });
      } else {
        await ctx.db.insert('militiaSettlementState', {
          militiaId,
          settlementKey: change.settlementKey,
          reputation: change.reputation,
          isSecured: false,
        });
      }
      continue;
    }

    if (change.kind === 'set_team_status') {
      const teamState = await ctx.db
        .query('militiaTeamState')
        .withIndex('by_militiaId_teamId', (q) =>
          q.eq('militiaId', militiaId).eq('teamId', change.teamId as never),
        )
        .unique();
      if (teamState) {
        await ctx.db.patch('militiaTeamState', teamState._id, {
          status: change.status,
          unavailableUntilWeek: undefined,
        });
      } else {
        await ctx.db.insert('militiaTeamState', {
          militiaId,
          teamId: change.teamId as never,
          status: change.status,
        });
      }
      continue;
    }

    if (change.kind === 'add_event') {
      await ctx.db.insert('militiaEventState', {
        militiaId,
        weekNumber,
        eventType: change.eventType,
        isPersistent: change.isPersistent,
        startedWeek: weekNumber,
        resolved: !change.isPersistent,
      });
      continue;
    }

    if (change.kind === 'resolve_event') {
      const eventStates = await ctx.db
        .query('militiaEventState')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', militiaId))
        .take(100);
      for (const eventState of eventStates) {
        if (eventState.eventType !== change.eventType || eventState.resolved) {
          continue;
        }
        await ctx.db.patch('militiaEventState', eventState._id, {
          resolved: true,
          endedWeek: weekNumber,
        });
      }
    }
  }
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
  const characters = await getCampaignCharacters(ctx, campaignId);
  return getHighestActivePcLevelFromCharacters(characters);
}

function getHighestActivePcLevelFromCharacters(
  characters: Doc<'character'>[],
) {
  const activePcs = characters.filter(
    (character) =>
      character.isActive !== false &&
      ((character.kind ?? 'pc') === 'pc'),
  );

  const levels = activePcs.map((character) => character.level);
  return levels.length ? Math.max(...levels) : 0;
}

async function getCampaignCharacters(
  ctx: QueryCtx | MutationCtx,
  campaignId: Id<'campaign'>,
) {
  return (await ctx.db.query('character').collect()).filter(
    (character) => character.campaignId === campaignId,
  );
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

async function getMilitiaForWeekBoardQuery(
  ctx: QueryCtx,
  {
    campaignId,
    organizationId,
  }: {
    campaignId?: Id<'campaign'>;
    organizationId?: string;
  },
) {
  if (!campaignId || !organizationId) {
    return null;
  }

  const access = await hasAccessToOrg(ctx, organizationId);
  if (!access) {
    return null;
  }

  const campaign = await ctx.db.get('campaign', campaignId);
  if (campaign?.organizationId !== organizationId) {
    return null;
  }

  return await ctx.db
    .query('militia')
    .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
    .first();
}

async function getCurrentWeekStateForMilitia(
  ctx: QueryCtx,
  militiaId: Id<'militia'>,
) {
  const states = await ctx.db
    .query('militiaWeekState')
    .withIndex('by_militiaId', (q) => q.eq('militiaId', militiaId))
    .collect();

  return states.sort((left, right) => right.weekNumber - left.weekNumber)[0];
}

function buildWeekStateResponse({
  currentState,
  currentMaxActions,
}: {
  currentState: Doc<'militiaWeekState'> | undefined;
  currentMaxActions: number;
}) {
  const currentStateAny = currentState as
    | (Doc<'militiaWeekState'> & {
        rollbackHistory?: WeekRollbackSnapshot[];
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
          reduceDangerTargets?: Array<{
            slotIndex: number;
            settlementKey: string;
          }>;
          spreadPropagandaTargets?: Array<{
            slotIndex: number;
            settlementKey: string;
          }>;
          strikeTeams?: Array<{
            slotIndex: number;
            mode?: 'combat_support' | 'extraction';
            location?: string;
            notes?: string;
          }>;
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

  if (!currentStateAny) {
    return {
      weekNumber: 1,
      phase: 'activity' as const,
      isFirstWeek: true,
      skippedUpkeepThisWeek: true,
      uneventfulBonusCarry: 0,
      queuedEffects: [],
      lastPersistentBuyoffWeek: 0,
      stagedActivityActionIds: Array.from({ length: currentMaxActions }, () => null),
      stagedActivityTeamIds: Array.from({ length: currentMaxActions }, () => null),
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
        reduceDangerTargets: [],
        spreadPropagandaTargets: [],
        strikeTeams: [],
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
    };
  }

  const { rollbackHistory: _ignoredRollbackHistory, ...currentStateForClient } =
    currentStateAny;

  return {
    ...currentStateForClient,
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
      reduceDangerTargets:
        currentStateAny.activityAssetOperations?.reduceDangerTargets ?? [],
      spreadPropagandaTargets:
        currentStateAny.activityAssetOperations?.spreadPropagandaTargets ?? [],
      strikeTeams: currentStateAny.activityAssetOperations?.strikeTeams ?? [],
      caches: currentStateAny.activityAssetOperations?.caches ?? [],
      orders: currentStateAny.activityAssetOperations?.orders ?? [],
      marketplaces: currentStateAny.activityAssetOperations?.marketplaces ?? [],
      covertActions: currentStateAny.activityAssetOperations?.covertActions ?? [],
      rescues: currentStateAny.activityAssetOperations?.rescues ?? [],
      restorations: currentStateAny.activityAssetOperations?.restorations ?? [],
    },
    upkeepTeamOperations: currentStateAny.upkeepTeamOperations ?? {
      disabledRecoveries: [],
      missingChecks: [],
    },
    eventMitigations: currentStateAny.eventMitigations ?? {},
    weekWarnings: currentStateAny.weekWarnings ?? [],
  };
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

function normalizeTeamStatus(raw: unknown): TeamStatus {
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

type RollbackSnapshotRow = {
  id: string;
  [key: string]: unknown;
};

type WeekRollbackSnapshot = {
  weekState: Record<string, unknown>;
  militia: Record<string, unknown>;
  teams: RollbackSnapshotRow[];
  teamStates: RollbackSnapshotRow[];
  settlements: RollbackSnapshotRow[];
  caches: RollbackSnapshotRow[];
  marketplaces: RollbackSnapshotRow[];
  orders: RollbackSnapshotRow[];
  trackedPeople: RollbackSnapshotRow[];
  events: RollbackSnapshotRow[];
};

function stripSystemFields<T extends { _id?: string; _creationTime?: number }>(
  row: T,
) {
  const { _id: _ignoredId, _creationTime: _ignoredCreationTime, ...rest } = row;
  return rest;
}

function snapshotRow<T extends { _id: string; _creationTime?: number }>(row: T) {
  return {
    id: row._id,
    ...stripSystemFields(row),
  } as RollbackSnapshotRow;
}

function buildRollbackSnapshot({
  currentWeekState,
  militia,
  teamRows,
  teamStateRows,
  settlementRows,
  cacheRows,
  marketplaceRows,
  orderRows,
  trackedPeopleRows,
  eventRows,
}: {
  currentWeekState: Doc<'militiaWeekState'> & {
    rollbackHistory?: WeekRollbackSnapshot[];
  };
  militia: Doc<'militia'>;
  teamRows: Doc<'militiaTeam'>[];
  teamStateRows: Doc<'militiaTeamState'>[];
  settlementRows: Doc<'militiaSettlementState'>[];
  cacheRows: Doc<'militiaCache'>[];
  marketplaceRows: Doc<'militiaMarketplace'>[];
  orderRows: Doc<'militiaOrder'>[];
  trackedPeopleRows: Doc<'militiaCharacterStatus'>[];
  eventRows: Doc<'militiaEventState'>[];
}) {
  const {
    rollbackHistory: _ignoredRollbackHistory,
    ...weekState
  } = stripSystemFields(currentWeekState);

  return {
    weekState,
    militia: stripSystemFields(militia),
    teams: teamRows.map(snapshotRow),
    teamStates: teamStateRows.map(snapshotRow),
    settlements: settlementRows.map(snapshotRow),
    caches: cacheRows.map(snapshotRow),
    marketplaces: marketplaceRows.map(snapshotRow),
    orders: orderRows.map(snapshotRow),
    trackedPeople: trackedPeopleRows.map(snapshotRow),
    events: eventRows.map(snapshotRow),
  } satisfies WeekRollbackSnapshot;
}

async function syncMilitiaRowsFromSnapshot({
  ctx,
  table,
  currentRows,
  snapshotRows,
  getCurrentKey,
  getSnapshotKey,
  mapSnapshotToDoc,
}: {
  ctx: MutationCtx;
  table:
    | 'militiaTeam'
    | 'militiaTeamState'
    | 'militiaSettlementState'
    | 'militiaCache'
    | 'militiaMarketplace'
    | 'militiaOrder'
    | 'militiaCharacterStatus'
    | 'militiaEventState';
  currentRows: Array<{ _id: string } & Record<string, unknown>>;
  snapshotRows: RollbackSnapshotRow[];
  getCurrentKey: (row: { _id: string } & Record<string, unknown>) => string;
  getSnapshotKey: (row: RollbackSnapshotRow) => string;
  mapSnapshotToDoc?: (row: RollbackSnapshotRow) => Record<string, unknown>;
}) {
  const currentByKey = new Map(currentRows.map((row) => [getCurrentKey(row), row]));
  const snapshotKeys = new Set<string>();
  const restoredIds = new Map<string, string>();

  for (const snapshotRow of snapshotRows) {
    const key = getSnapshotKey(snapshotRow);
    snapshotKeys.add(key);
    const existing = currentByKey.get(key);
    const { id: _ignoredId, ...rawDoc } = snapshotRow;
    const doc = mapSnapshotToDoc ? mapSnapshotToDoc(snapshotRow) : rawDoc;

    if (existing) {
      await ctx.db.patch(table, existing._id as never, doc as never);
      restoredIds.set(snapshotRow.id, existing._id);
      continue;
    }

    const insertedId = await ctx.db.insert(table, doc as never);
    restoredIds.set(snapshotRow.id, insertedId);
  }

  for (const currentRow of currentRows) {
    const key = getCurrentKey(currentRow);
    if (!snapshotKeys.has(key)) {
      await ctx.db.delete(table, currentRow._id as never);
    }
  }

  return restoredIds;
}

function snapshotRowToDoc(
  row: RollbackSnapshotRow,
  optionalKeys: string[] = [],
): Record<string, unknown> {
  const { id: _ignoredId, ...doc } = row;
  const nextDoc: Record<string, unknown> = { ...doc };
  for (const key of optionalKeys) {
    if (!(key in nextDoc)) {
      nextDoc[key] = undefined;
    }
  }
  return nextDoc;
}

function remapWeekStateSnapshotIds({
  weekState,
  cacheIds,
  marketplaceIds,
  trackedPersonIds,
}: {
  weekState: Record<string, unknown>;
  cacheIds: Map<string, string>;
  marketplaceIds: Map<string, string>;
  trackedPersonIds: Map<string, string>;
}): Record<string, unknown> {
  const currentAny = weekState as {
    activityAssetOperations?: {
      caches?: Array<Record<string, unknown> & { cacheId?: string }>;
      rescues?: Array<Record<string, unknown> & { targetStatusId?: string }>;
      restorations?: Array<Record<string, unknown> & { targetStatusId?: string }>;
    };
    eventMitigations?: Record<string, unknown> & { marketDayMarketplaceId?: string };
  };

  const remappedWeekState: Record<string, unknown> = { ...weekState };

  if (currentAny.activityAssetOperations) {
    remappedWeekState.activityAssetOperations = {
      ...currentAny.activityAssetOperations,
      caches: (currentAny.activityAssetOperations.caches ?? []).map((cache) => ({
        ...cache,
        cacheId: cache.cacheId
          ? (cacheIds.get(cache.cacheId) ?? cache.cacheId)
          : undefined,
      })),
      rescues: (currentAny.activityAssetOperations.rescues ?? []).map((rescue) => ({
        ...rescue,
        targetStatusId: rescue.targetStatusId
          ? (trackedPersonIds.get(rescue.targetStatusId) ?? rescue.targetStatusId)
          : undefined,
      })),
      restorations: (currentAny.activityAssetOperations.restorations ?? []).map(
        (restoration) => ({
          ...restoration,
          targetStatusId: restoration.targetStatusId
            ? (trackedPersonIds.get(restoration.targetStatusId) ??
                restoration.targetStatusId)
            : undefined,
        }),
      ),
    };
  }

  if (currentAny.eventMitigations) {
    remappedWeekState.eventMitigations = {
      ...currentAny.eventMitigations,
      marketDayMarketplaceId: currentAny.eventMitigations.marketDayMarketplaceId
        ? (marketplaceIds.get(currentAny.eventMitigations.marketDayMarketplaceId) ??
            currentAny.eventMitigations.marketDayMarketplaceId)
        : undefined,
    };
  }

  return remappedWeekState;
}

const REPUTATION_STEPS = [
  'Hostile',
  'Unfriendly',
  'Indifferent',
  'Friendly',
  'Helpful',
] as const;

function raiseReputationOneStep(
  reputation: (typeof REPUTATION_STEPS)[number],
) {
  const index = REPUTATION_STEPS.indexOf(reputation);
  return (
    REPUTATION_STEPS[Math.min(REPUTATION_STEPS.length - 1, index + 1)] ??
    reputation
  );
}

function resolveCurrentWeekDraft({
  current,
  militia,
  teamRows,
  teamStateRows,
  activeQueuedEffects,
  activePersistentEventTypes,
}: {
  current: Doc<'militiaWeekState'>;
  militia: Doc<'militia'>;
  teamRows: Doc<'militiaTeam'>[];
  teamStateRows: Doc<'militiaTeamState'>[];
  activeQueuedEffects: QueueEffect[];
  activePersistentEventTypes: EventType[];
}) {
  return resolveWeeklyDraft({
    draft: {
      revision: current.lockVersion,
      weekNumber: current.weekNumber,
      uneventfulBonusCarry: current.uneventfulBonusCarry ?? 0,
      stagedActivityActionIds: current.stagedActivityActionIds,
      stagedActivityTeamIds: current.stagedActivityTeamIds,
      upkeepRollTotals: current.upkeepRollTotals,
      activityRollTotals: current.activityRollTotals,
      activityTeamOperations: current.activityTeamOperations,
      activityAssetOperations: current.activityAssetOperations,
      upkeepTeamOperations: current.upkeepTeamOperations,
      eventMitigations: current.eventMitigations,
      eventRollTotals: current.eventRollTotals,
      tableAdjustments: current.tableAdjustments,
    },
    snapshot: {
      militia: {
        rank: militia.rank,
        training: militia.training,
        treasury: militia.treasury,
        notoriety: normalizeMilitiaNotorietyValue(militia.notoriety),
      },
      activeQueuedEffects,
      activePersistentEventTypes,
      rosterTeamIds: teamRows.map((team) => team.teamId),
      teamStatuses: teamStateRows.map((team) => ({
        teamId: team.teamId,
        status: team.status,
      })),
    },
  });
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
          rollbackHistory?: WeekRollbackSnapshot[];
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
            reduceDangerTargets?: Array<{
              slotIndex: number;
              settlementKey: string;
            }>;
            spreadPropagandaTargets?: Array<{
              slotIndex: number;
              settlementKey: string;
            }>;
            strikeTeams?: Array<{
              slotIndex: number;
              mode?: 'combat_support' | 'extraction';
              location?: string;
              notes?: string;
            }>;
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
      notoriety: normalizeMilitiaNotorietyValue(militia.notoriety),
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
            ...(() => {
              const { rollbackHistory: _ignoredRollbackHistory, ...currentStateForClient } =
                currentStateAny;
              return currentStateForClient;
            })(),
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
              reduceDangerTargets:
                currentStateAny.activityAssetOperations?.reduceDangerTargets ?? [],
              spreadPropagandaTargets:
                currentStateAny.activityAssetOperations?.spreadPropagandaTargets ?? [],
              strikeTeams:
                currentStateAny.activityAssetOperations?.strikeTeams ?? [],
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
              reduceDangerTargets: [],
              spreadPropagandaTargets: [],
              strikeTeams: [],
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

export const getWeekBoardReferenceData = query({
  args: {
    campaignId: v.optional(v.id('campaign')),
    organizationId: v.optional(campaignValidator.fields.organizationId),
  },
  async handler(ctx, args) {
    const militia = await getMilitiaForWeekBoardQuery(ctx, args);
    if (!militia) {
      return null;
    }

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
    const characters = await getCampaignCharacters(ctx, militia.campaignId);
    const highestPcLevel = getHighestActivePcLevelFromCharacters(characters);
    const rankUp = getRankUpEligibility({
      rank: militia.rank,
      training: militia.training,
      highestPcLevel,
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
      notoriety: normalizeMilitiaNotorietyValue(militia.notoriety),
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
        .sort((left, right) => left.teamId.localeCompare(right.teamId)),
      settlementKeys: settlementStates
        .map((settlement) => settlement.settlementKey)
        .sort((left, right) => left.localeCompare(right)),
      highestPcLevel,
      canRankUp: rankUp.canRankUp,
      rankUpBlockedReason: rankUp.reason,
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
    };
  },
});

export const getWeekBoardTrackedState = query({
  args: {
    campaignId: v.optional(v.id('campaign')),
    organizationId: v.optional(campaignValidator.fields.organizationId),
  },
  async handler(ctx, args) {
    const militia = await getMilitiaForWeekBoardQuery(ctx, args);
    if (!militia) {
      return null;
    }

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
    const unresolvedPersistent = (
      await ctx.db
        .query('militiaEventState')
        .withIndex('by_militiaId_persistent', (q) =>
          q.eq('militiaId', militia._id).eq('isPersistent', true),
        )
        .collect()
    )
      .filter((event) => !event.resolved)
      .sort((left, right) => left.startedWeek - right.startedWeek);

    return {
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
        .sort((left, right) => left.settlementKey.localeCompare(right.settlementKey)),
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
        .sort((left, right) => left.label.localeCompare(right.label)),
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
        .sort((left, right) => left.createdWeek - right.createdWeek || left.label.localeCompare(right.label)),
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
        .sort((left, right) => left.orderedWeek - right.orderedWeek),
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
        .sort((left, right) => left.displayName.localeCompare(right.displayName)),
      activePersistentEvents: unresolvedPersistent.map((event) => ({
        _id: event._id,
        eventType: event.eventType,
        startedWeek: event.startedWeek,
      })),
    };
  },
});

export const getWeekBoardLiveState = query({
  args: {
    campaignId: v.optional(v.id('campaign')),
    organizationId: v.optional(campaignValidator.fields.organizationId),
  },
  async handler(ctx, args) {
    const militia = await getMilitiaForWeekBoardQuery(ctx, args);
    if (!militia) {
      return null;
    }

    const currentState = await getCurrentWeekStateForMilitia(ctx, militia._id);
    const currentStateAny = currentState as
      | (Doc<'militiaWeekState'> & {
          activityOfficerOperations?: {
            changes?: Array<{
              slotIndex: number;
              role: string;
              characterId?: Id<'character'>;
            }>;
          };
        })
      | undefined;
    const currentMaxActions = getCurrentWeekMaxActions({
      rank: militia.rank,
      strategist: militia.strategist,
      stagedActivityActionIds: currentState?.stagedActivityActionIds,
      activityOfficerOperations: currentStateAny?.activityOfficerOperations,
    });
    const currentWeekNumber = currentState?.weekNumber ?? 1;
    const lastPersistentBuyoffWeek = currentState?.lastPersistentBuyoffWeek ?? 0;
    const buyoffWeeksRemaining = Math.max(
      0,
      4 - (currentWeekNumber - lastPersistentBuyoffWeek),
    );
    let resolutionPreview = null;
    const resolutionPreviewWarnings: string[] = [];
    if (currentState) {
      const [teamRows, teamStateRows, eventRows] = await Promise.all([
        ctx.db
          .query('militiaTeam')
          .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
          .take(RESOLUTION_PREVIEW_TEAM_LIMIT + 1),
        ctx.db
          .query('militiaTeamState')
          .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
          .take(RESOLUTION_PREVIEW_TEAM_LIMIT + 1),
        ctx.db
          .query('militiaEventState')
          .withIndex('by_militiaId_persistent_resolved', (q) =>
            q
              .eq('militiaId', militia._id)
              .eq('isPersistent', true)
              .eq('resolved', false),
          )
          .take(RESOLUTION_PREVIEW_EVENT_LIMIT + 1),
      ]);
      if (teamRows.length > RESOLUTION_PREVIEW_TEAM_LIMIT) {
        resolutionPreviewWarnings.push(
          'Resolution preview is unavailable because more than 64 teams are tracked.',
        );
      }
      if (teamStateRows.length > RESOLUTION_PREVIEW_TEAM_LIMIT) {
        resolutionPreviewWarnings.push(
          'Resolution preview is unavailable because more than 64 team states are tracked.',
        );
      }
      if (eventRows.length > RESOLUTION_PREVIEW_EVENT_LIMIT) {
        resolutionPreviewWarnings.push(
          'Resolution preview is unavailable because more than 100 persistent events are active.',
        );
      }
      const { active: activeQueuedEffects } = consumeQueuedEffectsForWeek({
        queuedEffects: currentState.queuedEffects,
        weekNumber: currentState.weekNumber,
      });
      if (resolutionPreviewWarnings.length === 0) {
        resolutionPreview = resolveCurrentWeekDraft({
          current: currentState,
          militia,
          teamRows,
          teamStateRows,
          activeQueuedEffects,
          activePersistentEventTypes: eventRows.map(
            (event) => event.eventType,
          ),
        });
      }
    }

    return {
      militiaId: militia._id,
      maxActions: currentMaxActions,
      resolutionPreview,
      resolutionPreviewWarnings,
      persistentBuyoff: {
        cost: 2 * militia.rank * 10,
        weeksRemaining: buyoffWeeksRemaining,
        canBuyoffNow: buyoffWeeksRemaining === 0,
      },
      state: buildWeekStateResponse({
        currentState,
        currentMaxActions,
      }),
    };
  },
});

export const listResolutionRecords = query({
  args: {
    campaignId: v.optional(v.id('campaign')),
    organizationId: v.optional(campaignValidator.fields.organizationId),
  },
  async handler(ctx, args) {
    const militia = await getMilitiaForWeekBoardQuery(ctx, args);
    if (!militia) return [];

    return await ctx.db
      .query('militiaResolutionRecord')
      .withIndex('by_militiaId_and_weekNumber', (q) =>
        q.eq('militiaId', militia._id),
      )
      .order('desc')
      .take(200);
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
          reduceDangerTargets: v.optional(
            v.array(
              v.object({
                slotIndex: v.number(),
                settlementKey: v.string(),
              }),
            ),
          ),
          spreadPropagandaTargets: v.optional(
            v.array(
              v.object({
                slotIndex: v.number(),
                settlementKey: v.string(),
              }),
            ),
          ),
          strikeTeams: v.optional(
            v.array(
              v.object({
                slotIndex: v.number(),
                mode: v.optional(strikeTeamModeValidator),
                location: v.optional(v.string()),
                notes: v.optional(v.string()),
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
          turncoatTrainingLossTotal: v.optional(v.string()),
          turncoatOfficerCheckTotal: v.optional(v.string()),
          turncoatSelectedTeamId: v.optional(v.union(teamIdValidator, v.null())),
          rivalrySelectedTeamIds: v.optional(v.array(teamIdValidator)),
          missingInActionSelectedTeamId: v.optional(v.union(teamIdValidator, v.null())),
          sicknessSelectedTeamId: v.optional(v.union(teamIdValidator, v.null())),
          turnAroundBoostTeamId: v.optional(v.union(teamIdValidator, v.null())),
          marketDayMarketplaceId: v.optional(v.union(v.string(), v.null())),
          marketDayTownName: v.optional(v.union(v.string(), v.null())),
          overseerEventSupportTarget: v.optional(
            v.union(
              v.literal('sabotage'),
              v.literal('cache_discovered'),
              v.literal('theft'),
              v.literal('sickness_twice'),
              v.null(),
            ),
          ),
        }),
      ),
      tableAdjustments: v.optional(v.array(tableAdjustmentValidator)),
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
          guaranteeEventNotorietyIncreaseTotal: v.optional(v.string()),
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
            v.union(v.literal('first'), v.literal('second'), v.null()),
          ),
          sabotageCheckTotal: v.optional(v.string()),
          sabotageNotorietyIncreaseTotal: v.optional(v.string()),
        }),
      ),
    }),
  },
  async handler(ctx, args) {
    const militia = await assertMilitiaAccess(ctx, args.militiaId, args.organizationId);
    if (
      args.patch.tableAdjustments?.some(
        (adjustment) => adjustment.reason.trim().length === 0,
      )
    ) {
      throw new ConvexError('Every Table Adjustment requires a reason.');
    }

    const existing = await ctx.db
      .query('militiaWeekState')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
      .collect();
    const current = existing.sort((a, b) => b.weekNumber - a.weekNumber)[0];
    const currentAny = current as
      | (typeof current & {
          activityTeamOperations?: {
            recruits?: Array<{ slotIndex: number; teamId: string }>;
            dismissals?: Array<{ slotIndex: number; teamId: string }>;
            upgrades?: Array<{
              slotIndex: number;
              fromTeamId: string;
              toTeamId: string;
            }>;
          };
          activityOfficerOperations?: {
            changes?: Array<{
              slotIndex: number;
              role: string;
              characterId?: Id<'character'>;
            }>;
          };
          activityAssetOperations?: {
            refuges?: Array<{ slotIndex: number; settlementKey: string }>;
            reduceDangerTargets?: Array<{
              slotIndex: number;
              settlementKey: string;
            }>;
            spreadPropagandaTargets?: Array<{
              slotIndex: number;
              settlementKey: string;
            }>;
            strikeTeams?: Array<{
              slotIndex: number;
              mode?: 'combat_support' | 'extraction';
              location?: string;
              notes?: string;
            }>;
            caches?: Array<{
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
            orders?: Array<{
              slotIndex: number;
              description: string;
              notes?: string;
              costPaid?: number;
              deliveryDays?: number;
            }>;
            marketplaces?: Array<{
              slotIndex: number;
              label?: string;
              purchaseSummary?: string;
              notes?: string;
            }>;
            covertActions?: Array<{
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
            rescues?: Array<{
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
            restorations?: Array<{
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
            disabledRecoveries?: Array<{ teamId: string; paid: boolean }>;
            missingChecks?: Array<{
              teamId: string;
              securityCheckTotal?: number;
              permanentlyLost?: boolean;
            }>;
          };
          eventMitigations?: Record<string, unknown>;
          upkeepRollTotals?: Record<string, unknown>;
          activityRollTotals?: Record<string, unknown>;
          eventRollTotals?: Record<string, unknown>;
          tableAdjustments?: TableAdjustment[];
          weekWarnings?: Array<{ code: string; message: string }>;
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
      upkeepTreasurySnapshot?: number;
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
        reduceDangerTargets: Array<{
          slotIndex: number;
          settlementKey: string;
        }>;
        spreadPropagandaTargets: Array<{
          slotIndex: number;
          settlementKey: string;
        }>;
        strikeTeams: Array<{
          slotIndex: number;
          mode?: 'combat_support' | 'extraction';
          location?: string;
          notes?: string;
        }>;
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
        turncoatTrainingLossTotal?: number;
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
      tableAdjustments?: TableAdjustment[];
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
        guaranteeEventNotorietyIncreaseTotal?: number;
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
    const currentActivityTeamOperations = {
      recruits: currentAny?.activityTeamOperations?.recruits ?? [],
      dismissals: currentAny?.activityTeamOperations?.dismissals ?? [],
      upgrades: currentAny?.activityTeamOperations?.upgrades ?? [],
    };
    const currentActivityOfficerOperations = {
      changes: currentAny?.activityOfficerOperations?.changes ?? [],
    };
    const currentActivityAssetOperations = {
      refuges: currentAny?.activityAssetOperations?.refuges ?? [],
      reduceDangerTargets:
        currentAny?.activityAssetOperations?.reduceDangerTargets ?? [],
      spreadPropagandaTargets:
        currentAny?.activityAssetOperations?.spreadPropagandaTargets ?? [],
      strikeTeams: currentAny?.activityAssetOperations?.strikeTeams ?? [],
      caches: currentAny?.activityAssetOperations?.caches ?? [],
      orders: currentAny?.activityAssetOperations?.orders ?? [],
      marketplaces: currentAny?.activityAssetOperations?.marketplaces ?? [],
      covertActions: currentAny?.activityAssetOperations?.covertActions ?? [],
      rescues: currentAny?.activityAssetOperations?.rescues ?? [],
      restorations: currentAny?.activityAssetOperations?.restorations ?? [],
    };
    const currentUpkeepTeamOperations = {
      disabledRecoveries: currentAny?.upkeepTeamOperations?.disabledRecoveries ?? [],
      missingChecks: currentAny?.upkeepTeamOperations?.missingChecks ?? [],
    };
    const currentEventMitigations =
      (currentAny?.eventMitigations as Record<string, unknown> | undefined) ?? {};
    const currentUpkeepRollTotals =
      (currentAny?.upkeepRollTotals as Record<string, unknown> | undefined) ?? {};
    const currentActivityRollTotals =
      (currentAny?.activityRollTotals as Record<string, unknown> | undefined) ?? {};
    const currentEventRollTotals =
      (currentAny?.eventRollTotals as Record<string, unknown> | undefined) ?? {};

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
      const recruits =
        args.patch.activityTeamOperations.recruits ??
        currentActivityTeamOperations.recruits;
      const dismissals =
        args.patch.activityTeamOperations.dismissals ??
        currentActivityTeamOperations.dismissals;
      const upgrades =
        args.patch.activityTeamOperations.upgrades ??
        currentActivityTeamOperations.upgrades;
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
        changes: (
          args.patch.activityOfficerOperations.changes ??
          currentActivityOfficerOperations.changes
        ).map(
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
        refuges:
          args.patch.activityAssetOperations.refuges !== undefined
            ? args.patch.activityAssetOperations.refuges.map((entry) => ({
                slotIndex: entry.slotIndex,
                settlementKey: entry.settlementKey.trim(),
              }))
            : currentActivityAssetOperations.refuges,
        reduceDangerTargets:
          args.patch.activityAssetOperations.reduceDangerTargets !== undefined
            ? args.patch.activityAssetOperations.reduceDangerTargets.map((entry) => ({
                slotIndex: entry.slotIndex,
                settlementKey: entry.settlementKey.trim(),
              }))
            : currentActivityAssetOperations.reduceDangerTargets,
        spreadPropagandaTargets:
          args.patch.activityAssetOperations.spreadPropagandaTargets !== undefined
            ? args.patch.activityAssetOperations.spreadPropagandaTargets.map((entry) => ({
                slotIndex: entry.slotIndex,
                settlementKey: entry.settlementKey.trim(),
              }))
            : currentActivityAssetOperations.spreadPropagandaTargets,
        strikeTeams:
          args.patch.activityAssetOperations.strikeTeams !== undefined
            ? args.patch.activityAssetOperations.strikeTeams.map((entry) => ({
                slotIndex: entry.slotIndex,
                mode: entry.mode,
                location: trimToUndefined(entry.location),
                notes: trimToUndefined(entry.notes),
              }))
            : currentActivityAssetOperations.strikeTeams,
        caches:
          args.patch.activityAssetOperations.caches !== undefined
            ? args.patch.activityAssetOperations.caches.map((entry) => ({
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
              }))
            : currentActivityAssetOperations.caches,
        orders:
          args.patch.activityAssetOperations.orders !== undefined
            ? args.patch.activityAssetOperations.orders.map((entry) => ({
                slotIndex: entry.slotIndex,
                description: entry.description.trim(),
                notes: trimToUndefined(entry.notes),
                costPaid: parseOptionalNonNegativeTotal(entry.costPaid),
                deliveryDays: parseOptionalNonNegativeTotal(entry.deliveryDays),
              }))
            : currentActivityAssetOperations.orders,
        marketplaces:
          args.patch.activityAssetOperations.marketplaces !== undefined
            ? args.patch.activityAssetOperations.marketplaces.map((entry) => ({
                slotIndex: entry.slotIndex,
                label: trimToUndefined(entry.label),
                purchaseSummary: trimToUndefined(entry.purchaseSummary),
                notes: trimToUndefined(entry.notes),
              }))
            : currentActivityAssetOperations.marketplaces,
        covertActions:
          args.patch.activityAssetOperations.covertActions !== undefined
            ? args.patch.activityAssetOperations.covertActions.map((entry) => ({
                slotIndex: entry.slotIndex,
                mode: entry.mode,
                targetSource: entry.targetSource,
                followupSlotIndex: entry.followupSlotIndex,
                characterId: entry.characterId,
                displayName: trimToUndefined(entry.displayName),
                personKind: entry.personKind,
                siteName: trimToUndefined(entry.siteName),
                notes: trimToUndefined(entry.notes),
              }))
            : currentActivityAssetOperations.covertActions,
        rescues:
          args.patch.activityAssetOperations.rescues !== undefined
            ? args.patch.activityAssetOperations.rescues.map((entry) => ({
                slotIndex: entry.slotIndex,
                targetSource: entry.targetSource,
                targetStatusId: trimToUndefined(entry.targetStatusId),
                characterId: entry.characterId,
                displayName: trimToUndefined(entry.displayName),
                personKind: entry.personKind,
                targetLevel: parseOptionalNonNegativeTotal(entry.targetLevel),
                destinationType: entry.destinationType,
                destinationSettlementKey: trimToUndefined(
                  entry.destinationSettlementKey,
                ),
              }))
            : currentActivityAssetOperations.rescues,
        restorations:
          args.patch.activityAssetOperations.restorations !== undefined
            ? args.patch.activityAssetOperations.restorations.map((entry) => ({
                slotIndex: entry.slotIndex,
                targetSource: entry.targetSource,
                targetStatusId: trimToUndefined(entry.targetStatusId),
                characterId: entry.characterId,
                displayName: trimToUndefined(entry.displayName),
                personKind: entry.personKind,
                mode: entry.mode,
                customCostTotal: parseOptionalNonNegativeTotal(
                  entry.customCostTotal,
                ),
              }))
            : currentActivityAssetOperations.restorations,
      };
      const nextActivityAssetOperations = nextPatch.activityAssetOperations;

      const settlementStates = await ctx.db
        .query('militiaSettlementState')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
        .collect();
      const knownSettlementKeys = new Set(
        settlementStates.map((settlement) => settlement.settlementKey),
      );
      const missingSettlementWarnings = Array.from(
        new Set(
          nextActivityAssetOperations.refuges
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
        disabledRecoveries:
          args.patch.upkeepTeamOperations.disabledRecoveries ??
          currentUpkeepTeamOperations.disabledRecoveries,
        missingChecks:
          args.patch.upkeepTeamOperations.missingChecks !== undefined
            ? args.patch.upkeepTeamOperations.missingChecks.map((entry) => ({
                teamId: entry.teamId,
                securityCheckTotal: parseManualTotal(entry.securityCheckTotal),
                permanentlyLost: entry.permanentlyLost,
              }))
            : currentUpkeepTeamOperations.missingChecks,
      };
    }
    if (args.patch.eventMitigations) {
      nextPatch.eventMitigations = {
        cacheDiscoveredMitigationTotal:
          'cacheDiscoveredMitigationTotal' in args.patch.eventMitigations
            ? parseManualTotal(
                args.patch.eventMitigations.cacheDiscoveredMitigationTotal,
              )
            : (currentEventMitigations.cacheDiscoveredMitigationTotal as
                | number
                | undefined),
        theftMitigationTotal:
          'theftMitigationTotal' in args.patch.eventMitigations
            ? parseManualTotal(args.patch.eventMitigations.theftMitigationTotal)
            : (currentEventMitigations.theftMitigationTotal as number | undefined),
        sicknessTwiceLoyaltyTotal:
          'sicknessTwiceLoyaltyTotal' in args.patch.eventMitigations
            ? parseManualTotal(
                args.patch.eventMitigations.sicknessTwiceLoyaltyTotal,
              )
            : (currentEventMitigations.sicknessTwiceLoyaltyTotal as
                | number
                | undefined),
        turncoatTrainingLossTotal:
          'turncoatTrainingLossTotal' in args.patch.eventMitigations
            ? parseManualTotal(
                args.patch.eventMitigations.turncoatTrainingLossTotal,
              )
            : (currentEventMitigations.turncoatTrainingLossTotal as
                | number
                | undefined),
        turncoatOfficerCheckTotal:
          'turncoatOfficerCheckTotal' in args.patch.eventMitigations
            ? parseManualTotal(
                args.patch.eventMitigations.turncoatOfficerCheckTotal,
              )
            : (currentEventMitigations.turncoatOfficerCheckTotal as
                | number
                | undefined),
        turncoatSelectedTeamId:
          'turncoatSelectedTeamId' in args.patch.eventMitigations
            ? args.patch.eventMitigations.turncoatSelectedTeamId ?? undefined
            : (currentEventMitigations.turncoatSelectedTeamId as string | undefined),
        rivalrySelectedTeamIds:
          'rivalrySelectedTeamIds' in args.patch.eventMitigations
            ? args.patch.eventMitigations.rivalrySelectedTeamIds
            : (currentEventMitigations.rivalrySelectedTeamIds as
                | string[]
                | undefined),
        missingInActionSelectedTeamId:
          'missingInActionSelectedTeamId' in args.patch.eventMitigations
            ? args.patch.eventMitigations.missingInActionSelectedTeamId ?? undefined
            : (currentEventMitigations.missingInActionSelectedTeamId as
                | string
                | undefined),
        sicknessSelectedTeamId:
          'sicknessSelectedTeamId' in args.patch.eventMitigations
            ? args.patch.eventMitigations.sicknessSelectedTeamId ?? undefined
            : (currentEventMitigations.sicknessSelectedTeamId as
                | string
                | undefined),
        turnAroundBoostTeamId:
          'turnAroundBoostTeamId' in args.patch.eventMitigations
            ? args.patch.eventMitigations.turnAroundBoostTeamId ?? undefined
            : (currentEventMitigations.turnAroundBoostTeamId as
                | string
                | undefined),
        marketDayMarketplaceId:
          'marketDayMarketplaceId' in args.patch.eventMitigations
            ? trimToUndefined(
                args.patch.eventMitigations.marketDayMarketplaceId ?? undefined,
              )
            : (currentEventMitigations.marketDayMarketplaceId as
                | string
                | undefined),
        marketDayTownName:
          'marketDayTownName' in args.patch.eventMitigations
            ? trimToUndefined(args.patch.eventMitigations.marketDayTownName ?? undefined)
            : (currentEventMitigations.marketDayTownName as string | undefined),
        overseerEventSupportTarget:
          'overseerEventSupportTarget' in args.patch.eventMitigations
            ? args.patch.eventMitigations.overseerEventSupportTarget ?? undefined
            : (currentEventMitigations.overseerEventSupportTarget as
                | 'sabotage'
                | 'cache_discovered'
                | 'theft'
                | 'sickness_twice'
                | undefined),
      };
    }

    if (args.patch.tableAdjustments) {
      nextPatch.tableAdjustments = args.patch.tableAdjustments;
    }
    if (args.patch.upkeepRollTotals) {
      nextPatch.upkeepRollTotals = {
        attritionTotal:
          'attritionTotal' in args.patch.upkeepRollTotals
            ? parseManualTotal(args.patch.upkeepRollTotals.attritionTotal)
            : (currentUpkeepRollTotals.attritionTotal as number | undefined),
        notorietyPenaltyTotal:
          'notorietyPenaltyTotal' in args.patch.upkeepRollTotals
            ? parseManualTotal(args.patch.upkeepRollTotals.notorietyPenaltyTotal)
            : (currentUpkeepRollTotals.notorietyPenaltyTotal as
                | number
                | undefined),
        maxNotorietyLoyaltyCheckTotal:
          'maxNotorietyLoyaltyCheckTotal' in args.patch.upkeepRollTotals
            ? parseManualTotal(
                args.patch.upkeepRollTotals.maxNotorietyLoyaltyCheckTotal,
              )
            : (currentUpkeepRollTotals.maxNotorietyLoyaltyCheckTotal as
                | number
                | undefined),
        nearestSettlementKey:
          'nearestSettlementKey' in args.patch.upkeepRollTotals
            ? args.patch.upkeepRollTotals.nearestSettlementKey?.trim()
              ? args.patch.upkeepRollTotals.nearestSettlementKey.trim()
              : undefined
            : (currentUpkeepRollTotals.nearestSettlementKey as
                | string
                | undefined),
        treasuryPenaltyTotal:
          'treasuryPenaltyTotal' in args.patch.upkeepRollTotals
            ? parseManualTotal(args.patch.upkeepRollTotals.treasuryPenaltyTotal)
            : (currentUpkeepRollTotals.treasuryPenaltyTotal as
                | number
                | undefined),
      };
    }
    if (args.patch.activityRollTotals) {
      nextPatch.activityRollTotals = {
        activateBlackMarketCheckTotal:
          'activateBlackMarketCheckTotal' in args.patch.activityRollTotals
            ? parseManualTotal(
                args.patch.activityRollTotals.activateBlackMarketCheckTotal,
              )
            : (currentActivityRollTotals.activateBlackMarketCheckTotal as
                | number
                | undefined),
        activateBlackMarketNotorietyIncreaseTotal:
          'activateBlackMarketNotorietyIncreaseTotal' in args.patch.activityRollTotals
            ? parseManualTotal(
                args.patch.activityRollTotals
                  .activateBlackMarketNotorietyIncreaseTotal,
              )
            : (currentActivityRollTotals.activateBlackMarketNotorietyIncreaseTotal as
                | number
                | undefined),
        dismissTeamCheckTotal:
          'dismissTeamCheckTotal' in args.patch.activityRollTotals
            ? parseManualTotal(args.patch.activityRollTotals.dismissTeamCheckTotal)
            : (currentActivityRollTotals.dismissTeamCheckTotal as
                | number
                | undefined),
        dismissTeamNotorietyIncreaseTotal:
          'dismissTeamNotorietyIncreaseTotal' in args.patch.activityRollTotals
            ? parseManualTotal(
                args.patch.activityRollTotals.dismissTeamNotorietyIncreaseTotal,
              )
            : (currentActivityRollTotals.dismissTeamNotorietyIncreaseTotal as
                | number
                | undefined),
        drillMilitiaCheckTotal:
          'drillMilitiaCheckTotal' in args.patch.activityRollTotals
            ? parseManualTotal(args.patch.activityRollTotals.drillMilitiaCheckTotal)
            : (currentActivityRollTotals.drillMilitiaCheckTotal as
                | number
                | undefined),
        drillMilitiaTrainingGainTotal:
          'drillMilitiaTrainingGainTotal' in args.patch.activityRollTotals
            ? parseManualTotal(
                args.patch.activityRollTotals.drillMilitiaTrainingGainTotal,
              )
            : (currentActivityRollTotals.drillMilitiaTrainingGainTotal as
                | number
                | undefined),
        earnGoldCheckTotal:
          'earnGoldCheckTotal' in args.patch.activityRollTotals
            ? parseManualTotal(args.patch.activityRollTotals.earnGoldCheckTotal)
            : (currentActivityRollTotals.earnGoldCheckTotal as
                | number
                | undefined),
        earnGoldTotal:
          'earnGoldTotal' in args.patch.activityRollTotals
            ? parseManualTotal(args.patch.activityRollTotals.earnGoldTotal)
            : (currentActivityRollTotals.earnGoldTotal as number | undefined),
        earnGoldNotorietyIncreaseTotal:
          'earnGoldNotorietyIncreaseTotal' in args.patch.activityRollTotals
            ? parseManualTotal(
                args.patch.activityRollTotals.earnGoldNotorietyIncreaseTotal,
              )
            : (currentActivityRollTotals.earnGoldNotorietyIncreaseTotal as
                | number
                | undefined),
        gatherInformationCheckTotal:
          'gatherInformationCheckTotal' in args.patch.activityRollTotals
            ? parseManualTotal(
                args.patch.activityRollTotals.gatherInformationCheckTotal,
              )
            : (currentActivityRollTotals.gatherInformationCheckTotal as
                | number
                | undefined),
        gatherInformationNotorietyIncreaseTotal:
          'gatherInformationNotorietyIncreaseTotal' in args.patch.activityRollTotals
            ? parseManualTotal(
                args.patch.activityRollTotals
                  .gatherInformationNotorietyIncreaseTotal,
              )
            : (currentActivityRollTotals.gatherInformationNotorietyIncreaseTotal as
                | number
                | undefined),
        guaranteeEventNotorietyIncreaseTotal:
          'guaranteeEventNotorietyIncreaseTotal' in args.patch.activityRollTotals
            ? parseManualTotal(
                args.patch.activityRollTotals
                  .guaranteeEventNotorietyIncreaseTotal,
              )
            : (currentActivityRollTotals.guaranteeEventNotorietyIncreaseTotal as
                | number
                | undefined),
        knowledgeCheckTotal:
          'knowledgeCheckTotal' in args.patch.activityRollTotals
            ? parseManualTotal(args.patch.activityRollTotals.knowledgeCheckTotal)
            : (currentActivityRollTotals.knowledgeCheckTotal as
                | number
                | undefined),
        recruitTeamCheckTotal:
          'recruitTeamCheckTotal' in args.patch.activityRollTotals
            ? parseManualTotal(args.patch.activityRollTotals.recruitTeamCheckTotal)
            : (currentActivityRollTotals.recruitTeamCheckTotal as
                | number
                | undefined),
        recruitTeamNotorietyIncreaseTotal:
          'recruitTeamNotorietyIncreaseTotal' in args.patch.activityRollTotals
            ? parseManualTotal(
                args.patch.activityRollTotals.recruitTeamNotorietyIncreaseTotal,
              )
            : (currentActivityRollTotals.recruitTeamNotorietyIncreaseTotal as
                | number
                | undefined),
        reduceDangerCheckTotal:
          'reduceDangerCheckTotal' in args.patch.activityRollTotals
            ? parseManualTotal(args.patch.activityRollTotals.reduceDangerCheckTotal)
            : (currentActivityRollTotals.reduceDangerCheckTotal as
                | number
                | undefined),
        reduceDangerNotorietyIncreaseTotal:
          'reduceDangerNotorietyIncreaseTotal' in args.patch.activityRollTotals
            ? parseManualTotal(
                args.patch.activityRollTotals.reduceDangerNotorietyIncreaseTotal,
              )
            : (currentActivityRollTotals.reduceDangerNotorietyIncreaseTotal as
                | number
                | undefined),
        rescueCharacterCheckTotal:
          'rescueCharacterCheckTotal' in args.patch.activityRollTotals
            ? parseManualTotal(
                args.patch.activityRollTotals.rescueCharacterCheckTotal,
              )
            : (currentActivityRollTotals.rescueCharacterCheckTotal as
                | number
                | undefined),
        rescueCharacterTargetLevelTotal:
          'rescueCharacterTargetLevelTotal' in args.patch.activityRollTotals
            ? parseManualTotal(
                args.patch.activityRollTotals.rescueCharacterTargetLevelTotal,
              )
            : (currentActivityRollTotals.rescueCharacterTargetLevelTotal as
                | number
                | undefined),
        rescueCharacterNotorietyIncreaseTotal:
          'rescueCharacterNotorietyIncreaseTotal' in args.patch.activityRollTotals
            ? parseManualTotal(
                args.patch.activityRollTotals
                  .rescueCharacterNotorietyIncreaseTotal,
              )
            : (currentActivityRollTotals.rescueCharacterNotorietyIncreaseTotal as
                | number
                | undefined),
        restoreCharacterCostTotal:
          'restoreCharacterCostTotal' in args.patch.activityRollTotals
            ? parseOptionalNonNegativeTotal(
                args.patch.activityRollTotals.restoreCharacterCostTotal,
              )
            : (currentActivityRollTotals.restoreCharacterCostTotal as
                | number
                | undefined),
        secureCacheCheckTotal:
          'secureCacheCheckTotal' in args.patch.activityRollTotals
            ? parseManualTotal(args.patch.activityRollTotals.secureCacheCheckTotal)
            : (currentActivityRollTotals.secureCacheCheckTotal as
                | number
                | undefined),
        specialActionCostTotal:
          'specialActionCostTotal' in args.patch.activityRollTotals
            ? parseOptionalNonNegativeTotal(
                args.patch.activityRollTotals.specialActionCostTotal,
              )
            : (currentActivityRollTotals.specialActionCostTotal as
                | number
                | undefined),
        specialOrderItemCostTotal:
          'specialOrderItemCostTotal' in args.patch.activityRollTotals
            ? parseOptionalNonNegativeTotal(
                args.patch.activityRollTotals.specialOrderItemCostTotal,
              )
            : (currentActivityRollTotals.specialOrderItemCostTotal as
                | number
                | undefined),
        spreadPropagandaCheckTotal:
          'spreadPropagandaCheckTotal' in args.patch.activityRollTotals
            ? parseManualTotal(
                args.patch.activityRollTotals.spreadPropagandaCheckTotal,
              )
            : (currentActivityRollTotals.spreadPropagandaCheckTotal as
                | number
                | undefined),
        specialOrderDeliveryDaysTotal:
          'specialOrderDeliveryDaysTotal' in args.patch.activityRollTotals
            ? parseManualTotal(
                args.patch.activityRollTotals.specialOrderDeliveryDaysTotal,
              )
            : (currentActivityRollTotals.specialOrderDeliveryDaysTotal as
                | number
                | undefined),
      };
    }
    if (args.patch.eventRollTotals) {
      nextPatch.eventRollTotals = {
        eventChanceTotal:
          'eventChanceTotal' in args.patch.eventRollTotals
            ? parseManualTotal(args.patch.eventRollTotals.eventChanceTotal)
            : (currentEventRollTotals.eventChanceTotal as number | undefined),
        eventTriggerRollTotal:
          'eventTriggerRollTotal' in args.patch.eventRollTotals
            ? parseManualTotal(args.patch.eventRollTotals.eventTriggerRollTotal)
            : (currentEventRollTotals.eventTriggerRollTotal as
                | number
                | undefined),
        eventPercentileTotal:
          'eventPercentileTotal' in args.patch.eventRollTotals
            ? parseManualTotal(args.patch.eventRollTotals.eventPercentileTotal)
            : (currentEventRollTotals.eventPercentileTotal as
                | number
                | undefined),
        rollTwiceFirstTotal:
          'rollTwiceFirstTotal' in args.patch.eventRollTotals
            ? parseManualTotal(args.patch.eventRollTotals.rollTwiceFirstTotal)
            : (currentEventRollTotals.rollTwiceFirstTotal as
                | number
                | undefined),
        rollTwiceSecondTotal:
          'rollTwiceSecondTotal' in args.patch.eventRollTotals
            ? parseManualTotal(args.patch.eventRollTotals.rollTwiceSecondTotal)
            : (currentEventRollTotals.rollTwiceSecondTotal as
                | number
                | undefined),
        guaranteedFirstPercentileTotal:
          'guaranteedFirstPercentileTotal' in args.patch.eventRollTotals
            ? parseManualTotal(
                args.patch.eventRollTotals.guaranteedFirstPercentileTotal,
              )
            : (currentEventRollTotals.guaranteedFirstPercentileTotal as
                | number
                | undefined),
        guaranteedSecondPercentileTotal:
          'guaranteedSecondPercentileTotal' in args.patch.eventRollTotals
            ? parseManualTotal(
                args.patch.eventRollTotals.guaranteedSecondPercentileTotal,
              )
            : (currentEventRollTotals.guaranteedSecondPercentileTotal as
                | number
                | undefined),
        guaranteedChosen:
          'guaranteedChosen' in args.patch.eventRollTotals
            ? args.patch.eventRollTotals.guaranteedChosen ?? undefined
            : (currentEventRollTotals.guaranteedChosen as
                | 'first'
                | 'second'
                | undefined),
        sabotageCheckTotal:
          'sabotageCheckTotal' in args.patch.eventRollTotals
            ? parseManualTotal(args.patch.eventRollTotals.sabotageCheckTotal)
            : (currentEventRollTotals.sabotageCheckTotal as number | undefined),
        sabotageNotorietyIncreaseTotal:
          'sabotageNotorietyIncreaseTotal' in args.patch.eventRollTotals
            ? parseManualTotal(
                args.patch.eventRollTotals.sabotageNotorietyIncreaseTotal,
              )
            : (currentEventRollTotals.sabotageNotorietyIncreaseTotal as
                | number
                | undefined),
      };
    }

    if (!current) {
      const baseWeek = args.patch.weekNumber ?? 1;
      const initialPhase = args.patch.phase ?? (baseWeek === 1 ? 'activity' : 'upkeep');
      await ctx.db.insert('militiaWeekState', {
        militiaId: args.militiaId,
        weekNumber: baseWeek,
        phase: initialPhase,
        isFirstWeek: baseWeek === 1,
        skippedUpkeepThisWeek: baseWeek === 1,
        upkeepTreasurySnapshot:
          initialPhase === 'upkeep' ? militia.treasury : undefined,
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
          reduceDangerTargets: [],
          spreadPropagandaTargets: [],
          strikeTeams: [],
          caches: [],
          orders: [],
          marketplaces: [],
          covertActions: [],
          rescues: [],
          restorations: [],
        }) as never,
        upkeepTeamOperations: (nextPatch.upkeepTeamOperations ?? {
          disabledRecoveries: [],
          missingChecks: [],
        }) as never,
        eventMitigations: (nextPatch.eventMitigations ?? {}) as never,
        tableAdjustments: nextPatch.tableAdjustments ?? [],
        weekWarnings: (nextPatch.weekWarnings ?? []) as never,
        upkeepRollTotals: nextPatch.upkeepRollTotals,
        activityRollTotals: nextPatch.activityRollTotals,
        eventRollTotals: nextPatch.eventRollTotals,
        lockVersion: nextPatch.lockVersion,
      });
      return { revision: nextPatch.lockVersion };
    }

    if (args.patch.phase === 'upkeep' && current.phase !== 'upkeep') {
      nextPatch.upkeepTreasurySnapshot = militia.treasury;
    }

    await ctx.db.patch('militiaWeekState', current._id, nextPatch as never);
    return { revision: nextPatch.lockVersion };
  },
});

export const commitCurrentPhase = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    militiaId: v.id('militia'),
    expectedRevision: v.optional(v.number()),
    finalizeWeek: v.optional(v.boolean()),
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
          rollbackHistory?: WeekRollbackSnapshot[];
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
            reduceDangerTargets?: Array<{
              slotIndex: number;
              settlementKey: string;
            }>;
            spreadPropagandaTargets?: Array<{
              slotIndex: number;
              settlementKey: string;
            }>;
            strikeTeams?: Array<{
              slotIndex: number;
              mode?: 'combat_support' | 'extraction';
              location?: string;
              notes?: string;
            }>;
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
            turncoatTrainingLossTotal?: number;
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
          tableAdjustments?: TableAdjustment[];
          weekWarnings?: Array<{ code: string; message: string }>;
        })
      | undefined;
    if (
      currentAny?.tableAdjustments?.some(
        (adjustment) => adjustment.reason.trim().length === 0,
      )
    ) {
      throw new ConvexError('Every Table Adjustment requires a reason.');
    }
    if (
      current &&
      args.expectedRevision !== undefined &&
      current.lockVersion !== args.expectedRevision
    ) {
      throw new ConvexError(
        'The Weekly Draft changed after it was reviewed. Review the latest preview before confirming again.',
      );
    }
    const currentRollbackHistory = currentAny?.rollbackHistory ?? [];
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
          reduceDangerTargets: [],
          spreadPropagandaTargets: [],
          strikeTeams: [],
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
        activityRollTotals: {},
        lockVersion: 1,
      });
      return { nextPhase: 'activity', weekNumber: 1 };
    }

    const phaseToCommit = args.finalizeWeek ? 'week_closed' : current.phase;
    let nextPhase: 'upkeep' | 'activity' | 'event' | 'persistent' | 'week_closed' =
      phaseToCommit;
    let nextWeekNumber = current.weekNumber;
    let nextUneventfulBonusCarry = current.uneventfulBonusCarry ?? 0;
    let nextQueuedEffects = current.queuedEffects ?? [];
    let nextUpkeepTreasurySnapshot = current.upkeepTreasurySnapshot;
    let nextRollbackHistory = currentRollbackHistory;

    if (phaseToCommit === 'upkeep') {
      nextPhase = 'activity';
    } else if (phaseToCommit === 'activity') {
      nextPhase = 'event';
    } else if (phaseToCommit === 'event') {
      const activePersistentEvents = await ctx.db
        .query('militiaEventState')
        .withIndex('by_militiaId_persistent', (q) =>
          q.eq('militiaId', args.militiaId).eq('isPersistent', true),
        )
        .collect();
      nextPhase = activePersistentEvents.some((event) => !event.resolved)
        ? 'persistent'
        : 'week_closed';
    } else if (phaseToCommit === 'persistent') {
      nextPhase = 'week_closed';
    } else if (phaseToCommit === 'week_closed') {
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
      const teamById = new Map<TeamId, (typeof teamRows)[number]>(
        teamRows.map((row) => [row.teamId, row]),
      );
      const teamStateById = getTeamStatusRowsByTeamId(teamStateRows) as Map<
        TeamId,
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

      const ensureTeamState = async (teamId: TeamId) => {
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

      const activityOfficerOperations = currentAny?.activityOfficerOperations ?? {
        changes: [],
      };
      const activityAssetOperations = {
        refuges: currentAny?.activityAssetOperations?.refuges ?? [],
        reduceDangerTargets:
          currentAny?.activityAssetOperations?.reduceDangerTargets ?? [],
        spreadPropagandaTargets:
          currentAny?.activityAssetOperations?.spreadPropagandaTargets ?? [],
        strikeTeams: currentAny?.activityAssetOperations?.strikeTeams ?? [],
        caches: currentAny?.activityAssetOperations?.caches ?? [],
        orders: currentAny?.activityAssetOperations?.orders ?? [],
        marketplaces: currentAny?.activityAssetOperations?.marketplaces ?? [],
        covertActions: currentAny?.activityAssetOperations?.covertActions ?? [],
        rescues: currentAny?.activityAssetOperations?.rescues ?? [],
        restorations:
          currentAny?.activityAssetOperations?.restorations ?? [],
      };
      const eventMitigations: {
        cacheDiscoveredMitigationTotal?: number;
        theftMitigationTotal?: number;
        sicknessTwiceLoyaltyTotal?: number;
        turncoatTrainingLossTotal?: number;
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
      } = currentAny?.eventMitigations ?? {};

      const allEventStates = await ctx.db
        .query('militiaEventState')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
        .collect();
      nextRollbackHistory = [
        ...currentRollbackHistory,
        buildRollbackSnapshot({
          currentWeekState: currentAny ?? current,
          militia,
          teamRows,
          teamStateRows,
          settlementRows,
          cacheRows,
          marketplaceRows,
          orderRows,
          trackedPeopleRows,
          eventRows: allEventStates,
        }),
      ];
      const activePersistentEventStates = allEventStates
        .filter((eventState) => eventState.isPersistent && !eventState.resolved)
        .sort((a, b) => a.startedWeek - b.startedWeek);
      const { active: activeQueuedEffects, remaining: remainingQueuedEffects } =
        consumeQueuedEffectsForWeek({
          queuedEffects: current.queuedEffects,
          weekNumber: current.weekNumber,
        });
      const activePersistentEventTypes = activePersistentEventStates.map(
        (eventState) => eventState.eventType,
      );
      const weeklyResolution = resolveCurrentWeekDraft({
        current,
        militia,
        teamRows,
        teamStateRows,
        activeQueuedEffects,
        activePersistentEventTypes,
      });
      const getEffectiveActivityCheckTotal = ({
        rawTotal,
        checkType,
        slotIndex,
      }: {
        rawTotal?: number;
        checkType: 'loyalty' | 'security' | 'secrecy';
        slotIndex?: number;
      }) => {
        const teamId =
          slotIndex === undefined
            ? undefined
            : (current.stagedActivityTeamIds?.[slotIndex] ?? undefined);
        return resolveEffectiveActivityCheckTotal({
          rawTotal,
          checkType,
          teamId,
          activeQueuedEffects,
          activePersistentEventTypes,
          resolvedEvents: weeklyResolution.summary.resolvedEvents,
        });
      };
      const isSecureCacheBlocked = isActivityActionBlocked({
        activeQueuedEffects,
        activePersistentEventTypes,
        actionId: 'secure_cache',
      });
      const actionQueuedEffects: QueueEffect[] = [];

      await applyResolvedTeamOperationPlan({
        ctx,
        militiaId: args.militiaId,
        plan: weeklyResolution.baselinePlan,
        teamById,
        teamStateById,
      });

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

      for (const settlement of Array.from(settlementByKey.values())) {
        if (settlement.temporaryShift === undefined) {
          continue;
        }
        await ctx.db.patch('militiaSettlementState', settlement._id, {
          temporaryShift: undefined,
        });
        settlementByKey.set(settlement.settlementKey, {
          ...settlement,
          temporaryShift: undefined,
        });
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

      for (const reduceDanger of activityAssetOperations.reduceDangerTargets) {
        if (
          current.stagedActivityActionIds[reduceDanger.slotIndex] !== 'reduce_danger'
        ) {
          continue;
        }
        const checkTotal = getEffectiveActivityCheckTotal({
          rawTotal: current.activityRollTotals?.reduceDangerCheckTotal,
          checkType: 'security',
          slotIndex: reduceDanger.slotIndex,
        });
        if ((checkTotal ?? -Infinity) < 15) {
          continue;
        }
        const settlementKey = trimToUndefined(reduceDanger.settlementKey);
        if (!settlementKey) {
          continue;
        }
        const settlement = settlementByKey.get(settlementKey);
        if (!settlement) {
          throw new ConvexError(
            `Reduce Danger requires an existing tracked settlement: ${settlementKey}`,
          );
        }
        await ctx.db.patch('militiaSettlementState', settlement._id, {
          temporaryShift: Math.max(settlement.temporaryShift ?? 0, 1),
        });
        settlementByKey.set(settlementKey, {
          ...settlement,
          temporaryShift: Math.max(settlement.temporaryShift ?? 0, 1),
        });
      }

      const propagatedSettlementKeys = new Set<string>();
      for (const propaganda of activityAssetOperations.spreadPropagandaTargets) {
        if (
          current.stagedActivityActionIds[propaganda.slotIndex] !==
          'spread_propaganda'
        ) {
          continue;
        }
        const checkTotal = getEffectiveActivityCheckTotal({
          rawTotal: current.activityRollTotals?.spreadPropagandaCheckTotal,
          checkType: 'loyalty',
          slotIndex: propaganda.slotIndex,
        });
        if ((checkTotal ?? -Infinity) < 20) {
          continue;
        }
        const settlementKey = trimToUndefined(propaganda.settlementKey);
        if (!settlementKey || propagatedSettlementKeys.has(settlementKey)) {
          continue;
        }
        const settlement = settlementByKey.get(settlementKey);
        if (!settlement) {
          throw new ConvexError(
            `Spread Propaganda requires an existing tracked settlement: ${settlementKey}`,
          );
        }
        const reputation = raiseReputationOneStep(settlement.reputation);
        await ctx.db.patch('militiaSettlementState', settlement._id, {
          reputation,
        });
        settlementByKey.set(settlementKey, { ...settlement, reputation });
        propagatedSettlementKeys.add(settlementKey);
      }

      for (const strikeTeam of activityAssetOperations.strikeTeams) {
        if (current.stagedActivityActionIds[strikeTeam.slotIndex] !== 'strike_team') {
          continue;
        }
        if (!strikeTeam.mode) {
          continue;
        }
        const location = trimToUndefined(strikeTeam.location);
        const rounds = Math.max(1, Math.floor(militia.rank / 2));
        const note =
          strikeTeam.mode === 'combat_support'
            ? `Strike Team: at ${location ?? 'chosen location'}, PCs gain +2 competence on attack rolls, damage rolls, and saving throws for ${rounds} round(s).`
            : `Strike Team: casualty extraction available${location ? ` at ${location}` : ''}; bleeding allies stabilize, dead allies receive gentle repose at CL 12 and bodies return to HQ.`;
        actionQueuedEffects.push({
          kind: 'table_note',
          appliesWeek: current.weekNumber + 1,
          strikeTeamMode: strikeTeam.mode,
          location,
          note: strikeTeam.notes ? `${note} ${strikeTeam.notes}` : note,
        });
      }

      for (const cacheOperation of activityAssetOperations.caches) {
        if (current.stagedActivityActionIds[cacheOperation.slotIndex] !== 'secure_cache') {
          continue;
        }
        if (isSecureCacheBlocked) {
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
          const checkTotal = getEffectiveActivityCheckTotal({
            rawTotal: cacheOperation.checkTotal,
            checkType: 'secrecy',
            slotIndex: cacheOperation.slotIndex,
          });
          const dc = getCacheDc({
            cacheClass: cache.cacheClass,
            isSecureLocation: cache.isSecureLocation,
          });
          if ((checkTotal ?? -Infinity) >= dc) {
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
        const checkTotal = getEffectiveActivityCheckTotal({
          rawTotal: cacheOperation.checkTotal,
          checkType: 'secrecy',
          slotIndex: cacheOperation.slotIndex,
        });
        const status =
          (checkTotal ?? -Infinity) >=
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
          (getEffectiveActivityCheckTotal({
            rawTotal: current.activityRollTotals?.activateBlackMarketCheckTotal,
            checkType: 'secrecy',
            slotIndex,
          }) ?? -Infinity) < 20
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
        const checkTotal = getEffectiveActivityCheckTotal({
          rawTotal: current.activityRollTotals?.rescueCharacterCheckTotal,
          checkType: 'security',
          slotIndex: rescue.slotIndex,
        });
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

      const nearestSettlementReputationChange =
        weeklyResolution.baselinePlan.find(
          (change) => change.kind === 'lower_settlement_reputation',
        );
      if (nearestSettlementReputationChange) {
        const nearestSettlement = await ctx.db
          .query('militiaSettlementState')
          .withIndex('by_militiaId_settlement', (q) =>
            q
              .eq('militiaId', args.militiaId)
              .eq(
                'settlementKey',
                nearestSettlementReputationChange.settlementKey,
              ),
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
        resolvedEvents: weeklyResolution.summary.resolvedEvents,
        currentWeek: current.weekNumber,
      });

      const endedPersistentEventIds = new Set<string>();
      const endPersistentEvent = async (eventState: (typeof activePersistentEventStates)[number]) => {
        if (endedPersistentEventIds.has(eventState._id)) {
          return;
        }
        await ctx.db.patch('militiaEventState', eventState._id, {
          resolved: true,
          isPersistent: false,
          endedWeek: current.weekNumber,
        });
        endedPersistentEventIds.add(eventState._id);
      };

      const setTeamStatus = async ({
        teamId,
        status,
        unavailableUntilWeek,
        notes,
      }: {
        teamId?: string;
        status: TeamStatus;
        unavailableUntilWeek?: number;
        notes?: string;
      }) => {
        if (!teamId || !isTeamId(teamId)) return;
        if (!teamById.has(teamId)) return;
        const state = await ensureTeamState(teamId);
        const updatedState = {
          ...state,
          status,
          unavailableUntilWeek,
          notes,
        };
        await ctx.db.patch('militiaTeamState', state._id, {
          status,
          unavailableUntilWeek,
          notes,
        });
        teamStateById.set(teamId, updatedState);
      };

      const successfulReduceDangerCount = current.stagedActivityActionIds.reduce(
        (count, actionId, slotIndex) => {
          if (actionId !== 'reduce_danger') return count;
          const checkTotal = getEffectiveActivityCheckTotal({
            rawTotal: current.activityRollTotals?.reduceDangerCheckTotal,
            checkType: 'security',
            slotIndex,
          });
          return (checkTotal ?? -Infinity) >= 15 ? count + 1 : count;
        },
        0,
      );
      if (successfulReduceDangerCount > 0) {
        const theftPersistentEvents = activePersistentEventStates
          .filter((eventState) => eventState.eventType === 'theft')
          .slice(0, successfulReduceDangerCount);
        for (const eventState of theftPersistentEvents) {
          await endPersistentEvent(eventState);
        }
      }

      let usedCacheDiscoveredMitigation = false;
      for (const event of weeklyResolution.summary.resolvedEvents) {
        if (event.eventType === 'cache_discovered') {
          const hiddenCaches = Array.from(cacheById.values())
            .filter((cache) => cache.status === 'hidden')
            .sort((a, b) => a.createdWeek - b.createdWeek);
          const canMitigateCacheDiscovery =
            !usedCacheDiscoveredMitigation &&
            (eventMitigations.cacheDiscoveredMitigationTotal ?? -Infinity) >=
              10 + militia.rank;
          let remainingHiddenCaches = hiddenCaches;
          if (canMitigateCacheDiscovery && hiddenCaches[0]) {
            const [retrievedCache, ...rest] = hiddenCaches;
            await ctx.db.patch('militiaCache', retrievedCache._id, {
              status: 'retrieved',
              retrievedWeek: current.weekNumber,
              updatedWeek: current.weekNumber,
            });
            cacheById.set(retrievedCache._id, {
              ...retrievedCache,
              status: 'retrieved',
              retrievedWeek: current.weekNumber,
              updatedWeek: current.weekNumber,
            });
            usedCacheDiscoveredMitigation = true;
            remainingHiddenCaches = rest;
          }
          const cachesToLose = event.isTwiceClause
            ? remainingHiddenCaches
            : remainingHiddenCaches.slice(0, 1);
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
              const validTeamId = teamId && isTeamId(teamId) ? teamId : undefined;
              const teamRow = validTeamId
                ? teamById.get(validTeamId)
                : undefined;
              if (teamRow) {
                await ctx.db.delete('militiaTeam', teamRow._id);
                teamById.delete(validTeamId!);
              }
              const state = validTeamId
                ? teamStateById.get(validTeamId)
                : undefined;
              if (state) {
                await ctx.db.delete('militiaTeamState', state._id);
                teamStateById.delete(validTeamId!);
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
              const updatedState = {
                ...disabledState,
                status: 'active' as const,
                unavailableUntilWeek: undefined,
              };
              await ctx.db.patch('militiaTeamState', disabledState._id, {
                status: 'active',
                unavailableUntilWeek: undefined,
              });
              teamStateById.set(disabledState.teamId, updatedState);
            }
          } else {
            const boostTeamId = eventMitigations.turnAroundBoostTeamId;
            if (boostTeamId) {
              await setTeamStatus({
                teamId: boostTeamId,
                status: 'active',
                notes: `turn_around_boost_week_${current.weekNumber + 1}`,
              });
              actionQueuedEffects.push({
                kind: 'team_check_modifier',
                appliesWeek: current.weekNumber + 1,
                teamId: boostTeamId,
                modifierTotal: 2,
                sourceEventType: 'turn_around',
                note: 'Turn Around: +2 on one Activity-phase check by this team.',
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
          if (!teamId || !isTeamId(teamId)) continue;
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
        const toEnd = activePersistentEventStates
          .filter((eventState) => !endedPersistentEventIds.has(eventState._id))
          .slice(0, derived.endPersistentCount);
        for (const eventState of toEnd) {
          await endPersistentEvent(eventState);
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

      const completeBaselinePlan = weeklyResolution.baselinePlan;
      const finalPlan = weeklyResolution.finalPlan;
      const finalMilitiaValues = weeklyResolution.summary.militia;

      await ctx.db.patch('militia', args.militiaId, {
        ...finalMilitiaValues,
      });
      await applyTableAdjustmentPlan({
        ctx,
        militiaId: args.militiaId,
        weekNumber: current.weekNumber,
        finalPlan,
      });

      const previousResolutionRecord = await ctx.db
        .query('militiaResolutionRecord')
        .withIndex('by_militiaId_and_weekNumber', (q) =>
          q
            .eq('militiaId', args.militiaId)
            .eq('weekNumber', current.weekNumber),
        )
        .order('desc')
        .first();
      await ctx.db.insert('militiaResolutionRecord', {
        campaignId: militia.campaignId,
        militiaId: args.militiaId,
        weekNumber: current.weekNumber,
        source: 'confirmation',
        rulesetVersion: weeklyResolution.rulesetVersion,
        draftRevision: current.lockVersion,
        baselinePlan: completeBaselinePlan,
        finalPlan,
        warnings: [
          ...(currentAny?.weekWarnings ?? []),
          ...weeklyResolution.warnings,
        ],
        tableAdjustments: currentAny?.tableAdjustments ?? [],
        finalOutcome: {
          militia: finalMilitiaValues,
          nextUneventfulBonusCarry:
            weeklyResolution.summary.nextUneventfulBonusCarry,
          resolvedEvents: weeklyResolution.summary.resolvedEvents,
        },
        supersedesRecordId: previousResolutionRecord?._id,
        createdAt: Date.now(),
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
      nextUneventfulBonusCarry =
        weeklyResolution.summary.nextUneventfulBonusCarry;
      nextQueuedEffects = [
        ...remainingQueuedEffects,
        ...derived.queuedToAdd,
        ...actionQueuedEffects,
      ];
      nextUpkeepTreasurySnapshot = finalMilitiaValues.treasury;
    }

    await ctx.db.patch('militiaWeekState', current._id, {
      phase: nextPhase,
      weekNumber: nextWeekNumber,
      isFirstWeek: nextWeekNumber === 1,
      skippedUpkeepThisWeek: nextWeekNumber === 1,
      upkeepTreasurySnapshot: nextUpkeepTreasurySnapshot,
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
              reduceDangerTargets: [],
              spreadPropagandaTargets: [],
              strikeTeams: [],
              caches: [],
              orders: [],
              marketplaces: [],
              covertActions: [],
              rescues: [],
              restorations: [],
            }
          : {
              refuges: currentAny?.activityAssetOperations?.refuges ?? [],
              reduceDangerTargets:
                currentAny?.activityAssetOperations?.reduceDangerTargets ?? [],
              spreadPropagandaTargets:
                currentAny?.activityAssetOperations?.spreadPropagandaTargets ?? [],
              strikeTeams: currentAny?.activityAssetOperations?.strikeTeams ?? [],
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
      tableAdjustments:
        nextPhase === 'upkeep' ? [] : currentAny?.tableAdjustments,
      weekWarnings: nextPhase === 'upkeep' ? [] : currentAny?.weekWarnings,
      upkeepRollTotals: nextPhase === 'upkeep' ? {} : current.upkeepRollTotals,
      activityRollTotals: nextPhase === 'upkeep' ? {} : current.activityRollTotals,
      eventRollTotals: nextPhase === 'upkeep' ? {} : current.eventRollTotals,
      rollbackHistory: nextRollbackHistory,
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
    await assertMilitiaAccess(ctx, args.militiaId, args.organizationId);
    const existing = await ctx.db
      .query('militiaWeekState')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
      .collect();
    const current = existing.sort((a, b) => b.weekNumber - a.weekNumber)[0];

    if (!current || current.weekNumber <= 1) {
      throw new ConvexError('Already at week 1.');
    }

    const currentAny = current as typeof current & {
      rollbackHistory?: WeekRollbackSnapshot[];
    };
    const rollbackHistory: WeekRollbackSnapshot[] =
      currentAny.rollbackHistory ?? [];
    const snapshot = rollbackHistory[rollbackHistory.length - 1];

    if (!snapshot) {
      throw new ConvexError(
        'No committed week snapshot is available for rollback.',
      );
    }

    const [
      currentTeamRows,
      currentTeamStateRows,
      currentSettlementRows,
      currentCacheRows,
      currentMarketplaceRows,
      currentOrderRows,
      currentTrackedPeopleRows,
      currentEventRows,
    ] = await Promise.all([
      ctx.db
        .query('militiaTeam')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
        .collect(),
      ctx.db
        .query('militiaTeamState')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
        .collect(),
      ctx.db
        .query('militiaSettlementState')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
        .collect(),
      ctx.db
        .query('militiaCache')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
        .collect(),
      ctx.db
        .query('militiaMarketplace')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
        .collect(),
      ctx.db
        .query('militiaOrder')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
        .collect(),
      ctx.db
        .query('militiaCharacterStatus')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
        .collect(),
      ctx.db
        .query('militiaEventState')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
        .collect(),
    ]);

    const snapshotMilitiaAny = snapshot.militia;
    await ctx.db.patch(
      'militia',
      args.militiaId,
      {
        ...snapshotMilitiaAny,
        ambassador: snapshotMilitiaAny.ambassador,
        commandant: snapshotMilitiaAny.commandant,
        marshal: snapshotMilitiaAny.marshal,
        overseer: snapshotMilitiaAny.overseer,
        spymaster: snapshotMilitiaAny.spymaster,
        strategist: snapshotMilitiaAny.strategist,
      } as never,
    );

    await syncMilitiaRowsFromSnapshot({
      ctx,
      table: 'militiaTeam',
      currentRows: currentTeamRows,
      snapshotRows: snapshot.teams,
      getCurrentKey: (row) => String(row.teamId),
      getSnapshotKey: (row) => String(row.teamId),
      mapSnapshotToDoc: (row) =>
        snapshotRowToDoc(row, [
          'managerSource',
          'managerCharacterId',
          'managerName',
          'managerKind',
          'managerCharisma',
        ]),
    });
    await syncMilitiaRowsFromSnapshot({
      ctx,
      table: 'militiaTeamState',
      currentRows: currentTeamStateRows,
      snapshotRows: snapshot.teamStates,
      getCurrentKey: (row) => String(row.teamId),
      getSnapshotKey: (row) => String(row.teamId),
      mapSnapshotToDoc: (row) =>
        snapshotRowToDoc(row, ['unavailableUntilWeek', 'notes']),
    });
    await syncMilitiaRowsFromSnapshot({
      ctx,
      table: 'militiaSettlementState',
      currentRows: currentSettlementRows,
      snapshotRows: snapshot.settlements,
      getCurrentKey: (row) => String(row.settlementKey),
      getSnapshotKey: (row) => String(row.settlementKey),
      mapSnapshotToDoc: (row) =>
        snapshotRowToDoc(row, [
          'temporaryShift',
          'refugeActiveUntilWeek',
          'refugeActivatedWeek',
        ]),
    });
    const cacheIds = await syncMilitiaRowsFromSnapshot({
      ctx,
      table: 'militiaCache',
      currentRows: currentCacheRows,
      snapshotRows: snapshot.caches,
      getCurrentKey: (row) =>
        [row.label, row.cacheClass, row.location, row.createdWeek].join('::'),
      getSnapshotKey: (row) =>
        [row.label, row.cacheClass, row.location, row.createdWeek].join('::'),
      mapSnapshotToDoc: (row) => snapshotRowToDoc(row, ['retrievedWeek', 'lostWeek']),
    });
    const marketplaceIds = await syncMilitiaRowsFromSnapshot({
      ctx,
      table: 'militiaMarketplace',
      currentRows: currentMarketplaceRows,
      snapshotRows: snapshot.marketplaces,
      getCurrentKey: (row) =>
        [row.label, row.sourceAction, row.teamId, row.createdWeek].join('::'),
      getSnapshotKey: (row) =>
        [row.label, row.sourceAction, row.teamId, row.createdWeek].join('::'),
      mapSnapshotToDoc: (row) =>
        snapshotRowToDoc(row, [
          'marketDayDiscountPercent',
          'marketDayAppliedWeek',
          'notes',
        ]),
    });
    await syncMilitiaRowsFromSnapshot({
      ctx,
      table: 'militiaOrder',
      currentRows: currentOrderRows,
      snapshotRows: snapshot.orders,
      getCurrentKey: (row) =>
        [row.description, row.orderedWeek, row.sourceAction ?? '', row.notes ?? ''].join(
          '::',
        ),
      getSnapshotKey: (row) =>
        [row.description, row.orderedWeek, row.sourceAction ?? '', row.notes ?? ''].join(
          '::',
        ),
      mapSnapshotToDoc: (row) => {
        const { marketplaceId, ...doc } = snapshotRowToDoc(row, [
          'notes',
          'costPaid',
          'deliveredWeek',
          'sourceAction',
          'marketplaceId',
        ]);
        const restoredMarketplaceId =
          typeof marketplaceId === 'string'
            ? (marketplaceIds.get(marketplaceId) ?? marketplaceId)
            : undefined;
        return {
          ...doc,
          marketplaceId: restoredMarketplaceId,
        };
      },
    });
    const trackedPersonIds = await syncMilitiaRowsFromSnapshot({
      ctx,
      table: 'militiaCharacterStatus',
      currentRows: currentTrackedPeopleRows,
      snapshotRows: snapshot.trackedPeople,
      getCurrentKey: (row) =>
        [row.characterId ?? '', row.displayName, row.personKind].join('::'),
      getSnapshotKey: (row) =>
        [row.characterId ?? '', row.displayName, row.personKind].join('::'),
      mapSnapshotToDoc: (row) =>
        snapshotRowToDoc(row, [
          'characterId',
          'level',
          'settlementKey',
          'siteName',
          'notes',
          'activeUntilWeek',
          'hiddenSinceWeek',
          'capturedSinceWeek',
          'rescuedWeek',
          'restoredWeek',
          'rescueDcOverride',
          'sourceAction',
        ]),
    });
    await syncMilitiaRowsFromSnapshot({
      ctx,
      table: 'militiaEventState',
      currentRows: currentEventRows,
      snapshotRows: snapshot.events,
      getCurrentKey: (row) =>
        [
          row.eventType,
          row.weekNumber,
          row.startedWeek,
          row.isPersistent ? '1' : '0',
        ].join('::'),
      getSnapshotKey: (row) =>
        [
          row.eventType,
          row.weekNumber,
          row.startedWeek,
          row.isPersistent ? '1' : '0',
        ].join('::'),
      mapSnapshotToDoc: (row) =>
        snapshotRowToDoc(row, ['endedWeek', 'mitigationUntilWeek']),
    });

    const restoredWeekState = remapWeekStateSnapshotIds({
      weekState: snapshot.weekState,
      cacheIds,
      marketplaceIds,
      trackedPersonIds,
    });
    const restoredWeekStateAny = restoredWeekState as {
      weekNumber: number;
      phase: 'upkeep' | 'activity' | 'event' | 'persistent' | 'week_closed';
    };

    await ctx.db.patch('militiaWeekState', current._id, {
      ...restoredWeekState,
      rollbackHistory: rollbackHistory.slice(0, -1),
      lockVersion: current.lockVersion + 1,
    } as never);

    return {
      weekNumber: restoredWeekStateAny.weekNumber,
      phase: restoredWeekStateAny.phase,
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
    if (current.phase !== 'persistent') {
      throw new ConvexError(
        'Persistent event buyoff is available only during the Persistent phase.',
      );
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
    const existing = await ctx.db
      .query('militiaWeekState')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
      .collect();
    const current = existing.sort((a, b) => b.weekNumber - a.weekNumber)[0];
    if (!current) {
      throw new ConvexError('Week state not found.');
    }
    if (current.phase !== 'upkeep') {
      throw new ConvexError(
        'Treasury deposits and withdrawals are available only during the Upkeep phase.',
      );
    }

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
    const existing = await ctx.db
      .query('militiaWeekState')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
      .collect();
    const current = existing.sort((a, b) => b.weekNumber - a.weekNumber)[0];
    if (!current) {
      throw new ConvexError('Week state not found.');
    }
    if (current.phase !== 'upkeep') {
      throw new ConvexError('Militia rank increases are available only during the Upkeep phase.');
    }

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
