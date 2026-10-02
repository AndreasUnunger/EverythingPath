// PROTOTYPE (throwaway, #208) — types mirroring docs/pf-character-sheet-data-model.md.
// Ids are plain strings and catalog entries are addressed by a string `key`
// instead of a Convex id. Everything else follows the model's shapes.

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type AbilityKey = (typeof ABILITIES)[number];

export const SKILL_KEYS = [
  'acrobatics',
  'appraise',
  'bluff',
  'climb',
  'craftAlchemy',
  'craftWeapons',
  'diplomacy',
  'disableDevice',
  'disguise',
  'escapeArtist',
  'fly',
  'handleAnimal',
  'heal',
  'intimidate',
  'knowledgeArcana',
  'knowledgeDungeoneering',
  'knowledgeLocal',
  'knowledgeNature',
  'knowledgeReligion',
  'linguistics',
  'perception',
  'performOratory',
  'professionSoldier',
  'ride',
  'senseMotive',
  'sleightOfHand',
  'spellcraft',
  'stealth',
  'survival',
  'swim',
  'useMagicDevice',
] as const;
export type SkillKey = (typeof SKILL_KEYS)[number];

export type BonusType =
  | 'alchemical'
  | 'armor'
  | 'circumstance'
  | 'competence'
  | 'deflection'
  | 'dodge'
  | 'enhancement'
  | 'inherent'
  | 'insight'
  | 'luck'
  | 'morale'
  | 'naturalArmor'
  | 'profane'
  | 'racial'
  | 'resistance'
  | 'sacred'
  | 'shield'
  | 'size'
  | 'trait'
  | 'untyped'
  | 'base';

export type AcLeaf = 'ac.armor' | 'ac.shield' | 'ac.natural' | 'ac.other';
export type SaveKey = 'fort' | 'ref' | 'will';

/** Leaf targets: what the resolver stacks. */
export type LeafTarget =
  | `ability.${AbilityKey}`
  | AcLeaf
  | `save.${SaveKey}`
  | `skill.${SkillKey}`
  | 'bab'
  | 'attack.melee'
  | 'attack.ranged'
  | 'damage.melee'
  | 'damage.ranged'
  | 'cmb'
  | 'cmd'
  | 'init'
  | 'hp'
  /** PROTOTYPE (#233): Spellcasting targets; every Spellcasting unless a `castingClass` condition narrows it. */
  | 'casterLevel'
  | 'spellDC'
  | 'concentration';

/** Parent targets expand into leaves before stacking (`ac` → `ac.other`, `damage` → both damage leaves). */
export type ParentTarget = 'ac' | 'saves' | 'attack' | 'damage';

/**
 * PROTOTYPE extension: `$choice` targets take the sheet entry's choice
 * (Skill Focus's skill, the human's chosen ability).
 */
export type ChoiceTarget = 'skill.$choice' | 'ability.$choice';

export type Target = LeafTarget | ParentTarget | ChoiceTarget;

/**
 * PROTOTYPE (#216): the closed list of situations a conditional Modifier can
 * wait on. Display text is `SITUATION_TEXT` in catalog.ts.
 */
export const SITUATION_KEYS = [
  'traps',
  'fear',
  'spells',
  'poison',
  'enchantment',
  'giants',
  'orcsGoblinoids',
  'bullRushTrip',
  'sneak',
  'castDefensively',
] as const;
export type SituationKey = (typeof SITUATION_KEYS)[number];

/**
 * PROTOTYPE (#216): a Modifier that applies only under a condition. Every
 * part present must hold.
 */
export type ModifierCondition = {
  /** Situational: never applied to a total unless the situation is asked for. */
  situation?: { key: SituationKey; text: string };
  /** Applies only while an active sheet entry with this catalog key exists ("while raging"). */
  whileActive?: { catalogKey: string; text: string };
  /**
   * Applies only to attacks made with this weapon: '$self' = the item
   * carrying the modifier; '$choice' = the sheet entry's choice (Weapon
   * Focus's weapon, matched against the weapon's `base`). Never applies to
   * sheet-level statistics, only inside attack resolution (attacks.ts).
   */
  weapon?: '$self' | '$choice';
  /** PROTOTYPE (#233): only this Spellcasting (a class tag, or '$choice' = the entry's choice). */
  castingClass?: '$choice' | ClassTag;
  /** PROTOTYPE (#233): only Spells of this school ('$choice' = the entry's choice: Spell Focus). */
  school?: '$choice' | SchoolKey;
};

