// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import schema from './schema';
import { readRoster, saveRoster } from './lib/canonicalRoster';
import type { CanonicalRoster } from '../src/lib/canonical-roster';

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

test('[roster.shared] two members retain repeated teams, multiple Commandants and explicit Hit Dice', async () => {
  const { player, observer, scope, alice, bob } = await fixture();
  const roster: CanonicalRoster = {
    people: [
      { characterId: alice, hitDice: 7, kind: 'pc' },
      { characterId: bob, hitDice: 3, kind: 'officer_npc' },
    ],
    officers: [
      { role: 'commandant', characterId: alice },
      { role: 'commandant', characterId: bob },
    ],
    teams: [
      {
        teamId: 'a',
        teamType: 'defenders',
        name: 'First',
        status: 'disabled',
        rewardCapExempt: false,
        managerCharacterId: alice,
        notes: '',
      },
      {
        teamId: 'b',
        teamType: 'defenders',
        name: 'Second',
        status: 'missing',
        rewardCapExempt: true,
        managerCharacterId: alice,
        notes: 'Reward',
      },
    ],
  };
  const saved = await player.run((ctx) =>
    saveRoster(ctx, { ...scope, expectedRevision: null, roster }),
  );
  expect(saved.warnings).toContain(
    'Alice manages 2 teams; the normal limit is 1.',
  );
  const observed = await observer.run((ctx) => readRoster(ctx, scope));
  expect(observed?.roster).toEqual(roster);
  expect(observed?.revision).toBe(0);
  const next = {
    ...roster,
    officers: [{ role: 'marshal' as const, characterId: alice }],
  };
  await observer.run((ctx) =>
    saveRoster(ctx, { ...scope, expectedRevision: 0, roster: next }),
  );
  expect((await player.run((ctx) => readRoster(ctx, scope)))?.roster).toEqual(
    next,
  );
  expect(
    (await player.run((ctx) => readRoster(ctx, scope)))?.characters.map(
      (character) => character.name,
    ),
  ).toEqual(['Alice', 'Bob']);
  await expect(
    player.run((ctx) =>
      saveRoster(ctx, { ...scope, expectedRevision: 0, roster }),
    ),
  ).rejects.toThrow('Roster changed');
});

test('[roster.references] malformed and cross-campaign references are rejected atomically', async () => {
  const { player, scope, alice, foreign } = await fixture();
  const roster: CanonicalRoster = {
    people: [{ characterId: alice, kind: 'pc', hitDice: null }],
    officers: [],
    teams: [],
  };
  await player.run((ctx) =>
    saveRoster(ctx, { ...scope, expectedRevision: null, roster }),
  );
  for (const characterId of [foreign, 'not-an-id']) {
    await expect(
      player.run((ctx) =>
        saveRoster(ctx, {
          ...scope,
          expectedRevision: 0,
          roster: {
            ...roster,
            people: [{ characterId, kind: 'pc', hitDice: null }],
          },
        }),
      ),
    ).rejects.toThrow('Character must belong');
  }
  await expect(
    player.run((ctx) =>
      saveRoster(ctx, {
        ...scope,
        expectedRevision: 0,
        roster: {
          ...roster,
          officers: [{ characterId: foreign, role: 'marshal' }],
        },
      }),
    ),
  ).rejects.toThrow('Choose a character');
  expect((await player.run((ctx) => readRoster(ctx, scope)))?.roster).toEqual(
    roster,
  );
  expect((await player.run((ctx) => readRoster(ctx, scope)))?.revision).toBe(0);
});

test('[roster.access] outsiders cannot read or write roster facts and legacy state is untouched', async () => {
  const { t, player, scope } = await fixture();
  const before = await t.run((ctx) => ctx.db.get('militia', scope.militiaId));
  const roster: CanonicalRoster = { people: [], officers: [], teams: [] };
  await player.run((ctx) =>
    saveRoster(ctx, { ...scope, expectedRevision: null, roster }),
  );
  const outsider = t.withIdentity({ tokenIdentifier: 'test|outsider' });
  await expect(outsider.run((ctx) => readRoster(ctx, scope))).rejects.toThrow(
    'Campaign access required',
  );
  await expect(
    outsider.run((ctx) =>
      saveRoster(ctx, { ...scope, expectedRevision: 0, roster }),
    ),
  ).rejects.toThrow('Campaign access required');
  expect(await t.run((ctx) => ctx.db.get('militia', scope.militiaId))).toEqual(
    before,
  );
});
