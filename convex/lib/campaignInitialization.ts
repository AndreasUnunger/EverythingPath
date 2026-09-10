import type { CampaignContext } from '../../src/lib/canonical-campaign-context';
import { z } from 'zod';
import { ConvexError } from 'convex/values';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { requireScope, openDraft } from './canonicalDraftStorage';
import { readRoster } from './canonicalRoster';
import { readCampaignContext } from './canonicalCampaignContext';
import { createWeeklyDraft } from '../../src/lib/weekly-draft';
import { weekStartFactsSchema } from '../../src/lib/weekly-draft-contract';
import { OFFICER_ROLES } from '../../src/lib/canonical-roster';

type Scope = { campaignId: Id<'campaign'>; militiaId: Id<'militia'> };
type ReadCtx = QueryCtx | MutationCtx;

// No registered function or live caller. The later paused-cutover runner owns
// deployment gating; these functions are exercised only in isolated transactions.
export async function preflightCampaignInitialization(
  ctx: ReadCtx,
  scope: Scope,
) {
  await requireScope(ctx, scope, true);
  const source = await readInitializationSource(ctx, scope);
  const { militia, week } = source;
  const roster = await readRoster(ctx, scope);
  const prepared = await readCampaignContext(ctx, scope);
  const issues: string[] = [];
  const preserve = preservationCheck(issues);
  if (!week) issues.push('Resolve missing current week context.');
  if (week?.phase === 'week_closed')
    issues.push('Resolve the current open week before initialization.');
  if (!roster)
    issues.push(
      'Prepare the campaign roster, including Commandant Hit Dice and individual team conditions.',
    );
  if (!prepared)
    issues.push(
      'Prepare campaign context, including first-use facts, event targets/order and delivery context.',
    );
  if (roster) validateRosterPreservation(source, roster, issues);
  let facts: z.infer<typeof weekStartFactsSchema> | null = null;
  if (prepared) {
    const context = prepared.context;
    preserve(
      context.treasuryCopper,
      Math.round(militia.treasury * 100),
      'authoritative treasury to copper precision',
    );
    if (week) {
      preserve(context.firstMilitiaWeek, week.isFirstWeek, 'first-use context');
      preserve(
        context.uneventfulCarry,
        week.uneventfulBonusCarry !== 0,
        'uneventful carry',
      );
      preserve(
        context.lastBuyoffWeek,
        week.lastPersistentBuyoffWeek ?? null,
        'buyoff bookkeeping',
      );
      validateQueues(week, context, issues);
    }
    validateSettlements(source, context, issues);
    validateEvents(source, context, issues);
    validateOrders(source, context, issues);
    validateCaches(source, context, issues);
    const parsed = weekStartFactsSchema.safeParse({
      firstMilitiaWeek: context.firstMilitiaWeek,
      startDay: context.startDay,
      uneventfulCarry: context.uneventfulCarry,
      lastBuyoffWeek: context.lastBuyoffWeek,
      carriedEvents: recoverCarriedEvents(context, week?.weekNumber, issues),
      queuedEffects: context.queuedEffects,
      orders: context.orders.map((o) => ({
        orderId: o.orderId,
        itemId: o.itemId,
        settlementId: o.settlementId,
        orderedDay: o.orderedDay,
        dueDay: o.dueDay,
        priceCopper: o.priceCopper,
        receipt: o.receipt,
      })),
    });
    if (parsed.success) facts = parsed.data;
    else
      issues.push(
        ...parsed.error.issues.map(
          (i) => `Resolve week-start ${i.path.join('.')}: ${i.message}`,
        ),
      );
  }
  // Exact reviewed source token: includes authoritative facts and preparation
  // revisions, excludes discarded choices/history. Not a security credential.
  const sourceToken = JSON.stringify({
    source,
    roster: roster && { roster: roster.roster, revision: roster.revision },
    prepared: prepared && {
      context: prepared.context,
      revision: prepared.revision,
    },
  });
  if (new TextEncoder().encode(sourceToken).length > 750_000)
    issues.push(
      'Initialization source exceeds receipt size limit; prepare a paginated cutover',
    );
  return {
    recovered: {
      week: week?.weekNumber ?? null,
      firstMilitiaWeek: week?.isFirstWeek ?? null,
      uneventfulCarry: week ? week.uneventfulBonusCarry !== 0 : null,
      lastBuyoffWeek: week?.lastPersistentBuyoffWeek ?? null,
      treasuryCopper: Math.round(militia.treasury * 100),
    },
    source,
    roster,
    prepared,
    facts,
    issues,
    ready: issues.length === 0,
    sourceToken,
  };
}