/** Negative value = penalty. A formula uses the closed grammar in resolve.ts. */
export type Modifier = {
  target: Target;
  bonusType: BonusType;
  value: number | { formula: string };
  /** PROTOTYPE (#216): absent = always applies. */
  condition?: ModifierCondition;
};

export type CatalogKind =
  | 'base'
  | 'race'
  | 'class'
  | 'classFeature'
  | 'feat'
  | 'trait'
  | 'item'
  | 'spell'
  | 'spellEffect'
  | 'condition'
  | 'manual';

export type StateKind =
  | 'classLevel'
  | 'abilityDamage'
  | 'abilityDrain'
  | 'attackRoutine';
export type EntryKind = Exclude<CatalogKind, 'class'> | StateKind;

/** A pick a class level offers (a rage power, a rogue talent, a bonus feat). */
export type FeatureGroup =
  | 'ragePower'
  | 'rogueTalent'
  | 'combatFeat'
  | 'arcaneSchool'
  | 'domain'
  | 'bloodline';

export type FeatureGrant =
  | { classLevel: number; catalogKey: string }
  /** `count`: how many picks (a cleric's two domains); default 1. */
  | { classLevel: number; choose: FeatureGroup; label: string; count?: number };

// ---- Spellcasting (#233) ----

export const SCHOOLS = [
  'abjuration',
  'conjuration',
  'divination',
  'enchantment',
  'evocation',
  'illusion',
  'necromancy',
  'transmutation',
  'universal',
] as const;
export type SchoolKey = (typeof SCHOOLS)[number];

/** Foundry class `tag`: the key into a Spell's `levels`. Only the tags this prototype's catalog uses. */
export type ClassTag =
  | 'wizard'
  | 'sorcerer'
  | 'arcanist'
  | 'cleric'
  | 'oracle'
  | 'druid'
  | 'paladin'
  | 'ranger'
  | 'bard'
  | 'summoner'
  | 'magus';

export type CastingTableKey =
  | 'preparedHigh'
  | 'spontaneousHigh'
  | 'hybridHigh'
  | 'preparedMed'
  | 'spontaneousMed'
  | 'preparedLow';

/** The data model's `Casting`, on a casting class entry. */
export type Casting = {
  classTag: ClassTag;
  type: 'prepared' | 'spontaneous' | 'hybrid';
  spellKind: 'arcane' | 'divine' | 'psychic' | 'alchemy';
  ability: AbilityKey;
  cantrips: boolean;
  /** −3 for paladin and ranger; 0 otherwise. */
  casterLevelOffset: number;
  table: CastingTableKey;
  /** What the sheet records: Spells known, a book, or nothing. */
  record: 'known' | 'book' | 'none';
  /** The `book` heading: "Spellbook", "Formula book" or "Familiar". */
  bookName?: string;
};

/** A prestige class level's "+1 level of existing spellcasting class". */
export type CastingAdvance = {
  classLevel: number;
  count: number;
  kind: 'any' | 'arcane' | 'divine';
};

/** A class feature's spellcasting facts (domain, bloodline, arcane school). */
export type FeatureSpellcasting = {
  /** One extra slot per spell level from 1st. */
  extraSlot?: 'domain' | 'school' | 'spirit';
  /**
   * Its list's Spells are granted (domain, subdomain, bloodline).
   * `schedule` (#233 round 2): 'slot' = at every spell level the
   * Spellcasting can cast, prestige advances included (domain); 'classLevel'
   * = at the class's own Class Level the Spell's `grantedAtClassLevel`
   * names, never advanced (bloodline; mystery and patron later).
   */
  grants?: {
    list: 'domain' | 'subDomain' | 'bloodline';
    key: string;
    schedule: 'slot' | 'classLevel';
  };
  /** An arcane school: the specialist school. */
  school?: SchoolKey;
};

