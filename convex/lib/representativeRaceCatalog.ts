import type { CharacterSheetCatalogEntry } from '../../src/lib/character-sheet';
import type { Doc, Id } from '../_generated/dataModel';

type Seed = CharacterSheetCatalogEntry & {
  sources: { book: string; pages: string }[];
};
const core = (pages: string) => [
  { book: 'Pathfinder RPG Core Rulebook', pages },
];
const advanced = (pages: string) => [
  { book: 'Pathfinder RPG Advanced Race Guide', pages },
];
function race({
  key,
  name,
  sources,
  traits,
}: {
  key: string;
  name: string;
  sources: Seed['sources'];
  traits: string[];
}): Seed {
  return {
    _id: key,
    name,
    ruleIdentity: key,
    modifiers: [],
    sources,
    detail: {
      kind: 'race',
      racialHitDice: 0,
      size: 'medium',
      creatureTypes: ['humanoid'],
      creatureSubtypes: [key],
      racialTraits: traits,
    },
  };
}
function trait({
  key,
  name,
  owner,
  sources,
  facts = {},
  replaces = [],
}: {
  key: string;
  name: string;
  owner: string;
  sources: Seed['sources'];
  facts?: Omit<Partial<Seed>, 'sources'>;
  replaces?: string[];
}): Seed {
  return {
    _id: key,
    name,
    ruleIdentity: key,
    modifiers: [],
    sources,
    ...facts,
    detail: {
      kind: 'racialTrait',
      raceEntryIds: [owner],
      replaces,
      ...(facts.detail?.kind === 'racialTrait' ? facts.detail : {}),
    },
  };
}
const choice = [
  { target: 'ability.$choice', bonusType: 'racial', value: 2 },
] as const;

