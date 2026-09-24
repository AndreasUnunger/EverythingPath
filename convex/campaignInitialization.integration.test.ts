import { persistDraftOperation } from './lib/canonicalDraftPersistenceAuthority';
import { initializationEdits } from '../tests/rules/initialization-edits';
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test, vi } from 'vitest';
import { z } from 'zod';
import { api, internal } from './_generated/api';
import { deploymentFixture } from '../e2e/support/test-data';
import schema from './schema';
import {
  preflightCampaignInitialization,
  initializeCampaign,
} from './lib/campaignInitialization';
import { saveRoster } from './lib/canonicalRoster';
import { saveCampaignContext } from './lib/canonicalCampaignContext';
import {
  readOpenDraft,
  readDraftMetadata,
  readEffectiveRecord,
  saveDraftRevision,
} from './lib/canonicalDraftStorage';
import { seedInitializationCampaign } from './lib/initializationFixture';
import { previewDraft } from './lib/canonicalConfirmation';
import { editWeeklyDraft } from '../src/lib/weekly-draft';
const modules = import.meta.glob('./**/*.ts');

async function fixture() {
  const t = convexTest(schema, modules);
  const gm = t.withIdentity({ tokenIdentifier: 'test|gm' });
  const data = await gm.run((ctx) => seedInitializationCampaign(ctx));
  return { t, gm, ...data };
}

test('[initialization.preserve] preflight and restart preserve authoritative facts and create one empty week without executing rules', async () => {
  const { t, gm, scope, weekId, historyId, context, roster } = await fixture();
  const oldHistory = await t.run((ctx) =>
    ctx.db.get('militiaResolutionRecord', historyId),
  );
  const oldWeek = await t.run((ctx) => ctx.db.get('militiaWeekState', weekId));
  const before = await gm.run((ctx) =>
    preflightCampaignInitialization(ctx, scope),
  );
  expect(before.issues).toEqual([]);
  expect(oldHistory?.weekNumber).toBe(8);
  expect(before.source.militia).toMatchObject({
    treasury: 123.45,
    training: 42,
    rank: 4,
    notoriety: 17,
  });
  expect(before.prepared?.context).toEqual(context);
  expect(before.roster?.roster).toEqual(roster);
  const args = {
    ...scope,
    sourceToken: before.sourceToken,
    initializationId: 'fixture',
  };
  expect(await gm.run((ctx) => initializeCampaign(ctx, args))).toEqual({
    draftId: 'initialization:fixture',
    initialized: true,
  });
  expect(await gm.run((ctx) => initializeCampaign(ctx, args))).toEqual({
    draftId: 'initialization:fixture',
    initialized: false,
  });
  const draft = await gm.run((ctx) => readOpenDraft(ctx, scope));
  expect(draft).toMatchObject({
    draftId: 'initialization:fixture',
    revision: 0,
    week: 9,
    activity: { slots: [] },
    context: {
      firstMilitiaWeek: false,
      startDay: 56,
      uneventfulCarry: true,
      persistentPhaseEligible: true,
      lastBuyoffWeek: 6,
      queuedEffects: context.queuedEffects,
    },
  });
  expect(draft?.upkeep.rolls).toEqual({});
  expect(
    await t.run((ctx) => ctx.db.get('militiaResolutionRecord', historyId)),
  ).toEqual(oldHistory);
  expect(
    await gm.run((ctx) =>
      readDraftMetadata(ctx, { ...scope, draftId: 'initialization:fixture' }),
    ),
  ).toEqual({ status: 'open', revision: 0 });
  expect(
    await gm.run((ctx) => readEffectiveRecord(ctx, { ...scope, week: 8 })),
  ).toBeNull();
  expect(
    await gm.run((ctx) => preflightCampaignInitialization(ctx, scope)),
  ).toEqual(before);
  expect(await t.run((ctx) => ctx.db.get('militiaWeekState', weekId))).toEqual(
    oldWeek,
  );
});

