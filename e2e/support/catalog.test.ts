// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import {
  canonicalCaseKeys,
  caseKeys,
  deploymentFixtureSchema,
  fixtureCatalog,
} from '../fixtures/catalog';
import {
  accessJourneyFiles,
  browserProjects,
  requiredTests,
  workspaceCaseKey,
} from './matrix';

it('declares a capability and domain for every catalog case', () => {
  const cases = deploymentFixtureSchema.shape.workers.element.shape.cases;
  expect(Object.keys(cases.shape).sort()).toEqual([...caseKeys].sort());
  expect(Object.keys(fixtureCatalog).sort()).toEqual([...caseKeys].sort());
  expect(caseKeys).toEqual(expect.arrayContaining([...canonicalCaseKeys]));
});

it('gives each Workspace journey its own canonical case', () => {
  const titles = requiredTests('mandatory')
    .filter(([file]) => file === 'canonical-workspace.spec.ts')
    .map(([, , title]) => title!);
  const cases = titles.map(workspaceCaseKey);
  expect(new Set(cases).size).toBe(11);
  for (const caseKey of cases) expect(canonicalCaseKeys).toContain(caseKey);
  expect(() => workspaceCaseKey('an undeclared journey')).toThrow();
});

// Each required journey file's `test.use({ caseKey })` selections.
const journeyCases = [
  ...new Set(requiredTests('nightly').map(([name]) => name!)),
]
  .filter((name) => name.endsWith('.spec.ts'))
  .flatMap((name) =>
    [
      ...readFileSync(join(process.cwd(), 'e2e', name), 'utf8').matchAll(
        /test\.use\(\{ caseKey: '([A-Za-z]+)' \}\)/g,
      ),
    ].map(([, key]) => [name, key] as const),
  );

const accessSplits = [
  ['campaign-home.spec.ts', 'campaignHome'],
  ['campaign-sections.spec.ts', 'campaignSections'],
  ['week-links.spec.ts', 'weekLinks'],
] as const;

it('lists every journey split from access with its case', () => {
  expect([...accessJourneyFiles].sort()).toEqual(
    ['access.spec.ts', ...accessSplits.map(([file]) => file)].sort(),
  );
});

it.each(accessSplits)(
  'gives %s, split from access, its own case seeded like access, wherever access runs',
  (file, caseKey) => {
    expect(caseKeys).toContain(caseKey);
    expect(fixtureCatalog[caseKey]).toEqual(fixtureCatalog.smoke);
    expect(canonicalCaseKeys).not.toContain(caseKey);
    expect(accessJourneyFiles).toContain(file);
    // The journey selects exactly this case, which no other journey uses.
    expect(journeyCases.filter(([, key]) => key === caseKey)).toEqual([
      [file, caseKey],
    ]);
    for (const mode of ['mandatory', 'nightly'] as const) {
      const projects = (name: string) =>
        requiredTests(mode)
          .filter(([candidate]) => candidate === name)
          .map(([, project]) => project);
      expect(projects(file)).toEqual(projects('access.spec.ts'));
    }
  },
);

it('schedules the longest projects first and cutover last', () => {
  for (const mode of ['mandatory', 'nightly'] as const) {
    const names = browserProjects(mode).map(({ name }) => name);
    expect(names.slice(0, 4)).toEqual([
      'authentication',
      'canonical-confirmation',
      'canonical-persistence',
      'canonical-workspace',
    ]);
    expect(names.at(-1)).toBe('canonical-cutover');
  }
  expect(browserProjects('nightly').map(({ name }) => name)).toEqual([
    'authentication',
    'canonical-confirmation',
    'canonical-persistence',
    'canonical-workspace',
    'webkit-tablet',
    'chromium-phone',
    'chromium-tablet',
    'firefox-desktop',
    'canonical-cutover',
  ]);
});
