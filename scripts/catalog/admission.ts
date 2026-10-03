import { createHash } from 'node:crypto';
import type { importCatalog } from './import.ts';
import type { PreviewEntry } from './map.ts';
import {
  isReviewedNotice,
  type AttributionAssessment,
  type AttributionEvidence,
  type RetainedUse,
  type RetainedException,
  type Section15Registry,
} from '../../src/lib/catalog/admission-schema.ts';
import {
  createNoticeIndex,
  resolveNotice,
} from '../../src/lib/catalog/resolve-notice.ts';

type ImportedArtifact = Awaited<ReturnType<typeof importCatalog>>;
export type AdmissionArtifact = Omit<
  ImportedArtifact,
  'comparison' | 'catalog'
> & {
  catalog: ImportedArtifact['catalog'] & {
    localResources?: { path: string; sha256: string }[];
  };
  comparison: Omit<ImportedArtifact['comparison'], 'records' | 'packs'> & {
    records: (Omit<
      ImportedArtifact['comparison']['records'][number],
      'repo'
    > & { repo: string })[];
    packs: (Omit<ImportedArtifact['comparison']['packs'][number], 'repo'> & {
      repo: string;
    })[];
  };
};
export type AdmissionSource = {
  catalog: Pick<AdmissionArtifact['catalog'], 'entries'> &
    Partial<
      Pick<
        AdmissionArtifact['catalog'],
        'resources' | 'remaps' | 'localResources'
      >
    >;
  comparison: Pick<AdmissionArtifact['comparison'], 'records' | 'packs'>;
  curation?: Pick<
    AdmissionArtifact['curation'],
    'missing' | 'unresolvedMechanics'
  >;
};
export type AdmissionRow = {
  externalKey: string;
  name: string;
  reason: string;
  requiredNotices: string[];
  missingNotices: string[];
  evidence: string[];
};

export function computeFingerprint(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  return value;
}

type BindingInput = {
  entry: PreviewEntry;
  requiredNotices: string[];
  evidenceIds: string[];
};
type BindingContext = {
  artifact: AdmissionSource;
  evidence: AttributionEvidence;
  registry: Section15Registry;
};

export function buildAssessmentBinding({
  entry,
  requiredNotices,
  evidenceIds,
  ...context
}: BindingInput & BindingContext) {
  return createBindingBuilder({ ...context, ...buildCatalogIndexes(context) })({
    entry,
    requiredNotices,
    evidenceIds,
  });
}

function buildCatalogIndexes({
  artifact,
  registry,
}: Pick<BindingContext, 'artifact' | 'registry'>) {
  const entries = [
    ...artifact.catalog.entries,
    ...(artifact.catalog.resources ?? []),
  ];
  const entriesByKey = new Map(
    entries.map((entry) => [entry.externalKey, entry]),
  );
  const dependencies = new Map(
    entries.map((entry) => [entry.externalKey, collectReferences(entry)]),
  );
  const notices = createNoticeIndex({ registry });
  return { entries, entriesByKey, dependencies, notices };
}

function createBindingBuilder({
  artifact,
  evidence,
  entriesByKey,
  dependencies,
  notices,
}: BindingContext & ReturnType<typeof buildCatalogIndexes>) {
  const contentFingerprints = new Map<string, string>();
  const mappingFingerprints = new Map<string, string>();
  const evidenceFingerprints = new Map(
    Object.entries(evidence).map(([id, item]) => [
      id,
      computeFingerprint(item),
    ]),
  );
  const noticeFingerprints = new Map(
    [...notices].map(([code, notice]) => [
      code,
      computeFingerprint(notice ?? null),
    ]),
  );
  const missingFingerprint = computeFingerprint(null);
  return ({ entry, requiredNotices, evidenceIds }: BindingInput) => {
    let contentFingerprint = contentFingerprints.get(entry.externalKey);
    if (contentFingerprint === undefined) {
      contentFingerprint = computeFingerprint(
        collectContentClosure({ entry, entriesByKey, dependencies }),
      );
      contentFingerprints.set(entry.externalKey, contentFingerprint);
    }
    let mappingFingerprint = mappingFingerprints.get(entry.externalKey);
    if (mappingFingerprint === undefined) {
      mappingFingerprint = computeFingerprint({
        upstreamKey: entry.upstreamKey,
        externalKey: entry.externalKey,
        remaps: artifact.catalog.remaps ?? [],
      });
      mappingFingerprints.set(entry.externalKey, mappingFingerprint);
    }
    return {
      contentFingerprint,
      mappingFingerprint,
      evidenceFingerprints: Object.fromEntries(
        evidenceIds.map((id) => [
          id,
          evidenceFingerprints.get(id) ?? missingFingerprint,
        ]),
      ),
      noticeFingerprints: Object.fromEntries(
        requiredNotices.map((code) => [
          code,
          noticeFingerprints.get(code) ?? missingFingerprint,
        ]),
      ),
    };
  };
}

