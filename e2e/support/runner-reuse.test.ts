// @vitest-environment node
import { existsSync } from 'node:fs';
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  discardLocalBackend,
  localBackendImage,
  recoverLocalBackendData,
} from '../../scripts/local-convex/backend';
import { useFakeDocker } from '../../tests/local-convex-fake-docker';
import { requiredTests } from './matrix';
import {
  preparedEnvironmentDirectory,
  readPreparedRecord,
} from './prepared-environment';
import { runSchema, type Run } from './process';
import {
  diagnosticExitCode,
  runAndReport,
  runE2E,
  type RunnerDependencies,
} from './runner';
import { HarnessFailure } from './diagnostics';
import { failureReport, slotLockPath } from './setup-failure';
import { deploymentFixture, resources } from './test-data';

// #754: `--reuse` keeps a prepared local environment between diagnostic
// runs. Docker, Convex and Playwright are fakes here; the record, the
// directories and the cleanup order are real.

// The real data recovery and discard, where a test uses them, talk to this
// fake daemon (#774 fix r1); nothing else here runs Docker.
const docker = useFakeDocker();
let parent: string;
let root: string;
let written: string[];
// Containers are numbered across the runs of one test.
let containers = 0;
beforeEach(async () => {
  containers = 0;
  // Test runners often set CI, which refuses --reuse.
  vi.stubEnv('CI', '');
  parent = await mkdtemp(join(tmpdir(), 'e2e-runner-reuse-'));
  root = join(parent, 'checkout');
  await mkdir(root);
  written = [];
  vi.spyOn(process.stdout, 'write').mockImplementation((text) => {
    written.push(String(text));
    return true;
  });
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  delete process.env.E2E_RUN_FILE;
  await rm(parent, { recursive: true, force: true });
});

const preparedDirectory = () =>
  preparedEnvironmentDirectory({
    sourceRoot: root,
    previewName: resources.previewName,
  });
// #774: the slot's backend data, beside the checkout with the same key.
const dataRootPath = () =>
  join(parent, '.ep-tmp', 'e2e-data', basename(preparedDirectory()));
async function currentRecord() {
  const read = await readPreparedRecord(preparedDirectory());
  if (read.kind !== 'current')
    throw new Error(`expected a current record, read ${read.kind}`);
  return read.record;
}
const recordText = () =>
  readFile(join(preparedDirectory(), 'record.json'), 'utf8');
/** A record an earlier (schema-1) run left, whose data is an anonymous volume. */
async function writeLegacyRecord(state: 'ready' | 'in-use' = 'ready') {
  const record = await currentRecord();
  const { dataPlacement: _placement, ...backend } = record.preparation!.backend;
  await writeFile(
    join(preparedDirectory(), 'record.json'),
    JSON.stringify({
      ...record,
      schema: 1,
      state,
      preparation: { ...record.preparation, backend },
    }),
  );
}
const instance = (n: number) =>
  `ep-e2e-${String(n).repeat(8)}-1111-1111-1111-111111111111`;
const fingerprintParts = (sources = 'b') => ({
  reuseFingerprint: (sources === 'b' ? 'a' : 'f').repeat(64),
  parts: {
    sources: sources.repeat(64),
    buildEnvironment: 'c'.repeat(64),
    node: 'v24.0.0',
    pnpm: '10.0.0',
    dependencies: 'd'.repeat(64),
  },
});

/** One run's fakes and what they saw. */
function fakes({
  sources = 'b',
  epoch = 0,
  epochAtCleanup = epoch,
  running = new Set<string>(),
  browsersPass = true,
  overrides = {},
}: {
  sources?: string;
  epoch?: number;
  epochAtCleanup?: number;
  running?: Set<string>;
  browsersPass?: boolean;
  overrides?: Partial<RunnerDependencies>;
} = {}) {
  const events: string[] = [];
  let saved: Run | undefined;
  let created = 0;
  let epochReads = 0;
  const stubs: Partial<RunnerDependencies> = {
    cwd: () => root,
    loadTargets: () =>
      Promise.resolve({
        resources,
        publishableKey: 'pk_test_probe',
        secretKey: 'sk_test_probe',
        previewKey: '',
      }),
    cohortWorkers: () => 1,
    verifyClerkCohorts: () => Promise.resolve(),
    checkLocalBackendHost: () => Promise.resolve(),
    createTemporaryDirectory: async () => {
      const directory = join(parent, `run-${Date.now()}-${created++}`);
      await mkdir(join(directory, 'private'), { recursive: true });
      return directory;
    },
    sourceFingerprint: () => 'full-fingerprint',
    copyBuildWorkspace: async (_source, workspace) => {
      events.push('copy workspace');
      await mkdir(workspace, { recursive: true });
    },
    refreshSpecFiles: async () => {
      events.push('refresh specs');
    },
    reuseFingerprint: () => fingerprintParts(sources),
    readToolchain: () => ({ node: 'v24.0.0', pnpm: '10.0.0' }),
    savePrivate: (path, content) => {
      if (path.endsWith('run.json'))
        saved = runSchema.parse(JSON.parse(String(content)));
      return Promise.resolve();
    },
    availablePort: () => Promise.resolve(4321),
    startLocalBackend: async (options) => {
      const { directory } = options;
      const reuseName = 'reuseName' in options ? options.reuseName : undefined;
      // Every E2E backend gets this slot's verified data root.
      expect('dataRoot' in options && options.dataRoot?.path).toBe(
        dataRootPath(),
      );
      const name = reuseName ?? instance(containers++);
      events.push(reuseName ? `resume ${name}` : `create ${name}`);
      return {
        name,
        url: 'http://127.0.0.1:3210',
        siteUrl: 'http://127.0.0.1:3211',
        envFile: join(directory, 'convex.env'),
        adminKeyFile: join(directory, 'local-admin.key'),
        stop: async ({ keep = false } = {}) => {
          events.push(keep ? `keep ${name}` : `remove ${name}`);
        },
      };
    },
    readWriteEpoch: async () => {
      epochReads++;
      // Before the browsers: the deployment's epoch; at cleanup: whatever
      // the run left it at.
      return saved && events.some((event) => event.endsWith('browser journeys'))
        ? epochAtCleanup
        : epoch;
    },
    isLocalBackendRunning: async (name) => running.has(name),
    discardLocalBackend: async ({ name, placement, dataRoot }) => {
      expect(dataRoot.path).toBe(dataRootPath());
      events.push(
        placement === 'volume'
          ? `discard ${name} with its volume`
          : `discard ${name}`,
      );
    },
    recoverLocalBackendData: async ({ dataRoot, keep }) => {
      expect(dataRoot.path).toBe(dataRootPath());
      events.push(keep ? `recover data keeping ${keep}` : 'recover data');
      return { removed: [], kept: [], ignored: 0 };
    },
    isWorkspaceFreeOfSecrets: async () => true,
    command: async (stage, args, options) => {
      events.push(stage);
      if (stage === 'fixture binding')
        expect(args).toEqual([
          'exec',
          'tsx',
          'e2e/bind-preview.ts',
          '--bind-only',
        ]);
      if (stage.endsWith('browser journeys')) {
        const run = saved!;
        expect(options.env?.E2E_RUN_FILE).toBeDefined();
        await mkdir(run.artifactDirectory, { recursive: true });
        await writeFile(
          join(run.artifactDirectory, 'report.json'),
          JSON.stringify({
            status: browsersPass ? 'passed' : 'failed',
            errors: 0,
            tests: requiredTests(run.suite).map(([file, project, title]) => ({
              file,
              project,
              title,
              expectedStatus: 'passed',
              tags: [],
              annotations: [],
              results: [
                { status: browsersPass ? 'passed' : 'failed', retry: 0 },
              ],
            })),
          }),
        );
      }
      return '';
    },
    checkGeneratedBindings: () => Promise.resolve(),
    loadRun: () => Promise.resolve({ ...saved!, fixture: deploymentFixture }),
    ...overrides,
  };
  return {
    stubs,
    events,
    run: () => saved,
    epochReads: () => epochReads,
  };
}

