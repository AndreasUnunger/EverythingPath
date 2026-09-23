import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { api } from '../convex/_generated/api';
import { draftKeySchema } from '../convex/lib/canonicalStorageValidators';
import { militiaSnapshotSchema } from '../src/lib/canonical-weekly-source';
import { weeklyDraftDataSchema } from '../src/lib/weekly-draft-contract';
import { createConvexDraftTransport } from '../src/lib/convex-draft-persistence';
import { initializationEdits } from '../tests/rules/initialization-edits';
import { test, expect } from './support/fixtures';
import { prepareContract } from './support/canonical-contract';
import { command, savePrivate } from './support/process';

const inspectionSchema = z.object({
  hasOperations: z.boolean(),
  hasTargets: z.boolean(),
  plan: z.object({
    ready: z.boolean(),
    issues: z.array(z.string()),
    sourceToken: z.string(),
    snapshot: militiaSnapshotSchema.nullable(),
  }),
  drafts: z.array(
    z.object({
      draft: weeklyDraftDataSchema.nullable(),
      status: z.enum(['open', 'closed']),
      revision: z.number(),
    }),
  ),
  records: z.array(z.unknown()),
  legacyWeek: z.unknown(),
  legacyHistory: z.array(z.unknown()),
  state: z
    .object({ snapshot: militiaSnapshotSchema, revision: z.number() })
    .nullable(),
});

