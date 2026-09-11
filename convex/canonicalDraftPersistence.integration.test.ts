// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import schema from './schema';
import { api, internal } from './_generated/api';
import { deploymentFixture } from '../e2e/support/test-data';
import type { FixtureScope } from '../e2e/fixtures/catalog';
import type { DraftOperation } from '../src/lib/weekly-draft-persistence-contract';

const initialize = internal.canonicalPersistenceFixtures.initialize;
const observe = api.canonicalDraftPersistence.observe;
const edit = api.canonicalDraftPersistence.edit;
const modules = import.meta.glob('./**/*.ts');
const fixtureScope: FixtureScope = {
  namespace: deploymentFixture.namespace,
  version: 1,
  workerKey: 'worker-0',
  caseKey: 'canonicalPersistence',
  token: 'c'.repeat(64),
};
beforeEach(() => {
  vi.stubEnv('E2E_ENABLED', 'true');
  vi.stubEnv('E2E_FIXTURE_CONFIG', JSON.stringify(deploymentFixture));
  vi.stubEnv('CONVEX_CLOUD_URL', deploymentFixture.convexUrl);
});
afterEach(() => vi.unstubAllEnvs());
async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.e2eFixtures.seedIdentityProjection, fixtureScope);
  await t.mutation(internal.e2eFixtures.resetCase, { ...fixtureScope, now: 1 });
  const key = await t.mutation(initialize, {
    scope: fixtureScope,
    draftId: 'canonical-contract',
  });
  const user = await t.run((ctx) => ctx.db.query('user').first());
  if (!user) throw Error('Missing fixture identity');
  const member = t.withIdentity({ tokenIdentifier: user.tokenIdentifier });
  const operation = (
    baseRevision: number,
    operationId: string,
    intent: DraftOperation['edit'],
  ): DraftOperation => ({
    draftId: key.draftId,
    operationId,
    baseRevision,
    edit: intent,
  });
  const send = (request: DraftOperation) =>
    member.mutation(edit, {
      campaignId: key.campaignId,
      militiaId: key.militiaId,
      operation: request,
    });
  return { t, key, member, operation, send };
}

test('[rules.P79.provenance] actual mutation derives stale field intent from stored provenance and commits atomically', async () => {
  const { t, key, member, operation, send } = await setup();
  const choice = { choiceId: 'a', actionId: 'earn_gold' as const };
  await send(operation(0, 'stage', { kind: 'stage', slotId: 'left', choice }));
  await send(
    operation(1, 'cost', {
      kind: 'detail',
      slotId: 'left',
      choiceId: 'a',
      choice: { ...choice, costCopper: 10 },
    }),
  );
  await send(
    operation(1, 'roll', {
      kind: 'detail',
      slotId: 'left',
      choiceId: 'a',
      choice: {
        ...choice,
        rolls: {
          check: {
            dice: [12],
            sides: 20,
            provenance: { kind: 'table' },
            modifiers: [],
          },
        },
      },
    }),
  );
  const accepted = await member.query(observe, key);
  expect(accepted.revision).toBe(3);
  expect(accepted.draft?.activity.slots[0]?.choice).toMatchObject({
    costCopper: 10,
    rolls: { check: { dice: [12] } },
  });
  await expect(
    send(
      operation(1, 'stale', {
        kind: 'replace',
        slotId: 'left',
        choiceId: 'a',
        choice: { choiceId: 'b', actionId: 'earn_gold' },
      }),
    ),
  ).rejects.toThrow('Target changed');
  await expect(
    send(
      operation(99, 'future', { kind: 'clear', slotId: 'left', choiceId: 'a' }),
    ),
  ).rejects.toThrow('Unknown base revision');
  await expect(
    Reflect.apply(member.mutation, member, [
      edit,
      {
        campaignId: key.campaignId,
        militiaId: key.militiaId,
        operation: {
          ...operation(1, 'forged', {
            kind: 'clear',
            slotId: 'left',
            choiceId: 'a',
          }),
          targets: [],
        },
      },
    ]),
  ).rejects.toThrow();
  expect(await member.query(observe, key)).toEqual(accepted);
  expect(
    await t.run((ctx) => ctx.db.query('canonicalDraftOperation').collect()),
  ).toHaveLength(3);
});

