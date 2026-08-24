/// <reference types="vite/client" />
// @vitest-environment edge-runtime

import { convexTest, type TestConvex } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');
const organizationId = 'mean-qa-org';
const tokenIdentifier = 'https://mean-qa.test|qa-user';

type TestBackend = TestConvex<typeof schema>;

function createBackend() {
  return convexTest({ schema, modules, transactionLimits: true });
}

describe('weekly history and rollback integration', () => {
  it('survives two complete backward/forward cycles without rewriting history', async () => {
    const t = createBackend();
    const { campaignId, militiaId, weekStateId } = await seedWeekTwo(t);
    const qa = t.withIdentity({
      issuer: 'https://mean-qa.test',
      subject: 'qa-user',
      tokenIdentifier,
    });

    await qa.mutation(api.weekBoard.commitCurrentPhase, {
      organizationId,
      militiaId,
      expectedRevision: 1,
      finalizeWeek: true,
    });
    await expectCurrentState(t, {
      militiaId,
      weekStateId,
      weekNumber: 3,
      training: 12,
      treasury: 100,
      reputation: 'Helpful',
      teamStatus: 'disabled',
      rollbackDepth: 1,
    });

    const weekThreeRevision = await saveWeekThreeDraft(qa, militiaId);
    await qa.mutation(api.weekBoard.commitCurrentPhase, {
      organizationId,
      militiaId,
      expectedRevision: weekThreeRevision,
      finalizeWeek: true,
    });
    await expectCurrentState(t, {
      militiaId,
      weekStateId,
      weekNumber: 4,
      training: 15,
      treasury: 105,
      reputation: 'Unfriendly',
      teamStatus: 'missing',
      rollbackDepth: 2,
    });

    const originalRecords = await qa.query(
      api.weekBoard.listResolutionRecords,
      { campaignId, organizationId },
    );
    expect(originalRecords.map((record) => record.weekNumber)).toEqual([3, 2]);
    expect(originalRecords.every((record) => !record.supersedesRecordId)).toBe(
      true,
    );

    await qa.mutation(api.weekBoard.goToPreviousWeek, {
      organizationId,
      militiaId,
    });
    const rolledBackWeekThree = await expectCurrentState(t, {
      militiaId,
      weekStateId,
      weekNumber: 3,
      training: 12,
      treasury: 100,
      reputation: 'Helpful',
      teamStatus: 'disabled',
      rollbackDepth: 1,
    });
    expect(rolledBackWeekThree.weekState.tableAdjustments).toEqual(
      weekThreeAdjustments,
    );

    await qa.mutation(api.weekBoard.goToPreviousWeek, {
      organizationId,
      militiaId,
    });
    const rolledBackWeekTwo = await expectCurrentState(t, {
      militiaId,
      weekStateId,
      weekNumber: 2,
      training: 10,
      treasury: 100,
      reputation: 'Friendly',
      teamStatus: 'active',
      rollbackDepth: 0,
    });
    expect(rolledBackWeekTwo.weekState.tableAdjustments).toEqual(
      weekTwoAdjustments,
    );
    expect(
      await qa.query(api.weekBoard.listResolutionRecords, {
        campaignId,
        organizationId,
      }),
    ).toEqual(originalRecords);

    await qa.mutation(api.weekBoard.commitCurrentPhase, {
      organizationId,
      militiaId,
      expectedRevision: rolledBackWeekTwo.weekState.lockVersion,
      finalizeWeek: true,
    });
    const replayedWeekThreeRevision = await saveWeekThreeDraft(qa, militiaId);
    await qa.mutation(api.weekBoard.commitCurrentPhase, {
      organizationId,
      militiaId,
      expectedRevision: replayedWeekThreeRevision,
      finalizeWeek: true,
    });

    const replayRecords = await qa.query(
      api.weekBoard.listResolutionRecords,
      { campaignId, organizationId },
    );
    expect(replayRecords).toHaveLength(4);
    const weekTwoRecords = replayRecords.filter((record) => record.weekNumber === 2);
    const weekThreeRecords = replayRecords.filter(
      (record) => record.weekNumber === 3,
    );
    expect(weekTwoRecords).toHaveLength(2);
    expect(weekThreeRecords).toHaveLength(2);
    expect(weekTwoRecords[0]?.supersedesRecordId).toBe(weekTwoRecords[1]?._id);
    expect(weekThreeRecords[0]?.supersedesRecordId).toBe(
      weekThreeRecords[1]?._id,
    );
    expect(weekTwoRecords[1]).toEqual(originalRecords[1]);
    expect(weekThreeRecords[1]).toEqual(originalRecords[0]);

    await qa.mutation(api.weekBoard.goToPreviousWeek, {
      organizationId,
      militiaId,
    });
    await qa.mutation(api.weekBoard.goToPreviousWeek, {
      organizationId,
      militiaId,
    });
    await expectCurrentState(t, {
      militiaId,
      weekStateId,
      weekNumber: 2,
      training: 10,
      treasury: 100,
      reputation: 'Friendly',
      teamStatus: 'active',
      rollbackDepth: 0,
    });
    expect(
      await qa.query(api.weekBoard.listResolutionRecords, {
        campaignId,
        organizationId,
      }),
    ).toEqual(replayRecords);
  });

  it('rolls back every write from a stale final confirmation', async () => {
    const t = createBackend();
    const { campaignId, militiaId, weekStateId } = await seedWeekTwo(t);
    const qa = authorizedBackend(t);
    const saveResult = await qa.mutation(api.weekBoard.saveWeekBoardState, {
      organizationId,
      militiaId,
      patch: {
        eventRollTotals: { eventChanceTotal: '10', eventTriggerRollTotal: '99' },
      },
    });
    const beforeStaleConfirmation = await readCurrentState(
      t,
      militiaId,
      weekStateId,
    );

    await expect(
      qa.mutation(api.weekBoard.commitCurrentPhase, {
        organizationId,
        militiaId,
        expectedRevision: 1,
        finalizeWeek: true,
      }),
    ).rejects.toThrow('Weekly Draft changed after it was reviewed');

    expect(await readCurrentState(t, militiaId, weekStateId)).toEqual(
      beforeStaleConfirmation,
    );
    expect(
      await qa.query(api.weekBoard.listResolutionRecords, {
        campaignId,
        organizationId,
      }),
    ).toEqual([]);

    await qa.mutation(api.weekBoard.commitCurrentPhase, {
      organizationId,
      militiaId,
      expectedRevision: saveResult.revision,
      finalizeWeek: true,
    });
    await expectCurrentState(t, {
      militiaId,
      weekStateId,
      weekNumber: 3,
      training: 12,
      treasury: 100,
      reputation: 'Helpful',
      teamStatus: 'disabled',
      rollbackDepth: 1,
    });
    expect(
      await qa.query(api.weekBoard.listResolutionRecords, {
        campaignId,
        organizationId,
      }),
    ).toHaveLength(1);
  });

  it('leaves state untouched for unauthorized and exhausted-history rollbacks', async () => {
    const t = createBackend();
    const { campaignId, militiaId, weekStateId } = await seedWeekTwo(t);
    const qa = authorizedBackend(t);
    const intruder = t.withIdentity({
      issuer: 'https://mean-qa.test',
      subject: 'intruder',
      tokenIdentifier: 'https://mean-qa.test|intruder',
    });
    const initialState = await readCurrentState(t, militiaId, weekStateId);

    await expect(
      intruder.mutation(api.weekBoard.goToPreviousWeek, {
        organizationId,
        militiaId,
      }),
    ).rejects.toThrow('You do not have access to this org');
    expect(
      await intruder.query(api.weekBoard.listResolutionRecords, {
        campaignId,
        organizationId,
      }),
    ).toEqual([]);

    await expect(
      qa.mutation(api.weekBoard.goToPreviousWeek, {
        organizationId,
        militiaId,
      }),
    ).rejects.toThrow('No committed week snapshot is available for rollback');

    expect(await readCurrentState(t, militiaId, weekStateId)).toEqual(initialState);
    expect(
      await qa.query(api.weekBoard.listResolutionRecords, {
        campaignId,
        organizationId,
      }),
    ).toEqual([]);
  });

  it('allows exactly one of two concurrent final confirmations to commit', async () => {
    const t = createBackend();
    const { campaignId, militiaId, weekStateId } = await seedWeekTwo(t);
    const qa = authorizedBackend(t);
    const confirmation = {
      organizationId,
      militiaId,
      expectedRevision: 1,
      finalizeWeek: true,
    } as const;

    const results = await Promise.allSettled([
      qa.mutation(api.weekBoard.commitCurrentPhase, confirmation),
      qa.mutation(api.weekBoard.commitCurrentPhase, confirmation),
    ]);
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(String(rejected[0]?.reason)).toContain(
      'Weekly Draft changed after it was reviewed',
    );
    await expectCurrentState(t, {
      militiaId,
      weekStateId,
      weekNumber: 3,
      training: 12,
      treasury: 100,
      reputation: 'Helpful',
      teamStatus: 'disabled',
      rollbackDepth: 1,
    });

    const records = await qa.query(api.weekBoard.listResolutionRecords, {
      campaignId,
      organizationId,
    });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      weekNumber: 2,
      finalOutcome: {
        militia: { training: 12, treasury: 100, notoriety: 20 },
      },
    });
    expect(records[0]?.supersedesRecordId).toBeUndefined();
  });

  it('atomically undoes a rollback that fails after restoration has begun', async () => {
    const t = createBackend();
    const { campaignId, militiaId, weekStateId } = await seedWeekTwo(t);
    const qa = authorizedBackend(t);

    await qa.mutation(api.weekBoard.commitCurrentPhase, {
      organizationId,
      militiaId,
      expectedRevision: 1,
      finalizeWeek: true,
    });
    await corruptLatestRollbackSettlement(t, weekStateId);
    const beforeFailedRollback = await readRollbackSurface(t, militiaId, weekStateId);
    const recordsBefore = await qa.query(api.weekBoard.listResolutionRecords, {
      campaignId,
      organizationId,
    });

    await expect(
      qa.mutation(api.weekBoard.goToPreviousWeek, {
        organizationId,
        militiaId,
      }),
    ).rejects.toThrow();

    expect(await readRollbackSurface(t, militiaId, weekStateId)).toEqual(
      beforeFailedRollback,
    );
    expect(
      await qa.query(api.weekBoard.listResolutionRecords, {
        campaignId,
        organizationId,
      }),
    ).toEqual(recordsBefore);
    await expectCurrentState(t, {
      militiaId,
      weekStateId,
      weekNumber: 3,
      training: 12,
      treasury: 100,
      reputation: 'Helpful',
      teamStatus: 'disabled',
      rollbackDepth: 1,
    });
  });

  it('recreates deleted child rows and remaps every stored child reference', async () => {
    const t = createBackend();
    const fixture = await seedWeekTwoWithLinkedChildren(t);
    const { campaignId, militiaId, weekStateId, originalIds } = fixture;
    const qa = authorizedBackend(t);

    await qa.mutation(api.weekBoard.commitCurrentPhase, {
      organizationId,
      militiaId,
      expectedRevision: 1,
      finalizeWeek: true,
    });
    await replaceLinkedChildrenWithDecoys(t, militiaId, originalIds);

    await qa.mutation(api.weekBoard.goToPreviousWeek, {
      organizationId,
      militiaId,
    });

    const state = await readCurrentState(t, militiaId, weekStateId);
    const linked = await readLinkedRows(t, militiaId);
    expect(linked.caches).toHaveLength(1);
    expect(linked.marketplaces).toHaveLength(1);
    expect(linked.orders).toHaveLength(1);
    expect(linked.trackedPeople).toHaveLength(1);
    expect(linked.events).toHaveLength(1);

    const restoredCache = linked.caches[0];
    const restoredMarketplace = linked.marketplaces[0];
    const restoredOrder = linked.orders[0];
    const restoredPerson = linked.trackedPeople[0];
    const restoredEvent = linked.events[0];
    if (
      !restoredCache ||
      !restoredMarketplace ||
      !restoredOrder ||
      !restoredPerson ||
      !restoredEvent
    ) {
      throw new Error('Rollback did not restore exactly one of every linked row.');
    }
    expect(restoredCache._id).not.toBe(originalIds.cacheId);
    expect(restoredMarketplace._id).not.toBe(originalIds.marketplaceId);
    expect(restoredOrder._id).not.toBe(originalIds.orderId);
    expect(restoredPerson._id).not.toBe(originalIds.personId);
    expect(restoredEvent._id).not.toBe(originalIds.eventId);
    expect(restoredCache).toMatchObject({ label: 'North Cache', status: 'hidden' });
    expect(restoredMarketplace).toMatchObject({
      label: 'Vale Exchange',
      sourceAction: 'broker_market',
    });
    expect(restoredOrder).toMatchObject({
      description: 'Cold iron shipment',
      marketplaceId: restoredMarketplace._id,
    });
    expect(restoredPerson).toMatchObject({
      displayName: 'Agent Vale',
      status: 'hidden',
    });
    expect(restoredEvent).toMatchObject({
      eventType: 'theft',
      isPersistent: true,
      resolved: false,
    });

    const restoredAssets = state.weekState.activityAssetOperations;
    expect(restoredAssets?.caches[0]?.cacheId).toBe(restoredCache._id);
    expect(restoredAssets?.rescues?.[0]?.targetStatusId).toBe(
      restoredPerson._id,
    );
    expect(restoredAssets?.restorations?.[0]?.targetStatusId).toBe(
      restoredPerson._id,
    );
    expect(state.weekState.rollbackHistory).toEqual([]);
    expect(
      await qa.query(api.weekBoard.listResolutionRecords, {
        campaignId,
        organizationId,
      }),
    ).toHaveLength(1);
  });
});

