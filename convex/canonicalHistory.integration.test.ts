// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import schema from './schema';
import { api, internal } from './_generated/api';
import { deploymentFixture } from '../e2e/support/test-data';
import { appendResolutionRecord } from './lib/canonicalDraftStorage';
const modules = import.meta.glob('./**/*.ts');
const scope = {
  namespace: deploymentFixture.namespace,
  version: 1,
  workerKey: 'worker-0',
  caseKey: 'canonicalPersistence' as const,
  token: 'c'.repeat(64),
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('E2E_ENABLED', 'true');
  vi.stubEnv('E2E_FIXTURE_CONFIG', JSON.stringify(deploymentFixture));
  vi.stubEnv('CONVEX_CLOUD_URL', deploymentFixture.convexUrl);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
async function setup(mixed = false) {
  const t = convexTest(schema, modules);
  await t.mutation(internal.e2eFixtures.seedIdentityProjection, scope);
  await t.mutation(internal.e2eFixtures.resetCase, { ...scope, now: 1 });
  const key = await t.mutation(
    internal.canonicalPersistenceFixtures.initialize,
    {
      scope,
      draftId: 'history-week',
    },
  );
  const users = await t.run((ctx) => ctx.db.query('user').collect());
  const identity = (role: string) => {
    const user = users.find((user) =>
      user.orgIds.some(
        (org) => org.orgId === 'org_members' && org.role === role,
      ),
    );
    if (!user) throw Error('Missing identity');
    return t.withIdentity({ tokenIdentifier: user.tokenIdentifier });
  };
  const player = identity('member');
  const gm = identity('admin');
  await player.mutation(api.canonicalDraftPersistence.edit, {
    campaignId: key.campaignId,
    militiaId: key.militiaId,
    operation: {
      draftId: key.draftId,
      operationId: 'chance',
      baseRevision: 0,
      edit: {
        kind: 'event_chance',
        roll: {
          ...(mixed ? { diceTotal: 100, diceCount: 1 } : { dice: [100] }),
          sides: 100,
          provenance: { kind: 'table' },
          modifiers: [],
        },
      },
    },
  });
  if (mixed)
    await player.mutation(api.canonicalDraftPersistence.edit, {
      campaignId: key.campaignId,
      militiaId: key.militiaId,
      operation: {
        draftId: key.draftId,
        operationId: 'legacy-training',
        baseRevision: 1,
        edit: {
          kind: 'upkeep_roll',
          field: 'training',
          roll: {
            dice: [3],
            sides: 6,
            provenance: { kind: 'generated', sourceId: 'table-dice' },
            modifiers: [{ sourceId: 'weather', value: -1, reason: 'Rain' }],
          },
        },
      },
    });
  const preview = await player.query(
    api.canonicalDraftPersistence.preview,
    key,
  );
  const { record } = await player.mutation(
    api.canonicalDraftPersistence.confirm,
    {
      ...key,
      operation: { operationId: 'finished', reviewed: preview.reviewed },
    },
  );
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  return { t, player, gm, key, record };
}
test('[rules.P86.history] history selects complete effective records, retains paged audit records, and survives live changes', async () => {
  const { t, player, gm, key, record } = await setup();
  const args = { campaignId: key.campaignId };
  const first = await player.query(api.canonicalHistory.read, args);
  expect(first?.record).toEqual(record);
  expect(first).not.toHaveProperty('canRewriteHistory');
  await t.run(async (ctx) => {
    const state = await ctx.db.query('canonicalMilitiaState').first();
    if (!state) throw Error('Missing state');
    await ctx.db.patch('canonicalMilitiaState', state._id, {
      snapshot: { ...state.snapshot, treasuryCopper: 99999 },
    });
    await ctx.db.patch('militia', key.militiaId, {
      name: 'Changed today',
    });
  });
  expect(await player.query(api.canonicalHistory.read, args)).toEqual(first);
  for (let i = 1; i <= 7; i++) {
    await gm.run((ctx) =>
      appendResolutionRecord(ctx, {
        campaignId: key.campaignId,
        militiaId: key.militiaId,
        record: {
          ...record,
          recordId: `correction-${i}`,
          provenance: 'historical_correction',
          supersedesRecordId: i === 1 ? record.recordId : `correction-${i - 1}`,
          finalOutcome: { formatVersion: 1, data: { treasuryCopper: i } },
        },
      }),
    );
  }
  const latest = await player.query(api.canonicalHistory.read, args);
  expect(latest?.record.finalOutcome.data).toEqual({ treasuryCopper: 7 });
  expect(latest?.effectiveRecordId).toBe('correction-7');
  expect(latest?.audit.map((item) => item.sequence)).toEqual([7, 6, 5, 4, 3]);
  const older = await player.query(api.canonicalHistory.read, {
    ...args,
    beforeSequence: latest!.earlierSequence!,
  });
  expect(older?.audit.map((item) => item.sequence)).toEqual([2, 1, 0]);
  expect(older?.earlierSequence).toBeNull();
  const original = await player.query(api.canonicalHistory.read, {
    ...args,
    recordId: record.recordId,
  });
  expect(original?.record).toEqual(record);
  expect(original?.effectiveRecordId).toBe('correction-7');
  expect(await gm.query(api.canonicalHistory.read, args)).toEqual(
    await player.query(api.canonicalHistory.read, args),
  );
});

test('[rules.P86.authority] campaign members can append corrections while outsiders cannot and closed drafts stay immutable', async () => {
  const { t, player, gm, key, record } = await setup();
  const args = { campaignId: key.campaignId };
  const before = await player.query(api.canonicalHistory.read, args);
  await expect(t.query(api.canonicalHistory.read, args)).rejects.toThrow(
    'Campaign access',
  );
  await expect(
    t
      .withIdentity({ tokenIdentifier: 'outsider' })
      .query(api.canonicalHistory.read, args),
  ).rejects.toThrow('Campaign access');
  const correction = {
    ...record,
    recordId: 'correction',
    provenance: 'historical_correction' as const,
    supersedesRecordId: record.recordId,
  };
  await expect(
    t.withIdentity({ tokenIdentifier: 'outsider' }).run((ctx) =>
      appendResolutionRecord(ctx, {
        campaignId: key.campaignId,
        militiaId: key.militiaId,
        record: correction,
      }),
    ),
  ).rejects.toThrow('Campaign access');
  expect(await player.query(api.canonicalHistory.read, args)).toEqual(before);
  await player.run((ctx) =>
    appendResolutionRecord(ctx, {
      campaignId: key.campaignId,
      militiaId: key.militiaId,
      record: correction,
    }),
  );
  expect((await player.query(api.canonicalHistory.read, args))?.record).toEqual(
    correction,
  );
  expect(await gm.query(api.canonicalHistory.read, args)).toEqual(
    await player.query(api.canonicalHistory.read, args),
  );
  expect(
    (
      await player.query(api.canonicalHistory.read, {
        ...args,
        recordId: record.recordId,
      })
    )?.record,
  ).toEqual(record);
  await expect(
    player.mutation(api.canonicalDraftPersistence.edit, {
      campaignId: key.campaignId,
      militiaId: key.militiaId,
      operation: {
        draftId: key.draftId,
        operationId: 'reopen',
        baseRevision: 1,
        edit: { kind: 'event_chance', roll: null },
      },
    }),
  ).rejects.toThrow('Draft is closed');
  vi.stubEnv('E2E_ENABLED', 'false');
  expect((await gm.query(api.canonicalHistory.read, args))?.record).toEqual(
    correction,
  );
});

test('[rules.P86.navigation] week navigation skips gaps and rejects records from another week or campaign', async () => {
  const { t, player, gm, key, record } = await setup();
  const args = { campaignId: key.campaignId };
  await gm.run((ctx) =>
    appendResolutionRecord(ctx, {
      campaignId: key.campaignId,
      militiaId: key.militiaId,
      record: {
        ...record,
        recordId: 'older',
        provenance: 'historical_reconstruction',
        source: { ...record.source, week: 0, draftId: 'older-draft' },
      },
    }),
  );
  expect(await player.query(api.canonicalHistory.read, args)).toMatchObject({
    week: 1,
    previousWeek: 0,
    nextWeek: null,
  });
  expect(
    await player.query(api.canonicalHistory.read, { ...args, week: 0 }),
  ).toMatchObject({
    week: 0,
    previousWeek: null,
    nextWeek: 1,
    record: { recordId: 'older' },
  });
  expect(
    await player.query(api.canonicalHistory.read, { ...args, week: 8 }),
  ).toBeNull();
  await expect(
    player.query(api.canonicalHistory.read, { ...args, recordId: 'older' }),
  ).rejects.toThrow('historical week reference');
  await expect(
    player.query(api.canonicalHistory.read, { ...args, recordId: 'missing' }),
  ).rejects.toThrow('historical week reference');
  const foreign = await t.run(async (ctx) => {
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Foreign',
      description: '',
      ownerId: 'other',
      organizationId: 'org_members',
    });
    const militiaId = await ctx.db.insert('militia', {
      campaignId,
      name: 'Foreign',
    });
    return { campaignId, militiaId };
  });
  await gm.run((ctx) =>
    appendResolutionRecord(ctx, {
      ...foreign,
      record: {
        ...record,
        recordId: 'foreign',
        provenance: 'historical_reconstruction',
        source: { ...record.source, draftId: 'foreign-draft' },
      },
    }),
  );
  await expect(
    player.query(api.canonicalHistory.read, { ...args, recordId: 'foreign' }),
  ).rejects.toThrow('Invalid record reference');
});

