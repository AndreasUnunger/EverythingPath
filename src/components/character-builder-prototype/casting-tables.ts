// PROTOTYPE (throwaway, #233) — the casting tables subset (data model
// "Casting tables"): the shared (type, progression) tables this prototype's
// classes need. Rows are class levels 1–20; each row lists spell levels 0…9,
// `null` where the table has no entry and 0 where it says "0" (bonus spells
// only). Checked against Archives of Nethys (CRB wizard, sorcerer, paladin;
// UM magus; ACG arcanist) and `research/pf1-spellcasting-rules` (the bard /
// unchained summoner tables).

import type { CastingTableKey } from './types';

type Row = (number | null)[];
type Table = Row[];

const _ = null;

/** Wizard, cleric, druid, witch: 0–9th, prepared. */
const PREPARED_HIGH: Table = [
  [3, 1],
  [4, 2],
  [4, 2, 1],
  [4, 3, 2],
  [4, 3, 2, 1],
  [4, 3, 3, 2],
  [4, 4, 3, 2, 1],
  [4, 4, 3, 3, 2],
  [4, 4, 4, 3, 2, 1],
  [4, 4, 4, 3, 3, 2],
  [4, 4, 4, 4, 3, 2, 1],
  [4, 4, 4, 4, 3, 3, 2],
  [4, 4, 4, 4, 4, 3, 2, 1],
  [4, 4, 4, 4, 4, 3, 3, 2],
  [4, 4, 4, 4, 4, 4, 3, 2, 1],
  [4, 4, 4, 4, 4, 4, 3, 3, 2],
  [4, 4, 4, 4, 4, 4, 4, 3, 2, 1],
  [4, 4, 4, 4, 4, 4, 4, 3, 3, 2],
  [4, 4, 4, 4, 4, 4, 4, 4, 3, 3],
  [4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
];

/** Sorcerer, oracle: per day 1st–9th (cantrips are known, cast at will). */
const SPONTANEOUS_HIGH: Table = [
  [_, 3],
  [_, 4],
  [_, 5],
  [_, 6, 3],
  [_, 6, 4],
  [_, 6, 5, 3],
  [_, 6, 6, 4],
  [_, 6, 6, 5, 3],
  [_, 6, 6, 6, 4],
  [_, 6, 6, 6, 5, 3],
  [_, 6, 6, 6, 6, 4],
  [_, 6, 6, 6, 6, 5, 3],
  [_, 6, 6, 6, 6, 6, 4],
  [_, 6, 6, 6, 6, 6, 5, 3],
  [_, 6, 6, 6, 6, 6, 6, 4],
  [_, 6, 6, 6, 6, 6, 6, 5, 3],
  [_, 6, 6, 6, 6, 6, 6, 6, 4],
  [_, 6, 6, 6, 6, 6, 6, 6, 5, 3],
  [_, 6, 6, 6, 6, 6, 6, 6, 6, 4],
  [_, 6, 6, 6, 6, 6, 6, 6, 6, 6],
];

/** Sorcerer, oracle spells known; the arcanist's spells prepared is the same table. */
const KNOWN_HIGH: Table = [
  [4, 2],
  [5, 2],
  [5, 3],
  [6, 3, 1],
  [6, 4, 2],
  [7, 4, 2, 1],
  [7, 5, 3, 2],
  [8, 5, 3, 2, 1],
  [8, 5, 4, 3, 2],
  [9, 5, 4, 3, 2, 1],
  [9, 5, 5, 4, 3, 2],
  [9, 5, 5, 4, 3, 2, 1],
  [9, 5, 5, 4, 4, 3, 2],
  [9, 5, 5, 4, 4, 3, 2, 1],
  [9, 5, 5, 4, 4, 4, 3, 2],
  [9, 5, 5, 4, 4, 4, 3, 2, 1],
  [9, 5, 5, 4, 4, 4, 3, 3, 2],
  [9, 5, 5, 4, 4, 4, 3, 3, 2, 1],
  [9, 5, 5, 4, 4, 4, 3, 3, 3, 2],
  [9, 5, 5, 4, 4, 4, 3, 3, 3, 3],
];

/** Arcanist (ACG Table 1–2): per day 1st–9th; cantrips are prepared, cast at will. */
const HYBRID_HIGH: Table = [
  [_, 2],
  [_, 3],
  [_, 4],
  [_, 4, 2],
  [_, 4, 3],
  [_, 4, 4, 2],
  [_, 4, 4, 3],
  [_, 4, 4, 4, 2],
  [_, 4, 4, 4, 3],
  [_, 4, 4, 4, 4, 2],
  [_, 4, 4, 4, 4, 3],
  [_, 4, 4, 4, 4, 4, 2],
  [_, 4, 4, 4, 4, 4, 3],
  [_, 4, 4, 4, 4, 4, 4, 2],
  [_, 4, 4, 4, 4, 4, 4, 3],
  [_, 4, 4, 4, 4, 4, 4, 4, 2],
  [_, 4, 4, 4, 4, 4, 4, 4, 3],
  [_, 4, 4, 4, 4, 4, 4, 4, 4, 2],
  [_, 4, 4, 4, 4, 4, 4, 4, 4, 3],
  [_, 4, 4, 4, 4, 4, 4, 4, 4, 4],
];

/** Magus: 0–6th, prepared. */
const PREPARED_MED: Table = [
  [3, 1],
  [4, 2],
  [4, 3],
  [4, 3, 1],
  [4, 4, 2],
  [5, 4, 3],
  [5, 4, 3, 1],
  [5, 4, 4, 2],
  [5, 5, 4, 3],
  [5, 5, 4, 3, 1],
  [5, 5, 4, 4, 2],
  [5, 5, 5, 4, 3],
  [5, 5, 5, 4, 3, 1],
  [5, 5, 5, 4, 4, 2],
  [5, 5, 5, 5, 4, 3],
  [5, 5, 5, 5, 4, 3, 1],
  [5, 5, 5, 5, 4, 4, 2],
  [5, 5, 5, 5, 5, 4, 3],
  [5, 5, 5, 5, 5, 5, 4],
  [5, 5, 5, 5, 5, 5, 5],
];

/** Bard, summoner: per day 1st–6th. */
const SPONTANEOUS_MED: Table = [
  [_, 1],
  [_, 2],
  [_, 3],
  [_, 3, 1],
  [_, 4, 2],
  [_, 4, 3],
  [_, 4, 3, 1],
  [_, 4, 4, 2],
  [_, 5, 4, 3],
  [_, 5, 4, 3, 1],
  [_, 5, 4, 4, 2],
  [_, 5, 5, 4, 3],
  [_, 5, 5, 4, 3, 1],
  [_, 5, 5, 4, 4, 2],
  [_, 5, 5, 5, 4, 3],
  [_, 5, 5, 5, 4, 3, 1],
  [_, 5, 5, 5, 4, 4, 2],
  [_, 5, 5, 5, 5, 4, 3],
  [_, 5, 5, 5, 5, 5, 4],
  [_, 5, 5, 5, 5, 5, 5],
];

/** Bard, summoner spells known: 0–6th. */
const KNOWN_MED: Table = [
  [4, 2],
  [5, 3],
  [6, 4],
  [6, 4, 2],
  [6, 4, 3],
  [6, 4, 4],
  [6, 5, 4, 2],
  [6, 5, 4, 3],
  [6, 5, 4, 4],
  [6, 5, 5, 4, 2],
  [6, 6, 5, 4, 3],
  [6, 6, 5, 4, 4],
  [6, 6, 5, 5, 4, 2],
  [6, 6, 6, 5, 4, 3],
  [6, 6, 6, 5, 4, 4],
  [6, 6, 6, 5, 5, 4, 2],
  [6, 6, 6, 6, 5, 4, 3],
  [6, 6, 6, 6, 5, 4, 4],
  [6, 6, 6, 6, 5, 5, 4],
  [6, 6, 6, 6, 6, 5, 5],
];

/** Paladin, ranger: 1st–4th, from 4th level; "0" = bonus spells only. */
const PREPARED_LOW: Table = [
  [],
  [],
  [],
  [_, 0],
  [_, 1],
  [_, 1],
  [_, 1, 0],
  [_, 1, 1],
  [_, 2, 1],
  [_, 2, 1, 0],
  [_, 2, 1, 1],
  [_, 2, 2, 1],
  [_, 3, 2, 1, 0],
  [_, 3, 2, 1, 1],
  [_, 3, 2, 2, 1],
  [_, 3, 3, 2, 1],
  [_, 4, 3, 2, 1],
  [_, 4, 3, 2, 2],
  [_, 4, 3, 3, 2],
  [_, 4, 4, 3, 3],
];

export type CastingTable = {
  spellsPerDay: Table;
  /** `known` casters. */
  spellsKnown?: Table;
  /** The arcanist. */
  preparedPerDay?: Table;
};

export const CASTING_TABLES: Record<CastingTableKey, CastingTable> = {
  preparedHigh: { spellsPerDay: PREPARED_HIGH },
  spontaneousHigh: { spellsPerDay: SPONTANEOUS_HIGH, spellsKnown: KNOWN_HIGH },
  hybridHigh: { spellsPerDay: HYBRID_HIGH, preparedPerDay: KNOWN_HIGH },
  preparedMed: { spellsPerDay: PREPARED_MED },
  spontaneousMed: { spellsPerDay: SPONTANEOUS_MED, spellsKnown: KNOWN_MED },
  preparedLow: { spellsPerDay: PREPARED_LOW },
};

/** A table cell: the row for `castingLevel` (capped at 20), spell level `level`; null = no entry. */
export function cell(
  table: Table | undefined,
  castingLevel: number,
  level: number,
): number | null {
  if (!table || castingLevel < 1) return null;
  const row = table[Math.min(castingLevel, 20) - 1] ?? [];
  return row[level] ?? null;
}

/**
 * Bonus spells per day (CRB Table 1–3) for a score at a spell level (1st+):
 * `ceil((mod + 1 − level) / 4)` when positive, which reproduces the table.
 */
export function bonusSpells(score: number, level: number): number {
  if (level < 1) return 0;
  const mod = Math.floor((score - 10) / 2);
  if (mod < level) return 0;
  return Math.ceil((mod + 1 - level) / 4);
}