test('[initialization.preflight] missing facts and altered preserved values block all writes', async () => {
  const { gm, scope, context, roster } = await fixture();
  await gm.run((ctx) =>
    saveRoster(ctx, {
      ...scope,
      expectedRevision: 0,
      roster: {
        ...roster,
        people: roster.people.map((p) => ({ ...p, hitDice: null })),
      },
    }),
  );
  await gm.run((ctx) =>
    saveCampaignContext(ctx, {
      ...scope,
      expectedRevision: 0,
      context: {
        ...context,
        firstMilitiaWeek: null,
        startDay: null,
        treasuryCopper: 999,
        events: context.events.map((e) => ({
          ...e,
          targets: null,
          order: null,
        })),
        orders: context.orders.map((o) => ({
          ...o,
          dueDay: null,
          receiptStatus: 'unknown',
        })),
      },
    }),
  );
  const plan = await gm.run((ctx) =>
    preflightCampaignInitialization(ctx, scope),
  );
  expect(plan.ready).toBe(false);
  for (const text of [
    'Hit Dice',
    'first-use',
    'treasury',
    'targets/order',
    'delivery context',
    'startDay',
  ])
    expect(plan.issues.join('\n')).toContain(text);
  await expect(
    gm.run((ctx) =>
      initializeCampaign(ctx, {
        ...scope,
        sourceToken: plan.sourceToken,
        initializationId: 'blocked',
      }),
    ),
  ).rejects.toThrow();
  expect(await gm.run((ctx) => readOpenDraft(ctx, scope))).toBeNull();
});

test('[initialization.stale] source changes and unauthorized callers cannot initialize', async () => {
  const { t, gm, scope } = await fixture();
  const plan = await gm.run((ctx) =>
    preflightCampaignInitialization(ctx, scope),
  );
  const args = {
    ...scope,
    sourceToken: plan.sourceToken,
    initializationId: 'stale',
  };
  await t.run((ctx) =>
    ctx.db.patch('militia', scope.militiaId, { treasury: 0 }),
  );
  await expect(gm.run((ctx) => initializeCampaign(ctx, args))).rejects.toThrow(
    'source changed',
  );
  await expect(
    t
      .withIdentity({ tokenIdentifier: 'test|player' })
      .run((ctx) => initializeCampaign(ctx, args)),
  ).rejects.toThrow('source changed');
  await expect(
    t
      .withIdentity({ tokenIdentifier: 'test|outsider' })
      .run((ctx) => initializeCampaign(ctx, args)),
  ).rejects.toThrow('access required');
  expect(await gm.run((ctx) => readOpenDraft(ctx, scope))).toBeNull();
});

test('[initialization.retry] delayed retries preserve subsequent edits and refuse a new initialization identity', async () => {
  const { gm, scope } = await fixture();
  const plan = await gm.run((ctx) =>
    preflightCampaignInitialization(ctx, scope),
  );
  const args = {
    ...scope,
    sourceToken: plan.sourceToken,
    initializationId: 'retry',
  };
  await gm.run((ctx) => initializeCampaign(ctx, args));
  const draft = await gm.run((ctx) => readOpenDraft(ctx, scope));
  if (!draft) throw new Error('Missing draft');
  const edit = {
    kind: 'event_chance' as const,
    roll: {
      dice: [0],
      sides: 100,
      provenance: { kind: 'table' as const },
      modifiers: [],
    },
  };
  // Exercise a real semantic edit with the storage seam's deduplication ledger.
  const changed = editWeeklyDraft(draft, edit);
  expect(changed.ok).toBe(true);
  if (!changed.ok) throw new Error(changed.error);
  await gm.run((ctx) =>
    saveDraftRevision(ctx, {
      ...scope,
      draftId: draft.draftId,
      operationId: 'edit',
      baseRevision: 0,
      expectedRevision: 0,
      targets: ['upkeep'],
      edit,
      draft: changed.draft,
    }),
  );
  await gm.run((ctx) => initializeCampaign(ctx, args));
  expect(await gm.run((ctx) => readOpenDraft(ctx, scope))).toEqual(
    changed.draft,
  );
  await expect(
    gm.run((ctx) =>
      initializeCampaign(ctx, { ...args, initializationId: 'another' }),
    ),
  ).rejects.toThrow('already completed');
});

