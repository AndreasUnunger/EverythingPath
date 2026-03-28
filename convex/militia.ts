import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import {
  cacheClassValidator,
  cacheStatusValidator,
  campaignValidator,
  eventTypeValidator,
  marketplaceAvailabilityTierValidator,
  marketplaceSourceActionValidator,
  militiaValidator,
  officerRoleValidator,
  orderStatusValidator,
  phaseValidator,
  queueEffectValidator,
  reputationValidator,
  teamIdValidator,
  teamManagerKindValidator,
  teamManagerSourceValidator,
  teamStatusValidator,
  trackedPersonKindValidator,
  trackedPersonLocationValidator,
  trackedPersonStatusValidator,
} from './schema';
import { hasAccessToOrg } from './user';
import type {
  IEventStateEntry,
  IMarketplaceLedgerState,
  IMilitia,
  IMilitiaStateSetup,
  IMilitiaTeam,
  IQueuedEffect,
} from '../src/lib/types';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import teams from './data/teams';
import { buildResolvedTeamManagers } from '../src/lib/team-manager-rules';
import { getMaxActionsForMilitia } from '../src/lib/militia-progression-rules';

function getOfficerAssignmentWarnings({
  source,
  characterKind,
}: {
  source: 'direct' | 'action';
  characterKind?: 'pc' | 'officer_npc';
}) {
  const warnings: { code: string; message: string }[] = [];

  if (source === 'direct') {
    warnings.push({
      code: 'requires_change_officer_role_action',
      message:
        'Officer role updated now. If your table is tracking actions strictly, spend one Activity action on Change Officer Role to reconcile this update.',
    });
  }

  if (characterKind && characterKind !== 'pc' && characterKind !== 'officer_npc') {
    warnings.push({
      code: 'character_kind_unexpected',
      message: 'Assigned character type is not typical for officer roles.',
    });
  }

  return warnings;
}

const trackedPersonSourceActionValidator = v.union(
  v.literal('manual'),
  v.literal('covert_action'),
  v.literal('rescue_character'),
  v.literal('restore_character'),
  v.literal('event_raid'),
);

const orderSourceActionValidator = v.union(
  v.literal('special_order'),
  v.literal('broker_market'),
  v.literal('activate_black_market'),
);

