// @vitest-environment node
import { expect, it } from 'vitest';
import {
  canonicalCaseKeys,
  caseKeys,
  deploymentFixtureSchema,
  fixtureCatalog,
} from '../fixtures/catalog';
import { requiredTests, workspaceCaseKey } from './matrix';

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
