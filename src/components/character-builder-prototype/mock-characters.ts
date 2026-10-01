// PROTOTYPE (throwaway, #208) — seed campaigns and Characters.
//
// Ironfang Invasion (with a militia):
//   kesh  — Full PC, human Barbarian 4 / Rogue 3 (B1 B2 R1 R2 B3 R3 B4), the showcase.
//   ama   — Full PC, elf Wizard 5.
//   hessa — Militia-only NPC, level 5 = five Unspecified Class Levels, base scores only.
//   ardo  — Militia-only PC, level 3 = three Unspecified Class Levels, base scores only.
//   moss  — Militia-only NPC, level 2, not on the roster.
// One-shot: Hollow Mountain (no militia):
//   brannoc — Full PC, dwarf Fighter 3.
// No campaign (owned by the signed-in user, Andreas):
//   ilsa  — Full PC, human Cleric 2, built before joining a game.
//   tobin — Full PC, no campaign: base scores and one Unspecified level.
// Owners: Andreas (me) owns kesh, ardo, brannoc, ilsa, tobin; Mira owns ama;
// Jonas (the GM) owns the NPCs hessa and moss.

import {
  ABILITIES,
  type Org,
  type AbilityKey,
  type Campaign,
  type CatalogEntry,
  type Character,
  type ClassLevelState,
  type SheetEntry,
  type SkillKey,
} from './types';

export const IRONFANG = 'ironfang';
export const ONESHOT = 'oneshot';

/** The signed-in user. */
export const ME = 'u1';
export const USERS: Record<string, string> = {
  u1: 'Andreas',
  u2: 'Mira',
  u3: 'Jonas',
};
export function userName(id: string) {
  return USERS[id] ?? 'Someone';
}

/** One organization in this prototype; the shell's switcher is a stand-in. */
export const ORGS: Org[] = [{ id: 'o1', name: 'Phaendar table' }];

export function baseCatalogEntry(
  characterId: string,
  scores: Record<AbilityKey, number>,
): CatalogEntry {
  return {
    key: `base.${characterId}`,
    scope: 'character',
    characterId,
    name: 'Base scores',
    stacksWithItself: false,
    modifiers: ABILITIES.map((a) => ({
      target: `ability.${a}` as const,
      bonusType: 'base' as const,
      value: scores[a],
    })),
    detail: { kind: 'base' },
  };
}

export function baseSheetEntry(characterId: string): SheetEntry {
  return {
    id: `${characterId}-base`,
    kind: 'base',
    catalogKey: `base.${characterId}`,
    active: true,
    state: { kind: 'base' },
  };
}

export function classLevelEntry(
  id: string,
  position: number,
  classKey: string | null,
  rest: Partial<Omit<ClassLevelState, 'kind' | 'position' | 'classKey'>> = {},
): SheetEntry {
  return {
    id,
    kind: 'classLevel',
    active: true,
    state: {
      kind: 'classLevel',
      classKey,
      position,
      hpGained: rest.hpGained ?? null,
      favoredClassBonus: rest.favoredClassBonus ?? null,
      abilityIncrease: rest.abilityIncrease ?? null,
      skillRanks: rest.skillRanks ?? {},
    },
  };
}

const ranks = (...keys: SkillKey[]) =>
  Object.fromEntries(keys.map((k) => [k, 1])) as Partial<
    Record<SkillKey, number>
  >;

/** A catalog-backed sheet entry. */
function has(
  id: string,
  catalogKey: string,
  kind: SheetEntry['kind'],
  opts: { at?: string; active?: boolean; choice?: string; notes?: string } = {},
): SheetEntry {
  return {
    id,
    kind,
    catalogKey,
    active: opts.active ?? true,
    gainedAtClassLevel: opts.at,
    notes: opts.notes,
    state:
      kind === 'item'
        ? { kind: 'item', quantity: 1 }
        : ({ kind, choice: opts.choice ?? null } as SheetEntry['state']),
  };
}

function militiaOnly(
  id: string,
  ownerId: string,
  campaignId: string,
  name: string,
  kind: 'pc' | 'npc',
  level: number,
  scores: Record<AbilityKey, number>,
  description = '',
): Character {
  return {
    id,
    ownerId,
    campaignId,
    name,
    kind,
    isActive: true,
    description,
    sheetMode: 'militiaOnly',
    ownCatalog: [baseCatalogEntry(id, scores)],
    entries: [
      baseSheetEntry(id),
      ...Array.from({ length: level }, (_, i) =>
        classLevelEntry(`${id}-l${i + 1}`, i + 1, null),
      ),
    ],
  };
}