async function assertMilitiaMutationAccess(
  ctx: MutationCtx,
  {
    organizationId,
    militiaId,
  }: {
    organizationId: string;
    militiaId: Id<'militia'>;
  },
) {
  const hasAccess = await hasAccessToOrg(ctx, organizationId);
  if (!hasAccess) {
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

  return {
    militia,
    campaign,
  } satisfies {
    militia: Doc<'militia'>;
    campaign: Doc<'campaign'>;
  };
}

function getDefaultWeekContext({
  militiaId,
  rank,
  strategistAssigned,
}: {
  militiaId: Id<'militia'>;
  rank: number;
  strategistAssigned: boolean;
}) {
  const maxActions = getMaxActionsForMilitia({
    rank,
    strategistAssigned,
  });

  return {
    militiaId,
    weekNumber: 1,
    phase: 'activity' as const,
    isFirstWeek: true,
    skippedUpkeepThisWeek: true,
    uneventfulBonusCarry: 0,
    queuedEffects: [] as IQueuedEffect[],
    lastPersistentBuyoffWeek: 0,
    stagedActivityActionIds: Array.from({ length: maxActions }, () => null),
    stagedActivityTeamIds: Array.from({ length: maxActions }, () => null),
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
  };
}

export const getMilitia = query({
  args: {
    campaignId: v.optional(v.id('campaign')),
    organizationId: v.optional(campaignValidator.fields.organizationId),
  },
  handler: async (ctx, args) => {
    if (!args.campaignId || !args.organizationId) {
      return null;
    }
    const { campaignId, organizationId } = args;

    const hasAccess = await hasAccessToOrg(ctx, organizationId);

    if (!hasAccess) {
      return null;
    }

    const campaign = await ctx.db.get('campaign', campaignId);
    if (campaign?.organizationId !== organizationId) {
      return null;
    }

    const militia = await ctx.db
      .query('militia')
      .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
      .first();
    if (!militia) {
      return null;
    }

    const teamsResult = await ctx.db
      .query('militiaTeam')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
      .collect();
    const teamStates = await ctx.db
      .query('militiaTeamState')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
      .collect();
    const characters = (await ctx.db.query('character').collect()).filter(
      (character) => character.campaignId === militia.campaignId,
    );
    const resolvedManagersByTeamId = buildResolvedTeamManagers({
      teams: teamsResult.map((team) => ({
        teamId: team.teamId,
        managerSource: team.managerSource,
        managerCharacterId: team.managerCharacterId,
        managerName: team.managerName,
        managerKind: team.managerKind,
        managerCharisma: team.managerCharisma,
      })),
      characters: characters.map((character) => ({
        _id: character._id,
        name: character.name,
        kind: character.kind,
        charisma: character.charisma,
        isActive: character.isActive,
      })),
    });
    const teamStateById = new Map(teamStates.map((state) => [state.teamId, state]));

    const iTeams: IMilitiaTeam[] = teams
      .filter((team) => teamsResult.find((innerTeam) => innerTeam.teamId === team.id))
      .map((team) => {
        const teamId = team.id as (typeof teamsResult)[number]['teamId'];
        const teamRow = teamsResult.find((innerTeam) => innerTeam.teamId === teamId);
        const state = teamStateById.get(teamId);
        const manager = resolvedManagersByTeamId.get(teamId) ?? undefined;

        return {
          ...team,
          status: state?.status,
          unavailableUntilWeek: state?.unavailableUntilWeek,
          notes: state?.notes,
          manager,
          managerSource: teamRow?.managerSource,
          managerCharacterId: teamRow?.managerCharacterId,
          managerName: teamRow?.managerName,
          managerKind: teamRow?.managerKind,
          managerCharisma: teamRow?.managerCharisma,
        };
      });

    const iMilitia: IMilitia = { ...militia, teams: iTeams };

    return iMilitia;
  },
});

export const getMilitiaStateSetup = query({
  args: {
    campaignId: v.optional(v.id('campaign')),
    organizationId: v.optional(campaignValidator.fields.organizationId),
  },
  handler: async (ctx, args): Promise<IMilitiaStateSetup | null> => {
    if (!args.campaignId || !args.organizationId) {
      return null;
    }
    const campaignId = args.campaignId;

    const hasAccess = await hasAccessToOrg(ctx, args.organizationId);
    if (!hasAccess) {
      return null;
    }

    const campaign = await ctx.db.get('campaign', campaignId);
    if (campaign?.organizationId !== args.organizationId) {
      return null;
    }

    const militia = await ctx.db
      .query('militia')
      .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
      .first();
    if (!militia) {
      return null;
    }

    const [weekState, teamStates, caches, orders, trackedPeople, eventStates] =
      await Promise.all([
        ctx.db
          .query('militiaWeekState')
          .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
          .first(),
        ctx.db
          .query('militiaTeamState')
          .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
          .collect(),
        ctx.db
          .query('militiaCache')
          .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
          .collect(),
        ctx.db
          .query('militiaOrder')
          .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
          .collect(),
        ctx.db
          .query('militiaCharacterStatus')
          .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
          .collect(),
        ctx.db
          .query('militiaEventState')
          .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
          .collect(),
      ]);

    const currentWeekState = weekState
      ? {
          weekNumber: weekState.weekNumber,
          phase: weekState.phase,
          isFirstWeek: weekState.isFirstWeek,
          skippedUpkeepThisWeek: weekState.skippedUpkeepThisWeek,
          uneventfulBonusCarry: weekState.uneventfulBonusCarry,
          lastPersistentBuyoffWeek: weekState.lastPersistentBuyoffWeek,
          queuedEffects: weekState.queuedEffects,
        }
      : {
          weekNumber: 1,
          phase: 'activity' as const,
          isFirstWeek: true,
          skippedUpkeepThisWeek: true,
          uneventfulBonusCarry: 0,
          lastPersistentBuyoffWeek: 0,
          queuedEffects: [],
        };

    return {
      currentWeekState,
      teamStates: teamStates
        .map((teamState) => ({
          teamId: teamState.teamId,
          status: teamState.status,
          unavailableUntilWeek: teamState.unavailableUntilWeek,
          notes: teamState.notes,
        }))
        .sort((left, right) => left.teamId.localeCompare(right.teamId)),
      caches: caches
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
      orders: orders
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
      trackedPeople: trackedPeople
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
      eventStates: eventStates
        .map((event): IEventStateEntry => ({
          _id: event._id,
          weekNumber: event.weekNumber,
          eventType: event.eventType,
          isPersistent: event.isPersistent,
          startedWeek: event.startedWeek,
          endedWeek: event.endedWeek,
          mitigationUntilWeek: event.mitigationUntilWeek,
          resolved: event.resolved,
        }))
        .sort((left, right) => {
          if (left.resolved !== right.resolved) {
            return left.resolved ? 1 : -1;
          }
          if (left.startedWeek !== right.startedWeek) {
            return right.startedWeek - left.startedWeek;
          }
          return left.eventType.localeCompare(right.eventType);
        }),
    };
  },
});

export const assignTeamManager = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    militiaId: v.id('militia'),
    teamId: teamIdValidator,
    managerSource: v.optional(teamManagerSourceValidator),
    managerCharacterId: v.optional(v.id('character')),
    managerName: v.optional(v.string()),
    managerKind: v.optional(teamManagerKindValidator),
    managerCharisma: v.optional(v.number()),
    reason: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const access = await hasAccessToOrg(ctx, args.organizationId);
    if (!access) {
      throw new ConvexError('You do not have access to this org');
    }

    const militia = await ctx.db.get('militia', args.militiaId);
    if (!militia) {
      throw new ConvexError('Militia not found');
    }

    const campaign = await ctx.db.get('campaign', militia.campaignId);
    if (campaign?.organizationId !== args.organizationId) {
      throw new ConvexError('No campaign exists for this organization');
    }

    const teamRows = await ctx.db
      .query('militiaTeam')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
      .collect();
    const teamRow = teamRows.find((row) => row.teamId === args.teamId);
    if (!teamRow) {
      throw new ConvexError('Team not found in militia roster');
    }

    const clearPatch = {
      managerSource: undefined,
      managerCharacterId: undefined,
      managerName: undefined,
      managerKind: undefined,
      managerCharisma: undefined,
    };

    let patch:
      | typeof clearPatch
      | {
          managerSource: 'character';
          managerCharacterId: Id<'character'>;
          managerName: undefined;
          managerKind: undefined;
          managerCharisma: undefined;
        }
      | {
          managerSource: 'freeform';
          managerCharacterId: undefined;
          managerName: string;
          managerKind: 'pc' | 'officer_npc' | 'other_npc';
          managerCharisma: number;
        } = clearPatch;

    if (args.managerSource === 'character') {
      if (!args.managerCharacterId) {
        throw new ConvexError('Manager character is required');
      }
      const character = await ctx.db.get('character', args.managerCharacterId);
      if (!character) {
        throw new ConvexError('Character not found');
      }
      if (character.campaignId !== militia.campaignId) {
        throw new ConvexError(
          'Manager character must belong to the same campaign as the militia',
        );
      }
      if (character.isActive === false) {
        throw new ConvexError('Cannot assign an archived character as team manager');
      }

      patch = {
        managerSource: 'character',
        managerCharacterId: args.managerCharacterId,
        managerName: undefined,
        managerKind: undefined,
        managerCharisma: undefined,
      };
    }

    if (args.managerSource === 'freeform') {
      const managerName = args.managerName?.trim();
      if (!managerName) {
        throw new ConvexError('Manager name is required');
      }
      if (!args.managerKind) {
        throw new ConvexError('Manager type is required');
      }
      if (
        args.managerCharisma === undefined ||
        !Number.isFinite(args.managerCharisma)
      ) {
        throw new ConvexError('Manager Charisma is required');
      }

      patch = {
        managerSource: 'freeform',
        managerCharacterId: undefined,
        managerName,
        managerKind: args.managerKind,
        managerCharisma: args.managerCharisma,
      };
    }

    await ctx.db.patch('militiaTeam', teamRow._id, patch);

    const updatedTeamRows = teamRows.map((row) =>
      row._id === teamRow._id ? { ...row, ...patch } : row,
    );
    const characters = (await ctx.db.query('character').collect()).filter(
      (character) => character.campaignId === militia.campaignId,
    );
    const resolvedManagersByTeamId = buildResolvedTeamManagers({
      teams: updatedTeamRows.map((row) => ({
        teamId: row.teamId,
        managerSource: row.managerSource,
        managerCharacterId: row.managerCharacterId,
        managerName: row.managerName,
        managerKind: row.managerKind,
        managerCharisma: row.managerCharisma,
      })),
      characters: characters.map((character) => ({
        _id: character._id,
        name: character.name,
        kind: character.kind,
        charisma: character.charisma,
        isActive: character.isActive,
      })),
    });
    const manager = resolvedManagersByTeamId.get(args.teamId) ?? null;
    const warnings = manager?.warnings.map((message) => ({
      code: 'team_manager_warning',
      message,
    })) ?? [];

    if (warnings.length || args.reason) {
      const createdAt = Date.now();
      for (const warning of warnings) {
        await ctx.db.insert('militiaOverrideNote', {
          militiaId: args.militiaId,
          scope: 'militia',
          fieldPath: `team.${args.teamId}.manager`,
          warningCode: warning.code,
          isIntentionalOverride: true,
          reason: args.reason,
          actorUserId: access.user.tokenIdentifier,
          createdAt,
        });
      }
      if (args.reason && !warnings.length) {
        await ctx.db.insert('militiaOverrideNote', {
          militiaId: args.militiaId,
          scope: 'militia',
          fieldPath: `team.${args.teamId}.manager`,
          warningCode: 'team_manager_override_reason',
          isIntentionalOverride: true,
          reason: args.reason,
          actorUserId: access.user.tokenIdentifier,
          createdAt,
        });
      }
    }

    return { warnings, manager };
  },
});