test('[initialization.queues] mapped queues cannot change preserved arithmetic', async () => {
  const { gm, scope, context } = await fixture();
  await gm.run((ctx) =>
    saveCampaignContext(ctx, {
      ...scope,
      expectedRevision: 0,
      context: {
        ...context,
        queuedEffects: context.queuedEffects.map((q) => ({
          ...q,
          effect: { ...q.effect, value: 99 },
        })),
      },
    }),
  );
  const plan = await gm.run((ctx) =>
    preflightCampaignInitialization(ctx, scope),
  );
  expect(plan.issues.join('\n')).toContain('queued modifier');
  await expect(
    gm.run((ctx) =>
      initializeCampaign(ctx, {
        ...scope,
        initializationId: 'bad-queue',
        sourceToken: plan.sourceToken,
      }),
    ),
  ).rejects.toThrow('queued modifier');
  expect(await gm.run((ctx) => readOpenDraft(ctx, scope))).toBeNull();
});

test('[initialization.first-use] displayed week does not replace first-use facts and repeated events keep independent targets and order', async () => {
  const { t, gm, scope, context, weekId, characterId } = await fixture();
  const eventId = await t.run(async (ctx) => {
    await ctx.db.patch('militiaWeekState', weekId, {
      isFirstWeek: true,
      skippedUpkeepThisWeek: true,
      uneventfulBonusCarry: 0,
    });
    return ctx.db.insert('militiaEventState', {
      militiaId: scope.militiaId,
      weekNumber: 8,
      startedWeek: 8,
      eventType: 'sickness',
      isPersistent: true,
      resolved: false,
    });
  });
  await gm.run((ctx) =>
    saveCampaignContext(ctx, {
      ...scope,
      expectedRevision: 0,
      context: {
        ...context,
        firstMilitiaWeek: true,
        uneventfulCarry: false,
        events: [
          ...context.events,
          {
            eventId,
            eventType: 'sickness',
            startedWeek: 8,
            order: 1,
            targets: [{ kind: 'character', characterId }],
            persistent: true,
            resolved: false,
            mitigationUntilWeek: null,
            endedWeek: null,
            notes: '',
          },
        ],
      },
    }),
  );
  const plan = await gm.run((ctx) =>
    preflightCampaignInitialization(ctx, scope),
  );
  expect(plan.issues).toEqual([]);
  await gm.run((ctx) =>
    initializeCampaign(ctx, {
      ...scope,
      initializationId: 'first-use',
      sourceToken: plan.sourceToken,
    }),
  );
  const draft = await gm.run((ctx) => readOpenDraft(ctx, scope));
  expect(draft?.week).toBe(9);
  expect(draft?.context.firstMilitiaWeek).toBe(true);
  expect(draft?.context.uneventfulCarry).toBe(false);
  expect(draft?.context.carriedEvents).toHaveLength(2);
  expect(draft?.context.carriedEvents[1]).toEqual({
    eventId,
    eventType: 'sickness',
    startedWeek: 8,
    order: 1,
    targets: [{ kind: 'character', characterId }],
  });
});

test('[initialization.expiry] initialization refuses extended queue duration', async () => {
  const { gm, scope, context } = await fixture();
  await gm.run((ctx) =>
    saveCampaignContext(ctx, {
      ...scope,
      expectedRevision: 0,
      context: {
        ...context,
        queuedEffects: context.queuedEffects.map((q) => ({
          ...q,
          endsWeek: 999,
        })),
      },
    }),
  );
  const plan = await gm.run((ctx) =>
    preflightCampaignInitialization(ctx, scope),
  );
  expect(plan.issues.join('\n')).toContain('Resolve queued effect');
  await expect(
    gm.run((ctx) =>
      initializeCampaign(ctx, {
        ...scope,
        sourceToken: plan.sourceToken,
        initializationId: 'expiry',
      }),
    ),
  ).rejects.toThrow('Resolve queued effect');
});

