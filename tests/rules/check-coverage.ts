import { createHash } from 'node:crypto';

export interface CoverageCase {
  id: string;
  checkpoint: string;
  expected: string;
  plannedTests: string[];
  tests: string[];
  gap: string | null;
}

export interface CoverageCatalog {
  auditIds: string[];
  sources: {
    id: string;
    path: string;
    // null fingerprints the complete document (audit/accepted decisions).
    heading: string | null;
    parentHeading?: string;
    fingerprint: string;
    reviewGap?: string | null;
  }[];
  rules: {
    id: string;
    sources: string[];
    decisions?: string[];
    cases: CoverageCase[];
  }[];
  corpusReview: {
    gap: string | null;
    reviewedBy?: string;
    reviewReference?: string;
  };
}

// The subset of Vitest's JSON report needed by this boundary. The CLI validates
// external JSON; tests supply small report fixtures without mocking the checker.
export interface TestResults {
  success: boolean;
  testResults: {
    name: string;
    status: string;
    assertionResults: { fullName: string; status: string }[];
  }[];
}

export function sourceSections(text: string) {
  const lines = text.replaceAll('\r\n', '\n').split('\n');
  const starts = lines.flatMap((line, index) =>
    /^#{1,6} /.test(line) ? [index] : [],
  );
  // Track text before the first heading too; new unheaded rules cannot disappear.
  if (starts[0] !== 0 && lines.slice(0, starts[0]).join('\n').trim())
    starts.unshift(0);
  const parents: { level: number; heading: string }[] = [];
  return starts.map((start, index) => {
    const heading = lines[start]!;
    const level = /^#+/.exec(heading)?.[0].length ?? 0;
    while (parents.length && parents[parents.length - 1]!.level >= level)
      parents.pop();
    const parentHeading = parents[parents.length - 1]?.heading;
    parents.push({ level, heading });
    return {
      heading,
      parentHeading,
      text:
        lines
          .slice(start, starts[index + 1])
          .join('\n')
          .trim() + '\n',
    };
  });
}

export function fingerprint(text: string) {
  return createHash('sha256')
    .update(text.replaceAll('\r\n', '\n').trim() + '\n')
    .digest('hex');
}

