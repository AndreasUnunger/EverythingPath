// PROTOTYPE (throwaway, #208) — a small PF1 Core Rulebook catalog shaped like
// global Catalog Entries. Keys are `<kind>.<slug>`.

import { SPELLS } from './spell-catalog';
import type {
  AbilityKey,
  CatalogEntry,
  Casting,
  FeatureSpellcasting,
  SchoolKey,
  FeatureGroup,
  Modifier,
  ModifierCondition,
  SituationKey,
  SkillKey,
  Weapon,
} from './types';

export const ABILITY_LABEL: Record<AbilityKey, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};

export const ABILITY_SHORT: Record<AbilityKey, string> = {
  str: 'Str',
  dex: 'Dex',
  con: 'Con',
  int: 'Int',
  wis: 'Wis',
  cha: 'Cha',
};

/** PROTOTYPE (#216): display text of each situation, after the CRB wording. */
export const SITUATION_TEXT: Record<SituationKey, string> = {
  traps: 'vs. traps',
  fear: 'vs. fear',
  spells: 'vs. spells and spell-like abilities',
  poison: 'vs. poison',
  enchantment: 'vs. enchantment spells and effects',
  giants: 'vs. giants',
  orcsGoblinoids: 'vs. orcs and goblinoids',
  bullRushTrip: 'vs. bull rush and trip while standing on the ground',
  sneak: 'when flanking or the target is denied its Dex bonus',
  castDefensively: 'to cast defensively or while grappled',
};

export type SkillInfo = {
  key: SkillKey;
  name: string;
  ability: AbilityKey;
  armorCheckPenalty: boolean;
  trainedOnly: boolean;
};

const skill = (
  key: SkillKey,
  name: string,
  ability: AbilityKey,
  armorCheckPenalty = false,
  trainedOnly = false,
): SkillInfo => ({ key, name, ability, armorCheckPenalty, trainedOnly });

export const SKILLS: SkillInfo[] = [
  skill('acrobatics', 'Acrobatics', 'dex', true),
  skill('appraise', 'Appraise', 'int'),
  skill('bluff', 'Bluff', 'cha'),
  skill('climb', 'Climb', 'str', true),
  skill('craftAlchemy', 'Craft (alchemy)', 'int'),
  skill('craftWeapons', 'Craft (weapons)', 'int'),
  skill('diplomacy', 'Diplomacy', 'cha'),
  skill('disableDevice', 'Disable Device', 'dex', true, true),
  skill('disguise', 'Disguise', 'cha'),
  skill('escapeArtist', 'Escape Artist', 'dex', true),
  skill('fly', 'Fly', 'dex', true),
  skill('handleAnimal', 'Handle Animal', 'cha', false, true),
  skill('heal', 'Heal', 'wis'),
  skill('intimidate', 'Intimidate', 'cha'),
  skill('knowledgeArcana', 'Knowledge (arcana)', 'int', false, true),
  skill(
    'knowledgeDungeoneering',
    'Knowledge (dungeoneering)',
    'int',
    false,
    true,
  ),
  skill('knowledgeLocal', 'Knowledge (local)', 'int', false, true),
  skill('knowledgeNature', 'Knowledge (nature)', 'int', false, true),
  skill('knowledgeReligion', 'Knowledge (religion)', 'int', false, true),
  skill('linguistics', 'Linguistics', 'int', false, true),
  skill('perception', 'Perception', 'wis'),
  skill('performOratory', 'Perform (oratory)', 'cha'),
  skill('professionSoldier', 'Profession (soldier)', 'wis', false, true),
  skill('ride', 'Ride', 'dex', true),
  skill('senseMotive', 'Sense Motive', 'wis'),
  skill('sleightOfHand', 'Sleight of Hand', 'dex', true, true),
  skill('spellcraft', 'Spellcraft', 'int', false, true),
  skill('stealth', 'Stealth', 'dex', true),
  skill('survival', 'Survival', 'wis'),
  skill('swim', 'Swim', 'str', true),
  skill('useMagicDevice', 'Use Magic Device', 'cha', false, true),
];

export const SKILL_BY_KEY = Object.fromEntries(
  SKILLS.map((s) => [s.key, s]),
) as Record<SkillKey, SkillInfo>;

const m = (
  target: Modifier['target'],
  bonusType: Modifier['bonusType'],
  value: Modifier['value'],
  condition?: ModifierCondition,
): Modifier =>
  condition
    ? { target, bonusType, value, condition }
    : { target, bonusType, value };

/** A situational condition; `text` defaults to `SITUATION_TEXT[key]`. */
const vs = (key: SituationKey, text?: string): ModifierCondition => ({
  situation: { key, text: text ?? SITUATION_TEXT[key] },
});

const CRAFT: SkillKey[] = ['craftAlchemy', 'craftWeapons'];
const KNOWLEDGE: SkillKey[] = [
  'knowledgeArcana',
  'knowledgeDungeoneering',
  'knowledgeLocal',
  'knowledgeNature',
  'knowledgeReligion',
];

// ---------------------------------------------------------------- races