const journey = [
  '--resources',
  '/probe/resources.json',
  '--backend',
  'local',
  '--journey',
  'character-attacks.spec.ts',
];
const reuse = [...journey, '--reuse'];
const discardPrepared = [
  '--resources',
  '/probe/resources.json',
  '--backend',
  'local',
  '--discard-prepared',
];
const inUseText =
  'The prepared E2E environment belongs to another run whose container is still running. Check `docker ps` and `pgrep -af e2e/run`; if no run uses it, stop its container with `docker stop`, then rerun with --discard-prepared';
const lockReleased = () =>
  !existsSync(
    slotLockPath(join(root, 'e2e', '.private'), resources.previewName),
  );

it.each([
  ['the default mandatory suite', ['--backend', 'local']],
  [
    'mandatory with focused groups',
    [
      '--backend',
      'local',
      '--suite',
      'mandatory',
      '--suite',
      'focused',
      '--group',
      'sheet',
    ],
  ],
  ['live integration', ['--backend', 'local', '--suite', 'live']],
  ['the whole nightly suite', ['--backend', 'local', '--suite', 'nightly']],
  ['release qualification', ['--backend', 'local', '--suite', 'release']],
  [
    'the preflight (the land queue)',
    [
      '--backend',
      'local',
      '--preflight',
      '--journey',
      'character-attacks.spec.ts',
    ],
  ],
  [
    'a Cloud preview',
    ['--backend', 'preview', '--journey', 'character-attacks.spec.ts'],
  ],
])('refuses --reuse for %s before any setup', async (_label, extra) => {
  const { stubs, events } = fakes();
  const error = await runE2E(
    ['--resources', '/probe/resources.json', ...extra, '--reuse'],
    stubs,
  ).catch((caught: unknown) => caught);
  expect(failureReport(error)).toEqual([
    '--reuse needs --backend local and a diagnostic selection: --journey, --suite nightly --journey, or --suite focused --group ... alone. Qualifying runs (mandatory, live, nightly, release, --preflight, CI, an outer deadline) always prepare afresh',
    'E2E setup failed: arguments (validation)',
  ]);
  expect(events).toEqual([]);
});

it.each([
  [
    'in CI',
    (): void => {
      vi.stubEnv('CI', 'true');
    },
    [],
  ],
  // Outside CI an outer deadline is refused anyway; in trusted CI, --reuse is.
  [
    'with an outer deadline',
    (): void => undefined,
    ['--outer-deadline-epoch', '1999999999'],
  ],
] as const)(
  'refuses --reuse %s before any setup',
  async (_label, prepare, extra) => {
    prepare();
    const { stubs, events } = fakes();
    const error = await runE2E([...reuse, ...extra], stubs).catch(
      (caught: unknown) => caught,
    );
    expect(failureReport(error).at(-1)).toBe(
      'E2E setup failed: arguments (validation)',
    );
    expect(events).toEqual([]);
  },
);

it.each([
  ['a journey', []],
  ['a nightly journey diagnosis', ['--suite', 'nightly']],
])('accepts --reuse for %s', async (_label, extra) => {
  const { stubs } = fakes();
  // Nothing to reuse yet: it prepares afresh, which is fresh evidence.
  expect(await runE2E([...reuse, ...extra], stubs)).toBe('qualifying');
});

it('accepts --reuse for focused groups alone', async () => {
  const { stubs } = fakes();
  expect(
    await runE2E(
      [
        '--resources',
        '/probe/resources.json',
        '--backend',
        'local',
        '--suite',
        'focused',
        '--group',
        'sheet',
        '--reuse',
      ],
      stubs,
    ),
  ).toBe('qualifying');
});

