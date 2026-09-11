import {
  projectActivity,
  activityCheckEffects,
  type ActivityProjection,
} from './rules-activity';
import {
  projectRulesFoundations,
  type FoundationInput,
} from './rules-foundations';
import type { WeeklyDraft } from './weekly-draft-contract';
import type { UpkeepSnapshot } from './rules-upkeep';
import {
  projectEventSelection,
  type EventSelectionProjection,
} from './rules-event-selection';

type Event = WeeklyDraft['event']['occurrences'][number];
export type EventShapingProjection = EventSelectionProjection & {
  negatedEventIds: string[];
  outcome: UpkeepSnapshot;
  checks: ActivityProjection['checks'];
  checkUsage: ActivityProjection['checkUsage'];
  teamUse: ActivityProjection['teamUse'];
  sabotage: {
    choiceId: string;
    eventId: string;
    checkId: string;
    dc: number;
    total: number | null;
    succeeded: boolean | null;
    notoriety: number | null;
    acknowledgement: WeeklyDraft['acknowledgements'][number] | null;
  }[];
};
// This consumes Activity's explicit guarantees and use records. It selects
// occurrences and resolves reactive Sabotage; event effects are a later fold.
export function projectEventShaping(
  draft: WeeklyDraft,
  activity: Pick<
    ActivityProjection,
    'requirements' | 'warnings' | 'plan' | 'outcome' | 'teamUse' | 'checkUsage'
  >,
  selection?: EventSelectionProjection,
  deferReactions = false,
): EventShapingProjection {
  const result: EventShapingProjection = {
    ...(selection ?? projectEventSelection(draft, activity)),
    negatedEventIds: [],
    outcome: structuredClone(activity.outcome),
    checks: [],
    checkUsage: structuredClone(activity.checkUsage),
    teamUse: structuredClone(activity.teamUse),
    sabotage: [],
  };
  if (deferReactions) return result;
  const foundationInput = (): FoundationInput => ({
    ...result.outcome,
    week: draft.week,
    slots: draft.activity.slots,
    checks: [],
    operatingSettlementId: draft.activity.operatingSettlementId ?? null,
    queuedEffects: activityCheckEffects(draft),
    activity: result.teamUse,
    checkUsage: result.checkUsage,
  });
  function die(raw: Event['tableRoll'], id: string, sides: number) {
    if (raw?.sides !== sides || raw.dice.length !== 1) {
      result.requirements.push(`${id}:1d${sides}`);
      return null;
    }
    const value = raw.dice[0]!;
    if (value < 1 || value > sides) result.warnings.push(`${id}:roll-range`);
    return value;
  }
  function exception(subjectId: string, ruleId: string) {
    result.warnings.push(`${subjectId}:${ruleId}`);
    const accepted = draft.rulesExceptions.some(
      (entry) =>
        entry.subjectId === subjectId &&
        entry.ruleId === ruleId &&
        entry.reason.trim(),
    );
    if (!accepted) result.requirements.push(`${subjectId}:${ruleId}:exception`);
    return accepted;
  }
  for (const event of result.selected) {
    const choice = event.sabotage;
    if (!choice) continue;
    if (
      event.eventType === 'all_is_calm' ||
      event.eventType === 'calm_before_the_storm'
    ) {
      result.requirements.push(`${choice.choiceId}:no-event`);
      continue;
    }
    const team = result.outcome.roster.teams.find(
      (entry) => entry.teamId === choice.teamId,
    );
    if (!team) {
      result.requirements.push(`${choice.choiceId}:team`);
      continue;
    }
    let eligible = true;
    if (
      draft.context.queuedEffects.some(
        (effect) =>
          effect.startsWeek <= draft.week &&
          draft.week <= effect.endsWeek &&
          effect.effect.kind === 'team_unavailable' &&
          effect.effect.phase !== 'activity' &&
          effect.effect.teamId === team.teamId,
      )
    )
      eligible = exception(choice.choiceId, 'team-unavailable') && eligible;
    if (team.teamType !== 'saboteurs')
      eligible = exception(choice.choiceId, 'team-action') && eligible;
    if (team.status !== 'active')
      eligible = exception(choice.choiceId, 'team-condition') && eligible;
    if (
      result.teamUse.usedTeamIds.includes(team.teamId) ||
      result.teamUse.upgradedTeamIds.includes(team.teamId)
    )
      eligible = exception(choice.choiceId, 'team-action-limit') && eligible;
    if (!eligible) continue;
    result.teamUse.usedTeamIds.push(team.teamId);
    if (!choice.check)
      result.requirements.push(`${choice.choiceId}:check-type`);
    const raw = die(choice.rolls?.check, `${choice.choiceId}:check`, 20);
    const notoriety = die(
      choice.rolls?.notoriety,
      `${choice.choiceId}:notoriety`,
      6,
    );
    const checkId = `${event.eventId}:sabotage:${choice.choiceId}`;
    const facts = choice.check
      ? projectRulesFoundations({
          ...foundationInput(),
          checks: [
            {
              checkId,
              phase: 'event',
              check: choice.check,
              teamId: team.teamId,
              die: raw ?? undefined,
              overseerCharacterId: choice.overseerCharacterId,
              bonusIds: choice.rolls?.check?.modifiers.flatMap((modifier) =>
                modifier.sourceId.startsWith('bonus:')
                  ? [modifier.sourceId.slice(6)]
                  : [],
              ),
            },
          ],
        })
      : null;
    if (facts) {
      result.requirements.push(
        ...facts.requirements.filter(
          (key) =>
            key.startsWith(checkId) ||
            key.startsWith('officer:') ||
            key.startsWith('manager:') ||
            key === 'rank' ||
            key === 'focus',
        ),
      );
      result.warnings.push(...facts.warnings);
      const projected = facts.checks[0]!;
      const known = new Set([
        ...projected.modifiers.map((modifier) => modifier.source),
        ...result.outcome.characters.map((character) => character.characterId),
        ...draft.context.carriedEvents.map((event) => event.eventId),
        ...draft.context.queuedEffects.flatMap((effect) => [
          effect.effectId,
          effect.sourceId,
        ]),
        'rank-focus',
        'officers',
        'overseer-support',
        'helpful',
        'strategist',
        'gather-tier',
        'knowledge-rank',
      ]);
      for (const modifier of choice.rolls?.check?.modifiers ?? []) {
        if (
          known.has(modifier.sourceId) ||
          /^(bonus|queued|officer|manager|covert):/.test(modifier.sourceId)
        )
          continue;
        known.add(modifier.sourceId);
        projected.modifiers.push({
          source: modifier.sourceId,
          value: modifier.value,
        });
        projected.modifier += modifier.value;
        if (projected.total !== null) projected.total += modifier.value;
      }
      result.checks.push(projected);
      result.checkUsage = facts.checkUsage;
    }
    const total = facts?.checks[0]?.total ?? null;
    const dc = 15 + result.outcome.rank;
    const succeeded = total === null ? null : total >= dc;
    const acknowledgement =
      [...draft.acknowledgements, ...(choice.acknowledgements ?? [])].find(
        (entry) =>
          entry.subjectId === `sabotage:${event.eventId}:${choice.choiceId}` &&
          entry.outcome.trim(),
      ) ?? null;
    if (!acknowledgement)
      result.requirements.push(`${choice.choiceId}:acknowledgement`);
    if (notoriety !== null) result.outcome.notoriety += notoriety;
    if (succeeded) result.negatedEventIds.push(event.eventId);
    result.sabotage.push({
      choiceId: choice.choiceId,
      eventId: event.eventId,
      checkId,
      dc,
      total,
      succeeded,
      notoriety,
      acknowledgement,
    });
  }
  for (const bonusId of result.checkUsage.bonusIds) {
    const bonus = result.outcome.bonuses.find(
      (entry) => entry.bonusId === bonusId,
    );
    if (bonus) bonus.consumedWeek = draft.week;
  }
  result.requirements = [...new Set(result.requirements)];
  result.warnings = [...new Set(result.warnings)];
  result.ready = !result.requirements.length;
  return result;
}
export function projectActivityAndEventShaping(
  draft: WeeklyDraft,
  snapshot: UpkeepSnapshot,
) {
  const activity = projectActivity(draft, snapshot);
  return { activity, event: projectEventShaping(draft, activity) };
}
