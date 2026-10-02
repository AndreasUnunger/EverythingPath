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
// The shape of a local three-cohort declaration, with synthetic provider IDs.
// Cohort N has its own member and outsider organizations and three users.
export const threeCohortResources: Resources = {
  ...resources,
  workers: [0, 1, 2].map((index) => {
    const n = index === 0 ? '' : String(index);
    return {
      key: `worker-${index}`,
      organizationId: `org_members${n}`,
      outsiderOrganizationId: `org_outsiders${n}`,
      gm: { userId: `user_gm${n}`, email: `gm${n}+clerk_test@example.test` },
      player: {
        userId: `user_player${n}`,
        email: `player${n}+clerk_test@example.test`,
      },
      outsider: {
        userId: `user_outsider${n}`,
        email: `outsider${n}+clerk_test@example.test`,
      },
    };
  }),
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
      characterLedger: 'c'.repeat(64),
      characterSheet: '34'.repeat(32),
      completeWeek: 'e'.repeat(64),
      canonicalPersistence: 'c'.repeat(64),
      realtimeActionSlot: 'f'.repeat(64),
      workspaceUpkeep: '1'.repeat(64),
      workspaceNotoriety: '2'.repeat(64),
      workspaceRecovery: '3'.repeat(64),
      workspacePersistent: '4'.repeat(64),
      workspaceConfirmation: '5'.repeat(64),
      workspaceUpkeepLayout: '0'.repeat(64),
      workspaceEventReview: 'ab'.repeat(32),
      workspaceActivity: 'a'.repeat(64),
      workspaceSettlementTouch: 'cd'.repeat(32),
      workspaceDrillRolls: 'ef'.repeat(32),
      workspaceRecoveryActivity: '12'.repeat(32),
      campaignHome: '6'.repeat(64),
      campaignSections: '7'.repeat(64),
      weekLinks: '9'.repeat(64),
    },
  })),
};
