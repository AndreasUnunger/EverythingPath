// @vitest-environment node
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HarnessFailure } from './diagnostics';
import {
  discardPreparedEnvironment,
  planPreparation,
  preparedEnvironmentDirectory,
  preparedEnvironmentTtlMs,
  readPreparedRecord,
  writePreparedRecord,
  type ExpectedPreparation,
  type Preparation,
  type PreparedRecord,
} from './prepared-environment';

const hash = (character: string) => character.repeat(64);
const instanceName = 'ep-e2e-11111111-1111-1111-1111-111111111111';
const createdAt = Date.parse('2026-10-17T06:00:00.000Z');
const preparation: Preparation = {
  reuseFingerprint: hash('a'),
  parts: {
    sources: hash('b'),
    buildEnvironment: hash('c'),
    node: 'v24.0.0',
    pnpm: '10.0.0',
    dependencies: hash('d'),
  },
  sourceFingerprint: hash('e'),
  target: {
    resources: hash('f'),
    previewName: 'e2e-local-test-slot-0',
    clerkHost: 'testing-otter-1.clerk.accounts.dev',
    publishableKey: hash('0'),
  },
  workers: 2,
  releaseState: 'none',
  backend: {
    image: 'ghcr.io/convex/convex-backend@sha256:pinned',
    instanceName,
    url: 'http://127.0.0.1:3210',
    siteUrl: 'http://127.0.0.1:3211',
    // #774: its data is a bind of a directory beside the checkout.
    dataPlacement: 'bind-v1',
  },
  writeEpoch: 0,
  createdAt,
};
const expected: ExpectedPreparation = {
  reuseFingerprint: preparation.reuseFingerprint,
  parts: preparation.parts,
  target: preparation.target,
  workers: 2,
  releaseState: 'none',
  image: preparation.backend.image,
  dataPlacement: 'bind-v1',
};
const ready: PreparedRecord = {
  schema: 2,
  state: 'ready',
  ownerToken: 'previous-owner',
  runId: 'everythingpath-e2e-previous',
  instanceName,
  preparation,
};
// The record every run wrote before #774 (dbe4621a): schema 1, and a
// container whose data is an anonymous volume.
const legacyPreparation = {
  ...preparation,
  backend: {
    image: preparation.backend.image,
    instanceName,
    url: preparation.backend.url,
    siteUrl: preparation.backend.siteUrl,
  },
};
const legacyReady = { ...ready, schema: 1, preparation: legacyPreparation };

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'e2e-prepared-'));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});
const directory = () => join(root, 'prepared');
async function writeRaw(record: unknown) {
  await mkdir(directory(), { recursive: true, mode: 0o700 });
  await writeFile(join(directory(), 'record.json'), JSON.stringify(record));
}

it('keeps each checkout and slot in its own directory beside the checkouts, never inside one', () => {
  const first = preparedEnvironmentDirectory({
    sourceRoot: '/home/user/repos/project/worktree-a',
    previewName: 'e2e-local-test-slot-0',
  });
  expect(first).toMatch(
    /^\/home\/user\/repos\/project\/\.ep-tmp\/e2e-prepared\/e2e-local-test-slot-0-[a-f0-9]{12}$/,
  );
  expect(
    preparedEnvironmentDirectory({
      sourceRoot: '/home/user/repos/project/worktree-b',
      previewName: 'e2e-local-test-slot-0',
    }),
  ).not.toBe(first);
  expect(
    preparedEnvironmentDirectory({
      sourceRoot: '/home/user/repos/project/worktree-a',
      previewName: 'e2e-local-test-slot-1',
    }),
  ).not.toBe(first);
});

it('writes the record privately and atomically, and reads a damaged one as unreadable', async () => {
  expect(await readPreparedRecord(directory())).toEqual({ kind: 'missing' });
  await writePreparedRecord(directory(), ready);
  expect(await readPreparedRecord(directory())).toEqual({
    kind: 'current',
    record: ready,
  });
  expect((await stat(directory())).mode & 0o777).toBe(0o700);
  expect((await stat(join(directory(), 'record.json'))).mode & 0o777).toBe(
    0o600,
  );
  // Racing writers: every reader sees one whole record, and no candidate
  // file is left behind.
  await Promise.all(
    Array.from({ length: 20 }, (_, index) =>
      writePreparedRecord(directory(), { ...ready, runId: `run-${index}` }),
    ),
  );
  expect(await readPreparedRecord(directory())).toMatchObject({
    kind: 'current',
    record: { state: 'ready', runId: expect.stringMatching(/^run-[0-9]+$/) },
  });
  expect(await readdir(directory())).toEqual(['record.json']);
  await writeFile(join(directory(), 'record.json'), '{"schema":2,');
  expect(await readPreparedRecord(directory())).toEqual({
    kind: 'unreadable',
  });
});

