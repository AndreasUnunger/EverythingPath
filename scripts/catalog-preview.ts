import { mkdir, writeFile, realpath, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { importCatalog } from './catalog/import.ts';
import { appendConditionResources } from './catalog/conditions.ts';
import type { AdmissionArtifact } from './catalog/admission.ts';
import {
  assessCatalogAdmission,
  computeFingerprint,
} from './catalog/admission.ts';
import {
  reviewedAdmission,
  legalResources,
} from '../src/lib/catalog/reviewed-data.ts';
import { reviewedAdmissionSchema } from '../src/lib/catalog/admission-schema.ts';
import {
  resolveOutputPath,
  validateOutput,
  verifyInputs,
} from './catalog/operator.ts';
import { buildLegalPageData } from '../src/lib/catalog/legal-page-data.ts';

function parsePreviewArguments() {
  const { values } = parseArgs({
    options: {
      system: { type: 'string' },
      content: { type: 'string' },
      out: { type: 'string', default: '.catalog-preview' },
      attribution: { type: 'string' },
      curation: { type: 'string' },
      conditions: { type: 'boolean' },
      help: { type: 'boolean' },
      'allow-unverified-checkouts': { type: 'boolean' },
    },
    strict: true,
    allowPositionals: false,
  });
  if (values.help) {
    process.stdout.write(
      'Usage: pnpm catalog:preview --system PATH --content PATH [--out PATH] [--attribution PATH] [--curation PATH] [--conditions] [--allow-unverified-checkouts]\nInputs must be clean Git checkouts at the pinned commits. The override marks fixture/development output as unverified. --attribution supplies reviewed admission JSON instead of the committed evidence. --curation supplies note records instead of the committed overlay. --conditions includes locally authored CRB conditions and their fingerprinted resources. Admission and curation failures write reports and exit nonzero.\n',
    );
    return;
  }
  if (!values.system || !values.content) {
    throw new Error('Both --system PATH and --content PATH are required.');
  }
  if (!values.out.trim()) throw new Error('--out PATH must not be empty.');
  if (values.attribution !== undefined && !values.attribution.trim())
    throw new Error('--attribution PATH must not be empty.');
  if (values.curation !== undefined && !values.curation.trim())
    throw new Error('--curation PATH must not be empty.');
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
  const curationPath = await realpath(
    values.curation
      ? resolve(values.curation)
      : new URL('./catalog/reviewed-curation.json', import.meta.url),
  );
  await validateOutput({
    output,
    sources: [
      system,
      content,
      curationPath,
      ...(attributionPath ? [attributionPath] : []),
    ],
  });
  return { output, system, content, attributionPath, curationPath };
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
  curationPath,
}: {
  system: string;
  content: string;
  curationPath: string;
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
    curation: JSON.parse(await readFile(curationPath, 'utf8')),
  });
}

type CatalogArtifact = AdmissionArtifact;
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
    curation: result.curation,
    purpose: 'preview',
    inputVerification,
    inputs: result.catalog.inputs,
    localResources: result.catalog.localResources ?? [],
    extractionFingerprint: computeFingerprint(result),
    reviewedInputsFingerprint: computeFingerprint(reviewedInputs),
    legalResourcesFingerprint: computeFingerprint(legalResources),
    outstandingNotices: legalPage.outstandingNotices,
    outstandingResources: legalPage.outstandingResources,
  };
  const files = [
    [
      'curation.json',
      {
        ...result.curation,
        purpose: 'preview',
        inputVerification,
        inputs: result.catalog.inputs,
      },
    ],
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
  const extracted = await extractCatalog(paths);
  const result = values.conditions
    ? await appendConditionResources(extracted)
    : extracted;
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
