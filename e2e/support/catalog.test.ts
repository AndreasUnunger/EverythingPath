// @vitest-environment node
import { expect, it } from 'vitest';
import {
  canonicalCaseKeys,
  caseKeys,
  deploymentFixtureSchema,
  fixtureCatalog,
} from '../fixtures/catalog';
import { browserProjects, requiredTests, workspaceCaseKey } from './matrix';

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
  expect(new Set(cases).size).toBe(5);
  for (const caseKey of cases) expect(canonicalCaseKeys).toContain(caseKey);
  expect(() => workspaceCaseKey('an undeclared journey')).toThrow();
});

it('gives the campaign home its own case, seeded like access, wherever access runs', () => {
  expect(caseKeys).toContain('campaignHome');
  expect(fixtureCatalog.campaignHome).toEqual(fixtureCatalog.smoke);
  expect(canonicalCaseKeys).not.toContain('campaignHome');
  for (const mode of ['mandatory', 'nightly'] as const) {
    const projects = (file: string) =>
      requiredTests(mode)
        .filter(([candidate]) => candidate === file)
        .map(([, project]) => project);
    expect(projects('campaign-home.spec.ts')).toEqual(
      projects('access.spec.ts'),
    );
  }
});

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