const B = 'class.barbarian';
const R = 'class.rogue';

const kesh: Character = {
  id: 'kesh',
  ownerId: 'u1',
  campaignId: IRONFANG,
  name: 'Kesh',
  kind: 'pc',
  isActive: true,
  description:
    'Hobgoblin-hating scout from Phaendar. Leads the Marshal’s patrols.',
  sheetMode: 'full',
  ownCatalog: [
    baseCatalogEntry('kesh', {
      str: 16,
      dex: 14,
      con: 14,
      int: 10,
      wis: 10,
      cha: 10,
    }),
  ],
  entries: [
    baseSheetEntry('kesh'),
    {
      id: 'kesh-race',
      kind: 'race',
      catalogKey: 'race.human',
      active: true,
      state: { kind: 'race', abilityChoice: 'str', favoredClass: B },
    },
    classLevelEntry('kesh-l1', 1, B, {
      hpGained: 12,
      favoredClassBonus: { choice: 'hp' },
      skillRanks: ranks(
        'climb',
        'intimidate',
        'perception',
        'survival',
        'acrobatics',
      ),
    }),
    classLevelEntry('kesh-l2', 2, B, {
      hpGained: 9,
      favoredClassBonus: { choice: 'hp' },
      skillRanks: ranks(
        'climb',
        'intimidate',
        'perception',
        'survival',
        'acrobatics',
      ),
    }),
    classLevelEntry('kesh-l3', 3, R, {
      hpGained: 5,
      skillRanks: ranks(
        'climb',
        'intimidate',
        'perception',
        'acrobatics',
        'stealth',
        'disableDevice',
        'senseMotive',
        'survival',
        'escapeArtist',
      ),
    }),
    classLevelEntry('kesh-l4', 4, R, {
      hpGained: 6,
      abilityIncrease: 'str',
      skillRanks: ranks(
        'climb',
        'intimidate',
        'perception',
        'acrobatics',
        'stealth',
        'disableDevice',
        'senseMotive',
        'survival',
        'escapeArtist',
      ),
    }),
    classLevelEntry('kesh-l5', 5, B, {
      hpGained: 8,
      favoredClassBonus: { choice: 'skill' },
      skillRanks: ranks(
        'climb',
        'intimidate',
        'perception',
        'acrobatics',
        'survival',
        'stealth',
      ),
    }),
    classLevelEntry('kesh-l6', 6, R, {
      hpGained: 4,
      skillRanks: ranks(
        'climb',
        'intimidate',
        'perception',
        'acrobatics',
        'stealth',
        'disableDevice',
        'senseMotive',
        'survival',
        'escapeArtist',
      ),
    }),
    classLevelEntry('kesh-l7', 7, B, {
      hpGained: 10,
      favoredClassBonus: { choice: 'hp' },
      skillRanks: ranks(
        'climb',
        'intimidate',
        'perception',
        'acrobatics',
        'survival',
      ),
    }),
    // Class features, by the level that granted them.
    has('kesh-cf-fast', 'cf.fastMovement', 'classFeature', { at: 'kesh-l1' }),
    has('kesh-cf-rage', 'cf.rage', 'classFeature', { at: 'kesh-l1' }),
    has('kesh-cf-uncanny', 'cf.uncannyDodge', 'classFeature', {
      at: 'kesh-l2',
    }),
    has('kesh-rp-1', 'rp.powerfulBlow', 'classFeature', { at: 'kesh-l2' }),
    has('kesh-cf-sneak1', 'cf.sneakAttack', 'classFeature', { at: 'kesh-l3' }),
    has('kesh-cf-trapfinding', 'cf.trapfinding', 'classFeature', {
      at: 'kesh-l3',
    }),
    has('kesh-cf-evasion', 'cf.evasion', 'classFeature', { at: 'kesh-l4' }),
    has('kesh-rt-1', 'rt.fastStealth', 'classFeature', { at: 'kesh-l4' }),
    has('kesh-cf-trapsense-b', 'cf.trapSense', 'classFeature', {
      at: 'kesh-l5',
    }),
    has('kesh-cf-sneak2', 'cf.sneakAttack', 'classFeature', { at: 'kesh-l6' }),
    has('kesh-cf-trapsense-r', 'cf.trapSense', 'classFeature', {
      at: 'kesh-l6',
    }),
    has('kesh-rp-2', 'rp.superstition', 'classFeature', { at: 'kesh-l7' }),
    // Feats: level 1, human bonus feat, levels 3, 5 and 7.
    has('kesh-feat-pa', 'feat.powerAttack', 'feat', { at: 'kesh-l1' }),
    has('kesh-feat-tough', 'feat.toughness', 'feat', {
      at: 'kesh-l1',
      notes: 'Human bonus feat',
    }),
    has('kesh-feat-wf', 'feat.weaponFocus', 'feat', {
      at: 'kesh-l3',
      choice: 'greataxe',
    }),
    has('kesh-feat-dodge', 'feat.dodge', 'feat', { at: 'kesh-l5' }),
    has('kesh-feat-extrarage', 'feat.extraRage', 'feat', { at: 'kesh-l7' }),
    // Traits.
    has('kesh-trait-react', 'trait.reactionary', 'trait'),
    has('kesh-trait-resilient', 'trait.resilient', 'trait'),
    // Gear.
    has('kesh-armor', 'item.chainShirt+1', 'item'),
    has('kesh-cloak', 'item.cloakOfResistance1', 'item'),
    has('kesh-belt', 'item.beltOfGiantStrength2', 'item'),
    has('kesh-potion', 'item.potionBullsStrength', 'item', { active: false }),
    // Effects, off until toggled.
    has('kesh-raging', 'condition.raging', 'condition', { active: false }),
    has('kesh-bulls', 'spell.bullsStrength', 'spell', {
      active: false,
      notes: 'Cast by Brother Ardo before a sortie',
    }),
  ],
};