const races: CatalogEntry[] = [
  {
    key: 'race.human',
    scope: 'global',
    name: 'Human',
    stacksWithItself: false,
    summary: '+2 to one ability score, bonus feat, skilled',
    modifiers: [m('ability.$choice', 'racial', 2)],
    detail: {
      kind: 'race',
      racialHitDice: 0,
      size: 'medium',
      speed: 30,
      chooseAbility: true,
      bonusFeat: true,
      bonusSkillRanksPerLevel: 1,
      traitsText: [
        'Bonus feat at 1st level',
        'Skilled: +1 skill rank per level',
      ],
    },
  },
  {
    key: 'race.dwarf',
    scope: 'global',
    name: 'Dwarf',
    stacksWithItself: false,
    summary: '+2 Con, +2 Wis, −2 Cha; slow and steady',
    modifiers: [
      m('ability.con', 'racial', 2),
      m('ability.wis', 'racial', 2),
      m('ability.cha', 'racial', -2),
      // Hatred, defensive training, hardy (two situations), stability.
      m('attack', 'untyped', 1, vs('orcsGoblinoids')),
      m('ac.other', 'dodge', 4, vs('giants')),
      m('saves', 'racial', 2, vs('poison')),
      m('saves', 'racial', 2, vs('spells')),
      m('cmd', 'racial', 4, vs('bullRushTrip')),
    ],
    detail: {
      kind: 'race',
      racialHitDice: 0,
      size: 'medium',
      speed: 20,
      chooseAbility: false,
      bonusFeat: false,
      bonusSkillRanksPerLevel: 0,
      traitsText: [
        'Darkvision 60 ft.',
        'Hatred: +1 attack vs. orcs and goblinoids',
        'Defensive training: +4 dodge AC vs. giants',
        'Hardy: +2 saves vs. poison, spells and spell-like abilities',
        'Stability: +4 CMD vs. bull rush and trip',
      ],
    },
  },
  {
    key: 'race.elf',
    scope: 'global',
    name: 'Elf',
    stacksWithItself: false,
    summary: '+2 Dex, +2 Int, −2 Con; keen senses',
    modifiers: [
      m('ability.dex', 'racial', 2),
      m('ability.int', 'racial', 2),
      m('ability.con', 'racial', -2),
      m('skill.perception', 'racial', 2),
      m('saves', 'racial', 2, vs('enchantment')),
    ],
    detail: {
      kind: 'race',
      racialHitDice: 0,
      size: 'medium',
      speed: 30,
      chooseAbility: false,
      bonusFeat: false,
      bonusSkillRanksPerLevel: 0,
      traitsText: [
        'Low-light vision',
        'Elven immunities: immune to sleep, +2 vs. enchantment',
        'Elven magic: +2 to overcome spell resistance',
        'Keen senses: +2 Perception',
      ],
    },
  },
  {
    key: 'race.halfOrc',
    scope: 'global',
    name: 'Half-orc',
    stacksWithItself: false,
    summary: '+2 to one ability score; intimidating',
    modifiers: [
      m('ability.$choice', 'racial', 2),
      m('skill.intimidate', 'racial', 2),
    ],
    detail: {
      kind: 'race',
      racialHitDice: 0,
      size: 'medium',
      speed: 30,
      chooseAbility: true,
      bonusFeat: false,
      bonusSkillRanksPerLevel: 0,
      traitsText: [
        'Darkvision 60 ft.',
        'Intimidating: +2 Intimidate',
        'Orc ferocity',
      ],
    },
  },
  {
    key: 'race.halfling',
    scope: 'global',
    name: 'Halfling',
    stacksWithItself: false,
    summary: '+2 Dex, +2 Cha, −2 Str; small, lucky',
    modifiers: [
      m('ability.dex', 'racial', 2),
      m('ability.cha', 'racial', 2),
      m('ability.str', 'racial', -2),
      m('ac.other', 'size', 1),
      m('attack', 'size', 1),
      m('cmb', 'size', -1),
      m('cmd', 'size', -1),
      m('skill.stealth', 'size', 4),
      m('saves', 'racial', 1),
      m('saves', 'racial', 2, vs('fear')),
      m('skill.perception', 'racial', 2),
      m('skill.acrobatics', 'racial', 2),
      m('skill.climb', 'racial', 2),
    ],
    detail: {
      kind: 'race',
      racialHitDice: 0,
      size: 'small',
      speed: 20,
      chooseAbility: false,
      bonusFeat: false,
      bonusSkillRanksPerLevel: 0,
      traitsText: [
        'Small: +1 AC and attack, −1 CMB/CMD, +4 Stealth',
        'Halfling luck: +1 on all saves',
        'Fearless: +2 vs. fear',
        'Keen senses, sure-footed',
      ],
    },
  },
];

// ---------------------------------------------------------- class features

const feature = (
  key: string,
  name: string,
  summary: string,
  opts: Partial<Pick<CatalogEntry, 'stacksWithItself' | 'modifiers'>> & {
    group?: FeatureGroup;
    duplicateUpgrade?: { catalogKey: string; rule: string };
    damageDice?: Extract<
      CatalogEntry['detail'],
      { kind: 'classFeature' }
    >['damageDice'];
    spellcasting?: FeatureSpellcasting;
  } = {},
): CatalogEntry => ({
  key,
  scope: 'global',
  name,
  summary,
  stacksWithItself: opts.stacksWithItself ?? false,
  modifiers: opts.modifiers ?? [],
  detail: {
    kind: 'classFeature',
    group: opts.group,
    duplicateUpgrade: opts.duplicateUpgrade,
    damageDice: opts.damageDice,
    spellcasting: opts.spellcasting,
  },
});

const UNCANNY_UPGRADE = {
  catalogKey: 'cf.improvedUncannyDodge',
  rule: 'A character who gains uncanny dodge from two classes gains improved uncanny dodge instead.',
};

