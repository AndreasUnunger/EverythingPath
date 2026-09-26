import { openCampaignSection } from './support/interactions';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { api } from '../convex/_generated/api';
import { createConvexDraftTransport } from '../src/lib/convex-draft-persistence';
import { initializationEdits } from '../tests/rules/initialization-edits';
import { test, expect } from './support/fixtures';
import { prepareContract } from './support/canonical-contract';
import { fixtureCall, savePrivate } from './support/process';

test.use({ caseKey: 'canonicalPersistence', comparisonCaseKey: 'isolation' });
test('accepted campaign preserves canonical history and rejects retired paths', async ({
  players,
  ownedCase,
  comparisonCase,
}) => {
  const { run, connect } = await prepareContract(
    players,
    comparisonCase!.scope,
  );
  const client = connect(players.gm);
  try {
    const key = await client.mutation(
      api.canonicalPersistenceFixtures.acceptedCampaign,
      { scope: ownedCase.scope },
    );
    await fixtureCall(run, 'cleanupCase', comparisonCase!.scope);
    const workspace = await client.query(
      api.canonicalDraftPersistence.workspace,
      { campaignId: key.campaignId },
    );
    expect(workspace?.snapshot).toMatchObject({
      rank: 4,
      treasuryCopper: 12345,
      training: 42,
    });
    await players.gm.goto('/campaigns');
    await openCampaignSection(players.gm, 'week');
    await expect(
      players.gm.getByRole('heading', { name: 'Week 9 · Upkeep' }),
    ).toBeVisible();
    const transport = createConvexDraftTransport(client, key);
    const edits = initializationEdits(
      workspace!.snapshot.roster.teams[0]!.teamId,
      workspace!.snapshot.characters[0]!.characterId,
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
    const current = await client.query(
      api.canonicalDraftPersistence.workspace,
      { campaignId: key.campaignId },
    );
    const history = await client.query(api.canonicalHistory.read, {
      campaignId: key.campaignId,
      week: 9,
    });
    expect(history).not.toBeNull();
    await expect(
      client.mutation(api.weekBoard.saveWeekBoardState, {}),
    ).rejects.toThrow('Open the current militia week');
    await expect(
      client.query(api.weekBoard.getWeekBoardState, {}),
    ).rejects.toThrow('Open the current militia week');
    await players.gm.reload();
    await expect(
      players.gm.getByRole('heading', { name: 'Week 10 · Upkeep' }),
    ).toBeVisible();
    expect(
      await client.query(api.canonicalDraftPersistence.workspace, {
        campaignId: key.campaignId,
      }),
    ).toEqual(current);
    expect(
      await client.query(api.canonicalHistory.read, {
        campaignId: key.campaignId,
        week: 9,
      }),
    ).toEqual(history);
    await savePrivate(
      join(run.artifactDirectory, 'cutover-evidence.json'),
      JSON.stringify(
        {
          sourceFingerprint: run.sourceFingerprint,
          retiredReaderRejected: true,
          confirmationVerified: true,
          acceptedHistoryPreserved: true,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.close();
  }
});
