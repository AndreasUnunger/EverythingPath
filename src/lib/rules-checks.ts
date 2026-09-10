import type { FoundationInput, FoundationCheck } from './rules-foundations';
import { officerAbility, type projectOfficers } from './rules-officers';
import type { projectTeams } from './rules-teams';
import type { projectSettlements } from './rules-settlements';
import type {
  getOrganizationCheckBonusesForMilitia,
  getAdvancementForRank,
} from './militia-progression-rules';

type CheckFacts = {
  officers: ReturnType<typeof projectOfficers>;
  teams: ReturnType<typeof projectTeams>['teams'];
  operating:
    | ReturnType<typeof projectSettlements>['settlements'][number]
    | undefined;
  base: ReturnType<typeof getOrganizationCheckBonusesForMilitia>;
  row: ReturnType<typeof getAdvancementForRank>;
};
type Modifier = { source: string; value: number };
export type CheckUsage = {
  overseer: boolean;
  helpful: boolean;
  bonusIds: string[];
};
type Composition = {
  modifiers: Modifier[];
  requirements: string[];
  usage: CheckUsage;
};

function activityModifiers(
  input: FoundationInput,
  check: FoundationCheck,
  facts: CheckFacts,
  result: Composition,
) {
  if (check.phase !== 'activity') return;
  const slotIndex = input.slots.findIndex(
    (x) => x.choice?.choiceId === check.choiceId,
  );
  const choice = input.slots[slotIndex]?.choice;
  if (!choice) {
    result.requirements.push(`${check.checkId}:choice`);
    return;
  }
  if (facts.officers.strategistAssigned && slotIndex === facts.row?.actions)
    result.modifiers.push({ source: 'strategist', value: 2 });
  managerModifier(choice.teamId, check, facts, result);
}
function managerModifier(
  teamId: string | undefined,
  check: FoundationCheck,
  facts: CheckFacts,
  result: Composition,
) {
  const team = facts.teams.find((x) => x.teamId === teamId);
  if (teamId && !team) result.requirements.push(`${check.checkId}:team`);
  if (team?.manager)
    result.modifiers.push({
      source: `manager:${team.manager.characterId}`,
      value: team.manager.bonus,
    });
}
function overseerModifier(
  check: FoundationCheck,
  facts: CheckFacts,
  result: Composition,
) {
  if (!check.overseerCharacterId) return;
  const overseer = facts.officers.overseers.find(
    (x) => x.characterId === check.overseerCharacterId,
  );
  if (!overseer || (check.phase !== 'event' && check.phase !== 'persistent'))
    result.requirements.push(`${check.checkId}:overseer-ineligible`);
  else if (result.usage.overseer)
    result.requirements.push(`${check.checkId}:overseer-already-used`);
  else {
    result.modifiers.push({
      source: 'overseer-support',
      value: officerAbility(overseer, check.check),
    });
    result.usage.overseer = true;
  }
}
function helpfulModifier(
  check: FoundationCheck,
  facts: CheckFacts,
  result: Composition,
) {
  if (!check.helpful) return;
  if (check.phase !== 'activity' || facts.operating?.reputation !== 'Helpful')
    result.requirements.push(`${check.checkId}:helpful-ineligible`);
  else if (result.usage.helpful)
    result.requirements.push(`${check.checkId}:helpful-already-used`);
  else {
    result.modifiers.push({ source: 'helpful', value: 2 });
    result.usage.helpful = true;
  }
}
function carriedModifiers(
  input: FoundationInput,
  check: FoundationCheck,
  result: Composition,
) {
  for (const bonusId of new Set(check.bonusIds)) {
    const bonus = input.bonuses.find((x) => x.bonusId === bonusId);
    if (
      bonus?.check !== check.check ||
      bonus.availableWeek !== input.week ||
      bonus.consumedWeek !== null ||
      result.usage.bonusIds.includes(bonusId)
    )
      result.requirements.push(`${check.checkId}:bonus:${bonusId}:unavailable`);
    else {
      result.modifiers.push({ source: `bonus:${bonusId}`, value: bonus.value });
      result.usage.bonusIds.push(bonusId);
    }
  }
}
function queuedModifiers(input: FoundationInput, check: FoundationCheck) {
  const sources = new Set<string>();
  return input.queuedEffects.flatMap((queued) => {
    if (
      queued.startsWeek > input.week ||
      queued.endsWeek < input.week ||
      queued.effect.kind !== 'check_modifier' ||
      queued.effect.check !== check.check ||
      sources.has(queued.sourceId)
    )
      return [];
    sources.add(queued.sourceId);
    return [
      { source: `queued:${queued.sourceId}`, value: queued.effect.value },
    ];
  });
}
function checkTotal(
  check: FoundationCheck,
  modifier: number,
  requirements: string[],
  warnings: string[],
) {
  if (check.die === undefined) {
    requirements.push(`${check.checkId}:roll`);
    return null;
  }
  if (!Number.isSafeInteger(check.die)) {
    requirements.push(`${check.checkId}:invalid-roll`);
    return null;
  }
  if (check.die < 1 || check.die > 20)
    warnings.push(`${check.checkId}:roll-range`);
  return check.die + modifier;
}

// Ordered occurrences reserve one-use benefits, including while dice are missing.
// Usage can be carried across calls when an intervening action changes the roster.
export function projectChecks(input: FoundationInput, facts: CheckFacts) {
  const requirements: string[] = [];
  const warnings: string[] = [];
  const usage: CheckUsage = {
    overseer: input.checkUsage?.overseer ?? false,
    helpful: input.checkUsage?.helpful ?? false,
    bonusIds: [...(input.checkUsage?.bonusIds ?? [])],
  };
  const checks = input.checks.map((check) => {
    const result: Composition = {
      requirements: [],
      usage,
      modifiers: [
        { source: 'rank-focus', value: facts.base[check.check] },
        { source: 'officers', value: facts.officers.bonuses[check.check] },
      ],
    };
    activityModifiers(input, check, facts, result);
    if (check.phase !== 'activity')
      managerModifier(check.teamId, check, facts, result);
    if (result.requirements.length === 0) {
      overseerModifier(check, facts, result);
      helpfulModifier(check, facts, result);
      carriedModifiers(input, check, result);
    }
    result.modifiers.push(...queuedModifiers(input, check));
    const modifier = result.modifiers.reduce((sum, x) => sum + x.value, 0);
    const total = checkTotal(check, modifier, result.requirements, warnings);
    requirements.push(...result.requirements);
    return {
      checkId: check.checkId,
      modifiers: result.modifiers,
      modifier,
      total: result.requirements.includes(`${check.checkId}:choice`)
        ? null
        : total,
    };
  });
  return { checks, requirements, warnings, usage };
}
