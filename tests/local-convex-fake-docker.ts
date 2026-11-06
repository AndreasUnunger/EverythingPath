import {
  chmod,
  lstat,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, vi } from 'vitest';
import { z } from 'zod';

// A Docker client and daemon for the local Convex tests: every invocation
// reads and writes the daemon's state, as real Docker would, and logs its
// arguments before acting. It holds at most one backend container
// (`container-id`) and one data cleanup helper (`helper-id`).

const mountSchema = z.object({
  type: z.string(),
  source: z.string(),
  destination: z.string(),
});
const containerSchema = z.object({
  name: z.string(),
  label: z.string(),
  hostIp: z.string(),
  image: z.string(),
  port: z.string(),
  sitePort: z.string(),
  running: z.boolean(),
  mounts: z.array(mountSchema).default([]),
});
const helperSchema = z.object({
  name: z.string(),
  label: z.string(),
  image: z.string(),
  running: z.boolean(),
  mounts: z.array(mountSchema),
});
const stateSchema = z.object({
  log: z.array(z.array(z.string())),
  daemon: z.boolean(),
  imagePresent: z.boolean(),
  pullSucceeds: z.boolean(),
  container: containerSchema.nullable(),
  helper: helperSchema.nullable(),
  failing: z.array(z.string()),
  slow: z.record(z.string(), z.number()),
  createLosesClient: z.boolean(),
  startLosesClient: z.boolean(),
  // A daemon that cannot see the host directory it was given (a remote
  // daemon, or Desktop file sharing that does not cover it): the backend's
  // writes never reach the bind source.
  remoteDaemon: z.boolean(),
  // How a launched helper ends: it deletes the data and is removed (`--rm`);
  // it fails without deleting; or it deletes the data and exits 0 but the
  // daemon has not removed it yet. A slow `run` models a hanging helper.
  helperMode: z.enum(['delete', 'fail', 'linger']),
  // #774 fix r1: state that changes while a cleanup runs. When the daemon
  // removes the surviving helper, the backend container reappears, or the
  // data directory is replaced by a link to `linkTarget`.
  onHelperRemoved: z
    .object({
      container: containerSchema.optional(),
      path: z.string().optional(),
      linkTarget: z.string().optional(),
    })
    .nullable()
    .default(null),
  // A helper that appears after this many lookups of its name.
  helperAppears: z
    .object({ afterLookups: z.number(), helper: helperSchema })
    .nullable()
    .default(null),
  helperLookups: z.number().default(0),
  adminKey: z.string(),
});
type FakeDockerState = z.input<typeof stateSchema>;
export type FakeContainer = z.input<typeof containerSchema>;
export type FakeHelper = z.infer<typeof helperSchema>;