it('prepares, keeps and then reuses an environment; a reused pass is diagnostic, exit 5, and says so', async () => {
  const first = fakes();
  // A fresh preparation is fresh evidence; only a reused one is diagnostic.
  expect(await runE2E(reuse, first.stubs)).toBe('qualifying');
  // The first --reuse run had nothing to reuse: it deployed and built, and
  // kept the stopped container.
  expect(first.events).toEqual(
    expect.arrayContaining([
      'copy workspace',
      `create ${instance(0)}`,
      'preview deployment and web build',
      `keep ${instance(0)}`,
    ]),
  );
  expect(first.run()?.workspace).toBe(join(preparedDirectory(), 'workspace'));
  const record = await currentRecord();
  expect(record).toMatchObject({
    schema: 2,
    state: 'ready',
    instanceName: instance(0),
    preparation: {
      reuseFingerprint: 'a'.repeat(64),
      sourceFingerprint: 'full-fingerprint',
      workers: 1,
      releaseState: 'none',
      backend: {
        image: localBackendImage,
        url: 'http://127.0.0.1:3210',
        dataPlacement: 'bind-v1',
      },
      writeEpoch: 0,
    },
  });

  const second = fakes();
  expect(await runAndReport(reuse, second.stubs)).toBe(diagnosticExitCode);
  expect(second.events).toEqual([
    // Leftovers are recovered after the reuse decision, keeping the selected
    // instance, and before it is resumed (#774 fix r1).
    `recover data keeping ${instance(0)}`,
    `resume ${instance(0)}`,
    'refresh specs',
    'fixture binding',
    'E2E journeys browser journeys',
    `keep ${instance(0)}`,
  ]);
  expect(second.run()?.preparation).toBe('reused');
  expect(written.join('')).toContain(
    'E2E prepared environment: reused (diagnostic, not qualifying).\n',
  );
  expect(written.join('')).toMatch(
    /browser results: passed \(reused preparation; diagnostic, not qualifying\)/,
  );
  expect(written.join('')).toContain(
    'passed on a reused preparation: diagnostic only, not qualifying (exit 5).',
  );
  expect(await currentRecord()).toMatchObject({
    state: 'ready',
    preparation: { createdAt: record.preparation!.createdAt },
  });
  expect(lockReleased()).toBe(true);
});

it('prepares afresh, removing the old container, when the sources changed', async () => {
  await runE2E(reuse, fakes().stubs);
  const changed = fakes({ sources: 'e' });
  await runE2E(reuse, changed.stubs);
  expect(changed.events).toEqual(
    expect.arrayContaining([
      `discard ${instance(0)}`,
      'copy workspace',
      'preview deployment and web build',
    ]),
  );
  expect(changed.events).not.toContain(`resume ${instance(0)}`);
  expect(written.join('')).toContain(
    'E2E prepared environment: preparing afresh (sources changed).\n',
  );
});

it('prepares afresh when the resumed deployment’s write epoch moved', async () => {
  await runE2E(reuse, fakes().stubs);
  const moved = fakes({ epoch: 1 });
  await runE2E(reuse, moved.stubs);
  expect(moved.events.slice(0, 3)).toEqual([
    `recover data keeping ${instance(0)}`,
    `resume ${instance(0)}`,
    `remove ${instance(0)}`,
  ]);
  // Removed once; a successful removal is not disposed of again.
  expect(moved.events).not.toContain(`discard ${instance(0)}`);
  expect(moved.events).toContain('preview deployment and web build');
});

it('refuses an environment another run holds while its container runs, and discards one whose run crashed', async () => {
  await runE2E(reuse, fakes().stubs);
  const record = await currentRecord();
  await writeFile(
    join(preparedDirectory(), 'record.json'),
    JSON.stringify({ ...record, state: 'in-use', ownerToken: 'other-run' }),
  );
  const held = fakes({ running: new Set([instance(0)]) });
  const error = await runE2E(reuse, held.stubs).catch(
    (caught: unknown) => caught,
  );
  expect(failureReport(error)).toEqual([
    inUseText,
    'E2E setup failed: prepared-environment (validation)',
  ]);
  expect(held.events).toEqual([]);
  expect(await currentRecord()).toMatchObject({
    state: 'in-use',
    ownerToken: 'other-run',
  });
  expect(lockReleased()).toBe(true);

  const crashed = fakes();
  await runE2E(reuse, crashed.stubs);
  expect(crashed.events.slice(0, 2)).toEqual([
    `recover data keeping ${instance(0)}`,
    `discard ${instance(0)}`,
  ]);
});

it('keeps ownership until its private files are gone, and discards the environment when they cannot be deleted', async () => {
  const order: string[] = [];
  const failing = fakes({
    overrides: {
      removeDirectory: async (path) => {
        if (path.includes(`${parent}/run-`)) {
          order.push('remove private files (fails)');
          throw Object.assign(new Error('busy'), { code: 'EBUSY' });
        }
        if (path === preparedDirectory())
          order.push('remove prepared environment');
        await rm(path, { recursive: true, force: true });
      },
      releaseSlotLock: async () => {
        order.push(
          `release slot lock (record ${existsSync(preparedDirectory()) ? 'present' : 'gone'})`,
        );
      },
    },
  });
  const error = await runE2E(reuse, failing.stubs).catch(
    (caught: unknown) => caught,
  );
  expect(failureReport(error)).toEqual([
    'E2E cleanup failed: temporary-directory (EBUSY)',
  ]);
  // Never published as ready: discarded, container and all, before the lock
  // was released.
  expect(failing.events).toContain(`keep ${instance(0)}`);
  expect(failing.events.at(-1)).toBe(`discard ${instance(0)}`);
  expect(order).toEqual([
    'remove private files (fails)',
    'remove prepared environment',
    'release slot lock (record gone)',
  ]);
});