export const listSettlements = query({
  args: {
    campaignId: v.optional(v.id('campaign')),
    organizationId: v.optional(campaignValidator.fields.organizationId),
  },
  handler: async (ctx, args) => {
    if (!args.campaignId || !args.organizationId) {
      return [];
    }

    const campaignId = args.campaignId;

    const hasAccess = await hasAccessToOrg(ctx, args.organizationId);
    if (!hasAccess) {
      return [];
    }

    const campaign = await ctx.db.get('campaign', campaignId);
    if (campaign?.organizationId !== args.organizationId) {
      return [];
    }

    const militia = await ctx.db
      .query('militia')
      .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
      .first();
    if (!militia) {
      return [];
    }

    const settlements = await ctx.db
      .query('militiaSettlementState')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
      .collect();

    return settlements.sort((a, b) => a.settlementKey.localeCompare(b.settlementKey));
  },
});

export const listMarketplaces = query({
  args: {
    campaignId: v.optional(v.id('campaign')),
    organizationId: v.optional(campaignValidator.fields.organizationId),
  },
  handler: async (ctx, args): Promise<IMarketplaceLedgerState> => {
    if (!args.campaignId || !args.organizationId) {
      return { currentWeek: undefined, marketplaces: [] };
    }

    const campaignId = args.campaignId;

    const hasAccess = await hasAccessToOrg(ctx, args.organizationId);
    if (!hasAccess) {
      return { currentWeek: undefined, marketplaces: [] };
    }

    const campaign = await ctx.db.get('campaign', campaignId);
    if (campaign?.organizationId !== args.organizationId) {
      return { currentWeek: undefined, marketplaces: [] };
    }

    const militia = await ctx.db
      .query('militia')
      .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
      .first();
    if (!militia) {
      return { currentWeek: undefined, marketplaces: [] };
    }

    const [weekState, marketplaces, orders] = await Promise.all([
      ctx.db
        .query('militiaWeekState')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
        .first(),
      ctx.db
        .query('militiaMarketplace')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
        .collect(),
      ctx.db
        .query('militiaOrder')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
        .collect(),
    ]);

    const currentWeek = weekState?.weekNumber;
    const pendingOrderCounts = new Map<string, number>();
    const ordersByMarketplaceId = new Map<string, typeof orders>();
    for (const order of orders) {
      if (!order.marketplaceId) continue;
      const existingOrders = ordersByMarketplaceId.get(order.marketplaceId) ?? [];
      existingOrders.push(order);
      ordersByMarketplaceId.set(order.marketplaceId, existingOrders);
      if (order.status !== 'pending') continue;
      pendingOrderCounts.set(
        order.marketplaceId,
        (pendingOrderCounts.get(order.marketplaceId) ?? 0) + 1,
      );
    }

    return {
      currentWeek,
      marketplaces: marketplaces
        .map((marketplace) => ({
          ...marketplace,
          isActive:
            currentWeek === undefined ? true : marketplace.activeUntilWeek >= currentWeek,
          pendingOrderCount: pendingOrderCounts.get(marketplace._id) ?? 0,
          orders: (ordersByMarketplaceId.get(marketplace._id) ?? [])
            .slice()
            .sort((left, right) => {
              if (left.status !== right.status) {
                return left.status === 'pending' ? -1 : right.status === 'pending' ? 1 : 0;
              }
              if (left.dueWeek !== right.dueWeek) {
                return left.dueWeek - right.dueWeek;
              }
              return left.description.localeCompare(right.description);
            }),
        }))
        .sort((left, right) => {
          if (left.isActive !== right.isActive) {
            return left.isActive ? -1 : 1;
          }
          if (left.activeUntilWeek !== right.activeUntilWeek) {
            return right.activeUntilWeek - left.activeUntilWeek;
          }
          return left.label.localeCompare(right.label);
        }),
    };
  },
});