type AdmissionInput = BindingContext & {
  assessments: AttributionAssessment[];
  retainedUses?: RetainedUse[];
  retainedExceptions?: RetainedException[];
};
type AdmissionFailure = { externalKey: string; reason: string };
type Classification =
  | { kind: 'admitted' | 'held'; row: AdmissionRow }
  | { kind: 'retained'; externalKey: string }
  | { kind: 'failed'; failure: AdmissionFailure };

export function assessCatalogAdmission({
  artifact,
  assessments,
  registry,
  evidence,
  retainedUses = [],
  retainedExceptions: declaredExceptions = [],
}: AdmissionInput) {
  const indexes = buildCatalogIndexes({ artifact, registry });
  const { entries, entriesByKey, dependencies, notices } = indexes;
  const assessmentsByKey = new Map<string, AttributionAssessment>();
  const duplicateAssessments: AttributionAssessment[] = [];
  for (const assessment of assessments) {
    if (assessmentsByKey.has(assessment.externalKey))
      duplicateAssessments.push(assessment);
    else assessmentsByKey.set(assessment.externalKey, assessment);
  }
  const inventoriedKeys = new Set(
    artifact.comparison.records
      .filter((record) => record.status === 'admitted')
      .map((record) => record.externalKey),
  );
  const hasReviewedNotice = (code: string) =>
    isReviewedNotice(resolveNotice({ registry, code, index: notices }));
  const buildBinding = createBindingBuilder({
    artifact,
    registry,
    evidence,
    ...indexes,
  });
  const exceptionBodies = new Set(
    declaredExceptions.map((exception) =>
      JSON.stringify([
        exception.useId,
        exception.externalKey,
        exception.definitionFingerprint,
      ]),
    ),
  );
  const retainedBodies = new Set(
    retainedUses
      .filter((use) =>
        exceptionBodies.has(
          JSON.stringify([
            use.useId,
            use.externalKey,
            use.definitionFingerprint,
          ]),
        ),
      )
      .map((use) => `${use.externalKey}:${use.definitionFingerprint}`),
  );
  const admitted: AdmissionRow[] = [];
  const held: AdmissionRow[] = [];
  const failures = collectInventoryFailures({
    artifact,
    entries,
    duplicateAssessments,
  });
  const retainedCandidateKeys = new Set<string>();
  const seen = new Set<string>();
  for (const entry of entries) {
    const result = classifyCandidate({
      entry,
      assessmentsByKey,
      dependencies,
      entriesByKey,
      inventoriedKeys,
      retainedBodies,
      seen,
      hasReviewedNotice,
      buildBinding,
      evidence,
    });
    switch (result.kind) {
      case 'admitted':
        admitted.push(result.row);
        break;
      case 'held':
        held.push(result.row);
        break;
      case 'retained':
        retainedCandidateKeys.add(result.externalKey);
        break;
      case 'failed':
        failures.push(result.failure);
        break;
    }
  }
  for (let index = admitted.length - 1; index >= 0; index--) {
    const row = admitted[index];
    if (!row) continue;
    const missingNotices = row.requiredNotices.filter(
      (code) => !hasReviewedNotice(code),
    );
    if (!missingNotices.length) continue;
    failures.push({
      externalKey: row.externalKey,
      reason: `Admitted candidate is missing reviewed required notices: ${missingNotices.join(', ')}.`,
    });
    admitted.splice(index, 1);
  }
  const dependentOmissions = omitUnavailableDependents({
    admitted,
    held,
    failures,
    retainedCandidateKeys,
    dependencies,
  });
  const { retainedExceptions, failures: retainedFailures } =
    reconcileRetainedUses({
      retainedUses,
      declaredExceptions,
      hasReviewedNotice,
    });
  failures.push(...retainedFailures);
  const requiredNotices = [
    ...new Set(
      [...admitted, ...retainedExceptions].flatMap(
        (row) => row.requiredNotices,
      ),
    ),
  ].sort();
  return {
    passed: failures.length === 0,
    admitted,
    held,
    dependentOmissions,
    retainedExceptions,
    requiredNotices,
    failures,
  };
}

