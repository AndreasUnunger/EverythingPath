import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { command, loadRun, savePrivate } from './support/process';
import { validatePreviewBinding } from './support/preflight';

const run = await loadRun();
const convexUrl = validatePreviewBinding(
  run.resources,
  process.env.NEXT_PUBLIC_CONVEX_URL ?? '',
);
run.fixture = {
  version: 1,
  namespace: run.resources.previewName,
  convexUrl,
  clerkHost: run.resources.clerkHost,
  productionConvexUrls: run.resources.production.convexUrls,
  workers: run.resources.workers.map((worker) => ({
    ...worker,
    cases: {
      smoke: randomBytes(32).toString('hex'),
      isolation: randomBytes(32).toString('hex'),
    },
  })),
};
const settingsFile = join(run.privateDirectory, 'fixture-settings.env');
await savePrivate(
  settingsFile,
  [
    'E2E_ENABLED=true',
    `E2E_FIXTURE_CONFIG='${JSON.stringify(run.fixture)}'`,
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
await savePrivate(process.env.E2E_RUN_FILE!, JSON.stringify(run));
await command('production web build', ['build:web'], {
  cwd: run.workspace,
  timeout: 480_000,
});
