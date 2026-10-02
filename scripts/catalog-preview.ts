import {
  mkdir,
  writeFile,
  realpath,
  readdir,
  readFile,
} from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { importCatalog } from './catalog/import.ts';
import { pins, type Repository } from './catalog/inventory.ts';
import { runCapturedProcess } from './catalog/process.ts';

async function verifyCheckout({
  repository,
  root,
}: {
  repository: Repository;
  root: string;
}) {
  function runGit(...args: string[]) {
    const result = runCapturedProcess({
      command: 'git',
      args: ['-C', root, ...args],
    });
    if (result.status !== 0)
      throw new Error(
        `Cannot verify ${repository} checkout: ${result.stderr.trim()}`,
      );
    return result.stdout.trim();
  }
  if ((await realpath(runGit('rev-parse', '--show-toplevel'))) !== root) {
    throw new Error(
      `${repository} path must be the root of its upstream Git checkout.`,
    );
  }
  const commit = runGit('rev-parse', 'HEAD');
  if (commit !== pins[repository].commit) {
    throw new Error(
      `${repository} checkout must be at pinned ${pins[repository].tag} (${pins[repository].commit}).`,
    );
  }
  if (
    runGit(
      'status',
      '--porcelain',
      '--untracked-files=all',
      '--',
      pins[repository].manifest,
      pins[repository].directory,
    )
  ) {
    throw new Error(
      `${repository} checkout has modified or untracked catalog input files.`,
    );
  }
  const ignored = runGit(
    'ls-files',
    '--others',
    '--ignored',
    '--exclude-standard',
    '-z',
    '--',
    pins[repository].manifest,
    pins[repository].directory,
  ).split('\0');
  if (
    ignored.some(
      (path) => path === pins[repository].manifest || /\.ya?ml$/.test(path),
    )
  ) {
    throw new Error(`${repository} checkout has ignored catalog input files.`);
  }
  return { repository, commit };
}

function isMissing(error: unknown) {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

async function resolveOutputPath(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch (error) {
    if (!isMissing(error)) throw error;
    return join(await resolveOutputPath(dirname(path)), basename(path));
  }
}

function containsPath({ parent, child }: { parent: string; child: string }) {
  const difference = relative(parent, child);
  return (
    difference === '' ||
    (difference !== '..' && !difference.startsWith(`..${sep}`))
  );
}

async function validateOutput({
  output,
  sources,
}: {
  output: string;
  sources: string[];
}) {
  if (
    sources.some(
      (source) =>
        containsPath({ parent: source, child: output }) ||
        containsPath({ parent: output, child: source }),
    )
  ) {
    throw new Error(
      'Output directory must not overlap either source checkout.',
    );
  }
  try {
    const existing = await readdir(output, { withFileTypes: true });
    const reports = new Set([
      'catalog.json',
      'unsupported.json',
      'comparison.json',
    ]);
    if (existing.some((file) => !reports.has(file.name) || !file.isFile())) {
      throw new Error(
        'Output directory must be empty or contain only regular catalog preview report files.',
      );
    }
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      system: { type: 'string' },
      content: { type: 'string' },
      out: { type: 'string', default: '.catalog-preview' },
      help: { type: 'boolean' },
      'allow-unverified-checkouts': { type: 'boolean' },
    },
    strict: true,
    allowPositionals: false,
  });
  if (values.help) {
    process.stdout.write(
      'Usage: pnpm catalog:preview --system PATH --content PATH [--out PATH] [--allow-unverified-checkouts]\nInputs must be clean Git checkouts at the pinned commits. The override marks fixture/development output as unverified.\n',
    );
    return;
  }
  if (!values.system || !values.content) {
    throw new Error('Both --system PATH and --content PATH are required.');
  }
  if (!values.out.trim()) throw new Error('--out PATH must not be empty.');
  const output = await resolveOutputPath(resolve(values.out));
  const system = await realpath(resolve(values.system));
  const content = await realpath(resolve(values.content));
  await validateOutput({ output, sources: [system, content] });
  const inputVerification = values['allow-unverified-checkouts']
    ? { status: 'unverified' as const }
    : {
        status: 'verified' as const,
        repositories: [
          await verifyCheckout({ repository: 'pf1', root: system }),
          await verifyCheckout({ repository: 'pf1-content', root: content }),
        ],
      };
  const remaps: unknown = JSON.parse(
    await readFile(
      new URL('./catalog/reviewed-remaps.json', import.meta.url),
      'utf8',
    ),
  );
  const result = await importCatalog({
    systemPath: system,
    contentPath: content,
    remaps,
  });
  const files = [
    ['catalog.json', { ...result.catalog, inputVerification }],
    ['unsupported.json', result.unsupported],
    ['comparison.json', result.comparison],
  ] as const;
  const serialized = files.map(
    ([name, report]) => [name, JSON.stringify(report, null, 2) + '\n'] as const,
  );
  await mkdir(output, { recursive: true });
  await Promise.all(
    serialized.map(([name, json]) => writeFile(join(output, name), json)),
  );
  process.stdout.write(
    `Wrote ${result.catalog.entries.length} catalog entries and ${result.catalog.resources.length} resources with reports to ${output}\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