test('[initialization.unsupported-queue] automatic effects cannot be replaced with narrative notes', async () => {
  const { t, gm, scope, context, weekId } = await fixture();
  const effect = {
    kind: 'double_next_activity_training_gain' as const,
    appliesWeek: 10,
  };
  await t.run((ctx) =>
    ctx.db.patch('militiaWeekState', weekId, { queuedEffects: [effect] }),
  );
  await gm.run((ctx) =>
    saveCampaignContext(ctx, {
      ...scope,
      expectedRevision: 0,
      context: {
        ...context,
        queuedEffects: context.queuedEffects.map((q) => ({
          ...q,
          effect: { kind: 'narrative', instruction: JSON.stringify(effect) },
        })),
      },
    }),
  );
  const plan = await gm.run((ctx) =>
    preflightCampaignInitialization(ctx, scope),
  );
  expect(plan.issues.join('\n')).toContain('unsupported queued effect');
  await expect(
    gm.run((ctx) =>
      initializeCampaign(ctx, {
        ...scope,
        sourceToken: plan.sourceToken,
        initializationId: 'unsupported',
      }),
    ),
  ).rejects.toThrow('unsupported queued effect');
  expect(await gm.run((ctx) => readOpenDraft(ctx, scope))).toBeNull();
});

test('cutover preserves Week of Pain penalties and double losses without executing them', async () => {
  const { t, gm, scope, context, weekId } = await fixture();
  await t.run((ctx) =>
    ctx.db.patch('militiaWeekState', weekId, {
      queuedEffects: [
        { kind: 'week_of_pain_checks_penalty', appliesWeek: 9 },
        { kind: 'double_upkeep_attrition', appliesWeek: 9 },
      ],
    }),
  );
  const queuedEffects = [
    ...(['loyalty', 'security', 'secrecy'] as const).map((check) => ({
      effectId: `pain-${check}`,
      sourceId: `legacy-queue:${weekId}:0`,
      startsWeek: 9,
      endsWeek: 9,
      effect: { kind: 'check_modifier' as const, check, value: -1 },
    })),
    {
      effectId: 'double-loss',
      sourceId: `legacy-queue:${weekId}:1`,
      startsWeek: 9,
      endsWeek: 9,
      effect: { kind: 'upkeep_loss_multiplier' as const, value: 2 },
    },
  ];
  await gm.run((ctx) =>
    saveCampaignContext(ctx, {
      ...scope,
      expectedRevision: 0,
      context: { ...context, queuedEffects },
    }),
  );
  const plan = await gm.run((ctx) =>
    preflightCampaignInitialization(ctx, scope),
  );
  expect(plan.issues).toEqual([]);
  await gm.run((ctx) =>
    initializeCampaign(ctx, {
      ...scope,
      sourceToken: plan.sourceToken,
      initializationId: 'pain',
    }),
  );
  expect(
    (await gm.run((ctx) => readOpenDraft(ctx, scope)))?.context.queuedEffects,
  ).toEqual(queuedEffects);
  expect(
    (await gm.run((ctx) => preflightCampaignInitialization(ctx, scope))).source
      .militia.treasury,
  ).toBe(123.45);
});

test('cutover requires a faithful marketplace mapping and preserves its expiry and prices', async () => {
  const { t, gm, scope, context } = await fixture();
  const marketId = await t.run((ctx) =>
    ctx.db.insert('militiaMarketplace', {
      militiaId: scope.militiaId,
      label: 'Market',
      sourceAction: 'broker_market',
      teamId: 'merchants',
      availabilityTier: 'small_town',
      availabilityThreshold: 75,
      saleValuePercent: 50,
      contrabandAllowed: false,
      createdWeek: 8,
      activeUntilWeek: 9,
    }),
  );
  expect(
    (await gm.run((ctx) => preflightCampaignInitialization(ctx, scope))).ready,
  ).toBe(false);
  const assets = context.resolutionAssets;
  await gm.run((ctx) =>
    saveCampaignContext(ctx, {
      ...scope,
      expectedRevision: 0,
      context: {
        ...context,
        resolutionAssets: {
          ...assets,
          economy: {
            ...assets.economy,
            markets: [
              {
                marketId,
                source: 'broker_market',
                settlementId: 'town',
                availableWeek: 8,
                expiresWeek: 9,
                availability: 'small_town',
                availabilityPercent: 75,
                salePercent: 50,
                contraband: false,
              },
            ],
          },
        },
      },
    }),
  );
  const plan = await gm.run((ctx) =>
    preflightCampaignInitialization(ctx, scope),
  );
  expect(plan.issues).toEqual([]);
  expect(plan.snapshot?.economy?.markets[0]).toMatchObject({
    marketId,
    expiresWeek: 9,
    availabilityPercent: 75,
    salePercent: 50,
  });
});