export type SpellDetail = {
  kind: 'spell';
  /** Level per class tag; absent = not on that class's list. */
  levels: Partial<Record<ClassTag, number>>;
  /** Domain, subdomain and bloodline lists: list key → level. */
  grantedLevels: Partial<
    Record<'domain' | 'subDomain' | 'bloodline', Record<string, number>>
  >;
  /**
   * PROTOTYPE (#233 round 2): schedule-style lists only (bloodline): list key
   * → the class level that grants it (sorcerer: spell level N at 2N + 1).
   * Not in Foundry; the Curation Overlay would add it.
   */
  grantedAtClassLevel: Partial<Record<'bloodline', Record<string, number>>>;
  school: SchoolKey;
  subschools: string[];
  descriptors: string[];
};

export type Prerequisite =
  | { kind: 'ability'; ability: AbilityKey; min: number }
  | { kind: 'bab'; min: number }
  | { kind: 'feat'; catalogKey: string }
  | { kind: 'classFeature'; catalogKey: string }
  | { kind: 'casterLevel'; min: number };

export type CatalogEntryDetail =
  | { kind: 'base' }
  | {
      kind: 'race';
      racialHitDice: number;
      size: 'small' | 'medium';
      speed: number;
      /** Human, half-orc: +2 to one ability of the player's choice. */
      chooseAbility: boolean;
      bonusFeat: boolean;
      /** Extra skill ranks per Class Level (human: 1). */
      bonusSkillRanksPerLevel: number;
      traitsText: string[];
    }
  | {
      kind: 'class';
      classKind: 'base' | 'prestige' | 'npc';
      hitDie: number;
      bab: 'full' | 'threeQuarters' | 'half';
      saves: Record<SaveKey, 'good' | 'poor'>;
      skillRanksPerLevel: number;
      classSkills: SkillKey[];
      featuresByLevel: FeatureGrant[];
      /** Advisory alternative favored class bonus text; hp and skill are always offered. */
      favoredClassAlt?: string;
      /** PROTOTYPE (#233): a casting class. */
      casting?: Casting;
      /** PROTOTYPE (#233): prestige "+1 level of existing spellcasting class". */
      castingAdvances?: CastingAdvance[];
    }
  | {
      kind: 'classFeature';
      /** Picks offered by a FeatureGrant `choose` belong to a group. */
      group?: FeatureGroup;
      /** Rules upgrade when the same feature is gained from two classes. */
      duplicateUpgrade?: { catalogKey: string; rule: string };
      /**
       * PROTOTYPE (#216): extra damage dice per entry (sneak attack: one d6
       * per entry), added to weapon damage only in `situation`.
       */
      damageDice?: {
        die: number;
        situation: SituationKey;
        /** Ranged attacks qualify only within this many feet. */
        rangedWithin?: number;
      };
      /** PROTOTYPE (#233): domain, bloodline, arcane school. */
      spellcasting?: FeatureSpellcasting;
    }
  | {
      kind: 'feat';
      combat: boolean;
      prerequisites: Prerequisite[];
      /** The feat needs a choice; `skill` choices feed `skill.$choice` targets; `school` feeds `school: '$choice'`. */
      choice?: 'skill' | 'weapon' | 'school';
    }
  | { kind: 'trait'; traitCategory: 'combat' | 'faith' | 'social' | 'magic' }
  | {
      kind: 'item';
      consumable: boolean;
      slot?:
        | 'armor'
        | 'shield'
        | 'shoulders'
        | 'ring'
        | 'neck'
        | 'belt'
        | 'head'
        | 'feet';
      armorCheckPenalty?: number;
      maxDex?: number;
      /** PROTOTYPE (#216): present on weapons. */
      weapon?: Weapon;
    }
  | SpellDetail
  | {
      kind: 'spellEffect';
      /** The Spell's catalog key; absent = use `defaultCasterLevel`. */
      spellKey?: string;
      lastsOverOneDay: boolean;
      defaultCasterLevel: number;
    }
  | { kind: 'condition' }
  | { kind: 'manual' };

