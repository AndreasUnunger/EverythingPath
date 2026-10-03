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
    'sha256:025e5d1fc55b749d6bbc15533d1457e4513ad795394fe9f14f38d97dbaa1d21a';
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
      'zod',
      './character-sheet-grants',
      './character-sheet-advancement',
      './character-sheet-formulas',
    ],
    ['./character-sheet'],
    [],
    [
      'convex/values',
      '../../src/lib/character-sheet',
      './preparedCharacterSheet',
    ],
    ['./character-sheet', './character-sheet-entries'],
    [],
  ];
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
  }
});