test('[initialization.delivery] preserve pending receipts and recover Broker Market Activity timing', async () => {
  const { t, gm, scope, context, orderId } = await fixture();
  await t.run((ctx) =>
    ctx.db.patch('militiaOrder', orderId, { sourceAction: 'broker_market' }),
  );
  const changed = {
    ...context,
    orders: context.orders.map((o) => ({
      ...o,
      source: 'broker_market' as const,
      receiptStatus: 'received' as const,
      receipt: { receivedDay: 56, acknowledgementId: 'invented-receipt' },
    })),
  };
  await gm.run((ctx) =>
    saveCampaignContext(ctx, {
      ...scope,
      expectedRevision: 0,
      context: changed,
    }),
  );
  const blocked = await gm.run((ctx) =>
    preflightCampaignInitialization(ctx, scope),
  );
  expect(blocked.issues.join('\n')).toContain('delivery Activity week');
  expect(blocked.issues.join('\n')).toContain('Preserve receipt');
  await expect(
    gm.run((ctx) =>
      initializeCampaign(ctx, {
        ...scope,
        sourceToken: blocked.sourceToken,
        initializationId: 'delivery',
      }),
    ),
  ).rejects.toThrow();
  await gm.run((ctx) =>
    saveCampaignContext(ctx, {
      ...scope,
      expectedRevision: 1,
      context: {
        ...changed,
        resolutionAssets: {
          ...context.resolutionAssets,
          economy: {
            ...context.resolutionAssets.economy,
            orders: context.resolutionAssets.economy.orders.map((o) => ({
              ...o,
              source: 'broker_market' as const,
              dueActivityWeek: 9,
            })),
          },
        },
        orders: changed.orders.map((o) => ({
          ...o,
          receiptStatus: 'unreceived',
          receipt: null,
          dueActivityWeek: 9,
        })),
      },
    }),
  );
  const ready = await gm.run((ctx) =>
    preflightCampaignInitialization(ctx, scope),
  );
  expect(ready.issues).toEqual([]);
  await gm.run((ctx) =>
    initializeCampaign(ctx, {
      ...scope,
      sourceToken: ready.sourceToken,
      initializationId: 'delivery',
    }),
  );
  expect(
    (await gm.run((ctx) => readOpenDraft(ctx, scope)))?.context.orders[0]
      ?.receipt,
  ).toBeNull();
});

test('[initialization.new-event] current-week events do not change week-start eligibility', async () => {
  const { t, gm, scope, context, eventId } = await fixture();
  await t.run((ctx) =>
    ctx.db.patch('militiaEventState', eventId, {
      startedWeek: 9,
      weekNumber: 9,
    }),
  );
  await gm.run((ctx) =>
    saveCampaignContext(ctx, {
      ...scope,
      expectedRevision: 0,
      context: {
        ...context,
        events: context.events.map((e) => ({ ...e, startedWeek: 9 })),
      },
    }),
  );
  const plan = await gm.run((ctx) =>
    preflightCampaignInitialization(ctx, scope),
  );
  expect(plan.ready).toBe(false);
  expect(plan.facts?.carriedEvents).toEqual([]);
  await expect(
    gm.run((ctx) =>
      initializeCampaign(ctx, {
        ...scope,
        sourceToken: plan.sourceToken,
        initializationId: 'current-event',
      }),
    ),
  ).rejects.toThrow('current event state');
  expect(await gm.run((ctx) => readOpenDraft(ctx, scope))).toBeNull();
});

test('[initialization.source-size] preflight reports oversized sources before initialization', async () => {
  const { t, gm, scope } = await fixture();
  await t.run((ctx) =>
    ctx.db.patch('militia', scope.militiaId, {
      HQLocation: 'a'.repeat(760000),
    }),
  );
  const plan = await gm.run((ctx) =>
    preflightCampaignInitialization(ctx, scope),
  );
  await expect(
    gm.run((ctx) =>
      initializeCampaign(ctx, {
        ...scope,
        sourceToken: plan.sourceToken,
        initializationId: 'oversized',
      }),
    ),
  ).rejects.toThrow('receipt size limit');
  expect(await gm.run((ctx) => readOpenDraft(ctx, scope))).toBeNull();
  expect(plan.ready).toBe(false);
  expect(plan.issues.join()).toContain('size');
});