it('does not keep an environment after an interruption, a moved epoch or a secret in the build', async () => {
  for (const [label, options] of [
    ['moved epoch', { epochAtCleanup: 1 }],
    [
      'secret in the build',
      { overrides: { isWorkspaceFreeOfSecrets: async () => false } },
    ],
  ] as const) {
    const run = fakes(options);
    await runE2E(reuse, run.stubs).catch(() => undefined);
    expect(
      run.events.filter((event) => /^(?:keep|remove) /.test(event)),
      label,
    ).toEqual([expect.stringMatching(/^remove /)]);
    expect(existsSync(preparedDirectory()), label).toBe(false);
  }
  const interrupted = fakes({
    overrides: {
      command: async (stage) => {
        if (stage.endsWith('browser journeys')) process.emit('SIGINT');
        return '';
      },
    },
  });
  await runE2E(reuse, interrupted.stubs).catch(() => undefined);
  expect(
    interrupted.events.filter((event) => /^(?:keep|remove) /.test(event)),
  ).toEqual([expect.stringMatching(/^remove /)]);
  expect(existsSync(preparedDirectory())).toBe(false);
});

it('keeps the environment after a failed journey whose cleanups passed: that is the diagnosis', async () => {
  const failed = fakes({ browsersPass: false });
  const error = await runE2E(reuse, failed.stubs).catch(
    (caught: unknown) => caught,
  );
  expect(failureReport(error)).toEqual([
    'E2E journeys results are incomplete or unsuccessful',
  ]);
  expect(failed.events).toContain(`keep ${instance(0)}`);
  expect((await currentRecord()).state).toBe('ready');
});

it('a run without --reuse discards a kept environment and keeps nothing', async () => {
  await runE2E(reuse, fakes().stubs);
  const plain = fakes();
  expect(await runE2E(journey, plain.stubs)).toBe('qualifying');
  expect(plain.events.slice(0, 2)).toEqual([
    `recover data keeping ${instance(0)}`,
    `discard ${instance(0)}`,
  ]);
  expect(plain.events).toContain(`remove ${instance(1)}`);
  expect(existsSync(preparedDirectory())).toBe(false);
  expect(plain.run()?.preparation).toBe('fresh');
});

it('--discard-prepared removes the kept environment under the slot lock', async () => {
  await runE2E(reuse, fakes().stubs);
  const discard = fakes();
  expect(await runE2E(discardPrepared, discard.stubs)).toBe('qualifying');
  expect(discard.events).toEqual([`discard ${instance(0)}`]);
  expect(existsSync(preparedDirectory())).toBe(false);
  expect(lockReleased()).toBe(true);
  expect(written.join('')).toContain('E2E prepared environment discarded.\n');
});

// #754 review P2: an application edit while the kept backend resumes must
// not let the run test the kept, older build.
it('prepares afresh when the sources change while the kept backend resumes', async () => {
  await runE2E(reuse, fakes().stubs);
  let sources = 'b';
  const edited = fakes({
    overrides: {
      reuseFingerprint: () => fingerprintParts(sources),
    },
  });
  const resume = edited.stubs.startLocalBackend!;
  edited.stubs.startLocalBackend = async (options) => {
    if (options.reuseName) sources = 'e';
    return await resume(options);
  };
  await runE2E(reuse, edited.stubs);
  expect(edited.events.slice(0, 3)).toEqual([
    `recover data keeping ${instance(0)}`,
    `resume ${instance(0)}`,
    `remove ${instance(0)}`,
  ]);
  expect(edited.events).not.toContain(`discard ${instance(0)}`);
  expect(edited.events).toContain('preview deployment and web build');
  expect(written.join('')).toContain(
    'E2E prepared environment: preparing afresh (sources changed).\n',
  );
  expect((await currentRecord()).preparation?.reuseFingerprint).toBe(
    fingerprintParts('e').reuseFingerprint,
  );
});

it('fails the snapshot when the sources change after the reuse was accepted', async () => {
  await runE2E(reuse, fakes().stubs);
  let sources = 'b';
  const edited = fakes({
    overrides: {
      reuseFingerprint: () => fingerprintParts(sources),
      refreshSpecFiles: async () => {
        sources = 'e';
      },
    },
  });
  const error = await runE2E(reuse, edited.stubs).catch(
    (caught: unknown) => caught,
  );
  expect(failureReport(error)).toEqual([
    'E2E source changed while preparing the test workspace',
    'E2E setup failed: source-snapshot (validation)',
  ]);
  expect(edited.events).not.toContain(`keep ${instance(0)}`);
  expect(existsSync(preparedDirectory())).toBe(false);
});

// #754 review S1: verification reads are bounded by the run's clock, and an
// environment whose verification cannot finish in time is not kept.
it('bounds every verification read by the run clock, and discards on a stalled one', async () => {
  await runE2E(reuse, fakes().stubs);
  const bounds: { phase: string; until: number | undefined; run: Run }[] = [];
  const stalled = fakes({
    overrides: {
      readWriteEpoch: async (run, options) => {
        bounds.push({ phase: 'resume', until: options?.until, run });
        // As a bounded read does once its time is up.
        throw new Error('timed out');
      },
    },
  });
  await runE2E(reuse, stalled.stubs).catch(() => undefined);
  expect(stalled.events.slice(0, 3)).toEqual([
    `recover data keeping ${instance(0)}`,
    `resume ${instance(0)}`,
    `remove ${instance(0)}`,
  ]);
  expect(stalled.events).not.toContain(`discard ${instance(0)}`);
  // The fresh preparation's own read stalls too, so nothing is kept.
  expect(stalled.events).not.toContain(`keep ${instance(1)}`);
  expect(existsSync(preparedDirectory())).toBe(false);
  for (const { until, run } of bounds) {
    expect(until).toBeDefined();
    expect(run.browserStopAt).toBeDefined();
    expect(until!).toBeLessThanOrEqual(run.deadline!);
  }

  let isAfterBrowsers = false;
  const cleanupReads: (number | undefined)[] = [];
  const atCleanup = fakes({
    overrides: {
      readWriteEpoch: async (_run, options) => {
        if (!isAfterBrowsers) return 0;
        cleanupReads.push(options?.until);
        throw new Error('timed out');
      },
    },
  });
  const command = atCleanup.stubs.command!;
  atCleanup.stubs.command = async (stage, args, options) => {
    const output = await command(stage, args, options);
    if (stage.endsWith('browser journeys')) isAfterBrowsers = true;
    return output;
  };
  await runE2E(reuse, atCleanup.stubs).catch(() => undefined);
  expect(cleanupReads).toHaveLength(1);
  expect(cleanupReads[0]).toBeDefined();
  expect(atCleanup.events.some((event) => event.startsWith('keep '))).toBe(
    false,
  );
  expect(existsSync(preparedDirectory())).toBe(false);
});

