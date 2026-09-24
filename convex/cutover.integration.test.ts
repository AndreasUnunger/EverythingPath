// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api, internal } from './_generated/api';
import schema from './schema';
import { seedInitializationCampaign } from './lib/initializationFixture';

const modules = import.meta.glob('./**/*.ts');

test('[retirement.preserve] activation requires a verified backup and preserved initialized campaigns, and reopening ends rollback', async () => {
  const t = convexTest(schema, modules);
  const member = t.withIdentity({ tokenIdentifier: 'test|gm' });
  const { scope, characterId } = await member.run((ctx) =>
    seedInitializationCampaign(ctx),
  );
  await expect(
    t.query(internal.cutover.preflight, {
      ...scope,
      operatorTokenIdentifier: 'outsider',
    }),
  ).rejects.toThrow('Campaign access required');
  const operationId = 'activate-dev';
  await t.mutation(internal.cutover.pause, {
    operationId,
    oldRelease: 'old',
    newRelease: 'new',
    campaignIds: [scope.campaignId],
  });
  const plan = JSON.parse(
    await member.query(internal.cutover.preflight, scope),
  );
  const input = {
    ...scope,
    operatorTokenIdentifier: 'test|gm',
    operationId,
    initializationId: 'reviewed-dev',
    sourceToken: plan.sourceToken,
  };
  await expect(t.mutation(internal.cutover.initialize, input)).rejects.toThrow(
    'Verify the paused backup',
  );
  await t.mutation(internal.cutover.recordBackup, {
    operationId,
    sha256: 'a'.repeat(64),
    location: '/private/backup.zip',
    verifiedRestoreDeployment: 'disposable-preview',
    retainUntil: Date.now() + 86400000,
  });
  await expect(
    member.mutation(internal.cutover.activate, { operationId }),
  ).rejects.toThrow('preservation/reset');
  const first = await t.mutation(internal.cutover.initialize, input);
  expect(await t.mutation(internal.cutover.initialize, input)).toEqual({
    ...first,
    initialized: false,
  });
  expect(await member.query(internal.cutover.verify, { operationId })).toEqual([
    { campaignId: scope.campaignId, week: 9 },
  ]);
  await member.mutation(internal.cutover.activate, { operationId });
  expect(await member.query(api.cutover.status, {})).toBe('canonical');
  const workspace = await member.query(
    api.canonicalDraftPersistence.workspace,
    { campaignId: scope.campaignId },
  );
  expect(workspace?.snapshot.treasuryCopper).toBe(12345);
  expect(workspace?.key.draftId).toBe(first.draftId);
  const ledger = await member.query(api.canonicalLedger.read, scope);
  await expect(
    member.mutation(api.canonicalLedger.save, {
      ...scope,
      expectedRevision: ledger.revision,
      snapshot: {
        ...ledger.state.militiaSnapshot,
        roster: { ...ledger.state.militiaSnapshot.roster, teams: [] },
      },
      reason: 'Remove a team still targeted by a carried event',
    }),
  ).rejects.toThrow('Keep entities referenced by carried events');
  await member.mutation(api.canonicalLedger.save, {
    ...scope,
    expectedRevision: ledger.revision,
    snapshot: { ...ledger.state.militiaSnapshot, treasuryCopper: 20000 },
    reason: 'Table correction',
  });
  await expect(
    member.mutation(api.canonicalLedger.save, {
      ...scope,
      expectedRevision: ledger.revision,
      snapshot: ledger.state.militiaSnapshot,
      reason: 'Stale correction',
    }),
  ).rejects.toThrow('Militia changed');
  await member.mutation(api.character.updateCharacter, {
    organizationId: 'org',
    characterId,
    patch: { charisma: 20 },
  });
  const updated = await member.query(api.canonicalLedger.read, scope);
  expect(updated.state.militiaSnapshot.treasuryCopper).toBe(20000);
  expect(updated.state.militiaSnapshot.characters[0]?.charisma).toBe(20);
  expect(updated.state.week).toBe(9);
  expect(updated.state.context).toEqual(ledger.state.context);
  await expect(
    t.mutation(internal.cutover.resumeLegacy, { operationId }),
  ).rejects.toThrow('automatic rollback ends');
  await expect(
    member.mutation(api.weekBoard.applyTreasuryTransaction, {
      militiaId: scope.militiaId,
      organizationId: 'org',
      depositTotal: '50',
    }),
  ).rejects.toThrow('Open the current militia week');
  await expect(
    t
      .withIdentity({ tokenIdentifier: 'outsider' })
      .query(api.canonicalDraftPersistence.workspace, {
        campaignId: scope.campaignId,
      }),
  ).rejects.toThrow('Campaign access required');
  const retained = await member.query(api.canonicalDraftPersistence.workspace, {
    campaignId: scope.campaignId,
  });
  await expect(
    t.mutation(internal.legacyRetirement.batch, {
      operationId,
      militiaId: scope.militiaId,
      backupSha256: 'b'.repeat(64),
    }),
  ).rejects.toThrow('retained verified backup');
  let done = false;
  let deleted = 0;
  for (let attempt = 0; attempt < 100 && !done; attempt++) {
    const result = await t.mutation(internal.legacyRetirement.batch, {
      operationId,
      militiaId: scope.militiaId,
      backupSha256: 'a'.repeat(64),
    });
    expect(result.deleted).toBeLessThanOrEqual(4);
    deleted += result.deleted;
    done = result.done;
  }
  expect(done).toBe(true);
  expect(deleted).toBeGreaterThan(0);
  expect(
    await member.query(api.canonicalDraftPersistence.workspace, {
      campaignId: scope.campaignId,
    }),
  ).toEqual(retained);
  expect(
    await t.mutation(internal.legacyRetirement.batch, {
      operationId,
      militiaId: scope.militiaId,
      backupSha256: 'a'.repeat(64),
    }),
  ).toEqual({ deleted: 0, done: true });
  const identity = await t.run((ctx) => ctx.db.get('militia', scope.militiaId));
  expect(identity).not.toHaveProperty('treasury');
  expect(
    await t.run((ctx) => ctx.db.query('militiaWeekState').collect()),
  ).toEqual([]);
});