export const upsertMarketplaceState = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    militiaId: v.id('militia'),
    marketplaceId: v.optional(v.id('militiaMarketplace')),
    label: v.string(),
    sourceAction: marketplaceSourceActionValidator,
    teamId: teamIdValidator,
    availabilityTier: marketplaceAvailabilityTierValidator,
    availabilityThreshold: v.number(),
    saleValuePercent: v.number(),
    contrabandAllowed: v.boolean(),
    createdWeek: v.number(),
    activeUntilWeek: v.number(),
    marketDayDiscountPercent: v.optional(v.number()),
    marketDayAppliedWeek: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const access = await hasAccessToOrg(ctx, args.organizationId);
    if (!access) {
      throw new ConvexError('You do not have access to this org');
    }

    const militia = await ctx.db.get('militia', args.militiaId);
    if (!militia) {
      throw new ConvexError('Militia not found');
    }

    const campaign = await ctx.db.get('campaign', militia.campaignId);
    if (campaign?.organizationId !== args.organizationId) {
      throw new ConvexError('No campaign exists for this organization');
    }

    const label = args.label.trim();
    if (!label) {
      throw new ConvexError('Marketplace label is required');
    }

    const patch = {
      label,
      sourceAction: args.sourceAction,
      teamId: args.teamId,
      availabilityTier: args.availabilityTier,
      availabilityThreshold: args.availabilityThreshold,
      saleValuePercent: args.saleValuePercent,
      contrabandAllowed: args.contrabandAllowed,
      createdWeek: args.createdWeek,
      activeUntilWeek: args.activeUntilWeek,
      marketDayDiscountPercent: args.marketDayDiscountPercent,
      marketDayAppliedWeek: args.marketDayAppliedWeek,
      notes: args.notes?.trim() ? args.notes.trim() : undefined,
    };

    if (args.marketplaceId) {
      const existingMarketplace = await ctx.db.get(
        'militiaMarketplace',
        args.marketplaceId,
      );
      if (existingMarketplace?.militiaId !== args.militiaId) {
        throw new ConvexError('Marketplace not found');
      }

      await ctx.db.patch('militiaMarketplace', args.marketplaceId, patch);
      return await ctx.db.get('militiaMarketplace', args.marketplaceId);
    }

    const marketplaceId = await ctx.db.insert('militiaMarketplace', {
      militiaId: args.militiaId,
      ...patch,
    });

    return await ctx.db.get('militiaMarketplace', marketplaceId);
  },
});

export const deleteMarketplaceState = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    militiaId: v.id('militia'),
    marketplaceId: v.id('militiaMarketplace'),
  },
  async handler(ctx, args) {
    await assertMilitiaMutationAccess(ctx, {
      organizationId: args.organizationId,
      militiaId: args.militiaId,
    });

    const marketplace = await ctx.db.get('militiaMarketplace', args.marketplaceId);
    if (marketplace?.militiaId !== args.militiaId) {
      throw new ConvexError('Marketplace not found');
    }

    await ctx.db.delete('militiaMarketplace', args.marketplaceId);
    return { deleted: true };
  },
});