// #774: records written before the data moved beside the checkout.
it('never reuses a schema-1 environment: it discards it with its volume and prepares afresh', async () => {
  await runE2E(reuse, fakes().stubs);
  await writeLegacyRecord();
  const next = fakes();
  expect(await runE2E(reuse, next.stubs)).toBe('qualifying');
  expect(next.events.slice(0, 4)).toEqual([
    `recover data keeping ${instance(0)}`,
    `discard ${instance(0)} with its volume`,
    'copy workspace',
    `create ${instance(1)}`,
  ]);
  expect(written.join('')).toContain(
    'E2E prepared environment: preparing afresh (data placement changed).\n',
  );
  expect(await currentRecord()).toMatchObject({
    schema: 2,
    state: 'ready',
    preparation: { backend: { dataPlacement: 'bind-v1' } },
  });
});

it('--discard-prepared removes a stopped schema-1 environment with its volume', async () => {
  await runE2E(reuse, fakes().stubs);
  await writeLegacyRecord('in-use');
  const discard = fakes();
  expect(await runE2E(discardPrepared, discard.stubs)).toBe('qualifying');
  expect(discard.events).toEqual([`discard ${instance(0)} with its volume`]);
  expect(existsSync(preparedDirectory())).toBe(false);
});

it.each([
  ['a reuse run', reuse],
  ['a plain run', journey],
  ['--discard-prepared', discardPrepared],
] as const)(
  'refuses a schema-1 environment whose container runs through %s, keeping its record',
  async (_case, argv) => {
    await runE2E(reuse, fakes().stubs);
    await writeLegacyRecord();
    const before = await recordText();
    const held = fakes({ running: new Set([instance(0)]) });
    const error = await runE2E([...argv], held.stubs).catch(
      (caught: unknown) => caught,
    );
    expect(failureReport(error)[0]).toBe(inUseText);
    expect(held.events).toEqual([]);
    expect(await recordText()).toBe(before);
    expect(lockReleased()).toBe(true);
  },
);

it('refuses a ready environment whose container runs, instead of reusing it', async () => {
  await runE2E(reuse, fakes().stubs);
  const held = fakes({ running: new Set([instance(0)]) });
  const error = await runE2E(reuse, held.stubs).catch(
    (caught: unknown) => caught,
  );
  expect(failureReport(error)).toEqual([
    inUseText,
    'E2E setup failed: prepared-environment (validation)',
  ]);
  expect(held.events).toEqual([]);
  expect((await currentRecord()).state).toBe('ready');
});

it.each([
  ['a fresh selection', reuse],
  ['--discard-prepared', discardPrepared],
] as const)(
  'keeps the old record when %s cannot dispose of its container or data',
  async (_case, argv) => {
    await runE2E(reuse, fakes().stubs);
    await writeLegacyRecord();
    const before = await recordText();
    const failing = fakes({
      overrides: {
        discardLocalBackend: () =>
          Promise.reject(
            new HarnessFailure({
              kind: 'local-backend',
              reason: 'data-cleanup',
              name: instance(0),
            }),
          ),
      },
    });
    const error = await runE2E([...argv], failing.stubs).catch(
      (caught: unknown) => caught,
    );
    expect(failureReport(error).at(-1)).toMatch(/prepared-environment/);
    expect(failing.events.some((event) => event.startsWith('create '))).toBe(
      false,
    );
    expect(await recordText()).toBe(before);
    expect(lockReleased()).toBe(true);
  },
);

it.each([
  ['a reuse run', reuse],
  ['a plain run', journey],
  ['--discard-prepared', discardPrepared],
] as const)(
  'keeps an unreadable record, and whatever it names, for manual recovery through %s',
  async (_case, argv) => {
    await runE2E(reuse, fakes().stubs);
    await writeFile(join(preparedDirectory(), 'record.json'), '{"schema":2,');
    const damaged = fakes();
    const error = await runE2E([...argv], damaged.stubs).catch(
      (caught: unknown) => caught,
    );
    expect(failureReport(error)[0]).toMatch(
      /^The prepared E2E environment.s record is unreadable/,
    );
    expect(damaged.events).toEqual([]);
    expect(await recordText()).toBe('{"schema":2,');
    expect(lockReleased()).toBe(true);
  },
);

it('stops before any backend starts when a leftover backend of this slot still runs', async () => {
  const blocked = fakes({
    overrides: {
      recoverLocalBackendData: () =>
        Promise.reject(
          new HarnessFailure({
            kind: 'local-backend',
            reason: 'data-cleanup',
            name: instance(9),
          }),
        ),
    },
  });
  const error = await runE2E(journey, blocked.stubs).catch(
    (caught: unknown) => caught,
  );
  expect(failureReport(error).at(-1)).toMatch(
    /^E2E setup failed: prepared-environment /,
  );
  expect(blocked.events.some((event) => event.startsWith('create '))).toBe(
    false,
  );
  expect(lockReleased()).toBe(true);
});

// #774 fix r1: the lifecycle around the data beside the checkout.
const dataCleanupFailure = (name: string) =>
  new HarnessFailure({ kind: 'local-backend', reason: 'data-cleanup', name });