test('[rules.P79.authority] refused references, outsider access, and mismatched campaign or militia cannot mutate draft or dedup rows', async () => {
  const { t, key, member, operation, send } = await setup();
  const request = operation(0, 'foreign', {
    kind: 'stage',
    slotId: 'left',
    choice: {
      choiceId: 'a',
      actionId: 'rescue_character',
      characterId: 'foreign-character',
    },
  });
  await expect(send(request)).rejects.toThrow('Invalid draft entity reference');
  await expect(t.query(observe, key)).rejects.toThrow('Campaign access');
  const outsider = t.withIdentity({ tokenIdentifier: 'outsider' });
  await expect(
    outsider.mutation(edit, {
      campaignId: key.campaignId,
      militiaId: key.militiaId,
      operation: request,
    }),
  ).rejects.toThrow('Campaign access');
  const foreignCampaign = await t.run((ctx) =>
    ctx.db.insert('campaign', {
      name: 'Other',
      ownerId: 'other',
      organizationId: 'foreign',
      description: '',
    }),
  );
  await expect(
    member.query(observe, { ...key, campaignId: foreignCampaign }),
  ).rejects.toThrow();
  expect((await member.query(observe, key)).revision).toBe(0);
  expect(
    await t.run((ctx) => ctx.db.query('canonicalDraftOperation').collect()),
  ).toHaveLength(0);
  // The failed operation did not reserve its identity or write half a transaction.
  expect(
    (
      await send({
        ...request,
        edit: {
          kind: 'stage',
          slotId: 'left',
          choice: { choiceId: 'a', actionId: 'rescue_character' },
        },
      })
    ).acceptedRevision,
  ).toBe(1);
});

test('preview gate refuses canonical writes after fixture binding is disabled and cleanup removes all snapshots', async () => {
  const { t, key, member, operation, send } = await setup();
  await send(
    operation(0, 'one', {
      kind: 'stage',
      slotId: 'left',
      choice: { choiceId: 'a', actionId: 'earn_gold' },
    }),
  );
  vi.stubEnv('E2E_ENABLED', 'false');
  await expect(member.query(observe, key)).rejects.toThrow('not enabled');
  await expect(
    send(operation(1, 'two', { kind: 'clear', slotId: 'left', choiceId: 'a' })),
  ).rejects.toThrow('not enabled');
  vi.stubEnv('E2E_ENABLED', 'true');
  await t.mutation(internal.e2eFixtures.cleanupCase, fixtureScope);
  await t.run(async (ctx) => {
    expect(await ctx.db.query('canonicalWeeklyDraft').collect()).toHaveLength(
      0,
    );
    expect(
      await ctx.db.query('canonicalDraftOperation').collect(),
    ).toHaveLength(0);
    expect(await ctx.db.query('canonicalMilitiaState').collect()).toHaveLength(
      0,
    );
  });
});

test('all supplied entity references are campaign scoped even in partial decisions and adjustments', async () => {
  const { member, key, send, operation } = await setup();
  const invalid: DraftOperation['edit'][] = [
    {
      kind: 'table_adjustments',
      adjustments: [
        {
          kind: 'team_status',
          adjustmentId: 'foreign',
          teamId: 'foreign',
          status: 'missing',
          reason: 'test',
        },
      ],
    },
    {
      kind: 'stage',
      slotId: 'left',
      choice: {
        choiceId: 'cache',
        actionId: 'secure_cache',
        mode: 'retrieve',
        cacheId: 'foreign',
      },
    },
    {
      kind: 'stage',
      slotId: 'left',
      choice: {
        choiceId: 'rescue',
        actionId: 'rescue_character',
        destination: { kind: 'refuge', settlementId: 'foreign' },
      },
    },
    {
      kind: 'event_tree',
      occurrences: [
        {
          eventId: 'event',
          origin: { kind: 'rolled' },
          eventType: 'theft',
          overseerCharacterId: 'foreign',
        },
      ],
    },
  ];
  for (const [index, intent] of invalid.entries())
    await expect(
      send(operation(0, `invalid-${index}`, intent)),
    ).rejects.toThrow('Invalid draft entity reference');
  expect((await member.query(observe, key)).revision).toBe(0);
});

