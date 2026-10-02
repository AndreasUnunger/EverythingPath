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
import {
  assessCatalogAdmission,
  computeFingerprint,
} from './catalog/admission.ts';
import {
  reviewedAdmission,
  legalResources,
} from '../src/lib/catalog/reviewed-data.ts';
import { reviewedAdmissionSchema } from '../src/lib/catalog/admission-schema.ts';
import { pins, type Repository } from './catalog/inventory.ts';
import { runCapturedProcess } from './catalog/process.ts';
import { buildLegalPageData } from '../src/lib/catalog/legal-page-data.ts';

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
      'admission.json',
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

function parsePreviewArguments() {
  const { values } = parseArgs({
    options: {
      system: { type: 'string' },
      content: { type: 'string' },
      out: { type: 'string', default: '.catalog-preview' },
      attribution: { type: 'string' },
      help: { type: 'boolean' },
      'allow-unverified-checkouts': { type: 'boolean' },
    },
    strict: true,
    allowPositionals: false,
  });
  if (values.help) {
    process.stdout.write(
      'Usage: pnpm catalog:preview --system PATH --content PATH [--out PATH] [--attribution PATH] [--allow-unverified-checkouts]\nInputs must be clean Git checkouts at the pinned commits. The override marks fixture/development output as unverified. --attribution supplies reviewed admission JSON instead of the committed evidence. Admission failures write reports and exit nonzero.\n',
    );
    return;
  }
  if (!values.system || !values.content) {
    throw new Error('Both --system PATH and --content PATH are required.');
  }
  if (!values.out.trim()) throw new Error('--out PATH must not be empty.');
  if (values.attribution !== undefined && !values.attribution.trim())
    throw new Error('--attribution PATH must not be empty.');
  return { ...values, system: values.system, content: values.content };
}

async function resolvePreviewPaths(
  values: NonNullable<ReturnType<typeof parsePreviewArguments>>,
) {
  const output = await resolveOutputPath(resolve(values.out));
  const system = await realpath(resolve(values.system));
  const content = await realpath(resolve(values.content));
  const attributionPath = values.attribution
    ? await realpath(resolve(values.attribution))
    : undefined;
  await validateOutput({
    output,
    sources: [system, content, ...(attributionPath ? [attributionPath] : [])],
  });
  return { output, system, content, attributionPath };
}

async function verifyInputs({
  system,
  content,
  allowUnverified,
}: {
  system: string;
  content: string;
  allowUnverified: boolean;
}) {
  return allowUnverified
    ? { status: 'unverified' as const }
    : {
        status: 'verified' as const,
        repositories: [
          await verifyCheckout({ repository: 'pf1', root: system }),
          await verifyCheckout({ repository: 'pf1-content', root: content }),
        ],
      };
}

async function loadReviewedInputs(attributionPath: string | undefined) {
  return attributionPath
    ? reviewedAdmissionSchema.parse(
        JSON.parse(await readFile(attributionPath, 'utf8')),
      )
    : reviewedAdmission;
}

async function extractCatalog({
  system,
  content,
}: {
  system: string;
  content: string;
}) {
  const remaps: unknown = JSON.parse(
    await readFile(
      new URL('./catalog/reviewed-remaps.json', import.meta.url),
      'utf8',
    ),
  );
  return importCatalog({
    systemPath: system,
    contentPath: content,
    remaps,
  });
}

type CatalogArtifact = Awaited<ReturnType<typeof importCatalog>>;
function buildPreviewReports({
  result,
  reviewedInputs,
  inputVerification,
}: {
  result: CatalogArtifact;
  reviewedInputs: Awaited<ReturnType<typeof loadReviewedInputs>>;
  inputVerification: Awaited<ReturnType<typeof verifyInputs>>;
}) {
  const gate = assessCatalogAdmission({ artifact: result, ...reviewedInputs });
  const legalPage = buildLegalPageData({
    registry: reviewedInputs.registry,
    resources: legalResources,
    requiredNotices: gate.requiredNotices,
    permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
  });
  const admission = {
    ...gate,
    purpose: 'preview',
    inputVerification,
    inputs: result.catalog.inputs,
    extractionFingerprint: computeFingerprint(result),
    reviewedInputsFingerprint: computeFingerprint(reviewedInputs),
    legalResourcesFingerprint: computeFingerprint(legalResources),
    outstandingNotices: legalPage.outstandingNotices,
    outstandingResources: legalPage.outstandingResources,
  };
  const files = [
    ['catalog.json', { ...result.catalog, inputVerification }],
    ['unsupported.json', result.unsupported],
    ['comparison.json', result.comparison],
    ['admission.json', admission],
  ] as const;
  return { admission, files };
}

async function writePreviewReports({
  files,
  output,
}: {
  files: ReturnType<typeof buildPreviewReports>['files'];
  output: string;
}) {
  const serialized = files.map(
    ([name, report]) => [name, JSON.stringify(report, null, 2) + '\n'] as const,
  );
  await mkdir(output, { recursive: true });
  await Promise.all(
    serialized.map(([name, json]) => writeFile(join(output, name), json)),
  );
}

function reportPreview({
  result,
  admission,
  output,
}: {
  result: CatalogArtifact;
  admission: ReturnType<typeof buildPreviewReports>['admission'];
  output: string;
}) {
  process.stdout.write(
    `Wrote ${result.catalog.entries.length} catalog entries and ${result.catalog.resources.length} resources with reports to ${output}\n`,
  );
  process.stdout.write(
    `Admission: ${admission.admitted.length} admitted, ${admission.held.length} held, ${admission.dependentOmissions.length} dependent omissions, ${admission.retainedExceptions.length} retained exceptions, ${admission.failures.length} failures.\n`,
  );
  if (!admission.passed) {
    process.stderr.write(
      'Catalog admission failed; inspect admission.json for individually reported failures.\n',
    );
    process.exitCode = 1;
  }
}

async function main() {
  const values = parsePreviewArguments();
  if (!values) return;
  const paths = await resolvePreviewPaths(values);
  const inputVerification = await verifyInputs({
    ...paths,
    allowUnverified: values['allow-unverified-checkouts'] === true,
  });
  const result = await extractCatalog(paths);
  const reviewedInputs = await loadReviewedInputs(paths.attributionPath);
  const { admission, files } = buildPreviewReports({
    result,
    reviewedInputs,
    inputVerification,
  });
  await writePreviewReports({ files, output: paths.output });
  reportPreview({ result, admission, output: paths.output });
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