export async function initializeCampaign(
  ctx: MutationCtx,
  input: Scope & { sourceToken: string; initializationId: string },
) {
  await requireScope(ctx, input, true);
  const initializationId = z
    .string()
    .trim()
    .min(1)
    .max(200)
    .parse(input.initializationId);
  const receipt = await ctx.db
    .query('canonicalCampaignInitialization')
    .withIndex('by_militiaId', (q) => q.eq('militiaId', input.militiaId))
    .unique();
  if (receipt) {
    if (
      receipt.campaignId !== input.campaignId ||
      receipt.initializationId !== initializationId ||
      receipt.sourceToken !== input.sourceToken
    )
      throw new ConvexError(
        'Initialization already completed with a different source or identity',
      );
    return { draftId: receipt.draftId, initialized: false };
  }
  const history = await ctx.db
    .query('canonicalResolutionRecord')
    .withIndex('by_campaignId_and_week_and_sequence', (q) =>
      q.eq('campaignId', input.campaignId),
    )
    .first();
  if (history) throw new ConvexError('Campaign already has canonical history');
  const plan = await preflightCampaignInitialization(ctx, input);
  if (plan.sourceToken !== input.sourceToken)
    throw new ConvexError('Initialization source changed; repeat preflight');
  if (!plan.ready || !plan.facts || !plan.source.week)
    throw new ConvexError(plan.issues.join('\n'));
  const existingDraft = await ctx.db
    .query('canonicalWeeklyDraft')
    .withIndex('by_campaignId_and_status', (q) =>
      q.eq('campaignId', input.campaignId),
    )
    .first();
  if (existingDraft)
    throw new ConvexError('Campaign already has canonical drafts');
  const draftId = `initialization:${initializationId}`;
  const priorOperation = await ctx.db
    .query('canonicalDraftOperation')
    .withIndex('by_draftId_and_operationId', (q) => q.eq('draftId', draftId))
    .first();
  if (priorOperation)
    throw new ConvexError(
      'Initialization draft identity already has operations',
    );
  await openDraft(ctx, {
    campaignId: input.campaignId,
    militiaId: input.militiaId,
    draft: createWeeklyDraft({
      draftId,
      week: plan.source.week.weekNumber,
      context: plan.facts,
      slotIds: [],
    }),
  });
  await ctx.db.insert('canonicalCampaignInitialization', {
    campaignId: input.campaignId,
    militiaId: input.militiaId,
    initializationId,
    draftId,
    sourceToken: input.sourceToken,
  });
  return { draftId, initialized: true };
}

async function readInitializationSource(ctx: ReadCtx, scope: Scope) {
  const militia = await ctx.db.get('militia', scope.militiaId);
  if (!militia) throw new ConvexError('Militia not found');
  const weeks = await ctx.db
    .query('militiaWeekState')
    .withIndex('by_militiaId_week', (q) => q.eq('militiaId', scope.militiaId))
    .order('desc')
    .take(1);
  const week = weeks[0];
  // Explicit bounds fail closed rather than silently truncate a preservation set.
  const source = {
    militia,
    week: week
      ? {
          id: week._id,
          weekNumber: week.weekNumber,
          phase: week.phase,
          isFirstWeek: week.isFirstWeek,
          skippedUpkeepThisWeek: week.skippedUpkeepThisWeek,
          upkeepTreasurySnapshot: week.upkeepTreasurySnapshot ?? null,
          uneventfulBonusCarry: week.uneventfulBonusCarry,
          queuedEffects: week.queuedEffects,
          lastPersistentBuyoffWeek: week.lastPersistentBuyoffWeek ?? null,
        }
      : null,
    characters: await ctx.db
      .query('character')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', scope.campaignId))
      .take(257),
    teams: await ctx.db
      .query('militiaTeam')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', scope.militiaId))
      .take(257),
    conditions: await ctx.db
      .query('militiaTeamState')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', scope.militiaId))
      .take(257),
    settlements: await ctx.db
      .query('militiaSettlementState')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', scope.militiaId))
      .take(257),
    events: await ctx.db
      .query('militiaEventState')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', scope.militiaId))
      .take(257),
    orders: await ctx.db
      .query('militiaOrder')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', scope.militiaId))
      .take(257),
    caches: await ctx.db
      .query('militiaCache')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', scope.militiaId))
      .take(257),
    marketplaces: await ctx.db
      .query('militiaMarketplace')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', scope.militiaId))
      .take(257),
    people: await ctx.db
      .query('militiaCharacterStatus')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', scope.militiaId))
      .take(257),
    notes: await ctx.db
      .query('militiaOverrideNote')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', scope.militiaId))
      .take(257),
  };
  for (const value of Object.values(source))
    if (Array.isArray(value) && value.length > 256)
      throw new ConvexError(
        'Initialization exceeds fixture batch limit; prepare a paginated cutover before proceeding',
      );
  return source;
}