test('[initialization.ended-event] ending a carried event midweek preserves week-start eligibility', async () => {
  const { t, gm, scope, context, eventId } = await fixture();
  await t.run((ctx) =>
    ctx.db.patch('militiaEventState', eventId, {
      resolved: true,
      endedWeek: 9,
    }),
  );
  await gm.run((ctx) =>
    saveCampaignContext(ctx, {
      ...scope,
      expectedRevision: 0,
      context: {
        ...context,
        events: context.events.map((e) => ({
          ...e,
          resolved: true,
          endedWeek: 9,
        })),
      },
    }),
  );
  const plan = await gm.run((ctx) =>
    preflightCampaignInitialization(ctx, scope),
  );
  expect(plan.facts?.carriedEvents.map((event) => event.eventId)).toEqual([
    eventId,
  ]);
  expect(plan.prepared?.context.events[0]).toMatchObject({
    resolved: true,
    endedWeek: 9,
  });
  await expect(
    gm.run((ctx) =>
      initializeCampaign(ctx, {
        ...scope,
        sourceToken: plan.sourceToken,
        initializationId: 'ended',
      }),
    ),
  ).rejects.toThrow('current event state');
  expect(await gm.run((ctx) => readOpenDraft(ctx, scope))).toBeNull();
});

test('[initialization.prior-ended-event] events ended before this week are not carried into it', async () => {
  const { t, gm, scope, context, eventId } = await fixture();
  await t.run((ctx) =>
    ctx.db.patch('militiaEventState', eventId, {
      resolved: true,
      endedWeek: 8,
    }),
  );
  await gm.run((ctx) =>
    saveCampaignContext(ctx, {
      ...scope,
      expectedRevision: 0,
      context: {
        ...context,
        events: context.events.map((e) => ({
          ...e,
          resolved: true,
          endedWeek: 8,
        })),
      },
    }),
  );
  const plan = await gm.run((ctx) =>
    preflightCampaignInitialization(ctx, scope),
  );
  expect(plan.issues).toEqual([]);
  await gm.run((ctx) =>
    initializeCampaign(ctx, {
      ...scope,
      sourceToken: plan.sourceToken,
      initializationId: 'prior-end',
    }),
  );
  expect(
    (await gm.run((ctx) => readOpenDraft(ctx, scope)))?.context
      .persistentPhaseEligible,
  ).toBe(false);
});

test('[initialization.unknown-end] missing historical timing blocks preflight until explicitly resolved', async () => {
  const { t, gm, scope, context, eventId } = await fixture();
  await t.run((ctx) =>
    ctx.db.patch('militiaEventState', eventId, { resolved: true }),
  );
  const unresolved = {
    ...context,
    events: context.events.map((e) => ({ ...e, resolved: true })),
  };
  await gm.run((ctx) =>
    saveCampaignContext(ctx, {
      ...scope,
      expectedRevision: 0,
      context: unresolved,
    }),
  );
  const blocked = await gm.run((ctx) =>
    preflightCampaignInitialization(ctx, scope),
  );
  expect(blocked.ready).toBe(false);
  expect(blocked.issues.join('\n')).toContain(
    `week-start timing for event ${eventId}`,
  );
  await expect(
    gm.run((ctx) =>
      initializeCampaign(ctx, {
        ...scope,
        sourceToken: blocked.sourceToken,
        initializationId: 'unknown-end',
      }),
    ),
  ).rejects.toThrow('week-start timing');
  expect(await gm.run((ctx) => readOpenDraft(ctx, scope))).toBeNull();
  await gm.run((ctx) =>
    saveCampaignContext(ctx, {
      ...scope,
      expectedRevision: 1,
      context: {
        ...unresolved,
        events: unresolved.events.map((e) => ({ ...e, endedWeek: 8 })),
      },
    }),
  );
  const ready = await gm.run((ctx) =>
    preflightCampaignInitialization(ctx, scope),
  );
  expect(ready.issues).toEqual([]);
  await gm.run((ctx) =>
    initializeCampaign(ctx, {
      ...scope,
      sourceToken: ready.sourceToken,
      initializationId: 'known-end',
    }),
  );
  expect(
    (await gm.run((ctx) => readOpenDraft(ctx, scope)))?.context
      .persistentPhaseEligible,
  ).toBe(false);
  expect(
    await t.run((ctx) => ctx.db.get('militiaEventState', eventId)),
  ).not.toHaveProperty('endedWeek');
});

