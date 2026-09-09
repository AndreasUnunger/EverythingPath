import { z } from 'zod';

export const FIXTURE_VERSION = 1;
export const convexCloudUrlPattern =
  /^https:\/\/[a-z0-9-]+(?:\.[a-z]{2}-[a-z]+-[0-9]+)?\.convex\.cloud$/;
export const roleKeys = ['gm', 'player', 'outsider'] as const;
export type RoleKey = (typeof roleKeys)[number];
export const caseKeys = [
  'smoke',
  'isolation',
  'existingMilitia',
  'characterLedger',
  'completeWeek',
] as const;
export type CaseKey = (typeof caseKeys)[number];

// Provider IDs belong in the external resource declaration, never in this catalog.
export const fixtureCatalog = {
  smoke: {
    campaign: 'harness-campaign',
    militia: 'harness-militia',
    character: 'harness-officer',
  },
  existingMilitia: {
    campaign: 'existing-militia-campaign',
    militia: 'existing-militia',
    character: 'existing-officer',
  },
  isolation: {
    campaign: 'isolation-campaign',
    militia: 'isolation-militia',
    character: 'isolation-officer',
  },
  completeWeek: {
    campaign: 'complete-week-campaign',
    militia: 'complete-week-militia',
    character: 'complete-week-officer',
  },
  characterLedger: {
    campaign: 'character-ledger-campaign',
    militia: 'character-ledger-militia',
    character: 'character-ledger-officer',
  },
} satisfies Record<
  CaseKey,
  { campaign: string; militia: string; character: string }
>;

const providerId = (prefix: string) =>
  z.string().regex(new RegExp(`^${prefix}_[a-zA-Z0-9]+$`));
const identitySchema = z
  .object({ userId: providerId('user'), email: z.email() })
  .strict();
export const workerSchema = z
  .object({
    key: z.string().regex(/^worker-[0-9]+$/),
    organizationId: providerId('org'),
    outsiderOrganizationId: providerId('org'),
    gm: identitySchema,
    player: identitySchema,
    outsider: identitySchema,
  })
  .strict();
export type WorkerCohort = z.infer<typeof workerSchema>;

export const resourceSchema = z
  .object({
    version: z.literal(FIXTURE_VERSION),
    team: z.string().regex(/^[a-z0-9-]+$/),
    project: z.string().regex(/^[a-z0-9-]+$/),
    previewName: z
      .string()
      .regex(
        /^e2e-(?:local-[a-z0-9-]+-slot-[0-9]+|pr-[1-9][0-9]*-shard-[0-9]+)$/,
      )
      .max(63),
    clerkHost: z.string().regex(/^[a-z0-9-]+\.clerk\.accounts\.dev$/),
    production: z
      .object({
        clerkHosts: z.array(z.string().min(1)),
        convexUrls: z.array(z.url()).min(1),
      })
      .strict(),
    workers: z.array(workerSchema).min(1),
  })
  .strict()
  .superRefine((resources, ctx) => {
    const keys = resources.workers.map((worker) => worker.key);
    const orgs = resources.workers.flatMap((worker) => [
      worker.organizationId,
      worker.outsiderOrganizationId,
    ]);
    const users = resources.workers.flatMap((worker) =>
      roleKeys.map((role) => worker[role].userId),
    );
    const emails = resources.workers.flatMap((worker) =>
      roleKeys.map((role) => worker[role].email.toLowerCase()),
    );
    if (
      [keys, orgs, users, emails].some(
        (values) => new Set(values).size !== values.length,
      )
    ) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Worker cohorts must have distinct keys, organizations and identities',
      });
    }
  });
export type Resources = z.infer<typeof resourceSchema>;

export const deploymentFixtureSchema = z
  .object({
    version: z.literal(FIXTURE_VERSION),
    namespace: resourceSchema.shape.previewName,
    convexUrl: z.url(),
    clerkHost: resourceSchema.shape.clerkHost,
    productionConvexUrls: z.array(z.url()).min(1),
    workers: z
      .array(
        workerSchema
          .extend({
            cases: z
              .object({
                smoke: z.string().length(64),
                isolation: z.string().length(64),
                existingMilitia: z.string().length(64),
                characterLedger: z.string().length(64),
                completeWeek: z.string().length(64),
              })
              .strict(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
export type DeploymentFixture = z.infer<typeof deploymentFixtureSchema>;

export const scopeSchema = z
  .object({
    namespace: z.string(),
    version: z.number(),
    workerKey: z.string(),
    caseKey: z.enum(caseKeys),
    token: z.string(),
  })
  .strict();
export type FixtureScope = z.infer<typeof scopeSchema>;

export function guardFixtureScope(
  environment: Record<string, string | undefined>,
  scope: FixtureScope,
) {
  const refuse = () => {
    throw new Error('E2E fixture access refused');
  };
  if (environment.E2E_ENABLED !== 'true' || !environment.E2E_FIXTURE_CONFIG)
    return refuse();
  let config: DeploymentFixture;
  try {
    config = deploymentFixtureSchema.parse(
      JSON.parse(environment.E2E_FIXTURE_CONFIG),
    );
  } catch {
    return refuse();
  }
  // The runner installs this binding only on the newly created preview. Copying
  // fixture env flags to another deployment does not enable these operations.
  if (
    environment.CONVEX_CLOUD_URL !== config.convexUrl ||
    environment.CONVEX_DEPLOYMENT?.startsWith('prod:') ||
    config.productionConvexUrls.includes(config.convexUrl) ||
    !convexCloudUrlPattern.test(config.convexUrl) ||
    scope.version !== config.version ||
    scope.namespace !== config.namespace
  )
    return refuse();
  const worker = config.workers.find((entry) => entry.key === scope.workerKey);
  if (worker?.cases[scope.caseKey] !== scope.token) return refuse();
  return { config, worker, domain: fixtureCatalog[scope.caseKey] };
}
