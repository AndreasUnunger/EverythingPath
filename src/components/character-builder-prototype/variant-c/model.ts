// PROTOTYPE (throwaway, #208) — Variant C pure helpers: which timeline card
// a contribution belongs to, a sheet "without this level" for deltas, and
// what a class would give at a card's next level.

import { CLASSES, classDetail, type ClassDetail } from '../catalog';
import { resolveSheet } from '../resolve';
import { classLevels, className, lookupCatalog } from '../sheet';
import type {
  Character,
  ResolvedSheet,
  SaveKey,
  SkillKey,
  Stat,
} from '../types';

/** Timeline cards: 'foundation', one per Class Level (its entry id), and 'now'. */
export type CardKey = string;
export const FOUNDATION: CardKey = 'foundation';
export const NOW: CardKey = 'now';

/** Keys the live sheet's selectable numbers use. */
export type StatKey =
  | `ability.${string}`
  | `save.${SaveKey}`
  | `skill.${SkillKey}`
  | 'hp'
  | 'ac'
  | 'touchAc'
  | 'flatFootedAc'
  | 'init'
  | 'bab'
  | 'attackMelee'
  | 'attackRanged'
  | 'cmb'
  | 'cmd'
  | 'flatFootedCmd';

export const STAT_LABEL: Record<string, string> = {
  hp: 'Hit points',
  ac: 'Armor class',
  touchAc: 'Touch AC',
  flatFootedAc: 'Flat-footed AC',
  init: 'Initiative',
  bab: 'Base attack bonus',
  attackMelee: 'Melee attack',
  attackRanged: 'Ranged attack',
  cmb: 'CMB',
  cmd: 'CMD',
  flatFootedCmd: 'Flat-footed CMD',
  'save.fort': 'Fortitude',
  'save.ref': 'Reflex',
  'save.will': 'Will',
};

export function statByKey(
  sheet: ResolvedSheet,
  key: string | null,
): Stat | undefined {
  if (!key) return undefined;
  if (key.startsWith('ability.'))
    return sheet.abilities[key.slice(8) as keyof typeof sheet.abilities];
  if (key.startsWith('save.'))
    return sheet.saves[key.slice(5) as keyof typeof sheet.saves];
  if (key.startsWith('skill.'))
    return sheet.skills[key.slice(6) as keyof typeof sheet.skills];
  const direct = sheet[key as keyof ResolvedSheet];
  return direct && typeof direct === 'object' && 'applied' in direct
    ? direct
    : undefined;
}

/** The timeline card an entry is edited on. */
export function cardOfEntry(
  character: Character,
  entryId: string,
): CardKey | null {
  const entry = character.entries.find((e) => e.id === entryId);
  if (!entry) return null;
  if (entry.kind === 'classLevel') return entry.id;
  if (entry.gainedAtClassLevel) return entry.gainedAtClassLevel;
  if (entry.kind === 'base' || entry.kind === 'race' || entry.kind === 'trait')
    return FOUNDATION;
  return NOW;
}

/** Cards that feed a statistic, with the sum each one contributes. */
export function contributorCards(
  character: Character,
  stat: Stat | undefined,
): Map<CardKey, number> {
  const out = new Map<CardKey, number>();
  if (!stat) return out;
  const levels = classLevels(character);
  const add = (card: CardKey, value: number) =>
    out.set(card, (out.get(card) ?? 0) + value);
  for (const c of stat.applied) {
    if (c.entryId) {
      const card = cardOfEntry(character, c.entryId);
      if (card) add(card, c.value);
      continue;
    }
    // "BAB (Barbarian 4)", "Base save (Rogue 3, good)": spread over that class's levels.
    const match = /^(?:BAB|Base save) \((.+?) \d+/.exec(c.label);
    if (match) {
      const owned = levels.filter(
        (l) => className(l.state.classKey) === match[1],
      );
      for (const l of owned) add(l.id, 0);
      if (owned.length) {
        const last = owned[owned.length - 1]!;
        add(last.id, c.value);
      }
    }
  }
  return out;
}

/** The Character as it would be without one Class Level (and what it granted). */
export function withoutLevel(character: Character, levelId: string): Character {
  const order = classLevels(character)
    .map((l) => l.id)
    .filter((id) => id !== levelId);
  return {
    ...character,
    entries: character.entries.flatMap((e) => {
      if (e.id === levelId || e.gainedAtClassLevel === levelId) return [];
      if (e.state.kind === 'classLevel')
        return [
          { ...e, state: { ...e.state, position: order.indexOf(e.id) + 1 } },
        ];
      return [e];
    }),
  };
}

export function resolveWithout(character: Character, levelId: string) {
  return resolveSheet(withoutLevel(character, levelId));
}

const babAt = (detail: ClassDetail, n: number) =>
  detail.bab === 'full'
    ? n
    : detail.bab === 'threeQuarters'
      ? Math.floor((n * 3) / 4)
      : Math.floor(n / 2);

const saveAt = (detail: ClassDetail, save: SaveKey, n: number) =>
  detail.saves[save] === 'good' ? 2 + Math.floor(n / 2) : Math.floor(n / 3);

export type ClassPreview = {
  classKey: string;
  name: string;
  /** Level in the class this card would be. */
  n: number;
  hitDie: number;
  babGain: number;
  saveGains: Record<SaveKey, number>;
  ranks: number;
  features: string[];
};

/**
 * What each class gives if this card (at `position`, or appended when
 * null) takes it: its level in the class, BAB and save gains, and the
 * features at that class level.
 */
export function classPreviews(
  character: Character,
  position: number | null,
): ClassPreview[] {
  const levels = classLevels(character);
  return CLASSES.flatMap((cls) => {
    const detail = classDetail(cls.key);
    if (!detail) return [];
    const earlier = levels.filter(
      (l) =>
        l.state.classKey === cls.key &&
        (position === null || l.state.position < position),
    ).length;
    const n = earlier + 1;
    const features = detail.featuresByLevel
      .filter((g) => g.classLevel === n)
      .map((g) =>
        'catalogKey' in g
          ? (lookupCatalog(character, g.catalogKey)?.name ?? g.catalogKey)
          : g.label,
      );
    return [
      {
        classKey: cls.key,
        name: cls.name,
        n,
        hitDie: detail.hitDie,
        babGain: babAt(detail, n) - babAt(detail, n - 1),
        saveGains: {
          fort: saveAt(detail, 'fort', n) - saveAt(detail, 'fort', n - 1),
          ref: saveAt(detail, 'ref', n) - saveAt(detail, 'ref', n - 1),
          will: saveAt(detail, 'will', n) - saveAt(detail, 'will', n - 1),
        },
        ranks: detail.skillRanksPerLevel,
        features,
      },
    ];
  });
}

/** The card keys in timeline order. */
export function cardOrder(character: Character): CardKey[] {
  return [FOUNDATION, ...classLevels(character).map((l) => l.id), NOW];
}

export function parseOpen(value: string | null): Set<CardKey> {
  return new Set((value ?? '').split(',').filter(Boolean));
}

export function serializeOpen(open: Set<CardKey>): string | null {
  return open.size ? [...open].join(',') : null;
}
