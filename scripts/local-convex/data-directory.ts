import { createHash } from 'node:crypto';
import { lstat, mkdir, readdir, realpath, rmdir } from 'node:fs/promises';
import type { Stats } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { z } from 'zod';
import { localBackendFailure, runCleanupDocker } from './docker';

// An E2E backend's /convex/data (#774): a bind of a private directory beside
// the checkout, `<repo parent>/.ep-tmp/e2e-data/<slot>/<instance>`, so its
// database writes stay on the repository's filesystem. The pinned image runs
// as root, so its files are root-owned: only a confined same-image helper,
// launched here and nowhere else, deletes them.

/** The owner label on every local Convex container, helpers included. */
export const ownerLabel = 'dev.everythingpath.local-convex';
const e2eInstanceName = /^ep-e2e-[a-f0-9-]{36}$/;
const slotName = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
// Docker's --mount value is comma-separated.
const unsafePath = /[,\0-\x1f]/;
const helperLaunchMinimumMs = 12_000;
const helperRunCapMs = 10_000;
const helperReserveMs = 10_000;

/** A slot's data root that `prepareDataRoot` verified for this user. */
class VerifiedDataRoot {
  readonly #uid: number;
  constructor(
    readonly path: string,
    uid: number,
  ) {
    this.#uid = uid;
  }
  get uid() {
    return this.#uid;
  }
}
export type DataRoot = VerifiedDataRoot;

const isMissing = (error: unknown) =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT';

/** A real directory (no symlink) this user owns; private if `isPrivate`. */
const isOwnDirectory = (stats: Stats, uid: number, isPrivate: boolean) =>
  stats.isDirectory() &&
  !stats.isSymbolicLink() &&
  stats.uid === uid &&
  (!isPrivate || (stats.mode & 0o077) === 0);

function assertInstanceName(name: string) {
  if (!e2eInstanceName.test(name))
    throw new Error('Invalid local Convex instance name');
}

/**
 * Creates (mode 0700) and verifies this checkout's and slot's data root,
 * keyed like its prepared environment: every component from `.ep-tmp` down
 * is a real directory this user owns, the root is private and its path is
 * its real path. Otherwise `data-root`, with nothing created below.
 */
export async function prepareDataRoot({
  sourceRoot,
  previewName,
  uid = process.getuid?.(),
}: {
  sourceRoot: string;
  previewName: string;
  /** A test seam: the owner every component must have. */
  uid?: number;
}): Promise<DataRoot> {
  const components = slotComponents({ sourceRoot, previewName });
  if (uid === undefined || !components)
    throw localBackendFailure({ reason: 'data-root' });
  let path = dirname(sourceRoot);
  for (const [index, component] of components.entries()) {
    path = join(path, component);
    const isPrivate = index === components.length - 1;
    if (!(await ensureOwnDirectory({ path, uid, isPrivate })))
      throw localBackendFailure({ reason: 'data-root' });
  }
  if ((await realpath(path).catch(() => null)) !== path)
    throw localBackendFailure({ reason: 'data-root' });
  return new VerifiedDataRoot(path, uid);
}

/** The data root's components below the repo parent, or null if unsafe. */
function slotComponents({
  sourceRoot,
  previewName,
}: {
  sourceRoot: string;
  previewName: string;
}) {
  if (!isAbsolute(sourceRoot) || !slotName.test(previewName)) return null;
  const hash = createHash('sha256').update(sourceRoot).digest('hex');
  const components = [
    '.ep-tmp',
    'e2e-data',
    `${previewName}-${hash.slice(0, 12)}`,
  ];
  return unsafePath.test(join(dirname(sourceRoot), ...components))
    ? null
    : components;
}

/** Creates `path` (mode 0700) if absent; whether it is then this user's own directory. */
async function ensureOwnDirectory({
  path,
  uid,
  isPrivate,
}: {
  path: string;
  uid: number;
  isPrivate: boolean;
}) {
  const isCreatedOrPresent = await mkdir(path, { mode: 0o700 }).then(
    () => true,
    (error: unknown) =>
      error instanceof Error && 'code' in error && error.code === 'EEXIST',
  );
  if (!isCreatedOrPresent) return false;
  const stats = await lstat(path).catch(() => null);
  return stats !== null && isOwnDirectory(stats, uid, isPrivate);
}

/** `root/name` if it is a private real directory of this user; null if absent. */
async function inspectInstanceDirectory({
  root,
  name,
}: {
  root: DataRoot;
  name: string;
}) {
  assertInstanceName(name);
  const path = join(root.path, name);
  let stats: Stats;
  try {
    stats = await lstat(path);
  } catch (error) {
    if (isMissing(error)) return { path, isPresent: false, isSafe: true };
    return { path, isPresent: true, isSafe: false };
  }
  const isSafe =
    isOwnDirectory(stats, root.uid, true) &&
    dirname(path) === root.path &&
    (await realpath(path).catch(() => null)) === path;
  return { path, isPresent: true, isSafe };
}

/** A new instance's private data directory; never one that exists. */
export async function claimNewDataDirectory({
  root,
  name,
}: {
  root: DataRoot;
  name: string;
}) {
  assertInstanceName(name);
  const path = join(root.path, name);
  try {
    await mkdir(path, { mode: 0o700 });
  } catch {
    throw localBackendFailure({ reason: 'data-root', name });
  }
  const { isSafe } = await inspectInstanceDirectory({ root, name });
  if (!isSafe) throw localBackendFailure({ reason: 'data-root', name });
  return path;
}

