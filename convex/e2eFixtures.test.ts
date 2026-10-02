/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from './_generated/api';
import schema from './schema';
import { deploymentFixture } from '../e2e/support/test-data';
import { canonicalCaseKeys, type FixtureScope } from '../e2e/fixtures/catalog';
import { confirmationInspectionSchema } from '../src/lib/weekly-confirmation-contract';
import { weeklyDraftSchema } from '../src/lib/weekly-draft-contract';
import { projectUpkeep } from '../src/lib/rules-upkeep';

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
const characterSheet: FixtureScope = {
  ...scope,
  caseKey: 'characterSheet',
  token: '34'.repeat(32),
};
const privateCharacter: FixtureScope = {
  ...scope,
  caseKey: 'privateCharacter',
  token: '56'.repeat(32),
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
      const source = await ctx.db
        .query('canonicalMilitiaState')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', militia!._id))
        .unique();
      await ctx.db.patch('canonicalMilitiaState', source!._id, {
        snapshot: { ...source!.snapshot, treasuryCopper: 99900 },
      });
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
        phase: 'upkeep',
        stagedActions: [null, null, null],
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
      militia: { week: 1, phase: 'upkeep' },
    });
  });
  it('seeds a shared Character Sheet fixture with no access for outsiders', async () => {
    const t = convexTest({ schema, modules });
    await t.mutation(
      internal.e2eFixtures.seedIdentityProjection,
      characterSheet,
    );
    const { campaignId } = await t.mutation(internal.e2eFixtures.resetCase, {
      ...characterSheet,
      now: 0,
      isolatedWith: ['characterSheet'],
    });
    const owner = t.withIdentity({
      tokenIdentifier: `https://${deploymentFixture.clerkHost}|user_gm`,
    });
    const member = t.withIdentity({
      tokenIdentifier: `https://${deploymentFixture.clerkHost}|user_player`,
    });
    const outsider = t.withIdentity({
      tokenIdentifier: `https://${deploymentFixture.clerkHost}|user_outsider`,
    });
    const args = { campaignId, organizationId: 'org_members' };
    const characters = await owner.query(api.character.listByCampaign, args);
    expect(characters).toMatchObject([
      {
        name: 'E2E character-sheet-character',
        kind: 'pc',
        level: 1,
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
    ]);
    expect(await member.query(api.character.listByCampaign, args)).toEqual(
      characters,
    );
    expect(await outsider.query(api.character.listByCampaign, args)).toEqual(
      [],
    );
    const character = characters[0];
    if (!character) throw new Error('Missing fixture Character');
    const sheetArgs = {
      organizationId: args.organizationId,
      characterId: character._id,
    };
    const sheet = await owner.query(api.characterSheet.read, sheetArgs);
    expect(sheet).toMatchObject({
      character: { _id: sheetArgs.characterId, sheetMode: 'full' },
      calculated: {
        level: 1,
        hitDice: 1,
        hp: null,
        abilities: {
          strength: { score: 10, modifier: 0 },
          dexterity: { score: 10, modifier: 0 },
          constitution: { score: 10, modifier: 0 },
          intelligence: { score: 10, modifier: 0 },
          wisdom: { score: 10, modifier: 0 },
          charisma: { score: 10, modifier: 0 },
        },
      },
    });
    expect(sheet?.entries).toHaveLength(2);
    expect(sheet?.entries.find((entry) => entry.kind === 'base')).toMatchObject(
      {
        active: true,
        state: { kind: 'base' },
      },
    );
    expect(
      sheet?.entries.find((entry) => entry.kind === 'classLevel'),
    ).toMatchObject({
      active: true,
      state: {
        kind: 'classLevel',
        classEntryId: null,
        position: 1,
        hpGained: null,
      },
    });
    expect(sheet?.catalogEntries).toHaveLength(1);
    expect(sheet?.baseScoresEntry.modifiers).toHaveLength(6);
    expect(await member.query(api.characterSheet.read, sheetArgs)).toEqual(
      sheet,
    );
    await expect(
      outsider.query(api.characterSheet.read, sheetArgs),
    ).rejects.toThrow();
  });
  it('resets and cleans fixture sheets without leaving catalogEntries or changing another case', async () => {
    const t = convexTest({ schema, modules });
    await t.mutation(
      internal.e2eFixtures.seedIdentityProjection,
      characterSheet,
    );
    await t.mutation(internal.e2eFixtures.resetCase, { ...isolation, now: 0 });
    const comparison = await t.query(
      internal.e2eFixtures.inspectCase,
      isolation,
    );
    const first = await t.mutation(internal.e2eFixtures.resetCase, {
      ...characterSheet,
      now: 0,
    });
    const owner = t.withIdentity({
      tokenIdentifier: `https://${deploymentFixture.clerkHost}|user_gm`,
    });
    const createdId = await owner.mutation(api.characterSheet.create, {
      organizationId: 'org_members',
      campaignId: first.campaignId,
      name: 'Created during play',
      kind: 'pc',
      operationId: 'create-during-play',
    });
    expect(
      await owner.query(api.characterSheet.read, {
        organizationId: 'org_members',
        characterId: createdId,
      }),
    ).toMatchObject({ character: { name: 'Created during play' } });
    const second = await t.mutation(internal.e2eFixtures.resetCase, {
      ...characterSheet,
      now: 0,
    });
    expect(
      await owner.query(api.character.listByCampaign, {
        organizationId: 'org_members',
        campaignId: first.campaignId,
      }),
    ).toEqual([]);
    const reset = await owner.query(api.character.listByCampaign, {
      organizationId: 'org_members',
      campaignId: second.campaignId,
    });
    expect(reset).toHaveLength(1);
    const character = reset[0];
    if (!character) throw new Error('Missing reset Character');
    expect(
      await t.query(internal.e2eFixtures.inspectCase, characterSheet),
    ).toMatchObject({
      characterIds: [character._id],
    });
    const sheet = await owner.query(api.characterSheet.read, {
      organizationId: 'org_members',
      characterId: character._id,
    });
    expect(sheet?.entries).toHaveLength(2);
    expect(sheet?.calculated).toMatchObject({ level: 1, hp: null });
    // Storage invariant: reset removes unreachable rows, including new sheets
    // created through the application after the original seed.
    expect(
      await t.run(async (ctx) => ({
        entries: (await ctx.db.query('characterSheetEntry').collect()).length,
        catalogEntries: (await ctx.db.query('catalogEntry').collect()).length,
      })),
    ).toEqual({ entries: 2, catalogEntries: 1 });
    await t.mutation(internal.e2eFixtures.cleanupCase, characterSheet);
    await t.mutation(internal.e2eFixtures.cleanupCase, characterSheet);
    expect(
      await owner.query(api.character.listByCampaign, {
        organizationId: 'org_members',
        campaignId: second.campaignId,
      }),
    ).toEqual([]);
    expect(
      await t.run(async (ctx) => ({
        entries: (await ctx.db.query('characterSheetEntry').collect()).length,
        catalogEntries: (await ctx.db.query('catalogEntry').collect()).length,
      })),
    ).toEqual({ entries: 0, catalogEntries: 0 });
    expect(await t.query(internal.e2eFixtures.inspectCase, isolation)).toEqual(
      comparison,
    );
  });
  it('grants private sheets only while the private-character case is reset and removes them on reset and cleanup', async () => {
    const t = convexTest({ schema, modules });
    await t.mutation(
      internal.e2eFixtures.seedIdentityProjection,
      privateCharacter,
    );
    const owner = t.withIdentity({
      tokenIdentifier: `https://${deploymentFixture.clerkHost}|user_gm`,
    });
    const createPrivate = (name: string) =>
      owner.mutation(api.characterSheet.create, {
        name,
        kind: 'pc',
        operationId: name,
      });
    const unavailable =
      "Private character sheets aren't available for your account yet.";
    // The Character Sheet case shares the cohort's identities but not the grant.
    await t.mutation(internal.e2eFixtures.resetCase, {
      ...characterSheet,
      now: 0,
    });
    await expect(createPrivate('Sheet case')).rejects.toThrow(unavailable);
    await t.mutation(internal.e2eFixtures.cleanupCase, characterSheet);
    await t.mutation(internal.e2eFixtures.resetCase, {
      ...privateCharacter,
      now: 0,
    });
    const privateId = await createPrivate('Private demo');
    expect(
      await owner.query(api.characterSheet.read, { characterId: privateId }),
    ).toMatchObject({ character: { name: 'Private demo' } });
    await t.mutation(internal.e2eFixtures.resetCase, {
      ...privateCharacter,
      now: 0,
    });
    await expect(
      owner.query(api.characterSheet.read, { characterId: privateId }),
    ).rejects.toThrow('Character not found');
    const leftover = await createPrivate('Left by a failed attempt');
    await t.mutation(internal.e2eFixtures.cleanupCase, privateCharacter);
    await expect(
      owner.query(api.characterSheet.read, { characterId: leftover }),
    ).rejects.toThrow('Character not found');
    await expect(createPrivate('After cleanup')).rejects.toThrow(unavailable);
    expect(
      await t.run(async (ctx) => ({
        characters: (await ctx.db.query('character').collect()).length,
        entries: (await ctx.db.query('characterSheetEntry').collect()).length,
      })),
    ).toEqual({ characters: 0, entries: 0 });
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
        phase: 'upkeep',
        training: 0,
        treasury: 100,
        stagedActions: [null, null, null],
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
        kind: 'pc',
        isActive: true,
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
        characterSheet: 'w'.repeat(64),
        privateCharacter: 'x'.repeat(64),
        completeWeek: 'g'.repeat(64),
        canonicalPersistence: 'c'.repeat(64),
        realtimeActionSlot: 'h'.repeat(64),
        workspaceUpkeep: 'i'.repeat(64),
        workspaceNotoriety: 'j'.repeat(64),
        workspaceRecovery: 'k'.repeat(64),
        workspacePersistent: 'l'.repeat(64),
        workspaceConfirmation: 'm'.repeat(64),
        workspaceUpkeepLayout: 'r'.repeat(64),
        workspaceEventReview: 's'.repeat(64),
        workspaceActivity: 's'.repeat(64),
        workspaceSettlementTouch: 't'.repeat(64),
        workspaceDrillRolls: 'u'.repeat(64),
        workspaceRecoveryActivity: 'v'.repeat(64),
        campaignHome: 'n'.repeat(64),
        campaignSections: 'o'.repeat(64),
        weekLinks: 'q'.repeat(64),
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
        await ctx.db.insert('canonicalSourceCorrection', {
          campaignId,
          militiaId: militia!._id,
          expectedRevision: index,
          revision: index + 1,
          reason: 'Fixture',
          actor: 'fixture',
          createdAt: 0,
        });
    });
    await expect(
      t.mutation(internal.e2eFixtures.cleanupCase, scope),
    ).rejects.toThrow('exceeds cleanup limit');
    expect(
      await t.query(internal.e2eFixtures.inspectCase, scope),
    ).toMatchObject({ campaignCount: 1, militia: { treasury: 100 } });
  });

  describe('isolation canary', () => {
    const existing: FixtureScope = {
      ...scope,
      caseKey: 'existingMilitia',
      token: 'd'.repeat(64),
    };
    const campaignNames = (t: ReturnType<typeof convexTest>) =>
      t.run(async (ctx) =>
        (await ctx.db.query('campaign').collect()).map((row) => row.name),
      );

    it('accepts the owned and comparison campaigns of the running test', async () => {
      const t = convexTest({ schema, modules });
      await t.mutation(internal.e2eFixtures.resetCase, {
        ...existing,
        now: 0,
        isolatedWith: ['existingMilitia', 'isolation'],
      });
      await t.mutation(internal.e2eFixtures.resetCase, {
        ...isolation,
        now: 0,
        isolatedWith: ['existingMilitia', 'isolation'],
      });
      expect(await campaignNames(t)).toHaveLength(2);
    });

    it.each([
      [
        'another case of the same cohort',
        async (t: ReturnType<typeof convexTest>) => {
          await t.mutation(internal.e2eFixtures.resetCase, {
            ...characterLedger,
            now: 0,
          });
        },
      ],
      [
        'an unowned campaign in the member organization',
        async (t: ReturnType<typeof convexTest>) => {
          await t.run(async (ctx) => {
            await ctx.db.insert('campaign', {
              name: 'Unowned campaign',
              ownerId: 'unowned',
              organizationId: 'org_members',
              description: '',
            });
          });
        },
      ],
      [
        'a campaign in the outsider organization',
        async (t: ReturnType<typeof convexTest>) => {
          await t.run(async (ctx) => {
            await ctx.db.insert('campaign', {
              name: 'Outsider campaign',
              ownerId: 'outsider',
              organizationId: 'org_outsiders',
              description: '',
            });
          });
        },
      ],
    ])('fails the reset and rolls it back with %s', async (_label, leak) => {
      const t = convexTest({ schema, modules });
      await leak(t);
      const before = await campaignNames(t);
      await expect(
        t.mutation(internal.e2eFixtures.resetCase, {
          ...scope,
          now: 0,
          isolatedWith: ['smoke'],
        }),
      ).rejects.toThrow('E2E isolation canary');
      expect(await campaignNames(t)).toEqual(before);
    });

    it('fails a contract reset through resetAndInitialize', async () => {
      const t = convexTest({ schema, modules });
      await t.mutation(internal.e2eFixtures.resetCase, { ...scope, now: 0 });
      await expect(
        t.mutation(internal.canonicalPersistenceFixtures.resetAndInitialize, {
          scope: {
            ...scope,
            caseKey: 'canonicalPersistence',
            token: 'c'.repeat(64),
          },
          draftId: 'draft',
          now: 0,
          isolatedWith: ['canonicalPersistence', 'isolation'],
        }),
      ).rejects.toThrow('E2E isolation canary');
    });

    it('requires the reset case in the checked set', async () => {
      const t = convexTest({ schema, modules });
      await expect(
        t.mutation(internal.e2eFixtures.resetCase, {
          ...scope,
          now: 0,
          isolatedWith: ['isolation'],
        }),
      ).rejects.toThrow('must include the reset case');
    });
  });

  const [cohort] = deploymentFixture.workers;
  it.each(canonicalCaseKeys)(
    'starts canonical case %s with a bare militia for its canonical fixture',
    async (caseKey) => {
      const t = convexTest({ schema, modules });
      const owned: FixtureScope = {
        ...scope,
        caseKey,
        token: cohort?.cases[caseKey] ?? '',
      };
      await t.mutation(internal.e2eFixtures.resetCase, {
        ...owned,
        now: 0,
        isolatedWith: [caseKey],
      });
      expect(
        await t.query(internal.e2eFixtures.inspectCase, owned),
      ).toMatchObject({
        campaignKey: 'canonical-persistence-campaign',
        campaignCount: 1,
        militia: null,
      });
      await t.mutation(internal.canonicalPersistenceFixtures.initializeUpkeep, {
        scope: owned,
        draftId: `draft-${caseKey}`,
      });
      expect(
        await t.query(internal.e2eFixtures.inspectCase, owned),
      ).toMatchObject({ militia: { week: 4, treasury: 50 } });
    },
  );

  // The recovery Activity journey (#198) opens on the week the recovery
  // journey reaches through Upkeep, so its seed must leave nothing to enter.
  it('seeds the adjusted Scouts recovery as a complete Upkeep', async () => {
    const t = convexTest({ schema, modules });
    const caseKey = 'workspaceRecoveryActivity';
    const owned: FixtureScope = {
      ...scope,
      caseKey,
      token: cohort?.cases[caseKey] ?? '',
    };
    await t.mutation(internal.e2eFixtures.resetCase, {
      ...owned,
      now: 0,
      isolatedWith: [caseKey],
    });
    await expect(
      t.mutation(internal.canonicalPersistenceFixtures.initializeUpkeep, {
        scope: owned,
        draftId: 'draft-without-choices',
        adjustedRecovery: true,
      }),
    ).rejects.toThrow('An adjusted recovery needs the Scouts choice');
    const key = await t.mutation(
      internal.canonicalPersistenceFixtures.initializeUpkeep,
      {
        scope: owned,
        draftId: 'draft-adjusted-recovery',
        choices: true,
        adjustedRecovery: true,
      },
    );
    const inspected = confirmationInspectionSchema.parse(
      await t.mutation(internal.canonicalPersistenceFixtures.inspect, {
        ...key,
        scope: owned,
      }),
    );
    const draft = weeklyDraftSchema.parse(inspected.source.draft);
    // Nothing left to enter: both rolls are complete for their rule
    // specifications (a successful check's training roll is 1d6).
    expect(projectUpkeep(draft, inspected.snapshot).requirements).toEqual([]);
    expect(draft.upkeep.teamDecisions).toEqual([
      { teamId: 'upkeep-scouts', decision: 'recover', costCopper: 2000 },
    ]);
    expect(draft.tableAdjustments).toEqual([
      expect.objectContaining({
        adjustmentId: 'upkeep-recovery:upkeep-scouts',
        field: 'treasuryCopper',
        value: 500,
        reason: 'Local healer donated supplies',
      }),
    ]);
    expect(Object.values(draft.upkeep.rolls)).toEqual([
      expect.objectContaining({ diceTotal: 10, diceCount: 1, sides: 20 }),
      expect.objectContaining({ diceTotal: 3, diceCount: 1, sides: 6 }),
    ]);
  });
});