export const upsertCacheState = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    militiaId: v.id('militia'),
    cacheId: v.optional(v.id('militiaCache')),
    label: v.string(),
    cacheClass: cacheClassValidator,
    location: v.string(),
    contentsSummary: v.string(),
    status: cacheStatusValidator,
    isSecureLocation: v.boolean(),
    createdWeek: v.number(),
    updatedWeek: v.number(),
    retrievedWeek: v.optional(v.number()),
    lostWeek: v.optional(v.number()),
  },
  async handler(ctx, args) {
    await assertMilitiaMutationAccess(ctx, {
      organizationId: args.organizationId,
      militiaId: args.militiaId,
    });

    const patch = {
      label: args.label.trim(),
      cacheClass: args.cacheClass,
      location: args.location.trim(),
      contentsSummary: args.contentsSummary.trim(),
      status: args.status,
      isSecureLocation: args.isSecureLocation,
      createdWeek: args.createdWeek,
      updatedWeek: args.updatedWeek,
      retrievedWeek: args.retrievedWeek,
      lostWeek: args.lostWeek,
    };

    if (!patch.label) {
      throw new ConvexError('Cache label is required');
    }
    if (!patch.location) {
      throw new ConvexError('Cache location is required');
    }
    if (!patch.contentsSummary) {
      throw new ConvexError('Cache contents are required');
    }

    if (args.cacheId) {
      const existing = await ctx.db.get('militiaCache', args.cacheId);
      if (existing?.militiaId !== args.militiaId) {
        throw new ConvexError('Cache not found');
      }
      await ctx.db.patch('militiaCache', args.cacheId, patch);
      return await ctx.db.get('militiaCache', args.cacheId);
    }

    const cacheId = await ctx.db.insert('militiaCache', {
      militiaId: args.militiaId,
      ...patch,
    });
    return await ctx.db.get('militiaCache', cacheId);
  },
});

export const deleteCacheState = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    militiaId: v.id('militia'),
    cacheId: v.id('militiaCache'),
  },
  async handler(ctx, args) {
    await assertMilitiaMutationAccess(ctx, {
      organizationId: args.organizationId,
      militiaId: args.militiaId,
    });

    const cache = await ctx.db.get('militiaCache', args.cacheId);
    if (cache?.militiaId !== args.militiaId) {
      throw new ConvexError('Cache not found');
    }
    await ctx.db.delete('militiaCache', args.cacheId);
    return { deleted: true };
  },
});

export const upsertOrderState = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    militiaId: v.id('militia'),
    orderId: v.optional(v.id('militiaOrder')),
    description: v.string(),
    notes: v.optional(v.string()),
    costPaid: v.optional(v.number()),
    deliveryDays: v.number(),
    orderedWeek: v.number(),
    dueWeek: v.number(),
    status: orderStatusValidator,
    deliveredWeek: v.optional(v.number()),
    sourceAction: v.optional(orderSourceActionValidator),
    marketplaceId: v.optional(v.id('militiaMarketplace')),
  },
  async handler(ctx, args) {
    await assertMilitiaMutationAccess(ctx, {
      organizationId: args.organizationId,
      militiaId: args.militiaId,
    });

    if (args.marketplaceId) {
      const marketplace = await ctx.db.get('militiaMarketplace', args.marketplaceId);
      if (marketplace?.militiaId !== args.militiaId) {
        throw new ConvexError('Linked marketplace not found');
      }
    }

    const patch = {
      description: args.description.trim(),
      notes: args.notes?.trim() ? args.notes.trim() : undefined,
      costPaid: args.costPaid,
      deliveryDays: args.deliveryDays,
      orderedWeek: args.orderedWeek,
      dueWeek: args.dueWeek,
      status: args.status,
      deliveredWeek: args.deliveredWeek,
      sourceAction: args.sourceAction,
      marketplaceId: args.marketplaceId,
    };

    if (!patch.description) {
      throw new ConvexError('Order description is required');
    }

    if (args.orderId) {
      const existing = await ctx.db.get('militiaOrder', args.orderId);
      if (existing?.militiaId !== args.militiaId) {
        throw new ConvexError('Order not found');
      }
      await ctx.db.patch('militiaOrder', args.orderId, patch);
      return await ctx.db.get('militiaOrder', args.orderId);
    }

    const orderId = await ctx.db.insert('militiaOrder', {
      militiaId: args.militiaId,
      ...patch,
    });
    return await ctx.db.get('militiaOrder', orderId);
  },
});

export const deleteOrderState = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    militiaId: v.id('militia'),
    orderId: v.id('militiaOrder'),
  },
  async handler(ctx, args) {
    await assertMilitiaMutationAccess(ctx, {
      organizationId: args.organizationId,
      militiaId: args.militiaId,
    });

    const order = await ctx.db.get('militiaOrder', args.orderId);
    if (order?.militiaId !== args.militiaId) {
      throw new ConvexError('Order not found');
    }
    await ctx.db.delete('militiaOrder', args.orderId);
    return { deleted: true };
  },
});

