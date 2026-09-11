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
import type { EventActionChange } from './rules-event-actions';
import type { UpkeepSnapshot } from './rules-upkeep';
import { eventTypeForPercentile } from './militia-event-table';

type Event = WeeklyDraft['event']['occurrences'][number];
type Guarantee = Extract<EventActionChange, { kind: 'event_guarantee' }>;
export type EventShapingProjection = {
  ready: boolean;
  requirements: string[];
  warnings: string[];
  guaranteed: boolean;
  guarantees: Guarantee[];
  selected: Event[];
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
  activity: ActivityProjection,
): EventShapingProjection {
  const result: EventShapingProjection = {
    ready: false,
    requirements: [...activity.requirements],
    warnings: [...activity.warnings],
    guaranteed: false,
    guarantees: activity.plan.filter(
      (effect): effect is Guarantee => effect.kind === 'event_guarantee',
    ),
    selected: [],
    negatedEventIds: [],
    outcome: structuredClone(activity.outcome),
    checks: [],
    checkUsage: structuredClone(activity.checkUsage),
    teamUse: structuredClone(activity.teamUse),
    sabotage: [],
  };
  result.guaranteed = result.guarantees.length > 0;
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
  const tableModifier =
    projectRulesFoundations(foundationInput()).eventTableModifier;
  if (tableModifier === null)
    result.requirements.push('event:operating-settlement');
  function die(raw: Event['tableRoll'], id: string, sides: number) {
    if (raw?.sides !== sides || raw.dice.length !== 1) {
      result.requirements.push(`${id}:1d${sides}`);
      return null;
    }
    const value = raw.dice[0]!;
    if (value < 1 || value > sides) result.warnings.push(`${id}:roll-range`);
    return value;
  }
  function rolled(event: Event) {
    const value = die(event.tableRoll, `${event.eventId}:table`, 100);
    if (value === null || tableModifier === null) return null;
    const extra = new Map<string, number>();
    for (const modifier of event.tableRoll?.modifiers ?? [])
      if (
        modifier.sourceId !== 'settlement' &&
        modifier.sourceId !== 'reputation'
      )
        extra.set(modifier.sourceId, modifier.value);
    const total = Math.max(
      1,
      Math.min(
        100,
        value +
          tableModifier +
          [...extra.values()].reduce((sum, value) => sum + value, 0),
      ),
    );
    const eventType = eventTypeForPercentile(total);
    if (event.eventType && event.eventType !== eventType)
      result.warnings.push(`${event.eventId}:calculated-event`);
    return { ...structuredClone(event), eventType };
  }
  let expanded = false;
  function select(event: Event, tree: Event[]) {
    const resolved = rolled(event);
    if (!resolved) return;
    if (resolved.eventType !== 'roll_twice') {
      result.selected.push(resolved);
      return;
    }
    const kind = expanded ? 'replacement' : 'roll_twice';
    const count = expanded ? 1 : 2;
    expanded = true;
    const children = tree.filter(
      (entry) =>
        entry.origin.kind === kind &&
        'parentEventId' in entry.origin &&
        entry.origin.parentEventId === event.eventId,
    );
    if (children.length !== count) {
      result.requirements.push(`${event.eventId}:${kind}:${count}`);
      return;
    }
    for (const child of children) select(child, tree);
  }
  const automaticSources = draft.context.queuedEffects.filter(
    (effect) =>
      effect.startsWeek <= draft.week &&
      draft.week <= effect.endsWeek &&
      effect.effect.kind === 'automatic_events',
  );
  const automaticRoots = draft.event.occurrences.filter(
    (event) => event.origin.kind === 'automatic',
  );
  for (const event of automaticRoots)
    if (
      !automaticSources.some(
        (effect) =>
          event.origin.kind === 'automatic' &&
          effect.sourceId === event.origin.sourceId,
      )
    )
      result.requirements.push(`${event.eventId}:automatic-event-source`);
  function selectAutomatic(event: Event) {
    const resolved = rolled(event);
    if (!resolved) return;
    if (resolved.eventType !== 'roll_twice') {
      result.selected.push(resolved);
      return;
    }
    const children = draft.event.occurrences.filter(
      (entry) =>
        entry.origin.kind === 'replacement' &&
        entry.origin.parentEventId === event.eventId,
    );
    if (children.length !== 1) {
      result.requirements.push(`${event.eventId}:replacement:1`);
      return;
    }
    selectAutomatic(children[0]!);
  }
  const automaticSeen = new Set<string>();
  for (const effect of automaticSources) {
    if (automaticSeen.has(effect.sourceId)) continue;
    automaticSeen.add(effect.sourceId);
    const roots = automaticRoots.filter(
      (event) =>
        event.origin.kind === 'automatic' &&
        event.origin.sourceId === effect.sourceId,
    );
    if (
      effect.effect.kind === 'automatic_events' &&
      roots.length !== effect.effect.count
    )
      result.requirements.push(
        `${effect.sourceId}:automatic-events:${effect.effect.count}`,
      );
    else for (const root of roots) selectAutomatic(root);
  }
  const forcedCalm = draft.context.queuedEffects.some(
    (effect) =>
      effect.startsWeek <= draft.week &&
      draft.week <= effect.endsWeek &&
      effect.effect.kind === 'all_is_calm',
  );
  if (!forcedCalm) {
    for (const guarantee of result.guarantees) {
      const roots = guarantee.candidates.filter(
        (event) => event.origin.kind === 'rolled',
      );
      if (roots.length !== 2)
        result.requirements.push(`${guarantee.choiceId}:candidates:2`);
      // Both independent percentile rolls are required even for the rejected option.
      for (const root of roots) rolled(root);
      const chosen = roots.find(
        (root) => root.eventId === guarantee.selectedEventId,
      );
      if (!chosen)
        result.requirements.push(`${guarantee.choiceId}:selected-event`);
      else if (roots.length === 2) select(chosen, guarantee.candidates);
    }
    if (!result.guaranteed) {
      const modifiers = draft.context.queuedEffects.filter(
        (effect) =>
          effect.startsWeek <= draft.week &&
          draft.week <= effect.endsWeek &&
          effect.effect.kind === 'event_chance',
      );
      const chance = Math.max(
        10,
        Math.min(
          95,
          result.outcome.notoriety +
            (draft.context.uneventfulCarry ? result.outcome.rank : 0) +
            modifiers.reduce(
              (sum, effect) =>
                sum +
                (effect.effect.kind === 'event_chance'
                  ? effect.effect.value
                  : 0),
              0,
            ),
        ),
      );
      const chanceRoll = die(draft.event.chanceRoll, 'event:chance', 100);
      if (chanceRoll !== null && chanceRoll <= chance) {
        const roots = draft.event.occurrences.filter(
          (event) => event.origin.kind === 'rolled',
        );
        if (roots.length !== 1) result.requirements.push('event:root:1');
        else select(roots[0]!, draft.event.occurrences);
      }
    }
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
