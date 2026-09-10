// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
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
import { emptyCampaignContext } from '../src/lib/canonical-campaign-context';
import { editWeeklyDraft } from '../src/lib/weekly-draft';
const modules = import.meta.glob('./**/*.ts');

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    await ctx.db.insert('user', {
      tokenIdentifier: 'test|gm',
      orgIds: [{ orgId: 'org', role: 'admin' }],
    });
    await ctx.db.insert('user', {
      tokenIdentifier: 'test|player',
      orgIds: [{ orgId: 'org', role: 'member' }],
    });
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Campaign',
      ownerId: 'gm',
      organizationId: 'org',
      description: '',
    });
    const characterId = await ctx.db.insert('character', {
      campaignId,
      name: 'Officer',
      ownerId: 'gm',
      level: 12,
      description: 'Retain notes',
      strength: 10,
      dexterity: 11,
      constitution: 12,
      intelligence: 13,
      wisdom: 14,
      charisma: 15,
    });
    const militiaId = await ctx.db.insert('militia', {
      campaignId,
      name: 'Mid-campaign',
      rank: 4,
      highestBoonReached: 5,
      HQLocation: 'HQ',
      treasury: 123.45,
      training: 42,
      focus: 'Security',
      notoriety: 17,
      commandant: characterId,
    });
    const weekId = await ctx.db.insert('militiaWeekState', {
      militiaId,
      weekNumber: 9,
      phase: 'event',
      isFirstWeek: false,
      skippedUpkeepThisWeek: false,
      upkeepTreasurySnapshot: 200,
      uneventfulBonusCarry: 3,
      lastPersistentBuyoffWeek: 6,
      queuedEffects: [
        {
          kind: 'organization_check_modifier',
          checkType: 'security',
          modifierTotal: -2,
          appliesWeek: 10,
        },
      ],
      stagedActivityActionIds: ['drill_militia'],
      lockVersion: 7,
      rollbackHistory: [{ discarded: true }],
    });
    const historyId = await ctx.db.insert('militiaResolutionRecord', {
      campaignId,
      militiaId,
      weekNumber: 8,
      source: 'confirmation',
      rulesetVersion: 1,
      baselinePlan: [],
      finalPlan: [],
      warnings: [],
      tableAdjustments: [],
      finalOutcome: {
        militia: { training: 42, treasury: 123.45, notoriety: 17 },
        nextUneventfulBonusCarry: 3,
        resolvedEvents: [],
      },
      createdAt: 1,
    });
    const teamId = await ctx.db.insert('militiaTeam', {
      militiaId,
      teamId: 'defenders',
      managerSource: 'character',
      managerCharacterId: characterId,
    });
    await ctx.db.insert('militiaTeamState', {
      militiaId,
      teamId: 'defenders',
      status: 'missing',
      notes: 'Lost patrol',
    });
    await ctx.db.insert('militiaSettlementState', {
      militiaId,
      settlementKey: 'town',
      reputation: 'Friendly',
      isSecured: true,
      temporaryShift: -1,
      refugeActivatedWeek: 7,
      refugeActiveUntilWeek: 10,
    });
    const eventId = await ctx.db.insert('militiaEventState', {
      militiaId,
      weekNumber: 8,
      eventType: 'sickness',
      isPersistent: true,
      startedWeek: 7,
      resolved: false,
      mitigationUntilWeek: 8,
    });
    const orderId = await ctx.db.insert('militiaOrder', {
      militiaId,
      description: 'Sword',
      costPaid: 12.34,
      orderedWeek: 8,
      dueWeek: 9,
      deliveryDays: 1,
      status: 'pending',
      sourceAction: 'special_order',
    });
    const cacheId = await ctx.db.insert('militiaCache', {
      militiaId,
      label: 'Cache',
      cacheClass: 'minor',
      location: 'Forest',
      contentsSummary: 'Supplies',
      status: 'hidden',
      isSecureLocation: true,
      createdWeek: 4,
      updatedWeek: 5,
    });
    return {
      scope: { campaignId, militiaId },
      characterId,
      historyId,
      weekId,
      teamId,
      eventId,
      orderId,
      cacheId,
    };
  });
  const gm = t.withIdentity({ tokenIdentifier: 'test|gm' });
  const roster = {
    people: [{ characterId: ids.characterId, kind: 'pc' as const, hitDice: 8 }],
    officers: [{ role: 'commandant' as const, characterId: ids.characterId }],
    teams: [
      {
        teamId: `legacy-team:${ids.teamId}`,
        teamType: 'defenders' as const,
        name: 'Patrol',
        status: 'missing' as const,
        managerCharacterId: ids.characterId,
        rewardCapExempt: false,
        notes: 'Lost patrol',
      },
    ],
  };
  const context = {
    ...emptyCampaignContext(),
    treasuryCopper: 12345,
    firstMilitiaWeek: false,
    startDay: 56,
    uneventfulCarry: true,
    lastBuyoffWeek: 6,
    operatingSettlementId: 'town',
    settlements: [
      {
        settlementId: 'town',
        name: 'Town',
        reputation: 'Friendly' as const,
        secured: true,
        occupied: false,
        temporaryReputationShift: -1,
        refugeActivatedWeek: 7,
        refugeActiveUntilWeek: 10,
      },
    ],
    events: [
      {
        eventId: ids.eventId,
        eventType: 'sickness' as const,
        startedWeek: 7,
        order: 0,
        targets: [
          { kind: 'team' as const, teamId: `legacy-team:${ids.teamId}` },
        ],
        persistent: true,
        resolved: false,
        mitigationUntilWeek: 8,
        endedWeek: null,
        notes: '',
      },
    ],
    items: [{ itemId: 'sword', name: 'Sword', valueCopper: 1234 }],
    orders: [
      {
        orderId: ids.orderId,
        itemId: 'sword',
        settlementId: 'town',
        orderedDay: 55,
        dueDay: 56,
        priceCopper: 1234,
        receipt: null,
        receiptStatus: 'unreceived' as const,
        source: 'special_order' as const,
        orderedWeek: 8,
        dueActivityWeek: null,
        deliveryDays: 1,
        expedited: true,
        enchantment: null,
        notes: '',
      },
    ],
    caches: [
      {
        cacheId: ids.cacheId,
        label: 'Cache',
        cacheClass: 'minor' as const,
        location: 'Forest',
        contents: 'Supplies',
        status: 'hidden' as const,
        secure: true,
      },
    ],
    queuedEffects: [
      {
        effectId: 'q',
        sourceId: `legacy-queue:${ids.weekId}:0`,
        startsWeek: 10,
        endsWeek: 10,
        effect: {
          kind: 'check_modifier' as const,
          check: 'security' as const,
          value: -2,
        },
      },
    ],
    bonuses: [
      {
        bonusId: 'reward',
        source: 'Reward',
        check: 'loyalty' as const,
        value: 2,
        availableWeek: 9,
        consumedWeek: null,
      },
    ],
  };
  await gm.run((ctx) =>
    saveRoster(ctx, { ...ids.scope, expectedRevision: null, roster }),
  );
  await gm.run((ctx) =>
    saveCampaignContext(ctx, { ...ids.scope, expectedRevision: null, context }),
  );
  return { t, gm, ...ids, roster, context };
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
  ).toEqual({ status: 'open', revision: 0, targetRevisions: [] });
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
  for (const identity of ['test|player', 'test|outsider'])
    await expect(
      t
        .withIdentity({ tokenIdentifier: identity })
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
  const effect = { kind: 'double_upkeep_attrition' as const, appliesWeek: 10 };
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