const classFeatures: CatalogEntry[] = [
  // Barbarian
  feature(
    'cf.fastMovement',
    'Fast Movement',
    '+10 ft. land speed in light or medium armor',
  ),
  feature(
    'cf.rage',
    'Rage',
    '4 + Con mod rounds/day, +2 per barbarian level after 1st',
  ),
  feature('cf.uncannyDodge', 'Uncanny Dodge', 'Cannot be caught flat-footed', {
    duplicateUpgrade: UNCANNY_UPGRADE,
  }),
  feature(
    'cf.improvedUncannyDodge',
    'Improved Uncanny Dodge',
    'Can no longer be flanked',
  ),
  feature(
    'cf.trapSense',
    'Trap Sense',
    '+1 Reflex and dodge AC vs. traps; stacks across classes',
    {
      stacksWithItself: true,
      modifiers: [
        m('save.ref', 'untyped', 1, vs('traps')),
        m('ac.other', 'dodge', 1, vs('traps')),
      ],
    },
  ),
  feature('cf.damageReduction', 'Damage Reduction', 'DR 1/—', {
    stacksWithItself: true,
  }),
  // Rage powers
  feature(
    'rp.powerfulBlow',
    'Rage power: Powerful Blow',
    'Once per rage, extra damage on one hit',
    {
      group: 'ragePower',
    },
  ),
  feature(
    'rp.superstition',
    'Rage power: Superstition',
    '+2 morale on saves vs. spells, +1 per 4 barbarian levels, while raging',
    {
      group: 'ragePower',
      modifiers: [
        m(
          'saves',
          'morale',
          { formula: '2 + floor(@classLevel.barbarian / 4)' },
          {
            situation: {
              key: 'spells',
              text: 'vs. spells, supernatural and spell-like abilities',
            },
            whileActive: {
              catalogKey: 'condition.raging',
              text: 'while raging',
            },
          },
        ),
      ],
    },
  ),
  feature(
    'rp.quickReflexes',
    'Rage power: Quick Reflexes',
    'One extra attack of opportunity while raging',
    {
      group: 'ragePower',
    },
  ),
  feature(
    'rp.strengthSurge',
    'Rage power: Strength Surge',
    'Add barbarian level to one Str check or CMB',
    {
      group: 'ragePower',
    },
  ),
  // Rogue
  feature(
    'cf.sneakAttack',
    'Sneak Attack',
    '+1d6 precision damage; stacks across sources',
    {
      stacksWithItself: true,
      damageDice: { die: 6, situation: 'sneak', rangedWithin: 30 },
    },
  ),
  feature(
    'cf.trapfinding',
    'Trapfinding',
    '+½ rogue level on Perception for traps and Disable Device',
    {
      modifiers: [
        m('skill.disableDevice', 'untyped', {
          formula: 'max(1, floor(@classLevel.rogue / 2))',
        }),
        m(
          'skill.perception',
          'untyped',
          { formula: 'max(1, floor(@classLevel.rogue / 2))' },
          vs('traps', 'to locate traps'),
        ),
      ],
    },
  ),
  feature(
    'cf.evasion',
    'Evasion',
    'No damage on a successful Reflex save for half',
  ),
  feature(
    'rt.fastStealth',
    'Rogue talent: Fast Stealth',
    'Move at full speed while using Stealth',
    {
      group: 'rogueTalent',
    },
  ),
  feature(
    'rt.combatTrick',
    'Rogue talent: Combat Trick',
    'Gain a bonus combat feat',
    {
      group: 'rogueTalent',
    },
  ),
  feature(
    'rt.surpriseAttack',
    'Rogue talent: Surprise Attack',
    'Opponents are flat-footed in the surprise round',
    {
      group: 'rogueTalent',
    },
  ),
  feature(
    'rt.trapSpotter',
    'Rogue talent: Trap Spotter',
    'Automatic Perception check within 10 ft. of a trap',
    {
      group: 'rogueTalent',
    },
  ),
  // Fighter
  feature(
    'cf.bravery',
    'Bravery',
    '+1 Will vs. fear; increases at 6th, 10th…',
    {
      stacksWithItself: true,
      modifiers: [m('save.will', 'untyped', 1, vs('fear'))],
    },
  ),
  feature(
    'cf.armorTraining',
    'Armor Training',
    'Armor check penalty −1, max Dex +1',
    {
      stacksWithItself: true,
    },
  ),
  feature(
    'cf.weaponTraining',
    'Weapon Training',
    '+1 attack and damage with one weapon group',
  ),
  // Cleric
  feature('cf.aura', 'Aura', 'Aura of the deity’s alignment'),
  feature(
    'cf.channelEnergy',
    'Channel Energy',
    '1d6, +1d6 every two cleric levels',
    {
      stacksWithItself: true,
    },
  ),
  feature(
    'cf.domains',
    'Domains',
    'Two domains with granted powers and domain spells',
  ),
  feature('cf.orisons', 'Orisons', '0-level divine spells'),
  feature(
    'cf.spontaneousCasting',
    'Spontaneous Casting',
    'Convert prepared spells to cure or inflict',
  ),
  feature(
    'cf.clericSpells',
    'Divine spells',
    'Prepared divine spellcasting (Wis)',
  ),
  // Wizard
  feature('cf.arcaneBond', 'Arcane Bond', 'Bonded object or familiar'),
  feature('cf.cantrips', 'Cantrips', '0-level arcane spells'),
  feature(
    'cf.wizardSpells',
    'Arcane spells',
    'Prepared arcane spellcasting (Int)',
  ),
  // Arcane schools (#233): the specialist school, one extra slot per level,
  // two opposition schools recorded on the sheet entry.
  ...(
    [
      ['conjuration', 'Conjuration'],
      ['divination', 'Divination'],
      ['evocation', 'Evocation'],
      ['illusion', 'Illusion'],
      ['transmutation', 'Transmutation'],
    ] as [SchoolKey, string][]
  ).map(([school, label]) =>
    feature(
      `cf.school.${school}`,
      `Arcane school: ${label}`,
      `Specialist in ${school}; +1 ${school} slot per spell level; two opposition schools`,
      {
        group: 'arcaneSchool',
        spellcasting: { school, extraSlot: 'school' },
      },
    ),
  ),
  // Cleric domains (#233): granted domain Spells and a domain slot.
  ...(
    [
      ['Fire', 'Fire'],
      ['Sun', 'Sun'],
      ['Animal', 'Animal'],
      ['Community', 'Community'],
    ] as [string, string][]
  ).map(([key, label]) =>
    feature(
      `cf.domain.${key.toLowerCase()}`,
      `${label} domain`,
      `Domain spells from the ${label} list; +1 domain slot per spell level`,
      {
        group: 'domain',
        spellcasting: {
          extraSlot: 'domain',
          grants: { list: 'domain', key },
        },
      },
    ),
  ),
  // Sorcerer (#233)
  feature(
    'cf.bloodline.arcane',
    'Arcane bloodline',
    'Bloodline spells: identify, invisibility, dispel magic…',
    {
      group: 'bloodline',
      spellcasting: { grants: { list: 'bloodline', key: 'Arcane' } },
    },
  ),
  feature(
    'cf.sorcererSpells',
    'Arcane spells',
    'Spontaneous arcane spellcasting (Cha)',
  ),
  feature(
    'cf.eschewMaterials',
    'Eschew Materials',
    'Cast without cheap material components',
  ),
  // Arcanist (#233)
  feature(
    'cf.arcaneReservoir',
    'Arcane Reservoir',
    '3 + ½ arcanist level points per day',
  ),
  feature(
    'cf.consumeSpells',
    'Consume Spells',
    'Expend a slot to regain reservoir points',
  ),
  feature(
    'cf.arcanistSpells',
    'Arcane spells',
    'Prepares from a spellbook, casts spontaneously from what is prepared (Int)',
  ),
  // Paladin (#233)
  feature('cf.auraOfGood', 'Aura of Good', 'An aura of good'),
  feature('cf.detectEvil', 'Detect Evil', 'At will, as the spell'),
  feature('cf.smiteEvil', 'Smite Evil', '1/day, +1 per three paladin levels'),
  feature('cf.divineGrace', 'Divine Grace', 'Cha bonus on all saving throws', {
    modifiers: [m('saves', 'untyped', { formula: 'max(0, @ability.cha.mod)' })],
  }),
  feature('cf.layOnHands', 'Lay on Hands', 'Heal ½ paladin level d6'),
  feature('cf.auraOfCourage', 'Aura of Courage', 'Immune to fear'),
  feature('cf.divineHealth', 'Divine Health', 'Immune to disease'),
  feature('cf.mercy', 'Mercy', 'Lay on hands also removes a condition'),
  feature(
    'cf.channelPositive',
    'Channel Positive Energy',
    'Two uses of lay on hands to channel energy',
  ),
  feature(
    'cf.paladinSpells',
    'Divine spells',
    'Prepared divine spellcasting (Cha), from 4th level',
  ),
  // Mystic theurge (#233)
  feature(
    'cf.combinedSpells',
    'Combined Spells',
    'Prepare spells of one class in the other’s slots',
  ),
];

// --------------------------------------------- casting (#233)

/**
 * The casting tables file's class data (data model "Casting tables"): each
 * casting class tag's `Casting`, with `record` and `table`. Classes without a
 * class entry here (bard, summoner, magus, druid, ranger, oracle) are used
 * only for a Spell Effect's caster level pre-fill.
 */
