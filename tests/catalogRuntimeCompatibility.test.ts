import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import ts from 'typescript';
import {
  catalogCalculationV1Files,
  catalogRuntimeCompatibility,
} from '../src/lib/catalog/runtime-compatibility';

test('v1 calculation identity matches its pinned implementation and militia projection', () => {
  const expectedIdentity =
    'sha256:100c6860a865ce1b37074d6b494e07a17c8485b51680bc9fe5ab45f0214e4910';
  const compatibilityChangeMessage =
    'Calculation compatibility changed. Before the first Catalog Release activation, ' +
    'review the intentional change and update the pin in src/lib/catalog/runtime-compatibility.ts, ' +
    'this independent expected identity and current recorded expectations in the same change. ' +
    'After first activation, retain the old implementation and provide new identity dispatch ' +
    'and coordinated activation (#318/#319); updating the pin alone is unsafe. ' +
    'See docs/catalog-import/releases.md for the procedure.';
  expect(
    catalogRuntimeCompatibility.calculation,
    compatibilityChangeMessage,
  ).toBe(expectedIdentity);
  expect(catalogCalculationV1Files).toEqual([
    'src/lib/character-sheet.ts',
    'src/lib/character-sheet-advancement.ts',
    'src/lib/character-sheet-formulas.ts',
    'convex/lib/militiaCharacterFacts.ts',
    'src/lib/character-sheet-grants.ts',
    'src/lib/character-sheet-entries.ts',
    'src/lib/character-sheet-skills.ts',
    'src/lib/character-sheet-conditions.ts',
    'src/lib/catalog/data/reviewed-conditions.json',
    'src/lib/character-sheet-spellcasting.ts',
    'src/lib/character-sheet-spell-collections.ts',
    'src/lib/character-sheet-spell-warnings.ts',
    'src/lib/character-sheet-casting-tables.ts',
    'src/lib/character-sheet-permanent-statistics.ts',
    'scripts/catalog/reviewed-casting-tables.json',
    'src/lib/character-sheet-abilities.ts',
    'src/lib/character-sheet-racial.ts',
    'src/lib/character-sheet-equipment.ts',
    'src/lib/character-sheet-proficiencies.ts',
    'src/lib/character-sheet-proficiency-prerequisites.ts',
    'src/lib/character-sheet-armor-categories.ts',
    'src/lib/character-sheet-class-levels.ts',
  ]);
  const fingerprint = createHash('sha256');
  for (const path of catalogCalculationV1Files) {
    fingerprint.update(`${path}\0`);
    fingerprint.update(readFileSync(path));
    fingerprint.update('\0');
  }
  expect(
    `sha256:${fingerprint.digest('hex')}`,
    compatibilityChangeMessage,
  ).toBe(expectedIdentity);
  const importsByFile = [
    [
      './character-sheet-proficiency-prerequisites',
      'zod',
      './character-sheet-grants',
      './character-sheet-skills',
      './character-sheet-equipment',
      './character-sheet-proficiencies',
      './character-sheet-conditions',
      './character-sheet-spellcasting',
      './character-sheet-spell-collections',
      './character-sheet-racial',
      './character-sheet-advancement',
      './character-sheet-formulas',
      './character-sheet-abilities',
    ],
    ['./character-sheet', './character-sheet-skills'],
    [],
    [
      'convex/values',
      '../../src/lib/character-sheet',
      './preparedCharacterSheet',
    ],
    [
      './character-sheet',
      './character-sheet-racial',
      './character-sheet-entries',
    ],
    [],
    ['./character-sheet'],
    ['zod', './catalog/data/reviewed-conditions.json'],
    [],
    [
      './character-sheet-casting-tables',
      './character-sheet-permanent-statistics',
      './character-sheet-grants',
    ],
    ['./character-sheet-spell-warnings'],
    [],
    [
      '../../scripts/catalog/reviewed-casting-tables.json',
      'zod',
      './character-sheet-abilities',
    ],
    ['./character-sheet'],
    [],
    [],
    ['./character-sheet', './character-sheet-skills'],
    ['./character-sheet', './character-sheet-proficiencies'],
    [
      './character-sheet-grants',
      'zod',
      './character-sheet-class-levels',
      './character-sheet-armor-categories',
    ],
    [
      './character-sheet-grants',
      './character-sheet-class-levels',
      './character-sheet-proficiencies',
    ],
    [],
    ['./character-sheet-grants'],
  ];
  const exportsByFile: Record<string, string[]> = {
    'src/lib/character-sheet.ts': [
      './character-sheet-abilities',
      './character-sheet-proficiencies',
    ],
  };
  for (const [index, path] of catalogCalculationV1Files.entries()) {
    const ast = ts.createSourceFile(
      path,
      readFileSync(path, 'utf8'),
      ts.ScriptTarget.Latest,
    );
    const imports = ast.statements
      .filter(ts.isImportDeclaration)
      .filter((node) => !node.importClause?.isTypeOnly)
      .map((node) =>
        ts.isStringLiteral(node.moduleSpecifier)
          ? node.moduleSpecifier.text
          : 'unsupported',
      );
    expect(
      imports,
      `Runtime imports changed in ${path}. Review calculator dependencies and update ` +
        'the explicit closure and independent import expectations before recomputing its identity. ' +
        'See docs/catalog-import/releases.md for the preactivation and postactivation procedure.',
    ).toEqual(importsByFile[index]);
    const exports = ast.statements
      .filter(ts.isExportDeclaration)
      .filter((node) => node.moduleSpecifier && !node.isTypeOnly)
      .map((node) =>
        node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
          ? node.moduleSpecifier.text
          : 'unsupported',
      );
    expect(
      exports,
      `Runtime reexports changed in ${path}. Review calculator dependencies and update ` +
        'the explicit closure and independent reexport expectations before recomputing its identity. ' +
        'See docs/catalog-import/releases.md for the preactivation and postactivation procedure.',
    ).toEqual(exportsByFile[path] ?? []);
  }
});