const weekTwoAdjustments = [
  {
    kind: 'militia_value' as const,
    field: 'training' as const,
    operation: 'add' as const,
    value: 2,
    reason: 'Week two field training reward',
  },
  {
    kind: 'settlement_reputation' as const,
    settlementKey: 'Longshadow',
    reputation: 'Helpful' as const,
    reason: 'Longshadow saw the militia succeed',
  },
  {
    kind: 'team_status' as const,
    teamId: 'spies' as const,
    status: 'disabled' as const,
    reason: 'The spies need to recover',
  },
];

const weekThreeAdjustments = [
  {
    kind: 'militia_value' as const,
    field: 'training' as const,
    operation: 'add' as const,
    value: 3,
    reason: 'Week three training reward',
  },
  {
    kind: 'militia_value' as const,
    field: 'treasury' as const,
    operation: 'add' as const,
    value: 5,
    reason: 'Recovered supplies',
  },
  {
    kind: 'settlement_reputation' as const,
    settlementKey: 'Longshadow',
    reputation: 'Unfriendly' as const,
    reason: 'A later table ruling reverses local opinion',
  },
  {
    kind: 'team_status' as const,
    teamId: 'spies' as const,
    status: 'missing' as const,
    reason: 'The spies disappeared during week three',
  },
];

