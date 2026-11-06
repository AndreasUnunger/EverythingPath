// @vitest-environment node
import {
  chmod,
  lstat,
  mkdir,
  readdir,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { expect, it } from 'vitest';
import {
  describeHarnessFailure,
  HarnessFailure,
} from '../e2e/support/diagnostics';
import { preparedEnvironmentDirectory } from '../e2e/support/prepared-environment';
import { localBackendImage } from '../scripts/local-convex/backend';
import {
  claimNewDataDirectory,
  prepareDataRoot,
  removeData,
  verifyKeptDataDirectory,
} from '../scripts/local-convex/data-directory';
import { useFakeDocker, type FakeHelper } from './local-convex-fake-docker';

// #774: an E2E backend's /convex/data is a bind of a private directory
// beside the checkout, so its database writes land on the repository's
// filesystem. Docker is the fake daemon; the directories are real.

const docker = useFakeDocker();
const previewName = 'e2e-local-test-slot-0';
const name = 'ep-e2e-11111111-1111-1111-1111-111111111111';
const parent = () => join(docker.root, 'repos');
const sourceRoot = () => join(parent(), 'checkout');
const prepare = async (options: { uid?: number } = {}) => {
  await mkdir(parent(), { recursive: true });
  return await prepareDataRoot({
    sourceRoot: sourceRoot(),
    previewName,
    ...options,
  });
};
const mode = async (path: string) => (await stat(path)).mode & 0o777;
const exists = (path: string) =>
  lstat(path).then(
    () => true,
    () => false,
  );

async function failure(promise: Promise<unknown>) {
  const error = await promise.then(
    () => undefined,
    (caught: unknown) => caught,
  );
  if (!(error instanceof HarnessFailure)) throw new Error('expected failure');
  return error;
}

/** What the pinned backend leaves: a database and storage the host user cannot delete. */
async function writeBackendData(path: string) {
  await writeFile(join(path, 'db.sqlite3'), 'database');
  await mkdir(join(path, 'storage'));
  await writeFile(join(path, 'storage', 'blob'), 'blob');
  await chmod(join(path, 'storage'), 0o500);
}

const helperName = `${name}-data-cleanup`;
const helper = (path: string, overrides: Partial<FakeHelper> = {}) =>
  docker.updateState({
    helper: {
      name: helperName,
      label: helperName,
      image: localBackendImage,
      running: true,
      mounts: [{ type: 'bind', source: path, destination: '/convex/data' }],
      ...overrides,
    },
  });

it('prepares a private data root beside the checkout, keyed like its prepared environment', async () => {
  const root = await prepare();
  expect(root.path).toBe(
    join(
      parent(),
      '.ep-tmp',
      'e2e-data',
      basename(
        preparedEnvironmentDirectory({ sourceRoot: sourceRoot(), previewName }),
      ),
    ),
  );
  for (const created of [
    join(parent(), '.ep-tmp'),
    join(parent(), '.ep-tmp', 'e2e-data'),
    root.path,
  ])
    expect(await mode(created)).toBe(0o700);
  // A later run prepares and verifies the same root again.
  expect((await prepare()).path).toBe(root.path);
  expect(await docker.commands()).toEqual([]);
});

it('accepts the shared .ep-tmp that other tools create readable', async () => {
  await mkdir(join(parent(), '.ep-tmp'), { recursive: true, mode: 0o755 });
  await chmod(join(parent(), '.ep-tmp'), 0o755);
  const root = await prepare();
  expect(await mode(root.path)).toBe(0o700);
});

it.each([
  [
    'a symlinked .ep-tmp',
    async () => {
      await mkdir(join(docker.root, 'elsewhere'));
      await symlink(join(docker.root, 'elsewhere'), join(parent(), '.ep-tmp'));
    },
  ],
  [
    'a symlinked e2e-data',
    async () => {
      await mkdir(join(parent(), '.ep-tmp'), { mode: 0o700 });
      await mkdir(join(docker.root, 'elsewhere'));
      await symlink(
        join(docker.root, 'elsewhere'),
        join(parent(), '.ep-tmp', 'e2e-data'),
      );
    },
  ],
  [
    'a symlinked slot root',
    async () => {
      const slot = basename(
        preparedEnvironmentDirectory({ sourceRoot: sourceRoot(), previewName }),
      );
      await mkdir(join(parent(), '.ep-tmp', 'e2e-data'), {
        recursive: true,
        mode: 0o700,
      });
      await mkdir(join(docker.root, 'elsewhere'));
      await symlink(
        join(docker.root, 'elsewhere'),
        join(parent(), '.ep-tmp', 'e2e-data', slot),
      );
    },
  ],
  [
    'a slot root others can read',
    async () => {
      const slot = basename(
        preparedEnvironmentDirectory({ sourceRoot: sourceRoot(), previewName }),
      );
      const path = join(parent(), '.ep-tmp', 'e2e-data', slot);
      await mkdir(path, { recursive: true, mode: 0o700 });
      await chmod(path, 0o750);
    },
  ],
  [
    'a file in place of a directory',
    async () => {
      await writeFile(join(parent(), '.ep-tmp'), '');
    },
  ],
] as const)('refuses %s and creates nothing there', async (_case, arrange) => {
  await mkdir(parent(), { recursive: true });
  await arrange();
  const error = await failure(prepare());
  expect(error.diagnostic).toMatchObject({ reason: 'data-root' });
  if (await exists(join(docker.root, 'elsewhere')))
    expect(await readdir(join(docker.root, 'elsewhere'))).toEqual([]);
  expect(await docker.commands()).toEqual([]);
});

it('refuses a root it does not own', async () => {
  const error = await failure(prepare({ uid: process.getuid!() + 1 }));
  expect(error.diagnostic).toMatchObject({ reason: 'data-root' });
});

it.each([
  ['a comma in the checkout path', join('repos,bind', 'checkout'), previewName],
  ['a slot name that escapes the root', join('repos', 'checkout'), '../../up'],
  ['a slot name with a separator', join('repos', 'checkout'), 'slot/inner'],
] as const)('refuses %s', async (_case, relativeSource, slot) => {
  const source = join(docker.root, relativeSource);
  await mkdir(source, { recursive: true });
  const error = await failure(
    prepareDataRoot({ sourceRoot: source, previewName: slot }),
  );
  expect(error.diagnostic).toMatchObject({ reason: 'data-root' });
  // Nothing was created beside the checkout.
  expect(await readdir(dirname(source))).toEqual(['checkout']);
});

it('claims a new private directory for each instance and never reuses one', async () => {
  const root = await prepare();
  const path = await claimNewDataDirectory({ root, name });
  expect(path).toBe(join(root.path, name));
  expect(await mode(path)).toBe(0o700);
  const again = await failure(claimNewDataDirectory({ root, name }));
  expect(again.diagnostic).toMatchObject({ reason: 'data-root' });
});

it.each([
  ['a name that is not an E2E instance', 'ep-dev-0123456789ab'],
  [
    'a path that escapes the root',
    '../ep-e2e-11111111-1111-1111-1111-111111111111',
  ],
  ['an absolute path', '/ep-e2e-11111111-1111-1111-1111-111111111111'],
])('refuses to claim %s', async (_case, unsafe) => {
  const root = await prepare();
  await expect(claimNewDataDirectory({ root, name: unsafe })).rejects.toThrow(
    'Invalid local Convex instance name',
  );
  expect(await readdir(root.path)).toEqual([]);
  expect(await readdir(join(root.path, '..'))).toEqual([basename(root.path)]);
});

it('verifies a kept instance directory, and refuses one missing, linked or readable by others', async () => {
  const root = await prepare();
  const path = await claimNewDataDirectory({ root, name });
  expect(await verifyKeptDataDirectory({ root, name })).toBe(path);
  await chmod(path, 0o755);
  expect(
    (await failure(verifyKeptDataDirectory({ root, name }))).diagnostic,
  ).toMatchObject({ reason: 'data-root' });
  const other = 'ep-e2e-22222222-2222-2222-2222-222222222222';
  expect(
    (await failure(verifyKeptDataDirectory({ root, name: other }))).diagnostic,
  ).toMatchObject({ reason: 'data-root' });
  await mkdir(join(docker.root, 'elsewhere'), { mode: 0o700 });
  await symlink(join(docker.root, 'elsewhere'), join(root.path, other));
  expect(
    (await failure(verifyKeptDataDirectory({ root, name: other }))).diagnostic,
  ).toMatchObject({ reason: 'data-root' });
});

const remove = (root: Awaited<ReturnType<typeof prepare>>, deadline = 30_000) =>
  removeData({
    root,
    name,
    image: localBackendImage,
    cleanupDeadline: Date.now() + deadline,
  });

it('removes the backend’s data with one confined helper, then the empty directory, and keeps the root', async () => {
  const root = await prepare();
  const path = await claimNewDataDirectory({ root, name });
  await writeBackendData(path);
  await remove(root);
  const runs = (await docker.readState()).log.filter(
    ([command]) => command === 'run',
  );
  expect(runs).toEqual([
    [
      'run',
      '--rm',
      '--pull',
      'never',
      '--network',
      'none',
      '--read-only',
      '--cap-drop',
      'ALL',
      '--cap-add',
      'DAC_OVERRIDE',
      '--security-opt',
      'no-new-privileges',
      '--cpus',
      '1',
      '--memory',
      '256m',
      '--memory-swap',
      '256m',
      '--pids-limit',
      '64',
      '--name',
      helperName,
      '--label',
      `dev.everythingpath.local-convex=${helperName}`,
      '--mount',
      `type=bind,source=${path},target=/convex/data`,
      '--entrypoint',
      '/usr/bin/find',
      localBackendImage,
      '/convex/data',
      '-xdev',
      '-mindepth',
      '1',
      '-delete',
    ],
  ]);
  expect(await exists(path)).toBe(false);
  expect(await mode(root.path)).toBe(0o700);
  expect((await docker.readState()).helper).toBeNull();
});

it('removes an empty directory without a helper once none remains, and treats a removed one as done', async () => {
  const root = await prepare();
  const path = await claimNewDataDirectory({ root, name });
  await remove(root);
  expect(await exists(path)).toBe(false);
  await remove(root);
  expect(await docker.commands()).not.toContain('run');
  expect(await exists(root.path)).toBe(true);
});

it('never deletes data while its backend container exists', async () => {
  const root = await prepare();
  const path = await claimNewDataDirectory({ root, name });
  await writeBackendData(path);
  await docker.updateState({
    container: {
      name,
      label: name,
      hostIp: '127.0.0.1',
      image: localBackendImage,
      port: '43210',
      sitePort: '43211',
      running: false,
    },
  });
  const error = await failure(remove(root));
  expect(error.diagnostic).toMatchObject({ reason: 'data-cleanup', name });
  // The recovery: our container, then the confined helper, then rmdir.
  const recovery = describeHarnessFailure(error).join('\n');
  expect(recovery).toContain(`docker rm -f ${name}`);
  expect(recovery).toContain('--entrypoint /usr/bin/find');
  expect(recovery).toContain('rmdir');
  expect(await readdir(path)).toEqual(['db.sqlite3', 'storage']);
  expect(await docker.commands()).not.toContain('run');
  expect(await docker.commands()).not.toContain('rm');
});

it.each([
  ['a name that is not an E2E instance', 'ep-dev-0123456789ab'],
  ['a path that escapes the root', `../${name}`],
])('never touches %s', async (_case, unsafe) => {
  const root = await prepare();
  await mkdir(join(root.path, '..', name), { mode: 0o700 });
  await expect(
    removeData({
      root,
      name: unsafe,
      image: localBackendImage,
      cleanupDeadline: Date.now() + 30_000,
    }),
  ).rejects.toThrow('Invalid local Convex instance name');
  expect(await exists(join(root.path, '..', name))).toBe(true);
  expect(await docker.commands()).toEqual([]);
});

it('refuses a linked instance directory without asking Docker or deleting through it', async () => {
  const root = await prepare();
  await mkdir(join(docker.root, 'elsewhere'), { mode: 0o700 });
  await writeFile(join(docker.root, 'elsewhere', 'keep'), 'keep');
  await symlink(join(docker.root, 'elsewhere'), join(root.path, name));
  const error = await failure(remove(root));
  expect(error.diagnostic).toMatchObject({ reason: 'data-cleanup', name });
  expect(await readdir(join(docker.root, 'elsewhere'))).toEqual(['keep']);
  expect(await docker.commands()).toEqual([]);
});

// Design r3: helper recovery comes before the empty-directory branch, so a
// helper that emptied its bind before a crash is still found.
it('recovers an exact surviving helper before removing an already empty directory', async () => {
  const root = await prepare();
  const path = await claimNewDataDirectory({ root, name });
  await helper(path);
  await remove(root);
  const { log, helper: left } = await docker.readState();
  expect(log).toContainEqual(['rm', '--force', 'helper-id']);
  expect(left).toBeNull();
  expect(await exists(path)).toBe(false);
  expect(await docker.commands()).not.toContain('run');
});

it.each<[string, Partial<FakeHelper> | 'second mount']>([
  ['another owner’s label', { label: 'someone-else' }],
  ['another image', { image: 'convex-backend:other' }],
  [
    'a bind of another directory',
    {
      mounts: [
        { type: 'bind', source: '/elsewhere', destination: '/convex/data' },
      ],
    },
  ],
  ['a second mount', 'second mount'],
])(
  'keeps a surviving helper with %s, and the directory it may still use',
  async (_case, mismatch) => {
    const root = await prepare();
    const path = await claimNewDataDirectory({ root, name });
    await helper(
      path,
      mismatch === 'second mount'
        ? {
            mounts: [
              { type: 'bind', source: path, destination: '/convex/data' },
              { type: 'volume', source: 'other', destination: '/other' },
            ],
          }
        : mismatch,
    );
    const error = await failure(remove(root));
    expect(error.diagnostic).toMatchObject({ reason: 'data-cleanup', name });
    expect((await docker.readState()).helper).not.toBeNull();
    expect(await docker.commands()).not.toContain('rm');
    expect(await docker.commands()).not.toContain('stop');
    expect(await exists(path)).toBe(true);
  },
);

// An absent directory is done only once no helper for it remains: a helper
// whose last deletion finished just before a crash is still resolved.
it('removes an exact surviving helper before treating an absent directory as done', async () => {
  const root = await prepare();
  await helper(join(root.path, name));
  await remove(root);
  const { log, helper: left } = await docker.readState();
  expect(log).toContainEqual(['rm', '--force', 'helper-id']);
  expect(left).toBeNull();
  expect(await docker.commands()).not.toContain('run');
});

it('fails, keeping the helper, when an absent directory’s surviving helper is not exactly ours', async () => {
  const root = await prepare();
  await helper(join(root.path, name), { image: 'convex-backend:other' });
  const error = await failure(remove(root));
  expect(error.diagnostic).toMatchObject({ reason: 'data-cleanup', name });
  expect((await docker.readState()).helper).not.toBeNull();
  expect(await docker.commands()).not.toContain('rm');
});

it('launches no helper without more than 12 seconds of the cleanup deadline left', async () => {
  const root = await prepare();
  const path = await claimNewDataDirectory({ root, name });
  await writeBackendData(path);
  const error = await failure(remove(root, 12_000));
  expect(error.diagnostic).toMatchObject({ reason: 'data-cleanup', name });
  expect(await docker.commands()).not.toContain('run');
  expect(await readdir(path)).toEqual(['db.sqlite3', 'storage']);
});

it('ends a hanging helper at its subdeadline and removes it by its verified id within the same deadline', async () => {
  const root = await prepare();
  const path = await claimNewDataDirectory({ root, name });
  await writeBackendData(path);
  await docker.updateState({ slow: { run: 20_000 } });
  const started = Date.now();
  const cleanupDeadline = started + 13_500;
  const error = await failure(
    removeData({ root, name, image: localBackendImage, cleanupDeadline }),
  );
  // The helper had what was left after 10 seconds' reserve, about 3.5 s;
  // the verified removal then fit in that reserve.
  expect(Date.now() - started).toBeGreaterThanOrEqual(3_000);
  expect(Date.now()).toBeLessThanOrEqual(cleanupDeadline);
  expect(error.diagnostic).toMatchObject({ reason: 'data-cleanup', name });
  const { log, helper: left } = await docker.readState();
  expect(log).toContainEqual(['rm', '--force', 'helper-id']);
  expect(left).toBeNull();
  expect(await readdir(path)).toEqual(['db.sqlite3', 'storage']);
}, 20_000);

it('reports a helper that fails and never forces the directory', async () => {
  const root = await prepare();
  const path = await claimNewDataDirectory({ root, name });
  await writeBackendData(path);
  await docker.updateState({ helperMode: 'fail' });
  const error = await failure(remove(root));
  expect(error.diagnostic).toMatchObject({ reason: 'data-cleanup', name });
  expect(await readdir(path)).toEqual(['db.sqlite3', 'storage']);
});

it('confirms a successful helper is gone before removing the directory', async () => {
  const root = await prepare();
  const path = await claimNewDataDirectory({ root, name });
  await writeBackendData(path);
  // It exited 0, but the daemon has not removed it yet.
  await docker.updateState({ helperMode: 'linger' });
  await remove(root);
  const { log, helper: left } = await docker.readState();
  expect(log).toContainEqual(['rm', '--force', 'helper-id']);
  expect(left).toBeNull();
  expect(await exists(path)).toBe(false);
});

// #774 fix r1 (Spec 3): recovering a surviving helper takes time, and the
// daemon or the directory may change meanwhile. Every check that allows a
// deletion is repeated after it, and no directory is removed while a helper
// may remain, empty or not.
const backendContainer = {
  name,
  label: name,
  hostIp: '127.0.0.1',
  image: localBackendImage,
  port: '43210',
  sitePort: '43211',
  running: false,
};

it('checks again that the backend is gone after recovering a helper, and launches none while it exists', async () => {
  const root = await prepare();
  const path = await claimNewDataDirectory({ root, name });
  await writeBackendData(path);
  await helper(path);
  await docker.updateState({
    onHelperRemoved: { container: backendContainer },
  });
  const error = await failure(remove(root));
  expect(error.diagnostic).toMatchObject({ reason: 'data-cleanup', name });
  const { log, container } = await docker.readState();
  expect(log).toContainEqual(['rm', '--force', 'helper-id']);
  expect(log.map(([command]) => command)).not.toContain('run');
  expect(container).not.toBeNull();
  expect(await readdir(path)).toEqual(['db.sqlite3', 'storage']);
});

it('checks the directory again after recovering a helper, and never deletes through a link it became', async () => {
  const root = await prepare();
  const path = await claimNewDataDirectory({ root, name });
  await writeBackendData(path);
  await mkdir(join(docker.root, 'elsewhere'), { mode: 0o700 });
  await writeFile(join(docker.root, 'elsewhere', 'keep'), 'keep');
  await helper(path);
  await docker.updateState({
    onHelperRemoved: { path, linkTarget: join(docker.root, 'elsewhere') },
  });
  const error = await failure(remove(root));
  expect(error.diagnostic).toMatchObject({ reason: 'data-cleanup', name });
  expect(await docker.commands()).not.toContain('run');
  expect(await readdir(join(docker.root, 'elsewhere'))).toEqual(['keep']);
});

it('checks the backend again between a recovered helper and the next one, in that order', async () => {
  const root = await prepare();
  const path = await claimNewDataDirectory({ root, name });
  await writeBackendData(path);
  await helper(path);
  await remove(root);
  const { log } = await docker.readState();
  const helperRemoved = log.findIndex(
    (args) => args.join(' ') === 'rm --force helper-id',
  );
  const launched = log.findIndex(([command]) => command === 'run');
  const backendChecks = log.flatMap((args, index) =>
    args.join(' ') === `ps -aq --filter name=^/${name}$` ? [index] : [],
  );
  expect(helperRemoved).toBeGreaterThan(0);
  expect(launched).toBeGreaterThan(helperRemoved);
  expect(
    backendChecks.some((index) => index > helperRemoved && index < launched),
  ).toBe(true);
  expect(await exists(path)).toBe(false);
});

it.each<[string, Partial<FakeHelper>, boolean]>([
  ['an exact helper, which it removes first', {}, true],
  ['another owner’s helper, which it keeps', { label: 'someone-else' }, false],
])(
  'confirms no helper remains before removing an empty directory: %s',
  async (_case, overrides, isRemoved) => {
    const root = await prepare();
    const path = await claimNewDataDirectory({ root, name });
    // None at the first lookup; one by the final check.
    await docker.updateState({
      helperAppears: {
        afterLookups: 1,
        helper: {
          name: helperName,
          label: helperName,
          image: localBackendImage,
          running: true,
          mounts: [{ type: 'bind', source: path, destination: '/convex/data' }],
          ...overrides,
        },
      },
    });
    const outcome = await remove(root).then(
      () => 'removed',
      (error: unknown) => error,
    );
    const { log, helper: left } = await docker.readState();
    if (isRemoved) {
      expect(outcome).toBe('removed');
      expect(log).toContainEqual(['rm', '--force', 'helper-id']);
      expect(left).toBeNull();
      expect(await exists(path)).toBe(false);
    } else {
      expect(outcome).toBeInstanceOf(HarnessFailure);
      expect(left).not.toBeNull();
      expect(await exists(path)).toBe(true);
    }
    expect(log.map(([command]) => command)).not.toContain('run');
  },
);
