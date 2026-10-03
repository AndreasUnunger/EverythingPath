// Calculation identity is provisional until the first Catalog Release activation.
// Intentional preactivation changes update this pin and recorded expectations together.
// After activation, retain the implementation and coordinate new identity activation.
// See tests/catalogRuntimeCompatibility.test.ts and docs/catalog-import/releases.md.
export const catalogRuntimeCompatibility = {
  schema: 'character-sheet-v1',
  calculation:
    'sha256:dc6fdd110c738d4b029221502a057c5282f8346c97189b333518e860f3ebe91a',
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
  'src/lib/character-sheet-equipment.ts',
  'src/lib/character-sheet-proficiencies.ts',
  'src/lib/character-sheet-proficiency-prerequisites.ts',
  'src/lib/character-sheet-armor-categories.ts',
  'src/lib/character-sheet-class-levels.ts',
] as const;