test.use({ caseKey: 'canonicalPersistence', comparisonCaseKey: 'isolation' });
test('paused cutover preserves source and restores verified backup before reopening', async ({
  players,
  ownedCase,
  comparisonCase,
}) => {
  test.setTimeout(300_000);
  const { run, connect } = await prepareContract(
    players,
    comparisonCase!.scope,
  );
  // /campaigns mounts the legacy board and can autosave deterministic defaults.
  // Move every player off the board before creating the paused source.
  for (const page of Object.values(players)) {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Landing page' }),
    ).toBeVisible();
    await page.waitForFunction(() => Boolean(window.Clerk?.session));
  }
  const client = connect(players.gm);
  const selection = [
    '--preview-name',
    run.resources.previewName,
    '--env-file',
    run.envFile,
  ];
  const step = async (
    step: 'seed' | 'inspect' | 'initialize',
    sourceToken?: string,
  ): Promise<unknown> =>
    JSON.parse(
      await client.mutation(api.canonicalPersistenceFixtures.rehearseCutover, {
        scope: ownedCase.scope,
        step,
        sourceToken,
      }),
    ) as unknown;
  const inspect = async () => inspectionSchema.parse(await step('inspect'));
  try {
    // The suite owns this preview exclusively and runs one worker. No player
    // opens a board during the pause; all writes below are isolated acceptance.
    const scope = draftKeySchema
      .omit({ draftId: true })
      .parse(await step('seed'));
    const before = await inspect();
    expect(before.plan.issues).toEqual([]);
    expect(before.plan.ready).toBe(true);
    expect(before.drafts).toEqual([]);
    expect(before.records).toEqual([]);
    expect(before.state).toBeNull();
    const legacyBefore = await client.query(api.weekBoard.getWeekBoardState, {
      campaignId: scope.campaignId,
      organizationId: run.resources.workers[0]!.organizationId,
    });
    expect(legacyBefore).not.toBeNull();
    const backup = join(run.privateDirectory, 'cutover-backup.zip');
    await command(
      'paused preview backup',
      [
        'exec',
        'convex',
        'export',
        '--include-file-storage',
        '--path',
        backup,
        ...selection,
      ],
      { cwd: run.workspace },
    );
    const backupHash = createHash('sha256')
      .update(await readFile(backup))
      .digest('hex');
    expect(await inspect()).toEqual(before);

    const initialized = z
      .object({ draftId: z.string(), initialized: z.boolean() })
      .parse(await step('initialize', before.plan.sourceToken));
    expect(initialized.initialized).toBe(true);
    expect(await step('initialize', before.plan.sourceToken)).toEqual({
      ...initialized,
      initialized: false,
    });
    const key = { ...scope, draftId: initialized.draftId };
    const after = await inspect();
    expect(after.plan).toEqual(before.plan);
    expect(after.legacyWeek).toEqual(before.legacyWeek);
    expect(after.legacyHistory).toEqual(before.legacyHistory);
    expect(after.records).toEqual([]);
    expect(after.hasOperations).toBe(false);
    expect(after.hasTargets).toBe(false);
    expect(after.drafts).toHaveLength(1);
    expect(after.drafts[0]).toMatchObject({
      status: 'open',
      revision: 0,
      draft: {
        week: 9,
        revision: 0,
        upkeep: { rolls: {} },
        activity: { slots: [] },
      },
    });
    expect(after.state).toEqual({
      snapshot: before.plan.snapshot,
      revision: 0,
    });
    expect(after.drafts[0]!.draft!.context).toMatchObject({
      firstMilitiaWeek: false,
      startDay: 56,
      uneventfulCarry: true,
      lastBuyoffWeek: 6,
      queuedEffects: [
        {
          effectId: 'q',
          startsWeek: 10,
          endsWeek: 10,
          effect: { kind: 'check_modifier', check: 'security', value: -2 },
        },
      ],
    });
    // Switch the reader and writer as one client: ordinary canonical Workspace,
    // edits, preview and Confirmation must all use the initialized source.
    const workspace = await client.query(
      api.canonicalDraftPersistence.workspace,
      { campaignId: scope.campaignId },
    );
    expect(workspace?.snapshot).toEqual(before.plan.snapshot);
    const transport = createConvexDraftTransport(client, key);
    const edits = initializationEdits(
      before.plan.snapshot!.roster.teams[0]!.teamId,
      before.plan.snapshot!.characters[0]!.characterId,
    );
    for (const [baseRevision, edit] of edits.entries())
      await transport.send({
        draftId: key.draftId,
        operationId: randomUUID(),
        baseRevision,
        edit,
      });
    const preview = await transport.preview();
    expect(preview.requirements).toEqual([]);
    expect(preview.status).toBe('ready');
    const receipt = await transport.confirm({
      operationId: randomUUID(),
      reviewed: preview.reviewed,
    });
    expect(receipt.successor.week).toBe(10);
    const confirmed = await inspect();
    expect(confirmed.records).toHaveLength(1);
    expect(
      confirmed.drafts.filter((draft) => draft.status === 'open'),
    ).toHaveLength(1);
    expect(confirmed.state?.snapshot).toEqual(preview.outcome?.militiaSnapshot);

    // Deliberately discard only synthetic acceptance work, while still paused.
    await command(
      'pre-reopen preview restore',
      [
        'exec',
        'convex',
        'import',
        backup,
        '--replace-all',
        '--yes',
        ...selection,
      ],
      { cwd: run.workspace },
    );
    expect(await inspect()).toEqual(before);
    expect(
      await client.query(api.weekBoard.getWeekBoardState, {
        campaignId: scope.campaignId,
        organizationId: run.resources.workers[0]!.organizationId,
      }),
    ).toEqual(legacyBefore);
    expect(
      await client.query(api.canonicalDraftPersistence.workspace, {
        campaignId: scope.campaignId,
      }),
    ).toBeNull();
    await savePrivate(
      join(run.artifactDirectory, 'cutover-evidence.json'),
      JSON.stringify(
        {
          sourceFingerprint: run.sourceFingerprint,
          preview: run.resources.previewName,
          backupSha256: backupHash,
          backupRestoredAndCompared: true,
          legacyReaderCompatible: true,
          restartVerified: true,
          confirmationVerified: true,
          reopening: false,
          automaticRollbackEndsAtReopening: true,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.close();
  }
});