const W = 'class.wizard';
const amaRanks = ranks(
  'knowledgeArcana',
  'spellcraft',
  'perception',
  'knowledgeLocal',
  'knowledgeNature',
  'linguistics',
  'fly',
);

const ama: Character = {
  id: 'ama',
  ownerId: 'u2',
  campaignId: IRONFANG,
  name: 'Ama',
  kind: 'pc',
  isActive: true,
  description: 'Elven diviner, keeps the militia’s maps.',
  sheetMode: 'full',
  ownCatalog: [
    baseCatalogEntry('ama', {
      str: 8,
      dex: 14,
      con: 14,
      int: 16,
      wis: 12,
      cha: 10,
    }),
  ],
  entries: [
    baseSheetEntry('ama'),
    {
      id: 'ama-race',
      kind: 'race',
      catalogKey: 'race.elf',
      active: true,
      state: { kind: 'race', abilityChoice: null, favoredClass: W },
    },
    classLevelEntry('ama-l1', 1, W, {
      hpGained: 6,
      favoredClassBonus: { choice: 'hp' },
      skillRanks: amaRanks,
    }),
    classLevelEntry('ama-l2', 2, W, {
      hpGained: 4,
      favoredClassBonus: { choice: 'hp' },
      skillRanks: amaRanks,
    }),
    classLevelEntry('ama-l3', 3, W, {
      hpGained: 3,
      favoredClassBonus: { choice: 'hp' },
      skillRanks: amaRanks,
    }),
    classLevelEntry('ama-l4', 4, W, {
      hpGained: 5,
      favoredClassBonus: { choice: 'hp' },
      abilityIncrease: 'int',
      skillRanks: amaRanks,
    }),
    classLevelEntry('ama-l5', 5, W, {
      hpGained: 2,
      favoredClassBonus: { choice: 'hp' },
      skillRanks: amaRanks,
    }),
    has('ama-cf-bond', 'cf.arcaneBond', 'classFeature', {
      at: 'ama-l1',
      notes: 'Bonded ring',
    }),
    has('ama-cf-school', 'cf.arcaneSchool', 'classFeature', {
      at: 'ama-l1',
      notes: 'Divination',
    }),
    has('ama-cf-cantrips', 'cf.cantrips', 'classFeature', { at: 'ama-l1' }),
    has('ama-cf-spells', 'cf.wizardSpells', 'classFeature', { at: 'ama-l1' }),
    has('ama-feat-scribe', 'feat.scribeScroll', 'feat', { at: 'ama-l1' }),
    has('ama-feat-init', 'feat.improvedInitiative', 'feat', { at: 'ama-l1' }),
    has('ama-feat-ce', 'feat.combatExpertise', 'feat', { at: 'ama-l3' }),
    has('ama-feat-iw', 'feat.ironWill', 'feat', { at: 'ama-l5' }),
    has('ama-trait-lineage', 'trait.magicalLineage', 'trait'),
    has('ama-headband', 'item.headbandOfVastIntelligence2', 'item'),
    has('ama-ring', 'item.ringOfProtection1', 'item'),
    has('ama-mage-armor', 'spell.mageArmor', 'spell', { active: false }),
    has('ama-haste', 'spell.haste', 'spell', { active: false }),
  ],
};

