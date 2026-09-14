import { randomUUID } from 'node:crypto';
import { ConvexClient } from 'convex/browser';
import { draftKeySchema } from '../convex/lib/canonicalStorageValidators';
import { createConvexDraftTransport } from '../src/lib/convex-draft-persistence';
import { test, expect } from './support/fixtures';
import { canonicalPersistenceFixtureCall } from './support/process';
import { sanitizeLog } from './support/artifacts';
import { prepareContract } from './support/canonical-contract';
import {
  runConfirmationContract,
  type ConfirmationContractHarness,
} from '../tests/persistence/confirmation-contracts';
import { confirmationInspectionSchema } from '../src/lib/weekly-confirmation-contract';

test.use({ caseKey: 'canonicalPersistence', comparisonCaseKey: 'isolation' });

test('shared Confirmation contract commits reviewed weeks in isolated Convex', async ({
  players,
  ownedCase,
  comparisonCase,
}) => {
  test.setTimeout(300_000);
  const { run, url, comparison, connect } = await prepareContract(
    players,
    comparisonCase!.scope,
  );
  const first = connect(players.gm);
  const second = connect(players.player);
  const outsider = connect(players.outsider);
  const anonymous = new ConvexClient(url, { logger: false });
  try {
    const confirmationHarness = async (
      verifyConfirmationAuthorization = false,
    ): Promise<ConfirmationContractHarness> => {
      const scope = draftKeySchema.parse(
        await canonicalPersistenceFixtureCall(run, 'resetAndInitialize', {
          scope: ownedCase.scope,
          now: 1_700_000_000_000,
          draftId: randomUUID(),
        }),
      );
      const firstTransport = createConvexDraftTransport(first, scope);
      const inspect = async () =>
        confirmationInspectionSchema.parse(
          await canonicalPersistenceFixtureCall(run, 'inspect', {
            ...scope,
            scope: ownedCase.scope,
          }),
        );
      if (verifyConfirmationAuthorization) {
        await firstTransport.send({
          draftId: scope.draftId,
          operationId: randomUUID(),
          baseRevision: 0,
          edit: {
            kind: 'event_chance',
            roll: {
              dice: [100],
              sides: 100,
              provenance: { kind: 'table' },
              modifiers: [],
            },
          },
        });
      }
      const before = await inspect();
      const preview = await firstTransport.preview();
      if (verifyConfirmationAuthorization) expect(preview.status).toBe('ready');
      for (const denied of [
        createConvexDraftTransport(outsider, scope),
        createConvexDraftTransport(anonymous, scope),
        createConvexDraftTransport(first, {
          ...scope,
          campaignId: comparison.campaignId,
        }),
      ]) {
        await expect(denied.preview()).rejects.toThrow();
        if (verifyConfirmationAuthorization)
          await expect(
            denied.confirm({
              operationId: randomUUID(),
              reviewed: preview.reviewed,
            }),
          ).rejects.toThrow();
      }
      expect(await inspect()).toEqual(before);
      return {
        first: firstTransport,
        second: createConvexDraftTransport(second, scope),
        inspect,
        changeSource: async (change) => {
          await canonicalPersistenceFixtureCall(run, 'changeSource', {
            ...scope,
            scope: ownedCase.scope,
            change,
          });
        },
        blockSuccessor: async (operationId) => {
          await canonicalPersistenceFixtureCall(run, 'blockSuccessor', {
            ...scope,
            scope: ownedCase.scope,
            operationId,
          });
        },
        dispose: async () => {
          // Authenticated connections belong to the whole contract run.
        },
      };
    };
    await runConfirmationContract(confirmationHarness);
    const literal = await confirmationHarness(true);
    try {
      const initial = await literal.first.read();
      let revision = initial.revision;
      for (const edit of [
        {
          kind: 'stage' as const,
          slotId: 'left',
          choice: {
            choiceId: 'scout',
            actionId: 'special' as const,
            instruction: 'Scout road',
            costCopper: 20,
          },
        },
        {
          kind: 'acknowledge' as const,
          acknowledgement: {
            acknowledgementId: 'scout-result',
            subjectId: 'special:scout',
            outcome: 'Road safe',
          },
        },
        {
          kind: 'table_adjustments' as const,
          adjustments: [
            {
              kind: 'militia_value' as const,
              adjustmentId: 'reward',
              field: 'treasuryCopper' as const,
              operation: 'add' as const,
              value: 7,
              reason: 'Found seven copper',
            },
          ],
        },
      ]) {
        await literal.first.send({
          draftId: initial.draftId,
          operationId: randomUUID(),
          baseRevision: revision++,
          edit,
        });
      }
      const reviewed = await literal.second.preview();
      expect(reviewed.status).toBe('ready');
      expect(reviewed.baseline?.militiaSnapshot.treasuryCopper).toBe(80);
      await literal.second.confirm({
        operationId: randomUUID(),
        reviewed: reviewed.reviewed,
      });
      const committed = await literal.inspect();
      expect(committed.snapshot).toEqual({
        rank: 1,
        training: 0,
        treasuryCopper: 87,
        notoriety: 0,
        focus: 'Loyalty',
        roster: { people: [], teams: [], officers: [] },
        characters: [],
        settlements: [],
        bonuses: [],
        eventBenefits: { skills: [], markets: [] },
      });
      expect(committed.source.status).toBe('closed');
      expect(committed.records).toHaveLength(1);
      expect(committed.openDrafts).toHaveLength(1);
      expect(committed.openDrafts[0]).toMatchObject({
        week: 2,
        revision: 0,
        context: {
          firstMilitiaWeek: false,
          startDay: 7,
          uneventfulCarry: false,
          carriedEvents: [],
          queuedEffects: [],
          orders: [],
          lastBuyoffWeek: null,
          operatedSettlementIds: [],
        },
        acknowledgements: [],
        rulesExceptions: [],
        tableAdjustments: [],
      });
      expect(
        committed.openDrafts[0]!.activity.slots.every(
          (slot) => slot.choice === null,
        ),
      ).toBe(true);
      const record = committed.records[0]!;
      expect(record.sourceMilitiaSnapshot?.treasuryCopper).toBe(100);
      expect(record.source.activity.slots[0]?.choice).toMatchObject({
        choiceId: 'scout',
        instruction: 'Scout road',
        costCopper: 20,
      });
      expect(record.adjudication.tableAdjustments).toEqual([
        {
          kind: 'militia_value',
          adjustmentId: 'reward',
          field: 'treasuryCopper',
          operation: 'add',
          value: 7,
          reason: 'Found seven copper',
        },
      ]);
      expect(record.provenance).toBe('confirmation');
      expect(record.supersedesRecordId).toBeNull();
    } finally {
      await literal.dispose();
    }
  } catch (error) {
    throw new Error(
      `Isolated authenticated Confirmation contract: ${sanitizeLog(
        error instanceof Error ? error.message : 'Verification failed',
      )}`,
    );
  } finally {
    await Promise.all([
      first.close(),
      second.close(),
      outsider.close(),
      anonymous.close(),
    ]);
  }
});
