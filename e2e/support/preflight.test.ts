// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { runE2EPreflight, validatePreviewBinding } from './preflight';
import { resources, safeEnvironment } from './test-data';

describe('E2E preflight before any writing adapter', () => {
  it('accepts a preview creation key without guessing its future hostname', async () => {
    const write = vi.fn();
    await runE2EPreflight(safeEnvironment, resources, write);
    expect(write).toHaveBeenCalledOnce();
    expect(
      validatePreviewBinding(resources, 'https://quiet-otter-123.convex.cloud'),
    ).toBe('https://quiet-otter-123.convex.cloud');
  });
  it.each([
    { CLERK_SECRET_KEY: 'sk_live_secret' },
    { CLERK_PUBLISHABLE_KEY: 'pk_test_invalid' },
    { CONVEX_DEPLOY_KEY: 'prod:main|secret' },
    { CONVEX_DEPLOY_KEY: 'preview:deployment|secret' },
    { CONVEX_DEPLOY_KEY: 'project:team:project|secret' },
    { CONVEX_DEPLOY_KEY: 'preview:other:project|secret' },
    { CONVEX_DEPLOYMENT: 'dev:personal' },
    { CONVEX_SELF_HOSTED_URL: 'http://localhost:3210' },
    { NEXT_PUBLIC_CONVEX_URL: 'https://production.convex.cloud' },
    { CLERK_API_URL: 'https://evil.test' },
    { E2E_TRUSTED_EXECUTION: 'false' },
    { CI: 'true' },
    {
      CI: 'true',
      GITHUB_ACTIONS: 'true',
      GITHUB_EVENT_NAME: 'pull_request_target',
    },
    {
      CI: 'true',
      GITHUB_ACTIONS: 'true',
      GITHUB_EVENT_NAME: 'push',
      GITHUB_ACTOR: 'dependabot[bot]',
    },
    { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_other' },
  ])('refuses unsafe inherited configuration %j', async (overrides) => {
    const write = vi.fn();
    await expect(
      runE2EPreflight({ ...safeEnvironment, ...overrides }, resources, write),
    ).rejects.toThrow('E2E preflight');
    expect(write).not.toHaveBeenCalled();
  });
  it.each(['main', 'e2e-../prod', 'e2e-local', 'e2e-local-a-slot-0;echo'])(
    'rejects preview name %s',
    async (previewName) => {
      const write = vi.fn();
      await expect(
        runE2EPreflight(safeEnvironment, { ...resources, previewName }, write),
      ).rejects.toThrow();
      expect(write).not.toHaveBeenCalled();
    },
  );
  it.each([
    'garbage',
    'http://quiet-otter-123.convex.cloud',
    'https://a.convex.cloud.evil.test',
    'https://user:password@a.convex.cloud',
    'https://production.convex.cloud',
    'https://a.convex.cloud/?token=secret',
  ])('refuses resolved URL %s', (url) => {
    expect(() => validatePreviewBinding(resources, url)).toThrow();
  });
  it('rejects overlapping cohorts and denylisted Clerk hosts', async () => {
    for (const declaration of [
      { ...resources, workers: [...resources.workers, ...resources.workers] },
      {
        ...resources,
        production: {
          ...resources.production,
          clerkHosts: [resources.clerkHost],
        },
      },
    ]) {
      const write = vi.fn();
      await expect(
        runE2EPreflight(safeEnvironment, declaration, write),
      ).rejects.toThrow();
      expect(write).not.toHaveBeenCalled();
    }
  });
});