export const CASTING_BY_TAG: Record<string, Casting & { name: string }> = {
  wizard: {
    name: 'Wizard',
    classTag: 'wizard',
    type: 'prepared',
    spellKind: 'arcane',
    ability: 'int',
    cantrips: true,
    casterLevelOffset: 0,
    table: 'preparedHigh',
    record: 'book',
    bookName: 'Spellbook',
  },
  sorcerer: {
    name: 'Sorcerer',
    classTag: 'sorcerer',
    type: 'spontaneous',
    spellKind: 'arcane',
    ability: 'cha',
    cantrips: true,
    casterLevelOffset: 0,
    table: 'spontaneousHigh',
    record: 'known',
  },
  arcanist: {
    name: 'Arcanist',
    classTag: 'arcanist',
    type: 'hybrid',
    spellKind: 'arcane',
    ability: 'int',
    cantrips: true,
    casterLevelOffset: 0,
    table: 'hybridHigh',
    record: 'book',
    bookName: 'Spellbook',
  },
  cleric: {
    name: 'Cleric',
    classTag: 'cleric',
    type: 'prepared',
    spellKind: 'divine',
    ability: 'wis',
    cantrips: true,
    casterLevelOffset: 0,
    table: 'preparedHigh',
    record: 'none',
  },
  oracle: {
    name: 'Oracle',
    classTag: 'oracle',
    type: 'spontaneous',
    spellKind: 'divine',
    ability: 'cha',
    cantrips: true,
    casterLevelOffset: 0,
    table: 'spontaneousHigh',
    record: 'known',
  },
  druid: {
    name: 'Druid',
    classTag: 'druid',
    type: 'prepared',
    spellKind: 'divine',
    ability: 'wis',
    cantrips: true,
    casterLevelOffset: 0,
    table: 'preparedHigh',
    record: 'none',
  },
  paladin: {
    name: 'Paladin',
    classTag: 'paladin',
    type: 'prepared',
    spellKind: 'divine',
    ability: 'cha',
    cantrips: false,
    casterLevelOffset: -3,
    table: 'preparedLow',
    record: 'none',
  },
  ranger: {
    name: 'Ranger',
    classTag: 'ranger',
    type: 'prepared',
    spellKind: 'divine',
    ability: 'wis',
    cantrips: false,
    casterLevelOffset: -3,
    table: 'preparedLow',
    record: 'none',
  },
  bard: {
    name: 'Bard',
    classTag: 'bard',
    type: 'spontaneous',
    spellKind: 'arcane',
    ability: 'cha',
    cantrips: true,
    casterLevelOffset: 0,
    table: 'spontaneousMed',
    record: 'known',
  },
  summoner: {
    name: 'Summoner',
    classTag: 'summoner',
    type: 'spontaneous',
    spellKind: 'arcane',
    ability: 'cha',
    cantrips: true,
    casterLevelOffset: 0,
    table: 'spontaneousMed',
    record: 'known',
  },
  magus: {
    name: 'Magus',
    classTag: 'magus',
    type: 'prepared',
    spellKind: 'arcane',
    ability: 'int',
    cantrips: true,
    casterLevelOffset: 0,
    table: 'preparedMed',
    record: 'book',
    bookName: 'Spellbook',
  },
};

const casting = (tag: string): Casting => {
  const { name: _name, ...c } = CASTING_BY_TAG[tag]!;
  return c;
};

// ---------------------------------------------------------------- classes