function collectReferences(entry: PreviewEntry): string[] {
  const result = new Set<string>();
  function visit(value: unknown) {
    if (typeof value === 'string') {
      for (const match of value.matchAll(/href="catalog:([^"<>]+)"/g))
        if (match[1]) result.add(match[1]);
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        if (
          (key === 'externalKey' || key === 'spellKey') &&
          typeof item === 'string'
        )
          result.add(item);
        else visit(item);
      }
    }
  }
  visit(entry.detail);
  visit(entry.description);
  return [...result].sort();
}

function collectContentClosure({
  entry,
  entriesByKey,
  dependencies,
}: {
  entry: PreviewEntry;
  entriesByKey: Map<string, PreviewEntry>;
  dependencies: Map<string, string[]>;
}) {
  const closure = new Map<string, PreviewEntry | null>();
  function visit(current: PreviewEntry) {
    if (closure.has(current.externalKey)) return;
    closure.set(current.externalKey, current);
    for (const key of dependencies.get(current.externalKey) ?? []) {
      const linked = entriesByKey.get(key);
      if (linked) visit(linked);
      else closure.set(key, null);
    }
  }
  visit(entry);
  return Object.fromEntries(
    [...closure].sort(([a], [b]) => a.localeCompare(b)),
  );
}

function collectInventoryFailures({
  artifact,
  entries,
  duplicateAssessments,
}: {
  artifact: AdmissionSource;
  entries: PreviewEntry[];
  duplicateAssessments: AttributionAssessment[];
}) {
  const failures: AdmissionFailure[] = [];
  for (const input of artifact.curation?.missing ?? [])
    failures.push({
      externalKey: input.externalKey,
      reason: `Missing curation record: ${input.kind} ${input.target} (${input.textSha256}).`,
    });
  for (const record of artifact.curation?.unresolvedMechanics ?? [])
    failures.push({
      externalKey: record.externalKey,
      reason: `Unresolved curation mechanics: ${record.diagnostics.map((diagnostic) => diagnostic.text).join(' ')}`,
    });
  const upstreamKeys = new Set(entries.map((entry) => entry.upstreamKey));
  for (const record of artifact.comparison.records) {
    if (
      record.status === 'unassigned' ||
      (record.status === 'admitted' && !upstreamKeys.has(record.externalKey))
    )
      failures.push({
        externalKey: record.externalKey,
        reason: 'Unaccounted import inventory record.',
      });
  }
  for (const pack of artifact.comparison.packs)
    if (!pack.present || !pack.declared)
      failures.push({
        externalKey: `${pack.repo}/${pack.pack}`,
        reason: 'Broken inventory: missing or undeclared pack.',
      });
  for (const assessment of duplicateAssessments)
    failures.push({
      externalKey: assessment.externalKey,
      reason: 'Duplicate Attribution Assessment.',
    });
  return failures;
}

function describeAcceptedReviewGap({
  assessment,
  binding,
  evidence,
}: {
  assessment: AttributionAssessment;
  binding: ReturnType<ReturnType<typeof createBindingBuilder>>;
  evidence: AttributionEvidence;
}) {
  const reasons: string[] = [];
  if (assessment.mappingFingerprint !== binding.mappingFingerprint)
    reasons.push(
      'Accepted assessment no longer matches current identity mapping — re-review required.',
    );
  if (assessment.contentFingerprint !== binding.contentFingerprint)
    reasons.push(
      'Accepted assessment no longer matches current content — re-review required.',
    );
  const evidenceIds = Object.keys(assessment.evidenceFingerprints);
  const evidenceProblems = evidenceIds.flatMap((id) => {
    if (!evidence[id]?.content.trim()) return [`${id} (missing)`];
    if (evidence[id]?.revoked === true) return [`${id} (revoked)`];
    if (
      assessment.evidenceFingerprints[id] !== binding.evidenceFingerprints[id]
    )
      return [`${id} (changed)`];
    return [];
  });
  if (!evidenceIds.length)
    reasons.push(
      'Accepted assessment has no attribution evidence — re-review required.',
    );
  else if (evidenceProblems.length)
    reasons.push(
      `Attribution evidence requires re-review: ${evidenceProblems.join(', ')}.`,
    );
  return reasons.join(' ');
}

