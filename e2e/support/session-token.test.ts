// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  forgetVerifiedApplications,
  refreshSessionToken,
} from './session-token';
import { resources, safeEnvironment } from './test-data';

const issuer = `https://${resources.clerkHost}`;
const userId = resources.workers[0]!.player.userId;
const now = 1_800_000_000;
function token(claims: Record<string, unknown>) {
  const part = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'RS256' })}.${part({
    iss: issuer,
    sub: userId,
    sid: 'sess_stored',
    exp: now - 600,
    ...claims,
  })}.signature-not-checked-here`;
}
const stored = token({});
const minted = token({ exp: now + 60 });

function cookie(name: string, value: string, domain = '127.0.0.1') {
  return {
    name,
    value,
    domain,
    path: '/',
    expires: now + 3600,
    httpOnly: false,
    secure: false,
    sameSite: 'Lax' as const,
  };
}
function context(cookies = [cookie('__session', stored)]) {
  return {
    cookies: vi.fn(async () => [
      ...cookies,
      cookie('__client_uat', String(now - 900)),
    ]),
    addCookies: vi.fn(async () => undefined),
  };
}
function refresh(
  target: ReturnType<typeof context>,
  overrides: Partial<Parameters<typeof refreshSessionToken>[1]> = {},
) {
  return refreshSessionToken(target, {
    resources,
    baseURL: 'http://127.0.0.1:4321',
    userId,
    environment: safeEnvironment,
    verify: async () => undefined,
    request: async () => ({ jwt: minted }),
    now: () => now,
    ...overrides,
  });
}

beforeEach(forgetVerifiedApplications);

describe('fresh role session tokens', () => {
  it('replaces every stored session token of the role, keeping the cookie attributes', async () => {
    const target = context([
      cookie('__session', stored),
      cookie('__session_suffix', stored),
    ]);
    const request = vi.fn(async () => ({ jwt: minted }));
    await refresh(target, { request });
    expect(request).toHaveBeenCalledWith(
      'https://api.clerk.com/v1/sessions/sess_stored/tokens',
      safeEnvironment.CLERK_SECRET_KEY,
    );
    expect(target.addCookies).toHaveBeenCalledWith([
      cookie('__session', minted),
      cookie('__session_suffix', minted),
    ]);
  });

  it('verifies the development application once per worker and refuses when it fails', async () => {
    const verify = vi.fn(async () => undefined);
    await refresh(context(), { verify });
    await refresh(context(), { verify });
    expect(verify).toHaveBeenCalledTimes(1);
    const other = {
      ...resources,
      clerkHost: 'other-host-7.clerk.accounts.dev',
    };
    const refused = vi.fn(async () => {
      throw new Error('Clerk instance is not development');
    });
    const target = context();
    await expect(
      refresh(target, {
        resources: other,
        environment: {
          ...safeEnvironment,
          CLERK_PUBLISHABLE_KEY: `pk_test_${Buffer.from(`${other.clerkHost}$`).toString('base64')}`,
        },
        verify: refused,
      }),
    ).rejects.toThrow('not development');
    expect(target.addCookies).not.toHaveBeenCalled();
  });

  it('accepts the Convex CLI pin the harness gives its Playwright process', async () => {
    const target = context();
    await refresh(target, {
      environment: {
        ...safeEnvironment,
        CONVEX_OVERRIDE_ACCESS_TOKEN: safeEnvironment.CONVEX_DEPLOY_KEY,
      },
    });
    expect(target.addCookies).toHaveBeenCalledOnce();
  });

  it('refuses any other inherited Convex access token', async () => {
    const request = vi.fn(async () => ({ jwt: minted }));
    const target = context();
    await expect(
      refresh(target, {
        request,
        environment: {
          ...safeEnvironment,
          CONVEX_OVERRIDE_ACCESS_TOKEN: 'preview:other-team:other|secret',
        },
      }),
    ).rejects.toThrow('not the harness pin');
    expect(request).not.toHaveBeenCalled();
    expect(target.addCookies).not.toHaveBeenCalled();
  });

  it.each<[string, Partial<Parameters<typeof refreshSessionToken>[1]>]>([
    [
      'a live secret key',
      { environment: { ...safeEnvironment, CLERK_SECRET_KEY: 'sk_live_x' } },
    ],
    [
      'untrusted execution',
      { environment: { ...safeEnvironment, E2E_TRUSTED_EXECUTION: undefined } },
    ],
    [
      'a production Clerk host',
      {
        resources: {
          ...resources,
          production: {
            ...resources.production,
            clerkHosts: [resources.clerkHost],
          },
        },
      },
    ],
  ])('refuses %s before any request', async (_, overrides) => {
    const request = vi.fn(async () => ({ jwt: minted }));
    const target = context();
    await expect(refresh(target, { ...overrides, request })).rejects.toThrow(
      'E2E preflight',
    );
    expect(request).not.toHaveBeenCalled();
    expect(target.addCookies).not.toHaveBeenCalled();
  });

  it.each([
    ['no stored session', []],
    ['a session for another host', [cookie('__session', stored, 'localhost')]],
    ['a malformed session', [cookie('__session', 'not-a-token')]],
    ['another role', [cookie('__session', token({ sub: 'user_other' }))]],
    [
      'another issuer',
      [cookie('__session', token({ iss: 'https://evil.example' }))],
    ],
    [
      'two different sessions',
      [
        cookie('__session', stored),
        cookie('__session_suffix', token({ sid: 'sess_other' })),
      ],
    ],
  ])('refuses %s without asking Clerk', async (_, cookies) => {
    const request = vi.fn(async () => ({ jwt: minted }));
    const target = context(cookies);
    await expect(refresh(target, { request })).rejects.toThrow(
      'E2E session refresh',
    );
    expect(request).not.toHaveBeenCalled();
    expect(target.addCookies).not.toHaveBeenCalled();
  });

  it.each([
    ['no token', {}],
    ['a malformed token', { jwt: 'garbage' }],
    ['another role', { jwt: token({ sub: 'user_other', exp: now + 60 }) }],
    ['another session', { jwt: token({ sid: 'sess_other', exp: now + 60 }) }],
    ['an expired token', { jwt: token({ exp: now }) }],
  ])('refuses an issued token with %s', async (_, response) => {
    const target = context();
    await expect(
      refresh(target, { request: async () => response }),
    ).rejects.toThrow('E2E session refresh');
    expect(target.addCookies).not.toHaveBeenCalled();
  });

  it('never puts the key or a token into its errors', async () => {
    const failures = await Promise.all([
      refresh(
        context([cookie('__session', token({ sub: 'user_other' }))]),
      ).catch((error: Error) => error.message),
      refresh(context(), {
        request: async () => ({
          jwt: token({ sub: 'user_other', exp: now + 60 }),
        }),
      }).catch((error: Error) => error.message),
    ]);
    for (const message of failures) {
      expect(message).not.toContain(safeEnvironment.CLERK_SECRET_KEY);
      expect(message).not.toContain('eyJ');
      expect(message).not.toContain('sess_');
    }
  });
});
