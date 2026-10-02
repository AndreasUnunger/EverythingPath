// PROTOTYPE (throwaway, #208) — seed campaigns and Characters.
//
// Ironfang Invasion (with a militia):
//   kesh  — Full PC, human Barbarian 4 / Rogue 3 (B1 B2 R1 R2 B3 R3 B4), the showcase.
//           Weapons (#216): +1 greataxe, two kukris, composite longbow (+2 Str).
//   ama   — Full PC, elf Wizard 5.
//   hessa — Militia-only NPC, level 5 = five Unspecified Class Levels, base scores only.
//   ardo  — Militia-only PC, level 3 = three Unspecified Class Levels, base scores only.
//   moss  — Militia-only NPC, level 2, not on the roster.
// One-shot: Hollow Mountain (no militia):
//   brannoc — Full PC, dwarf Fighter 3, dwarven waraxe and light crossbow.
// No campaign (owned by the signed-in user, Andreas):
//   ilsa  — Full PC, human Cleric 2, built before joining a game.
//   tobin — Full PC, no campaign: base scores and one Unspecified level.
// Spellcasting (#233):
//   seren — Full PC in Ironfang (not on the roster), human Wizard 3 / Cleric 3 /
//           Mystic theurge 2: evoker, Fire and Sun domains, one prestige
//           advance empty. Spellbook with an off-list and a too-high Spell.
//   quill — Full PC, no campaign, elf Arcanist 5 (spellbook + prepared count).
//   nyra  — Full PC, no campaign, human Sorcerer 7, Arcane bloodline; one
//           level over the spells-known table; one orphaned wizard Spell.
//   oswin — Full PC, no campaign, human Paladin 4 (`none`, caster level 1).
// Owners: Andreas (me) owns kesh, ardo, brannoc, ilsa, tobin; Mira owns ama;
// Jonas (the GM) owns the NPCs hessa and moss.

import { grantsAt } from './sheet';
import {
  ABILITIES,
  type SchoolKey,
  type Org,
  type AbilityKey,
  type AttackRoutineState,
  type Campaign,
  type CatalogEntry,
  type Character,
  type ClassLevelState,
  type SheetEntry,
  type SkillKey,
  type Wield,
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
      castingAdvances: rest.castingAdvances ?? [],
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
  opts: {
    at?: string;
    active?: boolean;
    choice?: string;
    notes?: string;
    /** Items: how the weapon is held when it attacks (variant 2). */
    wield?: Wield;
    /** Arcane schools (#233). */
    opposition?: SchoolKey[];
  } = {},
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
        ? opts.wield
          ? { kind: 'item', quantity: 1, wield: opts.wield }
          : { kind: 'item', quantity: 1 }
        : opts.opposition
          ? {
              kind: 'classFeature',
              choice: null,
              oppositionSchools: opts.opposition,
            }
          : ({ kind, choice: opts.choice ?? null } as SheetEntry['state']),
  };
}

/** PROTOTYPE (#233): a recorded Spell for a Spellcasting (`level` only for off-list Spells). */
function spellRec(
  id: string,
  spellKey: string,
  castingClass: string,
  level: number | null = null,
): SheetEntry {
  return {
    id,
    kind: 'spell',
    catalogKey: spellKey,
    active: true,
    state: { kind: 'spell', castingClass, level },
  };
}

/** PROTOTYPE (#233): a Spell Effect with its recorded caster level. */
function effect(
  id: string,
  effectKey: string,
  casterLevel: number,
  opts: { active?: boolean; notes?: string } = {},
): SheetEntry {
  return {
    id,
    kind: 'spellEffect',
    catalogKey: effectKey,
    active: opts.active ?? false,
    notes: opts.notes,
    state: { kind: 'spellEffect', casterLevel },
  };
}

/**
 * PROTOTYPE (#233): adds every fixed class feature the Character's levels
 * grant that isn't on the sheet yet (as addClassLevel does), so the new seed
 * Characters don't list them by hand.
 */