test('[initialization.theft-mitigation] current-week legacy Theft mitigation becomes an explicit one-week canonical income fact', async () => {
  const { t, gm, scope, eventId, context } = await fixture();
  await t.run((ctx) =>
    ctx.db.patch('militiaEventState', eventId, {
      eventType: 'theft',
      mitigationUntilWeek: 9,
    }),
  );
  await gm.run((ctx) =>
    saveCampaignContext(ctx, {
      ...scope,
      expectedRevision: 0,
      context: {
        ...context,
        events: context.events.map((event) => ({
          ...event,
          eventType: 'theft' as const,
          mitigationUntilWeek: 9,
        })),
      },
    }),
  );
  const preflight = await gm.run((ctx) =>
    preflightCampaignInitialization(ctx, scope),
  );
  expect(preflight.issues).toEqual([]);
  await gm.run((ctx) =>
    initializeCampaign(ctx, {
      ...scope,
      sourceToken: preflight.sourceToken,
      initializationId: 'mitigation',
    }),
  );
  const draft = await gm.run((ctx) => readOpenDraft(ctx, scope));
  expect(draft?.context.carriedEvents[0]?.mitigation).toEqual({
    week: 9,
    retainedIncomePercent: 90,
  });
});

test('[initialization.member] an organization member can prepare and initialize the same canonical source as an administrator', async () => {
  const { t, gm, scope } = await fixture();
  const member = t.withIdentity({ tokenIdentifier: 'test|player' });
  const plan = await member.run((ctx) =>
    preflightCampaignInitialization(ctx, scope),
  );
  expect(plan).toEqual(
    await gm.run((ctx) => preflightCampaignInitialization(ctx, scope)),
  );
  expect(plan.ready).toBe(true);
  await member.run((ctx) =>
    initializeCampaign(ctx, {
      ...scope,
      sourceToken: plan.sourceToken,
      initializationId: 'member-initialization',
    }),
  );
  expect(await member.run((ctx) => readOpenDraft(ctx, scope))).not.toBeNull();
  expect(await member.run((ctx) => readOpenDraft(ctx, scope))).toEqual(
    await gm.run((ctx) => readOpenDraft(ctx, scope)),
  );
});

test('[cutover.usable] initialized campaign supplies the preserved source to canonical preview', async () => {
  const { gm, scope, teamId, characterId } = await fixture();
  const plan = await gm.run((ctx) =>
    preflightCampaignInitialization(ctx, scope),
  );
  const result = await gm.run((ctx) =>
    initializeCampaign(ctx, {
      ...scope,
      sourceToken: plan.sourceToken,
      initializationId: 'usable',
    }),
  );
  const key = { ...scope, draftId: result.draftId };
  const edits = initializationEdits(`legacy-team:${teamId}`, characterId);
  for (const [baseRevision, edit] of edits.entries())
    await gm.run((ctx) =>
      persistDraftOperation(ctx, key, {
        draftId: key.draftId,
        operationId: `edit:${baseRevision}`,
        baseRevision,
        edit,
      }),
    );
  const preview = await gm.run((ctx) => previewDraft(ctx, key));
  expect(preview.requirements).toEqual([]);
  expect(preview.reviewed.sourceRevision).toBe(0);
});