async function seedWeekTwo(t: TestBackend) {
  return await t.run(async (ctx) => {
    await ctx.db.insert('user', {
      tokenIdentifier,
      name: 'Mean QA',
      image: '',
      orgIds: [{ orgId: organizationId, role: 'admin' }],
    });
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Rollback Gauntlet',
      ownerId: 'qa-user',
      organizationId,
      description: 'Transactional history integration test',
    });
    const militiaId = await ctx.db.insert('militia', {
      name: 'Gauntlet Militia',
      campaignId,
      rank: 2,
      highestBoonReached: 2,
      HQLocation: 'Longshadow',
      treasury: 100,
      notoriety: 20,
      focus: 'Loyalty',
      training: 10,
    });
    const weekStateId = await ctx.db.insert('militiaWeekState', {
      militiaId,
      weekNumber: 2,
      phase: 'week_closed',
      isFirstWeek: false,
      skippedUpkeepThisWeek: false,
      upkeepTreasurySnapshot: 100,
      uneventfulBonusCarry: 0,
      queuedEffects: [],
      lastPersistentBuyoffWeek: 0,
      stagedActivityActionIds: [null, null],
      stagedActivityTeamIds: [null, null],
      activityTeamOperations: { recruits: [], dismissals: [], upgrades: [] },
      activityOfficerOperations: { changes: [] },
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
      upkeepTeamOperations: { disabledRecoveries: [], missingChecks: [] },
      eventMitigations: {},
      tableAdjustments: weekTwoAdjustments,
      weekWarnings: [],
      upkeepRollTotals: {},
      activityRollTotals: {},
      eventRollTotals: { eventChanceTotal: 10, eventTriggerRollTotal: 99 },
      lockVersion: 1,
    });
    await ctx.db.insert('militiaSettlementState', {
      militiaId,
      settlementKey: 'Longshadow',
      reputation: 'Friendly',
      isSecured: false,
    });
    await ctx.db.insert('militiaTeam', {
      militiaId,
      teamId: 'spies',
    });
    await ctx.db.insert('militiaTeamState', {
      militiaId,
      teamId: 'spies',
      status: 'active',
    });
    return { campaignId, militiaId, weekStateId };
  });
}

