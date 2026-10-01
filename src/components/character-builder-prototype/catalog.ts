// PROTOTYPE (throwaway, #208) — a small PF1 Core Rulebook catalog shaped like
// global Catalog Entries. Keys are `<kind>.<slug>`.

import type {
  AbilityKey,
  CatalogEntry,
  FeatureGroup,
  Modifier,
  SkillKey,
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
): Modifier => ({ target, bonusType, value });

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
      m('saves', 'luck', 1),
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
    group?: 'ragePower' | 'rogueTalent';
    duplicateUpgrade?: { catalogKey: string; rule: string };
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
    '+2 morale on saves vs. spells while raging',
    {
      group: 'ragePower',
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
  feature(
    'cf.arcaneSchool',
    'Arcane School',
    'Specialist school powers, opposition schools',
  ),
  feature('cf.cantrips', 'Cantrips', '0-level arcane spells'),
  feature(
    'cf.wizardSpells',
    'Arcane spells',
    'Prepared arcane spellcasting (Int)',
  ),
];

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
        { classLevel: 1, catalogKey: 'cf.orisons' },
        { classLevel: 1, catalogKey: 'cf.spontaneousCasting' },
        { classLevel: 1, catalogKey: 'cf.clericSpells' },
        { classLevel: 3, catalogKey: 'cf.channelEnergy' },
        { classLevel: 5, catalogKey: 'cf.channelEnergy' },
        { classLevel: 7, catalogKey: 'cf.channelEnergy' },
      ],
      favoredClassAlt: 'Human: +1 to channel energy healing',
      spellcasting: 'Divine, prepared, Wis',
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
        { classLevel: 1, catalogKey: 'cf.arcaneSchool' },
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
      spellcasting: 'Arcane, prepared, Int',
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
    choice?: 'skill' | 'weapon';
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
  }),
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

const items: CatalogEntry[] = [
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

// ----------------------------------------------------------------- spells

const spells: CatalogEntry[] = [
  {
    key: 'spell.bullsStrength',
    scope: 'global',
    name: 'Bull’s strength',
    summary: '+4 enhancement to Strength, 1 min/level',
    stacksWithItself: false,
    modifiers: [m('ability.str', 'enhancement', 4)],
    detail: { kind: 'spell', lastsOverOneDay: false },
  },
  {
    key: 'spell.haste',
    scope: 'global',
    name: 'Haste',
    summary: '+1 attack, +1 dodge AC and Reflex, extra attack',
    sourceKey: 'haste',
    stacksWithItself: false,
    modifiers: [
      m('attack', 'untyped', 1),
      m('ac.other', 'dodge', 1),
      m('save.ref', 'dodge', 1),
    ],
    detail: { kind: 'spell', lastsOverOneDay: false },
  },
  {
    key: 'spell.mageArmor',
    scope: 'global',
    name: 'Mage armor',
    summary: '+4 armor bonus, 1 hour/level',
    stacksWithItself: false,
    modifiers: [m('ac.armor', 'armor', 4)],
    detail: { kind: 'spell', lastsOverOneDay: false },
  },
  {
    key: 'spell.shieldOfFaith',
    scope: 'global',
    name: 'Shield of faith',
    summary: '+2 deflection to AC',
    stacksWithItself: false,
    modifiers: [m('ac.other', 'deflection', 2)],
    detail: { kind: 'spell', lastsOverOneDay: false },
  },
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
  ...spells,
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