function withFixedFeatures(c: Character): Character {
  const added: SheetEntry[] = [];
  for (const e of c.entries) {
    if (e.state.kind !== 'classLevel') continue;
    grantsAt(c, e.id).forEach((g, i) => {
      if (!('catalogKey' in g)) return;
      const there = c.entries.some(
        (x) => x.gainedAtClassLevel === e.id && x.catalogKey === g.catalogKey,
      );
      if (!there)
        added.push(
          has(
            `${e.id}-f${i}`,
            g.catalogKey,
            g.catalogKey.startsWith('feat.') ? 'feat' : 'classFeature',
            { at: e.id },
          ),
        );
    });
  }
  return { ...c, entries: [...c.entries, ...added] };
}

/** A saved Attack Routine (variant 3), a state-only entry. */
function routine(
  id: string,
  name: string,
  main: AttackRoutineState['main'],
  rest: { off?: AttackRoutineState['off']; powerAttack?: boolean } = {},
): SheetEntry {
  return {
    id,
    kind: 'attackRoutine',
    active: true,
    state: {
      kind: 'attackRoutine',
      name,
      main,
      ...(rest.off ? { off: rest.off } : {}),
      options: { powerAttack: rest.powerAttack ?? false },
    },
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
    // Weapons (#216), with how each is held when it attacks (variant 2).
    has('kesh-greataxe', 'item.greataxe+1', 'item', { wield: 'twoHands' }),
    has('kesh-kukri-1', 'item.kukri', 'item', { wield: 'primary' }),
    has('kesh-kukri-2', 'item.kukri', 'item', { wield: 'off' }),
    has('kesh-longbow', 'item.compositeLongbow2', 'item', {
      wield: 'twoHands',
    }),
    has('kesh-boots', 'item.bootsOfSpeed', 'item', { active: false }),
    // Saved Attack Routines (variant 3).
    routine('kesh-routine-greataxe', 'Greataxe', {
      entryId: 'kesh-greataxe',
      hand: 'twoHands',
    }),
    routine(
      'kesh-routine-greataxe-pa',
      'Greataxe with Power Attack',
      { entryId: 'kesh-greataxe', hand: 'twoHands' },
      { powerAttack: true },
    ),
    routine(
      'kesh-routine-kukris',
      'Two kukris',
      { entryId: 'kesh-kukri-1', hand: 'oneHand' },
      { off: { entryId: 'kesh-kukri-2' } },
    ),
    routine('kesh-routine-longbow', 'Longbow', {
      entryId: 'kesh-longbow',
      hand: 'twoHands',
    }),
    // Effects, off until toggled.
    has('kesh-raging', 'condition.raging', 'condition', { active: false }),
    effect('kesh-bulls', 'effect.bullsStrength', 3, {
      notes: 'Cast by Brother Ardo before a sortie',
    }),
    effect('kesh-haste', 'effect.haste', 4, {
      notes: 'From Ama before the gate fight',
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
    has('ama-cf-school', 'cf.school.divination', 'classFeature', {
      at: 'ama-l1',
      opposition: ['enchantment', 'necromancy'],
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
    effect('ama-mage-armor', 'effect.mageArmor', 5),
    effect('ama-haste', 'effect.haste', 5),
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
    has('brannoc-waraxe', 'item.dwarvenWaraxe', 'item', { wield: 'oneHand' }),
    has('brannoc-crossbow', 'item.lightCrossbow', 'item', {
      wield: 'twoHands',
    }),
    routine('brannoc-routine-waraxe', 'Waraxe and shield', {
      entryId: 'brannoc-waraxe',
      hand: 'oneHand',
    }),
    routine('brannoc-routine-crossbow', 'Crossbow', {
      entryId: 'brannoc-crossbow',
      hand: 'twoHands',
    }),
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
    }),
    has('ilsa-domain-animal', 'cf.domain.animal', 'classFeature', {
      at: 'ilsa-l1',
    }),
    has('ilsa-domain-community', 'cf.domain.community', 'classFeature', {
      at: 'ilsa-l1',
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

// ------------------------------------------------- spellcasters (#233)

const WIZ = 'class.wizard';
const CLE = 'class.cleric';
const MT = 'class.mysticTheurge';
const SOR = 'class.sorcerer';
const ARC = 'class.arcanist';
const PAL = 'class.paladin';

const serenRanks = ranks(
  'knowledgeArcana',
  'knowledgeReligion',
  'spellcraft',
  'knowledgeLocal',
  'knowledgeNature',
  'linguistics',
  'senseMotive',
  'heal',
);

/**
 * Human Wizard 3 / Cleric 3 / Mystic theurge 2 (W C W C W C MT MT). Mystic
 * theurge 1's two advances went to wizard and cleric (pre-filled); Mystic
 * theurge 2's arcane advance went to wizard and its divine one is empty.
 */
const seren: Character = withFixedFeatures({
  id: 'seren',
  ownerId: 'u1',
  campaignId: IRONFANG,
  name: 'Seren Vale',
  kind: 'pc',
  isActive: true,
  description:
    'Evoker and priestess of Sarenrae; burns the Ironfang’s siege lines.',
  sheetMode: 'full',
  ownCatalog: [
    baseCatalogEntry('seren', {
      str: 8,
      dex: 12,
      con: 14,
      int: 16,
      wis: 15,
      cha: 8,
    }),
  ],
  entries: [
    baseSheetEntry('seren'),
    {
      id: 'seren-race',
      kind: 'race',
      catalogKey: 'race.human',
      active: true,
      state: { kind: 'race', abilityChoice: 'int', favoredClass: WIZ },
    },
    classLevelEntry('seren-l1', 1, WIZ, {
      hpGained: 6,
      favoredClassBonus: { choice: 'hp' },
      skillRanks: serenRanks,
    }),
    classLevelEntry('seren-l2', 2, CLE, {
      hpGained: 6,
      skillRanks: serenRanks,
    }),
    classLevelEntry('seren-l3', 3, WIZ, {
      hpGained: 4,
      favoredClassBonus: { choice: 'hp' },
      skillRanks: serenRanks,
    }),
    classLevelEntry('seren-l4', 4, CLE, {
      hpGained: 5,
      abilityIncrease: 'wis',
      skillRanks: serenRanks,
    }),
    classLevelEntry('seren-l5', 5, WIZ, {
      hpGained: 3,
      favoredClassBonus: { choice: 'hp' },
      skillRanks: serenRanks,
    }),
    classLevelEntry('seren-l6', 6, CLE, {
      hpGained: 5,
      skillRanks: serenRanks,
    }),
    classLevelEntry('seren-l7', 7, MT, {
      hpGained: 4,
      skillRanks: serenRanks,
      castingAdvances: [WIZ, CLE],
    }),
    classLevelEntry('seren-l8', 8, MT, {
      hpGained: 3,
      abilityIncrease: 'int',
      skillRanks: serenRanks,
      castingAdvances: [WIZ, null],
    }),
    // Picks the levels offer: the arcane school and two domains.
    has('seren-school', 'cf.school.evocation', 'classFeature', {
      at: 'seren-l1',
      opposition: ['enchantment', 'necromancy'],
    }),
    has('seren-domain-fire', 'cf.domain.fire', 'classFeature', {
      at: 'seren-l2',
    }),
    has('seren-domain-sun', 'cf.domain.sun', 'classFeature', {
      at: 'seren-l2',
    }),
    // Feats: level 1, human bonus feat, levels 3, 5 and 7.
    has('seren-feat-focus', 'feat.spellFocus', 'feat', {
      at: 'seren-l1',
      choice: 'evocation',
    }),
    has('seren-feat-tough', 'feat.toughness', 'feat', {
      at: 'seren-l1',
      notes: 'Human bonus feat',
    }),
    has('seren-feat-iw', 'feat.ironWill', 'feat', { at: 'seren-l3' }),
    has('seren-feat-init', 'feat.improvedInitiative', 'feat', {
      at: 'seren-l5',
    }),
    has('seren-feat-alert', 'feat.alertness', 'feat', { at: 'seren-l7' }),
    has('seren-trait-faith', 'trait.indomitableFaith', 'trait'),
    has('seren-trait-lineage', 'trait.magicalLineage', 'trait'),
    has('seren-headband', 'item.headbandOfVastIntelligence2', 'item'),
    effect('seren-sof', 'effect.shieldOfFaith', 4, {
      notes: 'Cast on herself',
    }),
    effect('seren-fox', 'effect.foxsCunning', 3, { notes: 'From a scroll' }),
    // Spellbook (wizard).
    ...[
      'acidSplash',
      'bleed',
      'daze',
      'detectMagic',
      'light',
      'mageHand',
      'prestidigitation',
      'rayOfFrost',
      'readMagic',
      'burningHands',
      'grease',
      'mageArmor',
      'magicMissile',
      'shield',
      'sleep',
      'falseLife',
      'flamingSphere',
      'invisibility',
      'scorchingRay',
      'fireball',
      'haste',
      'wallOfFire',
    ].map((slug) => spellRec(`seren-sb-${slug}`, `spell.${slug}`, WIZ)),
    spellRec('seren-sb-summonNaturesAlly1', 'spell.summonNaturesAlly1', WIZ, 1),
  ],
});

const quillRanks = ranks(
  'knowledgeArcana',
  'spellcraft',
  'perception',
  'knowledgeLocal',
  'knowledgeNature',
  'linguistics',
  'fly',
);

/** Elf Arcanist 5: a spellbook, spells per day and the prepared count. */
const quill: Character = withFixedFeatures({
  id: 'quill',
  ownerId: 'u1',
  name: 'Quill',
  kind: 'pc',
  isActive: true,
  description: 'Elven arcanist; collects other people’s spellbooks.',
  sheetMode: 'full',
  ownCatalog: [
    baseCatalogEntry('quill', {
      str: 10,
      dex: 13,
      con: 14,
      int: 17,
      wis: 11,
      cha: 8,
    }),
  ],
  entries: [
    baseSheetEntry('quill'),
    {
      id: 'quill-race',
      kind: 'race',
      catalogKey: 'race.elf',
      active: true,
      state: { kind: 'race', abilityChoice: null, favoredClass: ARC },
    },
    classLevelEntry('quill-l1', 1, ARC, {
      hpGained: 6,
      favoredClassBonus: { choice: 'hp' },
      skillRanks: quillRanks,
    }),
    classLevelEntry('quill-l2', 2, ARC, {
      hpGained: 4,
      favoredClassBonus: { choice: 'hp' },
      skillRanks: quillRanks,
    }),
    classLevelEntry('quill-l3', 3, ARC, {
      hpGained: 4,
      favoredClassBonus: { choice: 'hp' },
      skillRanks: quillRanks,
    }),
    classLevelEntry('quill-l4', 4, ARC, {
      hpGained: 3,
      favoredClassBonus: { choice: 'hp' },
      abilityIncrease: 'int',
      skillRanks: quillRanks,
    }),
    classLevelEntry('quill-l5', 5, ARC, {
      hpGained: 5,
      favoredClassBonus: { choice: 'hp' },
      skillRanks: quillRanks,
    }),
    has('quill-feat-init', 'feat.improvedInitiative', 'feat', {
      at: 'quill-l1',
    }),
    has('quill-feat-iw', 'feat.ironWill', 'feat', { at: 'quill-l3' }),
    has('quill-feat-lr', 'feat.lightningReflexes', 'feat', { at: 'quill-l5' }),
    ...[
      'acidSplash',
      'daze',
      'detectMagic',
      'light',
      'mageHand',
      'prestidigitation',
      'rayOfFrost',
      'readMagic',
      'colorSpray',
      'grease',
      'identify',
      'mageArmor',
      'magicMissile',
      'shield',
      'sleep',
      'glitterdust',
      'invisibility',
      'mirrorImage',
      'web',
    ].map((slug) => spellRec(`quill-sb-${slug}`, `spell.${slug}`, ARC)),
  ],
});

/**
 * Human Sorcerer 7, Arcane bloodline: four 2nd-level Spells known where the
 * table allows three, and a wizard Spell left over with no wizard levels.
 */
const nyra: Character = withFixedFeatures({
  id: 'nyra',
  ownerId: 'u1',
  name: 'Nyra Ashgrove',
  kind: 'pc',
  isActive: true,
  description: 'Sorcerer from a line of Lastwall court mages.',
  sheetMode: 'full',
  ownCatalog: [
    baseCatalogEntry('nyra', {
      str: 8,
      dex: 13,
      con: 14,
      int: 10,
      wis: 11,
      cha: 17,
    }),
  ],
  entries: [
    baseSheetEntry('nyra'),
    {
      id: 'nyra-race',
      kind: 'race',
      catalogKey: 'race.human',
      active: true,
      state: { kind: 'race', abilityChoice: 'cha', favoredClass: SOR },
    },
    ...[6, 4, 3, 5, 4, 3, 4].map((hp, i) =>
      classLevelEntry(`nyra-l${i + 1}`, i + 1, SOR, {
        hpGained: hp,
        favoredClassBonus: { choice: 'hp' },
        abilityIncrease: i === 3 ? 'con' : null,
        skillRanks: ranks('spellcraft', 'knowledgeArcana', 'bluff'),
      }),
    ),
    has('nyra-bloodline', 'cf.bloodline.arcane', 'classFeature', {
      at: 'nyra-l1',
    }),
    has('nyra-feat-init', 'feat.improvedInitiative', 'feat', { at: 'nyra-l1' }),
    has('nyra-feat-tough', 'feat.toughness', 'feat', {
      at: 'nyra-l1',
      notes: 'Human bonus feat',
    }),
    has('nyra-feat-iw', 'feat.ironWill', 'feat', { at: 'nyra-l3' }),
    has('nyra-feat-lr', 'feat.lightningReflexes', 'feat', { at: 'nyra-l5' }),
    has('nyra-feat-cc', 'feat.combatCasting', 'feat', { at: 'nyra-l7' }),
    ...[
      'acidSplash',
      'detectMagic',
      'light',
      'mageHand',
      'prestidigitation',
      'rayOfFrost',
      'readMagic',
      'colorSpray',
      'grease',
      'mageArmor',
      'magicMissile',
      'shield',
      'glitterdust',
      'mirrorImage',
      'scorchingRay',
      'web',
      'fireball',
      'haste',
    ].map((slug) => spellRec(`nyra-sk-${slug}`, `spell.${slug}`, SOR)),
    spellRec('nyra-orphan-featherFall', 'spell.featherFall', WIZ),
  ],
});

/** Human Paladin 4: a `none` Spellcasting, caster level 1, bonus spells only. */
const oswin: Character = withFixedFeatures({
  id: 'oswin',
  ownerId: 'u1',
  name: 'Ser Oswin',
  kind: 'pc',
  isActive: true,
  description: 'Paladin of Iomedae; holds the ford.',
  sheetMode: 'full',
  ownCatalog: [
    baseCatalogEntry('oswin', {
      str: 16,
      dex: 10,
      con: 14,
      int: 10,
      wis: 10,
      cha: 14,
    }),
  ],
  entries: [
    baseSheetEntry('oswin'),
    {
      id: 'oswin-race',
      kind: 'race',
      catalogKey: 'race.human',
      active: true,
      state: { kind: 'race', abilityChoice: 'cha', favoredClass: PAL },
    },
    ...[10, 8, 7, 9].map((hp, i) =>
      classLevelEntry(`oswin-l${i + 1}`, i + 1, PAL, {
        hpGained: hp,
        favoredClassBonus: { choice: 'hp' },
        abilityIncrease: i === 3 ? 'str' : null,
        skillRanks: ranks('diplomacy', 'senseMotive', 'knowledgeReligion'),
      }),
    ),
    has('oswin-feat-pa', 'feat.powerAttack', 'feat', { at: 'oswin-l1' }),
    has('oswin-feat-tough', 'feat.toughness', 'feat', {
      at: 'oswin-l1',
      notes: 'Human bonus feat',
    }),
    has('oswin-feat-iw', 'feat.ironWill', 'feat', { at: 'oswin-l3' }),
    has('oswin-armor', 'item.chainShirt', 'item'),
  ],
});

export const SEED_CHARACTERS: Character[] = [
  kesh,
  ama,
  hessa,
  ardo,
  moss,
  brannoc,
  ilsa,
  tobin,
  seren,
  quill,
  nyra,
  oswin,
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