async function seedWeekTwoWithLinkedChildren(t: TestBackend) {
  const fixture = await seedWeekTwo(t);
  const originalIds = await t.run(async (ctx) => {
    const cacheId = await ctx.db.insert('militiaCache', {
      militiaId: fixture.militiaId,
      label: 'North Cache',
      cacheClass: 'minor',
      location: 'Old Barn',
      contentsSummary: 'Cold-weather gear',
      status: 'hidden',
      isSecureLocation: true,
      createdWeek: 1,
      updatedWeek: 1,
    });
    const marketplaceId = await ctx.db.insert('militiaMarketplace', {
      militiaId: fixture.militiaId,
      label: 'Vale Exchange',
      sourceAction: 'broker_market',
      teamId: 'merchants',
      availabilityTier: 'small_town',
      availabilityThreshold: 3_000,
      saleValuePercent: 60,
      contrabandAllowed: false,
      createdWeek: 1,
      activeUntilWeek: 4,
      notes: 'Original linked marketplace',
    });
    const orderId = await ctx.db.insert('militiaOrder', {
      militiaId: fixture.militiaId,
      description: 'Cold iron shipment',
      notes: 'Deliver to the north gate',
      costPaid: 25,
      deliveryDays: 14,
      orderedWeek: 1,
      dueWeek: 3,
      status: 'pending',
      sourceAction: 'broker_market',
      marketplaceId,
    });
    const personId = await ctx.db.insert('militiaCharacterStatus', {
      militiaId: fixture.militiaId,
      displayName: 'Agent Vale',
      personKind: 'other_npc',
      status: 'hidden',
      level: 4,
      locationType: 'site',
      siteName: 'Citadel',
      hiddenSinceWeek: 1,
      sourceAction: 'covert_action',
    });
    const eventId = await ctx.db.insert('militiaEventState', {
      militiaId: fixture.militiaId,
      weekNumber: 1,
      eventType: 'theft',
      isPersistent: true,
      startedWeek: 1,
      resolved: false,
    });
    await ctx.db.patch('militiaWeekState', fixture.weekStateId, {
      activityAssetOperations: {
        refuges: [],
        reduceDangerTargets: [],
        spreadPropagandaTargets: [],
        strikeTeams: [],
        caches: [
          {
            slotIndex: 0,
            mode: 'retrieve',
            cacheId,
          },
        ],
        orders: [],
        marketplaces: [],
        covertActions: [],
        rescues: [
          {
            slotIndex: 0,
            targetSource: 'tracked',
            targetStatusId: personId,
            destinationType: 'hq',
          },
        ],
        restorations: [
          {
            slotIndex: 1,
            targetSource: 'tracked',
            targetStatusId: personId,
            mode: 'custom',
            customCostTotal: 0,
          },
        ],
      },
    });
    return { cacheId, marketplaceId, orderId, personId, eventId };
  });
  return { ...fixture, originalIds };
}

