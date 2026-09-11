import type { WeeklyDraft } from './weekly-draft-contract';
import {
  projectRulesFoundations,
  type FoundationInput,
} from './rules-foundations';
import type { rawRollSchema } from './weekly-draft-facts';
import type { z } from 'zod';
import { getMinimumTreasuryForRank } from './militia-progression-rules';
import { projectProgression } from './rules-progression';
import { REPUTATION_LEVELS } from './militia-domain';

export type UpkeepSnapshot = Pick<
  FoundationInput,
  | 'rank'
  | 'training'
  | 'focus'
  | 'roster'
  | 'characters'
  | 'settlements'
  | 'bonuses'
  | 'apVolume'
> & { treasuryCopper: number; notoriety: number };
type RawRoll = z.infer<typeof rawRollSchema>;
type TrainingStep = 'attrition' | 'notoriety' | 'shortage';
export type UpkeepChange =
  | {
      kind: 'boon';
      subjectId: string;
      characterId: string;
      reward: ReturnType<typeof projectProgression>['boons'][number];
      acknowledgement: WeeklyDraft['acknowledgements'][number] | null;
    }
  | { kind: 'consume_bonus'; bonusId: string; week: number }
  | { kind: 'remove_team'; teamId: string }
  | { kind: 'rank'; before: number; after: number }
  | {
      kind: 'treasury';
      sourceId: string;
      characterId: string | null;
      before: number;
      after: number;
    }
  | {
      kind: 'team_status';
      teamId: string;
      status: 'active';
      timing: 'start' | 'end';
    }
  | {
      kind: 'settlement_reputation';
      settlementId: string;
      before: string;
      after: string;
    }
  | { kind: 'training'; step: TrainingStep; before: number; after: number };