/** PROTOTYPE (#216): a weapon's CRB statistics. */
export type Weapon = {
  /** Base weapon name, lower case ("greataxe"); Weapon Focus's choice matches it. */
  base: string;
  /** CRB weapon group ("axes", "light blades", "bows", "crossbows"). */
  group: string;
  handedness: 'light' | 'oneHanded' | 'twoHanded' | 'ranged';
  /** Medium damage dice ("1d12"). */
  dice: string;
  /** Lowest number of the threat range: 20, 19, 18. */
  threat: number;
  /** Critical multiplier. */
  mult: number;
  /** Range increment in feet. */
  rangeIncrement?: number;
  /** Composite bows: the highest Str bonus added to damage. */
  strRating?: number;
};

export type CatalogEntry = {
  key: string;
  scope: 'global' | 'campaign' | 'character';
  /** Character scope only. */
  characterId?: string;
  /** Campaign scope only (campaign homebrew). */
  campaignId?: string;
  /** A character-scoped copy detached from this entry (leaving a campaign). */
  copiedFrom?: string;
  name: string;
  /** Shared Source for stacking; absent = the entry itself. */
  sourceKey?: string;
  stacksWithItself: boolean;
  modifiers: Modifier[];
  /** One-line rules summary shown in pickers. */
  summary?: string;
  detail: CatalogEntryDetail;
};

export type FavoredClassBonus =
  | null
  | { choice: 'hp' }
  | { choice: 'skill' }
  | { choice: 'alt'; note: string };

export type ClassLevelState = {
  kind: 'classLevel';
  /** null = Unspecified Class Level. */
  classKey: string | null;
  /** Character level this row is, 1-based, contiguous. */
  position: number;
  hpGained: number | null;
  favoredClassBonus: FavoredClassBonus;
  abilityIncrease: AbilityKey | null;
  skillRanks: Partial<Record<SkillKey, number>>;
  /**
   * PROTOTYPE (#233): prestige levels only — the class (key) each casting
   * advance goes to, one per advance in order; null = not chosen (blue outline).
   * Empty for every other level.
   */
  castingAdvances: (string | null)[];
};

/**
 * PROTOTYPE (#216, variant 2): how a weapon is held when it attacks. `null`
 * or absent = not used to attack.
 */
export type Wield = 'twoHands' | 'oneHand' | 'primary' | 'off';

/**
 * PROTOTYPE (#216): one way to attack. `main.hand` is 'twoHands' for
 * two-handed and ranged weapons. With `off`, it is two-weapon fighting and
 * `main` becomes the primary hand.
 */
export type AttackSetup = {
  id: string;
  name: string;
  main: { entryId: string; hand: 'twoHands' | 'oneHand' };
  off?: { entryId: string };
  options: { powerAttack: boolean };
};

/** PROTOTYPE (#216, variant 3): a saved Attack Routine (state-only entry). */
export type AttackRoutineState = {
  kind: 'attackRoutine';
  name: string;
  main: AttackSetup['main'];
  off?: AttackSetup['off'];
  options: AttackSetup['options'];
};

export type SheetEntryState =
  | ClassLevelState
  | {
      kind: 'abilityDamage' | 'abilityDrain';
      ability: AbilityKey;
      points: number;
    }
  | AttackRoutineState
  | { kind: 'item'; quantity: number; wield?: Wield | null }
  | {
      kind: 'race';
      abilityChoice: AbilityKey | null;
      favoredClass: string | null;
    }
  /** PROTOTYPE (#233): a recorded Spell. */
  | {
      kind: 'spell';
      /** The Spellcasting it is recorded for: a class key ("class.wizard"). */
      castingClass: string;
      /** null = the class's level for it; set for off-list Spells. */
      level: number | null;
    }
  /** PROTOTYPE (#233): a running Spell Effect. */
  | { kind: 'spellEffect'; casterLevel: number }
  /** PROTOTYPE (#233): class features; an arcane school records its opposition schools. */
  | {
      kind: 'classFeature';
      choice?: string | null;
      oppositionSchools?: SchoolKey[];
    }
  | {
      kind: Exclude<
        EntryKind,
        StateKind | 'item' | 'race' | 'spell' | 'spellEffect' | 'classFeature'
      >;
      /** Feat choice (Skill Focus skill, Weapon Focus weapon). */
      choice?: string | null;
    };