async function replaceLinkedChildrenWithDecoys(
  t: TestBackend,
  militiaId: Id<'militia'>,
  originalIds: {
    cacheId: Id<'militiaCache'>;
    marketplaceId: Id<'militiaMarketplace'>;
    orderId: Id<'militiaOrder'>;
    personId: Id<'militiaCharacterStatus'>;
    eventId: Id<'militiaEventState'>;
  },
) {
  await t.run(async (ctx) => {
    await ctx.db.delete('militiaOrder', originalIds.orderId);
    await ctx.db.delete('militiaCache', originalIds.cacheId);
    await ctx.db.delete('militiaMarketplace', originalIds.marketplaceId);
    await ctx.db.delete('militiaCharacterStatus', originalIds.personId);
    await ctx.db.delete('militiaEventState', originalIds.eventId);

    await ctx.db.insert('militiaCache', {
      militiaId,
      label: 'Decoy Cache',
      cacheClass: 'major',
      location: 'Wrong Barn',
      contentsSummary: 'Nothing useful',
      status: 'lost',
      isSecureLocation: false,
      createdWeek: 3,
      updatedWeek: 3,
      lostWeek: 3,
    });
    const decoyMarketplaceId = await ctx.db.insert('militiaMarketplace', {
      militiaId,
      label: 'Decoy Market',
      sourceAction: 'activate_black_market',
      teamId: 'blackMarketeers',
      availabilityTier: 'small_city',
      availabilityThreshold: 10_000,
      saleValuePercent: 40,
      contrabandAllowed: true,
      createdWeek: 3,
      activeUntilWeek: 5,
    });
    await ctx.db.insert('militiaOrder', {
      militiaId,
      description: 'Decoy shipment',
      deliveryDays: 7,
      orderedWeek: 3,
      dueWeek: 4,
      status: 'pending',
      sourceAction: 'activate_black_market',
      marketplaceId: decoyMarketplaceId,
    });
    await ctx.db.insert('militiaCharacterStatus', {
      militiaId,
      displayName: 'Decoy Contact',
      personKind: 'other_npc',
      status: 'contact',
      locationType: 'site',
      siteName: 'Wrong Citadel',
      activeUntilWeek: 4,
      sourceAction: 'covert_action',
    });
    await ctx.db.insert('militiaEventState', {
      militiaId,
      weekNumber: 3,
      eventType: 'high_morale',
      isPersistent: false,
      startedWeek: 3,
      resolved: true,
    });
  });
}