type UpkeepProjection = {
  skipped: boolean;
  ready: boolean;
  outcome: UpkeepSnapshot;
  plan: UpkeepChange[];
  boons: ReturnType<typeof projectProgression>['boons'];
  requirements: string[];
  warnings: string[];
  checkUsage: ReturnType<typeof projectRulesFoundations>['checkUsage'];
  checks: ReturnType<typeof projectRulesFoundations>['checks'];
};
function foundationInput(
  draft: WeeklyDraft,
  state: UpkeepSnapshot,
): FoundationInput {
  return {
    ...state,
    week: draft.week,
    slots: draft.activity.slots,
    operatingSettlementId: draft.activity.operatingSettlementId ?? null,
    queuedEffects: upkeepCheckEffects(draft),
    checks: [],
  };
}
function upkeepCheckEffects(
  draft: WeeklyDraft,
): FoundationInput['queuedEffects'] {
  const morale = draft.context.carriedEvents.filter(
    (event) => event.eventType === 'low_morale',
  );
  const sources = new Set(morale.map((event) => event.eventId));
  const queued = draft.context.queuedEffects.filter(
    (effect) =>
      !(
        sources.has(effect.sourceId) &&
        effect.effect.kind === 'check_modifier' &&
        effect.effect.check === 'loyalty'
      ),
  );
  const persistent = morale[0];
  if (persistent)
    queued.push({
      effectId: `persistent:${persistent.eventId}`,
      sourceId: persistent.eventId,
      startsWeek: draft.week,
      endsWeek: draft.week,
      effect: { kind: 'check_modifier', check: 'loyalty', value: -2 },
    });
  return queued;
}
function dice(
  raw: RawRoll | undefined,
  count: number,
  sides: number,
  id: string,
  result: UpkeepProjection,
) {
  if (!raw) {
    result.requirements.push(`${id}:roll`);
    return null;
  }
  if (raw.sides !== sides || raw.dice.length !== count) {
    result.requirements.push(`${id}:dice:${count}d${sides}`);
    return null;
  }
  if (raw.dice.some((value) => value < 1 || value > sides))
    result.warnings.push(`${id}:roll-range`);
  return raw.dice.reduce((sum, value) => sum + value, 0);
}
function check(
  draft: WeeklyDraft,
  state: UpkeepSnapshot,
  raw: RawRoll | undefined,
  id: string,
  result: UpkeepProjection,
  organizationCheck: 'loyalty' | 'security' = 'loyalty',
  teamId?: string,
) {
  const die = dice(raw, 1, 20, id, result);
  if (die === null) return null;
  const bonusIds =
    raw?.modifiers.flatMap((modifier) =>
      modifier.sourceId.startsWith('bonus:')
        ? [modifier.sourceId.slice(6)]
        : [],
    ) ?? [];
  const facts = projectRulesFoundations({
    ...foundationInput(draft, state),
    checkUsage: result.checkUsage,
    checks: [
      {
        checkId: id,
        phase: 'upkeep',
        check: organizationCheck,
        die,
        teamId,
        bonusIds,
      },
    ],
  });
  result.checkUsage = facts.checkUsage;
  const projected = facts.checks[0]!;
  applyEnteredModifiers(draft, state, raw, projected);
  result.checks.push(projected);
  const managerId = state.roster.teams.find(
    (team) => team.teamId === teamId,
  )?.managerCharacterId;
  const diagnostics = checkDiagnostics(facts, id, managerId);
  result.requirements.push(...diagnostics.requirements);
  result.warnings.push(...diagnostics.warnings);
  return projected.total;
}
function applyEnteredModifiers(
  draft: WeeklyDraft,
  state: UpkeepSnapshot,
  raw: RawRoll | undefined,
  projected: UpkeepProjection['checks'][number],
) {
  // A modifier with a calculated source is provenance, not a second addition.
  // One-use selections use bonus:<identity>; foundation checks enforce their use.
  const sources = new Set([
    ...projected.modifiers.map((modifier) => modifier.source),
    ...state.roster.officers.map((officer) => officer.characterId),
    ...draft.context.carriedEvents.map((event) => event.eventId),
    ...state.roster.teams.flatMap((team) =>
      team.managerCharacterId ? [team.managerCharacterId] : [],
    ),
    ...draft.context.queuedEffects.flatMap((effect) => [
      effect.effectId,
      effect.sourceId,
    ]),
  ]);
  for (const modifier of raw?.modifiers ?? []) {
    if (
      sources.has(modifier.sourceId) ||
      /^(bonus|queued|officer|manager):/.test(modifier.sourceId)
    )
      continue;
    sources.add(modifier.sourceId);
    projected.modifiers.push({
      source: modifier.sourceId,
      value: modifier.value,
    });
    projected.modifier += modifier.value;
    if (projected.total !== null) projected.total += modifier.value;
  }
}
function checkDiagnostics(
  facts: ReturnType<typeof projectRulesFoundations>,
  id: string,
  managerId: string | null | undefined,
) {
  const requirements = facts.requirements.filter(
    (key) =>
      key === 'focus' ||
      key === 'rank' ||
      key.startsWith('officer:') ||
      key.startsWith(`${id}:`) ||
      key === `manager:${managerId}:character`,
  );
  const warnings = facts.warnings.filter(
    (key) =>
      key.startsWith(`${id}:`) ||
      key.startsWith('officer:') ||
      key === `manager:${managerId}:archived`,
  );
  return { requirements, warnings };
}
function training(result: UpkeepProjection, step: TrainingStep, delta: number) {
  const before = result.outcome.training;
  result.outcome.training = Math.max(0, before + delta);
  result.plan.push({
    kind: 'training',
    step,
    before,
    after: result.outcome.training,
  });
}
function attrition(
  draft: WeeklyDraft,
  state: UpkeepSnapshot,
  result: UpkeepProjection,
) {
  const total = check(
    draft,
    state,
    draft.upkeep.rolls.check,
    'upkeep:attrition',
    result,
  );
  if (total === null) return;
  const naturalTwenty = draft.upkeep.rolls.check?.dice[0] === 20;
  const success = naturalTwenty || total >= 10;
  const loss = dice(
    draft.upkeep.rolls.training,
    success ? 1 : 2,
    success ? 6 : 4,
    'upkeep:attrition-training',
    result,
  );
  if (loss !== null)
    training(
      result,
      'attrition',
      naturalTwenty
        ? loss
        : -(loss + (success ? 0 : state.rank)) * lossMultiplier(draft),
    );
}
function notoriety(
  draft: WeeklyDraft,
  state: UpkeepSnapshot,
  result: UpkeepProjection,
) {
  if (state.notoriety < 100) return;
  const loss = dice(
    draft.upkeep.rolls.notoriety,
    1,
    20,
    'upkeep:notoriety-training',
    result,
  );
  if (loss !== null)
    training(result, 'notoriety', -(loss + state.rank) * lossMultiplier(draft));
  const total = check(
    draft,
    state,
    draft.upkeep.notorietyCheck,
    'upkeep:notoriety',
    result,
  );
  if (total !== null && total < 15) lowerReputation(draft, result);
}
function lowerReputation(draft: WeeklyDraft, result: UpkeepProjection) {
  const settlement = result.outcome.settlements.find(
    (entry) => entry.settlementId === draft.upkeep.nearestSettlementId,
  );
  if (!settlement) {
    result.requirements.push('upkeep:notoriety:nearest-settlement');
    return;
  }
  if (settlement.reputation === null) {
    result.requirements.push('upkeep:notoriety:settlement-reputation');
    return;
  }
  const before = settlement.reputation;
  const index = REPUTATION_LEVELS.indexOf(before);
  const after = index > 1 ? REPUTATION_LEVELS[index - 1]! : before;
  settlement.reputation = after;
  result.plan.push({
    kind: 'settlement_reputation',
    settlementId: settlement.settlementId,
    before,
    after,
  });
}
function treasury(
  result: UpkeepProjection,
  sourceId: string,
  delta: number,
  characterId: string | null = null,
) {
  const before = result.outcome.treasuryCopper;
  result.outcome.treasuryCopper += delta;
  result.plan.push({
    kind: 'treasury',
    sourceId,
    characterId,
    before,
    after: result.outcome.treasuryCopper,
  });
}
function removeTeam(result: UpkeepProjection, teamId: string) {
  result.outcome.roster.teams = result.outcome.roster.teams.filter(
    (team) => team.teamId !== teamId,
  );
  result.plan.push({ kind: 'remove_team', teamId });
}
function recoverTeams(
  draft: WeeklyDraft,
  state: UpkeepSnapshot,
  result: UpkeepProjection,
) {
  for (const decision of draft.upkeep.teamDecisions) {
    if (!state.roster.teams.some((team) => team.teamId === decision.teamId))
      result.requirements.push(`team:${decision.teamId}:reference`);
  }
  for (const team of result.outcome.roster.teams) {
    const decision = draft.upkeep.teamDecisions.find(
      (decision) => decision.teamId === team.teamId,
    );
    if (decision?.decision === 'remove') {
      removeWithException(draft, team.teamId, result);
      continue;
    }
    if (team.status === 'missing') {
      missingTeam(draft, state, team.teamId, result);
      continue;
    }
    if (team.status !== 'disabled') continue;
    recoverDisabled(draft, team, decision, result);
  }
}
function removeWithException(
  draft: WeeklyDraft,
  teamId: string,
  result: UpkeepProjection,
) {
  result.warnings.push(`team:${teamId}:upkeep-removal`);
  if (
    draft.rulesExceptions.some(
      (exception) =>
        exception.subjectId === teamId &&
        exception.ruleId === 'upkeep-team-removal',
    )
  )
    removeTeam(result, teamId);
  else result.requirements.push(`team:${teamId}:removal-exception`);
}
function recoverDisabled(
  draft: WeeklyDraft,
  team: UpkeepSnapshot['roster']['teams'][number],
  decision: WeeklyDraft['upkeep']['teamDecisions'][number] | undefined,
  result: UpkeepProjection,
) {
  if (!decision) {
    result.requirements.push(`team:${team.teamId}:recovery-decision`);
    return;
  }
  if (decision.decision !== 'recover') return;
  const cost = getMinimumTreasuryForRank(result.outcome.rank) * 100;
  if (decision.costCopper !== undefined && decision.costCopper !== cost)
    result.warnings.push(`team:${team.teamId}:recovery-cost-baseline`);
  if (result.outcome.treasuryCopper < cost) {
    result.warnings.push(`team:${team.teamId}:recovery-funds`);
    if (
      !draft.rulesExceptions.some(
        (exception) =>
          exception.subjectId === team.teamId &&
          exception.ruleId === 'upkeep-recovery-funds',
      )
    )
      result.requirements.push(`team:${team.teamId}:recovery-funds-exception`);
  }
  treasury(result, `recovery:${team.teamId}`, -cost);
  team.status = 'active';
  result.plan.push({
    kind: 'team_status',
    teamId: team.teamId,
    status: 'active',
    timing: 'start',
  });
}
function missingTeam(
  draft: WeeklyDraft,
  state: UpkeepSnapshot,
  teamId: string,
  result: UpkeepProjection,
) {
  const decision = draft.upkeep.teamDecisions.find(
    (decision) => decision.teamId === teamId,
  );
  const total = check(
    draft,
    state,
    decision?.roll,
    `team:${teamId}:return`,
    result,
    'security',
    teamId,
  );
  if (total === null) return;
  if (decision?.roll?.dice[0] === 1) {
    removeTeam(result, teamId);
  } else if (total >= 15) {
    result.plan.push({
      kind: 'team_status',
      teamId,
      status: 'active',
      timing: 'end',
    });
  }
}
function shortage(
  draft: WeeklyDraft,
  state: UpkeepSnapshot,
  result: UpkeepProjection,
) {
  if (
    result.outcome.treasuryCopper >=
    getMinimumTreasuryForRank(state.rank) * 100
  )
    return;
  const loss = dice(draft.upkeep.rolls.loss, 2, 4, 'upkeep:shortage', result);
  if (loss !== null)
    training(result, 'shortage', -(loss + state.rank) * lossMultiplier(draft));
}
function progression(draft: WeeklyDraft, result: UpkeepProjection) {
  if (result.requirements.length > 0) return;
  const state = result.outcome;
  const progression = projectProgression(
    state.rank,
    state.training,
    state.roster,
    state.characters,
    state.apVolume,
  );
  result.requirements.push(...progression.requirements);
  result.warnings.push(...progression.warnings);
  result.boons = progression.boons;
  if (progression.eligibleRank !== state.rank) {
    result.plan.push({
      kind: 'rank',
      before: state.rank,
      after: progression.eligibleRank,
    });
    state.rank = progression.eligibleRank;
  }
  for (const reward of result.boons) {
    for (const characterId of reward.characterIds) {
      const subjectId = `upkeep:boon:${reward.rank}:${characterId}`;
      const acknowledgement =
        draft.acknowledgements.find((ack) => ack.subjectId === subjectId) ??
        null;
      if (!acknowledgement)
        result.requirements.push(`${subjectId}:acknowledgement`);
      result.plan.push({
        kind: 'boon',
        subjectId,
        characterId,
        reward,
        acknowledgement,
      });
    }
  }
}
function transfers(draft: WeeklyDraft, result: UpkeepProjection) {
  for (const transfer of draft.upkeep.treasuryTransfers) {
    if (
      !result.outcome.roster.people.some(
        (person) => person.characterId === transfer.characterId,
      )
    ) {
      result.requirements.push(`transfer:${transfer.transferId}:character`);
      continue;
    }
    if (
      !result.outcome.roster.officers.some(
        (officer) => officer.characterId === transfer.characterId,
      )
    )
      result.warnings.push(`transfer:${transfer.transferId}:officer`);
    treasury(
      result,
      transfer.transferId,
      transfer.direction === 'deposit' ? transfer.copper : -transfer.copper,
      transfer.characterId,
    );
    const theft = draft.context.carriedEvents.find(
      (event) => event.eventType === 'theft',
    );
    if (theft && transfer.direction === 'deposit') {
      const retained = Math.round(transfer.copper / 2);
      treasury(
        result,
        `theft:${theft.eventId}:${transfer.transferId}`,
        retained - transfer.copper,
      );
    }
  }
}
function lossMultiplier(draft: WeeklyDraft) {
  // Week of Pain's Twice clause never compounds the same loss multiplier.
  return Math.max(
    1,
    ...draft.context.queuedEffects.flatMap((queued) =>
      queued.startsWeek <= draft.week &&
      queued.endsWeek >= draft.week &&
      queued.effect.kind === 'upkeep_loss_multiplier'
        ? [queued.effect.value]
        : [],
    ),
  );
}
// Always project from the same week-start snapshot. Previewing never writes it.
export function projectUpkeep(
  draft: WeeklyDraft,
  snapshot: UpkeepSnapshot,
): UpkeepProjection {
  const result: UpkeepProjection = {
    skipped: draft.context.firstMilitiaWeek,
    ready: true,
    outcome: {
      ...snapshot,
      roster: {
        people: snapshot.roster.people.map((person) => ({ ...person })),
        officers: snapshot.roster.officers.map((officer) => ({ ...officer })),
        teams: snapshot.roster.teams.map((team) => ({ ...team })),
      },
      characters: snapshot.characters.map((character) => ({ ...character })),
      settlements: snapshot.settlements.map((settlement) => ({
        ...settlement,
      })),
      bonuses: snapshot.bonuses.map((bonus) => ({ ...bonus })),
    },
    plan: [],
    boons: [],
    requirements: [],
    warnings: [],
    checks: [],
    checkUsage: { bonusIds: [], helpful: false, overseer: false },
  };
  if (!result.skipped) {
    recoverTeams(draft, snapshot, result);
    attrition(draft, snapshot, result);
    notoriety(draft, snapshot, result);
    shortage(draft, snapshot, result);
    progression(draft, result);
    transfers(draft, result);
  }
  for (const bonusId of result.checkUsage.bonusIds) {
    const bonus = result.outcome.bonuses.find(
      (bonus) => bonus.bonusId === bonusId,
    )!;
    bonus.consumedWeek = draft.week;
    result.plan.push({ kind: 'consume_bonus', bonusId, week: draft.week });
  }
  result.requirements = [...new Set(result.requirements)];
  result.warnings = [...new Set(result.warnings)];
  result.ready = result.requirements.length === 0;
  return result;
}