/** Data an instance left beside the checkout, in a private slot root. */
async function leftData(name: string) {
  const path = join(dataRootPath(), name);
  await mkdir(path, { recursive: true, mode: 0o700 });
  await writeFile(join(path, 'db.sqlite3'), 'database');
  return path;
}
const tempDirectoriesLeft = async () =>
  (await readdir(parent)).filter((entry) => entry.startsWith('run-'));
/**
 * Fakes whose backend removal (never a keep) fails as a data cleanup with no
 * helper allowance left does. Any later disposal is the real one, which on
 * the fake daemon would launch another helper.
 */
function failingRemoval(options: Parameters<typeof fakes>[0] = {}) {
  const run = fakes(options);
  const start = run.stubs.startLocalBackend!;
  run.stubs.startLocalBackend = async (startOptions) => {
    const backend = await start(startOptions);
    return {
      ...backend,
      stop: async (stopOptions) => {
        await backend.stop(stopOptions);
        if (!stopOptions?.keep) throw dataCleanupFailure(backend.name);
      },
    };
  };
  run.stubs.discardLocalBackend = async (discardOptions) => {
    run.events.push(`discard ${discardOptions.name}`);
    await discardLocalBackend(discardOptions);
  };
  return run;
}
const secretInBuild = { isWorkspaceFreeOfSecrets: async () => false };

// Spec 2: a removal that used up its cleanup allowance is not retried by a
// later cleanup stage with a new one.
it('keeps the record and data when its backend’s removal fails, and never disposes of it again', async () => {
  const path = await leftData(instance(0));
  const failing = failingRemoval({ overrides: secretInBuild });
  const error = await runE2E(reuse, failing.stubs).catch(
    (caught: unknown) => caught,
  );
  expect(failureReport(error)[0]).toMatch(
    /^E2E cleanup failed: local-backend /,
  );
  expect(failing.events).toContain(`remove ${instance(0)}`);
  expect(failing.events).not.toContain(`discard ${instance(0)}`);
  expect(
    (await docker.readState()).log.map(([command]) => command),
  ).not.toContain('run');
  expect(await readdir(path)).toEqual(['db.sqlite3']);
  expect(await currentRecord()).toMatchObject({
    state: 'in-use',
    instanceName: instance(0),
  });
  // The run's private files and its slot are still released.
  expect(await tempDirectoriesLeft()).toEqual([]);
  expect(lockReleased()).toBe(true);
});

it('keeps the record and data when a rejected resume cannot remove its backend, and prepares nothing over it', async () => {
  await runE2E(reuse, fakes().stubs);
  const path = await leftData(instance(0));
  const moved = failingRemoval({ epoch: 1 });
  const error = await runE2E(reuse, moved.stubs).catch(
    (caught: unknown) => caught,
  );
  expect(failureReport(error).at(-1)).toMatch(
    /^E2E setup failed: prepared-environment /,
  );
  expect(moved.events).toEqual([
    `recover data keeping ${instance(0)}`,
    `resume ${instance(0)}`,
    `remove ${instance(0)}`,
  ]);
  expect(
    (await docker.readState()).log.map(([command]) => command),
  ).not.toContain('run');
  expect(await readdir(path)).toEqual(['db.sqlite3']);
  expect((await currentRecord()).instanceName).toBe(instance(0));
  expect(lockReleased()).toBe(true);
});

it('removes a backend once: after a successful removal the environment is not disposed of again', async () => {
  const run = fakes({ overrides: secretInBuild });
  expect(await runE2E(reuse, run.stubs)).toBe('qualifying');
  expect(run.events).toContain(`remove ${instance(0)}`);
  expect(run.events).not.toContain(`discard ${instance(0)}`);
  expect(existsSync(preparedDirectory())).toBe(false);
});

// Spec 1: a running leftover refuses the run whoever owns it.
const runningForeign = async (name: string) =>
  docker.setState({
    container: {
      name,
      label: 'someone-else',
      hostIp: '127.0.0.1',
      image: localBackendImage,
      port: '43210',
      sitePort: '43211',
      running: true,
      mounts: [
        {
          type: 'bind',
          source: join(dataRootPath(), name),
          destination: '/convex/data',
        },
      ],
    },
  });
async function expectForeignUntouched(path: string) {
  expect((await docker.readState()).container).toMatchObject({
    label: 'someone-else',
    running: true,
  });
  expect(await readdir(path)).toEqual(['db.sqlite3']);
  const commands = await docker.commands();
  for (const command of ['rm', 'stop', 'run'])
    expect(commands).not.toContain(command);
}

it('refuses a plain run while a leftover with another owner’s label runs, and leaves it alone', async () => {
  const path = await leftData(instance(5));
  await runningForeign(instance(5));
  const blocked = fakes({ overrides: { recoverLocalBackendData } });
  const error = await runE2E(journey, blocked.stubs).catch(
    (caught: unknown) => caught,
  );
  expect(failureReport(error).at(-1)).toMatch(
    /^E2E setup failed: prepared-environment /,
  );
  expect(blocked.events.some((event) => event.startsWith('create '))).toBe(
    false,
  );
  await expectForeignUntouched(path);
  expect(lockReleased()).toBe(true);
});

// Standards 2: an unrelated leftover that refuses the run leaves the
// selected reusable environment exactly as it was: not claimed, resumed,
// removed or discarded.
it('keeps a reusable environment untouched when an unrelated leftover refuses a --reuse run', async () => {
  await runE2E(reuse, fakes().stubs);
  const before = await recordText();
  const blocked = fakes({
    overrides: {
      recoverLocalBackendData: () =>
        Promise.reject(dataCleanupFailure(instance(9))),
    },
  });
  const error = await runE2E(reuse, blocked.stubs).catch(
    (caught: unknown) => caught,
  );
  expect(failureReport(error).at(-1)).toMatch(
    /^E2E setup failed: prepared-environment /,
  );
  expect(blocked.events).toEqual([]);
  expect(await recordText()).toBe(before);
  expect(lockReleased()).toBe(true);
});