export const upsertTrackedPersonState = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    militiaId: v.id('militia'),
    trackedPersonId: v.optional(v.id('militiaCharacterStatus')),
    characterId: v.optional(v.id('character')),
    displayName: v.string(),
    personKind: trackedPersonKindValidator,
    status: trackedPersonStatusValidator,
    level: v.optional(v.number()),
    locationType: trackedPersonLocationValidator,
    settlementKey: v.optional(v.string()),
    siteName: v.optional(v.string()),
    notes: v.optional(v.string()),
    activeUntilWeek: v.optional(v.number()),
    hiddenSinceWeek: v.optional(v.number()),
    capturedSinceWeek: v.optional(v.number()),
    rescuedWeek: v.optional(v.number()),
    restoredWeek: v.optional(v.number()),
    rescueDcOverride: v.optional(v.number()),
    sourceAction: v.optional(trackedPersonSourceActionValidator),
  },
  async handler(ctx, args) {
    const { militia } = await assertMilitiaMutationAccess(ctx, {
      organizationId: args.organizationId,
      militiaId: args.militiaId,
    });

    let fallbackDisplayName: string | undefined;
    if (args.characterId) {
      const character = await ctx.db.get('character', args.characterId);
      if (!character) {
        throw new ConvexError('Character not found');
      }
      if (character.campaignId !== militia.campaignId) {
        throw new ConvexError('Character must belong to the same campaign as the militia');
      }
      fallbackDisplayName = character.name.trim();
    }

    const displayName = args.displayName.trim() || (fallbackDisplayName ?? '');
    if (!displayName) {
      throw new ConvexError('Tracked person name is required');
    }

    const patch = {
      characterId: args.characterId,
      displayName,
      personKind: args.personKind,
      status: args.status,
      level: args.level,
      locationType: args.locationType,
      settlementKey: args.settlementKey?.trim() ? args.settlementKey.trim() : undefined,
      siteName: args.siteName?.trim() ? args.siteName.trim() : undefined,
      notes: args.notes?.trim() ? args.notes.trim() : undefined,
      activeUntilWeek: args.activeUntilWeek,
      hiddenSinceWeek: args.hiddenSinceWeek,
      capturedSinceWeek: args.capturedSinceWeek,
      rescuedWeek: args.rescuedWeek,
      restoredWeek: args.restoredWeek,
      rescueDcOverride: args.rescueDcOverride,
      sourceAction: args.sourceAction ?? 'manual',
    };

    if (args.trackedPersonId) {
      const existing = await ctx.db.get('militiaCharacterStatus', args.trackedPersonId);
      if (existing?.militiaId !== args.militiaId) {
        throw new ConvexError('Tracked person not found');
      }
      await ctx.db.patch('militiaCharacterStatus', args.trackedPersonId, patch);
      return await ctx.db.get('militiaCharacterStatus', args.trackedPersonId);
    }

    const trackedPersonId = await ctx.db.insert('militiaCharacterStatus', {
      militiaId: args.militiaId,
      ...patch,
    });
    return await ctx.db.get('militiaCharacterStatus', trackedPersonId);
  },
});

export const deleteTrackedPersonState = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    militiaId: v.id('militia'),
    trackedPersonId: v.id('militiaCharacterStatus'),
  },
  async handler(ctx, args) {
    await assertMilitiaMutationAccess(ctx, {
      organizationId: args.organizationId,
      militiaId: args.militiaId,
    });

    const person = await ctx.db.get('militiaCharacterStatus', args.trackedPersonId);
    if (person?.militiaId !== args.militiaId) {
      throw new ConvexError('Tracked person not found');
    }
    await ctx.db.delete('militiaCharacterStatus', args.trackedPersonId);
    return { deleted: true };
  },
});

export const upsertEventState = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    militiaId: v.id('militia'),
    eventStateId: v.optional(v.id('militiaEventState')),
    weekNumber: v.number(),
    eventType: eventTypeValidator,
    isPersistent: v.boolean(),
    startedWeek: v.number(),
    endedWeek: v.optional(v.number()),
    mitigationUntilWeek: v.optional(v.number()),
    resolved: v.boolean(),
  },
  async handler(ctx, args) {
    await assertMilitiaMutationAccess(ctx, {
      organizationId: args.organizationId,
      militiaId: args.militiaId,
    });

    const patch = {
      weekNumber: args.weekNumber,
      eventType: args.eventType,
      isPersistent: args.isPersistent,
      startedWeek: args.startedWeek,
      endedWeek: args.endedWeek,
      mitigationUntilWeek: args.mitigationUntilWeek,
      resolved: args.resolved,
    };

    if (args.eventStateId) {
      const existing = await ctx.db.get('militiaEventState', args.eventStateId);
      if (existing?.militiaId !== args.militiaId) {
        throw new ConvexError('Event state not found');
      }
      await ctx.db.patch('militiaEventState', args.eventStateId, patch);
      return await ctx.db.get('militiaEventState', args.eventStateId);
    }

    const eventStateId = await ctx.db.insert('militiaEventState', {
      militiaId: args.militiaId,
      ...patch,
    });
    return await ctx.db.get('militiaEventState', eventStateId);
  },
});

export const deleteEventState = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    militiaId: v.id('militia'),
    eventStateId: v.id('militiaEventState'),
  },
  async handler(ctx, args) {
    await assertMilitiaMutationAccess(ctx, {
      organizationId: args.organizationId,
      militiaId: args.militiaId,
    });

    const eventState = await ctx.db.get('militiaEventState', args.eventStateId);
    if (eventState?.militiaId !== args.militiaId) {
      throw new ConvexError('Event state not found');
    }
    await ctx.db.delete('militiaEventState', args.eventStateId);
    return { deleted: true };
  },
});