test('target tombstones live in indexed children and page reads restart before applying a stale cursor', async () => {
  const { t, key, member, send, operation } = await setup();
  let revision = 0;
  for (let index = 0; index < 20; index++) {
    await send(
      operation(revision++, `add-${index}`, {
        kind: 'acknowledge',
        acknowledgement: {
          acknowledgementId: `ack-${index}`,
          subjectId: 'table',
          outcome: 'Agreed',
        },
      }),
    );
    await send(
      operation(revision++, `clear-${index}`, {
        kind: 'clear_acknowledgement',
        acknowledgementId: `ack-${index}`,
      }),
    );
  }
  await t.run(async (ctx) => {
    const draft = await ctx.db
      .query('canonicalWeeklyDraft')
      .withIndex('by_draftId', (q) => q.eq('draftId', key.draftId))
      .unique();
    expect(draft).not.toHaveProperty('targetRevisions');
    const target = await ctx.db
      .query('canonicalDraftTarget')
      .withIndex('by_draftId_and_target', (q) =>
        q
          .eq('draftId', key.draftId)
          .eq('target', JSON.stringify(['acknowledgement', 'ack-0'])),
      )
      .unique();
    expect(target?.revision).toBe(2);
  });
  const request = {
    ...key,
    afterRevision: 0,
    observedRevision: 40,
    observedStatus: 'open' as const,
    paginationOpts: { numItems: 16, cursor: null },
  };
  const page = await member.query(
    api.canonicalDraftPersistence.targets,
    request,
  );
  expect(page.restart).toBe(false);
  expect(page.pagination?.page).toHaveLength(16);
  expect(page.pagination?.isDone).toBe(false);
  const limited = await member.query(api.canonicalDraftPersistence.targets, {
    ...request,
    paginationOpts: {
      numItems: 100,
      cursor: null,
      maximumRowsRead: 2,
      maximumBytesRead: 100000,
      id: 7,
    },
  });
  expect(limited.pagination?.page).toHaveLength(2);
  expect(limited.pagination?.pageStatus).toBe('SplitRequired');
  expect(limited.pagination?.splitCursor).toEqual(expect.any(String));
  const byteLimited = await member.query(
    api.canonicalDraftPersistence.targets,
    {
      ...request,
      paginationOpts: { numItems: 100, cursor: null, maximumBytesRead: 1 },
    },
  );
  expect(byteLimited.pagination?.page).toHaveLength(1);
  expect(byteLimited.pagination?.pageStatus).toBe('SplitRequired');
  const bounded = await member.query(api.canonicalDraftPersistence.targets, {
    ...request,
    paginationOpts: {
      numItems: 100,
      cursor: null,
      endCursor: page.pagination!.continueCursor,
    },
  });
  expect(bounded.pagination?.page).toEqual(page.pagination?.page);
  await send(operation(40, 'latest', { kind: 'event_chance', roll: null }));
  const stale = await member.query(api.canonicalDraftPersistence.targets, {
    ...request,
    paginationOpts: {
      ...request.paginationOpts,
      cursor: page.pagination!.continueCursor,
    },
  });
  expect(stale).toMatchObject({
    restart: true,
    pagination: null,
    observation: { revision: 41 },
  });
  await expect(
    send(
      operation(0, 'stale-ack', {
        kind: 'acknowledge',
        acknowledgement: {
          acknowledgementId: 'ack-0',
          subjectId: 'table',
          outcome: 'Old client',
        },
      }),
    ),
  ).rejects.toThrow('Target changed');
  expect((await member.query(observe, key)).revision).toBe(41);
  await t.mutation(internal.e2eFixtures.cleanupCase, fixtureScope);
  expect(
    await t.run((ctx) => ctx.db.query('canonicalDraftTarget').collect()),
  ).toHaveLength(0);
});