const classes: CatalogEntry[] = [
  {
    key: 'class.fighter',
    scope: 'global',
    name: 'Fighter',
    stacksWithItself: false,
    summary: 'd10, full BAB, good Fort, 2 + Int ranks',
    modifiers: [],
    detail: {
      kind: 'class',
      classKind: 'base',
      hitDie: 10,
      bab: 'full',
      saves: { fort: 'good', ref: 'poor', will: 'poor' },
      skillRanksPerLevel: 2,
      classSkills: [
        'climb',
        ...CRAFT,
        'handleAnimal',
        'intimidate',
        'knowledgeDungeoneering',
        'professionSoldier',
        'ride',
        'survival',
        'swim',
      ],
      featuresByLevel: [
        { classLevel: 1, choose: 'combatFeat', label: 'Bonus combat feat' },
        { classLevel: 2, choose: 'combatFeat', label: 'Bonus combat feat' },
        { classLevel: 2, catalogKey: 'cf.bravery' },
        { classLevel: 3, catalogKey: 'cf.armorTraining' },
        { classLevel: 4, choose: 'combatFeat', label: 'Bonus combat feat' },
        { classLevel: 5, catalogKey: 'cf.weaponTraining' },
        { classLevel: 6, choose: 'combatFeat', label: 'Bonus combat feat' },
        { classLevel: 6, catalogKey: 'cf.bravery' },
        { classLevel: 7, catalogKey: 'cf.armorTraining' },
        { classLevel: 8, choose: 'combatFeat', label: 'Bonus combat feat' },
      ],
      favoredClassAlt: 'Human: +1 CMD vs. two combat maneuvers',
    },
  },
  {
    key: 'class.barbarian',
    scope: 'global',
    name: 'Barbarian',
    stacksWithItself: false,
    summary: 'd12, full BAB, good Fort, 4 + Int ranks',
    modifiers: [],
    detail: {
      kind: 'class',
      classKind: 'base',
      hitDie: 12,
      bab: 'full',
      saves: { fort: 'good', ref: 'poor', will: 'poor' },
      skillRanksPerLevel: 4,
      classSkills: [
        'acrobatics',
        'climb',
        ...CRAFT,
        'handleAnimal',
        'intimidate',
        'knowledgeNature',
        'perception',
        'ride',
        'survival',
        'swim',
      ],
      featuresByLevel: [
        { classLevel: 1, catalogKey: 'cf.fastMovement' },
        { classLevel: 1, catalogKey: 'cf.rage' },
        { classLevel: 2, choose: 'ragePower', label: 'Rage power' },
        { classLevel: 2, catalogKey: 'cf.uncannyDodge' },
        { classLevel: 3, catalogKey: 'cf.trapSense' },
        { classLevel: 4, choose: 'ragePower', label: 'Rage power' },
        { classLevel: 5, catalogKey: 'cf.improvedUncannyDodge' },
        { classLevel: 6, choose: 'ragePower', label: 'Rage power' },
        { classLevel: 6, catalogKey: 'cf.trapSense' },
        { classLevel: 7, catalogKey: 'cf.damageReduction' },
        { classLevel: 8, choose: 'ragePower', label: 'Rage power' },
      ],
      favoredClassAlt: 'Human: +1 round of rage per day',
    },
  },
  {
    key: 'class.rogue',
    scope: 'global',
    name: 'Rogue',
    stacksWithItself: false,
    summary: 'd8, ¾ BAB, good Ref, 8 + Int ranks',
    modifiers: [],
    detail: {
      kind: 'class',
      classKind: 'base',
      hitDie: 8,
      bab: 'threeQuarters',
      saves: { fort: 'poor', ref: 'good', will: 'poor' },
      skillRanksPerLevel: 8,
      classSkills: [
        'acrobatics',
        'appraise',
        'bluff',
        'climb',
        ...CRAFT,
        'diplomacy',
        'disableDevice',
        'disguise',
        'escapeArtist',
        'intimidate',
        'knowledgeDungeoneering',
        'knowledgeLocal',
        'linguistics',
        'perception',
        'performOratory',
        'professionSoldier',
        'senseMotive',
        'sleightOfHand',
        'stealth',
        'swim',
        'useMagicDevice',
      ],
      featuresByLevel: [
        { classLevel: 1, catalogKey: 'cf.sneakAttack' },
        { classLevel: 1, catalogKey: 'cf.trapfinding' },
        { classLevel: 2, catalogKey: 'cf.evasion' },
        { classLevel: 2, choose: 'rogueTalent', label: 'Rogue talent' },
        { classLevel: 3, catalogKey: 'cf.sneakAttack' },
        { classLevel: 3, catalogKey: 'cf.trapSense' },
        { classLevel: 4, choose: 'rogueTalent', label: 'Rogue talent' },
        { classLevel: 4, catalogKey: 'cf.uncannyDodge' },
        { classLevel: 5, catalogKey: 'cf.sneakAttack' },
        { classLevel: 6, choose: 'rogueTalent', label: 'Rogue talent' },
        { classLevel: 6, catalogKey: 'cf.trapSense' },
        { classLevel: 7, catalogKey: 'cf.sneakAttack' },
        { classLevel: 8, choose: 'rogueTalent', label: 'Rogue talent' },
        { classLevel: 8, catalogKey: 'cf.improvedUncannyDodge' },
      ],
      favoredClassAlt: 'Human: +1 rogue talent per 6 levels (1/6 talent)',
    },
  },
  {
    key: 'class.cleric',
    scope: 'global',
    name: 'Cleric',
    stacksWithItself: false,
    summary: 'd8, ¾ BAB, good Fort and Will, 2 + Int ranks',
    modifiers: [],
    detail: {
      kind: 'class',
      classKind: 'base',
      hitDie: 8,
      bab: 'threeQuarters',
      saves: { fort: 'good', ref: 'poor', will: 'good' },
      skillRanksPerLevel: 2,
      classSkills: [
        'appraise',
        ...CRAFT,
        'diplomacy',
        'heal',
        'knowledgeArcana',
        'knowledgeReligion',
        'linguistics',
        'professionSoldier',
        'senseMotive',
        'spellcraft',
      ],
      featuresByLevel: [
        { classLevel: 1, catalogKey: 'cf.aura' },
        { classLevel: 1, catalogKey: 'cf.channelEnergy' },
        { classLevel: 1, catalogKey: 'cf.domains' },
        { classLevel: 1, choose: 'domain', label: 'Domain', count: 2 },
        { classLevel: 1, catalogKey: 'cf.orisons' },
        { classLevel: 1, catalogKey: 'cf.spontaneousCasting' },
        { classLevel: 1, catalogKey: 'cf.clericSpells' },
        { classLevel: 3, catalogKey: 'cf.channelEnergy' },
        { classLevel: 5, catalogKey: 'cf.channelEnergy' },
        { classLevel: 7, catalogKey: 'cf.channelEnergy' },
      ],
      favoredClassAlt: 'Human: +1 to channel energy healing',
      casting: casting('cleric'),
    },
  },
  {
    key: 'class.wizard',
    scope: 'global',
    name: 'Wizard',
    stacksWithItself: false,
    summary: 'd6, ½ BAB, good Will, 2 + Int ranks',
    modifiers: [],
    detail: {
      kind: 'class',
      classKind: 'base',
      hitDie: 6,
      bab: 'half',
      saves: { fort: 'poor', ref: 'poor', will: 'good' },
      skillRanksPerLevel: 2,
      classSkills: [
        'appraise',
        ...CRAFT,
        'fly',
        ...KNOWLEDGE,
        'linguistics',
        'professionSoldier',
        'spellcraft',
      ],
      featuresByLevel: [
        { classLevel: 1, catalogKey: 'cf.arcaneBond' },
        { classLevel: 1, choose: 'arcaneSchool', label: 'Arcane school' },
        { classLevel: 1, catalogKey: 'cf.cantrips' },
        { classLevel: 1, catalogKey: 'feat.scribeScroll' },
        { classLevel: 1, catalogKey: 'cf.wizardSpells' },
        {
          classLevel: 5,
          choose: 'combatFeat',
          label: 'Bonus feat (metamagic, item creation or Spell Mastery)',
        },
      ],
      favoredClassAlt: 'Elf: +1 to arcane bond concentration… (1/2)',
      casting: casting('wizard'),
    },
  },
  {
    key: 'class.sorcerer',
    scope: 'global',
    name: 'Sorcerer',
    stacksWithItself: false,
    summary: 'd6, ½ BAB, good Will, 2 + Int ranks',
    modifiers: [],
    detail: {
      kind: 'class',
      classKind: 'base',
      hitDie: 6,
      bab: 'half',
      saves: { fort: 'poor', ref: 'poor', will: 'good' },
      skillRanksPerLevel: 2,
      classSkills: [
        'appraise',
        'bluff',
        ...CRAFT,
        'fly',
        'intimidate',
        'knowledgeArcana',
        'professionSoldier',
        'spellcraft',
        'useMagicDevice',
      ],
      featuresByLevel: [
        { classLevel: 1, choose: 'bloodline', label: 'Bloodline' },
        { classLevel: 1, catalogKey: 'cf.cantrips' },
        { classLevel: 1, catalogKey: 'cf.eschewMaterials' },
        { classLevel: 1, catalogKey: 'cf.sorcererSpells' },
      ],
      favoredClassAlt: 'Human: +1 spell known (lower than highest)',
      casting: casting('sorcerer'),
    },
  },
  {
    key: 'class.arcanist',
    scope: 'global',
    name: 'Arcanist',
    stacksWithItself: false,
    summary: 'd6, ½ BAB, good Will, 2 + Int ranks',
    modifiers: [],
    detail: {
      kind: 'class',
      classKind: 'base',
      hitDie: 6,
      bab: 'half',
      saves: { fort: 'poor', ref: 'poor', will: 'good' },
      skillRanksPerLevel: 2,
      classSkills: [
        'appraise',
        ...CRAFT,
        'fly',
        ...KNOWLEDGE,
        'linguistics',
        'professionSoldier',
        'spellcraft',
        'useMagicDevice',
      ],
      featuresByLevel: [
        { classLevel: 1, catalogKey: 'cf.arcaneReservoir' },
        { classLevel: 1, catalogKey: 'cf.consumeSpells' },
        { classLevel: 1, catalogKey: 'cf.cantrips' },
        { classLevel: 1, catalogKey: 'cf.arcanistSpells' },
      ],
      favoredClassAlt: 'Elf: +1/6 arcanist exploit',
      casting: casting('arcanist'),
    },
  },
  {
    key: 'class.paladin',
    scope: 'global',
    name: 'Paladin',
    stacksWithItself: false,
    summary: 'd10, full BAB, good Fort and Will, 2 + Int ranks',
    modifiers: [],
    detail: {
      kind: 'class',
      classKind: 'base',
      hitDie: 10,
      bab: 'full',
      saves: { fort: 'good', ref: 'poor', will: 'good' },
      skillRanksPerLevel: 2,
      classSkills: [
        ...CRAFT,
        'diplomacy',
        'handleAnimal',
        'heal',
        'knowledgeReligion',
        'professionSoldier',
        'ride',
        'senseMotive',
        'spellcraft',
      ],
      featuresByLevel: [
        { classLevel: 1, catalogKey: 'cf.auraOfGood' },
        { classLevel: 1, catalogKey: 'cf.detectEvil' },
        { classLevel: 1, catalogKey: 'cf.smiteEvil' },
        { classLevel: 2, catalogKey: 'cf.divineGrace' },
        { classLevel: 2, catalogKey: 'cf.layOnHands' },
        { classLevel: 3, catalogKey: 'cf.auraOfCourage' },
        { classLevel: 3, catalogKey: 'cf.divineHealth' },
        { classLevel: 3, catalogKey: 'cf.mercy' },
        { classLevel: 4, catalogKey: 'cf.channelPositive' },
        { classLevel: 4, catalogKey: 'cf.paladinSpells' },
      ],
      favoredClassAlt: 'Human: +1 to lay on hands healing',
      casting: casting('paladin'),
    },
  },
  {
    key: 'class.mysticTheurge',
    scope: 'global',
    name: 'Mystic theurge',
    stacksWithItself: false,
    summary:
      'Prestige: d6, ½ BAB, good Will, +1 arcane and +1 divine casting level per level',
    modifiers: [],
    detail: {
      kind: 'class',
      classKind: 'prestige',
      hitDie: 6,
      bab: 'half',
      saves: { fort: 'poor', ref: 'poor', will: 'good' },
      skillRanksPerLevel: 2,
      classSkills: [
        'knowledgeArcana',
        'knowledgeReligion',
        'senseMotive',
        'spellcraft',
      ],
      featuresByLevel: [{ classLevel: 1, catalogKey: 'cf.combinedSpells' }],
      castingAdvances: Array.from({ length: 10 }, (_, i) => [
        { classLevel: i + 1, count: 1, kind: 'arcane' as const },
        { classLevel: i + 1, count: 1, kind: 'divine' as const },
      ]).flat(),
    },
  },
];

