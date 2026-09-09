import { mkdtemp, readFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs, parseEnv } from 'node:util';
import { createServer } from 'node:net';
import { validateE2ETargets } from './support/preflight';
import { verifyClerkCohorts } from './support/clerk';
import { command, loadRun, savePrivate, type Run } from './support/process';
import {
  copyBuildWorkspace,
  checkGeneratedBindings,
} from './support/workspace';

async function availablePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Cannot allocate E2E port');
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

async function main() {
  const { values } = parseArgs({
    options: {
      resources: { type: 'string' },
      secrets: { type: 'string' },
      preflight: { type: 'boolean' },
    },
    strict: true,
  });
  if (!values.resources)
    throw new Error(
      'Usage: pnpm test:e2e --resources /absolute/resources.json [--secrets /absolute/test-secrets.env] [--preflight]',
    );
  const declaration: unknown = JSON.parse(
    await readFile(resolve(values.resources), 'utf8'),
  );
  const secrets = values.secrets
    ? parseEnv(await readFile(resolve(values.secrets), 'utf8'))
    : {};
  // Inspect inherited targets separately so a secrets file cannot hide them.
  for (const key of Object.keys(secrets))
    if (
      ![
        'CLERK_PUBLISHABLE_KEY',
        'CLERK_SECRET_KEY',
        'CONVEX_DEPLOY_KEY',
      ].includes(key)
    )
      throw new Error(
        'Secrets file may contain only the three declared service keys',
      );
  const targets = validateE2ETargets(
    { ...process.env, ...secrets },
    declaration,
  );
  if (
    targets.resources.workers.length !== 1 ||
    targets.resources.workers[0]?.key !== 'worker-0'
  )
    throw new Error('This harness enables only the worker-0 cohort');
  await verifyClerkCohorts(targets);
  if (values.preflight) {
    process.stdout.write(
      'E2E preflight and read-only Clerk verification passed.\n',
    );
    return;
  }

  const sourceRoot = process.cwd();
  const privateRoot = join(sourceRoot, 'e2e', '.private');
  await mkdir(privateRoot, { recursive: true, mode: 0o700 });
  const slotLock = join(privateRoot, `${targets.resources.previewName}.lock`);
  await mkdir(slotLock); // Exclusive local slot ownership; CI also serializes by slot.
  let temporary: string | undefined;
  try {
    temporary = await mkdtemp(join(tmpdir(), 'everythingpath-e2e-'));
    const workspace = join(temporary, 'workspace');
    const privateDirectory = join(temporary, 'private');
    const artifactDirectory = join(
      sourceRoot,
      'e2e-artifacts',
      targets.resources.previewName,
    );
    // Explicit file list prevents Next/Clerk/Convex from auto-loading personal .env files.
    await copyBuildWorkspace(sourceRoot, workspace);
    const envFile = join(privateDirectory, 'convex.env');
    await savePrivate(envFile, `CONVEX_DEPLOY_KEY=${targets.previewKey}\n`);
    const run: Run = {
      resources: targets.resources,
      sourceRoot,
      workspace,
      privateDirectory,
      artifactDirectory,
      envFile,
      baseURL: `http://127.0.0.1:${await availablePort()}`,
    };
    const runFile = join(privateDirectory, 'run.json');
    await savePrivate(runFile, JSON.stringify(run));
    const childEnv: NodeJS.ProcessEnv = { NODE_ENV: 'production' };
    for (const key of [
      'PATH',
      'HOME',
      'TMPDIR',
      'SYSTEMROOT',
      'CI',
      'GITHUB_ACTIONS',
      'GITHUB_EVENT_NAME',
      'GITHUB_SHA',
      'GITHUB_ACTOR',
      'E2E_REVIEWED_SHA',
    ])
      if (process.env[key]) childEnv[key] = process.env[key];
    Object.assign(childEnv, {
      E2E_RUN_FILE: runFile,
      E2E_TRUSTED_EXECUTION: 'true',
      CLERK_PUBLISHABLE_KEY: targets.publishableKey,
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: targets.publishableKey,
      CLERK_SECRET_KEY: targets.secretKey,
      CONVEX_DEPLOY_KEY: targets.previewKey,
    });
    process.stdout.write(
      `E2E target: preview ${targets.resources.previewName}; recreate, deploy and build.\n`,
    );
    await command(
      'preview deployment and web build',
      [
        'exec',
        'convex',
        'deploy',
        '--preview-create',
        targets.resources.previewName,
        '--env-file',
        envFile,
        '--cmd',
        'pnpm exec tsx e2e/bind-preview.ts',
        '--cmd-url-env-var-name',
        'NEXT_PUBLIC_CONVEX_URL',
      ],
      { cwd: workspace, env: childEnv, timeout: 600_000 },
    );
    await checkGeneratedBindings(sourceRoot, workspace);
    process.env.E2E_RUN_FILE = runFile;
    const bound = await loadRun();
    if (!bound.fixture)
      throw new Error('Preview callback did not bind the frontend');
    childEnv.NEXT_PUBLIC_CONVEX_URL = bound.fixture.convexUrl;
    await mkdir(artifactDirectory, { recursive: true });
    await command(
      'Chromium tablet smoke',
      ['exec', 'playwright', 'test', '--config', 'playwright.config.ts'],
      { cwd: workspace, env: childEnv, timeout: 720_000 },
    );
    process.stdout.write('E2E Chromium tablet smoke passed.\n');
  } finally {
    if (temporary) await rm(temporary, { recursive: true, force: true });
    await rm(slotLock, { recursive: true, force: true });
  }
}

try {
  await main();
} catch (error) {
  // Provider errors can include payloads; show only our own fixed diagnostics.
  const message =
    error instanceof Error &&
    /^(E2E |Clerk |Convex generated|This harness|Secrets file|Usage:|preview deployment|Chromium tablet|Preview callback)/.test(
      error.message,
    )
      ? error.message
      : 'E2E setup failed; verify the resource declaration and fixture provisioning.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
