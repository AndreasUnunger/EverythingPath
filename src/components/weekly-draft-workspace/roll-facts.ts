import type { RawRoll } from '~/lib/weekly-draft-facts';
import {
  normalizeRawRoll,
  type NormalizedRoll,
  type RollSpec,
} from '~/lib/raw-roll';

// Reader-side roll facts: the original recorded roll stays beside the shared
// normalization so views can show recorded data honestly and calculate only
// through the pure normalizer. Nothing here rewrites or fabricates dice.
export type LegacyRawRoll = Extract<RawRoll, { dice: number[] }>;
export type TotalRawRoll = Extract<RawRoll, { diceTotal: number }>;
export type RollReadFacts = {
  recorded: RawRoll | null;
  normalized: NormalizedRoll;
};

export function isLegacyRoll(raw: RawRoll): raw is LegacyRawRoll {
  return 'dice' in raw;
}
export function isTotalRoll(raw: RawRoll): raw is TotalRawRoll {
  return !('dice' in raw);
}
export function recordedDiceCount(raw: RawRoll) {
  return isLegacyRoll(raw) ? raw.dice.length : raw.diceCount;
}
export function rollNotation(spec: RollSpec) {
  return `${spec.count}d${spec.sides}`;
}
export function rollReadFacts(
  raw: RawRoll | null | undefined,
  spec: RollSpec,
): RollReadFacts {
  return { recorded: raw ?? null, normalized: normalizeRawRoll(raw, spec) };
}
// Ordered editor slots for the existing per-die legacy writer. Only an actual
// legacy array fills slots; a total form has no individual dice and yields
// null so callers never render a total as blank required dice.
export function legacyDiceSlots(
  raw: RawRoll | null | undefined,
  spec: RollSpec,
): (number | null)[] | null {
  if (raw && isTotalRoll(raw)) return null;
  const dice = raw?.sides === spec.sides ? raw.dice : [];
  return Array.from({ length: spec.count }, (_, index) => dice[index] ?? null);
}
