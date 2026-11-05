import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { command, loadRun, savePrivate } from './support/process';
import { validatePreviewBinding } from './support/preflight';
import { caseKeys, FIXTURE_VERSION, type CaseKey } from './fixtures/catalog';

const run = await loadRun();
const convexUrl = validatePreviewBinding(
  run.resources,
  process.env.NEXT_PUBLIC_CONVEX_URL ?? '',
);
run.fixture = {
  version: FIXTURE_VERSION,
  namespace: run.resources.previewName,
  convexUrl,
  clerkHost: run.resources.clerkHost,
  productionConvexUrls: run.resources.production.convexUrls,
  workers: run.resources.workers.map((worker) => ({
    ...worker,
    // One fresh capability per worker and catalog case.
    cases: Object.fromEntries(
      caseKeys.map((caseKey) => [caseKey, randomBytes(32).toString('hex')]),
    ) as Record<CaseKey, string>,
  })),
};
const settingsFile = join(run.privateDirectory, 'fixture-settings.env');
const fixtureConfigFile = join(run.privateDirectory, 'fixture-config.json');
await savePrivate(fixtureConfigFile, JSON.stringify(run.fixture));
await savePrivate(
  settingsFile,
  [
    'E2E_ENABLED=true',
    `CLERK_FRONTEND_API_URL=https://${run.resources.clerkHost}`,
  ].join('\n'),
);
await command(
  'bind preview fixture environment',
  [
    'exec',
    'convex',
    'env',
    'set',
    '--from-file',
    settingsFile,
    '--force',
    '--preview-name',
    run.resources.previewName,
    '--env-file',
    run.envFile,
  ],
  { cwd: run.workspace },
);
await command(
  'bind preview fixture capabilities',
  [
    'exec',
    'convex',
    'env',
    'set',
    'E2E_FIXTURE_CONFIG',
    '--from-file',
    fixtureConfigFile,
    '--preview-name',
    run.resources.previewName,
    '--env-file',
    run.envFile,
  ],
  { cwd: run.workspace },
);
await savePrivate(process.env.E2E_RUN_FILE!, JSON.stringify(run));
await command('production web build', ['build:web'], {
  cwd: run.workspace,
  timeout: 480_000,
});
