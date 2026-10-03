import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import ts from 'typescript';
import {
  catalogCalculationV1Files,
  catalogRuntimeCompatibility,
} from '../src/lib/catalog/runtime-compatibility';

test('deployed v1 calculations retain their immutable implementation and militia projection', () => {
  const expectedIdentity =
    'sha256:d60ae774f5360e3e12f19acf68e8a9cfd08d1f55f1460721a7c36322db180cea';
  expect(catalogRuntimeCompatibility.calculation).toBe(expectedIdentity);
  expect(catalogCalculationV1Files).toEqual([
    'src/lib/character-sheet.ts',
    'src/lib/character-sheet-advancement.ts',
    'src/lib/character-sheet-formulas.ts',
    'convex/lib/militiaCharacterFacts.ts',
  ]);
  const fingerprint = createHash('sha256');
  for (const path of catalogCalculationV1Files) {
    fingerprint.update(`${path}\0`);
    fingerprint.update(readFileSync(path));
    fingerprint.update('\0');
  }
  expect(`sha256:${fingerprint.digest('hex')}`).toBe(expectedIdentity);
  const importsByFile = [
    ['zod', './character-sheet-advancement', './character-sheet-formulas'],
    ['./character-sheet'],
    [],
    [
      'convex/values',
      '../../src/lib/character-sheet',
      './preparedCharacterSheet',
    ],
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
    expect(imports).toEqual(importsByFile[index]);
  }
});
