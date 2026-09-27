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
// A deliberate numeric edit writes the approved total form against the rule's
// expected specification, never the recorded array length. Provenance and
// modifiers survive from either prior representation; only a genuinely new
// roll defaults to a table roll with no modifiers.
export function totalRoll(
  diceTotal: number,
  spec: RollSpec,
  prior: RawRoll | null | undefined,
): TotalRawRoll {
  return {
    diceTotal,
    diceCount: spec.count,
    sides: spec.sides,
    provenance: prior?.provenance ?? { kind: 'table' },
    modifiers: prior?.modifiers ?? [],
  };
}
// The value an editor shows: a complete roll's dice-only total in either
// form, and nothing for missing, partial or wrong-specification data.
export function editableTotal(facts: RollReadFacts): number | null {
  return facts.normalized.status === 'complete'
    ? facts.normalized.diceTotal
    : null;
}
// Resolves the rule specification for a nested roll from its path relative to
// the edited structure (e.g. ['targetChecks', 0, 'rolls', 'loss']). Null means
// no authoritative specification; editors then never write a number.
export type RollSpecResolver = (
  path: readonly (string | number)[],
) => RollSpec | null;
export function rollPathSegments(path: string): (string | number)[] {
  return path
    .split('.')
    .filter(Boolean)
    .map((segment) => (/^\d+$/.test(segment) ? Number(segment) : segment));
}