// ------------------------------------------------------------------ feats

const feat = (
  key: string,
  name: string,
  summary: string,
  opts: {
    combat?: boolean;
    prerequisites?: Extract<
      CatalogEntry['detail'],
      { kind: 'feat' }
    >['prerequisites'];
    modifiers?: Modifier[];
    choice?: 'skill' | 'weapon' | 'school';
  } = {},
): CatalogEntry => ({
  key,
  scope: 'global',
  name,
  summary,
  stacksWithItself: false,
  modifiers: opts.modifiers ?? [],
  detail: {
    kind: 'feat',
    combat: opts.combat ?? false,
    prerequisites: opts.prerequisites ?? [],
    choice: opts.choice,
  },
});

const feats: CatalogEntry[] = [
  feat('feat.powerAttack', 'Power Attack', '−1 attack, +2 damage per 4 BAB', {
    combat: true,
    prerequisites: [
      { kind: 'ability', ability: 'str', min: 13 },
      { kind: 'bab', min: 1 },
    ],
  }),
  feat('feat.toughness', 'Toughness', '+3 hp, +1 per Hit Die beyond 3', {
    modifiers: [m('hp', 'untyped', { formula: 'max(3, @hitDice)' })],
  }),
  feat('feat.weaponFocus', 'Weapon Focus', '+1 attack with one weapon', {
    combat: true,
    prerequisites: [{ kind: 'bab', min: 1 }],
    choice: 'weapon',
    modifiers: [m('attack', 'untyped', 1, { weapon: '$choice' })],
  }),
  feat(
    'feat.twoWeaponFighting',
    'Two-Weapon Fighting',
    'Two-weapon penalties −4/−4, or −2/−2 with a light off-hand weapon',
    {
      combat: true,
      prerequisites: [{ kind: 'ability', ability: 'dex', min: 15 }],
    },
  ),
  feat('feat.dodge', 'Dodge', '+1 dodge bonus to AC', {
    combat: true,
    prerequisites: [{ kind: 'ability', ability: 'dex', min: 13 }],
    modifiers: [m('ac.other', 'dodge', 1)],
  }),
  feat(
    'feat.mobility',
    'Mobility',
    '+4 dodge AC vs. attacks of opportunity from movement',
    {
      combat: true,
      prerequisites: [
        { kind: 'ability', ability: 'dex', min: 13 },
        { kind: 'feat', catalogKey: 'feat.dodge' },
      ],
    },
  ),
  feat('feat.ironWill', 'Iron Will', '+2 on Will saves', {
    modifiers: [m('save.will', 'untyped', 2)],
  }),
  feat('feat.greatFortitude', 'Great Fortitude', '+2 on Fortitude saves', {
    modifiers: [m('save.fort', 'untyped', 2)],
  }),
  feat('feat.lightningReflexes', 'Lightning Reflexes', '+2 on Reflex saves', {
    modifiers: [m('save.ref', 'untyped', 2)],
  }),
  feat('feat.improvedInitiative', 'Improved Initiative', '+4 on initiative', {
    combat: true,
    modifiers: [m('init', 'untyped', 4)],
  }),
  feat(
    'feat.combatReflexes',
    'Combat Reflexes',
    'Extra attacks of opportunity (Dex mod)',
    {
      combat: true,
    },
  ),
  feat('feat.skillFocus', 'Skill Focus', '+3 on one skill (+6 at 10 ranks)', {
    choice: 'skill',
    modifiers: [m('skill.$choice', 'untyped', 3)],
  }),
  feat(
    'feat.weaponFinesse',
    'Weapon Finesse',
    'Dex instead of Str on attack with light weapons',
    {
      combat: true,
    },
  ),
  feat('feat.extraRage', 'Extra Rage', '+6 rounds of rage per day', {
    prerequisites: [{ kind: 'classFeature', catalogKey: 'cf.rage' }],
  }),
  feat(
    'feat.combatExpertise',
    'Combat Expertise',
    '−1 attack, +1 dodge AC per 4 BAB',
    {
      combat: true,
      prerequisites: [{ kind: 'ability', ability: 'int', min: 13 }],
    },
  ),
  feat(
    'feat.pointBlankShot',
    'Point-Blank Shot',
    '+1 attack and damage within 30 ft.',
    {
      combat: true,
    },
  ),
  feat('feat.alertness', 'Alertness', '+2 Perception and Sense Motive', {
    modifiers: [
      m('skill.perception', 'untyped', 2),
      m('skill.senseMotive', 'untyped', 2),
    ],
  }),
  feat('feat.scribeScroll', 'Scribe Scroll', 'Create magic scrolls', {
    prerequisites: [{ kind: 'casterLevel', min: 1 }],
  }),
  feat(
    'feat.spellFocus',
    'Spell Focus',
    '+1 to the save DCs of spells of one school',
    {
      choice: 'school',
      modifiers: [m('spellDC', 'untyped', 1, { school: '$choice' })],
    },
  ),
  feat(
    'feat.combatCasting',
    'Combat Casting',
    '+4 concentration to cast defensively or while grappled',
    {
      modifiers: [m('concentration', 'untyped', 4, vs('castDefensively'))],
    },
  ),
];

// ----------------------------------------------------------------- traits