async function corruptLatestRollbackSettlement(
  t: TestBackend,
  weekStateId: Id<'militiaWeekState'>,
) {
  await t.run(async (ctx) => {
    const weekState = await ctx.db.get('militiaWeekState', weekStateId);
    if (!weekState?.rollbackHistory?.length) {
      throw new Error('Expected a rollback snapshot to corrupt.');
    }
    const rollbackHistory = [...weekState.rollbackHistory] as Array<{
      settlements: Array<Record<string, unknown>>;
    }>;
    const latest = rollbackHistory[rollbackHistory.length - 1];
    if (!latest?.settlements[0]) {
      throw new Error('Expected a settlement snapshot to corrupt.');
    }
    rollbackHistory[rollbackHistory.length - 1] = {
      ...latest,
      settlements: latest.settlements.map((settlement, index) =>
        index === 0 ? { ...settlement, reputation: 'Impossible' } : settlement,
      ),
    };
    await ctx.db.patch('militiaWeekState', weekStateId, { rollbackHistory });
  });
}

function authorizedBackend(t: TestBackend) {
  return t.withIdentity({
    issuer: 'https://mean-qa.test',
    subject: 'qa-user',
    tokenIdentifier,
  });
}

async function saveWeekThreeDraft(
  qa: ReturnType<TestBackend['withIdentity']>,
  militiaId: Id<'militia'>,
) {
  const result = await qa.mutation(api.weekBoard.saveWeekBoardState, {
    organizationId,
    militiaId,
    patch: {
      tableAdjustments: weekThreeAdjustments,
      eventRollTotals: { eventChanceTotal: '10', eventTriggerRollTotal: '99' },
    },
  });
  return result.revision;
}

