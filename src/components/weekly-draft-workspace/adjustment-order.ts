import type { WeeklyDraft } from '~/lib/weekly-draft-contract';

type Adjustment = WeeklyDraft['tableAdjustments'][number];

/** The complete ordered list with one adjustment swapped with its neighbour. */
export function moveAdjustment(
  adjustments: readonly Adjustment[],
  index: number,
  offset: -1 | 1,
) {
  const next = [...adjustments];
  const target = index + offset;
  const [moved, neighbour] = [next[index], next[target]];
  if (!moved || !neighbour) return next;
  next[target] = moved;
  next[index] = neighbour;
  return next;
}