it('keeps a reusable environment untouched when a running leftover of another owner refuses a --reuse run', async () => {
  await runE2E(reuse, fakes().stubs);
  const before = await recordText();
  const path = await leftData(instance(5));
  await runningForeign(instance(5));
  const blocked = fakes({ overrides: { recoverLocalBackendData } });
  const error = await runE2E(reuse, blocked.stubs).catch(
    (caught: unknown) => caught,
  );
  expect(failureReport(error).at(-1)).toMatch(
    /^E2E setup failed: prepared-environment /,
  );
  expect(blocked.events).toEqual([]);
  expect(await recordText()).toBe(before);
  await expectForeignUntouched(path);
  expect(lockReleased()).toBe(true);
});

it('keeps a reusable environment untouched when a leftover’s helper cannot be verified', async () => {
  await runE2E(reuse, fakes().stubs);
  const before = await recordText();
  const path = join(dataRootPath(), instance(5));
  await mkdir(path, { mode: 0o700 });
  await docker.setState({
    helper: {
      name: `${instance(5)}-data-cleanup`,
      label: 'someone-else',
      image: localBackendImage,
      running: true,
      mounts: [{ type: 'bind', source: path, destination: '/convex/data' }],
    },
  });
  const blocked = fakes({ overrides: { recoverLocalBackendData } });
  const error = await runE2E(reuse, blocked.stubs).catch(
    (caught: unknown) => caught,
  );
  expect(failureReport(error).at(-1)).toMatch(
    /^E2E setup failed: prepared-environment /,
  );
  expect(blocked.events).toEqual([]);
  expect(await recordText()).toBe(before);
  expect((await docker.readState()).helper).not.toBeNull();
  expect(existsSync(path)).toBe(true);
  expect(lockReleased()).toBe(true);
});

// #774 fix r2 (Spec 1 / Standards 1): every route on which a stop can fail
// leaves its record and data for recovery, with no later cleanup stage
// granted a new allowance or helper: a keep-stop, and a resumed startup
// whose own rollback failed before the run had its backend.
const stopFailure = (name: string) =>
  new HarnessFailure({ kind: 'local-backend', reason: 'stop', name });
/** Disposal after this, if any, is the real one, which would launch a helper. */
function withRealDisposal(run: ReturnType<typeof fakes>) {
  run.stubs.discardLocalBackend = async (discardOptions) => {
    run.events.push(`discard ${discardOptions.name}`);
    await discardLocalBackend(discardOptions);
  };
  return run;
}
async function expectRetainedForRecovery(path: string, name: string) {
  expect(
    (await docker.readState()).log.map(([command]) => command),
  ).not.toContain('run');
  expect(await readdir(path)).toEqual(['db.sqlite3']);
  expect((await currentRecord()).instanceName).toBe(name);
  expect(await tempDirectoriesLeft()).toEqual([]);
  expect(lockReleased()).toBe(true);
}

it('keeps the record and data when keeping its backend fails, and never disposes of it with a new allowance', async () => {
  const path = await leftData(instance(0));
  const failing = withRealDisposal(fakes());
  const start = failing.stubs.startLocalBackend!;
  failing.stubs.startLocalBackend = async (startOptions) => {
    const backend = await start(startOptions);
    return {
      ...backend,
      // The daemon stopped it, but the client ran out of its allowance.
      stop: async (stopOptions) => {
        await backend.stop(stopOptions);
        if (stopOptions?.keep) throw stopFailure(backend.name);
      },
    };
  };
  const error = await runE2E(reuse, failing.stubs).catch(
    (caught: unknown) => caught,
  );
  expect(failureReport(error)[0]).toMatch(
    /^E2E cleanup failed: local-backend /,
  );
  expect(failing.events).toContain(`keep ${instance(0)}`);
  expect(failing.events).not.toContain(`discard ${instance(0)}`);
  await expectRetainedForRecovery(path, instance(0));
});

it('keeps the record and data when a resumed startup could not roll back, and prepares nothing over it', async () => {
  await runE2E(reuse, fakes().stubs);
  const path = await leftData(instance(0));
  const failing = withRealDisposal(fakes());
  const start = failing.stubs.startLocalBackend!;
  failing.stubs.startLocalBackend = async (startOptions) => {
    if (!('reuseName' in startOptions) || !startOptions.reuseName)
      return await start(startOptions);
    failing.events.push(`resume ${startOptions.reuseName}`);
    // Startup failed, and so did stopping what it started: no backend is
    // returned, and the original failure names the rollback.
    throw new HarnessFailure(
      { kind: 'local-backend', reason: 'readiness' },
      undefined,
      {
        kind: 'local-backend',
        reason: 'stop-after-failure',
        name: startOptions.reuseName,
      },
    );
  };
  const error = await runE2E(reuse, failing.stubs).catch(
    (caught: unknown) => caught,
  );
  expect(failureReport(error)).toEqual([
    'Local Convex did not become ready',
    'E2E setup failed: prepared-environment (timeout)',
    `The local Convex container could not be stopped or removed after the failure above. Remove it with \`docker rm -f -v ${instance(0)}\`.`,
  ]);
  expect(failing.events).toEqual([
    `recover data keeping ${instance(0)}`,
    `resume ${instance(0)}`,
  ]);
  await expectRetainedForRecovery(path, instance(0));
});

