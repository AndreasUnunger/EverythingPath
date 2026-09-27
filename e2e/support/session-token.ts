import { z } from 'zod';
import type { BrowserContext } from '@playwright/test';
import type { Resources } from '../fixtures/catalog';
import { verifyClerkApplication } from './clerk';
import {
  validateE2ETargets,
  type Environment,
  type SafeTargets,
} from './preflight';

// Stored role sessions carry a session token that has long expired by the
// time a test starts. Loading a page with it makes Clerk's development
// middleware bounce the document through its cross-site handshake
// (`*.clerk.accounts.dev`). WebKit then withholds the SameSite=Strict
// `__client_uat` cookie on every reload of that document, so Clerk
// handshakes again on each reload, which ends in a redirect loop or, when a
// redirecting reload adds a history entry, a Back that stays put. A token
// minted through the Backend API just before the first page load means the
// first load needs no handshake. Errors never carry a key, token or cookie
// value.

type Context = Pick<BrowserContext, 'cookies' | 'addCookies'>;
type Post = (url: string, secretKey: string) => Promise<unknown>;
type Verify = (targets: SafeTargets) => Promise<void>;

const post: Post = async (url, secretKey) => {
  const response = await fetch(url, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  if (!response.ok) refuse('Clerk did not issue a session token');
  return (await response.json()) as unknown;
};

function refuse(reason: string): never {
  throw new Error(`E2E session refresh: ${reason}`);
}

const claimsSchema = z.object({
  iss: z.string(),
  sub: z.string(),
  sid: z.string().regex(/^sess_[A-Za-z0-9]+$/),
  exp: z.number(),
});
function claims(token: string) {
  const payload = token.split('.');
  if (payload.length !== 3) refuse('session token is malformed');
  try {
    return claimsSchema.parse(
      JSON.parse(Buffer.from(payload[1]!, 'base64url').toString('utf8')),
    );
  } catch {
    return refuse('session token is malformed');
  }
}

// The application check (development instance, matching key pair) runs once
// per worker; the key validation and denylist run on every call.
const verified = new Map<string, Promise<void>>();
function verifyOnce(targets: SafeTargets, verify: Verify) {
  const key = targets.resources.clerkHost;
  let pending = verified.get(key);
  if (!pending) {
    pending = verify(targets);
    pending.catch(() => verified.delete(key));
    verified.set(key, pending);
  }
  return pending;
}

// Playwright runs as a harness `command()`, which pins Convex CLI
// authentication by copying the declared preview key into
// CONVEX_OVERRIDE_ACCESS_TOKEN; workers inherit that pin. Only that exact
// pin is set aside before the inherited-selector checks; any other value is
// still refused.
function withoutHarnessPin(environment: Environment): Environment {
  const { CONVEX_OVERRIDE_ACCESS_TOKEN: pin, ...rest } = environment;
  if (pin && pin !== environment.CONVEX_DEPLOY_KEY)
    refuse('CONVEX_OVERRIDE_ACCESS_TOKEN is not the harness pin');
  return rest;
}

// Test seam: forget which applications this worker has verified.
export function forgetVerifiedApplications() {
  verified.clear();
}

export async function refreshSessionToken(
  context: Context,
  {
    resources,
    baseURL,
    userId,
    environment = process.env,
    verify = verifyClerkApplication,
    request = post,
    now = () => Date.now() / 1000,
  }: {
    resources: Resources;
    baseURL: string;
    userId: string;
    environment?: Environment;
    verify?: Verify;
    request?: Post;
    now?: () => number;
  },
) {
  const targets = validateE2ETargets(withoutHarnessPin(environment), resources);
  await verifyOnce(targets, verify);
  const issuer = `https://${resources.clerkHost}`;
  const host = new URL(baseURL).hostname;
  const sessions = (await context.cookies()).filter(
    ({ name }) => name === '__session' || name.startsWith('__session_'),
  );
  if (sessions.length === 0) refuse('stored role has no session');
  if (sessions.some((cookie) => cookie.domain !== host))
    refuse('stored session belongs to another host');
  const stored = sessions.map(({ value }) => claims(value));
  const sid = stored[0]!.sid;
  if (
    stored.some(
      (token) =>
        token.iss !== issuer || token.sub !== userId || token.sid !== sid,
    )
  )
    refuse('stored session does not belong to this role');
  const minted = z
    .object({ jwt: z.string() })
    .safeParse(
      await request(
        `https://api.clerk.com/v1/sessions/${sid}/tokens`,
        targets.secretKey,
      ),
    );
  if (!minted.success) refuse('Clerk did not issue a session token');
  const fresh = claims(minted.data.jwt);
  if (
    fresh.iss !== issuer ||
    fresh.sub !== userId ||
    fresh.sid !== sid ||
    fresh.exp <= now()
  )
    refuse('issued session token does not match this role');
  await context.addCookies(
    sessions.map((cookie) => ({ ...cookie, value: minted.data.jwt })),
  );
}
