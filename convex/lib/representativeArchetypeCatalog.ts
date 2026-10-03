import type { CharacterSheetCatalogEntry } from '../../src/lib/character-sheet';
import type { Doc, Id } from '../_generated/dataModel';
import { representativeClassFeatureSchedules } from './representativeClassCatalog';

type Seed = CharacterSheetCatalogEntry & {
  sources: { book: string; pages: string }[];
};
type FeatureDetail = Extract<
  NonNullable<CharacterSheetCatalogEntry['detail']>,
  { kind: 'classFeature' }
>;
const core = (pages: string) => [
  { book: 'Pathfinder RPG Core Rulebook', pages },
];
const advanced = (pages: string) => [
  { book: 'Pathfinder RPG Advanced Player’s Guide', pages },
];

function feature({
  key,
  name,
  sources,
  detail = {},
  facts = {},
}: {
  key: string;
  name: string;
  sources: Seed['sources'];
  detail?: Omit<FeatureDetail, 'kind'>;
  facts?: Pick<Partial<Seed>, 'grantsSlots' | 'ruleIdentity'>;
}): Seed {
  return {
    _id: key,
    name,
    ruleIdentity: key,
    modifiers: [],
    sources,
    ...facts,
    detail: { kind: 'classFeature', ...detail },
  };
}

function increments({
  levels,
  key,
  name,
  sources,
  list,
}: {
  levels: number[];
  key: string;
  name: (index: number) => string;
  sources: Seed['sources'];
  list?: string;
}): Seed[] {
  return levels.map((level, index) =>
    feature({
      key: `${key}-${level}`,
      name: name(index),
      sources,
      detail: {
        parentFeature: key,
        part: String(level),
        ...(list
          ? { picksByLevel: [{ classLevel: level, list, count: 1 }] }
          : {}),
      },
    }),
  );
}

