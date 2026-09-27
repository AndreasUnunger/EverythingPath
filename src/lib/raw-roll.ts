import type { RawRoll } from './weekly-draft-facts';

export type RollSpec = Readonly<{ count: number; sides: number }>;
export type NormalizedRoll = RollSpec &
  (
    | {
        status: 'missing' | 'incomplete';
        diceTotal: null;
        naturalValue: null;
        rangeWarning: null;
      }
    | {
        status: 'complete';
        diceTotal: number;
        naturalValue: number | null;
        rangeWarning: 'legacy-die' | 'total' | null;
      }
  );

export function normalizeRawRoll(
  raw: RawRoll | null | undefined,
  expected: RollSpec,
): NormalizedRoll {
  if (!raw)
    return {
      ...expected,
      status: 'missing',
      diceTotal: null,
      naturalValue: null,
      rangeWarning: null,
    };
  const count = 'dice' in raw ? raw.dice.length : raw.diceCount;
  if (raw.sides !== expected.sides || count !== expected.count)
    return {
      ...expected,
      status: 'incomplete',
      diceTotal: null,
      naturalValue: null,
      rangeWarning: null,
    };
  const diceTotal =
    'dice' in raw
      ? raw.dice.reduce((sum, value) => sum + value, 0)
      : raw.diceTotal;
  const rangeWarning =
    'dice' in raw
      ? raw.dice.some((value) => value < 1 || value > expected.sides)
        ? 'legacy-die'
        : null
      : diceTotal < expected.count ||
          diceTotal > expected.count * expected.sides
        ? 'total'
        : null;
  return {
    ...expected,
    status: 'complete',
    diceTotal,
    naturalValue: expected.count === 1 ? diceTotal : null,
    rangeWarning,
  };
}
