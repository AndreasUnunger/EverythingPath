// The v1 calculation closure is frozen by catalogRuntimeCompatibility.test.ts.
// Changed behavior requires a separate implementation and coordinated activation.
export const catalogRuntimeCompatibility = {
  schema: 'character-sheet-v1',
  calculation:
    'sha256:d60ae774f5360e3e12f19acf68e8a9cfd08d1f55f1460721a7c36322db180cea',
} as const;

export const catalogCalculationV1Files = [
  'src/lib/character-sheet.ts',
  'src/lib/character-sheet-advancement.ts',
  'src/lib/character-sheet-formulas.ts',
  'convex/lib/militiaCharacterFacts.ts',
] as const;