// Prepared-sheet specimens, not a curated release or complete class content.
// Source URLs, coverage limits and prose mechanics are recorded in
// docs/catalog-import/archetypes.md. Every schedule reference has a definition.
export const representativeArchetypeCatalog: Seed[] = [
  ...[1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map((level) =>
    feature({
      key: `fighter-bonus-feat-${level}`,
      name: 'Bonus Feat',
      sources: core('56'),
      detail: { parentFeature: 'fighter-bonus-feats', part: String(level) },
      facts: {
        grantsSlots: [{ kind: 'feat', count: 1, featTypes: ['combat'] }],
      },
    }),
  ),
  ...increments({
    levels: [2, 6, 10, 14, 18],
    key: 'fighter-bravery',
    name: (index) => `Bravery +${index + 1}`,
    sources: core('56'),
  }),
  ...increments({
    levels: [3, 7, 11, 15],
    key: 'fighter-armor-training',
    name: (index) => `Armor Training ${index + 1}`,
    sources: core('56'),
  }),
  ...increments({
    levels: [5, 9, 13, 17],
    key: 'fighter-weapon-training',
    name: (index) => `Weapon Training ${index + 1}`,
    sources: core('56–57'),
    list: 'Weapon groups',
  }),
  feature({
    key: 'fighter-armor-mastery',
    name: 'Armor Mastery',
    sources: core('57'),
  }),
  feature({
    key: 'fighter-weapon-mastery',
    name: 'Weapon Mastery',
    sources: core('57'),
    detail: {
      picksByLevel: [{ classLevel: 20, list: 'Weapon mastery', count: 1 }],
    },
  }),
  ...increments({
    levels: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19],
    key: 'rogue-sneak-attack',
    name: (index) => `Sneak Attack +${index + 1}d6`,
    sources: core('68'),
  }),
  feature({
    key: 'rogue-trapfinding',
    name: 'Trapfinding',
    sources: core('68'),
  }),
  feature({
    key: 'rogue-evasion',
    name: 'Evasion',
    sources: core('68'),
    detail: {},
    facts: { ruleIdentity: 'evasion' },
  }),
  ...increments({
    levels: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    key: 'rogue-talent',
    name: () => 'Rogue Talent',
    sources: core('68–69'),
    list: 'Rogue talents',
  }),
  ...increments({
    levels: [3, 6, 9, 12, 15, 18],
    key: 'rogue-trap-sense',
    name: (index) => `Trap Sense +${index + 1}`,
    sources: core('69'),
  }),
  feature({
    key: 'rogue-uncanny-dodge',
    name: 'Uncanny Dodge',
    sources: core('69'),
    detail: { duplicateUpgrade: 'rogue-improved-uncanny-dodge' },
    facts: { ruleIdentity: 'uncanny-dodge' },
  }),
  feature({
    key: 'rogue-improved-uncanny-dodge',
    name: 'Improved Uncanny Dodge',
    sources: core('69'),
    detail: {},
    facts: { ruleIdentity: 'improved-uncanny-dodge' },
  }),
  feature({
    key: 'rogue-advanced-talents',
    name: 'Advanced Talents',
    sources: core('69–70'),
  }),
  feature({
    key: 'rogue-master-strike',
    name: 'Master Strike',
    sources: core('70'),
  }),
  ...increments({
    levels: [2, 6, 10, 14, 18],
    key: 'fighter-archer-hawkeye',
    name: (index) => `Hawkeye +${index + 1}`,
    sources: advanced('104'),
  }),
  ...increments({
    levels: [3, 7, 11, 15, 19],
    key: 'fighter-archer-trick-shot',
    name: () => 'Trick Shot',
    sources: advanced('104'),
    list: 'Archer trick shots',
  }),
  ...increments({
    levels: [5, 9, 13, 17],
    key: 'fighter-archer-expert-archer',
    name: () => 'Expert Archer',
    sources: advanced('104'),
  }),
  feature({
    key: 'fighter-archer-safe-shot',
    name: 'Safe Shot',
    sources: advanced('104'),
  }),
  ...increments({
    levels: [13, 17],
    key: 'fighter-archer-evasive-archer',
    name: (index) => `Evasive Archer +${(index + 1) * 2}`,
    sources: advanced('104'),
  }),
  feature({
    key: 'fighter-archer-volley',
    name: 'Volley',
    sources: advanced('104'),
  }),
  feature({
    key: 'fighter-archer-ranged-defense',
    name: 'Ranged Defense',
    sources: advanced('104'),
  }),
  feature({
    key: 'fighter-archer-weapon-mastery',
    name: 'Weapon Mastery (Bow)',
    sources: advanced('104'),
    detail: {
      picksByLevel: [{ classLevel: 20, list: 'Bow weapon mastery', count: 1 }],
    },
  }),
  feature({
    key: 'rogue-scout-charge',
    name: 'Scout’s Charge',
    sources: advanced('134'),
  }),
  feature({
    key: 'rogue-scout-skirmisher',
    name: 'Skirmisher',
    sources: advanced('134'),
  }),
  {
    _id: 'fighter-archer',
    name: 'Archer',
    ruleIdentity: 'fighter-archer',
    modifiers: [],
    sources: advanced('104'),
    detail: {
      kind: 'archetype',
      classEntryIds: ['fighter'],
      replaces: (representativeClassFeatureSchedules.fighter ?? [])
        .filter(
          ({ catalogEntryId }) =>
            catalogEntryId.startsWith('fighter-bravery-') ||
            catalogEntryId.startsWith('fighter-armor-training-') ||
            catalogEntryId.startsWith('fighter-weapon-training-') ||
            catalogEntryId === 'fighter-armor-mastery' ||
            catalogEntryId === 'fighter-weapon-mastery',
        )
        .map((row) => ({
          ...row,
          scope: row.catalogEntryId.startsWith('fighter-weapon-training-')
            ? ('part' as const)
            : ('whole' as const),
        })),
      adds: [
        ...[2, 6, 10, 14, 18].map((classLevel) => ({
          classLevel,
          catalogEntryId: `fighter-archer-hawkeye-${classLevel}`,
        })),
        ...[3, 7, 11, 15, 19].map((classLevel) => ({
          classLevel,
          catalogEntryId: `fighter-archer-trick-shot-${classLevel}`,
        })),
        ...[5, 9, 13, 17].map((classLevel) => ({
          classLevel,
          catalogEntryId: `fighter-archer-expert-archer-${classLevel}`,
        })),
        { classLevel: 9, catalogEntryId: 'fighter-archer-safe-shot' },
        ...[13, 17].map((classLevel) => ({
          classLevel,
          catalogEntryId: `fighter-archer-evasive-archer-${classLevel}`,
        })),
        { classLevel: 17, catalogEntryId: 'fighter-archer-volley' },
        { classLevel: 19, catalogEntryId: 'fighter-archer-ranged-defense' },
        { classLevel: 20, catalogEntryId: 'fighter-archer-weapon-mastery' },
      ],
    },
  },
  {
    _id: 'rogue-scout',
    name: 'Scout',
    ruleIdentity: 'rogue-scout',
    modifiers: [],
    sources: advanced('134'),
    detail: {
      kind: 'archetype',
      classEntryIds: ['rogue'],
      replaces: [
        {
          classLevel: 4,
          catalogEntryId: 'rogue-uncanny-dodge',
          scope: 'whole',
        },
        {
          classLevel: 8,
          catalogEntryId: 'rogue-improved-uncanny-dodge',
          scope: 'whole',
        },
      ],
      adds: [
        { classLevel: 4, catalogEntryId: 'rogue-scout-charge' },
        { classLevel: 8, catalogEntryId: 'rogue-scout-skirmisher' },
      ],
    },
  },
];

