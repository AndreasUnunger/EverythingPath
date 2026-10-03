import { readFile, realpath, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { importCatalog } from './import.ts';
import { createCatalogRelease, serializeCatalogRelease } from './release.ts';
import { catalogImplementationInputs } from './release-inputs.ts';
import {
  runCatalogReleaseCommand,
  type CatalogReleaseCommandAdapter,
  type CatalogReleaseStatus,
} from './release-command.ts';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import { verifyInputs, resolveOutputPath, validateOutput } from './operator.ts';
import {
  parseReleaseJson,
  isObject,
  isReleaseRowKind,
  type ReleaseJson,
  type ReleaseRow,
  MAX_RELEASE_BATCH_ROWS,
  MAX_RELEASE_BATCH_BYTES,
  releaseFingerprint,
  validateCatalogReleaseArtifact,
  validateCatalogReleaseManifest,
} from '../../src/lib/catalog/release-schema.ts';
import {
  reviewedAdmission,
  legalResources as defaultLegalResources,
} from '../../src/lib/catalog/reviewed-data.ts';
import { reviewedAdmissionSchema } from '../../src/lib/catalog/admission-schema.ts';
import { legalResourcesSchema } from '../../src/lib/catalog/legal-types.ts';

export const catalogReleaseUsage =
  'Usage: pnpm catalog:release build --number N --schema ID --calculation ID --system PATH --content PATH --artifact PATH [--previous PATH] [--attribution PATH] [--curation PATH] [--remaps PATH] [--legal PATH] [--rule-resources PATH] [--allow-unverified-checkouts]\n       pnpm catalog:release prepare --artifact PATH --deployment-name NAME --deployment-url URL --target-kind KIND --admin-key-file PATH [--write-epoch N]\n       pnpm catalog:release inspect --number N --deployment-name NAME --deployment-url URL --target-kind KIND --admin-key-file PATH [--kind KIND --cursor CURSOR --limit N]\nPreparation is private and never activates a release. Remote commands never push code.\n';

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'));
}
function positiveNumber(value: string | undefined): number {
  if (
    !value ||
    !/^[1-9]\d*$/.test(value) ||
    !Number.isSafeInteger(Number(value))
  )
    throw new Error('--number must be a positive integer.');
  return Number(value);
}
function required(value: string | undefined, name: string): string {
  if (!value?.trim()) throw new Error(`--${name} is required.`);
  return value;
}