/** A kept (prepared) instance's data directory, which must exist and be private. */
export async function verifyKeptDataDirectory({
  root,
  name,
}: {
  root: DataRoot;
  name: string;
}) {
  const { path, isPresent, isSafe } = await inspectInstanceDirectory({
    root,
    name,
  });
  if (!isPresent || !isSafe)
    throw localBackendFailure({ reason: 'data-root', name });
  return path;
}

/**
 * Each mount's type, source and destination, and nothing else: no env or
 * other configuration is read.
 */
export const mountsFormat =
  '[{{range $i, $m := .Mounts}}{{if $i}},{{end}}[{{json $m.Type}},{{json $m.Source}},{{json $m.Destination}}]{{end}}]';
const mountsSchema = z.array(z.tuple([z.string(), z.string(), z.string()]));

/** Whether a container's only mount is the bind of `path` at /convex/data. */
export function isOnlyDataBind(output: string, path: string) {
  try {
    const [only, ...others] = mountsSchema.parse(JSON.parse(output));
    if (!only || others.length > 0) return false;
    const [type, source, destination] = only;
    return type === 'bind' && source === path && destination === '/convex/data';
  } catch {
    return false;
  }
}

const helperName = (name: string) => `${name}-data-cleanup`;

/** The exact confined helper that deletes everything in `path`, as root. */
const helperArgs = ({
  name,
  path,
  image,
}: {
  name: string;
  path: string;
  image: string;
}) => [
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
  helperName(name),
  '--label',
  `${ownerLabel}=${helperName(name)}`,
  '--mount',
  `type=bind,source=${path},target=/convex/data`,
  '--entrypoint',
  '/usr/bin/find',
  image,
  '/convex/data',
  '-xdev',
  '-mindepth',
  '1',
  '-delete',
];

const findByName = (name: string, cleanupDeadline: number) =>
  runCleanupDocker({
    args: ['ps', '-aq', '--filter', `name=^/${name}$`],
    cleanupDeadline,
  });

/**
 * Leaves no helper for this instance: an exact one (name, owner label,
 * pinned image, single bind of `path`) is removed by its verified id and its
 * absence confirmed. Any other is kept, and the cleanup fails.
 */
async function resolveHelper({
  name,
  path,
  image,
  cleanupDeadline,
}: {
  name: string;
  path: string;
  image: string;
  cleanupDeadline: number;
}) {
  const id = await findByName(helperName(name), cleanupDeadline);
  if (!id) return;
  const inspect = (format: string) =>
    runCleanupDocker({
      args: ['inspect', '--format', format, id],
      cleanupDeadline,
    });
  if (
    (await inspect(`{{index .Config.Labels "${ownerLabel}"}}`)) !==
      helperName(name) ||
    (await inspect('{{.Config.Image}}')) !== image ||
    !isOnlyDataBind(await inspect(mountsFormat), path)
  )
    throw new Error('Foreign local Convex data helper');
  await runCleanupDocker({ args: ['rm', '--force', id], cleanupDeadline });
  if (await findByName(helperName(name), cleanupDeadline))
    throw new Error('Local Convex data helper remains');
}

/**
 * The only deletion path for an E2E backend's data, within the caller's
 * cleanup deadline (never extended). With the container gone and no helper
 * left (exactly verified, then confirmed absent), and both checked again
 * with the directory after that, a non-empty directory is emptied by one
 * confined helper, given at most 10 s and leaving 10 s for its verified
 * removal. Before `rmdir` (never recursive), on every path, no helper may
 * remain and the checks are repeated. An absent directory needs only the
 * helper check. Anything else keeps the directory and fails as
 * `data-cleanup`.
 */
export async function removeData({
  root,
  name,
  image,
  cleanupDeadline,
}: {
  root: DataRoot;
  name: string;
  image: string;
  cleanupDeadline: number;
}) {
  const refuse = () => localBackendFailure({ reason: 'data-cleanup', name });
  const initial = await inspectInstanceDirectory({ root, name });
  const { path } = initial;
  if (!initial.isSafe) throw refuse();
  // Before any step that may delete: the directory is still safe and its
  // backend still gone, however long the step before it took.
  const revalidate = async () => {
    const target = await inspectInstanceDirectory({ root, name });
    if (!target.isSafe || (await findByName(name, cleanupDeadline)))
      throw refuse();
    return target;
  };
  try {
    if (await findByName(name, cleanupDeadline)) throw refuse();
    const helper = { name, path, image, cleanupDeadline };
    await resolveHelper(helper);
    if (!(await revalidate()).isPresent) return;
    if ((await readdir(path)).length > 0) {
      const now = Date.now();
      if (cleanupDeadline - now <= helperLaunchMinimumMs) throw refuse();
      const isEmptied = await runCleanupDocker({
        args: helperArgs({ name, path, image }),
        cleanupDeadline: Math.min(
          now + helperRunCapMs,
          cleanupDeadline - helperReserveMs,
        ),
      }).then(
        () => true,
        () => false,
      );
      // Also after a zero exit: `--rm` may not have removed it yet.
      await resolveHelper(helper);
      await revalidate();
      if (!isEmptied || (await readdir(path)).length > 0) throw refuse();
    }
    // Empty or emptied: no helper may remain before the directory goes.
    await resolveHelper(helper);
    await revalidate();
    await rmdir(path);
  } catch {
    throw refuse();
  }
}

/** This slot root's instance directories, sorted, and how many other entries it holds. */
export async function listSlotEntries(root: DataRoot) {
  const entries = await readdir(root.path, { withFileTypes: true });
  const instances = entries
    .filter((entry) => entry.isDirectory() && e2eInstanceName.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  return { instances, ignored: entries.length - instances.length };
}