type StoredSeed = Omit<
  Extract<
    Doc<'catalogEntry'>,
    {
      detail: {
        kind:
          | 'race'
          | 'racialTrait'
          | 'archetype'
          | 'classFeature'
          | 'feat'
          | 'trait';
      };
    }
  >,
  '_id' | '_creationTime' | 'scope' | 'characterId'
>;

export function materializeRepresentativeArchetypeCatalog(
  idForKey: (key: string) => Id<'catalogEntry'>,
): { key: string; definition: StoredSeed }[] {
  return representativeArchetypeCatalog.map((entry) => {
    const detail = entry.detail;
    if (detail?.kind !== 'archetype' && detail?.kind !== 'classFeature')
      throw new Error('Unsupported representative archetype seed');
    return {
      key: entry._id,
      definition: {
        name: entry.name ?? entry._id,
        ruleIdentity: entry.ruleIdentity,
        stacksWithItself: false,
        sources: entry.sources,
        modifiers: [],
        ...(entry.grantsSlots
          ? {
              grantsSlots: entry.grantsSlots.map((slot) => ({
                ...slot,
                featTypes: slot.featTypes ? [...slot.featTypes] : undefined,
                feats: slot.feats?.map(idForKey),
              })),
            }
          : {}),
        detail:
          detail.kind === 'archetype'
            ? {
                ...detail,
                classEntryIds: detail.classEntryIds.map(idForKey),
                replaces: detail.replaces.map((row) => ({
                  ...row,
                  catalogEntryId: idForKey(row.catalogEntryId),
                })),
                adds: detail.adds.map((row) => ({
                  ...row,
                  catalogEntryId: idForKey(row.catalogEntryId),
                })),
                classSkillsAdded: detail.classSkillsAdded
                  ? [...detail.classSkillsAdded]
                  : undefined,
                classSkillsRemoved: detail.classSkillsRemoved
                  ? [...detail.classSkillsRemoved]
                  : undefined,
                featureChanges: detail.featureChanges
                  ? [...detail.featureChanges]
                  : undefined,
                picksByLevel: detail.picksByLevel
                  ? [...detail.picksByLevel]
                  : undefined,
              }
            : {
                ...detail,
                duplicateUpgrade: detail.duplicateUpgrade
                  ? idForKey(detail.duplicateUpgrade)
                  : undefined,
                picksByLevel: detail.picksByLevel
                  ? [...detail.picksByLevel]
                  : undefined,
              },
      },
    };
  });
}
