// Test-only entry point: runs the real runner and its real error path in a
// child process with one injected failure, so tests read the actual stdout
// and stderr. Usage: runner-probe.ts <scenario> <root directory>.
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  command,
  CommandEvidenceFailure,
  CommandFailure,
  savePrivate,
  type Run,
} from '../process';
import { HarnessFailure } from '../diagnostics';
import { runAndReport, type RunnerDependencies } from '../runner';
import { slotLockPath, type SetupStage } from '../setup-failure';
import { resources } from '../test-data';

export const probeSecret = 'sk_test_PROBESECRET';
const [scenario = '', root = ''] = process.argv.slice(2);
const privateRoot = join(root, 'e2e', '.private');
const lockPath = slotLockPath(privateRoot, resources.previewName);

// Messages that start with every prefix the old allowlist trusted.
const prefixes = [
  'Clerk ',
  'E2E ',
  'Usage: ',
  'preview deployment ',
  'Convex generated ',
  'This harness ',
  'Secrets file ',
  'Chromium tablet ',
  'Preview callback ',
];
let thrown = 0;
function hostile() {
  const prefix = prefixes[thrown++ % prefixes.length]!;
  const error = new Error(
    `${prefix}https://x.test/?token=${probeSecret} \u001b[2J${root}`,
    { cause: new Error(probeSecret) },
  );
  error.name = probeSecret;
  error.stack = probeSecret;
  return error;
}

const targets = {
  resources,
  publishableKey: 'pk_test_probe',
  secretKey: probeSecret,
  previewKey: `preview:test-team:test-project|${probeSecret}`,
};
const passing: Partial<RunnerDependencies> = {
  cwd: () => root,
  loadTargets: () => Promise.resolve(targets),
  cohortWorkers: () => 1,
  verifyClerkCohorts: () => Promise.resolve(),
  sourceFingerprint: () => 'fingerprint',
  copyBuildWorkspace: () => Promise.resolve(),
  availablePort: () => Promise.resolve(4321),
  command: () => Promise.resolve(''),
  checkGeneratedBindings: () => Promise.resolve(),
  loadRun: () =>
    Promise.resolve({
      fixture: { convexUrl: 'https://probe.convex.cloud' },
    } as unknown as Run),
};
const createDirectory = (path: string, mode?: number) =>
  mkdir(path, { recursive: true, mode });

const failAt: Record<
  Exclude<SetupStage, 'arguments'>,
  () => Partial<RunnerDependencies>
> = {
  resources: () => ({ loadTargets: () => Promise.reject(hostile()) }),
  workers: () => ({
    cohortWorkers: () => {
      throw hostile();
    },
  }),
  'clerk-verification': () => ({
    verifyClerkCohorts: () => Promise.reject(hostile()),
  }),
  'source-root': () => ({
    cwd: () => {
      throw hostile();
    },
  }),
  'private-directory': () => ({
    createDirectory: (path, mode) =>
      path === privateRoot
        ? Promise.reject(hostile())
        : createDirectory(path, mode),
  }),
  'slot-lock': () => ({ acquireSlotLock: () => Promise.reject(hostile()) }),
  'temporary-directory': () => ({
    createTemporaryDirectory: () => Promise.reject(hostile()),
  }),
  'source-snapshot': () => ({
    copyBuildWorkspace: () => Promise.reject(hostile()),
  }),
  environment: () => ({
    savePrivate: (path, content) =>
      path.endsWith('convex.env')
        ? Promise.reject(hostile())
        : savePrivate(path, content),
  }),
  port: () => ({ availablePort: () => Promise.reject(hostile()) }),
  'run-file': () => ({
    savePrivate: (path, content) =>
      path.endsWith('run.json')
        ? Promise.reject(hostile())
        : savePrivate(path, content),
  }),
  evidence: () => ({
    command: (stage) =>
      Promise.reject(new CommandEvidenceFailure(stage, hostile())),
  }),
  deployment: () => ({
    command: () =>
      Promise.reject(new CommandFailure(`deploy ${probeSecret}`, 1)),
  }),
  'generated-bindings': () => ({
    checkGeneratedBindings: () => Promise.reject(hostile()),
  }),
  'preview-binding': () => ({ loadRun: () => Promise.reject(hostile()) }),
  'artifact-directory': () => ({
    createDirectory: (path, mode) =>
      path.includes('e2e-artifacts')
        ? Promise.reject(hostile())
        : createDirectory(path, mode),
  }),
};