export const createMilitia = mutation({
  args: {
    militia: militiaValidator,
    organizationId: campaignValidator.fields.organizationId,
  },
  async handler(ctx, args) {
    const userHasAccessObject = await hasAccessToOrg(ctx, args.organizationId);

    if (!userHasAccessObject) {
      throw new ConvexError('You do not have access to this org');
    }

    const campaign = await ctx.db.get('campaign', args.militia.campaignId);
    if (campaign?.organizationId !== args.organizationId) {
      throw new ConvexError('No campaign exists for this organization');
    }

    const militiaResult = await ctx.db
      .query('militia')
      .withIndex('by_campaign', (q) => q.eq('campaignId', campaign._id))
      .first();
    if (militiaResult) {
      throw new ConvexError('This campaign already has a militia');
    }

    await ctx.db.insert('militia', args.militia);
  },
});

export const updateMilitiaCoreState = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    militiaId: v.id('militia'),
    name: v.string(),
    rank: v.number(),
    highestBoonReached: v.number(),
    HQLocation: v.string(),
    treasury: v.number(),
    notoriety: v.number(),
    focus: v.union(v.null(), v.literal('Secrecy'), v.literal('Loyalty'), v.literal('Security')),
    training: v.number(),
  },
  async handler(ctx, args) {
    await assertMilitiaMutationAccess(ctx, {
      organizationId: args.organizationId,
      militiaId: args.militiaId,
    });

    const name = args.name.trim();
    const HQLocation = args.HQLocation.trim();
    if (!name) {
      throw new ConvexError('Militia name is required');
    }
    if (!HQLocation) {
      throw new ConvexError('HQ location is required');
    }

    await ctx.db.patch('militia', args.militiaId, {
      name,
      rank: args.rank,
      highestBoonReached: args.highestBoonReached,
      HQLocation,
      treasury: args.treasury,
      notoriety: args.notoriety,
      focus: args.focus,
      training: args.training,
    });

    return await ctx.db.get('militia', args.militiaId);
  },
});

export const upsertWeekContextState = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    militiaId: v.id('militia'),
    weekNumber: v.number(),
    phase: phaseValidator,
    isFirstWeek: v.boolean(),
    skippedUpkeepThisWeek: v.boolean(),
    uneventfulBonusCarry: v.number(),
    lastPersistentBuyoffWeek: v.optional(v.number()),
    queuedEffects: v.array(queueEffectValidator),
  },
  async handler(ctx, args) {
    const { militia } = await assertMilitiaMutationAccess(ctx, {
      organizationId: args.organizationId,
      militiaId: args.militiaId,
    });

    const existing = await ctx.db
      .query('militiaWeekState')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
      .first();

    if (!existing) {
      const defaultState = getDefaultWeekContext({
        militiaId: args.militiaId,
        rank: militia.rank,
        strategistAssigned: Boolean(militia.strategist),
      });
      const insertedId = await ctx.db.insert('militiaWeekState', {
        ...defaultState,
        weekNumber: args.weekNumber,
        phase: args.phase,
        isFirstWeek: args.isFirstWeek,
        skippedUpkeepThisWeek: args.skippedUpkeepThisWeek,
        uneventfulBonusCarry: args.uneventfulBonusCarry,
        lastPersistentBuyoffWeek: args.lastPersistentBuyoffWeek,
        queuedEffects: args.queuedEffects,
      });
      return await ctx.db.get('militiaWeekState', insertedId);
    }

    await ctx.db.patch('militiaWeekState', existing._id, {
      weekNumber: args.weekNumber,
      phase: args.phase,
      isFirstWeek: args.isFirstWeek,
      skippedUpkeepThisWeek: args.skippedUpkeepThisWeek,
      uneventfulBonusCarry: args.uneventfulBonusCarry,
      lastPersistentBuyoffWeek: args.lastPersistentBuyoffWeek,
      queuedEffects: args.queuedEffects,
    });

    return await ctx.db.get('militiaWeekState', existing._id);
  },
});

export const upsertMilitiaTeamState = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    militiaId: v.id('militia'),
    teamId: teamIdValidator,
    inRoster: v.boolean(),
    status: teamStatusValidator,
    unavailableUntilWeek: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  async handler(ctx, args) {
    await assertMilitiaMutationAccess(ctx, {
      organizationId: args.organizationId,
      militiaId: args.militiaId,
    });

    const teamRow = await ctx.db
      .query('militiaTeam')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
      .collect()
      .then((rows) => rows.find((row) => row.teamId === args.teamId));
    const teamState = await ctx.db
      .query('militiaTeamState')
      .withIndex('by_militiaId_teamId', (q) =>
        q.eq('militiaId', args.militiaId).eq('teamId', args.teamId),
      )
      .first();

    if (!args.inRoster) {
      if (teamState) {
        await ctx.db.delete('militiaTeamState', teamState._id);
      }
      if (teamRow) {
        await ctx.db.delete('militiaTeam', teamRow._id);
      }
      return { removed: true };
    }

    const nextNotes = args.notes?.trim() ? args.notes.trim() : undefined;

    let teamDocId = teamRow?._id;
    if (!teamRow) {
      teamDocId = await ctx.db.insert('militiaTeam', {
        militiaId: args.militiaId,
        teamId: args.teamId,
      });
    }

    if (teamState) {
      await ctx.db.patch('militiaTeamState', teamState._id, {
        status: args.status,
        unavailableUntilWeek: args.unavailableUntilWeek,
        notes: nextNotes,
      });
    } else {
      await ctx.db.insert('militiaTeamState', {
        militiaId: args.militiaId,
        teamId: args.teamId,
        status: args.status,
        unavailableUntilWeek: args.unavailableUntilWeek,
        notes: nextNotes,
      });
    }

    return {
      removed: false,
      teamId: args.teamId,
      teamDocId,
    };
  },
});