test('a cutover pause refuses campaign writes while preserving readable campaign state', async () => {
  const t = convexTest(schema, modules);
  const member = t.withIdentity({ tokenIdentifier: 'test|gm' });
  const { scope } = await member.run((ctx) => seedInitializationCampaign(ctx));
  expect(await member.query(api.cutover.status, {})).toBe('canonical');
  await t.mutation(internal.cutover.pause, {
    operationId: 'dev-cutover',
    oldRelease: 'old-release',
    newRelease: 'candidate-release',
    campaignIds: [scope.campaignId],
  });
  expect(await member.query(api.cutover.status, {})).toBe('paused');
  await expect(
    member.mutation(api.campaign.createCampaign, {
      name: 'New campaign',
      description: '',
      organizationId: 'org',
    }),
  ).rejects.toThrow('Campaign editing is paused');
  await expect(
    member.mutation(api.weekBoard.applyTreasuryTransaction, {
      militiaId: scope.militiaId,
      organizationId: 'org',
      depositTotal: '50',
    }),
  ).rejects.toThrow('Open the current militia week');
  await expect(
    member.mutation(api.canonicalDraftPersistence.edit, {
      ...scope,
      operation: {
        operationId: 'during-pause',
        draftId: 'uninitialized',
        baseRevision: 0,
        edit: { kind: 'upkeep_roll', field: 'check', roll: null },
      },
    }),
  ).rejects.toThrow('Campaign editing is paused');
  const campaign = await t.run((ctx) =>
    ctx.db.get('campaign', scope.campaignId),
  );
  expect(campaign).not.toBeNull();
});
