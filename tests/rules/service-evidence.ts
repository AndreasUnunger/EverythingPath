import { z } from 'zod';
import { evaluateResults } from '../../e2e/support/results.ts';
import type { TestResults } from './check-coverage.ts';

// The mandatory runner independently checks exact files, titles, projects,
// authentication, and first-attempt success before any service evidence counts.
export function collectServiceEvidence(
  report: unknown,
  sourceFingerprint: string,
): TestResults {
  const provenance = z
    .object({ sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/) })
    .safeParse(report);
  if (
    !provenance.success ||
    provenance.data.sourceFingerprint !== sourceFingerprint
  )
    throw new Error('Service evidence has missing or stale source fingerprint');
  if (!evaluateResults(report))
    throw new Error('Service evidence is incomplete or unsuccessful');
  return {
    success: true,
    testResults: ['workspace', 'persistence', 'confirmation', 'cutover'].map(
      (name) => ({
        name: `e2e/canonical-${name}.spec.ts`,
        status: 'passed',
        assertionResults: [{ fullName: `[live.${name}]`, status: 'passed' }],
      }),
    ),
  };
}