type InitializationSource = Awaited<
  ReturnType<typeof readInitializationSource>
>;
type PreparedRoster = NonNullable<Awaited<ReturnType<typeof readRoster>>>;
function validateRosterPreservation(
  source: InitializationSource,
  roster: PreparedRoster,
  issues: string[],
) {
  const { militia } = source;

  for (const character of source.characters)
    if (!roster.roster.people.some((p) => p.characterId === character._id))
      issues.push(`Preserve character ${character._id}.`);
  for (const role of OFFICER_ROLES) {
    const holder = militia[role];
    if (
      holder &&
      !roster.roster.officers.some(
        (o) => o.role === role && o.characterId === holder,
      )
    )
      issues.push(`Preserve ${role} holder ${holder}.`);
  }
  for (const holder of roster.roster.officers.filter(
    (o) => o.role === 'commandant',
  ))
    if (
      roster.roster.people.find((p) => p.characterId === holder.characterId)
        ?.hitDice == null
    )
      issues.push(`Resolve Commandant Hit Dice for ${holder.characterId}.`);
  validateTeamPreservation(source, roster, issues);
}

function validateTeamPreservation(
  source: InitializationSource,
  roster: PreparedRoster,
  issues: string[],
) {
  const preserve = preservationCheck(issues);
  for (const team of source.teams) {
    const mapped = roster.roster.teams.find(
      (t) => t.teamId === `legacy-team:${team._id}`,
    );
    if (!mapped) {
      issues.push(`Preserve individual team ${team._id}.`);
      continue;
    }
    preserve(mapped.teamType, team.teamId, `team type ${team._id}`);
    if (team.managerSource === 'character')
      preserve(
        mapped.managerCharacterId,
        team.managerCharacterId,
        `manager ${team._id}`,
      );
    if (team.managerSource === 'freeform' && !mapped.managerCharacterId)
      issues.push(`Resolve freeform manager ${team._id}.`);
    const conditions = source.conditions.filter(
      (c) => c.teamId === team.teamId,
    );
    if (
      source.teams.filter((t) => t.teamId === team.teamId).length === 1 &&
      conditions.length === 1
    )
      preserve(
        mapped.status,
        conditions[0]?.status,
        `team condition ${team._id}`,
      );
  }
}

function preservationCheck(issues: string[]) {
  return (actual: unknown, expected: unknown, label: string) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected))
      issues.push(`Preserve ${label}.`);
  };
}

function validateSettlements(
  source: InitializationSource,
  context: CampaignContext,
  issues: string[],
) {
  const preserve = preservationCheck(issues);
  for (const settlement of source.settlements) {
    const mapped = context.settlements.find(
      (s) => s.settlementId === settlement.settlementKey,
    );
    if (!mapped) {
      issues.push(`Preserve settlement ${settlement.settlementKey}.`);
      continue;
    }
    preserve(
      mapped.reputation,
      settlement.reputation,
      `reputation ${settlement.settlementKey}`,
    );
    preserve(
      mapped.secured,
      settlement.isSecured,
      `secured settlement ${settlement.settlementKey}`,
    );
    preserve(
      mapped.temporaryReputationShift,
      settlement.temporaryShift ?? null,
      `temporary reputation ${settlement.settlementKey}`,
    );
    preserve(
      mapped.refugeActivatedWeek,
      settlement.refugeActivatedWeek ?? null,
      `refuge activation ${settlement.settlementKey}`,
    );
    preserve(
      mapped.refugeActiveUntilWeek,
      settlement.refugeActiveUntilWeek ?? null,
      `refuge duration ${settlement.settlementKey}`,
    );
  }
}

function validateEvents(
  source: InitializationSource,
  context: CampaignContext,
  issues: string[],
) {
  const preserve = preservationCheck(issues);
  for (const event of source.events) {
    const mapped = context.events.find((e) => e.eventId === event._id);
    if (!mapped) {
      issues.push(
        `Preserve event ${event._id}, resolving targets/order explicitly.`,
      );
      continue;
    }
    preserve(
      [
        mapped.eventType,
        mapped.startedWeek,
        mapped.persistent,
        mapped.resolved,
        mapped.mitigationUntilWeek,
      ],
      [
        event.eventType,
        event.startedWeek,
        event.isPersistent,
        event.resolved,
        event.mitigationUntilWeek ?? null,
      ],
      `event facts ${event._id}`,
    );
    // A missing end date on an already resolved legacy event is an unknown
    // historical fact. Preparation may supply it, but cannot alter a known date
    // or end an event that legacy state still records as unresolved.
    if (event.endedWeek !== undefined || !event.resolved)
      preserve(
        mapped.endedWeek,
        event.endedWeek ?? null,
        `event end week ${event._id}`,
      );
    if (mapped.targets === null || mapped.order === null)
      issues.push(`Resolve event targets/order ${event._id}.`);
  }
}