// An ordinary startup failure whose rollback succeeded is not ambiguous: the
// kept environment is discarded once and prepared afresh, as before.
it('still prepares afresh after a resumed startup that failed but rolled back', async () => {
  await runE2E(reuse, fakes().stubs);
  const failing = fakes();
  const start = failing.stubs.startLocalBackend!;
  failing.stubs.startLocalBackend = async (startOptions) => {
    if (!('reuseName' in startOptions) || !startOptions.reuseName)
      return await start(startOptions);
    failing.events.push(`resume ${startOptions.reuseName}`);
    throw new HarnessFailure({ kind: 'local-backend', reason: 'readiness' });
  };
  expect(await runE2E(reuse, failing.stubs)).toBe('qualifying');
  expect(failing.events.slice(0, 4)).toEqual([
    `recover data keeping ${instance(0)}`,
    `resume ${instance(0)}`,
    `discard ${instance(0)}`,
    'copy workspace',
  ]);
  expect(
    failing.events.filter((event) => event === `discard ${instance(0)}`),
  ).toHaveLength(1);
});

it('disposes of an environment at most once when its release cannot discard it', async () => {
  const failing = fakes({
    overrides: {
      removeDirectory: async (path) => {
        if (path.includes(`${parent}/run-`))
          throw Object.assign(new Error('busy'), { code: 'EBUSY' });
        await rm(path, { recursive: true, force: true });
      },
      discardLocalBackend: async ({ name }) => {
        failing.events.push(`discard ${name}`);
        throw dataCleanupFailure(name);
      },
    },
  });
  await runE2E(reuse, failing.stubs).catch(() => undefined);
  expect(failing.events).toContain(`keep ${instance(0)}`);
  expect(
    failing.events.filter((event) => event.startsWith('discard ')),
  ).toEqual([`discard ${instance(0)}`]);
  expect((await currentRecord()).instanceName).toBe(instance(0));
  expect(lockReleased()).toBe(true);
});

// #774 fix r2 (Spec 2): the selected backend's state is checked again after
// the awaited recovery, before anything is claimed or started: one that
// began running meanwhile is refused and left exactly as it was.
it.each<[string, Parameters<typeof fakes>[0]]>([
  ['its write epoch moved', { epoch: 1 }],
  ['it answers on another URL', {}],
])(
  'refuses a selected backend that started running during recovery, even where %s',
  async (scenario, options) => {
    await runE2E(reuse, fakes().stubs);
    const before = await recordText();
    const path = await leftData(instance(0));
    const running = new Set<string>();
    const raced = fakes({
      ...options,
      running,
      overrides: {
        recoverLocalBackendData: async ({ keep }) => {
          raced.events.push(`recover data keeping ${keep}`);
          // Another process starts the selected backend meanwhile.
          running.add(instance(0));
          return { removed: [], kept: [], ignored: 0 };
        },
      },
    });
    if (scenario === 'it answers on another URL') {
      const start = raced.stubs.startLocalBackend!;
      raced.stubs.startLocalBackend = async (startOptions) => ({
        ...(await start(startOptions)),
        url: 'http://127.0.0.1:9999',
      });
    }
    withRealDisposal(raced);
    const error = await runE2E(reuse, raced.stubs).catch(
      (caught: unknown) => caught,
    );
    expect(failureReport(error)).toEqual([
      inUseText,
      'E2E setup failed: prepared-environment (validation)',
    ]);
    expect(raced.events).toEqual([`recover data keeping ${instance(0)}`]);
    expect(await recordText()).toBe(before);
    expect(await readdir(path)).toEqual(['db.sqlite3']);
    expect((await docker.readState()).log).toEqual([]);
    expect(lockReleased()).toBe(true);
  },
);

it.each(['state', 'schema', 'preparation'] as const)(
  'preserves a selected record whose %s changes during recovery',
  async (change) => {
    await runE2E(reuse, fakes().stubs);
    const path = await leftData(instance(0));
    let changedRecord = '';
    const raced = withRealDisposal(
      fakes({
        overrides: {
          recoverLocalBackendData: async ({ keep }) => {
            raced.events.push(`recover data keeping ${keep}`);
            if (change === 'schema') await writeLegacyRecord();
            else {
              const record = await currentRecord();
              if (change === 'state') record.state = 'in-use';
              else record.preparation!.writeEpoch += 1;
              await writeFile(
                join(preparedDirectory(), 'record.json'),
                JSON.stringify(record),
              );
            }
            changedRecord = await recordText();
            return { removed: [], kept: [], ignored: 0 };
          },
        },
      }),
    );
    const error = await runE2E(reuse, raced.stubs).catch(
      (caught: unknown) => caught,
    );
    expect(failureReport(error)).toEqual([
      inUseText,
      'E2E setup failed: prepared-environment (validation)',
    ]);
    expect(raced.events).toEqual([`recover data keeping ${instance(0)}`]);
    expect(await recordText()).toBe(changedRecord);
    expect(await readdir(path)).toEqual(['db.sqlite3']);
    expect((await docker.readState()).log).toEqual([]);
    expect(lockReleased()).toBe(true);
  },
);

// The backend refuses the same race on its own, should the container start
// between that check and its resume.
it('refuses, without discarding it, a selected backend the resume finds running', async () => {
  await runE2E(reuse, fakes().stubs);
  const path = await leftData(instance(0));
  const raced = withRealDisposal(fakes());
  const start = raced.stubs.startLocalBackend!;
  raced.stubs.startLocalBackend = async (startOptions) => {
    if (!('reuseName' in startOptions) || !startOptions.reuseName)
      return await start(startOptions);
    raced.events.push(`resume ${startOptions.reuseName}`);
    throw new HarnessFailure({
      kind: 'local-backend',
      reason: 'running',
      name: startOptions.reuseName,
    });
  };
  const error = await runE2E(reuse, raced.stubs).catch(
    (caught: unknown) => caught,
  );
  expect(failureReport(error)).toEqual([
    inUseText,
    'E2E setup failed: prepared-environment (validation)',
  ]);
  expect(raced.events).toEqual([
    `recover data keeping ${instance(0)}`,
    `resume ${instance(0)}`,
  ]);
  expect((await docker.readState()).log).toEqual([]);
  expect(await readdir(path)).toEqual(['db.sqlite3']);
  expect(lockReleased()).toBe(true);
});
