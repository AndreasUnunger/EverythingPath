// PROTOTYPE (throwaway, #208) — how the builder pre-fills a Class Level's
// `hpGained`. The recorded number is always editable afterwards.

import type { HpPolicy } from './types';

export const HP_POLICIES: {
  key: HpPolicy;
  label: string;
  description: string;
  /** false = a table rule, not Core Rulebook text. */
  crb: boolean;
}[] = [
  {
    key: 'maxFirst+roll',
    label: 'Max at 1st, then roll',
    description:
      'Core Rulebook: maximum hit points at 1st character level, roll the Hit Die for every later level.',
    crb: true,
  },
  {
    key: 'maxFirst+average',
    label: 'Max at 1st, then average',
    description:
      'Table rule (not in the Core Rulebook, but used by Pathfinder Society): maximum at 1st level, then half the Hit Die + 1.',
    crb: false,
  },
  {
    key: 'max',
    label: 'Always max',
    description:
      'Table rule (not in the Core Rulebook): maximum hit points at every level.',
    crb: false,
  },
];

export type HpPrefill = {
  /** The pre-filled number, or null when the player should roll. */
  value: number | null;
  /** Show a roll affordance (the value is null, or the player may reroll). */
  roll: boolean;
  /** Short reason, e.g. "Max at 1st level (d12)" or "Roll 1d8". */
  reason: string;
};

/**
 * The pre-fill for a Class Level at `position` (its character level,
 * 1-based) with the class's `hitDie`. Unspecified levels have no hit die.
 */
export function hpPrefill({
  position,
  hitDie,
  policy,
}: {
  position: number;
  hitDie: number | null;
  policy: HpPolicy;
}): HpPrefill {
  if (hitDie === null)
    return {
      value: null,
      roll: false,
      reason: 'No class: choose one to pre-fill hit points',
    };
  if (position === 1 || policy === 'max')
    return {
      value: hitDie,
      roll: false,
      reason:
        position === 1
          ? `Max at 1st level (d${hitDie})`
          : `Max (d${hitDie}), table rule`,
    };
  if (policy === 'maxFirst+average')
    return {
      value: hitDie / 2 + 1,
      roll: true,
      reason: `Average of d${hitDie}: ${hitDie / 2} + 1 (table rule)`,
    };
  return { value: null, roll: true, reason: `Roll 1d${hitDie}` };
}

/** A fair roll of one Hit Die, 1…hitDie. */
export function rollHitDie(hitDie: number) {
  return 1 + Math.floor(Math.random() * hitDie);
}
