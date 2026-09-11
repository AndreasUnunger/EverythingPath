import { randomUUID } from 'node:crypto';
import { ConvexClient } from 'convex/browser';
import { z } from 'zod';
import { api } from '../convex/_generated/api';
import type { Page } from '@playwright/test';
import { draftKeySchema } from '../convex/lib/canonicalStorageValidators';
import { createConvexDraftTransport } from '../src/lib/convex-draft-persistence';
import { runPersistenceContract } from '../tests/persistence/contracts';
import {
  runConfirmationContract,
  type ConfirmationContractHarness,
} from '../tests/persistence/confirmation-contracts';
import { confirmationInspectionSchema } from '../src/lib/weekly-confirmation-contract';
import { test, expect } from './support/fixtures';
import {
  canonicalPersistenceFixtureCall,
  fixtureCall,
  loadRun,
} from './support/process';
import { sanitizeLog } from './support/artifacts';

test.use({ caseKey: 'canonicalPersistence', comparisonCaseKey: 'isolation' });

test('shared persistence contract uses authenticated isolated Convex', async ({
  players,
  ownedCase,
  comparisonCase,
}) => {
  test.setTimeout(300_000);
  const run = await loadRun();
  const url = run.fixture!.convexUrl;
  let nativePaginationVerified = false;
  const comparison = z
    .object({ campaignId: draftKeySchema.shape.campaignId })
    .parse(
      await fixtureCall(run, 'resetCase', {
        ...comparisonCase!.scope,
        now: 1_700_000_000_000,
      }),
    );
  for (const page of [players.gm, players.player, players.outsider]) {
    await page.goto('/campaigns');
    await page.waitForFunction(() => Boolean(window.Clerk?.session));
  }

  const connect = (page: Page) => {
    // Provider logs may contain authentication or request payloads. Only the
    // bounded assertions below enter the ordinary safe harness report.
    const client = new ConvexClient(url, { logger: false });
    client.setAuth(async ({ forceRefreshToken }) =>
      page.evaluate(
        async (skipCache) =>
          (await window.Clerk.session?.getToken({
            template: 'convex',
            skipCache,
          })) ?? null,
        forceRefreshToken,
      ),
    );
    return client;
  };

  try {
    await runPersistenceContract(async () => {
      await fixtureCall(run, 'resetCase', {
        ...ownedCase.scope,
        now: 1_700_000_000_000,
      });
      const scope = draftKeySchema.parse(
        await canonicalPersistenceFixtureCall(run, 'initialize', {
          scope: ownedCase.scope,
          draftId: randomUUID(),
        }),
      );
      const first = connect(players.gm);
      const second = connect(players.player);
      const outsider = connect(players.outsider);
      const anonymous = new ConvexClient(url, { logger: false });
      const firstTransport = createConvexDraftTransport(first, scope);
      const outsiderTransport = createConvexDraftTransport(outsider, scope);
      const anonymousTransport = createConvexDraftTransport(anonymous, scope);
      const crossCampaignTransport = createConvexDraftTransport(first, {
        ...scope,
        campaignId: comparison.campaignId,
      });
      try {
        const initial = await firstTransport.read();
        const slotId = initial.draft?.activity.slots[0]?.slotId;
        expect(slotId).toBeDefined();
        for (const denied of [
          outsiderTransport,
          anonymousTransport,
          crossCampaignTransport,
        ]) {
          await expect(denied.read()).rejects.toThrow();
          await expect(
            denied.send({
              draftId: scope.draftId,
              operationId: randomUUID(),
              baseRevision: 0,
              edit: {
                kind: 'stage',
                slotId: slotId!,
                choice: { choiceId: randomUUID(), actionId: 'special' },
              },
            }),
          ).rejects.toThrow();
        }
        expect(await firstTransport.read()).toEqual(initial);
      } catch (error) {
        await Promise.all([
          first.close(),
          second.close(),
          outsider.close(),
          anonymous.close(),
        ]);
        throw error;
      }
      await Promise.all([outsider.close(), anonymous.close()]);
      return {
        first: firstTransport,
        second: createConvexDraftTransport(second, scope),
        close: async () => {
          await canonicalPersistenceFixtureCall(run, 'close', {
            scope: ownedCase.scope,
            ...scope,
          });
        },
        dispose: async () => {
          try {
            const observation = await firstTransport.read();
            if (
              !nativePaginationVerified &&
              observation.status === 'open' &&
              observation.targetRevisions.length > 16
            ) {
              const result = await first.query(
                api.canonicalDraftPersistence.targets,
                {
                  ...scope,
                  afterRevision: 0,
                  observedRevision: observation.revision,
                  observedStatus: observation.status,
                  paginationOpts: {
                    numItems: 1,
                    cursor: null,
                    endCursor: null,
                    maximumRowsRead: 1,
                    maximumBytesRead: 100_000,
                    id: 79,
                  },
                },
              );
              expect(result.restart).toBe(false);
              expect(result.pagination).not.toBeNull();
              expect(result.pagination!.page.length).toBeLessThanOrEqual(1);
              expect(result.pagination!.isDone).toBe(false);
              expect(result.pagination!.continueCursor).not.toBe('');
              nativePaginationVerified = true;
            }
          } finally {
            await Promise.all([first.close(), second.close()]);
          }
        },
      };
    });
    expect(nativePaginationVerified).toBe(true);
    const confirmationHarness = async (
      verifyConfirmationAuthorization = false,
    ): Promise<ConfirmationContractHarness> => {
      await fixtureCall(run, 'resetCase', {
        ...ownedCase.scope,
        now: 1_700_000_000_000,
      });
      const scope = draftKeySchema.parse(
        await canonicalPersistenceFixtureCall(run, 'initialize', {
          scope: ownedCase.scope,
          draftId: randomUUID(),
        }),
      );
      const first = connect(players.gm);
      const second = connect(players.player);
      const outsider = connect(players.outsider);
      const anonymous = new ConvexClient(url, { logger: false });
      const firstTransport = createConvexDraftTransport(first, scope);
      const inspect = async () =>
        confirmationInspectionSchema.parse(
          await canonicalPersistenceFixtureCall(run, 'inspect', {
            ...scope,
            scope: ownedCase.scope,
          }),
        );
      try {
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
        if (verifyConfirmationAuthorization)
          expect(preview.status).toBe('ready');
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
      } catch (error) {
        await Promise.all([
          first.close(),
          second.close(),
          outsider.close(),
          anonymous.close(),
        ]);
        throw error;
      }
      await Promise.all([outsider.close(), anonymous.close()]);
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
          await Promise.all([first.close(), second.close()]);
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
      `Isolated authenticated persistence contract: ${sanitizeLog(
        error instanceof Error ? error.message : 'Verification failed',
      )}`,
    );
  }
});
