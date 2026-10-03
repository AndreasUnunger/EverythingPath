// Calculation identity is provisional until the first Catalog Release activation.
// Intentional preactivation changes update this pin and recorded expectations together.
// After activation, retain the implementation and coordinate new identity activation.
// See tests/catalogRuntimeCompatibility.test.ts and docs/catalog-import/releases.md.
export const catalogRuntimeCompatibility = {
  schema: 'character-sheet-v1',
  calculation:
    'sha256:516db770a32f9bd70bf6f9f00529bd81c0073ff9d6a431feffc69d7f24ed53bf',
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
  'src/lib/character-sheet-archetypes.ts',
  'src/lib/character-sheet-archetype-helpers.ts',
  'src/lib/character-sheet-attacks.ts',
] as const;
