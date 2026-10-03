// Calculation identity is provisional until the first Catalog Release activation.
// Intentional preactivation changes update this pin and recorded expectations together.
// After activation, retain the implementation and coordinate new identity activation.
// See tests/catalogRuntimeCompatibility.test.ts and docs/catalog-import/releases.md.
export const catalogRuntimeCompatibility = {
  schema: 'character-sheet-v1',
  calculation:
    'sha256:cc474fdaf2c6250def0c92d4b9d290b396434c49abedcdf84c70cf685cf99abf',
} as const;

export const catalogCalculationV1Files = [
  'src/lib/character-sheet.ts',
  'src/lib/character-sheet-advancement.ts',
  'src/lib/character-sheet-formulas.ts',
  'convex/lib/militiaCharacterFacts.ts',
  'src/lib/character-sheet-grants.ts',
  'src/lib/character-sheet-entries.ts',
  'src/lib/character-sheet-skills.ts',
] as const;
