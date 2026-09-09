import {
  test as base,
  expect,
  type BrowserContext,
  type Page,
  type TestInfo,
} from '@playwright/test';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
  fixtureCatalog,
  FIXTURE_VERSION,
  type CaseKey,
  type RoleKey,
  type FixtureScope,
} from '../fixtures/catalog';
import { fixtureCall, loadRun, savePrivate, type Run } from './process';
import { sanitizeTrace } from './artifacts';
import { caseAttempt, claimCaseKey } from './case-attempt';

type Fixture = {
  scope: FixtureScope;
  campaignName: string;
  inspect: () => Promise<unknown>;
};
type Players = { gm: Page; player: Page; outsider: Page };

async function closeWithEvidence(
  context: BrowserContext,
  role: string,
  run: Run,
  ownedCase: Fixture,
  info: TestInfo,
) {
  try {
    if (info.status !== info.expectedStatus) {
      for (const [index, page] of context.pages().entries()) {
        if (page.url().startsWith(`${run.baseURL}/campaigns`)) {
          await savePrivate(
            join(
              run.artifactDirectory,
              `${ownedCase.scope.caseKey}-${info.retry}-${role}-${index}.png`,
            ),
            await page.screenshot({ fullPage: true }),
          );
        }
      }
    }
    if (info.retry === 1) {
      const raw = join(run.privateDirectory, `${role}.zip`);
      await context.tracing.stop({ path: raw });
      await savePrivate(
        join(
          run.artifactDirectory,
          `${ownedCase.scope.caseKey}-retry-${role}.zip`,
        ),
        sanitizeTrace(await readFile(raw)),
      );
      await rm(raw, { force: true });
    }
  } finally {
    await context.close();
  }
}

export const test = base.extend<{
  caseKey: CaseKey;
  ownedCase: Fixture;
  players: Players;
}>({
  caseKey: ['smoke', { option: true }],
  ownedCase: [
    async ({ caseKey }, use, info) => {
      const run = await loadRun();
      const worker = run.fixture?.workers[info.parallelIndex];
      if (!worker || info.parallelIndex !== 0)
        throw new Error('Authenticated worker cohort is unavailable');
      const scope: FixtureScope = {
        namespace: run.resources.previewName,
        version: FIXTURE_VERSION,
        workerKey: worker.key,
        caseKey,
        token: worker.cases[caseKey],
      };
      // This auto fixture runs for every attempt, including replacement retry
      // workers. Context fixtures explicitly depend on it below.
      await claimCaseKey(
        run.privateDirectory,
        worker.key,
        caseKey,
        info.testId,
      );
      await caseAttempt(
        () =>
          fixtureCall(run, 'resetCase', { ...scope, now: 1_700_000_000_000 }),
        () =>
          use({
            scope,
            campaignName: `E2E ${fixtureCatalog[caseKey].campaign}`,
            inspect: () => fixtureCall(run, 'inspectCase', scope),
          }),
        async () => {
          await fixtureCall(run, 'cleanupCase', scope);
        },
        () => {
          process.stderr.write(
            'E2E case cleanup failed; the next attempt will reset it.\n',
          );
        },
      );
    },
    { auto: true },
  ],
  context: async ({ browser, ownedCase }, use, info) => {
    const run = await loadRun();
    const context = await browser.newContext({
      baseURL: run.baseURL,
      viewport: { width: 1194, height: 834 },
      hasTouch: true,
      storageState: join(
        run.privateDirectory,
        'auth',
        `${ownedCase.scope.workerKey}-gm.json`,
      ),
    });
    if (info.retry === 1)
      await context.tracing.start({
        screenshots: true,
        snapshots: false,
        sources: false,
      });
    try {
      await use(context);
    } finally {
      await closeWithEvidence(context, 'primary-gm', run, ownedCase, info);
    }
  },
  players: async ({ browser, ownedCase }, use, info) => {
    const run = await loadRun();
    const contexts: { role: RoleKey; context: BrowserContext }[] = [];
    const pages = {} as Players;
    try {
      for (const role of ['gm', 'player', 'outsider'] as const) {
        const context = await browser.newContext({
          baseURL: run.baseURL,
          viewport: { width: 1194, height: 834 },
          hasTouch: true,
          storageState: join(
            run.privateDirectory,
            'auth',
            `${ownedCase.scope.workerKey}-${role}.json`,
          ),
        });
        contexts.push({ role, context });
        if (info.retry === 1)
          await context.tracing.start({
            screenshots: true,
            snapshots: false,
            sources: false,
          });
        pages[role] = await context.newPage();
      }
      await use(pages);
    } finally {
      const results = await Promise.allSettled(
        contexts.map(({ role, context }) =>
          closeWithEvidence(context, role, run, ownedCase, info),
        ),
      );
      if (results.some((result) => result.status === 'rejected'))
        throw new Error('Failed to finalize safe browser evidence');
    }
  },
});
export { expect };