const traits: CatalogEntry[] = [
  {
    key: 'trait.reactionary',
    scope: 'global',
    name: 'Reactionary',
    summary: '+2 trait bonus on initiative',
    stacksWithItself: false,
    modifiers: [m('init', 'trait', 2)],
    detail: { kind: 'trait', traitCategory: 'combat' },
  },
  {
    key: 'trait.resilient',
    scope: 'global',
    name: 'Resilient',
    summary: '+1 trait bonus on Fortitude saves',
    stacksWithItself: false,
    modifiers: [m('save.fort', 'trait', 1)],
    detail: { kind: 'trait', traitCategory: 'combat' },
  },
  {
    key: 'trait.indomitableFaith',
    scope: 'global',
    name: 'Indomitable Faith',
    summary: '+1 trait bonus on Will saves',
    stacksWithItself: false,
    modifiers: [m('save.will', 'trait', 1)],
    detail: { kind: 'trait', traitCategory: 'faith' },
  },
  {
    key: 'trait.magicalLineage',
    scope: 'global',
    name: 'Magical Lineage',
    summary: 'One spell counts 1 level lower for metamagic',
    stacksWithItself: false,
    modifiers: [],
    detail: { kind: 'trait', traitCategory: 'magic' },
  },
  {
    key: 'trait.suspicious',
    scope: 'global',
    name: 'Suspicious',
    summary: '+1 trait bonus on Sense Motive',
    stacksWithItself: false,
    modifiers: [m('skill.senseMotive', 'trait', 1)],
    detail: { kind: 'trait', traitCategory: 'social' },
  },
];

// ------------------------------------------------------------------ items

/** A weapon item (CRB Table 6-4 statistics, Medium). */
const weapon = (
  key: string,
  name: string,
  summary: string,
  stats: Weapon,
  modifiers: Modifier[] = [],
): CatalogEntry => ({
  key,
  scope: 'global',
  name,
  summary,
  stacksWithItself: false,
  modifiers,
  detail: { kind: 'item', consumable: false, weapon: stats },
});

/** Enhancement bonus of a magic weapon: attack and damage with that weapon only. */
const enhancement = (n: number): Modifier[] => [
  m('attack', 'enhancement', n, { weapon: '$self' }),
  m('damage', 'enhancement', n, { weapon: '$self' }),
];

const weapons: CatalogEntry[] = [
  weapon(
    'item.greataxe+1',
    '+1 greataxe',
    'Two-handed axe: 1d12, ×3, +1 enhancement',
    {
      base: 'greataxe',
      group: 'axes',
      handedness: 'twoHanded',
      dice: '1d12',
      threat: 20,
      mult: 3,
    },
    enhancement(1),
  ),
  weapon('item.kukri', 'Kukri', 'Light blade: 1d4, 18–20/×2', {
    base: 'kukri',
    group: 'light blades',
    handedness: 'light',
    dice: '1d4',
    threat: 18,
    mult: 2,
  }),
  weapon(
    'item.compositeLongbow2',
    'Composite longbow (+2 Str)',
    'Bow: 1d8, ×3, 110 ft., adds Str up to +2',
    {
      base: 'composite longbow',
      group: 'bows',
      handedness: 'ranged',
      dice: '1d8',
      threat: 20,
      mult: 3,
      rangeIncrement: 110,
      strRating: 2,
    },
  ),
  weapon(
    'item.dwarvenWaraxe',
    'Dwarven waraxe',
    'Axe, one-handed for dwarves: 1d10, ×3',
    {
      base: 'dwarven waraxe',
      group: 'axes',
      handedness: 'oneHanded',
      dice: '1d10',
      threat: 20,
      mult: 3,
    },
  ),
  weapon(
    'item.lightCrossbow',
    'Light crossbow',
    'Crossbow: 1d8, 19–20/×2, 80 ft.',
    {
      base: 'light crossbow',
      group: 'crossbows',
      handedness: 'ranged',
      dice: '1d8',
      threat: 19,
      mult: 2,
      rangeIncrement: 80,
    },
  ),
];

const items: CatalogEntry[] = [
  ...weapons,
  {
    key: 'item.chainShirt',
    scope: 'global',
    name: 'Chain shirt',
    summary: 'Light armor: +4 armor, max Dex +4, ACP −2',
    stacksWithItself: false,
    modifiers: [m('ac.armor', 'armor', 4)],
    detail: {
      kind: 'item',
      consumable: false,
      slot: 'armor',
      armorCheckPenalty: -2,
      maxDex: 4,
    },
  },
  {
    key: 'item.chainShirt+1',
    scope: 'global',
    name: '+1 chain shirt',
    summary: '+4 armor, +1 enhancement, max Dex +4, ACP −1',
    stacksWithItself: false,
    modifiers: [m('ac.armor', 'armor', 4), m('ac.armor', 'enhancement', 1)],
    detail: {
      kind: 'item',
      consumable: false,
      slot: 'armor',
      armorCheckPenalty: -1,
      maxDex: 4,
    },
  },
  {
    key: 'item.heavyWoodenShield',
    scope: 'global',
    name: 'Heavy wooden shield',
    summary: '+2 shield, ACP −2',
    stacksWithItself: false,
    modifiers: [m('ac.shield', 'shield', 2)],
    detail: {
      kind: 'item',
      consumable: false,
      slot: 'shield',
      armorCheckPenalty: -2,
    },
  },
  {
    key: 'item.cloakOfResistance1',
    scope: 'global',
    name: 'Cloak of resistance +1',
    summary: '+1 resistance on all saves',
    stacksWithItself: false,
    modifiers: [m('saves', 'resistance', 1)],
    detail: { kind: 'item', consumable: false, slot: 'shoulders' },
  },
  {
    key: 'item.ringOfProtection1',
    scope: 'global',
    name: 'Ring of protection +1',
    summary: '+1 deflection to AC',
    stacksWithItself: false,
    modifiers: [m('ac.other', 'deflection', 1)],
    detail: { kind: 'item', consumable: false, slot: 'ring' },
  },
  {
    key: 'item.amuletOfNaturalArmor1',
    scope: 'global',
    name: 'Amulet of natural armor +1',
    summary: '+1 enhancement to natural armor',
    stacksWithItself: false,
    modifiers: [m('ac.natural', 'enhancement', 1)],
    detail: { kind: 'item', consumable: false, slot: 'neck' },
  },
  {
    key: 'item.beltOfGiantStrength2',
    scope: 'global',
    name: 'Belt of giant strength +2',
    summary: '+2 enhancement to Strength',
    stacksWithItself: false,
    modifiers: [m('ability.str', 'enhancement', 2)],
    detail: { kind: 'item', consumable: false, slot: 'belt' },
  },
  {
    key: 'item.headbandOfVastIntelligence2',
    scope: 'global',
    name: 'Headband of vast intelligence +2',
    summary: '+2 enhancement to Intelligence',
    stacksWithItself: false,
    modifiers: [m('ability.int', 'enhancement', 2)],
    detail: { kind: 'item', consumable: false, slot: 'head' },
  },
  {
    key: 'item.bootsOfSpeed',
    scope: 'global',
    name: 'Boots of speed',
    summary: 'Haste for 10 rounds/day; one effect with haste',
    sourceKey: 'haste',
    stacksWithItself: false,
    modifiers: [
      m('attack', 'untyped', 1),
      m('ac.other', 'dodge', 1),
      m('save.ref', 'dodge', 1),
    ],
    detail: { kind: 'item', consumable: false, slot: 'feet' },
  },
  {
    key: 'item.potionBullsStrength',
    scope: 'global',
    name: 'Potion of bull’s strength',
    summary: 'Consumable: +4 enhancement to Strength for 3 minutes',
    stacksWithItself: false,
    modifiers: [m('ability.str', 'enhancement', 4)],
    detail: { kind: 'item', consumable: true },
  },
];

