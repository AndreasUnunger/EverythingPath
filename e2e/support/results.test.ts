// @vitest-environment node
import { expect, it } from 'vitest';
import { evaluateResults } from './results';

const passing = () => ({
  status: 'passed',
  errors: 0,
  tests: [
    {
      file: 'auth.setup.ts',
      project: 'authentication',
      title: 'prepare fresh role sessions',
      expectedStatus: 'passed',
      tags: [],
      annotations: [],
      results: [{ status: 'passed', retry: 0 }],
    },
    {
      file: 'access.spec.ts',
      project: 'chromium-tablet',
      title:
        'organization members can open their campaign and outsiders cannot',
      expectedStatus: 'passed',
      tags: [],
      annotations: [],
      results: [{ status: 'passed', retry: 0 }],
    },
  ],
});

it('accepts exactly the required authentication and access journey on their first attempts', () => {
  expect(evaluateResults(passing())).toBe(true);
});

it.each([
  'failed',
  'flaky',
  'cancelled',
  'neutral',
  'skipped',
  'timedOut',
  'interrupted',
  undefined,
])('rejects a required result of %s', (status) => {
  const report = passing();
  Object.assign(report.tests[1]!.results[0]!, { status });
  expect(evaluateResults(report)).toBe(false);
});

it('rejects a diagnostic retry even when it passes', () => {
  const report = passing();
  report.tests[1]!.results = [
    { status: 'failed', retry: 0 },
    { status: 'passed', retry: 1 },
  ];
  expect(evaluateResults(report)).toBe(false);
});

it('rejects missing and substituted journeys, malformed reports and runner errors', () => {
  for (const report of [
    undefined,
    {},
    { ...passing(), tests: passing().tests.slice(0, 1) },
    { ...passing(), tests: [passing().tests[0], passing().tests[0]] },
    { ...passing(), errors: 1 },
    { ...passing(), status: 'timedout' },
  ]) {
    expect(evaluateResults(report)).toBe(false);
  }
});

it.each(['only', 'skip', 'fixme', 'fail', 'quarantine', 'quarantined'])(
  'rejects %s annotations even with a passing result',
  (type) => {
    const report = passing();
    Object.assign(report.tests[1]!, { annotations: [type] });
    expect(evaluateResults(report)).toBe(false);
  },
);

it('rejects expected failures and missing attempts', () => {
  const report = passing();
  report.tests[1]!.expectedStatus = 'failed';
  expect(evaluateResults(report)).toBe(false);
  report.tests[1]!.expectedStatus = 'passed';
  report.tests[1]!.results = [];
  expect(evaluateResults(report)).toBe(false);
});

it.each(['@quarantine', '@quarantined'])(
  'rejects the %s tag on a passing journey',
  (tag) => {
    const report = passing();
    Object.assign(report.tests[1]!, { tags: [tag] });
    expect(evaluateResults(report)).toBe(false);
  },
);
