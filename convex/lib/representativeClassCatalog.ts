import type { Doc } from '../_generated/dataModel';

// Representative prepared-sheet seed data, not a curated Catalog Release.
// Pathfinder RPG Core Rulebook class tables: cleric p. 40, fighter p. 56,
// rogue p. 68 and wizard p. 80. Feature curation is tracked separately.
export const representativeClassCatalog = [
  {
    sources: [{ book: 'Pathfinder RPG Core Rulebook', pages: '56' }],
    stacksWithItself: false,
    name: 'Fighter',
    ruleIdentity: 'fighter',
    modifiers: [],
    detail: {
      kind: 'class',
      classKind: 'base',
      hitDie: 10,
      bab: 'full',
      saves: { fort: 'good', ref: 'poor', will: 'poor' },
      skillRanksPerLevel: 2,
      classSkills: [],
      featuresByLevel: [],
      picksByLevel: [],
    },
  },
  {
    sources: [{ book: 'Pathfinder RPG Core Rulebook', pages: '80' }],
    stacksWithItself: false,
    name: 'Wizard',
    ruleIdentity: 'wizard',
    modifiers: [],
    detail: {
      kind: 'class',
      classKind: 'base',
      hitDie: 6,
      bab: 'half',
      saves: { fort: 'poor', ref: 'poor', will: 'good' },
      skillRanksPerLevel: 2,
      classSkills: [],
      featuresByLevel: [],
      picksByLevel: [],
    },
  },
  {
    sources: [{ book: 'Pathfinder RPG Core Rulebook', pages: '68' }],
    stacksWithItself: false,
    name: 'Rogue',
    ruleIdentity: 'rogue',
    modifiers: [],
    detail: {
      kind: 'class',
      classKind: 'base',
      hitDie: 8,
      bab: 'threeQuarters',
      saves: { fort: 'poor', ref: 'good', will: 'poor' },
      skillRanksPerLevel: 8,
      classSkills: [],
      featuresByLevel: [],
      picksByLevel: [],
    },
  },
  {
    sources: [{ book: 'Pathfinder RPG Core Rulebook', pages: '40' }],
    stacksWithItself: false,
    name: 'Cleric',
    ruleIdentity: 'cleric',
    modifiers: [],
    detail: {
      kind: 'class',
      classKind: 'base',
      hitDie: 8,
      bab: 'threeQuarters',
      saves: { fort: 'good', ref: 'poor', will: 'good' },
      skillRanksPerLevel: 2,
      classSkills: [],
      featuresByLevel: [],
      picksByLevel: [],
    },
  },
] satisfies Omit<
  Extract<Doc<'catalogEntry'>, { detail: { kind: 'class' } }>,
  '_id' | '_creationTime' | 'scope' | 'characterId'
>[];
