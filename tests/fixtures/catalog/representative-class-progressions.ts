import type { CharacterSheetCatalogEntry } from '../../../src/lib/character-sheet';

// Representative calculation fixtures, not a curated Catalog Release.
// Pathfinder RPG Core Rulebook class tables: cleric p. 40, fighter p. 56,
// rogue p. 68 and wizard p. 80. Feature curation is tracked separately.
export const representativeClassCatalog = [
  {
    _id: 'fighter',
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
    _id: 'wizard',
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
    _id: 'rogue',
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
    _id: 'cleric',
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
] satisfies CharacterSheetCatalogEntry[];

// Independent transcriptions of the tables, rather than generated expectations.
export const representativeClassSchedules = {
  fullBab: [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  ],
  threeQuartersBab: [
    0, 1, 2, 3, 3, 4, 5, 6, 6, 7, 8, 9, 9, 10, 11, 12, 12, 13, 14, 15,
  ],
  halfBab: [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10],
  goodSave: [2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12],
  poorSave: [0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6],
};