const F = 'class.fighter';

const brannoc: Character = {
  id: 'brannoc',
  ownerId: 'u1',
  campaignId: ONESHOT,
  name: 'Brannoc',
  kind: 'pc',
  isActive: true,
  description: 'Dwarven shieldbearer, hired to clear the mountain pass.',
  sheetMode: 'full',
  ownCatalog: [
    baseCatalogEntry('brannoc', {
      str: 16,
      dex: 13,
      con: 14,
      int: 10,
      wis: 12,
      cha: 10,
    }),
  ],
  entries: [
    baseSheetEntry('brannoc'),
    {
      id: 'brannoc-race',
      kind: 'race',
      catalogKey: 'race.dwarf',
      active: true,
      state: { kind: 'race', abilityChoice: null, favoredClass: F },
    },
    classLevelEntry('brannoc-l1', 1, F, {
      hpGained: 10,
      favoredClassBonus: { choice: 'hp' },
      skillRanks: ranks('climb', 'intimidate'),
    }),
    classLevelEntry('brannoc-l2', 2, F, {
      hpGained: 8,
      favoredClassBonus: { choice: 'hp' },
      skillRanks: ranks('climb', 'intimidate'),
    }),
    classLevelEntry('brannoc-l3', 3, F, {
      hpGained: 7,
      favoredClassBonus: { choice: 'hp' },
      skillRanks: ranks('climb', 'intimidate'),
    }),
    has('brannoc-feat-pa', 'feat.powerAttack', 'feat', { at: 'brannoc-l1' }),
    has('brannoc-feat-wf', 'feat.weaponFocus', 'feat', {
      at: 'brannoc-l1',
      choice: 'dwarven waraxe',
    }),
    has('brannoc-feat-dodge', 'feat.dodge', 'feat', { at: 'brannoc-l2' }),
    has('brannoc-feat-iw', 'feat.ironWill', 'feat', { at: 'brannoc-l3' }),
    has('brannoc-cf-bravery', 'cf.bravery', 'classFeature', {
      at: 'brannoc-l2',
    }),
    has('brannoc-cf-at', 'cf.armorTraining', 'classFeature', {
      at: 'brannoc-l3',
    }),
    has('brannoc-armor', 'item.chainShirt', 'item'),
    has('brannoc-shield', 'item.heavyWoodenShield', 'item'),
  ],
};

const hessa = militiaOnly(
  'hessa',
  'u3',
  IRONFANG,
  'Sergeant Hessa',
  'npc',
  5,
  {
    str: 14,
    dex: 12,
    con: 13,
    int: 10,
    wis: 15,
    cha: 11,
  },
  'Veteran of the Phaendar watch. Drills the recruits.',
);

const ardoBase = militiaOnly(
  'ardo',
  'u1',
  IRONFANG,
  'Brother Ardo',
  'pc',
  3,
  {
    str: 12,
    dex: 10,
    con: 12,
    int: 11,
    wis: 16,
    cha: 14,
  },
  'Priest of Erastil; the militia’s voice in Phaendar’s council.',
);

/** Ardo carries Ironfang homebrew, which leaving the campaign detaches. */
const ardo: Character = {
  ...ardoBase,
  entries: [
    ...ardoBase.entries,
    has('ardo-seal', 'homebrew.ironfang.councilSeal', 'item', {
      notes: 'Given by the council in week 9',
    }),
  ],
};

