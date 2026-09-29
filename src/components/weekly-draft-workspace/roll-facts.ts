import type { RawRoll } from '~/lib/weekly-draft-facts';
import { EVENT_TYPES, type EventType } from '~/lib/militia-domain';
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
// the edited structure (e.g. ['targetChecks', 0, 'rolls', 'loss']) and the
// CURRENT local form root, so context that the player is still editing (an
// unsaved candidate table roll) counts immediately. Null means no
// authoritative specification; editors then never write a number.
export type RollSpecResolver = (
  path: readonly (string | number)[],
  root: unknown,
) => RollSpec | null;
export function rollPathSegments(path: string): (string | number)[] {
  return path
    .split('.')
    .filter(Boolean)
    .map((segment) => (/^\d+$/.test(segment) ? Number(segment) : segment));
}

// Explains recorded data that the current specification cannot use as a
// complete roll, so the player sees exactly what is retained until they type
// a replacement or clear it. Null for missing or complete rolls.
export function recordedRollExplanation(
  recorded: RawRoll | null | undefined,
  spec: RollSpec,
): string | null {
  if (!recorded || normalizeRawRoll(recorded, spec).status !== 'incomplete')
    return null;
  const needed = rollNotation(spec);
  if (isTotalRoll(recorded))
    return `Recorded total ${recorded.diceTotal} was entered for ${rollNotation({ count: recorded.diceCount, sides: recorded.sides })}, but this step needs ${needed}. Enter the total or clear the recorded roll.`;
  const dice = recorded.dice.join(', ');
  if (recorded.sides === spec.sides && recorded.dice.length < spec.count)
    return `Recorded dice ${dice} are incomplete for ${needed}. Enter the total of all dice or clear the recorded roll.`;
  return `Recorded dice ${dice} were entered for ${rollNotation({ count: recorded.dice.length, sides: recorded.sides })}, but this step needs ${needed}. Enter the total or clear the recorded roll.`;
}
// Advisory wording for a complete roll outside its usual range; never blocks.
export function rangeAdvisory(
  normalized: NormalizedRoll,
  spec: RollSpec,
): string | null {
  if (normalized.status !== 'complete') return null;
  if (normalized.rangeWarning === 'total')
    return `The usual range is ${spec.count}–${spec.count * spec.sides}. Your entered total is retained for the table.`;
  if (normalized.rangeWarning === 'legacy-die')
    return `The recorded dice include a value outside 1–${spec.sides}. They are retained for the table until you enter a new total.`;
  return null;
}
// Narrows a projected event type string to the domain type for spec lookups.
export function resolvedEventType(value: string | null): EventType | null {
  return (EVENT_TYPES as readonly string[]).includes(value ?? '')
    ? (value as EventType)
    : null;
}