function classifyCandidate({
  entry,
  assessmentsByKey,
  dependencies,
  entriesByKey,
  inventoriedKeys,
  retainedBodies,
  seen,
  hasReviewedNotice,
  buildBinding,
  evidence,
}: {
  entry: PreviewEntry;
  assessmentsByKey: Map<string, AttributionAssessment>;
  dependencies: Map<string, string[]>;
  entriesByKey: Map<string, PreviewEntry>;
  inventoriedKeys: Set<string>;
  retainedBodies: Set<string>;
  seen: Set<string>;
  hasReviewedNotice: (code: string) => boolean;
  buildBinding: ReturnType<typeof createBindingBuilder>;
  evidence: AttributionEvidence;
}): Classification {
  const assessment = assessmentsByKey.get(entry.externalKey);
  const fail = (reason: string): Classification => ({
    kind: 'failed',
    failure: { externalKey: entry.externalKey, reason },
  });
  if (seen.has(entry.externalKey)) {
    return fail('Duplicate candidate identity.');
  }
  seen.add(entry.externalKey);
  const brokenReferences = (dependencies.get(entry.externalKey) ?? []).filter(
    (key) => !entriesByKey.has(key),
  );
  if (
    brokenReferences.length ||
    entry.unsupported.some((item) =>
      ['links.classAssociations', 'description.link', 'spellKey'].includes(
        item.field,
      ),
    )
  ) {
    return fail(
      `Broken structure or reference: ${brokenReferences.join(', ') || 'unresolved imported reference'}.`,
    );
  }
  if (!inventoriedKeys.has(entry.upstreamKey)) {
    return fail('Unaccounted candidate: absent from import inventory.');
  }
  if (
    retainedBodies.size &&
    retainedBodies.has(`${entry.externalKey}:${computeFingerprint(entry)}`)
  ) {
    return { kind: 'retained', externalKey: entry.externalKey };
  }
  const explicitHold = entry.unsupported.find(
    (item) => item.field === 'attribution',
  );
  if (explicitHold || !assessment) {
    const requiredNotices = [
      ...new Set([
        ...entry.sources.map((source) => source.book),
        ...(assessment?.requiredNotices ?? []),
      ]),
    ].sort();
    return {
      kind: 'held',
      row: {
        externalKey: entry.externalKey,
        name: entry.name,
        reason: explicitHold?.reason ?? 'missing Attribution Assessment',
        requiredNotices,
        missingNotices: requiredNotices.filter(
          (code) => !hasReviewedNotice(code),
        ),
        evidence: assessment
          ? Object.keys(assessment.evidenceFingerprints)
          : [],
      },
    };
  }
  const requiredNotices = [
    ...new Set([
      ...assessment.requiredNotices,
      ...entry.sources.map((source) => source.book),
    ]),
  ].sort();
  const missingNotices = requiredNotices.filter(
    (code) => !hasReviewedNotice(code),
  );
  const row = {
    externalKey: entry.externalKey,
    name: entry.name,
    reason: assessment.rationale,
    requiredNotices,
    missingNotices,
    evidence: Object.keys(assessment.evidenceFingerprints),
  };
  const hold = (reason: string): Classification => ({
    kind: 'held',
    row: { ...row, reason },
  });
  if (assessment.status === 'unresolved') {
    return { kind: 'held', row };
  }
  const binding = buildBinding({
    entry,
    requiredNotices,
    evidenceIds: Object.keys(assessment.evidenceFingerprints),
  });
  const reviewGap = describeAcceptedReviewGap({
    assessment,
    binding,
    evidence,
  });
  if (reviewGap) return hold(reviewGap);
  if (missingNotices.length) {
    return hold(
      `Missing or unreviewed required notices: ${missingNotices.join(', ')}.`,
    );
  }
  if (!requiredNotices.length) {
    return hold(
      'Missing source notice attribution: no sources or required notices identified — re-review required.',
    );
  }
  const noticeProblems = requiredNotices.flatMap((code) => {
    if (!assessment.noticeFingerprints[code]) return [`${code} (missing)`];
    if (
      assessment.noticeFingerprints[code] !== binding.noticeFingerprints[code]
    )
      return [`${code} (changed)`];
    return [];
  });
  if (noticeProblems.length) {
    return hold(
      `Notice bindings require re-review: ${noticeProblems.join(', ')}.`,
    );
  }
  return { kind: 'admitted', row };
}

