import type { DeploymentFixture, Resources } from '../fixtures/catalog';
export const resources: Resources = {
  version: 1,
  team: 'test-team',
  project: 'test-project',
  previewName: 'e2e-local-test-slot-0',
  clerkHost: 'testing-otter-1.clerk.accounts.dev',
  production: {
    clerkHosts: ['clerk.production.example'],
    convexUrls: ['https://production.convex.cloud'],
  },
  workers: [
    {
      key: 'worker-0',
      organizationId: 'org_members',
      outsiderOrganizationId: 'org_outsiders',
      gm: { userId: 'user_gm', email: 'gm+clerk_test@example.test' },
      player: {
        userId: 'user_player',
        email: 'player+clerk_test@example.test',
      },
      outsider: {
        userId: 'user_outsider',
        email: 'outsider+clerk_test@example.test',
      },
    },
  ],
};
export const safeEnvironment = {
  E2E_TRUSTED_EXECUTION: 'true',
  CLERK_PUBLISHABLE_KEY: `pk_test_${Buffer.from(`${resources.clerkHost}$`).toString('base64')}`,
  CLERK_SECRET_KEY: 'sk_test_fixture',
  CONVEX_DEPLOY_KEY: 'preview:test-team:test-project|secret',
};
export const deploymentFixture: DeploymentFixture = {
  version: 1,
  namespace: resources.previewName,
  convexUrl: 'https://quiet-otter-123.convex.cloud',
  clerkHost: resources.clerkHost,
  productionConvexUrls: resources.production.convexUrls,
  workers: resources.workers.map((worker) => ({
    ...worker,
    cases: {
      smoke: 'a'.repeat(64),
      isolation: 'b'.repeat(64),
      existingMilitia: 'd'.repeat(64),
    },
  })),
};