// Representative prepared-sheet data; full racial content and review belong to
// the catalog curation batches. Every referenced trait is seeded independently.
export const representativeRaceCatalog: Seed[] = [
  race({
    key: 'human',
    name: 'Human',
    sources: core('27'),
    traits: ['human-ability', 'human-bonus-feat', 'human-skilled'],
  }),
  race({
    key: 'elf',
    name: 'Elf',
    sources: core('22'),
    traits: [
      'elf-ability',
      'elf-keen-senses',
      'elf-low-light',
      'elf-familiarity',
    ],
  }),
  race({
    key: 'dwarf',
    name: 'Dwarf',
    sources: core('21'),
    traits: ['dwarf-ability', 'dwarf-greed', 'dwarf-familiarity'],
  }),
  race({
    key: 'half-elf',
    name: 'Half-Elf',
    sources: core('25'),
    traits: [
      'half-elf-ability',
      'half-elf-adaptability',
      'half-elf-blood',
      'half-elf-multitalented',
    ],
  }),
  {
    ...race({
      key: 'half-orc',
      name: 'Half-Orc',
      sources: core('26'),
      traits: ['half-orc-ability', 'half-orc-blood'],
    }),
    detail: {
      kind: 'race',
      racialHitDice: 0,
      size: 'medium',
      creatureTypes: ['humanoid'],
      creatureSubtypes: ['orc', 'human'],
      racialTraits: ['half-orc-ability', 'half-orc-blood'],
      allowedAlternateRaces: ['orc'],
    },
  },
  trait({
    key: 'human-ability',
    name: 'Ability Score',
    owner: 'human',
    sources: core('27'),
    facts: { modifiers: choice },
  }),
  trait({
    key: 'human-bonus-feat',
    name: 'Bonus Feat',
    owner: 'human',
    sources: core('27'),
    facts: { grantsSlots: [{ kind: 'feat', count: 1 }] },
  }),
  trait({
    key: 'human-skilled',
    name: 'Skilled',
    owner: 'human',
    sources: core('27'),
    facts: {
      detail: {
        kind: 'racialTrait',
        raceEntryIds: ['human'],
        replaces: [],
        bonusSkillRanksPerLevel: 1,
      },
    },
  }),
  trait({
    key: 'elf-ability',
    name: 'Ability Scores',
    owner: 'elf',
    sources: core('22'),
    facts: {
      modifiers: [
        { target: 'ability.dex', bonusType: 'racial', value: 2 },
        { target: 'ability.int', bonusType: 'racial', value: 2 },
        { target: 'ability.con', bonusType: 'racial', value: -2 },
      ],
    },
  }),
  trait({
    key: 'elf-keen-senses',
    name: 'Keen Senses',
    owner: 'elf',
    sources: core('22'),
    facts: {
      modifiers: [{ target: 'skill.per', bonusType: 'racial', value: 2 }],
    },
  }),
  trait({
    key: 'elf-low-light',
    name: 'Low-Light Vision',
    owner: 'elf',
    sources: core('22'),
  }),
  trait({
    key: 'elf-familiarity',
    name: 'Weapon Familiarity',
    owner: 'elf',
    sources: core('22'),
    facts: {
      proficiencies: [
        { baseType: 'longsword' },
        { baseType: 'rapier' },
        { baseType: 'longbow' },
        { baseType: 'shortbow' },
        { baseType: 'elven curve blade', asMartial: true },
      ],
    },
  }),
  trait({
    key: 'dwarf-ability',
    name: 'Ability Scores',
    owner: 'dwarf',
    sources: core('21'),
    facts: {
      modifiers: [
        { target: 'ability.con', bonusType: 'racial', value: 2 },
        { target: 'ability.wis', bonusType: 'racial', value: 2 },
        { target: 'ability.cha', bonusType: 'racial', value: -2 },
      ],
    },
  }),
  trait({
    key: 'dwarf-greed',
    name: 'Greed',
    owner: 'dwarf',
    sources: core('21'),
    facts: {
      modifiers: [
        {
          target: 'skill.apr',
          bonusType: 'racial',
          value: 2,
          condition: {
            situation: { local: 'Nonmagical precious metals or gemstones' },
          },
        },
      ],
    },
  }),
  trait({
    key: 'dwarf-familiarity',
    name: 'Weapon Familiarity',
    owner: 'dwarf',
    sources: core('21'),
    facts: {
      proficiencies: [
        { baseType: 'battleaxe' },
        { baseType: 'heavy pick' },
        { baseType: 'warhammer' },
        { baseType: 'dwarven waraxe', asMartial: true },
        { baseType: 'dwarven urgrosh', asMartial: true },
      ],
    },
  }),
  trait({
    key: 'half-elf-ability',
    name: 'Ability Score',
    owner: 'half-elf',
    sources: core('25'),
    facts: { modifiers: choice },
  }),
  trait({
    key: 'half-elf-adaptability',
    name: 'Adaptability',
    owner: 'half-elf',
    sources: core('25'),
    facts: {
      grantsSlots: [{ kind: 'feat', count: 1, feats: ['skill-focus'] }],
    },
  }),
  trait({
    key: 'half-elf-blood',
    name: 'Elf Blood',
    owner: 'half-elf',
    sources: core('25'),
    facts: { countsAsRaces: ['elf', 'human'] },
  }),
  trait({
    key: 'half-elf-multitalented',
    name: 'Multitalented',
    owner: 'half-elf',
    sources: core('25'),
    facts: {
      detail: {
        kind: 'racialTrait',
        raceEntryIds: ['half-elf'],
        replaces: [],
        favoredClassCount: 2,
      },
    },
  }),
  trait({
    key: 'half-orc-ability',
    name: 'Ability Score',
    owner: 'half-orc',
    sources: core('26'),
    facts: { modifiers: choice },
  }),
  trait({
    key: 'half-orc-blood',
    name: 'Orc Blood',
    owner: 'half-orc',
    sources: core('26'),
    facts: { countsAsRaces: ['human', 'orc'] },
  }),
  {
    _id: 'skill-focus',
    name: 'Skill Focus',
    ruleIdentity: 'skill-focus',
    modifiers: [],
    sources: core('134'),
    detail: { kind: 'feat' },
  },
  trait({
    key: 'human-heart-of-streets',
    name: 'Heart of the Streets',
    owner: 'human',
    sources: [{ book: 'Pathfinder RPG Advanced Player’s Guide', pages: '23' }],
    facts: {
      modifiers: [
        {
          target: 'ac.other',
          bonusType: 'dodge',
          value: 1,
          condition: { situation: { local: 'At least two adjacent allies' } },
        },
      ],
    },
    replaces: ['human-skilled'],
  }),
  trait({
    key: 'half-elf-ancestral-arms',
    name: 'Ancestral Arms',
    owner: 'half-elf',
    sources: advanced('42'),
    facts: { proficiencies: [{ choice: true }] },
    replaces: ['half-elf-adaptability'],
  }),
  trait({
    key: 'dwarf-craftsman',
    name: 'Craftsman',
    owner: 'dwarf',
    sources: advanced('12'),
    facts: {
      modifiers: [
        { target: 'skill.crf', bonusType: 'racial', value: 2 },
        { target: 'skill.pro', bonusType: 'racial', value: 2 },
      ],
    },
    replaces: ['dwarf-greed'],
  }),
  trait({
    key: 'elf-illustrative-subrace-ability',
    name: 'Illustrative Elf Subrace',
    owner: 'elf',
    sources: [
      {
        book: 'Representative illustrative fixture',
        pages: 'Not curated content',
      },
    ],
    facts: {
      modifiers: [
        { target: 'ability.dex', bonusType: 'racial', value: 2 },
        { target: 'ability.cha', bonusType: 'racial', value: 2 },
        { target: 'ability.con', bonusType: 'racial', value: -2 },
      ],
      detail: {
        kind: 'racialTrait',
        raceEntryIds: ['elf'],
        replaces: ['elf-ability'],
        subrace: 'Illustrative Elf Subrace',
      },
    },
  }),
  trait({
    key: 'elf-illustrative-subrace-low-light',
    name: 'Low-light Override (Illustrative Elf Subrace)',
    owner: 'elf',
    sources: [
      {
        book: 'Representative illustrative fixture',
        pages: 'Not curated content',
      },
    ],
    facts: {
      detail: {
        kind: 'racialTrait',
        raceEntryIds: ['elf'],
        replaces: ['elf-low-light'],
        subrace: 'Illustrative Elf Subrace',
      },
    },
  }),
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
export function materializeRepresentativeRaceCatalog(
  idForKey: (key: string) => Id<'catalogEntry'>,
): { key: string; definition: StoredSeed }[] {
  return representativeRaceCatalog.map((entry) => {
    const detail = entry.detail;
    if (
      detail?.kind !== 'race' &&
      detail?.kind !== 'racialTrait' &&
      detail?.kind !== 'feat'
    )
      throw new Error('Unsupported representative race seed');
    const storedDetail: StoredSeed['detail'] =
      detail.kind === 'race'
        ? {
            ...detail,
            racialTraits: detail.racialTraits.map(idForKey),
            creatureTypes: [...(detail.creatureTypes ?? [])],
            creatureSubtypes: [...(detail.creatureSubtypes ?? [])],
            racialProgression: undefined,
            allowedAlternateRaces: detail.allowedAlternateRaces
              ? [...detail.allowedAlternateRaces]
              : undefined,
          }
        : detail.kind === 'racialTrait'
          ? {
              ...detail,
              raceEntryIds: detail.raceEntryIds.map(idForKey),
              replaces: detail.replaces.map(idForKey),
              unresolvedReplacements: detail.unresolvedReplacements
                ? [...detail.unresolvedReplacements]
                : undefined,
            }
          : detail;
    return {
      key: entry._id,
      definition: {
        name: entry.name ?? entry._id,
        ruleIdentity: entry.ruleIdentity,
        stacksWithItself: false,
        sources: entry.sources,
        modifiers: entry.modifiers.map((modifier) => {
          const { condition, ...fields } = modifier;
          return {
            ...fields,
            ...(condition
              ? {
                  condition: {
                    situation:
                      condition.situation &&
                      typeof condition.situation === 'object' &&
                      'option' in condition.situation
                        ? { option: idForKey(condition.situation.option) }
                        : condition.situation,
                    whileActive: condition.whileActive
                      ? idForKey(condition.whileActive)
                      : undefined,
                  },
                }
              : {}),
          };
        }),
        detail: storedDetail,
        ...(entry.countsAsRaces
          ? {
              countsAsRaces:
                'oneOf' in entry.countsAsRaces
                  ? { oneOf: [...entry.countsAsRaces.oneOf] }
                  : [...entry.countsAsRaces],
            }
          : {}),
        ...(entry.proficiencies
          ? { proficiencies: [...entry.proficiencies] }
          : {}),
        ...(entry.grantsSlots
          ? {
              grantsSlots: entry.grantsSlots.map((slot) => ({
                ...slot,
                featTypes: slot.featTypes ? [...slot.featTypes] : undefined,
                feats: slot.feats?.map(idForKey),
              })),
            }
          : {}),
      },
    };
  });
}
