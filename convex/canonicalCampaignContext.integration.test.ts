// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import schema from './schema';
import { saveRoster } from './lib/canonicalRoster';
import {
  readCampaignContext,
  saveCampaignContext,
} from './lib/canonicalCampaignContext';
import { emptyCampaignContext } from '../src/lib/canonical-campaign-context';
const modules = import.meta.glob('./**/*.ts');
async function fixture() {
  const t = convexTest(schema, modules);
  const data = await t.run(async (ctx) => {
    for (const name of ['alice', 'bob'])
      await ctx.db.insert('user', {
        tokenIdentifier: `test|${name}`,
        orgIds: [{ orgId: 'org-test', role: 'member' }],
      });
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Test',
      ownerId: 'gm',
      organizationId: 'org-test',
      description: '',
    });
    const otherCampaignId = await ctx.db.insert('campaign', {
      name: 'Other',
      ownerId: 'gm',
      organizationId: 'org-test',
      description: '',
    });
    const militiaId = await ctx.db.insert('militia', {
      campaignId,
      name: 'Militia',
      rank: 1,
      highestBoonReached: 1,
      HQLocation: 'HQ',
      treasury: 100,
      training: 0,
      focus: null,
    });
    const character = {
      ownerId: 'gm',
      description: '',
      level: 20,
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    };
    const alice = await ctx.db.insert('character', {
      ...character,
      campaignId,
      name: 'Alice',
    });
    const bob = await ctx.db.insert('character', {
      ...character,
      campaignId,
      name: 'Bob',
    });
    const foreign = await ctx.db.insert('character', {
      ...character,
      campaignId: otherCampaignId,
      name: 'Foreign',
    });
    return { scope: { campaignId, militiaId }, alice, bob, foreign };
  });
  return {
    t,
    ...data,
    player: t.withIdentity({ tokenIdentifier: 'test|alice' }),
    observer: t.withIdentity({ tokenIdentifier: 'test|bob' }),
  };
}

test('[context.shared] members retain campaign context with stale-write protection and no legacy writes', async () => {
  const { t, player, observer, scope } = await fixture();
  const before = await t.run((ctx) => ctx.db.get('militia', scope.militiaId));
  const context = {
    ...emptyCampaignContext(),
    treasuryCopper: 12345,
    firstMilitiaWeek: false,
    uneventfulCarry: true,
    startDay: 0,
    lastBuyoffWeek: 2,
  };
  await player.run((ctx) =>
    saveCampaignContext(ctx, { ...scope, expectedRevision: null, context }),
  );
  expect(
    (await observer.run((ctx) => readCampaignContext(ctx, scope)))?.context,
  ).toEqual(context);
  await observer.run((ctx) =>
    saveCampaignContext(ctx, {
      ...scope,
      expectedRevision: 0,
      context: { ...context, treasuryCopper: 0 },
    }),
  );
  await expect(
    player.run((ctx) =>
      saveCampaignContext(ctx, { ...scope, expectedRevision: 0, context }),
    ),
  ).rejects.toThrow('Context changed');
  expect(
    (await player.run((ctx) => readCampaignContext(ctx, scope)))?.context
      .treasuryCopper,
  ).toBe(0);
  expect(await t.run((ctx) => ctx.db.get('militia', scope.militiaId))).toEqual(
    before,
  );
});

test('[context.events-assets] repeated events retain independent targets, mitigation, ending and precise delivery/receipt', async () => {
  const { player, observer, scope, alice, bob } = await fixture();
  const context = {
    ...emptyCampaignContext(),
    operatingSettlementId: 'town',
    lastBuyoffWeek: 2,
    settlements: [
      {
        settlementId: 'town',
        name: 'Phaendar',
        reputation: 'Friendly' as const,
        secured: true,
        occupied: false,
        temporaryReputationShift: 0,
        refugeActivatedWeek: 0,
        refugeActiveUntilWeek: 2,
      },
    ],
    items: [{ itemId: 'sword', name: 'Sword', valueCopper: 12345 }],
    events: [
      {
        eventId: 'sick-a',
        eventType: 'sickness' as const,
        startedWeek: 1,
        order: 0,
        targets: [{ kind: 'character' as const, characterId: alice }],
        persistent: true,
        resolved: true,
        mitigationUntilWeek: 3,
        endedWeek: null,
        notes: 'Mitigated this week only',
      },
      {
        eventId: 'sick-b',
        eventType: 'sickness' as const,
        startedWeek: 1,
        order: 1,
        targets: [{ kind: 'character' as const, characterId: bob }],
        persistent: true,
        resolved: true,
        mitigationUntilWeek: null,
        endedWeek: 2,
        notes: 'Bought off',
      },
    ],
    bonuses: [
      {
        bonusId: 'bonus',
        source: 'Narrative reward',
        check: 'loyalty' as const,
        value: 0,
        availableWeek: 3,
        consumedWeek: null,
      },
    ],
    queuedEffects: [
      {
        effectId: 'queue',
        sourceId: 'sick-a',
        startsWeek: 4,
        endsWeek: 5,
        effect: {
          kind: 'check_modifier' as const,
          check: 'security' as const,
          value: -2,
        },
      },
    ],
    orders: [
      {
        orderId: 'order',
        itemId: 'sword',
        settlementId: 'town',
        orderedDay: 6,
        dueDay: 8,
        priceCopper: 12345,
        receipt: null,
        receiptStatus: 'unreceived' as const,
        source: 'special_order' as const,
        orderedWeek: 1,
        dueActivityWeek: null,
        deliveryDays: 1,
        expedited: true,
        enchantment: { costCopper: 100000, days: 1 },
        notes: 'One-day expedition plus enchantment',
      },
    ],
  };
  await player.run((ctx) =>
    saveCampaignContext(ctx, { ...scope, expectedRevision: null, context }),
  );
  expect(
    (await observer.run((ctx) => readCampaignContext(ctx, scope)))?.context,
  ).toEqual(context);
  const received = {
    ...context,
    orders: context.orders.map((order) => ({
      ...order,
      receiptStatus: 'received' as const,
      receipt: { receivedDay: 9, acknowledgementId: 'receipt' },
    })),
  };
  await observer.run((ctx) =>
    saveCampaignContext(ctx, {
      ...scope,
      expectedRevision: 0,
      context: received,
    }),
  );
  expect(
    (await player.run((ctx) => readCampaignContext(ctx, scope)))?.context,
  ).toEqual(received);
  await expect(
    player.run((ctx) =>
      saveCampaignContext(ctx, {
        ...scope,
        expectedRevision: 0,
        context: received,
      }),
    ),
  ).rejects.toThrow('Context changed');
});