async function expectCurrentState(
  t: TestBackend,
  expected: {
    militiaId: Id<'militia'>;
    weekStateId: Id<'militiaWeekState'>;
    weekNumber: number;
    training: number;
    treasury: number;
    reputation: 'Friendly' | 'Helpful' | 'Unfriendly';
    teamStatus: 'active' | 'disabled' | 'missing';
    rollbackDepth: number;
  },
) {
  const state = await readCurrentState(t, expected.militiaId, expected.weekStateId);
  expect(state.militia).toMatchObject({
    training: expected.training,
    treasury: expected.treasury,
  });
  expect(state.weekState).toMatchObject({ weekNumber: expected.weekNumber });
  expect(state.settlement?.reputation).toBe(expected.reputation);
  expect(state.teamState?.status).toBe(expected.teamStatus);
  expect(state.weekState.rollbackHistory).toHaveLength(expected.rollbackDepth);
  return state;
}

async function readCurrentState(
  t: TestBackend,
  militiaId: Id<'militia'>,
  weekStateId: Id<'militiaWeekState'>,
) {
  return await t.run(async (ctx) => {
    const militia = await ctx.db.get('militia', militiaId);
    const weekState = await ctx.db.get('militiaWeekState', weekStateId);
    const settlement = await ctx.db
      .query('militiaSettlementState')
      .withIndex('by_militiaId_settlement', (q) =>
        q.eq('militiaId', militiaId).eq('settlementKey', 'Longshadow'),
      )
      .unique();
    const teamState = await ctx.db
      .query('militiaTeamState')
      .withIndex('by_militiaId_teamId', (q) =>
        q.eq('militiaId', militiaId).eq('teamId', 'spies'),
      )
      .unique();
    if (!militia || !weekState) {
      throw new Error('Integration test fixture disappeared.');
    }
    return { militia, weekState, settlement, teamState };
  });
}

async function readRollbackSurface(
  t: TestBackend,
  militiaId: Id<'militia'>,
  weekStateId: Id<'militiaWeekState'>,
) {
  return await t.run(async (ctx) => {
    const [
      militia,
      weekState,
      teams,
      teamStates,
      settlements,
      caches,
      marketplaces,
      orders,
      trackedPeople,
      events,
    ] = await Promise.all([
      ctx.db.get('militia', militiaId),
      ctx.db.get('militiaWeekState', weekStateId),
      ctx.db
        .query('militiaTeam')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', militiaId))
        .take(20),
      ctx.db
        .query('militiaTeamState')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', militiaId))
        .take(20),
      ctx.db
        .query('militiaSettlementState')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', militiaId))
        .take(20),
      ctx.db
        .query('militiaCache')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', militiaId))
        .take(20),
      ctx.db
        .query('militiaMarketplace')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', militiaId))
        .take(20),
      ctx.db
        .query('militiaOrder')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', militiaId))
        .take(20),
      ctx.db
        .query('militiaCharacterStatus')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', militiaId))
        .take(20),
      ctx.db
        .query('militiaEventState')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', militiaId))
        .take(20),
    ]);
    return {
      militia,
      weekState,
      teams,
      teamStates,
      settlements,
      caches,
      marketplaces,
      orders,
      trackedPeople,
      events,
    };
  });
}

async function readLinkedRows(t: TestBackend, militiaId: Id<'militia'>) {
  return await t.run(async (ctx) => {
    const [caches, marketplaces, orders, trackedPeople, events] =
      await Promise.all([
        ctx.db
          .query('militiaCache')
          .withIndex('by_militiaId', (q) => q.eq('militiaId', militiaId))
          .take(20),
        ctx.db
          .query('militiaMarketplace')
          .withIndex('by_militiaId', (q) => q.eq('militiaId', militiaId))
          .take(20),
        ctx.db
          .query('militiaOrder')
          .withIndex('by_militiaId', (q) => q.eq('militiaId', militiaId))
          .take(20),
        ctx.db
          .query('militiaCharacterStatus')
          .withIndex('by_militiaId', (q) => q.eq('militiaId', militiaId))
          .take(20),
        ctx.db
          .query('militiaEventState')
          .withIndex('by_militiaId', (q) => q.eq('militiaId', militiaId))
          .take(20),
      ]);
    return { caches, marketplaces, orders, trackedPeople, events };
  });
}
