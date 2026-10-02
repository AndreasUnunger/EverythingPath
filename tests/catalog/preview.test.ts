// @vitest-environment node
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { runCapturedProcess } from '../../scripts/catalog/process';

const script = resolve('scripts/catalog-preview.ts');
const fixtures = resolve('tests/fixtures/catalog');
const loader = fileURLToPath(import.meta.resolve('tsx'));
const temporary: string[] = [];

async function createWorkspace() {
  const root = await mkdtemp(join(tmpdir(), 'catalog-preview-'));
  temporary.push(root);
  return root;
}

function runPreview({
  args,
  cwd = process.cwd(),
}: {
  args: string[];
  cwd?: string;
}) {
  return runCapturedProcess({
    command: process.execPath,
    args: ['--import', loader, script, ...args],
    cwd,
  });
}

function getInputArgs() {
  return [
    '--system',
    join(fixtures, 'pf1'),
    '--content',
    join(fixtures, 'pf1-content'),
  ];
}

afterEach(async () => {
  await Promise.all(
    temporary
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

it('writes an inspectable catalog and both reports from pinned checkout fixtures', async () => {
  const root = await createWorkspace();
  const output = join(root, 'preview');
  const result = runPreview({
    args: [...getInputArgs(), '--allow-unverified-checkouts', '--out', output],
  });
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
  expect(await readdir(output)).toEqual([
    'catalog.json',
    'comparison.json',
    'unsupported.json',
  ]);
  const catalog = JSON.parse(
    await readFile(join(output, 'catalog.json'), 'utf8'),
  );
  expect(catalog.entries).toContainEqual(
    expect.objectContaining({
      externalKey: 'pf1/e6IaBxKgMxy1yKlr',
      name: 'Human',
    }),
  );
  for (const report of ['comparison', 'unsupported']) {
    expect(
      JSON.parse(await readFile(join(output, `${report}.json`), 'utf8')),
    ).toBeDefined();
  }
  expect(result.stdout).toContain(output);
  expect(result.stdout).toContain('Wrote 41 catalog entries and 20 resources');
});

it('requires exact pinned Git checkouts unless unverified input is explicitly requested', async () => {
  const root = await createWorkspace();
  const output = join(root, 'preview');
  const strict = runPreview({ args: [...getInputArgs(), '--out', output] });
  expect(strict.status).not.toBe(0);
  expect(strict.stderr).toContain('checkout');
  expect(await readdir(root)).toEqual([]);
  const unverified = runPreview({
    args: [...getInputArgs(), '--allow-unverified-checkouts', '--out', output],
  });
  expect(unverified.status).toBe(0);
  const catalog = JSON.parse(
    await readFile(join(output, 'catalog.json'), 'utf8'),
  );
  expect(catalog.inputVerification).toEqual({ status: 'unverified' });
});

it.each(
  [
    [],
    ['--system', join(fixtures, 'pf1')],
    [...getInputArgs(), '--unknown'],
    [...getInputArgs(), '--out'],
    [...getInputArgs(), '--out', ''],
    [...getInputArgs(), '--system'],
    [...getInputArgs(), 'unexpected-positional'],
    [
      '--system',
      '/missing/catalog-checkout',
      '--content',
      join(fixtures, 'pf1-content'),
    ],
  ].map((args) => ({ args })),
)(
  'rejects invalid arguments or missing checkouts without output: $args',
  async ({ args }) => {
    const root = await createWorkspace();
    const result = runPreview({
      args: ['--allow-unverified-checkouts', ...args],
      cwd: root,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).not.toBe('');
    expect(await readdir(root)).toEqual([]);
  },
);

it.each([
  'source',
  'source-symlink',
  'source-parent',
  'populated-directory',
  'report-symlink',
])(
  'refuses unsafe output destinations without changing input or unrelated files: %s',
  async (destination) => {
    const root = await createWorkspace();
    const sources = join(root, 'sources');
    await cp(fixtures, sources, { recursive: true });
    const human = join(sources, 'pf1/packs/races/human.e6IaBxKgMxy1yKlr.yaml');
    const originalHuman = await readFile(human, 'utf8');
    let output = join(root, 'output');
    if (destination === 'source')
      output = join(sources, 'pf1', 'generated', 'preview');
    if (destination === 'source-symlink') {
      await symlink(join(sources, 'pf1-content'), join(root, 'source-alias'));
      output = join(root, 'source-alias', 'generated', 'preview');
    }
    if (destination === 'source-parent') output = root;
    if (destination === 'populated-directory') {
      await mkdir(output);
      await writeFile(join(output, 'notes.txt'), 'keep these notes');
    }
    if (destination === 'report-symlink') {
      await mkdir(output);
      await symlink(human, join(output, 'catalog.json'));
    }
    const result = runPreview({
      args: [
        '--system',
        join(sources, 'pf1'),
        '--content',
        join(sources, 'pf1-content'),
        '--allow-unverified-checkouts',
        '--out',
        output,
      ],
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/output/i);
    expect(await readFile(human, 'utf8')).toBe(originalHuman);
    if (destination === 'populated-directory') {
      expect(await readdir(output)).toEqual(['notes.txt']);
      expect(await readFile(join(output, 'notes.txt'), 'utf8')).toBe(
        'keep these notes',
      );
    }
    await expect(
      readFile(join(output, 'unsupported.json')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  },
);

it('uses the default output directory and preserves prior reports when a later import fails', async () => {
  const root = await createWorkspace();
  const sources = join(root, 'sources');
  await cp(fixtures, sources, { recursive: true });
  const args = [
    '--system',
    join(sources, 'pf1'),
    '--content',
    join(sources, 'pf1-content'),
    '--allow-unverified-checkouts',
  ];
  expect(runPreview({ args, cwd: root }).status).toBe(0);
  const output = join(root, '.catalog-preview');
  const names = await readdir(output);
  const original = await Promise.all(
    names.map((name) => readFile(join(output, name), 'utf8')),
  );
  expect(runPreview({ args, cwd: root }).status).toBe(0);
  const manifestPath = join(sources, 'pf1-content/module.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  await writeFile(
    manifestPath,
    JSON.stringify({ ...manifest, version: '12.0.0' }),
  );
  const failed = runPreview({ args, cwd: root });
  expect(failed.status).not.toBe(0);
  expect(failed.stderr).toContain('major');
  expect(
    await Promise.all(
      names.map((name) => readFile(join(output, name), 'utf8')),
    ),
  ).toEqual(original);
  const absent = join(root, 'failed-output');
  expect(
    runPreview({ args: [...args, '--out', absent], cwd: root }).status,
  ).not.toBe(0);
  await expect(readdir(absent)).rejects.toMatchObject({ code: 'ENOENT' });
});

it('describes required paths and the unverified override without importing or writing', async () => {
  const root = await createWorkspace();
  const help = runPreview({ args: ['--help'], cwd: root });
  expect(help.status).toBe(0);
  expect(help.stderr).toBe('');
  expect(help.stdout).toContain('--system PATH --content PATH');
  expect(help.stdout).toContain('--allow-unverified-checkouts');
  expect(await readdir(root)).toEqual([]);
});