test('[cutover.assets] unresolved or changed asset facts block initialization without partial state', async () => {
  const { gm, scope, context } = await fixture();
  await gm.run((ctx) =>
    saveCampaignContext(ctx, {
      ...scope,
      expectedRevision: 0,
      context: { ...context, resolutionAssets: undefined },
    }),
  );
  const missing = await gm.run((ctx) =>
    preflightCampaignInitialization(ctx, scope),
  );
  expect(missing.issues).toContain(
    'Prepare complete resolution assets, including explicit empty collections.',
  );
  await expect(
    gm.run((ctx) =>
      initializeCampaign(ctx, {
        ...scope,
        initializationId: 'missing-assets',
        sourceToken: missing.sourceToken,
      }),
    ),
  ).rejects.toThrow('resolution assets');
  expect(await gm.run((ctx) => readOpenDraft(ctx, scope))).toBeNull();
  await gm.run((ctx) =>
    saveCampaignContext(ctx, {
      ...scope,
      expectedRevision: 1,
      context: {
        ...context,
        resolutionAssets: {
          ...context.resolutionAssets,
          economy: {
            ...context.resolutionAssets.economy,
            orders: [],
          },
        },
      },
    }),
  );
  const changed = await gm.run((ctx) =>
    preflightCampaignInitialization(ctx, scope),
  );
  expect(changed.issues.join('\n')).toContain('Preserve order');
  await expect(
    gm.run((ctx) =>
      initializeCampaign(ctx, {
        ...scope,
        initializationId: 'changed-assets',
        sourceToken: changed.sourceToken,
      }),
    ),
  ).rejects.toThrow('Preserve order');
  expect(await gm.run((ctx) => readOpenDraft(ctx, scope))).toBeNull();
});

test('[cutover.enchantment] unresolved enhancement facts cannot become an ordinary purchase', async () => {
  const { gm, scope, context } = await fixture();
  await gm.run((ctx) =>
    saveCampaignContext(ctx, {
      ...scope,
      expectedRevision: 0,
      context: {
        ...context,
        orders: context.orders.map((order) => ({
          ...order,
          enchantment: { costCopper: 1234, days: 1 },
        })),
      },
    }),
  );
  const plan = await gm.run((ctx) =>
    preflightCampaignInitialization(ctx, scope),
  );
  expect(plan.issues.join('\n')).toContain(
    'Resolve enchantment value and duration mapping',
  );
  await expect(
    gm.run((ctx) =>
      initializeCampaign(ctx, {
        ...scope,
        sourceToken: plan.sourceToken,
        initializationId: 'enchantment',
      }),
    ),
  ).rejects.toThrow('enchantment');
  expect(await gm.run((ctx) => readOpenDraft(ctx, scope))).toBeNull();
});

test('[cutover.access] rehearsal requires the bound preview capability and campaign membership', async () => {
  vi.stubEnv('E2E_ENABLED', 'true');
  vi.stubEnv('E2E_FIXTURE_CONFIG', JSON.stringify(deploymentFixture));
  vi.stubEnv('CONVEX_CLOUD_URL', deploymentFixture.convexUrl);
  const scope = {
    namespace: deploymentFixture.namespace,
    version: 1,
    workerKey: 'worker-0',
    caseKey: 'canonicalPersistence' as const,
    token: 'c'.repeat(64),
  };
  try {
    const t = convexTest(schema, modules);
    await t.mutation(internal.e2eFixtures.seedIdentityProjection, scope);
    await t.mutation(internal.e2eFixtures.resetCase, { ...scope, now: 1 });
    const before = await t.query(internal.e2eFixtures.inspectCase, scope);
    await expect(
      t.mutation(api.canonicalPersistenceFixtures.rehearseCutover, {
        scope,
        step: 'seed',
      }),
    ).rejects.toThrow('Campaign access required');
    expect(await t.query(internal.e2eFixtures.inspectCase, scope)).toEqual(
      before,
    );
    const gm = t.withIdentity({
      tokenIdentifier: `https://${deploymentFixture.clerkHost}|user_gm`,
    });
    await expect(
      gm.mutation(api.canonicalPersistenceFixtures.rehearseCutover, {
        scope: { ...scope, token: 'x'.repeat(64) },
        step: 'seed',
      }),
    ).rejects.toThrow('fixture access refused');
    expect(await t.query(internal.e2eFixtures.inspectCase, scope)).toEqual(
      before,
    );
    await gm.mutation(api.canonicalPersistenceFixtures.rehearseCutover, {
      scope,
      step: 'seed',
    });
    const inspection = z
      .object({
        plan: z.object({ ready: z.boolean(), issues: z.array(z.string()) }),
      })
      .parse(
        JSON.parse(
          await gm.mutation(api.canonicalPersistenceFixtures.rehearseCutover, {
            scope,
            step: 'inspect',
          }),
        ),
      );
    expect(inspection.plan).toEqual({ ready: true, issues: [] });
  } finally {
    vi.unstubAllEnvs();
  }
});
