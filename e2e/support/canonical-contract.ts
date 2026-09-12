import { ConvexClient } from 'convex/browser';
import { z } from 'zod';
import type { Page } from '@playwright/test';
import type { FixtureScope } from '../fixtures/catalog';
import { draftKeySchema } from '../../convex/lib/canonicalStorageValidators';
import { fixtureCall, loadRun } from './process';

export async function prepareContract(
  players: Record<'gm' | 'player' | 'outsider', Page>,
  comparisonScope: FixtureScope,
) {
  const run = await loadRun();
  const url = run.fixture!.convexUrl;
  const comparison = z
    .object({ campaignId: draftKeySchema.shape.campaignId })
    .parse(
      await fixtureCall(run, 'resetCase', {
        ...comparisonScope,
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

  return { run, url, comparison, connect };
}
