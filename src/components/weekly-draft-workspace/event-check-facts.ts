import type { RollSpec } from '~/lib/raw-roll';
import { RULE_ROLL_SPECS } from '~/lib/rules-roll-spec';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import type { EventCheckFacts, EventView } from './types';

type ProjectedCheck = EventView['checks'][number];
export type OrganizationCheck = 'loyalty' | 'secrecy' | 'security';

const checkNames: Record<OrganizationCheck, string> = {
  loyalty: 'Loyalty',
  secrecy: 'Secrecy',
  security: 'Security',
};

// Contribution names in an Event check breakdown. The rules calculate these
// for every check; the people supplying them are never named here.
const calculated: Record<string, string> = {
  'rank-focus': 'Rank and focus',
  officers: 'Officers',
  'overseer-support': 'Overseer',
  strategist: 'Strategist',
  helpful: 'Settlement support',
};

/**
 * One Event check's row facts from the engine's projected check. The check
 * id is the engine's (`<event>:<target>:mitigation`, `<event>:sickness`, …);
 * a missing projection (an inactive event) reads as awaiting its roll.
 * `label` names the target; the modifier names come from `modifierLabel`.
 */
export function eventCheckFacts({
  checkId,
  check,
  dc,
  target,
  mandatory,
  projected,
  requirements,
  recorded,
  overseerRecorded = false,
  modifierLabel,
  result,
  spec = RULE_ROLL_SPECS.check,
}: {
  checkId: string;
  check: OrganizationCheck;
  dc: number;
  // "Wren Ashby"; null for a check of the whole event.
  target: string | null;
  mandatory: boolean;
  projected: ProjectedCheck | undefined;
  requirements: readonly string[];
  recorded: RawRoll | undefined;
  overseerRecorded?: boolean;
  modifierLabel: (source: string, recorded: RawRoll | undefined) => string;
  // What success and failure mean for this event.
  result: { success: string; failure: string };
  spec?: RollSpec;
}): EventCheckFacts {
  const name = checkNames[check];
  const total = projected?.total ?? null;
  const succeeded = total === null ? null : total >= dc;
  return {
    checkId,
    label: target ? `${name} check for ${target}` : `${name} check`,
    legend: `${name} DC ${dc} · ${spec.count}d${spec.sides}`,
    spec,
    dc,
    mandatory,
    modifier: projected?.modifier ?? null,
    total,
    breakdown: (projected?.modifiers ?? []).map((modifier) => ({
      source: modifier.source,
      label:
        calculated[modifier.source] ?? modifierLabel(modifier.source, recorded),
      value: modifier.value,
    })),
    succeeded,
    resultText:
      succeeded === null ? null : succeeded ? result.success : result.failure,
    required: requirements.some((code) => code.startsWith(`${checkId}:`)),
    overseerRecorded,
  };
}

/**
 * The engine reports a missing check die twice: as its dice (`…:1d20`) and
 * as the check's absent roll (`…:roll`). Both ask for the same entry, so the
 * list a player reads keeps only the dice code.
 */
export function withoutDuplicateRollCodes(codes: readonly string[]) {
  const dice = new Set(
    codes.flatMap((code) => {
      const match = /^(.*):\d+d\d+$/.exec(code);
      return match ? [match[1]!] : [];
    }),
  );
  return codes.filter((code) => {
    const match = /^(.*):roll$/.exec(code);
    return !match || !dice.has(match[1]!);
  });
}
