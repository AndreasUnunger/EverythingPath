// @vitest-environment node
import { expect, test } from 'vitest';
import { requiredTests } from '../../e2e/support/matrix';
import { collectServiceEvidence } from './service-evidence';

const sourceFingerprint = 'a'.repeat(64);
function report() {
  return {
    sourceFingerprint,
    status: 'passed',
    errors: 0,
    tests: requiredTests('mandatory').map(([file, project, title]) => ({
      file,
      project,
      title,
      expectedStatus: 'passed',
      tags: [],
      annotations: [],
      results: [{ status: 'passed', retry: 0 }],
    })),
  };
}

test('only the complete first-attempt deployed suite for this source provides service evidence', () => {
  const evidence = collectServiceEvidence(report(), sourceFingerprint);
  expect(
    evidence.testResults.flatMap((file) =>
      file.assertionResults.map((test) => test.fullName),
    ),
  ).toEqual(['[live.workspace]', '[live.persistence]', '[live.confirmation]']);
  expect(() => collectServiceEvidence(report(), 'b'.repeat(64))).toThrow(
    'source',
  );
  const missing = report();
  missing.tests.pop();
  expect(() => collectServiceEvidence(missing, sourceFingerprint)).toThrow(
    'incomplete',
  );
  const retry = report();
  retry.tests[0]!.results = [
    { status: 'failed', retry: 0 },
    { status: 'passed', retry: 1 },
  ];
  expect(() => collectServiceEvidence(retry, sourceFingerprint)).toThrow(
    'incomplete',
  );
  expect(() =>
    collectServiceEvidence(
      { ...report(), sourceFingerprint: undefined },
      sourceFingerprint,
    ),
  ).toThrow('source');
});