function validateOrders(
  source: InitializationSource,
  context: CampaignContext,
  issues: string[],
) {
  const preserve = preservationCheck(issues);
  for (const order of source.orders) {
    const mapped = context.orders.find((o) => o.orderId === order._id);
    if (!mapped) {
      issues.push(
        `Preserve order ${order._id}, resolving delivery/receipt context explicitly.`,
      );
      continue;
    }
    preserve(mapped.orderedWeek, order.orderedWeek, `order week ${order._id}`);
    preserve(
      mapped.deliveryDays,
      order.deliveryDays,
      `delivery duration ${order._id}`,
    );
    if (order.costPaid !== undefined)
      preserve(
        mapped.priceCopper,
        Math.round(order.costPaid * 100),
        `order cost ${order._id}`,
      );
    if (order.sourceAction)
      preserve(mapped.source, order.sourceAction, `order source ${order._id}`);
    if (
      mapped.source === 'broker_market' ||
      mapped.source === 'activate_black_market'
    )
      preserve(
        mapped.dueActivityWeek,
        order.dueWeek,
        `delivery Activity week ${order._id}`,
      );
    if (order.status === 'cancelled')
      issues.push(
        `Resolve cancelled order ${order._id}; canonical cancellation support is required.`,
      );
    if (
      (order.status === 'delivered' && mapped.receiptStatus !== 'received') ||
      (order.status === 'pending' && mapped.receiptStatus !== 'unreceived')
    )
      issues.push(`Preserve receipt for ${order._id}.`);
    if (
      mapped.receiptStatus === 'unknown' ||
      mapped.source === null ||
      mapped.expedited === null
    )
      issues.push(`Resolve delivery context ${order._id}.`);
  }
}

function validateCaches(
  source: InitializationSource,
  context: CampaignContext,
  issues: string[],
) {
  const preserve = preservationCheck(issues);
  for (const cache of source.caches) {
    const mapped = context.caches.find((c) => c.cacheId === cache._id);
    preserve(
      mapped && [
        mapped.label,
        mapped.location,
        mapped.contents,
        mapped.cacheClass,
        mapped.status,
        mapped.secure,
      ],
      [
        cache.label,
        cache.location,
        cache.contentsSummary,
        cache.cacheClass,
        cache.status,
        cache.isSecureLocation,
      ],
      `cache ${cache._id}`,
    );
  }
}

function validateQueues(
  week: NonNullable<InitializationSource['week']>,
  context: CampaignContext,
  issues: string[],
) {
  const preserve = preservationCheck(issues);
  for (const [index, effect] of week.queuedEffects.entries()) {
    const key = `legacy-queue:${week.id}:${index}`;
    const matches = context.queuedEffects.filter((q) => q.sourceId === key);
    if (
      !matches.length ||
      matches.some(
        (q) =>
          q.startsWeek !== effect.appliesWeek ||
          q.endsWeek !== effect.appliesWeek,
      )
    )
      issues.push(`Resolve queued effect ${key}: ${JSON.stringify(effect)}.`);
    if (
      effect.kind === 'organization_check_modifier' &&
      ['loyalty', 'security', 'secrecy'].includes(effect.checkType ?? '')
    ) {
      preserve(
        matches.map((q) => q.effect),
        [
          {
            kind: 'check_modifier',
            check: effect.checkType,
            value: effect.modifierTotal,
          },
        ],
        `queued modifier ${key}`,
      );
    } else if (effect.kind === 'activity_action_block') {
      preserve(
        matches.map((q) => q.effect),
        [{ kind: 'block_action', actionId: effect.blockedActionId }],
        `queued action block ${key}`,
      );
    } else {
      issues.push(
        `Resolve unsupported queued effect ${key} (${effect.kind}): extend the canonical effect model before initialization.`,
      );
    }
  }
}

function recoverCarriedEvents(
  context: CampaignContext,
  week: number | undefined,
  issues: string[],
) {
  if (week === undefined) return [];
  return context.events
    .filter((event) => {
      if (!event.persistent) return false;
      if (event.startedWeek === null) {
        issues.push(
          `Resolve week-start timing for event ${event.eventId}: enter its start week.`,
        );
        return false;
      }
      if (event.startedWeek >= week) return false;
      if (event.endedWeek !== null) return event.endedWeek >= week;
      if (event.resolved) {
        issues.push(
          `Resolve week-start timing for event ${event.eventId}: enter when it ended before initialization.`,
        );
        return false;
      }
      return true;
    })
    .map((event) => ({
      eventId: event.eventId,
      eventType: event.eventType,
      startedWeek: event.startedWeek,
      order: event.order,
      targets: event.targets,
    }));
}