export type SheetEntry = {
  id: string;
  kind: EntryKind;
  /** Required for catalog-backed kinds, absent for state-only kinds. */
  catalogKey?: string;
  active: boolean;
  /** Feats, traits and class features: the Class Level entry id that granted them. */
  gainedAtClassLevel?: string;
  notes?: string;
  state: SheetEntryState;
};

export type Character = {
  id: string;
  /** The Character Owner (a user id; `ME` is the signed-in user). */
  ownerId: string;
  /** Absent = in no campaign. A Character is in at most one campaign. */
  campaignId?: string;
  name: string;
  kind: 'pc' | 'npc';
  isActive: boolean;
  description: string;
  /**
   * The presentation, shown as a status. Only a Character in a campaign with
   * a militia can be Militia-only; `buildOut` makes it Full for good.
   */
  sheetMode: 'militiaOnly' | 'full';
  /** Character-scoped Catalog Entries: the base scores entry and one-offs. */
  ownCatalog: CatalogEntry[];
  entries: SheetEntry[];
};

export type OfficerRole =
  | 'Marshal'
  | 'Ambassador'
  | 'Spymaster'
  | 'Strategist'
  | 'Commandant'
  | 'Overseer';

export type RosterPerson = {
  characterId: string;
  roles: OfficerRole[];
  /** The militia's own ruling; null = use computed Hit Dice. */
  hitDiceOverride: number | null;
};

export type Org = { id: string; name: string };

export type Campaign = {
  id: string;
  name: string;
  orgId: string;
  description: string;
  /** null = the campaign has no militia. */
  militia: {
    week: number;
    finishedWeeks: number;
    roster: RosterPerson[];
  } | null;
};

/**
 * Every page of the prototype, named after the shell's locations.
 * Top-level areas: `campaigns` (the homepage), `characters` (yours).
 * In a campaign: `campaign-home`, `campaign-characters`, and the militia's
 * `week`, `history`, `militia`, `officers` (Characters & officers), `setup`.
 * Character pages (no campaign param needed; the Character's own campaign
 * decides the shell): `sheet`, `levelup`, `create`, `buildout`.
 */
export type ProtoPage =
  | 'campaigns'
  | 'characters'
  | 'campaign-home'
  | 'campaign-characters'
  | 'week'
  | 'history'
  | 'militia'
  | 'officers'
  | 'setup'
  | 'sheet'
  | 'levelup'
  | 'create'
  | 'buildout'
  /** PROTOTYPE (#233, spellcasting variant 3): the sheet's spells page. */
  | 'spells';

// ---- Resolver output ----

export type Contribution = {
  /** Entry name or built-in label such as "BAB (Barbarian 4)", "Dex modifier". */
  label: string;
  bonusType: BonusType;
  value: number;
  builtIn: boolean;
  temporary: boolean;
  /** The leaf target this landed on. */
  target: LeafTarget | 'derived';
  /** Sheet entry that produced it (absent for derived built-ins like "Base 10"). */
  entryId?: string;
  /**
   * PROTOTYPE (#216): set on a conditional Modifier's contribution whose
   * condition holds ("vs. traps", "with greataxe"), so applied situational
   * lines can say why they apply.
   */
  conditionText?: string;
  /** PROTOTYPE (#216): the situation it applies in, if any. */
  situationKey?: SituationKey;
};

/**
 * PROTOTYPE (#216): a contribution left out of a total because its condition
 * isn't met (a situation not asked for, a `whileActive` entry that is off,
 * or a weapon condition outside attack resolution).
 */
export type ConditionalContribution = Contribution & {
  /** The whole condition: "vs. spells, supernatural and spell-like abilities, while raging". */
  conditionText: string;
  situationKey?: SituationKey;
  /** The `whileActive` text when that part is unmet ("while raging"). */
  waitingOn?: string;
  /** The weapon text when it is weapon-scoped ("with +1 greataxe", "with greataxe"). */
  weapon?: string;
};

