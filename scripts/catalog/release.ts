import type { importCatalog } from './import.ts';
import { assessCatalogAdmission, computeFingerprint } from './admission.ts';
import type { reviewedAdmissionSchema } from '../../src/lib/catalog/admission-schema.ts';
import { buildLegalPageData } from '../../src/lib/catalog/legal-page-data.ts';
import {
  legalResourcesSchema,
  type LegalResources,
} from '../../src/lib/catalog/legal-types.ts';

import {
  MAX_RELEASE_BATCH_ROWS,
  MAX_RELEASE_BATCH_BYTES,
  canonicalReleaseJson,
  parseReleaseJson,
  releaseByteCount,
  releaseFingerprint,
  validateCatalogReleaseArtifact,
  releaseInputCategories,
  type CatalogReleaseArtifact,
  type CatalogReleaseManifest,
  type ReleaseRow,
  type ReleaseInputCategory,
  isObject,
} from '../../src/lib/catalog/release-schema.ts';

export async function buildCatalogRelease({
  releaseNumber,
  compatibility,
  inputs,
  rows,
  baseRelease = null,
}: {
  releaseNumber: number;
  baseRelease?: CatalogReleaseManifest['baseRelease'];
  compatibility: CatalogReleaseManifest['compatibility'];
  inputs: Record<ReleaseInputCategory, unknown>;
  rows: ReleaseRow[];
}): Promise<CatalogReleaseArtifact> {
  const inputHashes = Object.fromEntries(
    await Promise.all(
      releaseInputCategories.map(async (category) => {
        if (!(category in inputs))
          throw new Error(`Missing release input: ${category}.`);
        return [category, await releaseFingerprint(inputs[category])] as const;
      }),
    ),
  );
  const ordered = [...rows].sort((a, b) =>
    `${a.kind}:${a.key}` < `${b.kind}:${b.key}`
      ? -1
      : `${a.kind}:${a.key}` > `${b.kind}:${b.key}`
        ? 1
        : 0,
  );
  const batches: ReleaseRow[][] = [];
  let batch: ReleaseRow[] = [];
  for (const row of ordered) {
    if (
      batch.length &&
      (batch.length === MAX_RELEASE_BATCH_ROWS ||
        releaseByteCount([...batch, row]) > MAX_RELEASE_BATCH_BYTES)
    ) {
      batches.push(batch);
      batch = [];
    }
    batch.push(row);
    if (releaseByteCount(batch) > MAX_RELEASE_BATCH_BYTES)
      throw new Error(`Release row ${row.key} exceeds byte limit.`);
  }
  if (batch.length) batches.push(batch);
  const descriptors = await Promise.all(
    batches.map(async (rows) => ({
      fingerprint: await releaseFingerprint(rows),
      rowCount: rows.length,
      byteCount: releaseByteCount(rows),
    })),
  );
  const body = {
    formatVersion: 1,
    releaseNumber,
    baseRelease,
    compatibility,
    inputs: inputHashes,
    inputFingerprint: await releaseFingerprint({
      inputs: inputHashes,
      compatibility,
      baseRelease,
    }),
    outputFingerprint: await releaseFingerprint(descriptors),
    batches: descriptors,
  };
  return validateCatalogReleaseArtifact({
    manifest: { ...body, artifactFingerprint: await releaseFingerprint(body) },
    batches,
  });
}

export function serializeCatalogRelease(
  artifact: CatalogReleaseArtifact,
): string {
  return canonicalReleaseJson(artifact) + '\n';
}

type ImportArtifact = Awaited<ReturnType<typeof importCatalog>>;
type ReviewedAdmission = ReturnType<typeof reviewedAdmissionSchema.parse>;

