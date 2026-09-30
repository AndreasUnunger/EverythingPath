import { appendFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { availableParallelism, tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';
import { createServer } from 'node:net';
import { cohortWorkers } from './cohorts';
import { verifyClerkCohorts } from './clerk';
import { loadTargets } from './configuration';
import { HarnessFailure } from './diagnostics';
import { command, loadRun, savePrivate, type Run } from './process';
import { evaluateResults } from './results';
import {
  acquireSlotLock,
  failureReport,
  releaseSlotLock,
  setupStage,
  withCleanup,
} from './setup-failure';
import { sourceFingerprint } from './source-evidence';
import { checkGeneratedBindings, copyBuildWorkspace } from './workspace';

async function availablePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new HarnessFailure({ kind: 'port' });
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

// Every operation with a failure mode, so tests can drive each stage.
export const runnerDependencies = {
  cwd: () => process.cwd(),
  loadTargets,
  cohortWorkers,
  verifyClerkCohorts: (targets: Parameters<typeof verifyClerkCohorts>[0]) =>
    verifyClerkCohorts(targets),
  createDirectory: (path: string, mode?: number) =>
    mkdir(path, { recursive: true, mode }),
  acquireSlotLock,
  releaseSlotLock,
  createTemporaryDirectory: () =>
    mkdtemp(join(tmpdir(), 'everythingpath-e2e-')),
  removeDirectory: (path: string) => rm(path, { recursive: true, force: true }),
  sourceFingerprint,
  copyBuildWorkspace,
  savePrivate,
  availablePort,
  command,
  checkGeneratedBindings,
  loadRun,
};
export type RunnerDependencies = typeof runnerDependencies;

export async function runE2E(
  argv: string[],
  overrides: Partial<RunnerDependencies> = {},
) {
  const use = { ...runnerDependencies, ...overrides };
  const deadline = Date.now() + 1_050_000;
  const remaining = () => {
    const milliseconds = deadline - Date.now();
    if (milliseconds <= 0) throw new HarnessFailure({ kind: 'deadline' });
    return milliseconds;
  };
  const { values, resources } = await setupStage('arguments', () => {
    const { values } = parseArgs({
      args: argv,
      options: {
        resources: { type: 'string' },
        secrets: { type: 'string' },
        preflight: { type: 'boolean' },
        nightly: { type: 'boolean' },
        workers: { type: 'string' },
      },
      strict: true,
    });
    if (!values.resources) throw new HarnessFailure({ kind: 'usage' });
    return { values, resources: values.resources };
  });
  const targets = await setupStage('resources', () =>
    use.loadTargets(resources, values.secrets),
  );
  const workers = await setupStage('workers', () =>
    use.cohortWorkers(
      targets.resources,
      values.workers === undefined ? undefined : Number(values.workers),
    ),
  );
  await setupStage('clerk-verification', () => use.verifyClerkCohorts(targets));
  if (values.preflight) {
    process.stdout.write(
      'E2E preflight and read-only Clerk verification passed.\n',
    );
    return;
  }

  const sourceRoot = await setupStage('source-root', use.cwd);
  const privateRoot = join(sourceRoot, 'e2e', '.private');
  await setupStage('private-directory', () =>
    use.createDirectory(privateRoot, 0o700),
  );
  // Exclusive local slot ownership; CI also serializes by slot.
  const slotLock = await setupStage('slot-lock', () =>
    use.acquireSlotLock(privateRoot, targets.resources.previewName),
  );
  let temporary: string | undefined;
  const cleanups = [
    [
      'temporary-directory',
      async () => {
        if (temporary) await use.removeDirectory(temporary);
      },
    ],
    ['slot-lock', () => use.releaseSlotLock(slotLock)],
  ] as const;
  await withCleanup(async () => {
    temporary = await setupStage(
      'temporary-directory',
      use.createTemporaryDirectory,
    );
    const workspace = join(temporary, 'workspace');
    const privateDirectory = join(temporary, 'private');
    const artifactDirectory = join(
      sourceRoot,
      'e2e-artifacts',
      targets.resources.previewName,
      basename(temporary),
    );
    // Explicit file list prevents Next/Clerk/Convex from auto-loading personal .env files.
    const testedSource = await setupStage('source-snapshot', async () => {
      const fingerprint = use.sourceFingerprint(sourceRoot);
      await use.copyBuildWorkspace(sourceRoot, workspace);
      if (use.sourceFingerprint(sourceRoot) !== fingerprint)
        throw new HarnessFailure({ kind: 'source-changed' });
      return fingerprint;
    });
    const envFile = join(privateDirectory, 'convex.env');
    await setupStage('environment', () =>
      use.savePrivate(envFile, `CONVEX_DEPLOY_KEY=${targets.previewKey}\n`),
    );
    const port = await setupStage('port', use.availablePort);
    const run: Run = {
      mode: values.nightly ? 'nightly' : 'mandatory',
      workers,
      resources: targets.resources,
      sourceRoot,
      sourceFingerprint: testedSource,
      workspace,
      privateDirectory,
      artifactDirectory,
      envFile,
      // WebKit rejects Clerk's Domain=localhost client cookie. The loopback
      // IP accepts that domain-scoped cookie without altering real auth.
      baseURL: `http://127.0.0.1:${port}`,
    };
    const runFile = join(privateDirectory, 'run.json');
    await setupStage('run-file', () =>
      use.savePrivate(runFile, JSON.stringify(run)),
    );
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
      'E2E_FORCE_FAILURE',
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
      `E2E target: preview ${targets.resources.previewName}; recreate, deploy and build. Workers: ${workers}, one cohort each (${availableParallelism()} CPUs).\n`,
    );
    // Its run-file read and first stages.log write report as `evidence`.
    await setupStage('deployment', () =>
      use.command(
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
        { cwd: workspace, env: childEnv, timeout: remaining() },
      ),
    );
    await setupStage('generated-bindings', () =>
      use.checkGeneratedBindings(sourceRoot, workspace),
    );
    process.env.E2E_RUN_FILE = runFile;
    const fixture = await setupStage('preview-binding', async () => {
      const bound = await use.loadRun();
      if (!bound.fixture) throw new HarnessFailure({ kind: 'preview-unbound' });
      return bound.fixture;
    });
    childEnv.NEXT_PUBLIC_CONVEX_URL = fixture.convexUrl;
    await setupStage('artifact-directory', () =>
      use.createDirectory(artifactDirectory),
    );
    let requiredPassed = false;
    try {
      await use.command(
        `E2E ${run.mode} browser journeys`,
        ['exec', 'playwright', 'test', '--config', 'playwright.config.ts'],
        { cwd: workspace, env: childEnv, timeout: remaining() },
      );
    } finally {
      // Only fixed diagnostics reach the console; provider output stays private.
      const report: unknown = await readFile(
        join(artifactDirectory, 'report.json'),
        'utf8',
      )
        .then((contents) => JSON.parse(contents) as unknown)
        .catch(() => null);
      requiredPassed = evaluateResults(report, run.mode);
      // Relative to the checkout, so the console never shows a local path.
      process.stdout.write(
        `E2E ${run.mode} browser results: ${requiredPassed ? 'passed' : 'failed or missing'}. Safe evidence: e2e-artifacts/${targets.resources.previewName}/${basename(temporary)}\n`,
      );
    }
    if (!requiredPassed)
      throw new HarnessFailure({ kind: 'results', mode: run.mode });
    if (process.env.GITHUB_OUTPUT)
      await appendFile(process.env.GITHUB_OUTPUT, 'required_result=passed\n');
    process.stdout.write(`E2E ${run.mode} browser journeys passed.\n`);
  }, cleanups);
}

// Provider errors can include payloads; print only lines rebuilt from fixed
// stage labels, closed error classes and typed diagnostic fields.
export async function runAndReport(
  argv: string[],
  overrides: Partial<RunnerDependencies> = {},
) {
  try {
    await runE2E(argv, overrides);
    return 0;
  } catch (error) {
    process.stderr.write(`${failureReport(error).join('\n')}\n`);
    return 1;
  }
}
