// @vitest-environment node
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { accessJourneyFiles, requiredTests } from './matrix';
import { evaluateResults } from './results';

it('requires the exact titles declared by the selected nightly journey sources', () => {
  const required = requiredTests('nightly');
  expect(required).toHaveLength(38);
  for (const file of new Set(required.map(([file]) => file!))) {
    const source = ts.createSourceFile(
      file,
      readFileSync(join(process.cwd(), 'e2e', file), 'utf8'),
      ts.ScriptTarget.Latest,
    );
    const titles = source.statements.flatMap((statement) => {
      if (!ts.isExpressionStatement(statement)) return [];
      const call = statement.expression;
      if (
        !ts.isCallExpression(call) ||
        !ts.isIdentifier(call.expression) ||
        !['test', 'setup'].includes(call.expression.text)
      )
        return [];
      const title = call.arguments[0];
      return title && ts.isStringLiteral(title) ? [title.text] : [];
    });
    expect(titles, file).toEqual([
      ...new Set(
        required.filter(([name]) => name === file).map(([, , title]) => title),
      ),
    ]);
  }
});

const workspaceTitles = requiredTests('mandatory')
  .filter(([file]) => file === 'canonical-workspace.spec.ts')
  .map(([, , title]) => title!);
const isAccessJourney = (file: string) =>
  (accessJourneyFiles as readonly string[]).includes(file);
// The access parts split out after the campaign home.
const accessParts = requiredTests('mandatory')
  .filter(
    ([file]) =>
      isAccessJourney(file!) &&
      !['access.spec.ts', 'campaign-home.spec.ts'].includes(file!),
  )
  .map(([file, , title]) => [file!, title!] as const);

const passing = () => ({
  status: 'passed',
  errors: 0,
  tests: [
    {
      file: 'canonical-cutover.spec.ts',
      project: 'canonical-cutover',
      title:
        'accepted campaign preserves canonical history and rejects retired paths',
      expectedStatus: 'passed',
      tags: [],
      annotations: [],
      results: [{ status: 'passed', retry: 0 }],
    },
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
    {
      file: 'existing-militia.spec.ts',
      project: 'chromium-tablet',
      title: 'existing militia state survives reload within its campaign',
      expectedStatus: 'passed',
      tags: [],
      annotations: [],
      results: [{ status: 'passed', retry: 0 }],
    },
    {
      file: 'character-ledger.spec.ts',
      project: 'chromium-tablet',
      title: 'players share character and officer assignment changes',
      expectedStatus: 'passed',
      tags: [],
      annotations: [],
      results: [{ status: 'passed', retry: 0 }],
    },
    {
      file: 'complete-week.spec.ts',
      project: 'chromium-tablet',
      title:
        'a player confirms a complete week, every device moves to the next week once it is usable, and the outcome survives reload',
      expectedStatus: 'passed',
      tags: [],
      annotations: [],
      results: [{ status: 'passed', retry: 0 }],
    },
    {
      file: 'realtime-action-slot.spec.ts',
      project: 'chromium-tablet',
      title: 'players share a Staged Action Choice',
      expectedStatus: 'passed',
      tags: [],
      annotations: [],
      results: [{ status: 'passed', retry: 0 }],
    },
    {
      file: 'canonical-persistence.spec.ts',
      project: 'canonical-persistence',
      title: 'shared persistence contract uses authenticated isolated Convex',
      expectedStatus: 'passed',
      tags: [],
      annotations: [],
      results: [{ status: 'passed', retry: 0 }],
    },
    {
      file: 'canonical-confirmation.spec.ts',
      project: 'canonical-confirmation',
      title:
        'shared Confirmation contract commits reviewed weeks in isolated Convex',
      expectedStatus: 'passed',
      tags: [],
      annotations: [],
      results: [{ status: 'passed', retry: 0 }],
    },
    ...workspaceTitles.map((title) => ({
      file: 'canonical-workspace.spec.ts',
      project: 'canonical-workspace',
      title,
      expectedStatus: 'passed',
      tags: [] as string[],
      annotations: [] as string[],
      results: [{ status: 'passed', retry: 0 }],
    })),
    {
      file: 'campaign-home.spec.ts',
      project: 'chromium-tablet',
      title:
        'members choose and edit their campaign home and outsiders never see it',
      expectedStatus: 'passed',
      tags: [] as string[],
      annotations: [] as string[],
      results: [{ status: 'passed', retry: 0 }],
    },
    ...accessParts.map(([file, title]) => ({
      file,
      project: 'chromium-tablet',
      title,
      expectedStatus: 'passed',
      tags: [] as string[],
      annotations: [] as string[],
      results: [{ status: 'passed', retry: 0 }],
    })),
  ],
});

