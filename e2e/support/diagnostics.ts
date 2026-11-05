// Conditions the E2E harness raises itself. Each carries only fixed fields;
// `describeDiagnostic` builds the printed text from them, so no runtime
// string (message, path, file name, provider output) can reach the console.

const fixedTexts = {
  usage:
    'Usage: pnpm test:e2e --resources /absolute/resources.json [--secrets /absolute/test-secrets.env] [--preflight] [--nightly] [--workers N]',
  deadline: 'E2E execution exceeded seventeen and a half minutes',
  'source-changed': 'E2E source changed while preparing the test workspace',
  'preview-unbound': 'Preview callback did not bind the frontend',
  'run-file-missing':
    'Run E2E through pnpm test:e2e with an explicit resource declaration',
  port: 'Cannot allocate E2E port',
  'secrets-mode': 'E2E secrets file must have mode 600',
  'secrets-keys':
    'Secrets file may contain only the three declared service keys',
  'cohorts-distinct':
    'E2E worker cohorts must have distinct keys, organizations and identities',
  'cohorts-order':
    'E2E worker cohorts must be declared in order as worker-0, worker-1, ...',
  'clerk-request':
    'Clerk fixture verification failed; check the resource declaration and provisioned cohort',
  'clerk-instance': 'Clerk instance is not development',
  'clerk-keys':
    'Clerk secret and publishable keys belong to different applications',
  'clerk-identity': 'Clerk fixture identity drift',
  'clerk-membership':
    'Clerk fixture membership drift; provision the declared cohort before running E2E',
  'diagnostic-log': 'E2E diagnostic log could not be saved',
  'slot-lock-replaced':
    'E2E slot lock was removed or replaced during the run; any replacement was left in place',
  'slot-lock-displaced':
    'E2E slot lock at the lock path belonged to another run and the path was taken again before it could be restored; it was left beside the lock as <slot>.lock.releasing-<token> for manual review',
  'triage-usage': 'Use summarize or publish',
  'triage-current-missing': 'Current nightly run is missing',
  'triage-history-incomplete': 'Nightly history artifact is incomplete',
} as const;
type FixedKind = keyof typeof fixedTexts;

export const inheritedSelectors = [
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
] as const;
export const preflightReasons = [
  'invalid resource declaration',
  'trusted execution must be explicitly enabled',
  'CI requires a trusted workflow for the reviewed commit',
  ...inheritedSelectors.map((name) => `${name} must not be inherited` as const),
  'Convex credential must be a preview creation key for the declared project',
  'Clerk publishable key must encode the declared development host',
  'Clerk secret key must be a test key',
  'frontend Clerk key does not match the declared test key',
  'Clerk target is production',
  'resolved Convex URL is malformed or production',
] as const;
export type PreflightReason = (typeof preflightReasons)[number];

// The bindings Convex generates; any other name prints as a fixed phrase.
const generatedFiles = [
  'api.d.ts',
  'api.js',
  'dataModel.d.ts',
  'server.d.ts',
  'server.js',
] as const;

export type Diagnostic =
  | { kind: FixedKind }
  | { kind: 'preflight'; reason: PreflightReason }
  | { kind: 'workers-range'; cohorts: number }
  | { kind: 'generated-drift'; file: string }
  | { kind: 'results'; mode: string };

// Re-validates every field at print time, so even a mistyped value maps to
// fixed text.
export function describeDiagnostic(diagnostic: Diagnostic): string {
  switch (diagnostic.kind) {
    case 'preflight':
      return `E2E preflight: ${
        (preflightReasons as readonly string[]).includes(diagnostic.reason)
          ? diagnostic.reason
          : 'target validation failed'
      }`;
    case 'workers-range':
      return `E2E workers must be between 1 and the ${
        Number.isSafeInteger(diagnostic.cohorts) && diagnostic.cohorts >= 0
          ? diagnostic.cohorts
          : 'declared number of'
      } declared cohorts`;
    case 'generated-drift': {
      const file =
        diagnostic.file === 'file list' ||
        (generatedFiles as readonly string[]).includes(diagnostic.file)
          ? diagnostic.file
          : 'another generated file';
      return `Convex generated-code drift (${file}); regenerate and review before E2E`;
    }
    case 'results':
      return `E2E ${
        diagnostic.mode === 'nightly' ? 'nightly' : 'mandatory'
      } results are incomplete or unsuccessful`;
    default:
      return Object.hasOwn(fixedTexts, diagnostic.kind)
        ? fixedTexts[diagnostic.kind]
        : 'E2E harness check failed';
  }
}

export class HarnessFailure extends Error {
  constructor(readonly diagnostic: Diagnostic) {
    super(describeDiagnostic(diagnostic));
    this.name = 'HarnessFailure';
  }
}

// A failure that happened while handling another one (for example the
// `stages.log` write after a command failed). The primary error stays the one
// that is thrown; the secondary is only classified when reporting.
const secondaryFailures = new WeakMap<object, unknown>();
export function recordSecondaryFailure(primary: unknown, secondary: unknown) {
  if (typeof primary === 'object' && primary !== null)
    secondaryFailures.set(primary, secondary);
}
export function secondaryFailure(primary: unknown) {
  return typeof primary === 'object' && primary !== null
    ? secondaryFailures.get(primary)
    : undefined;
}