it.each([
  ['a ready one', legacyReady],
  [
    'one a run still held',
    { ...legacyReady, state: 'in-use', ownerToken: 'other-run' },
  ],
  [
    'an incomplete one that names its container',
    { ...legacyReady, state: 'in-use', preparation: null },
  ],
  [
    'one from before its container existed',
    { ...legacyReady, state: 'in-use', instanceName: null, preparation: null },
  ],
] as const)(
  'reads an earlier schema-1 record, %s, for disposal with its identity and state',
  async (_case, record) => {
    await writeRaw(record);
    expect(await readPreparedRecord(directory())).toEqual({
      kind: 'legacy',
      record,
    });
  },
);

it.each([
  [
    'a current record whose two instance names differ',
    {
      ...ready,
      instanceName: 'ep-e2e-22222222-2222-2222-2222-222222222222',
    },
  ],
  [
    'a legacy record whose two instance names differ',
    {
      ...legacyReady,
      instanceName: 'ep-e2e-22222222-2222-2222-2222-222222222222',
    },
  ],
  [
    'a current record without its data placement',
    { ...legacyReady, schema: 2 },
  ],
  ['a schema-1 record with a data placement', { ...ready, schema: 1 }],
  ['an unknown schema', { ...ready, schema: 3 }],
  ['an instance name that is not ours', { ...ready, instanceName: '../x' }],
] as const)('reads %s as unreadable', async (_case, record) => {
  await writeRaw(record);
  expect(await readPreparedRecord(directory())).toEqual({ kind: 'unreadable' });
});

const notRunning = () => Promise.resolve(false);
const plan = (
  record: Awaited<ReturnType<typeof readPreparedRecord>>,
  options: {
    expected?: ExpectedPreparation;
    now?: number;
    isRunning?: (name: string) => Promise<boolean>;
  } = {},
) =>
  planPreparation({
    record,
    expected: options.expected ?? expected,
    now: options.now ?? createdAt + 1000,
    isRunning: options.isRunning ?? notRunning,
  });
const current = (record: PreparedRecord = ready) =>
  ({ kind: 'current', record }) as const;
const legacy = (record: unknown) =>
  ({ kind: 'legacy', record }) as unknown as Awaited<
    ReturnType<typeof readPreparedRecord>
  >;
const bindDiscard = { instanceName, placement: 'bind-v1' } as const;

it('reuses a ready preparation only when everything matches', async () => {
  expect(await plan(current())).toEqual({ kind: 'reuse', preparation });
  // Fewer workers than prepared still match: their capabilities are minted
  // per run.
  expect(
    await plan(current(), { expected: { ...expected, workers: 1 } }),
  ).toMatchObject({ kind: 'reuse' });
});

it.each([
  ['sources', { parts: { ...expected.parts, sources: hash('1') } }],
  [
    'build environment',
    { parts: { ...expected.parts, buildEnvironment: hash('1') } },
  ],
  ['node', { parts: { ...expected.parts, node: 'v24.1.0' } }],
  ['pnpm', { parts: { ...expected.parts, pnpm: '10.1.0' } }],
  ['dependencies', { parts: { ...expected.parts, dependencies: hash('1') } }],
  ['reuse fingerprint', { reuseFingerprint: hash('1') }],
  [
    'target',
    { target: { ...expected.target, clerkHost: 'other.clerk.accounts.dev' } },
  ],
  ['target', { target: { ...expected.target, resources: hash('1') } }],
  ['workers', { workers: 3 }],
  ['backend image', { image: 'ghcr.io/convex/convex-backend@sha256:newer' }],
] as const)(
  'prepares afresh, discarding the old container and its data, when the %s differs',
  async (reason, override) => {
    expect(
      await plan(current(), { expected: { ...expected, ...override } }),
    ).toEqual({ kind: 'prepare', discard: bindDiscard, reason });
  },
);

it('prepares afresh once the preparation is a day old, or when it is incomplete', async () => {
  expect(
    await plan(current(), { now: createdAt + preparedEnvironmentTtlMs }),
  ).toEqual({ kind: 'prepare', discard: bindDiscard, reason: 'age' });
  expect(await plan(current({ ...ready, preparation: null }))).toEqual({
    kind: 'prepare',
    discard: bindDiscard,
    reason: 'incomplete',
  });
});

it('keeps an unreadable record for manual recovery: it may name a container no one can see', async () => {
  expect(await plan({ kind: 'unreadable' })).toEqual({ kind: 'unreadable' });
});

it('refuses any running backend, ready or held, and discards a held one once stopped', async () => {
  const held: PreparedRecord = {
    ...ready,
    state: 'in-use',
    ownerToken: 'other-run',
  };
  const isRunning = (name: string) => Promise.resolve(name === instanceName);
  expect(await plan(current(held), { isRunning })).toEqual({
    kind: 'refuse',
    instanceName,
  });
  // #774: a ready environment whose container runs is in use too.
  expect(await plan(current(), { isRunning })).toEqual({
    kind: 'refuse',
    instanceName,
  });
  expect(await plan(current(held))).toEqual({
    kind: 'prepare',
    discard: bindDiscard,
    reason: 'abandoned',
  });
  // A run that crashed before its container existed left nothing to stop.
  expect(
    await plan(current({ ...held, instanceName: null, preparation: null })),
  ).toEqual({ kind: 'prepare', discard: null, reason: 'abandoned' });
});