it('accepts required authentication, browser journeys and deployed persistence on first attempts', () => {
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
  for (const index of [1, 2, 3, 4, 5, 6, 7]) {
    const report = passing();
    Object.assign(report.tests[index]!.results[0]!, { status });
    expect(evaluateResults(report)).toBe(false);
  }
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

it('rejects a run that omits the existing-militia journey', () => {
  const report = passing();
  report.tests.splice(2, 1);
  expect(evaluateResults(report)).toBe(false);
});

it('rejects a run that omits the character-ledger journey', () => {
  const report = passing();
  report.tests.splice(3, 1);
  expect(evaluateResults(report)).toBe(false);
});

it('rejects a run that omits the complete-week journey', () => {
  const report = passing();
  report.tests.splice(4, 1);
  expect(evaluateResults(report)).toBe(false);
});

it('rejects a run that omits the realtime Action Slot journey', () => {
  const report = passing();
  report.tests.splice(5, 1);
  expect(evaluateResults(report)).toBe(false);
});

it('rejects a run that omits the deployed persistence contract', () => {
  const report = passing();
  report.tests.splice(6, 1);
  expect(evaluateResults(report)).toBe(false);
});

function nightlyPassing() {
  const report = passing();
  const critical = report.tests.filter(
    (test) => test.project === 'chromium-tablet',
  );
  report.tests.push(
    ...critical.map((test) => ({ ...test, project: 'webkit-tablet' })),
    ...critical
      .filter(
        ({ file }) =>
          isAccessJourney(file) ||
          ['existing-militia.spec.ts', 'complete-week.spec.ts'].includes(file),
      )
      .map((test) => ({ ...test, project: 'firefox-desktop' })),
    ...critical
      .filter(({ file }) => isAccessJourney(file))
      .map((test) => ({ ...test, project: 'chromium-phone' })),
  );
  return report;
}

it('accepts the risk-based nightly matrix and rejects it as a mandatory run', () => {
  expect(evaluateResults(nightlyPassing(), 'nightly')).toBe(true);
  expect(evaluateResults(nightlyPassing())).toBe(false);
  expect(evaluateResults(passing(), 'nightly')).toBe(false);
});
it('requires every selected nightly project journey without skips or retry passes', () => {
  for (let index = 0; index < nightlyPassing().tests.length; index++) {
    const missing = nightlyPassing();
    missing.tests.splice(index, 1);
    expect(evaluateResults(missing, 'nightly')).toBe(false);
    const retry = nightlyPassing();
    retry.tests[index]!.results = [
      { status: 'failed', retry: 0 },
      { status: 'passed', retry: 1 },
    ];
    expect(evaluateResults(retry, 'nightly')).toBe(false);
    const skipped = nightlyPassing();
    Object.assign(skipped.tests[index]!, { annotations: ['skip'] });
    expect(evaluateResults(skipped, 'nightly')).toBe(false);
  }
});

it('rejects a missing canonical Workspace UI journey', () => {
  const report = passing();
  report.tests.pop();
  expect(evaluateResults(report)).toBe(false);
});

it('requires each of the eight independent Workspace journeys', () => {
  expect(workspaceTitles).toHaveLength(8);
  for (const title of workspaceTitles) {
    const report = passing();
    report.tests = report.tests.filter((test) => test.title !== title);
    expect(evaluateResults(report)).toBe(false);
  }
});

it('requires the independent Confirmation contract even when editing passed', () => {
  const report = passing();
  report.tests = report.tests.filter(
    (test) => !test.title.startsWith('shared Confirmation'),
  );
  expect(evaluateResults(report)).toBe(false);
});
it('rejects a passing Confirmation retry after a failed first attempt', () => {
  const report = passing();
  const confirmation = report.tests.find((test) =>
    test.title.startsWith('shared Confirmation'),
  )!;
  confirmation.results = [
    { status: 'failed', retry: 0 },
    { status: 'passed', retry: 1 },
  ];
  expect(evaluateResults(report)).toBe(false);
});