export const upsertSettlementState = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    militiaId: v.id('militia'),
    settlementId: v.optional(v.id('militiaSettlementState')),
    settlementKey: v.string(),
    reputation: reputationValidator,
    isSecured: v.boolean(),
  },
  async handler(ctx, args) {
    const access = await hasAccessToOrg(ctx, args.organizationId);
    if (!access) {
      throw new ConvexError('You do not have access to this org');
    }

    const militia = await ctx.db.get('militia', args.militiaId);
    if (!militia) {
      throw new ConvexError('Militia not found');
    }

    const campaign = await ctx.db.get('campaign', militia.campaignId);
    if (campaign?.organizationId !== args.organizationId) {
      throw new ConvexError('No campaign exists for this organization');
    }

    const settlementKey = args.settlementKey.trim();
    if (!settlementKey) {
      throw new ConvexError('Settlement name is required');
    }

    const existingSettlements = await ctx.db
      .query('militiaSettlementState')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
      .collect();

    const duplicateSettlement = existingSettlements.find(
      (settlement) =>
        settlement._id !== args.settlementId &&
        settlement.settlementKey.trim().toLocaleLowerCase() ===
          settlementKey.toLocaleLowerCase(),
    );
    if (duplicateSettlement) {
      throw new ConvexError('Settlement name already exists for this militia');
    }

    if (args.settlementId) {
      const existingSettlement = await ctx.db.get(
        'militiaSettlementState',
        args.settlementId,
      );
      if (existingSettlement?.militiaId !== args.militiaId) {
        throw new ConvexError('Settlement not found');
      }

      await ctx.db.patch('militiaSettlementState', args.settlementId, {
        settlementKey,
        reputation: args.reputation,
        isSecured: args.isSecured,
      });

      return await ctx.db.get('militiaSettlementState', args.settlementId);
    }

    const settlementId = await ctx.db.insert('militiaSettlementState', {
      militiaId: args.militiaId,
      settlementKey,
      reputation: args.reputation,
      isSecured: args.isSecured,
    });

    return await ctx.db.get('militiaSettlementState', settlementId);
  },
});

export const deleteSettlementState = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    militiaId: v.id('militia'),
    settlementId: v.id('militiaSettlementState'),
  },
  async handler(ctx, args) {
    await assertMilitiaMutationAccess(ctx, {
      organizationId: args.organizationId,
      militiaId: args.militiaId,
    });

    const settlement = await ctx.db.get('militiaSettlementState', args.settlementId);
    if (settlement?.militiaId !== args.militiaId) {
      throw new ConvexError('Settlement not found');
    }

    await ctx.db.delete('militiaSettlementState', args.settlementId);
    return { deleted: true };
  },
});

export const assignOfficerRole = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    militiaId: v.id('militia'),
    role: officerRoleValidator,
    characterId: v.optional(v.id('character')),
    source: v.union(v.literal('direct'), v.literal('action')),
    reason: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const access = await hasAccessToOrg(ctx, args.organizationId);
    if (!access) {
      throw new ConvexError('You do not have access to this org');
    }

    const militia = await ctx.db.get('militia', args.militiaId);
    if (!militia) {
      throw new ConvexError('Militia not found');
    }

    const campaign = await ctx.db.get('campaign', militia.campaignId);
    if (campaign?.organizationId !== args.organizationId) {
      throw new ConvexError('No campaign exists for this organization');
    }

    let characterKind: 'pc' | 'officer_npc' | undefined;
    if (args.characterId) {
      const character = await ctx.db.get('character', args.characterId);
      if (!character) {
        throw new ConvexError('Character not found');
      }
      if (character.campaignId !== militia.campaignId) {
        throw new ConvexError(
          'Character must belong to the same campaign as the militia',
        );
      }
      if (character.isActive === false) {
        throw new ConvexError(
          'Cannot assign an archived character to an officer role',
        );
      }
      characterKind = character.kind;
    }

    const warnings = getOfficerAssignmentWarnings({
      source: args.source,
      characterKind,
    });

    await ctx.db.patch('militia', args.militiaId, {
      [args.role]: args.characterId,
    } as Partial<{
      ambassador: Id<'character'> | undefined;
      commandant: Id<'character'> | undefined;
      marshal: Id<'character'> | undefined;
      overseer: Id<'character'> | undefined;
      spymaster: Id<'character'> | undefined;
      strategist: Id<'character'> | undefined;
    }>);

    if (warnings.length || args.reason) {
      const createdAt = Date.now();
      for (const warning of warnings) {
        await ctx.db.insert('militiaOverrideNote', {
          militiaId: args.militiaId,
          scope: 'militia',
          fieldPath: `officer.${args.role}`,
          warningCode: warning.code,
          isIntentionalOverride: args.source === 'direct',
          reason: args.reason,
          actorUserId: access.user.tokenIdentifier,
          createdAt,
        });
      }
    }

    return { warnings };
  },
});