const fakeDocker = `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const file = process.env.EP_TEST_DOCKER_STATE;
const load = () => JSON.parse(fs.readFileSync(file, 'utf8'));
const save = (state) => fs.writeFileSync(file, JSON.stringify(state));
const args = process.argv.slice(2);
const command = args[0] === 'image' ? 'image ' + args[1] : args[0];
const value = (flag, index = 0) => args.filter((_, i) => args[i - 1] === flag)[index];
const parseMount = (spec) => {
  const fields = Object.fromEntries(spec.split(',').map((part) => part.split('=')));
  return { type: fields.type, source: fields.source || '', destination: fields.target };
};
let state = load();
state.log.push(args);
// The daemon registers a helper before its command runs, so a client killed
// meanwhile leaves the helper behind.
if (command === 'run' && state.daemon && !state.failing.includes('run'))
  state.helper = {
    name: value('--name'),
    label: value('--label').split('=')[1],
    image: args[args.indexOf('--entrypoint') + 2],
    running: true,
    mounts: [parseMount(value('--mount'))],
  };
save(state);
const slow = state.slow[command];
if (slow) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, slow);
state = load();
const out = (text) => process.stdout.write(text);
if (!state.daemon || state.failing.includes(command)) process.exit(1);
const c = state.container;
const kind = (id) => (id === 'helper-id' ? 'helper' : 'container');
const target = (id) => state[kind(id)];
// Files the backend writes as root: the host user cannot delete them.
const unlock = (entry) => {
  if (!fs.lstatSync(entry).isDirectory()) return;
  fs.chmodSync(entry, 0o700);
  for (const child of fs.readdirSync(entry)) unlock(path.join(entry, child));
};
switch (command) {
  case 'version': out('27.0.0'); break;
  case 'image inspect': if (!state.imagePresent) process.exit(1); out('sha256:image'); break;
  case 'pull': if (!state.pullSucceeds) process.exit(1); state.imagePresent = true; break;
  case 'ps': {
    const name = value('--filter').slice('name=^/'.length, -1);
    if (name.endsWith('-data-cleanup')) {
      state.helperLookups += 1;
      const appears = state.helperAppears;
      if (appears && !state.helper && state.helperLookups > appears.afterLookups) {
        state.helper = appears.helper;
        state.helperAppears = null;
      }
    }
    if (state.helper && state.helper.name === name) out('helper-id');
    else if (c && c.name === name) out('container-id');
    break;
  }
  case 'inspect': {
    const format = args[2];
    const t = target(args[args.length - 1]);
    if (!t) process.exit(1);
    if (format.includes('.Mounts')) out(JSON.stringify(t.mounts.map((m) => [m.type, m.source, m.destination])));
    else if (format.includes('Labels')) out(t.label);
    else if (format.includes('HostIp')) out(t.hostIp);
    else if (format.includes('3210/tcp') && format.includes('HostPort')) out(t.port);
    else if (format.includes('3211/tcp') && format.includes('HostPort')) out(t.sitePort);
    else if (format.includes('.Config.Image')) out(t.image);
    else if (format.includes('.State.Running')) out(String(t.running));
    else process.exit(2);
    break;
  }
  case 'create': {
    const port = (i) => value('--publish', i).split(':');
    const mount = parseMount(value('--mount'));
    // Docker refuses a bind whose source does not exist.
    if (mount.type === 'bind' && !fs.existsSync(mount.source)) process.exit(1);
    state.container = {
      name: value('--name'),
      label: value('--label').split('=')[1],
      hostIp: port(0)[0],
      port: port(0)[1],
      sitePort: port(1)[1],
      image: args[args.length - 1],
      running: false,
      mounts: [mount],
    };
    if (state.createLosesClient) { save(state); process.exit(1); }
    out('container-id');
    break;
  }
  case 'start': {
    c.running = true;
    const bind = c.mounts.find((m) => m.type === 'bind' && m.destination === '/convex/data');
    if (bind && !state.remoteDaemon) {
      fs.writeFileSync(path.join(bind.source, 'db.sqlite3'), 'database');
      const storage = path.join(bind.source, 'storage');
      if (!fs.existsSync(storage)) {
        fs.mkdirSync(storage);
        fs.writeFileSync(path.join(storage, 'blob'), 'blob');
        fs.chmodSync(storage, 0o500);
      }
    }
    if (state.startLosesClient) { save(state); process.exit(1); }
    break;
  }
  case 'run': {
    const h = state.helper;
    if (state.helperMode === 'fail') { state.helper = null; save(state); process.exit(1); }
    // find /convex/data -xdev -mindepth 1 -delete, as root.
    const source = h.mounts[0].source;
    for (const entry of fs.readdirSync(source)) {
      unlock(path.join(source, entry));
      fs.rmSync(path.join(source, entry), { recursive: true, force: true });
    }
    if (state.helperMode === 'linger') h.running = false;
    else state.helper = null;
    break;
  }
  case 'exec': out(state.adminKey); break;
  case 'stop': { const t = target(args[args.length - 1]); if (t) t.running = false; break; }
  case 'rm': {
    const removed = kind(args[args.length - 1]);
    state[removed] = null;
    const change = state.onHelperRemoved;
    if (removed === 'helper' && change) {
      state.onHelperRemoved = null;
      if (change.container) state.container = change.container;
      if (change.path && change.linkTarget) {
        unlock(change.path);
        fs.rmSync(change.path, { recursive: true, force: true });
        fs.symlinkSync(change.linkTarget, change.path);
      }
    }
    break;
  }
  default: process.exit(3);
}
save(state);
`;

/** Makes every directory under `path` writable again, so it can be removed. */
export async function unlockTree(path: string) {
  const stats = await lstat(path).catch(() => null);
  if (!stats?.isDirectory()) return;
  await chmod(path, 0o700);
  for (const entry of await readdir(path)) await unlockTree(join(path, entry));
}

/**
 * Puts the fake `docker` first on PATH for each test of the calling file, in
 * a fresh private directory (`root`, a real path) that is removed afterwards.
 */
export function useFakeDocker() {
  let root = '';
  let statePath = '';
  async function setState(state: Partial<FakeDockerState>) {
    const initial: FakeDockerState = {
      log: [],
      daemon: true,
      imagePresent: true,
      pullSucceeds: true,
      container: null,
      helper: null,
      failing: [],
      slow: {},
      createLosesClient: false,
      startLosesClient: false,
      remoteDaemon: false,
      helperMode: 'delete',
      adminKey: 'ep-instance|0123abcd',
    };
    // Parsed, so every container has its defaults (no mounts) as Docker reports.
    await writeFile(
      statePath,
      JSON.stringify(stateSchema.parse({ ...initial, ...state })),
    );
  }
  async function readState() {
    return stateSchema.parse(JSON.parse(await readFile(statePath, 'utf8')));
  }
  beforeEach(async () => {
    root = await realpath(
      await mkdtemp(join(tmpdir(), 'local-convex-docker-')),
    );
    statePath = join(root, 'state.json');
    await writeFile(join(root, 'docker'), fakeDocker, { mode: 0o700 });
    vi.stubEnv('PATH', `${root}:${process.env.PATH}`);
    vi.stubEnv('EP_TEST_DOCKER_STATE', statePath);
    await setState({});
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    await unlockTree(root);
    await rm(root, { recursive: true, force: true });
  });
  return {
    get root() {
      return root;
    },
    setState,
    readState,
    /** Updates the daemon's current state. */
    updateState: async (change: Partial<FakeDockerState>) => {
      await setState({ ...(await readState()), ...change });
    },
    /** Each logged call's command, `image inspect` as two words. */
    commands: async () =>
      (await readState()).log.map((args) =>
        args[0] === 'image' ? `image ${args[1]}` : (args[0] ?? ''),
      ),
  };
}