test('mixed confirmed history remains exact across selectors, live changes and denied reads', async () => {
  const { t, player, key, record } = await setup(true);
  expect(record.source.event.chanceRoll).toEqual({
    diceTotal: 100,
    diceCount: 1,
    sides: 100,
    provenance: { kind: 'table' },
    modifiers: [],
  });
  expect(record.source.upkeep.rolls.training).toEqual({
    dice: [3],
    sides: 6,
    provenance: { kind: 'generated', sourceId: 'table-dice' },
    modifiers: [{ sourceId: 'weather', value: -1, reason: 'Rain' }],
  });
  const storedBefore = await t.run((ctx) =>
    ctx.db.query('canonicalResolutionRecord').take(2),
  );
  await t.run(async (ctx) => {
    const state = await ctx.db.query('canonicalMilitiaState').unique();
    if (!state) throw Error('Missing state');
    await ctx.db.patch('canonicalMilitiaState', state._id, {
      snapshot: { ...state.snapshot, treasuryCopper: 99999, training: 99 },
    });
  });
  for (const selector of [
    {},
    { week: record.source.week },
    { recordId: record.recordId },
  ]) {
    expect(
      (
        await player.query(api.canonicalHistory.read, {
          campaignId: key.campaignId,
          ...selector,
        })
      )?.record,
    ).toEqual(record);
  }
  await expect(
    t
      .withIdentity({ tokenIdentifier: 'outsider' })
      .query(api.canonicalHistory.read, {
        campaignId: key.campaignId,
        recordId: record.recordId,
      }),
  ).rejects.toThrow('Campaign access');
  expect(
    await t.run((ctx) => ctx.db.query('canonicalResolutionRecord').take(2)),
  ).toEqual(storedBefore);
});
