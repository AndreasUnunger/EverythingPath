import reviewedCastingTables from '../../scripts/catalog/reviewed-casting-tables.json';
import { z } from 'zod';
import { abilityKeys } from './character-sheet-abilities';

export const castingTableKeys = [
  'prepared-full',
  'prepared-medium',
  'prepared-low',
  'spontaneous-full',
  'spontaneous-medium',
  'spontaneous-low',
  'hybrid-full',
  'adept',
  'extracts',
  'unchained-summoner',
  'occultist',
] as const;
export type CastingTableKey = (typeof castingTableKeys)[number];
export type Casting = z.infer<typeof classCastingSchema>;
export const MAX_LEVEL = 20;
export type CastingTableRow = {
  spellsPerDay: (number | null)[];
  spellsKnown?: (number | null)[];
  preparedPerDay?: (number | null)[];
  castableSpellLevels?: number[];
};

export const classCastingSchema = z.object({
  classTag: z.string(),
  type: z.enum(['prepared', 'spontaneous', 'hybrid']),
  spellKind: z.enum(['arcane', 'divine', 'psychic', 'alchemy']),
  ability: z.enum(abilityKeys),
  cantrips: z.boolean(),
  casterLevelOffset: z.number(),
  table: z.enum(castingTableKeys),
  record: z.enum(['known', 'book', 'none']),
  bookType: z.enum(['spellbook', 'formula', 'familiar']).optional(),
});
const classCasting: Record<string, Casting> = Object.fromEntries(
  Object.entries(reviewedCastingTables.classes).map(([key, value]) => [
    key,
    classCastingSchema.parse(value),
  ]),
);

export function findReviewedClassCasting(
  classTag: string,
): Casting | undefined {
  return Object.hasOwn(classCasting, classTag)
    ? classCasting[classTag]
    : undefined;
}

/** Rows are indexed by spell level, including a nullable zero-level column. */
export function findCastingTableRow(
  table: CastingTableKey,
  castingLevel: number,
): CastingTableRow | undefined {
  if (!Number.isInteger(castingLevel) || castingLevel < 1) return undefined;
  return reviewedCastingTables.tables[table].rows[
    Math.min(MAX_LEVEL, castingLevel) - 1
  ];
}

export function castingTableIncludesZeroLevel(table: CastingTableKey): boolean {
  return reviewedCastingTables.tables[table].includesZeroLevel;
}
