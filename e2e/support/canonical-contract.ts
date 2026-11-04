import { ConvexClient } from 'convex/browser';
import type { BrowserContext, Page } from '@playwright/test';
import type { Fixture } from './fixtures';
import { loadRun } from './process';

type Role = 'gm' | 'player' | 'outsider';
export type TokenPage = Pick<Page, 'goto' | 'waitForFunction' | 'evaluate'>;
export type JourneyPage = { context: () => Pick<BrowserContext, 'newPage'> };
export type AuthenticatedClient = Pick<ConvexClient, 'setAuth'>;

// Contract clients read their Clerk token from a tab of the role's context
// that the journey never navigates. A token request can come at any time
// (setup, expiry, reconnect); read from a journey page it could race that
// page's own navigation and lose its document mid-request.
export async function reserveTokenPages<Player extends JourneyPage>(
  players: Record<Role, Player>,
) {
  const tokenPages = new Map<Player, TokenPage>();
  for (const page of [players.gm, players.player, players.outsider]) {
    const tokenPage: TokenPage = await page.context().newPage();
    await tokenPage.goto('/campaigns');
    // A still-loading page answers null, so the client would authenticate as
    // nobody; wait for the session before any client exists.
    await tokenPage.waitForFunction(() => Boolean(window.Clerk?.session));
    tokenPages.set(page, tokenPage);
  }
  return <Client extends AuthenticatedClient>(
    page: Player,
    createClient: () => Client,
  ) => {
    const tokenPage = tokenPages.get(page);
    if (!tokenPage) throw new Error('No token page for this player');
    const client = createClient();
    client.setAuth(async ({ forceRefreshToken }) =>
      tokenPage.evaluate(
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
}

export async function prepareContract(
  players: Record<Role, Page>,
  // The comparison case's automatic reset already created its campaign.
  comparison: Pick<Fixture, 'campaignId'>,
) {
  const run = await loadRun();
  const url = run.fixture!.convexUrl;
  const authenticate = await reserveTokenPages(players);
  // Provider logs may contain authentication or request payloads. Only the
  // bounded assertions below enter the ordinary safe harness report.
  const connect = (page: Page) =>
    authenticate(page, () => new ConvexClient(url, { logger: false }));

  return {
    run,
    url,
    comparison: { campaignId: comparison.campaignId },
    connect,
  };
}