function parseStatus(value: unknown): CatalogReleaseStatus {
  if (
    !isObject(value) ||
    !('manifest' in value) ||
    !('state' in value) ||
    !('releaseNumber' in value) ||
    !('baseReleaseNumber' in value) ||
    !('nextBatchIndex' in value) ||
    !('batchCount' in value) ||
    !('stagedRows' in value)
  )
    throw new Error('Invalid remote release status.');
  const {
    state,
    releaseNumber,
    baseReleaseNumber,
    nextBatchIndex,
    batchCount,
    stagedRows,
  } = value;
  if (
    (state !== 'preparing' && state !== 'prepared') ||
    typeof releaseNumber !== 'number' ||
    (baseReleaseNumber !== null && typeof baseReleaseNumber !== 'number') ||
    typeof nextBatchIndex !== 'number' ||
    typeof batchCount !== 'number' ||
    typeof stagedRows !== 'number' ||
    ![releaseNumber, nextBatchIndex, batchCount, stagedRows].every(
      Number.isSafeInteger,
    )
  )
    throw new Error('Invalid remote release status fields.');
  return {
    releaseNumber,
    state,
    baseReleaseNumber,
    nextBatchIndex,
    batchCount,
    stagedRows,
    manifest: validateCatalogReleaseManifest(value.manifest),
  };
}
type AdministrativeHttpClient = {
  setAdminAuth(key: string): void;
  function(
    reference: ReturnType<typeof makeFunctionReference>,
    componentPath: undefined,
    args: Record<string, ReleaseJson>,
  ): Promise<unknown>;
};
function isAdministrativeHttpClient(
  client: unknown,
): client is AdministrativeHttpClient {
  // Convex strips these internal CLI methods from the public declaration file.
  // Validate the installed runtime before crossing the same admin seam as its CLI.
  return (
    isObject(client) &&
    'setAdminAuth' in client &&
    typeof client.setAdminAuth === 'function' &&
    'function' in client &&
    typeof client.function === 'function'
  );
}
async function createRemoteAdapter(values: {
  deploymentName: string;
  deploymentUrl: string;
  adminKeyFile: string;
  targetKind: string;
}): Promise<CatalogReleaseCommandAdapter> {
  if (!['preview', 'development', 'production'].includes(values.targetKind))
    throw new Error(
      '--target-kind must be preview, development or production.',
    );
  if (
    !/^[a-z0-9-]+$/.test(values.deploymentName) ||
    values.deploymentUrl !== `https://${values.deploymentName}.convex.cloud`
  )
    throw new Error(
      'Deployment URL must match the explicitly named deployment.',
    );
  const keyPath = await realpath(resolve(values.adminKeyFile));
  if (keyPath.split(/[\\/]/).some((part) => part.startsWith('.env')))
    throw new Error('Admin key file must not be an environment file.');
  const key = (await readFile(keyPath, 'utf8')).trim();
  if (!key) throw new Error('Admin key file is empty.');
  const client = new ConvexHttpClient(values.deploymentUrl, { logger: false });
  if (!isAdministrativeHttpClient(client))
    throw new Error(
      'Installed Convex client does not support administrative commands.',
    );
  const adminClient: AdministrativeHttpClient = client;
  adminClient.setAdminAuth(key);
  async function invokeReleaseEndpoint(endpoint: string, args: unknown) {
    const parsed = parseReleaseJson(args);
    if (!isObject(parsed))
      throw new Error('Invalid release command arguments.');
    return await adminClient.function(
      makeFunctionReference(`catalogRelease:${endpoint}`),
      undefined,
      parsed,
    );
  }
  return {
    begin: async (args) =>
      parseStatus(await invokeReleaseEndpoint('begin', args)),
    writeBatch: async (args) =>
      parseStatus(await invokeReleaseEndpoint('writeBatch', args)),
    finalize: async (args) =>
      parseStatus(await invokeReleaseEndpoint('finalize', args)),
    inspect: async (args) =>
      parseStatus(await invokeReleaseEndpoint('inspect', args)),
    inspectRows: (args) => invokeReleaseEndpoint('inspectRows', args),
  };
}

function parseOperatorArguments(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    strict: true,
    allowPositionals: true,
    options: {
      number: { type: 'string' },
      schema: { type: 'string' },
      calculation: { type: 'string' },
      system: { type: 'string' },
      content: { type: 'string' },
      artifact: { type: 'string' },
      previous: { type: 'string' },
      attribution: { type: 'string' },
      curation: { type: 'string' },
      remaps: { type: 'string' },
      legal: { type: 'string' },
      'rule-resources': { type: 'string' },
      'deployment-name': { type: 'string' },
      'deployment-url': { type: 'string' },
      'admin-key-file': { type: 'string' },
      'target-kind': { type: 'string' },
      'write-epoch': { type: 'string' },
      kind: { type: 'string' },
      cursor: { type: 'string' },
      limit: { type: 'string' },
      'allow-unverified-checkouts': { type: 'boolean' },
      help: { type: 'boolean' },
    },
  });
  return { values, positionals };
}
type OperatorValues = ReturnType<typeof parseOperatorArguments>['values'];

function parseWriteEpoch(value: string | undefined) {
  const writeEpoch = value === undefined ? 0 : Number(value);
  if (
    value !== undefined &&
    (!/^\d+$/.test(value) || !Number.isSafeInteger(writeEpoch))
  )
    throw new Error('--write-epoch must be a nonnegative integer.');
  return writeEpoch;
}

async function resolveRemoteAdapter(
  values: OperatorValues,
  adapter: CatalogReleaseCommandAdapter | undefined,
) {
  if (adapter) return adapter;
  return createRemoteAdapter({
    deploymentName: required(values['deployment-name'], 'deployment-name'),
    deploymentUrl: required(values['deployment-url'], 'deployment-url'),
    adminKeyFile: required(values['admin-key-file'], 'admin-key-file'),
    targetKind: required(values['target-kind'], 'target-kind'),
  });
}

