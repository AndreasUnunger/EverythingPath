import {
  convexCloudUrlPattern,
  resourceSchema,
  type Resources,
} from '../fixtures/catalog';

export type Environment = Record<string, string | undefined>;
export type SafeTargets = {
  resources: Resources;
  publishableKey: string;
  secretKey: string;
  previewKey: string;
};

function reject(reason: string): never {
  throw new Error(`E2E preflight: ${reason}`);
}

export function validateE2ETargets(
  environment: Environment,
  declaration: unknown,
): SafeTargets {
  const parsed = resourceSchema.safeParse(declaration);
  if (!parsed.success) reject('invalid resource declaration');
  const resources = parsed.data;
  if (environment.E2E_TRUSTED_EXECUTION !== 'true')
    reject('trusted execution must be explicitly enabled');
  if (environment.CI) {
    if (
      environment.GITHUB_ACTIONS !== 'true' ||
      !['push', 'workflow_dispatch', 'pull_request'].includes(
        environment.GITHUB_EVENT_NAME ?? '',
      ) ||
      environment.GITHUB_ACTOR?.endsWith('[bot]') ||
      !environment.GITHUB_SHA ||
      environment.E2E_REVIEWED_SHA !== environment.GITHUB_SHA
    ) {
      reject('CI requires a trusted workflow for the reviewed commit');
    }
  }
  for (const name of [
    'CONVEX_DEPLOYMENT',
    'CONVEX_SELF_HOSTED_URL',
    'CONVEX_SELF_HOSTED_ADMIN_KEY',
    'CONVEX_ACCESS_TOKEN',
    'CONVEX_OVERRIDE_ACCESS_TOKEN',
    'CONVEX_OVERRIDE_DEPLOY_KEY',
    'CONVEX_OVERRIDE_URL',
    'CONVEX_URL',
    'NEXT_PUBLIC_CONVEX_URL',
    'CLERK_API_URL',
    'CLERK_FAPI',
    'CLERK_TESTING_TOKEN',
    'CLERK_FRONTEND_API_URL',
    'NEXT_PUBLIC_CLERK_PROXY_URL',
    'NEXT_PUBLIC_CLERK_DOMAIN',
  ])
    if (environment[name]) reject(`${name} must not be inherited`);
  const publishableKey = environment.CLERK_PUBLISHABLE_KEY ?? '';
  const secretKey = environment.CLERK_SECRET_KEY ?? '';
  const previewKey = environment.CONVEX_DEPLOY_KEY ?? '';
  const encoded = /^pk_test_([A-Za-z0-9+/]+={0,2})$/.exec(publishableKey)?.[1];
  if (
    !encoded ||
    Buffer.from(encoded, 'base64').toString('utf8') !==
      `${resources.clerkHost}$` ||
    Buffer.from(`${resources.clerkHost}$`)
      .toString('base64')
      .replace(/=+$/, '') !== encoded.replace(/=+$/, '')
  ) {
    reject('Clerk publishable key must encode the declared development host');
  }
  if (!/^sk_test_[A-Za-z0-9]+$/.test(secretKey))
    reject('Clerk secret key must be a test key');
  if (
    environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== publishableKey
  ) {
    reject('frontend Clerk key does not match the declared test key');
  }
  if (
    !/^preview:[a-z0-9-]+:[a-z0-9-]+\|[^\s|]+$/.test(previewKey) ||
    !previewKey.startsWith(`preview:${resources.team}:${resources.project}|`)
  ) {
    reject(
      'Convex credential must be a preview creation key for the declared project',
    );
  }
  if (resources.production.clerkHosts.includes(resources.clerkHost))
    reject('Clerk target is production');
  return { resources, publishableKey, secretKey, previewKey };
}

// Called inside Convex's --cmd callback; the URL comes from preview creation,
// never from inherited frontend configuration or a guessed deployment hostname.
export function validatePreviewBinding(resources: Resources, url: string) {
  if (
    !convexCloudUrlPattern.test(url) ||
    resources.production.convexUrls.includes(url)
  ) {
    reject('resolved Convex URL is malformed or production');
  }
  return url;
}

export async function runE2EPreflight<T>(
  environment: Environment,
  declaration: unknown,
  firstWrite: (targets: SafeTargets) => T | Promise<T>,
) {
  return await firstWrite(validateE2ETargets(environment, declaration));
}
