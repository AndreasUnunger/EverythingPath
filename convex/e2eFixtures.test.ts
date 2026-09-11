/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { internal } from './_generated/api';
import schema from './schema';
import { deploymentFixture } from '../e2e/support/test-data';
import type { FixtureScope } from '../e2e/fixtures/catalog';

const modules = import.meta.glob('./**/*.ts');
const scope: FixtureScope = {
  namespace: deploymentFixture.namespace,
  version: 1,
  workerKey: 'worker-0',
  caseKey: 'smoke',
  token: 'a'.repeat(64),
};
const isolation: FixtureScope = {
  ...scope,
  caseKey: 'isolation',
  token: 'b'.repeat(64),
};
const characterLedger: FixtureScope = {
  ...scope,
  caseKey: 'characterLedger',
  token: 'c'.repeat(64),
};

describe('internal fixture boundary', () => {
  beforeEach(() => {
    vi.stubEnv('E2E_ENABLED', 'true');
    vi.stubEnv('E2E_FIXTURE_CONFIG', JSON.stringify(deploymentFixture));
    vi.stubEnv('CONVEX_CLOUD_URL', deploymentFixture.convexUrl);
  });
  afterEach(() => vi.unstubAllEnvs());
  it('projects declared identities and restores deterministic state before retry', async () => {
    const t = convexTest({ schema, modules });
    await t.mutation(internal.e2eFixtures.seedIdentityProjection, scope);
    await t.mutation(internal.e2eFixtures.seedIdentityProjection, scope);
    const first = await t.mutation(internal.e2eFixtures.resetCase, {
      ...scope,
      now: 1_700_000_000_000,
    });
    await t.run(async (ctx) => {
      const militia = await ctx.db
        .query('militia')
        .withIndex('by_campaign', (q) => q.eq('campaignId', first.campaignId))
        .unique();
      await ctx.db.patch('militia', militia!._id, { treasury: 999 });
    });
    await t.mutation(internal.e2eFixtures.resetCase, {
      ...scope,
      now: 1_700_000_000_000,
    });
    expect(await t.query(internal.e2eFixtures.inspectCase, scope)).toEqual({
      campaignKey: 'harness-campaign',
      campaignCount: 1,
      identityCount: 3,
      characters: ['E2E harness-officer'],
      militia: {
        treasury: 100,
        training: 0,
        week: 1,
        phase: 'activity',
        stagedActions: [null],
      },
    });
  });
  it('starts the character-ledger journey with militia but no character records', async () => {
    const t = convexTest({ schema, modules });
    await t.mutation(internal.e2eFixtures.resetCase, {
      ...characterLedger,
      now: 1_700_000_000_000,
    });
    expect(
      await t.query(internal.e2eFixtures.inspectCase, characterLedger),
    ).toMatchObject({
      campaignKey: 'character-ledger-campaign',
      campaignCount: 1,
      characters: [],
      militia: { week: 1, phase: 'activity' },
    });
  });
  it('resets an isolated realtime Action Slot board', async () => {
    const t = convexTest({ schema, modules });
    const realtime = {
      ...scope,
      caseKey: 'realtimeActionSlot' as const,
      token: 'f'.repeat(64),
    };
    await t.mutation(internal.e2eFixtures.resetCase, {
      ...scope,
      now: 1_700_000_000_000,
    });
    await t.mutation(internal.e2eFixtures.resetCase, {
      ...realtime,
      now: 1_700_000_000_000,
    });
    expect(
      await t.query(internal.e2eFixtures.inspectCase, realtime),
    ).toMatchObject({
      campaignKey: 'realtime-action-slot-campaign',
      campaignCount: 1,
      militia: {
        week: 1,
        phase: 'activity',
        training: 0,
        treasury: 100,
        stagedActions: [null],
      },
    });
    await t.mutation(internal.e2eFixtures.cleanupCase, realtime);
    expect(
      await t.query(internal.e2eFixtures.inspectCase, scope),
    ).toMatchObject({ campaignCount: 1 });
  });
  it.each([
    ['disabled', { E2E_ENABLED: 'false' }, {}],
    ['missing deployment binding', { CONVEX_CLOUD_URL: '' }, {}],
    [
      'production with copied E2E flags',
      { CONVEX_CLOUD_URL: 'https://production.convex.cloud' },
      {},
    ],
    ['production explicitly targeted', { CONVEX_DEPLOYMENT: 'prod:main' }, {}],
    ['unknown namespace', {}, { namespace: 'e2e-local-other-slot-0' }],
    ['unknown version', {}, { version: 2 }],
    ['other worker', {}, { workerKey: 'worker-1' }],
    [
      'other case with original capability',
      {},
      { caseKey: 'isolation' as const },
    ],
    ['wrong capability', {}, { token: 'c'.repeat(64) }],
  ])(
    'refuses every operation for %s',
    async (_label, environment, override) => {
      const t = convexTest({ schema, modules });
      for (const [key, value] of Object.entries(environment))
        vi.stubEnv(key, value);
      const request = { ...scope, ...override };
      await expect(
        t.query(internal.e2eFixtures.inspectCase, request),
      ).rejects.toThrow();
      for (const fn of [
        internal.e2eFixtures.seedIdentityProjection,
        internal.e2eFixtures.cleanupCase,
      ])
        await expect(t.mutation(fn, request)).rejects.toThrow();
      await expect(
        t.mutation(internal.e2eFixtures.resetCase, { ...request, now: 0 }),
      ).rejects.toThrow();
      expect(
        await t.run(async (ctx) => await ctx.db.query('campaign').collect()),
      ).toEqual([]);
    },
  );
  it('cleans only its owned graph, including application-created children', async () => {
    const t = convexTest({ schema, modules });
    const first = await t.mutation(internal.e2eFixtures.resetCase, {
      ...scope,
      now: 0,
    });
    await t.mutation(internal.e2eFixtures.resetCase, { ...isolation, now: 0 });
    const before = await t.query(internal.e2eFixtures.inspectCase, isolation);
    await t.run(async (ctx) => {
      await ctx.db.insert('character', {
        campaignId: first.campaignId,
        ownerId: 'synthetic',
        name: 'Created during play',
        description: '',
        level: 1,
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      });
      await ctx.db.insert('campaign', {
        name: 'Unowned campaign',
        ownerId: 'unowned',
        organizationId: 'org_members',
        description: '',
      });
    });
    await t.mutation(internal.e2eFixtures.cleanupCase, scope);
    await t.mutation(internal.e2eFixtures.cleanupCase, scope);
    expect(
      await t.query(internal.e2eFixtures.inspectCase, scope),
    ).toMatchObject({ campaignCount: 0, characters: [], militia: null });
    expect(await t.query(internal.e2eFixtures.inspectCase, isolation)).toEqual(
      before,
    );
    expect(
      await t.run(async (ctx) =>
        (await ctx.db.query('campaign').collect()).map((row) => row.name),
      ),
    ).toContain('Unowned campaign');
    expect(
      await t.run(async (ctx) =>
        (await ctx.db.query('character').collect()).map((row) => row.name),
      ),
    ).toEqual(['E2E isolation-officer']);
  });
  it('does not overwrite an identity outside the owned projection', async () => {
    const t = convexTest({ schema, modules });
    await t.run(
      async (ctx) =>
        await ctx.db.insert('user', {
          tokenIdentifier: `https://${deploymentFixture.clerkHost}|user_gm`,
          name: 'Unowned user',
          orgIds: [],
        }),
    );
    await expect(
      t.mutation(internal.e2eFixtures.seedIdentityProjection, scope),
    ).rejects.toThrow('not owned');
  });
  it('rejects cross-worker access even when both workers have valid owned cases', async () => {
    const second = {
      ...deploymentFixture.workers[0],
      key: 'worker-1',
      organizationId: 'org_second',
      outsiderOrganizationId: 'org_secondoutsider',
      cases: {
        smoke: 'c'.repeat(64),
        isolation: 'd'.repeat(64),
        existingMilitia: 'e'.repeat(64),
        characterLedger: 'f'.repeat(64),
        completeWeek: 'g'.repeat(64),
        canonicalPersistence: 'c'.repeat(64),
        realtimeActionSlot: 'h'.repeat(64),
      },
    };
    vi.stubEnv(
      'E2E_FIXTURE_CONFIG',
      JSON.stringify({
        ...deploymentFixture,
        workers: [...deploymentFixture.workers, second],
      }),
    );
    const t = convexTest({ schema, modules });
    const secondScope = {
      ...scope,
      workerKey: second.key,
      token: second.cases.smoke,
    };
    await t.mutation(internal.e2eFixtures.resetCase, { ...scope, now: 0 });
    await t.mutation(internal.e2eFixtures.resetCase, {
      ...secondScope,
      now: 0,
    });
    const before = await t.query(internal.e2eFixtures.inspectCase, secondScope);
    await expect(
      t.mutation(internal.e2eFixtures.cleanupCase, {
        ...scope,
        workerKey: second.key,
      }),
    ).rejects.toThrow();
    await expect(
      t.query(internal.e2eFixtures.inspectCase, {
        ...scope,
        workerKey: second.key,
      }),
    ).rejects.toThrow();
    await t.mutation(internal.e2eFixtures.cleanupCase, scope);
    expect(
      await t.query(internal.e2eFixtures.inspectCase, secondScope),
    ).toEqual(before);
  });
  it('rolls back cleanup when a graph exceeds the bounded cleanup contract', async () => {
    const t = convexTest({ schema, modules });
    const { campaignId } = await t.mutation(internal.e2eFixtures.resetCase, {
      ...scope,
      now: 0,
    });
    await t.run(async (ctx) => {
      const militia = await ctx.db
        .query('militia')
        .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
        .unique();
      for (let index = 0; index < 101; index++)
        await ctx.db.insert('militiaEventState', {
          militiaId: militia!._id,
          weekNumber: 1,
          eventType: 'theft',
          isPersistent: true,
          startedWeek: 1,
          resolved: false,
        });
    });
    await expect(
      t.mutation(internal.e2eFixtures.cleanupCase, scope),
    ).rejects.toThrow('exceeds cleanup limit');
    expect(
      await t.query(internal.e2eFixtures.inspectCase, scope),
    ).toMatchObject({ campaignCount: 1, militia: { treasury: 100 } });
  });
});