// ------------------------------------------------- spell effects (#233)

/** A Spell Effect: the Modifiers a running Spell grants. `@casterLevel` reads its sheet entry's caster level. */
const effect = (
  key: string,
  name: string,
  summary: string,
  spellKey: string,
  modifiers: Modifier[],
  opts: { sourceKey?: string; defaultCasterLevel?: number } = {},
): CatalogEntry => ({
  key,
  scope: 'global',
  name,
  summary,
  ...(opts.sourceKey ? { sourceKey: opts.sourceKey } : {}),
  stacksWithItself: false,
  modifiers,
  detail: {
    kind: 'spellEffect',
    spellKey,
    lastsOverOneDay: false,
    defaultCasterLevel: opts.defaultCasterLevel ?? 1,
  },
});

const spellEffects: CatalogEntry[] = [
  effect(
    'effect.bullsStrength',
    'Bull’s strength',
    '+4 enhancement to Strength, 1 min/level',
    'spell.bullsStrength',
    [m('ability.str', 'enhancement', 4)],
  ),
  effect(
    'effect.haste',
    'Haste',
    '+1 attack, +1 dodge AC and Reflex, extra attack',
    'spell.haste',
    [
      m('attack', 'untyped', 1),
      m('ac.other', 'dodge', 1),
      m('save.ref', 'dodge', 1),
    ],
    { sourceKey: 'haste' },
  ),
  effect(
    'effect.mageArmor',
    'Mage armor',
    '+4 armor bonus, 1 hour/level',
    'spell.mageArmor',
    [m('ac.armor', 'armor', 4)],
  ),
  effect(
    'effect.shieldOfFaith',
    'Shield of faith',
    '+2 deflection to AC, +1 per 6 caster levels (max +5)',
    'spell.shieldOfFaith',
    [
      m('ac.other', 'deflection', {
        formula: 'min(5, 2 + floor(@casterLevel / 6))',
      }),
    ],
  ),
  effect(
    'effect.foxsCunning',
    'Fox’s cunning',
    '+4 enhancement to Intelligence, 1 min/level',
    'spell.foxsCunning',
    [m('ability.int', 'enhancement', 4)],
  ),
];

// ------------------------------------------------------------- conditions

const conditions: CatalogEntry[] = [
  {
    key: 'condition.raging',
    scope: 'global',
    name: 'Raging',
    summary: '+4 morale Str and Con, +2 morale Will, −2 AC',
    stacksWithItself: false,
    modifiers: [
      m('ability.str', 'morale', 4),
      m('ability.con', 'morale', 4),
      m('save.will', 'morale', 2),
      m('ac.other', 'untyped', -2),
    ],
    detail: { kind: 'condition' },
  },
  {
    key: 'condition.shaken',
    scope: 'global',
    name: 'Shaken',
    summary: '−2 on attack, saves, skill and ability checks',
    stacksWithItself: false,
    modifiers: [
      m('attack', 'untyped', -2),
      m('saves', 'untyped', -2),
      ...(
        [
          'acrobatics',
          'climb',
          'intimidate',
          'perception',
          'stealth',
          'survival',
        ] as const
      ).map((key) => m(`skill.${key}`, 'untyped', -2)),
    ],
    detail: { kind: 'condition' },
  },
  {
    key: 'condition.fatigued',
    scope: 'global',
    name: 'Fatigued',
    summary: '−2 Str and Dex, can’t run or charge',
    stacksWithItself: false,
    modifiers: [
      m('ability.str', 'untyped', -2),
      m('ability.dex', 'untyped', -2),
    ],
    detail: { kind: 'condition' },
  },
];

/** The global catalog. Character-scoped entries live on `Character.ownCatalog`. */
export const CATALOG: CatalogEntry[] = [
  ...races,
  ...classes,
  ...classFeatures,
  ...feats,
  ...traits,
  ...items,
  ...spellEffects,
  ...SPELLS,
  ...conditions,
];

export const CATALOG_BY_KEY: Record<string, CatalogEntry> = Object.fromEntries(
  CATALOG.map((entry) => [entry.key, entry]),
);

/**
 * Campaign homebrew (scope `campaign`). Only Characters in that campaign can
 * pick it; leaving the campaign detaches it into a character-scoped copy so
 * the sheet doesn't change. Not part of the global pickers.
 */
export const CAMPAIGN_CATALOG: CatalogEntry[] = [
  {
    key: 'homebrew.ironfang.councilSeal',
    scope: 'campaign',
    campaignId: 'ironfang',
    name: 'Phaendar council seal',
    summary: 'Ironfang homebrew: +1 circumstance on Diplomacy',
    stacksWithItself: false,
    modifiers: [m('skill.diplomacy', 'circumstance', 1)],
    detail: { kind: 'item', consumable: false, slot: 'neck' },
  },
];

export const CAMPAIGN_CATALOG_BY_KEY: Record<string, CatalogEntry> =
  Object.fromEntries(CAMPAIGN_CATALOG.map((entry) => [entry.key, entry]));

/** A campaign's homebrew, for its Characters' pickers. */
export function campaignCatalog(campaignId: string | undefined) {
  return CAMPAIGN_CATALOG.filter((entry) => entry.campaignId === campaignId);
}

export type ClassDetail = Extract<CatalogEntry['detail'], { kind: 'class' }>;
export type RaceDetail = Extract<CatalogEntry['detail'], { kind: 'race' }>;

/** Class Catalog Entries, in display order. */
export const CLASSES = classes;
export const RACES = races;

export function classDetail(classKey: string | null): ClassDetail | null {
  if (!classKey) return null;
  const entry = CATALOG_BY_KEY[classKey];
  return entry?.detail.kind === 'class' ? entry.detail : null;
}

/** "barbarian" for `class.barbarian` — the `@classLevel.<key>` formula name. */
export function classSlug(classKey: string) {
  return classKey.replace(/^class\./, '');
}

/** Catalog entries of a kind, e.g. `catalogOfKind('feat')`. */
export function catalogOfKind(kind: CatalogEntry['detail']['kind']) {
  return CATALOG.filter((entry) => entry.detail.kind === kind);
}

/** Picks for a FeatureGrant `choose` group. */
export function catalogForGroup(group: FeatureGroup) {
  if (group === 'combatFeat')
    return CATALOG.filter((e) => e.detail.kind === 'feat' && e.detail.combat);
  return CATALOG.filter(
    (e) => e.detail.kind === 'classFeature' && e.detail.group === group,
  );
}

export const POINT_BUY_COST: Record<number, number> = {
  7: -4,
  8: -2,
  9: -1,
  10: 0,
  11: 1,
  12: 2,
  13: 3,
  14: 5,
  15: 7,
  16: 10,
  17: 13,
  18: 17,
};