function jsonPayload(value: unknown): ReleaseRow['payload'] {
  const parsed: unknown = JSON.parse(canonicalReleaseJson(value));
  return parseReleaseJson(parsed);
}
type CreateCatalogReleaseOptions = {
  artifact: ImportArtifact;
  attribution: Omit<ReviewedAdmission, 'retainedUses' | 'retainedExceptions'> &
    Partial<Pick<ReviewedAdmission, 'retainedUses' | 'retainedExceptions'>>;
  legalResources: LegalResources;
  previous?: CatalogReleaseArtifact;
  releaseNumber: number;
  compatibility: CatalogReleaseManifest['compatibility'];
  inputValues: Record<
    | 'remaps'
    | 'curation'
    | 'localData'
    | 'parsers'
    | 'sanitizers'
    | 'ruleResources',
    unknown
  > & { upstreamVerification?: unknown };
  authoredResources?: { key: string; payload: unknown }[];
};
export async function createCatalogRelease({
  artifact,
  attribution,
  legalResources,
  previous,
  releaseNumber,
  compatibility,
  inputValues,
  authoredResources = [],
}: CreateCatalogReleaseOptions): Promise<CatalogReleaseArtifact> {
  const prior = previous
    ? await validateCatalogReleaseArtifact(previous)
    : undefined;
  if (prior && releaseNumber <= prior.manifest.releaseNumber)
    throw new Error('Release number must increase beyond the comparison base.');
  const gate = assessCatalogAdmission({ artifact, ...attribution });
  if (
    !gate.passed ||
    !artifact.curation.passed ||
    !artifact.comparison.coverageComplete
  )
    throw new Error(
      `Catalog Release gates failed: ${canonicalReleaseJson({ failures: gate.failures, curation: artifact.curation, coverageComplete: artifact.comparison.coverageComplete })}`,
    );
  const priorBodies = new Map(
    collectPreviousBodies(prior).map((row) => [row.key, row]),
  );
  const {
    legalPage,
    priorNotices,
    rows: legalRows,
  } = buildLegalRows({
    attribution,
    legalResources,
    gate,
    prior,
  });
  const { rows, admitted, definitions, resources } = collectCatalogRows({
    artifact,
    gate,
    authoredResources,
    priorBodies,
  });
  rows.push(
    ...(await buildContentReports({
      artifact,
      definitions,
      resources,
      authoredResources,
      priorBodies,
      inputVerification: inputValues.upstreamVerification ?? null,
    })),
  );
  rows.push(...buildHoldsReport(gate, legalPage));
  rows.push(
    ...buildRetirementReport({
      gate,
      attribution,
      admitted,
      authoredResources,
      priorBodies,
    }),
  );
  rows.push(...buildCurationReport(artifact.curation), ...legalRows);
  return buildCatalogRelease({
    releaseNumber,
    compatibility,
    rows,
    baseRelease: prior
      ? {
          releaseNumber: prior.manifest.releaseNumber,
          artifactFingerprint: prior.manifest.artifactFingerprint,
        }
      : null,
    inputs: {
      ...inputValues,
      upstream: {
        content: artifact.catalog.inputs,
        verification: inputValues.upstreamVerification ?? null,
      },
      attribution,
      legal: {
        resources: legalResources,
        priorNotices: priorNotices ?? [],
        requiredNotices: gate.requiredNotices,
      },
      ruleResources: { input: inputValues.ruleResources, authoredResources },
      localData: {
        content: inputValues.localData,
        priorArtifact: prior?.manifest.artifactFingerprint ?? null,
      },
    },
  });
}

type ReleaseAdmission = ReturnType<typeof assessCatalogAdmission>;
type PreviousBodies = Map<string, ReleaseRow>;
type AuthoredResources = NonNullable<
  CreateCatalogReleaseOptions['authoredResources']
>;

function appendReleaseRow(
  rows: ReleaseRow[],
  kind: ReleaseRow['kind'],
  key: string,
  payload: unknown,
) {
  rows.push({ kind, key, payload: jsonPayload(payload) });
}

function describeChange(previous: unknown, current: unknown) {
  if (previous === undefined) return 'added';
  return computeFingerprint(previous) === computeFingerprint(current)
    ? 'unchanged'
    : 'changed';
}

function collectCatalogRows({
  artifact,
  gate,
  authoredResources,
  priorBodies,
}: {
  artifact: ImportArtifact;
  gate: ReleaseAdmission;
  authoredResources: AuthoredResources;
  priorBodies: PreviousBodies;
}) {
  const rows: ReleaseRow[] = [];
  const admitted = new Set(gate.admitted.map((row) => row.externalKey));
  const definitions = artifact.catalog.entries.filter((entry) =>
    admitted.has(entry.externalKey),
  );
  const resources = artifact.catalog.resources.filter((entry) =>
    admitted.has(entry.externalKey),
  );
  for (const entry of definitions)
    appendReleaseRow(rows, 'definition', entry.externalKey, entry);
  for (const resource of resources)
    appendReleaseRow(rows, 'resource', resource.externalKey, resource);
  for (const resource of authoredResources)
    appendReleaseRow(rows, 'resource', resource.key, resource.payload);
  for (const remap of artifact.catalog.remaps)
    if (remap.applied) appendReleaseRow(rows, 'remap', remap.from, remap);
  for (const current of rows.filter(
    (row) => row.kind === 'definition' || row.kind === 'resource',
  )) {
    const previousBody = priorBodies.get(current.key);
    if (
      previousBody &&
      canonicalReleaseJson(catalogKind(previousBody)) !==
        canonicalReleaseJson(catalogKind(current))
    )
      throw new Error(
        `Catalog identity ${current.key} changed kind; use a new stable identity.`,
      );
  }
  return { rows, admitted, definitions, resources };
}