function omitUnavailableDependents({
  admitted,
  held,
  failures,
  retainedCandidateKeys,
  dependencies,
}: {
  admitted: AdmissionRow[];
  held: AdmissionRow[];
  failures: AdmissionFailure[];
  retainedCandidateKeys: Set<string>;
  dependencies: Map<string, string[]>;
}) {
  const dependentOmissions: AdmissionRow[] = [];
  const unavailable = new Set([
    ...retainedCandidateKeys,
    ...[...held, ...failures].map((row) => row.externalKey),
  ]);
  let changed = true;
  while (changed) {
    changed = false;
    for (let index = admitted.length - 1; index >= 0; index--) {
      const row = admitted[index];
      if (!row) continue;
      const unavailableDependencies = (
        dependencies.get(row.externalKey) ?? []
      ).filter((key) => unavailable.has(key));
      if (!unavailableDependencies.length) continue;
      admitted.splice(index, 1);
      dependentOmissions.push({
        ...row,
        reason: `Dependent omission: ${unavailableDependencies.sort().join(', ')}.`,
      });
      unavailable.add(row.externalKey);
      changed = true;
    }
  }
  return dependentOmissions;
}

function reconcileRetainedUses({
  retainedUses,
  declaredExceptions,
  hasReviewedNotice,
}: {
  retainedUses: RetainedUse[];
  declaredExceptions: RetainedException[];
  hasReviewedNotice: (code: string) => boolean;
}) {
  const failures: AdmissionFailure[] = [];
  const retainedExceptions: (AdmissionRow & {
    useId: string;
    characterId: string;
    definitionFingerprint: string;
  })[] = [];
  const exceptionsByUse = new Map<string, RetainedException[]>();
  for (const exception of declaredExceptions) {
    const existing = exceptionsByUse.get(exception.useId) ?? [];
    existing.push(exception);
    exceptionsByUse.set(exception.useId, existing);
  }
  const useIds = new Set(retainedUses.map((use) => use.useId));
  for (const use of retainedUses) {
    const matching = exceptionsByUse.get(use.useId) ?? [];
    const exception = matching[0];
    if (
      matching.length !== 1 ||
      exception?.externalKey !== use.externalKey ||
      exception.definitionFingerprint !== use.definitionFingerprint ||
      use.requiredNotices.some(
        (code) => !exception.requiredNotices.includes(code),
      ) ||
      use.admittedRelease < 1 ||
      !exception.reason.trim()
    ) {
      failures.push({
        externalKey: use.externalKey,
        reason:
          'Unreported, duplicate or invalid retained exception; preserve the last usable definition and its notice obligations.',
      });
      continue;
    }
    retainedExceptions.push({
      externalKey: use.externalKey,
      name: use.name,
      useId: use.useId,
      characterId: use.characterId,
      definitionFingerprint: use.definitionFingerprint,
      reason: exception.reason,
      requiredNotices: exception.requiredNotices,
      missingNotices: exception.requiredNotices.filter(
        (code) => !hasReviewedNotice(code),
      ),
      evidence: [],
    });
  }
  for (const exception of declaredExceptions)
    if (!useIds.has(exception.useId))
      failures.push({
        externalKey: exception.externalKey,
        reason: 'Retained exception has no previously admitted existing use.',
      });
  return { retainedExceptions, failures };
}