export async function runCatalogReleaseOperator({
  args,
  adapter,
}: {
  args: string[];
  adapter?: CatalogReleaseCommandAdapter;
}): Promise<unknown> {
  const { values, positionals } = parseOperatorArguments(args);
  if (values.help) return { usage: catalogReleaseUsage };
  if (
    positionals.length !== 1 ||
    !['build', 'prepare', 'inspect'].includes(positionals[0] ?? '')
  )
    throw new Error(catalogReleaseUsage);
  const writeEpoch = parseWriteEpoch(values['write-epoch']);
  const command = positionals[0];
  if (command === 'inspect') return inspectRelease(values, adapter);
  const artifactPath = await resolveOutputPath(
    resolve(required(values.artifact, 'artifact')),
  );
  if (command === 'prepare')
    return prepareRelease(values, artifactPath, adapter, writeEpoch);
  return buildReleaseArtifact(values, artifactPath);
}

async function inspectRelease(
  values: OperatorValues,
  adapter: CatalogReleaseCommandAdapter | undefined,
) {
  const selectedAdapter = await resolveRemoteAdapter(values, adapter);
  const releaseNumber = positiveNumber(values.number);
  if (values.kind === undefined)
    return runCatalogReleaseCommand({
      command: { kind: 'inspect', releaseNumber },
      adapter: selectedAdapter,
    });
  const kind = parseRowKind(values.kind);
  const numItems =
    values.limit === undefined
      ? MAX_RELEASE_BATCH_ROWS
      : positiveNumber(values.limit);
  if (numItems > MAX_RELEASE_BATCH_ROWS)
    throw new Error('--limit exceeds the inspection row limit.');
  if (!selectedAdapter.inspectRows)
    throw new Error('Adapter does not support release row inspection.');
  return selectedAdapter.inspectRows({
    releaseNumber,
    kind,
    paginationOpts: {
      cursor: values.cursor ?? null,
      numItems,
      maximumRowsRead: MAX_RELEASE_BATCH_ROWS,
      maximumBytesRead: MAX_RELEASE_BATCH_BYTES,
    },
  });
}

async function prepareRelease(
  values: OperatorValues,
  artifactPath: string,
  adapter: CatalogReleaseCommandAdapter | undefined,
  writeEpoch: number,
) {
  const artifact = await validateCatalogReleaseArtifact(
    await readJson(artifactPath),
  );
  return runCatalogReleaseCommand({
    command: { kind: 'prepare', artifact },
    writeEpoch,
    adapter: await resolveRemoteAdapter(values, adapter),
  });
}

async function resolveBuildInputPaths(
  values: OperatorValues,
  artifactPath: string,
) {
  const system = await realpath(resolve(required(values.system, 'system')));
  const content = await realpath(resolve(required(values.content, 'content')));
  const remapPath = await realpath(
    values.remaps
      ? resolve(values.remaps)
      : new URL('./reviewed-remaps.json', import.meta.url),
  );
  const curationPath = await realpath(
    values.curation
      ? resolve(values.curation)
      : new URL('./reviewed-curation.json', import.meta.url),
  );
  const externalPaths = await Promise.all(
    [
      values.attribution,
      values.legal,
      values.previous,
      values['rule-resources'],
    ]
      .filter((path): path is string => path !== undefined)
      .map((path) => realpath(resolve(path))),
  );
  await validateOutput({
    output: dirname(artifactPath),
    sources: [system, content, remapPath, curationPath, ...externalPaths],
    reports: [artifactPath.slice(dirname(artifactPath).length + 1)],
  });
  const inputVerification = await verifyInputs({
    system,
    content,
    allowUnverified: values['allow-unverified-checkouts'] === true,
  });
  return { system, content, remapPath, curationPath, inputVerification };
}

async function readBuildInputs(
  values: OperatorValues,
  paths: Awaited<ReturnType<typeof resolveBuildInputPaths>>,
) {
  const { system, content, remapPath, curationPath } = paths;
  const remaps = await readJson(remapPath);
  const curation = await readJson(curationPath);
  const artifact = await importCatalog({
    systemPath: system,
    contentPath: content,
    remaps,
    curation,
  });
  const attribution = values.attribution
    ? reviewedAdmissionSchema.parse(await readJson(resolve(values.attribution)))
    : reviewedAdmission;
  const legalResources = values.legal
    ? legalResourcesSchema.parse(await readJson(resolve(values.legal)))
    : defaultLegalResources;
  const previous = values.previous
    ? await validateCatalogReleaseArtifact(
        await readJson(resolve(values.previous)),
      )
    : undefined;
  const implementation = await catalogImplementationInputs();
  const suppliedResources = values['rule-resources']
    ? parseAuthoredResources(await readJson(resolve(values['rule-resources'])))
    : [];
  return {
    remaps,
    curation,
    artifact,
    attribution,
    legalResources,
    previous,
    implementation,
    suppliedResources,
  };
}