async function buildContentReports({
  artifact,
  definitions,
  resources,
  authoredResources,
  priorBodies,
  inputVerification,
}: {
  artifact: ImportArtifact;
  definitions: ImportArtifact['catalog']['entries'];
  resources: ImportArtifact['catalog']['resources'];
  authoredResources: AuthoredResources;
  priorBodies: PreviousBodies;
  inputVerification: unknown;
}) {
  const rows: ReleaseRow[] = [];
  for (const [category, candidates] of [
    ['content', definitions],
    ['resources', resources],
  ] as const) {
    appendReleaseRow(rows, 'report', category, {
      gatePassed: true,
      admitted:
        candidates.length +
        (category === 'resources' ? authoredResources.length : 0),
      coverageComplete: true,
      inputVerification,
      comparison: artifact.comparison.summary,
      unsupported: artifact.unsupported.summary,
    });
    for (const entry of candidates) {
      const old = priorBodies.get(entry.externalKey);
      appendReleaseRow(rows, 'report', `${category}:${entry.externalKey}`, {
        externalKey: entry.externalKey,
        state: describeChange(old?.payload, entry),
        fingerprint: await releaseFingerprint(entry),
      });
    }
  }
  for (const resource of authoredResources)
    appendReleaseRow(rows, 'report', `resources:${resource.key}`, {
      externalKey: resource.key,
      state: describeChange(
        priorBodies.get(resource.key)?.payload,
        resource.payload,
      ),
      fingerprint: await releaseFingerprint(resource.payload),
    });
  for (const [index, record] of artifact.comparison.records.entries())
    appendReleaseRow(rows, 'report', `content:inventory:${index}`, record);
  for (const [index, pack] of artifact.comparison.packs.entries())
    appendReleaseRow(rows, 'report', `content:pack:${index}`, pack);
  for (const [index, entry] of artifact.unsupported.entries.entries())
    appendReleaseRow(rows, 'report', `content:unsupported:${index}`, entry);
  return rows;
}

function buildHoldsReport(
  gate: ReleaseAdmission,
  legalPage: ReturnType<typeof buildLegalPageData>,
) {
  const rows: ReleaseRow[] = [];
  appendReleaseRow(rows, 'report', 'holds', {
    gatePassed: true,
    held: gate.held.length,
    dependentOmissions: gate.dependentOmissions.length,
    retainedExceptions: gate.retainedExceptions.length,
    retainedRequiredNotices: [
      ...new Set(
        gate.retainedExceptions.flatMap(
          (exception) => exception.requiredNotices,
        ),
      ),
    ].sort(),
    failures: gate.failures,
    outstandingNotices: legalPage.outstandingNotices,
  });
  for (const row of [...gate.held, ...gate.dependentOmissions])
    appendReleaseRow(rows, 'report', `holds:${row.externalKey}`, row);
  for (const row of gate.retainedExceptions)
    appendReleaseRow(rows, 'report', `holds:retained:${row.useId}`, row);
  return rows;
}

