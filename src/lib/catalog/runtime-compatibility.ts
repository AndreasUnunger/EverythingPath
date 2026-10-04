// Calculation identity is provisional until the first Catalog Release activation.
// Intentional preactivation changes update this pin and recorded expectations together.
// After activation, retain the implementation and coordinate new identity activation.
// See tests/catalogRuntimeCompatibility.test.ts and docs/catalog-import/releases.md.
export const catalogRuntimeCompatibility = {
  schema: 'character-sheet-v1',
  calculation:
    'sha256:cbdc087920f8f8027046422551e15dbb0151488bffd07ddc9375bead9021e539',
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
  'src/lib/character-sheet-prerequisites.ts',
  'src/lib/character-sheet-selection-rules.ts',
  'src/lib/character-sheet-proficiency-schema.ts',
  'src/lib/character-sheet-prerequisite-schema.ts',
  'src/lib/character-sheet-prerequisite-evaluation.ts',
  'src/lib/character-sheet-selection-slots.ts',
  'src/lib/character-sheet-selection.ts',
  'src/lib/character-sheet-linked-inputs.ts',
  'src/lib/catalog/representative-companion-rules.ts',
  'src/lib/character-sheet-linked-input-evaluation.ts',
  'src/lib/catalog/calculation-dispatch.ts',
  'convex/lib/catalogReleaseCompatibility.ts',
  'convex/lib/representativeSelectionCatalog.ts',
] as const;