async function writeOwner(owner: string) {
  await mkdir(lockPath, { recursive: true });
  await writeFile(
    join(lockPath, 'owner.json'),
    JSON.stringify({ owner, createdAt: '2026-09-30T05:40:40.453Z' }),
  );
}

// A convex CLI stand-in: it breaks stages.log, prints a secret, exits 3.
async function brokenLogCommand(): Promise<Partial<RunnerDependencies>> {
  const cli = join(root, 'cli');
  const packageDirectory = join(cli, 'node_modules', 'convex');
  await mkdir(packageDirectory, { recursive: true });
  await writeFile(
    join(packageDirectory, 'package.json'),
    JSON.stringify({ name: 'convex', bin: 'fixture.cjs' }),
  );
  await writeFile(
    join(packageDirectory, 'fixture.cjs'),
    `const fs = require('node:fs'); const path = require('node:path');
const run = JSON.parse(fs.readFileSync(process.env.E2E_RUN_FILE, 'utf8'));
const log = path.join(run.artifactDirectory, 'stages.log');
fs.rmSync(log, { force: true }); fs.mkdirSync(log);
process.stderr.write(${JSON.stringify(`Error: ${probeSecret}\n`)});
process.exit(3);`,
  );
  return {
    command: (stage, _args, options) =>
      command(stage, ['exec', 'convex', 'run', 'probe'], {
        ...options,
        cwd: cli,
      }),
  };
}

async function generatedBindings(
  sourceName: string,
  workspaceName: string,
): Promise<Partial<RunnerDependencies>> {
  const { checkGeneratedBindings } = await import('../workspace');
  return {
    copyBuildWorkspace: async (sourceRoot, workspace) => {
      for (const [directory, name, content] of [
        [sourceRoot, sourceName, 'source'],
        [workspace, workspaceName, `generated ${probeSecret}`],
      ] as const) {
        await mkdir(join(directory, 'convex', '_generated'), {
          recursive: true,
        });
        await writeFile(join(directory, 'convex', '_generated', name), content);
      }
    },
    checkGeneratedBindings,
  };
}

const hostileFile = `evil\u001b[2J\r${probeSecret}\n.ts`;
const argv = ['--resources', '/probe/resources.json', '--nightly'];
let overrides: Partial<RunnerDependencies> = {};
let args = argv;
if (scenario.startsWith('stage:')) {
  const stage = scenario.slice('stage:'.length) as SetupStage;
  if (stage === 'arguments') args = ['--nope', probeSecret];
  else overrides = failAt[stage]();
} else if (scenario === 'usage') args = [];
else if (scenario === 'diagnostic')
  overrides = {
    loadTargets: () =>
      Promise.reject(
        new HarnessFailure({
          kind: 'preflight',
          reason: 'Clerk secret key must be a test key',
        }),
      ),
  };
else if (scenario === 'locked') await writeOwner(randomUUID());
else if (scenario === 'replaced-lock')
  overrides = {
    command: async () => {
      await rm(lockPath, { recursive: true });
      await writeOwner('00000000-0000-4000-8000-000000000000');
      throw new CommandFailure('preview deployment and web build', 1);
    },
  };
else if (scenario === 'released-lock') overrides = {};
else if (scenario === 'git-fingerprint')
  overrides = { sourceFingerprint: undefined };
else if (scenario === 'git-copy') overrides = { copyBuildWorkspace: undefined };
else if (scenario === 'generated-list')
  overrides = await generatedBindings('api.d.ts', hostileFile);
else if (scenario === 'generated-file')
  overrides = await generatedBindings(hostileFile, hostileFile);
else if (scenario === 'log-failure') overrides = await brokenLogCommand();
else throw new Error('unknown probe scenario');

// `undefined` overrides restore the real dependency.
const merged = Object.fromEntries(
  Object.entries({ ...passing, ...overrides }).filter(
    ([, value]) => value !== undefined,
  ),
) as Partial<RunnerDependencies>;
process.exitCode = await runAndReport(args, merged);
// Lets the test read the lock state the runner left behind.
await readFile(join(lockPath, 'owner.json'), 'utf8').then(
  (owner) => process.stdout.write(`PROBE-LOCK ${owner}\n`),
  () => process.stdout.write('PROBE-LOCK none\n'),
);
