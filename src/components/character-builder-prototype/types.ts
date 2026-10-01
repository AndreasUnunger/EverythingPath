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
  | 'cmb'
  | 'cmd'
  | 'init'
  | 'hp';

/** Parent targets expand into leaves before stacking (`ac` → `ac.other`). */
export type ParentTarget = 'ac' | 'saves' | 'attack';

/**
 * PROTOTYPE extension: `$choice` targets take the sheet entry's choice
 * (Skill Focus's skill, the human's chosen ability).
 */
export type ChoiceTarget = 'skill.$choice' | 'ability.$choice';

export type Target = LeafTarget | ParentTarget | ChoiceTarget;

/** Negative value = penalty. A formula uses the closed grammar in resolve.ts. */
export type Modifier = {
  target: Target;
  bonusType: BonusType;
  value: number | { formula: string };
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
  | 'condition'
  | 'manual';

export type StateKind = 'classLevel' | 'abilityDamage' | 'abilityDrain';
export type EntryKind = Exclude<CatalogKind, 'class'> | StateKind;

/** A pick a class level offers (a rage power, a rogue talent, a bonus feat). */
export type FeatureGroup = 'ragePower' | 'rogueTalent' | 'combatFeat';

export type FeatureGrant =
  | { classLevel: number; catalogKey: string }
  | { classLevel: number; choose: FeatureGroup; label: string };

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
      spellcasting?: string;
    }
  | {
      kind: 'classFeature';
      /** Picks offered by a FeatureGrant `choose` belong to a group. */
      group?: FeatureGroup;
      /** Rules upgrade when the same feature is gained from two classes. */
      duplicateUpgrade?: { catalogKey: string; rule: string };
    }
  | {
      kind: 'feat';
      combat: boolean;
      prerequisites: Prerequisite[];
      /** The feat needs a choice; `skill` choices feed `skill.$choice` targets. */
      choice?: 'skill' | 'weapon';
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
    }
  | { kind: 'spell'; lastsOverOneDay: boolean }
  | { kind: 'condition' }
  | { kind: 'manual' };

export type CatalogEntry = {
  key: string;
  scope: 'global' | 'campaign' | 'character';
  /** Character scope only. */
  characterId?: string;
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
};

export type SheetEntryState =
  | ClassLevelState
  | {
      kind: 'abilityDamage' | 'abilityDrain';
      ability: AbilityKey;
      points: number;
    }
  | { kind: 'item'; quantity: number }
  | {
      kind: 'race';
      abilityChoice: AbilityKey | null;
      favoredClass: string | null;
    }
  | {
      kind: Exclude<EntryKind, StateKind | 'item' | 'race'>;
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
  campaignId: string;
  name: string;
  kind: 'pc' | 'npc';
  isActive: boolean;
  description: string;
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

export type Campaign = {
  id: string;
  name: string;
  /** null = the campaign has no militia. */
  militia: { week: number; roster: RosterPerson[] } | null;
};

export type HpPolicy = 'maxFirst+roll' | 'maxFirst+average' | 'max';

export type ProtoPage = 'list' | 'create' | 'buildout' | 'sheet' | 'levelup';

/** Props every variant component receives. */
export type VariantProps = {
  page: ProtoPage;
  /** From `&campaign=` (default `ironfang`). */
  campaignId: string;
  /** From `&character=`; pages default it (sheet/levelup → kesh, buildout → hessa). */
  characterId: string | null;
};

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
};
