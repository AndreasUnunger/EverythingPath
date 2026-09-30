// @vitest-environment node
import { expect, it, vi } from 'vitest';
import {
  reserveTokenPages,
  type JourneyPage,
  type TokenPage,
} from './canonical-contract';

// Records the order of token-page and client events across all roles.
function roles() {
  const events: string[] = [];
  const player = (role: string) => {
    const tokenPage = {
      goto: vi.fn(async (path: string) => {
        events.push(`${role} token page opens ${path}`);
        return null;
      }),
      waitForFunction: vi.fn(async () => {
        events.push(`${role} token page has a session`);
        return {} as never;
      }),
      evaluate: vi.fn(
        async (_fn: unknown, skipCache?: unknown) =>
          `${role}:${skipCache === true ? 'fresh' : 'cached'}`,
      ),
    };
    const journey = {
      context: () => ({
        newPage: vi.fn(async () => tokenPage as unknown as TokenPage),
      }),
      // A journey page is navigated by the test; its document can vanish
      // while a token request is in flight.
      evaluate: vi.fn(async () => {
        throw new Error('Execution context was destroyed');
      }),
    };
    return { tokenPage, journey: journey as JourneyPage & typeof journey };
  };
  const gm = player('gm');
  const other = player('player');
  const outsider = player('outsider');
  return {
    events,
    gm,
    players: {
      gm: gm.journey,
      player: other.journey,
      outsider: outsider.journey,
    },
  };
}

it('lands every token page on a signed-in session before any client exists', async () => {
  const { events, players } = roles();
  const authenticate = await reserveTokenPages(players);
  authenticate(players.gm, () => {
    events.push('client created');
    return { setAuth: vi.fn() };
  });
  expect(events).toEqual([
    'gm token page opens /campaigns',
    'gm token page has a session',
    'player token page opens /campaigns',
    'player token page has a session',
    'outsider token page opens /campaigns',
    'outsider token page has a session',
    'client created',
  ]);
});

it('reads tokens from the reserved page, never from the navigating journey page', async () => {
  const { gm, players } = roles();
  const authenticate = await reserveTokenPages(players);
  const client = authenticate(players.gm, () => ({ setAuth: vi.fn() }));
  const fetchToken = client.setAuth.mock.calls[0]![0] as (args: {
    forceRefreshToken: boolean;
  }) => Promise<string | null>;
  await expect(fetchToken({ forceRefreshToken: false })).resolves.toBe(
    'gm:cached',
  );
  await expect(fetchToken({ forceRefreshToken: true })).resolves.toBe(
    'gm:fresh',
  );
  expect(gm.journey.evaluate).not.toHaveBeenCalled();
  expect(gm.tokenPage.goto).toHaveBeenCalledTimes(1);
});

it('refuses a page it did not reserve a token page for', async () => {
  const { players } = roles();
  const authenticate = await reserveTokenPages(players);
  const stranger = roles().players.gm;
  expect(() => authenticate(stranger, () => ({ setAuth: vi.fn() }))).toThrow(
    'No token page for this player',
  );
});