const moss = militiaOnly(
  'moss',
  'u3',
  IRONFANG,
  'Old Moss',
  'npc',
  2,
  {
    str: 9,
    dex: 11,
    con: 10,
    int: 13,
    wis: 14,
    cha: 8,
  },
  'Herbalist; not part of the militia yet.',
);

const C = 'class.cleric';

const ilsa: Character = {
  id: 'ilsa',
  ownerId: 'u1',
  name: 'Ilsa Varn',
  kind: 'pc',
  isActive: true,
  description: 'Cleric of Erastil, built before joining a game.',
  sheetMode: 'full',
  ownCatalog: [
    baseCatalogEntry('ilsa', {
      str: 12,
      dex: 10,
      con: 14,
      int: 10,
      wis: 16,
      cha: 13,
    }),
  ],
  entries: [
    baseSheetEntry('ilsa'),
    {
      id: 'ilsa-race',
      kind: 'race',
      catalogKey: 'race.human',
      active: true,
      state: { kind: 'race', abilityChoice: 'wis', favoredClass: C },
    },
    classLevelEntry('ilsa-l1', 1, C, {
      hpGained: 8,
      favoredClassBonus: { choice: 'hp' },
      skillRanks: ranks('heal', 'knowledgeReligion', 'senseMotive'),
    }),
    classLevelEntry('ilsa-l2', 2, C, {
      hpGained: 5,
      favoredClassBonus: { choice: 'hp' },
      skillRanks: ranks('heal', 'knowledgeReligion', 'diplomacy'),
    }),
    has('ilsa-cf-aura', 'cf.aura', 'classFeature', { at: 'ilsa-l1' }),
    has('ilsa-cf-channel', 'cf.channelEnergy', 'classFeature', {
      at: 'ilsa-l1',
    }),
    has('ilsa-cf-domains', 'cf.domains', 'classFeature', {
      at: 'ilsa-l1',
      notes: 'Animal, Community',
    }),
    has('ilsa-cf-orisons', 'cf.orisons', 'classFeature', { at: 'ilsa-l1' }),
    has('ilsa-cf-spont', 'cf.spontaneousCasting', 'classFeature', {
      at: 'ilsa-l1',
    }),
    has('ilsa-cf-spells', 'cf.clericSpells', 'classFeature', {
      at: 'ilsa-l1',
    }),
    has('ilsa-feat-toughness', 'feat.toughness', 'feat', { at: 'ilsa-l1' }),
    has('ilsa-feat-alert', 'feat.alertness', 'feat', { at: 'ilsa-l1' }),
    has('ilsa-trait-faith', 'trait.indomitableFaith', 'trait'),
    has('ilsa-armor', 'item.chainShirt', 'item'),
  ],
};

const tobin: Character = {
  id: 'tobin',
  ownerId: 'u1',
  name: 'Brother Tobin',
  kind: 'pc',
  isActive: true,
  description: '',
  sheetMode: 'full',
  ownCatalog: [
    baseCatalogEntry('tobin', {
      str: 10,
      dex: 12,
      con: 12,
      int: 10,
      wis: 14,
      cha: 12,
    }),
  ],
  entries: [baseSheetEntry('tobin'), classLevelEntry('tobin-l1', 1, null)],
};

export const SEED_CHARACTERS: Character[] = [
  kesh,
  ama,
  hessa,
  ardo,
  moss,
  brannoc,
  ilsa,
  tobin,
];

export const SEED_CAMPAIGNS: Campaign[] = [
  {
    id: IRONFANG,
    name: 'Ironfang Invasion',
    orgId: 'o1',
    description: 'Phaendar has fallen; the survivors hold out in the Fangwood.',
    militia: {
      week: 14,
      finishedWeeks: 13,
      roster: [
        { characterId: 'kesh', roles: ['Marshal'], hitDiceOverride: null },
        { characterId: 'ama', roles: ['Spymaster'], hitDiceOverride: null },
        { characterId: 'hessa', roles: ['Commandant'], hitDiceOverride: null },
        { characterId: 'ardo', roles: ['Ambassador'], hitDiceOverride: null },
      ],
    },
  },
  {
    id: ONESHOT,
    name: 'One-shot: Hollow Mountain',
    orgId: 'o1',
    description: 'A single evening: clear the pass under the Hollow Mountain.',
    militia: null,
  },
];
