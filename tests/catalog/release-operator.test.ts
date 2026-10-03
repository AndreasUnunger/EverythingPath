// @vitest-environment node
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import { runCapturedProcess } from '../../scripts/catalog/process';
import { runCatalogReleaseOperator } from '../../scripts/catalog/release-operator';
import { validateCatalogReleaseArtifact } from '../../src/lib/catalog/release-schema';
import type {
  CatalogReleaseCommandAdapter,
  CatalogReleaseStatus,
} from '../../scripts/catalog/release-command';

const temporary: string[] = [];
const script = resolve('scripts/catalog-release.ts');
const loader = fileURLToPath(import.meta.resolve('tsx'));
async function workspace() {
  const root = await mkdtemp(join(tmpdir(), 'catalog-release-command-'));
  temporary.push(root);
  const system = join(root, 'system');
  const content = join(root, 'content');
  await mkdir(join(system, 'public'), { recursive: true });
  await mkdir(join(system, 'packs/feats'), { recursive: true });
  await mkdir(join(content, 'src'), { recursive: true });
  await writeFile(
    join(system, 'public/system.json'),
    JSON.stringify({ version: '11.11', packs: [{ name: 'feats' }] }),
  );
  await writeFile(
    join(content, 'module.json'),
    JSON.stringify({ version: '11.4.0', packs: [] }),
  );
  await writeFile(
    join(system, 'packs/feats/fixture.yaml'),
    JSON.stringify({
      _id: 'FixtureFeat',
      _key: '!items!FixtureFeat',
      name: 'Fixture feat',
      type: 'feat',
      system: {},
    }),
  );
  const artifact = join(root, 'output/release.json');
  const args = [
    'build',
    '--number',
    '1',
    '--schema',
    'character-sheet-v1',
    '--calculation',
    'facts-v1',
    '--system',
    system,
    '--content',
    content,
    '--artifact',
    artifact,
    '--allow-unverified-checkouts',
  ];
  return { root, system, content, artifact, args };
}
afterEach(async () => {
  await Promise.all(
    temporary
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

it('the CLI builds a deterministic gated artifact and prepares/inspects it through the injected remote command adapter', async () => {
  const input = await workspace();
  const run = (args: string[]) =>
    runCapturedProcess({
      command: process.execPath,
      args: ['--import', loader, script, ...args],
    });
  const first = run(input.args);
  expect(first.status, first.stderr).toBe(0);
  const bytes = await readFile(input.artifact, 'utf8');
  const artifact = await validateCatalogReleaseArtifact(JSON.parse(bytes));
  expect(
    artifact.batches.flat().filter((row) => row.kind === 'definition'),
  ).toEqual([]);
  expect(
    artifact.batches
      .flat()
      .find((row) => row.key === 'builtin:representative-class-catalog')
      ?.payload,
  ).toMatchObject({
    definitions: expect.arrayContaining([
      expect.objectContaining({ name: 'Fighter' }),
    ]),
  });
  expect(
    artifact.batches
      .flat()
      .find((row) => row.key === 'builtin:representative-archetype-catalog')
      ?.payload,
  ).toMatchObject({
    definitions: expect.arrayContaining([
      expect.objectContaining({ name: 'Archer' }),
      expect.objectContaining({ name: 'Scout' }),
    ]),
    sourceFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    compatibility: { schema: 'character-sheet-v1', calculation: 'facts-v1' },
  });
  expect(
    artifact.batches.flat().find((row) => row.key === 'builtin:casting-tables')
      ?.payload,
  ).toMatchObject({
    definitions: {
      version: 1,
      tables: {
        'prepared-full': {
          rows: expect.arrayContaining([
            {
              spellsPerDay: [
                3,
                1,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
              ],
            },
          ]),
        },
      },
      classes: { wizard: { ability: 'intelligence', record: 'book' } },
    },
    sourceFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    compatibility: { schema: 'character-sheet-v1', calculation: 'facts-v1' },
  });
  expect(
    artifact.batches
      .flat()
      .find((row) => row.key === 'builtin:representative-race-catalog')
      ?.payload,
  ).toMatchObject({
    definitions: expect.arrayContaining([
      expect.objectContaining({ name: 'Human' }),
      expect.objectContaining({ name: 'Elf Blood' }),
    ]),
    sourceFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    compatibility: { schema: 'character-sheet-v1', calculation: 'facts-v1' },
  });
  expect(
    artifact.batches.flat().find((row) => row.key === 'holds')?.payload,
  ).toMatchObject({ held: 1, gatePassed: true });
  expect(run(input.args).status).toBe(0);
  expect(await readFile(input.artifact, 'utf8')).toBe(bytes);
  let status: CatalogReleaseStatus | undefined;
  const adapter: CatalogReleaseCommandAdapter = {
    async begin({ manifest }) {
      status ??= {
        manifest,
        releaseNumber: 1,
        state: 'preparing',
        baseReleaseNumber: null,
        nextBatchIndex: 0,
        batchCount: manifest.batches.length,
        stagedRows: 0,
      };
      return status;
    },
    async writeBatch({ batchIndex, rows }) {
      if (!status) throw new Error('No candidate');
      status = {
        ...status,
        nextBatchIndex: batchIndex + 1,
        stagedRows: status.stagedRows + rows.length,
      };
      return status;
    },
    async finalize() {
      if (!status) throw new Error('No candidate');
      status = { ...status, state: 'prepared' };
      return status;
    },
    async inspect() {
      if (!status) throw new Error('No candidate');
      return status;
    },
  };
  const prepared = await runCatalogReleaseOperator({
    args: ['prepare', '--artifact', input.artifact],
    adapter,
  });
  expect(prepared).toMatchObject({
    state: 'prepared',
    nextBatchIndex: artifact.batches.length,
  });
  expect(
    await runCatalogReleaseOperator({
      args: ['inspect', '--number', '1'],
      adapter,
    }),
  ).toEqual(prepared);
  expect(run(['prepare', '--artifact', input.artifact]).stderr).toContain(
    '--deployment-name is required',
  );
  await writeFile(
    join(input.system, 'packs/feats/fixture.yaml'),
    JSON.stringify({
      _id: 'FixtureFeat',
      _key: '!items!FixtureFeat',
      name: 'Changed feat',
      type: 'feat',
      system: {},
    }),
  );
  const changed = run(input.args);
  expect(changed.status).toBe(1);
  expect(changed.stderr).toContain('already bound');
  expect(await readFile(input.artifact, 'utf8')).toBe(bytes);
});

it('gate failures write no release artifact and invoke no remote command', async () => {
  const input = await workspace();
  const args = input.args.map((value) =>
    value === input.system
      ? resolve('tests/fixtures/catalog/pf1')
      : value === input.content
        ? resolve('tests/fixtures/catalog/pf1-content')
        : value,
  );
  await expect(runCatalogReleaseOperator({ args })).rejects.toThrow(
    'gates failed',
  );
  await expect(readdir(join(input.root, 'output'))).rejects.toMatchObject({
    code: 'ENOENT',
  });
});

it('sends large batches over administrative HTTP with one fixed Write Gate epoch and bounded row inspection', async () => {
  const { vi } = await import('vitest');
  const input = await workspace();
  await runCatalogReleaseOperator({ args: input.args });
  const artifact = await validateCatalogReleaseArtifact(
    JSON.parse(await readFile(input.artifact, 'utf8')),
  );
  const keyFile = join(input.root, 'admin.key');
  await writeFile(keyFile, 'synthetic-admin-key');
  const initial: CatalogReleaseStatus = {
    manifest: artifact.manifest,
    releaseNumber: 1,
    state: 'preparing',
    baseReleaseNumber: null,
    nextBatchIndex: 0,
    batchCount: artifact.batches.length,
    stagedRows: 0,
  };
  let callIndex = 0;
  const requestBodies: string[] = [];
  const page = {
    page: [{ kind: 'report', key: 'holds', payload: { held: 1 } }],
    isDone: true,
    continueCursor: '',
  };
  const responses: unknown[] = [
    initial,
    ...artifact.batches.map((rows, index) => ({
      ...initial,
      nextBatchIndex: index + 1,
      stagedRows: artifact.batches
        .slice(0, index + 1)
        .reduce((sum, batch) => sum + batch.length, 0),
    })),
    { ...initial, state: 'prepared', nextBatchIndex: artifact.batches.length },
    page,
  ];
  vi.stubGlobal('fetch', async (_url: unknown, options: RequestInit) => {
    if (typeof options.body !== 'string')
      throw new Error('Expected HTTP JSON body');
    requestBodies.push(options.body);
    return new Response(
      JSON.stringify({ status: 'success', value: responses[callIndex++] }),
    );
  });
  const remote = [
    '--deployment-name',
    'synthetic-preview',
    '--deployment-url',
    'https://synthetic-preview.convex.cloud',
    '--target-kind',
    'preview',
    '--admin-key-file',
    keyFile,
  ];
  try {
    expect(
      await runCatalogReleaseOperator({
        args: [
          'prepare',
          '--artifact',
          input.artifact,
          '--write-epoch',
          '7',
          ...remote,
        ],
      }),
    ).toMatchObject({ state: 'prepared' });
    expect(requestBodies.some((body) => Buffer.byteLength(body) > 131072)).toBe(
      true,
    );
    expect(
      requestBodies.every((body) => !body.includes('synthetic-admin-key')),
    ).toBe(true);
    expect(requestBodies.every((body) => body.includes('"writeEpoch":7'))).toBe(
      true,
    );
    expect(
      await runCatalogReleaseOperator({
        args: [
          'inspect',
          '--number',
          '1',
          '--kind',
          'report',
          '--limit',
          '5',
          ...remote,
        ],
      }),
    ).toEqual(page);
    expect(requestBodies.at(-1)).toContain('"maximumBytesRead":512000');
  } finally {
    vi.unstubAllGlobals();
  }
});
