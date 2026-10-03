// Calculation identity is provisional until the first Catalog Release activation.
// Intentional preactivation changes update this pin and recorded expectations together.
// After activation, retain the implementation and coordinate new identity activation.
// See tests/catalogRuntimeCompatibility.test.ts and docs/catalog-import/releases.md.
export const catalogRuntimeCompatibility = {
  schema: 'character-sheet-v1',
  calculation:
    'sha256:07ff30d26f7390adf23ce462d28f99d90eafb653dc510e7938d56430ebde1a39',
} as const;

export const catalogCalculationV1Files = [
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
  'src/lib/character-sheet-casting-tables.ts',
  'src/lib/character-sheet-permanent-statistics.ts',
  'scripts/catalog/reviewed-casting-tables.json',
  'src/lib/character-sheet-abilities.ts',
  'src/lib/character-sheet-racial.ts',
] as const;