async function buildReleaseArtifact(
  values: OperatorValues,
  artifactPath: string,
) {
  const releaseNumber = positiveNumber(values.number);
  const compatibility = {
    schema: required(values.schema, 'schema'),
    calculation: required(values.calculation, 'calculation'),
  };
  const paths = await resolveBuildInputPaths(values, artifactPath);
  const { inputVerification } = paths;
  const {
    remaps,
    curation,
    artifact,
    attribution,
    legalResources,
    previous,
    implementation,
    suppliedResources,
  } = await readBuildInputs(values, paths);
  const release = await createCatalogRelease({
    artifact,
    attribution,
    legalResources,
    previous,
    releaseNumber,
    compatibility,
    authoredResources: [
      ...suppliedResources,
      {
        key: 'builtin:casting-tables',
        payload: {
          definitions: implementation.ruleResources.castingTables.definitions,
          sourceFingerprint: await releaseFingerprint(
            implementation.ruleResources.castingTables.source,
          ),
          compatibility,
        },
      },
      {
        key: 'builtin:representative-class-catalog',
        payload: {
          definitions:
            implementation.ruleResources.representativeClassCatalog.definitions,
          featureSchedules:
            implementation.ruleResources.representativeClassCatalog
              .featureSchedules,
          sourceFingerprint: await releaseFingerprint(
            implementation.ruleResources.representativeClassCatalog.source,
          ),
          compatibility,
        },
      },
      {
        key: 'builtin:representative-archetype-catalog',
        payload: {
          definitions:
            implementation.ruleResources.representativeArchetypeCatalog
              .definitions,
          sourceFingerprint: await releaseFingerprint(
            implementation.ruleResources.representativeArchetypeCatalog.source,
          ),
          compatibility,
        },
      },
      {
        key: 'builtin:representative-race-catalog',
        payload: {
          definitions:
            implementation.ruleResources.representativeRaceCatalog.definitions,
          sourceFingerprint: await releaseFingerprint(
            implementation.ruleResources.representativeRaceCatalog.source,
          ),
          compatibility,
        },
      },
    ],
    inputValues: {
      ...implementation,
      remaps,
      curation,
      localData: [],
      ruleResources: {
        builtIn: implementation.ruleResources,
        supplied: suppliedResources,
      },
      upstreamVerification: inputVerification,
    },
  });
  await saveImmutableArtifact(artifactPath, release);
  return { artifactPath, manifest: release.manifest, inputVerification };
}

async function saveImmutableArtifact(
  artifactPath: string,
  release: Awaited<ReturnType<typeof createCatalogRelease>>,
) {
  const serialized = serializeCatalogRelease(release);
  await mkdir(dirname(artifactPath), { recursive: true });
  try {
    await writeFile(artifactPath, serialized, { flag: 'wx' });
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !('code' in error) ||
      error.code !== 'EEXIST'
    )
      throw error;
    const existing = await validateCatalogReleaseArtifact(
      await readJson(artifactPath),
    );
    if (
      existing.manifest.artifactFingerprint !==
      release.manifest.artifactFingerprint
    )
      throw new Error(
        'Artifact path is already bound to changed release inputs/output; increment the number and choose a new path.',
      );
  }
}

function parseAuthoredResources(
  value: unknown,
): { key: string; payload: ReleaseJson }[] {
  if (!Array.isArray(value))
    throw new Error(
      'Rule resources must be an array of {key,payload} records.',
    );
  return value.map((resource: unknown) => {
    if (
      !isObject(resource) ||
      typeof resource.key !== 'string' ||
      !resource.key.startsWith('builtin:') ||
      !('payload' in resource)
    )
      throw new Error(
        'Rule resource keys must be stable builtin: identifiers.',
      );
    return { key: resource.key, payload: parseReleaseJson(resource.payload) };
  });
}

function parseRowKind(value: string): ReleaseRow['kind'] {
  if (!isReleaseRowKind(value))
    throw new Error(
      '--kind must be definition, resource, report, remap or legal.',
    );
  return value;
}
