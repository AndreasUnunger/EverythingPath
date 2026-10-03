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
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import { runCapturedProcess } from '../../scripts/catalog/process';

const loader = fileURLToPath(import.meta.resolve('tsx'));
const fixtures = resolve('tests/fixtures/curation');
const temporary: string[] = [];
async function workspace() {
  const root = await mkdtemp(join(tmpdir(), 'curation-command-'));
  temporary.push(root);
  return root;
}
function run(command: 'curate' | 'preview', args: string[]) {
  return runCapturedProcess({
    command: process.execPath,
    args: [
      '--import',
      loader,
      resolve(`scripts/catalog-${command}.ts`),
      ...args,
    ],
  });
}
function inputs(root = fixtures) {
  return [
    '--system',
    join(root, 'pf1'),
    '--content',
    join(root, 'pf1-content'),
    '--allow-unverified-checkouts',
  ];
}
afterEach(async () => {
  await Promise.all(
    temporary
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

it('writes itemised preview failures before exiting nonzero, then drafts, resumes and previews working records', async () => {
  const root = await workspace();
  const output = join(root, 'preview');
  const missing = run('preview', [...inputs(), '--out', output]);
  expect(missing.status).toBe(1);
  expect(await readdir(output)).toEqual([
    'admission.json',
    'catalog.json',
    'comparison.json',
    'curation.json',
    'unsupported.json',
  ]);
  expect(
    JSON.parse(await readFile(join(output, 'curation.json'), 'utf8')),
  ).toMatchObject({ passed: false, summary: { missing: 10 } });
  const drafts = join(root, 'drafts');
  const first = run('curate', [...inputs(), '--out', drafts]);
  expect(first.status).toBe(0);
  expect(first.stdout).toContain('10 new drafts');
  const records = join(drafts, 'records.json');
  const original = await readFile(records, 'utf8');
  const resume = run('curate', [
    ...inputs(),
    '--records',
    records,
    '--out',
    drafts,
  ]);
  expect(resume.status).toBe(0);
  expect(resume.stdout).toContain('0 new drafts');
  expect(await readFile(records, 'utf8')).toBe(original);
  const covered = run('preview', [
    ...inputs(),
    '--curation',
    records,
    '--out',
    output,
  ]);
  expect(covered.status).toBe(0);
  const report = JSON.parse(
    await readFile(join(output, 'admission.json'), 'utf8'),
  );
  expect(report).toMatchObject({
    passed: true,
    failures: [],
    curation: { passed: true, summary: { drafted: 10, missing: 0 } },
  });
  const before = await readFile(join(output, 'curation.json'), 'utf8');
  expect(
    run('preview', [...inputs(), '--curation', records, '--out', output])
      .status,
  ).toBe(0);
  expect(await readFile(join(output, 'curation.json'), 'utf8')).toBe(before);
  const descriptions = join(root, 'descriptions');
  const prose = run('curate', [
    ...inputs(),
    '--records',
    records,
    '--descriptions',
    '--out',
    descriptions,
  ]);
  expect(prose.status).toBe(0);
  expect(
    JSON.parse(await readFile(join(descriptions, 'curation.json'), 'utf8')),
  ).toMatchObject({
    pass: 'descriptions',
    summary: {
      required: 10,
      drafted: 10,
      checked: 0,
      missing: 0,
      descriptions: { candidates: 1, drafted: 1, checked: 0 },
    },
    added: [
      expect.objectContaining({
        externalKey: 'pf1/Prose',
        kind: 'description',
      }),
    ],
  });
}, 60_000);

it.each([
  'source',
  'source alias',
  'populated output',
  'symlink report',
  'input records',
])(
  'protects inputs and unrelated files when output is %s',
  async (destination) => {
    const root = await workspace();
    const source = join(root, 'source');
    await cp(fixtures, source, { recursive: true });
    const numeric = join(source, 'pf1/packs/feats/Numeric.yaml');
    const original = await readFile(numeric, 'utf8');
    let output = join(root, 'output');
    const extra: string[] = [];
    if (destination === 'source') output = join(source, 'pf1/generated');
    if (destination === 'source alias') {
      await symlink(join(source, 'pf1'), join(root, 'alias'));
      output = join(root, 'alias/generated');
    }
    if (destination === 'populated output') {
      await mkdir(output);
      await writeFile(join(output, 'keep.txt'), 'Preserve this');
    }
    if (destination === 'symlink report') {
      await mkdir(output);
      await symlink(numeric, join(output, 'records.json'));
    }
    if (destination === 'input records') {
      await mkdir(output);
      const recordFile = join(output, 'curation.json');
      await writeFile(recordFile, '{"records":[]}');
      extra.push('--records', recordFile);
    }
    const result = run('curate', [
      ...inputs(source),
      '--out',
      output,
      ...extra,
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/output/i);
    expect(await readFile(numeric, 'utf8')).toBe(original);
  },
  20_000,
);

it('rejects unpinned inputs, empty arguments and invalid records before writing output', async () => {
  const root = await workspace();
  const output = join(root, 'output');
  expect(
    run('curate', [
      '--system',
      join(fixtures, 'pf1'),
      '--content',
      join(fixtures, 'pf1-content'),
      '--out',
      output,
    ]).status,
  ).toBe(1);
  expect(
    run('curate', [...inputs(), '--records', '', '--out', output]).status,
  ).toBe(1);
  const malformed = join(root, 'malformed.json');
  await writeFile(malformed, '{"records":[{}]}');
  expect(
    run('curate', [...inputs(), '--records', malformed, '--out', output])
      .status,
  ).toBe(1);
  await expect(readdir(output)).rejects.toMatchObject({ code: 'ENOENT' });
  const help = run('curate', ['--help']);
  expect(help.status).toBe(0);
  expect(help.stdout).toContain('--descriptions');
}, 20_000);

it('writes draft diagnostics and keeps unresolved mechanics out of the preview', async () => {
  const root = await workspace();
  const source = join(root, 'source');
  await cp(fixtures, source, { recursive: true });
  await writeFile(
    join(source, 'pf1/packs/feats/Numeric.yaml'),
    JSON.stringify({
      _id: 'Numeric',
      _key: '!items!Numeric',
      name: 'Numeric',
      type: 'feat',
      system: {
        contextNotes: [
          {
            target: 'allSavingThrows',
            text: 'Unparsed +[[2]] bonus vs poison',
          },
        ],
      },
    }),
  );
  const drafts = join(root, 'drafts');
  expect(run('curate', [...inputs(source), '--out', drafts]).status).toBe(0);
  const records = join(drafts, 'records.json');
  const report = JSON.parse(
    await readFile(join(drafts, 'curation.json'), 'utf8'),
  );
  expect(report).toMatchObject({
    passed: false,
    summary: { missing: 0 },
    unresolvedMechanics: [
      expect.objectContaining({
        externalKey: 'pf1/Numeric',
        diagnostics: [
          {
            kind: 'unresolved',
            text: expect.stringContaining('Unresolved numeric mechanics'),
          },
        ],
      }),
    ],
  });
  const preview = join(root, 'preview');
  expect(
    run('preview', [...inputs(source), '--curation', records, '--out', preview])
      .status,
  ).toBe(1);
  const admission = JSON.parse(
    await readFile(join(preview, 'admission.json'), 'utf8'),
  );
  expect(admission.failures).toContainEqual({
    externalKey: 'pf1/Numeric',
    reason: expect.stringContaining('Unresolved numeric mechanics'),
  });
  const catalog = JSON.parse(
    await readFile(join(preview, 'catalog.json'), 'utf8'),
  );
  expect(
    catalog.entries.find(
      (entry: { externalKey: string }) => entry.externalKey === 'pf1/Numeric',
    ),
  ).toMatchObject({ modifiers: [] });
}, 20_000);
