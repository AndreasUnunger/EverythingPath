// @vitest-environment node
import {
  chmod,
  lstat,
  mkdir,
  readdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { beforeEach, expect, it, vi } from 'vitest';
import {
  describeHarnessFailure,
  HarnessFailure,
} from '../e2e/support/diagnostics';
import { classifyError } from '../e2e/support/setup-failure';
import {
  checkLocalBackendHost,
  discardLocalBackend,
  isLocalBackendRunning,
  localBackendCleanupReserveMs,
  localBackendImage,
  recoverLocalBackendData,
  startLocalBackend,
} from '../scripts/local-convex/backend';
import {
  prepareDataRoot,
  type DataRoot,
} from '../scripts/local-convex/data-directory';
import {
  useFakeDocker,
  type FakeContainer,
  type FakeHelper,
} from './local-convex-fake-docker';

const developmentName = 'ep-dev-0123456789ab';
const docker = useFakeDocker();
const { setState, readState, commands } = docker;
let root: string;
// #774: every E2E backend binds its /convex/data to a private directory in
// this checkout's slot root beside the checkout.
let dataRoot: DataRoot;
beforeEach(async () => {
  root = docker.root;
  await mkdir(join(root, 'repos', 'checkout'), { recursive: true });
  dataRoot = await prepareDataRoot({
    sourceRoot: join(root, 'repos', 'checkout'),
    previewName: 'e2e-local-test-slot-0',
  });
});
const e2e = (directory = join(root, 'private')) => ({ directory, dataRoot });
const instanceDirectories = () => readdir(dataRoot.path);
const exists = (path: string) =>
  lstat(path).then(
    () => true,
    () => false,
  );
const bindOf = (name: string) =>
  `type=bind,source=${join(dataRoot.path, name)},target=/convex/data`;
/** Every helper ran after the container's removal and bound a directory of this slot root. */
async function expectDataRemovedAfterContainer() {
  const { log } = await readState();
  const removal = log.findIndex(([command]) => command === 'rm');
  expect(removal).toBeGreaterThanOrEqual(0);
  log.forEach(([command, ...args], index) => {
    if (command !== 'run') return;
    expect(index).toBeGreaterThan(removal);
    const mount = args[args.indexOf('--mount') + 1] ?? '';
    expect(mount.startsWith(`type=bind,source=${dataRoot.path}/`)).toBe(true);
  });
  expect(await instanceDirectories()).toEqual([]);
}

// The backend answers on its URL with the name it was started with.
function serveBackend({
  ready = true,
  instanceName,
  isInstanceHanging = false,
  instanceStatus = 200,
}: {
  instanceStatus?: number;
  ready?: boolean;
  instanceName?: string;
  isInstanceHanging?: boolean;
} = {}) {
  vi.stubGlobal(
    'fetch',
    async (url: string, init: RequestInit = {}): Promise<Response> => {
      if (url.endsWith('/version')) {
        if (ready) return new Response('ok');
        // An unready backend accepts the connection and never answers.
        return new Promise((_, reject) =>
          init.signal?.addEventListener('abort', () =>
            reject(new Error('aborted')),
          ),
        );
      }
      if (url.endsWith('/instance_name')) {
        // A hanging request rejects with its signal's reason, as fetch does.
        if (isInstanceHanging)
          return new Promise((_, reject) =>
            init.signal?.addEventListener('abort', () => {
              const reason: unknown = init.signal?.reason;
              // AbortSignal.timeout's reason is a TimeoutError DOMException.
              reject(reason instanceof Error ? reason : new Error('aborted'));
            }),
          );
        const { container } = await readState();
        return new Response(instanceName ?? container?.name ?? '', {
          status: instanceStatus,
        });
      }
      throw new Error(`unexpected request ${url}`);
    },
  );
}
const existing = (overrides: Partial<FakeContainer> = {}) =>
  setState({
    container: {
      name: developmentName,
      label: developmentName,
      hostIp: '127.0.0.1',
      image: localBackendImage,
      port: '43210',
      sitePort: '43211',
      running: false,
      ...overrides,
    },
  });
async function failure(promise: Promise<unknown>) {
  const error = await promise.then(
    () => undefined,
    (caught: unknown) => caught,
  );
  if (!(error instanceof HarnessFailure)) throw new Error('expected failure');
  return error;
}

it('removes the daemon-created container, then its data directory, when the create client fails', async () => {
  await setState({ createLosesClient: true });
  const error = await failure(startLocalBackend(e2e()));
  expect(error.diagnostic).toMatchObject({ reason: 'docker' });
  const state = await readState();
  expect(state.container).toBeNull();
  expect(state.log).toContainEqual([
    'rm',
    '--force',
    '--volumes',
    'container-id',
  ]);
  await expectDataRemovedAfterContainer();
  await expect(
    readFile(join(root, 'private', 'backend.env')),
  ).rejects.toMatchObject({ code: 'ENOENT' });
});

it('starts a new E2E container on loopback with its data beside the checkout, and writes private credentials', async () => {
  serveBackend();
  const backend = await startLocalBackend(e2e());
  expect(backend.url).toMatch(/^http:\/\/127\.0\.0\.1:[0-9]+$/);
  expect(await commands()).toEqual([
    'version',
    'image inspect',
    'ps',
    'create',
    'start',
    'exec',
  ]);
  const create = (await readState()).log.find(
    ([command]) => command === 'create',
  );
  expect(create).toContain(bindOf(backend.name));
  expect(create).not.toContain('type=volume,target=/convex/data');
  // The daemon wrote the database into the host directory.
  expect(await exists(join(dataRoot.path, backend.name, 'db.sqlite3'))).toBe(
    true,
  );
  expect(await readFile(backend.adminKeyFile, 'utf8')).toBe(
    'ep-instance|0123abcd',
  );
  expect(backend.adminKeyFile.startsWith(join(root, 'private'))).toBe(true);
  await backend.stop();
  expect((await readState()).container).toBeNull();
  await expectDataRemovedAfterContainer();
  // The slot root stays for the next run.
  expect(await exists(dataRoot.path)).toBe(true);
});

it('keeps code generation’s anonymous volume when it asks for no data root', async () => {
  serveBackend();
  const backend = await startLocalBackend({
    directory: join(root, 'private'),
    dataRoot: null,
  });
  const create = (await readState()).log.find(
    ([command]) => command === 'create',
  );
  expect(create).toContain('type=volume,target=/convex/data');
  await backend.stop();
  expect((await readState()).log.at(-1)).toEqual([
    'rm',
    '--force',
    '--volumes',
    'container-id',
  ]);
  expect(await commands()).not.toContain('run');
  expect(await instanceDirectories()).toEqual([]);
});

it('fails closed, and rolls back, when the daemon does not write into the host directory', async () => {
  // A remote daemon, or Desktop file sharing that does not cover the path.
  await setState({ remoteDaemon: true });
  serveBackend();
  const error = await failure(startLocalBackend(e2e()));
  expect(error.diagnostic).toMatchObject({ reason: 'data-not-on-host' });
  expect((await readState()).container).toBeNull();
  await expectDataRemovedAfterContainer();
  await expect(
    readFile(join(root, 'private', 'local-admin.key')),
  ).rejects.toMatchObject({ code: 'ENOENT' });
});

it.each<
  [string, Parameters<typeof setState>[0], Parameters<typeof serveBackend>[0]]
>([
  ['a start failure', { failing: ['start'] }, {}],
  [
    'an instance mismatch',
    {},
    { instanceName: 'ep-e2e-ffffffff-ffff-ffff-ffff-ffffffffffff' },
  ],
  ['an invalid admin key', { adminKey: 'not a key' }, {}],
])(
  'removes the container before its data after %s',
  async (_case, state, backend) => {
    await setState(state);
    serveBackend(backend);
    await failure(startLocalBackend(e2e()));
    expect((await readState()).container).toBeNull();
    await expectDataRemovedAfterContainer();
  },
);

it('removes a new E2E container whose start fails', async () => {
  await setState({ failing: ['start'] });
  const error = await failure(startLocalBackend(e2e()));
  expect(error.diagnostic).toMatchObject({ reason: 'start' });
  const state = await readState();
  expect(state.container).toBeNull();
  expect(state.log).toContainEqual([
    'rm',
    '--force',
    '--volumes',
    'container-id',
  ]);
});

it('removes a new development container whose start fails but never its data volume', async () => {
  await setState({ failing: ['start'] });
  const error = await failure(
    startLocalBackend({ directory: root, developmentName }),
  );
  expect(error.message).toContain('a retry picks new ports');
  const state = await readState();
  expect(state.container).toBeNull();
  expect(state.log.at(-1)).toEqual(['rm', '--force', 'container-id']);
  const create = state.log.find((args) => args[0] === 'create') ?? [];
  expect(create).toContain(
    `type=volume,source=${developmentName}-data,target=/convex/data`,
  );
});

it.each([
  [
    'a failed instance check',
    { instanceName: 'ep-dev-ffffffffffff' },
    'instance',
  ],
  ['an invalid admin key', {}, 'admin-key'],
] as const)(
  'stops an existing development container it started after %s',
  async (_case, backend, reason) => {
    await existing();
    if (reason === 'admin-key')
      await setState({
        ...(await readState()),
        adminKey: 'not a key',
      });
    serveBackend(backend);
    const error = await failure(
      startLocalBackend({ directory: root, developmentName }),
    );
    expect(error.diagnostic).toMatchObject({ reason });
    const state = await readState();
    expect(state.container).toMatchObject({ running: false });
    expect(state.log.at(-1)?.slice(0, 1)).toEqual(['stop']);
    await expect(readFile(join(root, 'local-admin.key'))).rejects.toMatchObject(
      { code: 'ENOENT' },
    );
  },
);

it('leaves an already running development container running when its check fails', async () => {
  await existing({ running: true });
  serveBackend({ instanceName: 'ep-dev-ffffffffffff' });
  await failure(startLocalBackend({ directory: root, developmentName }));
  expect(await commands()).not.toContain('stop');
  expect((await readState()).container).toMatchObject({ running: true });
});

it.each([
  [
    'another owner',
    { label: 'someone-else' },
    'ownership',
    `docker rm ${developmentName}`,
  ],
  [
    'non-loopback ports',
    { hostIp: '0.0.0.0' },
    'ports',
    `docker rm ${developmentName}\` (its data volume ${developmentName}-data is kept)`,
  ],
  [
    'another image',
    { image: 'convex-backend:other' },
    'image-changed',
    `docker rm ${developmentName}\` (its data volume ${developmentName}-data is kept)`,
  ],
] as const)(
  'refuses an existing development container with %s and names the recovery',
  async (_case, container, reason, recovery) => {
    await existing(container);
    const error = await failure(
      startLocalBackend({ directory: root, developmentName }),
    );
    expect(error.diagnostic).toMatchObject({ reason });
    expect(error.message).toContain(recovery);
    expect(await commands()).not.toContain('start');
    expect(await commands()).not.toContain('rm');
  },
);

it('names the recovery when an existing development container cannot start', async () => {
  await existing();
  await setState({ ...(await readState()), failing: ['start'] });
  const error = await failure(
    startLocalBackend({ directory: root, developmentName }),
  );
  expect(error.diagnostic).toMatchObject({ reason: 'start-existing' });
  expect(error.message).toContain(`docker rm ${developmentName}`);
  expect((await readState()).container).not.toBeNull();
});

it('caps a slow Docker call at the run deadline less the cleanup reserve', async () => {
  await setState({ slow: { ps: 20_000 } });
  const started = Date.now();
  const error = await failure(
    startLocalBackend({
      ...e2e(),
      deadline: started + localBackendCleanupReserveMs + 1_500,
    }),
  );
  expect(error.diagnostic).toMatchObject({ reason: 'timeout' });
  expect(classifyError(error)).toBe('timeout');
  expect(Date.now() - started).toBeLessThan(5_000);
  expect(await commands()).not.toContain('create');
}, 15_000);

it('ends readiness at the run deadline and removes the container', async () => {
  serveBackend({ ready: false });
  const started = Date.now();
  const error = await failure(
    startLocalBackend({
      ...e2e(),
      deadline: started + localBackendCleanupReserveMs + 2_000,
    }),
  );
  expect(error.diagnostic).toMatchObject({ reason: 'timeout' });
  expect(Date.now() - started).toBeLessThan(6_000);
  expect((await readState()).container).toBeNull();
  await expectDataRemovedAfterContainer();
}, 15_000);

it('refuses to start without the cleanup reserve', async () => {
  const error = await failure(
    startLocalBackend({
      ...e2e(),
      deadline: Date.now() + localBackendCleanupReserveMs - 1,
    }),
  );
  expect(error.diagnostic).toMatchObject({ reason: 'timeout' });
  expect(await commands()).toEqual([]);
  expect(await instanceDirectories()).toEqual([]);
});

it.each(['docker call', 'readiness'] as const)(
  'aborts promptly when interrupted during its %s and removes what it created',
  async (phase) => {
    if (phase === 'docker call') await setState({ slow: { start: 20_000 } });
    serveBackend({ ready: false });
    const controller = new AbortController();
    const started = Date.now();
    const pending = failure(
      startLocalBackend({
        ...e2e(),
        signal: controller.signal,
      }),
    );
    await expect.poll(commands).toContain('start');
    setTimeout(() => controller.abort(), 200);
    const error = await pending;
    expect(error.diagnostic).toMatchObject({ reason: 'interrupted' });
    expect(classifyError(error)).toBe('terminated');
    expect(Date.now() - started).toBeLessThan(5_000);
    expect((await readState()).container).toBeNull();
    await expectDataRemovedAfterContainer();
  },
  15_000,
);

it('reports a failed stop as its own failure', async () => {
  serveBackend();
  const backend = await startLocalBackend(e2e());
  await setState({ ...(await readState()), failing: ['rm'] });
  const error = await failure(backend.stop());
  expect(error.diagnostic).toMatchObject({ reason: 'stop' });
  expect(error.message).toContain(`docker rm -f -v ${backend.name}`);
  // Never deleted under a container that may still use it.
  expect(await instanceDirectories()).toEqual([backend.name]);
  expect(await commands()).not.toContain('run');
});

it('stops an existing container whose start the daemon completed although its client failed', async () => {
  await existing();
  await setState({ ...(await readState()), startLosesClient: true });
  const error = await failure(
    startLocalBackend({ directory: root, developmentName }),
  );
  expect(error.diagnostic).toMatchObject({ reason: 'start-existing' });
  const state = await readState();
  expect(state.container).toMatchObject({ running: false });
  expect(state.log.at(-1)?.slice(0, 1)).toEqual(['stop']);
});

it('stops a container whose start was interrupted after the daemon may have started it', async () => {
  await existing();
  await setState({ ...(await readState()), slow: { start: 20_000 } });
  const controller = new AbortController();
  const pending = failure(
    startLocalBackend({
      directory: root,
      developmentName,
      signal: controller.signal,
    }),
  );
  await expect.poll(commands).toContain('start');
  controller.abort();
  const error = await pending;
  expect(error.diagnostic).toMatchObject({ reason: 'interrupted' });
  expect(await commands()).toContain('stop');
}, 15_000);

it('reports an instance check that reaches the deadline as a timeout, not a mismatch', async () => {
  serveBackend({ isInstanceHanging: true });
  const started = Date.now();
  const error = await failure(
    startLocalBackend({
      ...e2e(),
      deadline: started + localBackendCleanupReserveMs + 1_500,
    }),
  );
  expect(error.diagnostic).toMatchObject({ reason: 'timeout' });
  expect(classifyError(error)).toBe('timeout');
  expect((await readState()).container).toBeNull();
}, 15_000);

it('reports an instance check interrupted by Ctrl+C as terminated', async () => {
  serveBackend({ isInstanceHanging: true });
  const controller = new AbortController();
  const pending = failure(
    startLocalBackend({
      ...e2e(),
      signal: controller.signal,
    }),
  );
  await expect.poll(commands).toContain('start');
  setTimeout(() => controller.abort(), 200);
  const error = await pending;
  expect(error.diagnostic).toMatchObject({ reason: 'interrupted' });
  expect(classifyError(error)).toBe('terminated');
}, 15_000);

it('reports only a real name mismatch as a validation failure', async () => {
  serveBackend({ instanceName: 'ep-e2e-ffffffff-ffff-ffff-ffff-ffffffffffff' });
  const error = await failure(startLocalBackend(e2e()));
  expect(error.diagnostic).toMatchObject({ reason: 'instance' });
  expect(classifyError(error)).toBe('validation');
});

it('shares one cleanup deadline across the rollback’s ps, inspect and removal', async () => {
  // Each recovery call is slow; together they exceed the reserve.
  await setState({
    createLosesClient: true,
    slow: { ps: 900, inspect: 900, rm: 900 },
  });
  const error = await failure(
    startLocalBackend({
      ...e2e(),
      cleanupReserveMs: 2_000,
    }),
  );
  const state = await readState();
  expect(state.log.map((args) => args[0])).toEqual([
    'version',
    'image',
    'ps',
    'create',
    'ps',
    'inspect',
    'rm',
  ]);
  // The removal got only what was left of the reserve and was killed; the
  // data directory stays with the container that may still use it.
  expect(state.container).not.toBeNull();
  expect(await instanceDirectories()).toHaveLength(1);
  expect(error.also).toMatchObject({ reason: 'stop-after-failure' });
  expect(error.message).toBe('A Docker command for local Convex failed');
  expect(describeHarnessFailure(error).join('\n')).toMatch(
    /docker rm -f -v ep-e2e-/,
  );
}, 15_000);

it('checks the Docker daemon and pulls a missing pinned image without starting a container', async () => {
  await setState({ imagePresent: false });
  await checkLocalBackendHost({ deadline: Date.now() + 60_000 });
  expect(await readState()).toMatchObject({
    imagePresent: true,
    container: null,
  });
  expect((await readState()).log).toEqual([
    ['version', '--format', '{{.Server.Version}}'],
    ['image', 'inspect', '--format', '{{.Id}}', localBackendImage],
    ['pull', '--quiet', localBackendImage],
  ]);
});

it.each([
  ['an unreachable daemon', { daemon: false }, 'docker-unavailable'],
  [
    'an image that cannot be pulled',
    { imagePresent: false, pullSucceeds: false },
    'image',
  ],
] as const)(
  'fails the host check clearly for %s',
  async (_case, state, reason) => {
    await setState(state);
    const error = await failure(checkLocalBackendHost());
    expect(error.diagnostic).toMatchObject({ reason });
    expect(await commands()).not.toContain('create');
  },
);

it('reports an unsuccessful instance response as unreachable, not as a mismatch', async () => {
  // A 503 carries the right name in its body, yet says nothing about identity.
  serveBackend({ instanceStatus: 503 });
  const error = await failure(startLocalBackend(e2e()));
  expect(error.diagnostic).toMatchObject({ reason: 'instance-unreachable' });
  expect(classifyError(error)).not.toBe('validation');
  expect((await readState()).container).toBeNull();
});

// #754: a prepared E2E environment's container is stopped, not removed, and
// a later `--reuse` run resumes it with a fresh admin-key file.
const preparedName = 'ep-e2e-11111111-1111-1111-1111-111111111111';
const preparedPath = () => join(dataRoot.path, preparedName);
it('keeps a prepared E2E container stopped with its data and resumes it later', async () => {
  serveBackend();
  const first = await startLocalBackend(e2e(join(root, 'first')));
  await first.stop({ keep: true });
  let state = await readState();
  expect(state.log.at(-1)).toEqual(['stop', '--time', '10', 'container-id']);
  expect(state.container).toMatchObject({ running: false });
  expect(await instanceDirectories()).toEqual([first.name]);
  await setState({ ...state, log: [] });
  const resumed = await startLocalBackend({
    ...e2e(join(root, 'second')),
    reuseName: first.name,
  });
  expect(resumed.name).toBe(first.name);
  expect(resumed.url).toBe(first.url);
  expect(await commands()).not.toContain('create');
  expect(await commands()).toContain('start');
  expect(await readFile(resumed.adminKeyFile, 'utf8')).toBe(
    'ep-instance|0123abcd',
  );
  expect(resumed.adminKeyFile.startsWith(join(root, 'second'))).toBe(true);
  await resumed.stop({ keep: true });
  // Discarding it later removes the container, then its data.
  await discardLocalBackend({
    name: first.name,
    placement: 'bind-v1',
    dataRoot,
  });
  state = await readState();
  expect(state.container).toBeNull();
  await expectDataRemovedAfterContainer();
});

it('refuses to resume a prepared container that is gone or not ours, and creates none', async () => {
  serveBackend();
  const missing = await failure(
    startLocalBackend({ ...e2e(root), reuseName: preparedName }),
  );
  expect(missing.diagnostic).toMatchObject({ reason: 'missing' });
  await existing({ name: preparedName, label: 'someone-else' });
  const foreign = await failure(
    startLocalBackend({ ...e2e(root), reuseName: preparedName }),
  );
  expect(foreign.diagnostic).toMatchObject({ reason: 'ownership' });
  expect(await commands()).not.toContain('create');
  expect(await commands()).not.toContain('rm');
});

/** Our stopped prepared container, bound as given. */
const kept = (
  mounts: FakeContainer['mounts'] = [
    { type: 'bind', source: preparedPath(), destination: '/convex/data' },
  ],
) => existing({ name: preparedName, label: preparedName, mounts });

it.each([
  ['its data directory is missing', 'data-root', async () => kept()],
  [
    'it is bound to another directory',
    'ownership',
    async () => {
      await keptData();
      await kept([
        { type: 'bind', source: '/elsewhere', destination: '/convex/data' },
      ]);
    },
  ],
  [
    'it still uses an anonymous volume',
    'ownership',
    async () => {
      await keptData();
      await kept([
        { type: 'volume', source: 'anonymous', destination: '/convex/data' },
      ]);
    },
  ],
] as const)(
  'refuses to resume a prepared container when %s, and starts or creates nothing',
  async (_case, reason, arrange) => {
    serveBackend();
    await arrange();
    const error = await failure(
      startLocalBackend({ ...e2e(root), reuseName: preparedName }),
    );
    expect(error.diagnostic).toMatchObject({ reason, name: preparedName });
    expect(await commands()).not.toContain('start');
    expect(await commands()).not.toContain('create');
    expect(await commands()).not.toContain('rm');
  },
);

// #774 fix r2 (Spec 2): a prepared E2E container that is already running may
// be another run's, so resuming it is refused and it is left exactly as it
// is. A development container is resumed running, as before.
it('refuses to resume a prepared container that is already running, and stops or removes nothing', async () => {
  serveBackend();
  await keptData();
  await kept();
  await docker.updateState({
    container: { ...(await readState()).container!, running: true },
  });
  const error = await failure(
    startLocalBackend({ ...e2e(root), reuseName: preparedName }),
  );
  expect(error.diagnostic).toMatchObject({
    reason: 'running',
    name: preparedName,
  });
  expect(error.also).toBeUndefined();
  expect((await readState()).container).toMatchObject({ running: true });
  for (const command of ['start', 'stop', 'rm', 'run', 'exec'])
    expect(await commands()).not.toContain(command);
  expect(await readdir(preparedPath())).toEqual(['db.sqlite3', 'storage']);
});

it('reports whether a prepared container is running, only for our own label', async () => {
  expect(await isLocalBackendRunning(preparedName)).toBe(false);
  await existing({ name: preparedName, label: preparedName, running: true });
  expect(await isLocalBackendRunning(preparedName)).toBe(true);
  await existing({ name: preparedName, label: preparedName, running: false });
  expect(await isLocalBackendRunning(preparedName)).toBe(false);
  // Another owner's container is not ours to judge, so it counts as running.
  await existing({ name: preparedName, label: 'someone-else', running: false });
  expect(await isLocalBackendRunning(preparedName)).toBe(true);
});

const discard = (
  placement: 'bind-v1' | 'volume' = 'bind-v1',
  cleanupReserveMs?: number,
) =>
  discardLocalBackend({
    name: preparedName,
    placement,
    dataRoot,
    ...(cleanupReserveMs ? { cleanupReserveMs } : {}),
  });
/** What the backend leaves in its data directory: a database and root-owned storage. */
async function keptData() {
  await mkdir(preparedPath(), { mode: 0o700 });
  await writeFile(join(preparedPath(), 'db.sqlite3'), 'database');
  await mkdir(join(preparedPath(), 'storage'));
  await chmod(join(preparedPath(), 'storage'), 0o500);
}

it.each<[string, Partial<FakeContainer>]>([
  ['running', { running: true }],
  ['another owner’s', { label: 'someone-else' }],
  [
    'bound to another directory',
    {
      mounts: [
        { type: 'bind', source: '/elsewhere', destination: '/convex/data' },
      ],
    },
  ],
])(
  'refuses to discard a %s prepared container, and keeps its data',
  async (_case, container) => {
    await keptData();
    await kept();
    await existing({
      ...(await readState()).container!,
      ...container,
    });
    const error = await failure(discard());
    expect(error.diagnostic).toMatchObject({ kind: 'local-backend' });
    expect((await readState()).container).not.toBeNull();
    expect(await commands()).not.toContain('rm');
    expect(await commands()).not.toContain('run');
    expect(await readdir(preparedPath())).toEqual(['db.sqlite3', 'storage']);
  },
);

it('discards a legacy prepared container with its anonymous volume and invents no data path', async () => {
  await kept([
    { type: 'volume', source: 'anonymous', destination: '/convex/data' },
  ]);
  await discard('volume');
  const { log, container } = await readState();
  expect(container).toBeNull();
  expect(log.at(-1)).toEqual(['rm', '--force', '--volumes', 'container-id']);
  expect(await commands()).not.toContain('run');
  expect(await instanceDirectories()).toEqual([]);
});

const helperName = `${preparedName}-data-cleanup`;
const survivingHelper = (overrides: Partial<FakeHelper> = {}) =>
  docker.updateState({
    helper: {
      name: helperName,
      label: helperName,
      image: localBackendImage,
      running: true,
      mounts: [
        { type: 'bind', source: preparedPath(), destination: '/convex/data' },
      ],
      ...overrides,
    },
  });

// Design r3: a helper that emptied its bind before the run crashed is found
// before the empty directory is removed, by every route that removes data:
// a direct discard and the next run's recovery.
const routes = [
  ['a direct discard', (reserve?: number) => discard('bind-v1', reserve)],
  [
    'the next run’s recovery',
    (reserve?: number) =>
      recoverLocalBackendData({
        dataRoot,
        keep: null,
        ...(reserve ? { cleanupReserveMs: reserve } : {}),
      }),
  ],
] as const;

it.each(routes)(
  'removes an exact surviving helper, then the empty directory, through %s',
  async (_route, removeThrough) => {
    await mkdir(preparedPath(), { mode: 0o700 });
    await survivingHelper();
    await removeThrough();
    const { log, helper } = await readState();
    expect(log).toContainEqual(['rm', '--force', 'helper-id']);
    expect(helper).toBeNull();
    expect(await instanceDirectories()).toEqual([]);
    expect(await commands()).not.toContain('run');
  },
);

it.each(
  routes.flatMap(([route, removeThrough]) =>
    (
      [
        ['another owner’s helper', { label: 'someone-else' }],
        [
          'a helper bound to another directory',
          {
            mounts: [
              {
                type: 'bind',
                source: '/elsewhere',
                destination: '/convex/data',
              },
            ],
          },
        ],
      ] satisfies [string, Partial<FakeHelper>][]
    ).map(
      ([helper, overrides]) =>
        [helper, route, { removeThrough, overrides }] as const,
    ),
  ),
)(
  'keeps %s and its empty directory through %s, and fails',
  async (_helper, _route, { removeThrough, overrides }) => {
    await mkdir(preparedPath(), { mode: 0o700 });
    await survivingHelper(overrides);
    const error = await failure(removeThrough());
    expect(error.diagnostic).toMatchObject({
      reason: 'data-cleanup',
      name: preparedName,
    });
    expect((await readState()).helper).not.toBeNull();
    expect(await commands()).not.toContain('rm');
    expect(await instanceDirectories()).toEqual([preparedName]);
  },
);

it.each(routes)(
  'keeps an empty directory whose helper cannot be verified in the time left, through %s',
  async (_route, removeThrough) => {
    await mkdir(preparedPath(), { mode: 0o700 });
    await survivingHelper();
    await docker.updateState({ slow: { inspect: 1_500 } });
    const error = await failure(removeThrough(1_000));
    expect(error.diagnostic).toMatchObject({
      reason: 'data-cleanup',
      name: preparedName,
    });
    expect((await readState()).helper).not.toBeNull();
    expect(await instanceDirectories()).toEqual([preparedName]);
  },
  10_000,
);

it.each<[string, Partial<FakeHelper>, boolean]>([
  ['an exact surviving helper', {}, true],
  ['another owner’s helper', { label: 'someone-else' }, false],
])(
  'resolves %s before a direct discard treats the absent directory as done',
  async (_case, overrides, isRemoved) => {
    await survivingHelper(overrides);
    const outcome = await discard().then(
      () => 'done',
      (error: unknown) => error,
    );
    if (isRemoved) {
      expect(outcome).toBe('done');
      expect((await readState()).log).toContainEqual([
        'rm',
        '--force',
        'helper-id',
      ]);
      expect((await readState()).helper).toBeNull();
    } else {
      expect(outcome).toBeInstanceOf(HarnessFailure);
      expect((await readState()).helper).not.toBeNull();
      expect(await commands()).not.toContain('rm');
    }
  },
);

// After a crash, once the slot lock is safely held again: leftover instance
// directories of this slot root are recovered only when nothing else may
// still use them.
const leftover = 'ep-e2e-22222222-2222-2222-2222-222222222222';
it('removes a leftover directory without a container, and one whose owned stopped container is bound to it', async () => {
  await mkdir(join(dataRoot.path, leftover), { mode: 0o700 });
  await keptData();
  await kept();
  expect(await recoverLocalBackendData({ dataRoot, keep: null })).toEqual({
    removed: [preparedName, leftover],
    kept: [],
    ignored: 0,
  });
  expect((await readState()).container).toBeNull();
  await expectDataRemovedAfterContainer();
});

it('keeps the instance selected for reuse', async () => {
  await keptData();
  await kept();
  expect(
    await recoverLocalBackendData({ dataRoot, keep: preparedName }),
  ).toEqual({ removed: [], kept: [], ignored: 0 });
  expect((await readState()).container).not.toBeNull();
  expect(await readdir(preparedPath())).toEqual(['db.sqlite3', 'storage']);
  expect(await commands()).not.toContain('rm');
});

it('refuses while any leftover backend is running, and keeps it', async () => {
  await keptData();
  await kept();
  await docker.updateState({
    container: { ...(await readState()).container!, running: true },
  });
  const error = await failure(
    recoverLocalBackendData({ dataRoot, keep: null }),
  );
  expect(error.diagnostic).toMatchObject({
    reason: 'data-cleanup',
    name: preparedName,
  });
  expect((await readState()).container).toMatchObject({ running: true });
  expect(await readdir(preparedPath())).toEqual(['db.sqlite3', 'storage']);
  expect(await commands()).not.toContain('rm');
});

// #774 fix r1 (Spec 1): whether a leftover runs is checked whoever owns
// it; a running one refuses the run and is never stopped or removed.
it('refuses while a leftover with another owner’s label is running, and touches neither it nor its data', async () => {
  await keptData();
  await kept();
  await existing({
    ...(await readState()).container!,
    label: 'someone-else',
    running: true,
  });
  const error = await failure(
    recoverLocalBackendData({ dataRoot, keep: null }),
  );
  expect(error.diagnostic).toMatchObject({
    reason: 'data-cleanup',
    name: preparedName,
  });
  expect((await readState()).container).toMatchObject({
    label: 'someone-else',
    running: true,
  });
  expect(await readdir(preparedPath())).toEqual(['db.sqlite3', 'storage']);
  expect(await commands()).not.toContain('rm');
  expect(await commands()).not.toContain('stop');
  expect(await commands()).not.toContain('run');
});

it.each<[string, Partial<FakeContainer>]>([
  ['another owner’s container', { label: 'someone-else' }],
  [
    'our container bound elsewhere',
    {
      mounts: [
        { type: 'bind', source: '/elsewhere', destination: '/convex/data' },
      ],
    },
  ],
])('keeps and reports a leftover with %s', async (_case, container) => {
  await keptData();
  await kept();
  await existing({ ...(await readState()).container!, ...container });
  expect(await recoverLocalBackendData({ dataRoot, keep: null })).toEqual({
    removed: [],
    kept: [preparedName],
    ignored: 0,
  });
  expect((await readState()).container).not.toBeNull();
  expect(await readdir(preparedPath())).toEqual(['db.sqlite3', 'storage']);
  expect(await commands()).not.toContain('rm');
});

it('ignores and counts entries that are not instance directories', async () => {
  await mkdir(join(dataRoot.path, 'notes'), { mode: 0o700 });
  await writeFile(join(dataRoot.path, preparedName), 'a file, not a directory');
  expect(await recoverLocalBackendData({ dataRoot, keep: null })).toEqual({
    removed: [],
    kept: [],
    ignored: 2,
  });
  expect((await instanceDirectories()).sort()).toEqual(
    ['notes', preparedName].sort(),
  );
  expect(await commands()).toEqual([]);
});