it('never reuses a schema-1 environment, even one that matches: it discards it with its volume', async () => {
  for (const record of [
    legacyReady,
    { ...legacyReady, state: 'in-use' },
    { ...legacyReady, state: 'in-use', preparation: null },
  ])
    expect(await plan(legacy(record))).toEqual({
      kind: 'prepare',
      discard: { instanceName, placement: 'volume' },
      reason: 'data placement',
    });
  expect(
    await plan(
      legacy({
        ...legacyReady,
        state: 'in-use',
        instanceName: null,
        preparation: null,
      }),
    ),
  ).toEqual({ kind: 'prepare', discard: null, reason: 'data placement' });
});

it('refuses a schema-1 environment whose container runs, ready or held', async () => {
  const isRunning = () => Promise.resolve(true);
  for (const record of [legacyReady, { ...legacyReady, state: 'in-use' }])
    expect(await plan(legacy(record), { isRunning })).toEqual({
      kind: 'refuse',
      instanceName,
    });
});

/** Disposes the environment in `directory()` with fakes that record what happened. */
function disposal({
  isRunning = notRunning,
  discardBackend = async () => undefined,
}: {
  isRunning?: (name: string) => Promise<boolean>;
  discardBackend?: (backend: {
    name: string;
    placement: 'bind-v1' | 'volume';
  }) => Promise<void>;
} = {}) {
  const discarded = vi.fn(discardBackend);
  const removed = vi.fn((path: string) =>
    rm(path, { recursive: true, force: true }),
  );
  return {
    discarded,
    removed,
    run: () =>
      discardPreparedEnvironment({
        directory: directory(),
        isRunning,
        discardBackend: discarded,
        removeDirectory: removed,
      }),
  };
}
const recordText = () => readFile(join(directory(), 'record.json'), 'utf8');
async function harnessFailure(promise: Promise<unknown>) {
  const error = await promise.then(
    () => undefined,
    (caught: unknown) => caught,
  );
  if (!(error instanceof HarnessFailure)) throw new Error('expected failure');
  return error;
}

it.each([
  ['a current', ready, 'bind-v1'],
  ['a schema-1', legacyReady, 'volume'],
] as const)(
  'disposes %s environment’s stopped container first, then its record',
  async (_case, record, placement) => {
    await writeRaw(record);
    const { discarded, removed, run } = disposal();
    await run();
    expect(discarded).toHaveBeenCalledExactlyOnceWith({
      name: instanceName,
      placement,
    });
    expect(removed).toHaveBeenCalledExactlyOnceWith(directory());
    expect(
      discarded.mock.invocationCallOrder[0]! <
        removed.mock.invocationCallOrder[0]!,
    ).toBe(true);
  },
);

it.each([
  ['a current', ready],
  ['a schema-1', legacyReady],
] as const)(
  'refuses to dispose %s environment whose container runs, and keeps its record',
  async (_case, record) => {
    await writeRaw(record);
    const before = await recordText();
    const { discarded, removed, run } = disposal({
      isRunning: () => Promise.resolve(true),
    });
    const error = await harnessFailure(run());
    expect(error.diagnostic).toEqual({ kind: 'prepared-in-use' });
    expect(discarded).not.toHaveBeenCalled();
    expect(removed).not.toHaveBeenCalled();
    expect(await recordText()).toBe(before);
  },
);

it('keeps an unreadable record, and everything it may name, for manual recovery', async () => {
  await writeRaw({ ...ready, schema: 3 });
  const before = await recordText();
  const { discarded, removed, run } = disposal();
  const error = await harnessFailure(run());
  expect(error.diagnostic).toEqual({ kind: 'prepared-unreadable' });
  expect(discarded).not.toHaveBeenCalled();
  expect(removed).not.toHaveBeenCalled();
  expect(await recordText()).toBe(before);
});

it.each([
  ['a current', ready],
  ['a schema-1', legacyReady],
] as const)(
  'keeps %s record when its container or data cannot be disposed',
  async (_case, record) => {
    await writeRaw(record);
    const before = await recordText();
    const { removed, run } = disposal({
      discardBackend: () =>
        Promise.reject(
          new HarnessFailure({
            kind: 'local-backend',
            reason: 'data-cleanup',
            name: instanceName,
          }),
        ),
    });
    expect((await harnessFailure(run())).diagnostic).toMatchObject({
      reason: 'data-cleanup',
    });
    expect(removed).not.toHaveBeenCalled();
    expect(await recordText()).toBe(before);
  },
);

it('removes a directory whose record names no container, or has none', async () => {
  await writeRaw({
    ...ready,
    state: 'in-use',
    instanceName: null,
    preparation: null,
  });
  const named = disposal();
  await named.run();
  expect(named.discarded).not.toHaveBeenCalled();
  expect(named.removed).toHaveBeenCalledExactlyOnceWith(directory());
  await mkdir(join(directory(), 'workspace'), { recursive: true });
  const unnamed = disposal();
  await unnamed.run();
  expect(unnamed.removed).toHaveBeenCalledExactlyOnceWith(directory());
});