export type Suppressed = {
  contribution: Contribution;
  by: string;
  reason: 'sameSource' | 'bonusType' | 'sameEntry' | 'excluded';
};

export type Stat = {
  total: number;
  applied: Contribution[];
  suppressed: Suppressed[];
  /** PROTOTYPE (#216): contributions waiting on a condition; not in `total`. */
  conditional: ConditionalContribution[];
};

export type SkillStat = Stat & {
  ranks: number;
  classSkill: boolean;
  trainedOnly: boolean;
  /** Trained-only skill with no ranks can't be used. */
  usable: boolean;
  ability: AbilityKey;
};

export type MilitiaCharacterFacts = {
  level: number;
  racialHitDice: number;
  hitDice: number;
  /** Permanent-only ability totals. */
  scores: Record<AbilityKey, number>;
  isActive: boolean;
};

/**
 * Every sheet statistic addressable by a dotted path (`getStat` in
 * resolve.ts reads one).
 */
export type StatPath =
  | 'hp'
  | 'ac'
  | 'touchAc'
  | 'flatFootedAc'
  | 'bab'
  | 'cmb'
  | 'cmd'
  | 'flatFootedCmd'
  | 'init'
  | 'attackMelee'
  | 'attackRanged'
  | 'damageMelee'
  | 'damageRanged'
  | `saves.${SaveKey}`
  | `abilities.${AbilityKey}`
  | `abilityMods.${AbilityKey}`
  | `skills.${SkillKey}`;

/** PROTOTYPE (#216): one situation present on the sheet. */
export type SheetSituation = {
  key: SituationKey;
  /** `SITUATION_TEXT[key]`, e.g. "vs. traps". */
  text: string;
  /** Sheet statistics with a contribution in this situation (waiting or applied). */
  paths: StatPath[];
  /**
   * It (also) changes weapon attacks: 'attack' = an attack-bonus
   * contribution (hatred), 'damage' = damage (sneak attack dice, a damage
   * Modifier). Resolve them with `resolveRoutine(…, { situations })`.
   */
  attacks: ('attack' | 'damage')[];
};

/** PROTOTYPE (#216): extra damage dice from class features (sneak attack). */
export type ExtraDamage = {
  /** Catalog name: "Sneak Attack". */
  label: string;
  catalogKey: string;
  /** Summed dice: "2d6". */
  dice: string;
  count: number;
  die: number;
  situationKey: SituationKey;
  /** `SITUATION_TEXT[situationKey]`. */
  conditionText: string;
  rangedWithin?: number;
  entryIds: string[];
};

export type ResolvedSheet = {
  abilities: Record<AbilityKey, Stat>;
  abilityMods: Record<AbilityKey, Stat>;
  bab: Stat;
  saves: Record<SaveKey, Stat>;
  ac: Stat;
  touchAc: Stat;
  flatFootedAc: Stat;
  attackMelee: Stat;
  attackRanged: Stat;
  /**
   * PROTOTYPE (#216): authored `damage.melee` / `damage.ranged` Modifiers
   * only (no Str, no weapon dice); weapon-scoped ones wait in `conditional`.
   */
  damageMelee: Stat;
  damageRanged: Stat;
  cmb: Stat;
  cmd: Stat;
  flatFootedCmd: Stat;
  init: Stat;
  hp: Stat;
  skills: Record<SkillKey, SkillStat>;
  level: number;
  hitDice: number;
  racialHitDice: number;
  /** "Barbarian 4 / Rogue 3" order of first appearance; unspecified levels counted separately. */
  classes: { classKey: string | null; name: string; levels: number }[];
  /** Unsupported formulas and similar resolver notes. */
  notes: string[];
  militia: MilitiaCharacterFacts;
  /** PROTOTYPE (#216): the situations this sheet was resolved with (`opts.situations`). */
  situationsAsked: SituationKey[];
  /** PROTOTYPE (#216): every situation present on the sheet, in `SITUATION_KEYS` order. */
  situations: SheetSituation[];
  /** PROTOTYPE (#216): extra damage dice (sneak attack), applied by attacks.ts. */
  extraDamage: ExtraDamage[];
};