export function checkCoverage(
  catalog: CoverageCatalog,
  results: TestResults,
  files: Record<string, string>,
  options: {
    strict?: boolean;
    requiredCases?: string[];
    corpusPaths?: string[];
  } = {},
) {
  const errors: string[] = [];
  const covered: string[] = [];
  const gaps: string[] = [];
  const sourceIds = new Set<string>();
  const invalidSources = new Set<string>();
  const ruleIds = new Set<string>();
  const caseIds = new Set<string>();
  if (!results.success) errors.push('Collected test run failed');
  for (const source of catalog.sources) {
    if (sourceIds.has(source.id))
      errors.push(`${source.id}: duplicate source ID`);
    sourceIds.add(source.id);
    const file = files[source.path];
    const matches =
      file === undefined
        ? []
        : source.heading === null
          ? [{ text: file }]
          : sourceSections(file).filter(
              (section) =>
                section.heading === source.heading &&
                (source.parentHeading === undefined ||
                  source.parentHeading === section.parentHeading),
            );
    if (
      matches.length !== 1 ||
      fingerprint(matches[0]!.text) !== source.fingerprint
    ) {
      errors.push(
        `${source.id}: ${matches.length === 1 ? 'stale source fingerprint' : 'missing or ambiguous source reference'}`,
      );
      invalidSources.add(source.id);
    }
    if (source.reviewGap) gaps.push(`${source.id}: ${source.reviewGap}`);
    if (
      !source.reviewGap &&
      !catalog.rules.some((rule) => rule.sources.includes(source.id))
    ) {
      errors.push(
        `${source.id}: source has neither rule mapping nor explicit review gap`,
      );
    }
  }
  for (const path of new Set([
    ...(options.corpusPaths ?? []),
    ...catalog.sources
      .filter((source) => source.heading !== null)
      .map((source) => source.path),
  ])) {
    for (const section of sourceSections(files[path] ?? '')) {
      if (
        !catalog.sources.some(
          (source) =>
            source.path === path &&
            source.heading === section.heading &&
            (source.parentHeading === undefined ||
              source.parentHeading === section.parentHeading),
        )
      ) {
        errors.push(`${path}: unmapped section ${section.heading}`);
      }
    }
  }
  for (const auditId of catalog.auditIds) {
    if (!catalog.rules.some((rule) => rule.id === auditId))
      errors.push(`${auditId}: unmapped audit entry`);
  }
  for (const rule of catalog.rules) {
    if (ruleIds.has(rule.id)) errors.push(`${rule.id}: duplicate rule ID`);
    ruleIds.add(rule.id);
    if (!rule.sources.length) errors.push(`${rule.id}: no source reference`);
    if (!rule.cases.length) errors.push(`${rule.id}: no expanded cases`);
    for (const source of rule.sources) {
      if (!sourceIds.has(source))
        errors.push(`${rule.id}: unknown source ${source}`);
    }
    for (const entry of rule.cases) {
      const id = `${rule.id}.${entry.id}`;
      if (caseIds.has(id)) errors.push(`${id}: duplicate case ID`);
      caseIds.add(id);
      if (
        !entry.id.trim() ||
        !entry.expected.trim() ||
        !entry.checkpoint.trim() ||
        !entry.plannedTests.length
      ) {
        errors.push(`${id}: missing case metadata`);
      }
      let passing =
        entry.tests.length > 0 &&
        rule.sources.length > 0 &&
        rule.sources.every(
          (source) => sourceIds.has(source) && !invalidSources.has(source),
        );
      for (const testId of entry.tests) {
        const matches = results.testResults.flatMap((file) =>
          file.assertionResults
            .filter((test) => test.fullName.includes(`[${testId}]`))
            .map((test) => ({ test, file })),
        );
        if (matches.length !== 1) {
          errors.push(
            `${id}: ${matches.length ? 'ambiguous' : 'missing'} test ${testId}`,
          );
          passing = false;
        } else if (
          matches.some(
            ({ test, file }) =>
              test.status !== 'passed' || file.status !== 'passed',
          )
        ) {
          errors.push(`${id}: test ${testId} did not pass`);
          passing = false;
        }
      }
      if (entry.gap?.trim()) gaps.push(`${id}: ${entry.gap}`);
      // Partial passing evidence is reported but an explicit gap still prevents
      // completeness. A reference cannot be excused by declaring a gap.
      if (passing) covered.push(id);
      else if (!entry.tests.length && !entry.gap?.trim())
        errors.push(`${id}: unmapped case`);
    }
  }
  for (const id of options.requiredCases ?? []) {
    if (!caseIds.has(id)) errors.push(`${id}: unmapped inventoried case`);
  }
  if (catalog.corpusReview.gap?.trim())
    gaps.push(`Corpus review: ${catalog.corpusReview.gap}`);
  else if (
    !catalog.corpusReview.reviewedBy?.trim() ||
    !catalog.corpusReview.reviewReference?.trim()
  ) {
    errors.push('Corpus review requires reviewer and review reference');
  }
  if (options.strict && gaps.length)
    errors.push(`Completeness gate: ${gaps.length} remaining gaps`);
  return { errors, covered, gaps };
}

export function renderCoverageReport(
  catalog: CoverageCatalog,
  result: ReturnType<typeof checkCoverage>,
) {
  const lines = [
    '# Weekly Draft rules coverage',
    '',
    `${catalog.auditIds.length} audit entries; ${catalog.rules.reduce((sum, rule) => sum + rule.cases.length, 0)} expanded cases; ${result.covered.length} cases with passing mapped evidence; ${result.gaps.length} explicit gaps; ${result.errors.length} errors.`,
    '',
    'Passing evidence is traceability, not proof of semantic completeness. Full-corpus human review and the strict gate remain required before cutover.',
    '',
    '## Errors',
    '',
    ...result.errors.map((error) => `- ${error}`),
    ...(result.errors.length ? [] : ['None.']),
    '',
  ];
  for (const rule of catalog.rules) {
    lines.push(
      `## ${rule.id}`,
      '',
      `Sources: ${rule.sources
        .map((id) => {
          const source = catalog.sources.find((item) => item.id === id);
          return source
            ? `[${id}: ${source.heading ?? source.path}](../${source.path})`
            : id;
        })
        .join('; ')}`,
      '',
      '| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |',
      '|---|---|---|',
    );
    for (const entry of rule.cases) {
      const escape = (value: string) =>
        value.replaceAll('|', '\\|').replaceAll('\n', ' ');
      const id = `${rule.id}.${entry.id}`;
      const status = result.covered.includes(id)
        ? 'PASS'
        : entry.tests.length
          ? 'UNVERIFIED'
          : 'GAP';
      lines.push(
        `| ${id} / ${entry.checkpoint} | ${escape(entry.expected)} | ${status}; planned: ${entry.plannedTests.join(', ')}; mapped: ${entry.tests.join(', ') || 'none'}${entry.gap ? '; ' + escape(entry.gap) : ''} |`,
      );
    }
    lines.push('');
  }
  lines.push(
    '## Remaining gaps',
    '',
    ...result.gaps.map((gap) => `- ${gap}`),
    '',
  );
  return lines.join('\n');
}