test('[context.references] invalid targets and outsiders cannot replace accepted facts', async () => {
  const { t, player, scope, foreign } = await fixture();
  const context = emptyCampaignContext();
  await player.run((ctx) =>
    saveCampaignContext(ctx, { ...scope, expectedRevision: null, context }),
  );
  for (const target of [
    { kind: 'character' as const, characterId: foreign },
    { kind: 'character' as const, characterId: 'bad-id' },
    { kind: 'team' as const, teamId: 'foreign-team' },
    { kind: 'settlement' as const, settlementId: 'foreign-town' },
    { kind: 'cache' as const, cacheId: 'foreign-cache' },
    { kind: 'item' as const, itemId: 'foreign-item' },
    { kind: 'event' as const, eventId: 'foreign-event' },
  ]) {
    await expect(
      player.run((ctx) =>
        saveCampaignContext(ctx, {
          ...scope,
          expectedRevision: 0,
          context: {
            ...context,
            events: [
              {
                eventId: 'e',
                eventType: 'sickness',
                startedWeek: 0,
                order: 0,
                targets: [target],
                persistent: true,
                resolved: false,
                mitigationUntilWeek: null,
                endedWeek: null,
                notes: '',
              },
            ],
          },
        }),
      ),
    ).rejects.toThrow();
  }
  await expect(
    player.run((ctx) =>
      saveCampaignContext(ctx, {
        ...scope,
        expectedRevision: 0,
        context: {
          ...context,
          queuedEffects: [
            {
              effectId: 'q',
              sourceId: 'reward',
              startsWeek: 0,
              endsWeek: 0,
              effect: { kind: 'team_unavailable', teamId: 'foreign-team' },
            },
          ],
        },
      }),
    ),
  ).rejects.toThrow('Team must belong');
  const outsider = t.withIdentity({ tokenIdentifier: 'test|outsider' });
  await expect(
    outsider.run((ctx) => readCampaignContext(ctx, scope)),
  ).rejects.toThrow('Campaign access required');
  await expect(
    outsider.run((ctx) =>
      saveCampaignContext(ctx, { ...scope, expectedRevision: 0, context }),
    ),
  ).rejects.toThrow('Campaign access required');
  await expect(t.run((ctx) => readCampaignContext(ctx, scope))).rejects.toThrow(
    'Campaign access required',
  );
  expect(
    (await player.run((ctx) => readCampaignContext(ctx, scope)))?.context,
  ).toEqual(context);
  expect(
    (await player.run((ctx) => readCampaignContext(ctx, scope)))?.revision,
  ).toBe(0);
});

test('[context.roster-reference] referenced teams cannot be removed until context references are repaired', async () => {
  const { player, scope } = await fixture();
  const roster = {
    people: [],
    officers: [],
    teams: [
      {
        teamId: 'team',
        teamType: 'defenders' as const,
        name: 'Defenders',
        status: 'active' as const,
        rewardCapExempt: false,
        managerCharacterId: null,
        notes: '',
      },
    ],
  };
  await player.run((ctx) =>
    saveRoster(ctx, { ...scope, expectedRevision: null, roster }),
  );
  const context = {
    ...emptyCampaignContext(),
    queuedEffects: [
      {
        effectId: 'q',
        sourceId: 'reward',
        startsWeek: 0,
        endsWeek: 0,
        effect: { kind: 'team_unavailable' as const, teamId: 'team' },
      },
    ],
  };
  await player.run((ctx) =>
    saveCampaignContext(ctx, { ...scope, expectedRevision: null, context }),
  );
  await expect(
    player.run((ctx) =>
      saveRoster(ctx, {
        ...scope,
        expectedRevision: 0,
        roster: { ...roster, teams: [] },
      }),
    ),
  ).rejects.toThrow('referenced');
  expect(
    (await player.run((ctx) => readCampaignContext(ctx, scope)))?.context,
  ).toEqual(context);
  await player.run((ctx) =>
    saveCampaignContext(ctx, {
      ...scope,
      expectedRevision: 0,
      context: { ...context, queuedEffects: [] },
    }),
  );
  await player.run((ctx) =>
    saveRoster(ctx, {
      ...scope,
      expectedRevision: 0,
      roster: { ...roster, teams: [] },
    }),
  );
});