function buildRetirementReport({
  gate,
  attribution,
  admitted,
  authoredResources,
  priorBodies,
}: {
  gate: ReleaseAdmission;
  attribution: CreateCatalogReleaseOptions['attribution'];
  admitted: Set<string>;
  authoredResources: AuthoredResources;
  priorBodies: PreviousBodies;
}) {
  const rows: ReleaseRow[] = [];
  const currentKeys = new Set([
    ...admitted,
    ...authoredResources.map((resource) => resource.key),
  ]);
  const retired = [...priorBodies.values()].filter(
    (row) => !currentKeys.has(row.key),
  );
  appendReleaseRow(rows, 'report', 'retirement', {
    gatePassed: true,
    count: retired.length,
    retainedUses: attribution.retainedUses ?? [],
  });
  for (const row of retired)
    appendReleaseRow(rows, 'report', `retirement:${row.key}`, {
      externalKey: row.key,
      kind: row.kind,
      state: gate.held.some((held) => held.externalKey === row.key)
        ? 'held'
        : 'retired',
      lastUsableDefinition: row.payload,
      definitionFingerprint: computeFingerprint(row.payload),
    });
  for (const use of attribution.retainedUses ?? []) {
    const body = priorBodies.get(use.externalKey);
    if (!body || computeFingerprint(body.payload) !== use.definitionFingerprint)
      throw new Error(
        `Missing last usable retained definition: ${use.externalKey}.`,
      );
  }
  return rows;
}

function buildCurationReport(curation: ImportArtifact['curation']) {
  const rows: ReleaseRow[] = [];
  const { summary, passed, ...curationRows } = curation;
  appendReleaseRow(rows, 'report', 'curation', {
    gatePassed: passed,
    summary,
    passed,
  });
  for (const [category, records] of Object.entries(curationRows))
    for (const [index, record] of records.entries())
      appendReleaseRow(rows, 'report', `curation:${category}:${index}`, record);
  return rows;
}

function buildLegalRows({
  attribution,
  legalResources,
  gate,
  prior,
}: {
  attribution: CreateCatalogReleaseOptions['attribution'];
  legalResources: LegalResources;
  gate: ReleaseAdmission;
  prior: CatalogReleaseArtifact | undefined;
}) {
  const priorNotices = prior?.batches
    .flat()
    .find(
      (row) => row.kind === 'legal' && row.key === 'permanentNoticeSuperset',
    )?.payload;
  const legalPage = buildLegalPageData({
    registry: attribution.registry,
    resources: legalResources,
    requiredNotices: gate.requiredNotices,
    permanentNoticeSuperset: priorNotices
      ? [
          ...parsePriorNotices(priorNotices),
          ...legalResources.permanentNoticeSuperset,
        ]
      : legalResources.permanentNoticeSuperset,
  });
  if (
    legalPage.outstandingNotices.some(
      (notice) =>
        !gate.retainedExceptions.some((exception) =>
          exception.requiredNotices.includes(notice.code),
        ),
    ) ||
    legalPage.outstandingResources.length
  )
    throw new Error('Catalog Release legal gate failed.');
  const rows: ReleaseRow[] = [];
  appendReleaseRow(rows, 'legal', 'requiredNotices', gate.requiredNotices);
  appendReleaseRow(
    rows,
    'legal',
    'permanentNoticeSuperset',
    legalPage.permanentNoticeSuperset,
  );
  appendReleaseRow(rows, 'legal', 'registry', attribution.registry);
  appendReleaseRow(rows, 'legal', 'resources', legalResources);
  return { rows, legalPage, priorNotices };
}

function parsePriorNotices(value: ReleaseRow['payload']) {
  return legalResourcesSchema.shape.permanentNoticeSuperset.parse(value);
}

function collectPreviousBodies(
  prior: CatalogReleaseArtifact | undefined,
): ReleaseRow[] {
  const bodies = new Map<string, ReleaseRow>();
  for (const row of prior?.batches.flat() ?? []) {
    if (row.kind === 'definition' || row.kind === 'resource')
      bodies.set(row.key, row);
    if (row.kind !== 'report' || !row.key.startsWith('retirement:')) continue;
    const payload = row.payload;
    if (
      !isObject(payload) ||
      typeof payload.externalKey !== 'string' ||
      !('lastUsableDefinition' in payload)
    )
      continue;
    if (!bodies.has(payload.externalKey))
      bodies.set(payload.externalKey, {
        kind: payload.kind === 'resource' ? 'resource' : 'definition',
        key: payload.externalKey,
        payload: parseReleaseJson(payload.lastUsableDefinition),
      });
  }
  return [...bodies.values()];
}

function catalogKind(row: ReleaseRow) {
  const payload = row.payload;
  if (!isObject(payload))
    return { category: row.kind, kind: null, detailKind: null };
  const detail = payload.detail;
  return {
    category: row.kind,
    kind: typeof payload.kind === 'string' ? payload.kind : null,
    detailKind:
      isObject(detail) && typeof detail.kind === 'string' ? detail.kind : null,
  };
}
