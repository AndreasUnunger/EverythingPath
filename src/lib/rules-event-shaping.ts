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
type ShapingContext = { draft: WeeklyDraft; result: EventShapingProjection };
type Sabotage = NonNullable<Event['sabotage']>;
type Team = UpkeepSnapshot['roster']['teams'][number];
function createFoundationInput({
  draft,
  result,
}: ShapingContext): FoundationInput {
  return {
    ...result.outcome,
    week: draft.week,
    slots: draft.activity.slots,
    checks: [],
    operatingSettlementId: draft.activity.operatingSettlementId ?? null,
    queuedEffects: activityCheckEffects(draft),
    activity: result.teamUse,
    checkUsage: result.checkUsage,
  };
}
function readSabotageDie(
  { result }: ShapingContext,
  raw: Event['tableRoll'],
  id: string,
  sides: number,
) {
  if (raw?.sides !== sides || raw.dice.length !== 1) {
    result.requirements.push(`${id}:1d${sides}`);
    return null;
  }
  const value = raw.dice[0]!;
  if (value < 1 || value > sides) result.warnings.push(`${id}:roll-range`);
  return value;
}
function requireSabotageException(
  { draft, result }: ShapingContext,
  subjectId: string,
  ruleId: string,
) {
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
function validateSabotageTeam(
  context: ShapingContext,
  choice: Sabotage,
  team: Team,
) {
  const { draft, result } = context;
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
    eligible =
      requireSabotageException(context, choice.choiceId, 'team-unavailable') &&
      eligible;
  if (team.teamType !== 'saboteurs')
    eligible =
      requireSabotageException(context, choice.choiceId, 'team-action') &&
      eligible;
  if (team.status !== 'active')
    eligible =
      requireSabotageException(context, choice.choiceId, 'team-condition') &&
      eligible;
  if (
    result.teamUse.usedTeamIds.includes(team.teamId) ||
    result.teamUse.upgradedTeamIds.includes(team.teamId)
  )
    eligible =
      requireSabotageException(context, choice.choiceId, 'team-action-limit') &&
      eligible;
  return eligible;
}
function projectSabotageCheck(
  context: ShapingContext,
  choice: Sabotage,
  team: Team,
  checkId: string,
  raw: number | null,
) {
  return choice.check
    ? projectRulesFoundations({
        ...createFoundationInput(context),
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
}
function applySabotageModifiers(
  { draft, result }: ShapingContext,
  choice: Sabotage,
  projected: ActivityProjection['checks'][number],
) {
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
}
function recordSabotageCheck(
  context: ShapingContext,
  choice: Sabotage,
  checkId: string,
  facts: ReturnType<typeof projectRulesFoundations>,
) {
  const { result } = context;
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
  applySabotageModifiers(context, choice, projected);
  result.checks.push(projected);
  result.checkUsage = facts.checkUsage;
}
function recordSabotageOutcome(
  { draft, result }: ShapingContext,
  event: Event,
  choice: Sabotage,
  checkId: string,
  total: number | null,
  notoriety: number | null,
) {
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
function resolveSabotage(context: ShapingContext, event: Event) {
  const { result } = context;
  const choice = event.sabotage;
  if (!choice) return;
  if (
    event.eventType === 'all_is_calm' ||
    event.eventType === 'calm_before_the_storm'
  ) {
    result.requirements.push(`${choice.choiceId}:no-event`);
    return;
  }
  const team = result.outcome.roster.teams.find(
    (entry) => entry.teamId === choice.teamId,
  );
  if (!team) {
    result.requirements.push(`${choice.choiceId}:team`);
    return;
  }
  const eligible = validateSabotageTeam(context, choice, team);
  if (!eligible) return;
  result.teamUse.usedTeamIds.push(team.teamId);
  if (!choice.check) result.requirements.push(`${choice.choiceId}:check-type`);
  const raw = readSabotageDie(
    context,
    choice.rolls?.check,
    `${choice.choiceId}:check`,
    20,
  );
  const notoriety = readSabotageDie(
    context,
    choice.rolls?.notoriety,
    `${choice.choiceId}:notoriety`,
    6,
  );
  const checkId = `${event.eventId}:sabotage:${choice.choiceId}`;
  const facts = projectSabotageCheck(context, choice, team, checkId, raw);
  if (facts) recordSabotageCheck(context, choice, checkId, facts);
  recordSabotageOutcome(
    context,
    event,
    choice,
    checkId,
    facts?.checks[0]?.total ?? null,
    notoriety,
  );
}
function consumeSabotageBonuses({ draft, result }: ShapingContext) {
  for (const bonusId of result.checkUsage.bonusIds) {
    const bonus = result.outcome.bonuses.find(
      (entry) => entry.bonusId === bonusId,
    );
    if (bonus) bonus.consumedWeek = draft.week;
  }
}

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
  const context = { draft, result };
  for (const event of result.selected) resolveSabotage(context, event);
  consumeSabotageBonuses(context);
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
