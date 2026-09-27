import { normalizeRawRoll } from './raw-roll';
import { operatedSettlementIds } from './rules-event-context';
import { projectSettlements } from './rules-settlements';
import type { ActivityProjection } from './rules-activity';
import type { WeeklyDraft } from './weekly-draft-contract';
import type { EventActionChange } from './rules-event-actions';
import { eventTypeForPercentile } from './militia-event-table';

type Event = WeeklyDraft['event']['occurrences'][number];
type Guarantee = Extract<EventActionChange, { kind: 'event_guarantee' }>;
export type EventDispatch = {
  event: Event;
  mode: 'base' | 'twice' | 'no_additional_effect';
  firstEventId: string;
};
export function dispatchEvent(
  event: Event,
  preceding: EventDispatch[],
): EventDispatch {
  const first = preceding.find(
    (prior) => prior.event.eventType === event.eventType,
  );
  const independent = ['invasion', 'raid', 'turn_around', 'war_games'].includes(
    event.eventType ?? '',
  );
  return {
    event,
    firstEventId: first?.firstEventId ?? event.eventId,
    mode:
      !first || independent
        ? 'base'
        : event.eventType === 'week_of_pain' ||
            event.eventType === 'week_of_serenity'
          ? 'no_additional_effect'
          : 'twice',
  };
}
export type EventSelectionProjection = {
  ready: boolean;
  requirements: string[];
  warnings: string[];
  chance: number;
  carryModifier: number;
  nextUneventfulCarry: boolean | null;
  guaranteed: boolean;
  guarantees: Guarantee[];
  tree: Event[];
  selected: Event[];
  dispatch: EventDispatch[];
  /** The operating settlement's reputation modifier on the chance roll; null while that settlement's reputation is unknown. */
  chanceModifier: number | null;
};

type SelectionContext = {
  draft: WeeklyDraft;
  activity: Pick<
    ActivityProjection,
    'requirements' | 'warnings' | 'plan' | 'outcome' | 'teamUse'
  >;
  result: EventSelectionProjection;
  expanded: boolean;
};
function readEventDie(
  { result }: SelectionContext,
  raw: Event['tableRoll'],
  id: string,
  sides: number,
) {
  const normalized = normalizeRawRoll(raw, { count: 1, sides });
  if (normalized.status !== 'complete') {
    result.requirements.push(`${id}:1d${sides}`);
    return null;
  }
  if (normalized.rangeWarning) result.warnings.push(`${id}:roll-range`);
  return normalized.diceTotal;
}
// The operating settlement's reputation never touches the table roll; it
// modifies the chance roll (see selectChanceEvent).
function resolveTableRoll(context: SelectionContext, event: Event) {
  const { result } = context;
  const value = readEventDie(
    context,
    event.tableRoll,
    `${event.eventId}:table`,
    100,
  );
  if (value === null) return null;
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
      value + [...extra.values()].reduce((sum, value) => sum + value, 0),
    ),
  );
  const eventType = eventTypeForPercentile(total);
  if (event.eventType && event.eventType !== eventType)
    result.warnings.push(`${event.eventId}:calculated-event`);
  const resolved = { ...structuredClone(event), eventType };
  result.tree.push(resolved);
  return resolved;
}
function canEventOccur({ draft, activity }: SelectionContext, event: Event) {
  const state = activity.outcome;
  switch (event.eventType) {
    case 'cache_discovered':
      return (
        state.economy?.caches.some(
          (cache) => cache.status === 'hidden' || cache.status === 'returning',
        ) ?? false
      );
    case 'raid':
      return state.settlements.some(
        (town) =>
          town.refugeActivatedWeek !== null &&
          town.refugeActiveUntilWeek !== null &&
          town.refugeActivatedWeek <= draft.week &&
          town.refugeActiveUntilWeek >= draft.week,
      );
    case 'market_day':
      return true;
    case 'festival':
      return (
        operatedSettlementIds(draft, activity).length > 0 ||
        draft.rulesExceptions.some(
          (entry) =>
            entry.subjectId === event.eventId &&
            entry.ruleId === 'event-settlement' &&
            entry.reason.trim(),
        )
      );
    case 'sickness':
    case 'turn_around':
      return state.roster.teams.length > 0;
    case 'rivalry':
      return state.roster.teams.length >= 2;
    case 'missing_in_action':
      return state.roster.teams.some((team) =>
        activity.teamUse.usedTeamIds.includes(team.teamId),
      );
    default:
      return true;
  }
}
function selectOccurrence(
  context: SelectionContext,
  event: Event,
  tree: Event[],
  automatic = false,
) {
  const { draft, result } = context;
  const resolved = resolveTableRoll(context, event);
  if (!resolved) return;
  const possible = canEventOccur(context, resolved);
  const exception = draft.rulesExceptions.some(
    (entry) =>
      entry.subjectId === event.eventId &&
      entry.ruleId === 'event-eligibility' &&
      entry.reason.trim(),
  );
  if (!possible) result.warnings.push(`${event.eventId}:event-eligibility`);
  if (resolved.eventType !== 'roll_twice' && (possible || exception)) {
    result.selected.push(resolved);
    return;
  }
  const expands =
    resolved.eventType === 'roll_twice' && !automatic && !context.expanded;
  const kind = expands ? 'roll_twice' : 'replacement';
  const count = expands ? 2 : 1;
  if (expands) context.expanded = true;
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
  for (const child of children)
    selectOccurrence(context, child, tree, automatic);
}

function selectReplacement(
  context: SelectionContext,
  replacement: NonNullable<Parameters<typeof projectEventSelection>[2]>,
) {
  const { result } = context;
  const children = replacement.tree.filter(
    (event) =>
      event.origin.kind === 'replacement' &&
      event.origin.parentEventId === replacement.parentEventId,
  );
  if (children.length !== 1)
    result.requirements.push(`${replacement.parentEventId}:replacement:1`);
  else
    selectOccurrence(
      context,
      children[0]!,
      replacement.tree,
      replacement.automatic,
    );
}
function selectAutomaticEvents(context: SelectionContext) {
  const { draft, result } = context;
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
    else
      for (const root of roots)
        selectOccurrence(context, root, draft.event.occurrences, true);
  }
  return automaticSources;
}
function validateCandidate(
  context: SelectionContext,
  guarantee: Guarantee,
  event: Event,
) {
  const { draft, result } = context;
  const resolved = resolveTableRoll(context, event);
  if (!resolved || canEventOccur(context, resolved)) return;
  result.warnings.push(`${event.eventId}:event-eligibility`);
  if (
    draft.rulesExceptions.some(
      (entry) =>
        entry.subjectId === event.eventId &&
        entry.ruleId === 'event-eligibility' &&
        entry.reason.trim(),
    )
  )
    return;
  const replacements = guarantee.candidates.filter(
    (entry) =>
      entry.origin.kind === 'replacement' &&
      entry.origin.parentEventId === event.eventId,
  );
  if (replacements.length !== 1)
    result.requirements.push(`${event.eventId}:replacement:1`);
  else validateCandidate(context, guarantee, replacements[0]!);
}

function selectGuaranteedEvents(context: SelectionContext) {
  const { result } = context;
  for (const guarantee of result.guarantees) {
    const roots = guarantee.candidates.filter(
      (event) => event.origin.kind === 'rolled',
    );
    if (roots.length !== 2)
      result.requirements.push(`${guarantee.choiceId}:candidates:2`);
    // Both independent percentile rolls are required even for the rejected option.
    for (const root of roots) validateCandidate(context, guarantee, root);
    const chosen = roots.find(
      (root) => root.eventId === guarantee.selectedEventId,
    );
    if (!chosen)
      result.requirements.push(`${guarantee.choiceId}:selected-event`);
    else if (roots.length === 2)
      selectOccurrence(context, chosen, guarantee.candidates);
  }
}
function selectChanceEvent(context: SelectionContext) {
  const { draft, result } = context;
  const chanceRoll = readEventDie(
    context,
    draft.event.chanceRoll,
    'event:chance',
    100,
  );
  // Friendly subtracts 5 from, and Unfriendly adds 5 to, the percentile roll
  // that decides whether an event occurs (Table 6-2).
  if (result.chanceModifier === null)
    result.requirements.push('event:operating-settlement');
  // The accepted E01 audit baseline explicitly uses a strict comparison.
  if (
    chanceRoll !== null &&
    result.chanceModifier !== null &&
    chanceRoll + result.chanceModifier < result.chance
  ) {
    const roots = draft.event.occurrences.filter(
      (event) => event.origin.kind === 'rolled',
    );
    if (roots.length !== 1) result.requirements.push('event:root:1');
    else selectOccurrence(context, roots[0]!, draft.event.occurrences);
  }
}
function calculateEventChance(
  draft: WeeklyDraft,
  outcome: ActivityProjection['outcome'],
  carryModifier: number,
) {
  const modifiers = draft.context.queuedEffects.filter(
    (effect) =>
      effect.startsWeek <= draft.week &&
      draft.week <= effect.endsWeek &&
      effect.effect.kind === 'event_chance',
  );
  return Math.max(
    10,
    Math.min(
      95,
      outcome.notoriety +
        carryModifier +
        modifiers.reduce(
          (sum, effect) =>
            sum +
            (effect.effect.kind === 'event_chance' ? effect.effect.value : 0),
          0,
        ),
    ),
  );
}

function createSelectionContext(
  draft: WeeklyDraft,
  activity: SelectionContext['activity'],
  expanded: boolean,
): SelectionContext {
  const result: EventSelectionProjection = {
    ready: false,
    requirements: [...activity.requirements],
    warnings: [...activity.warnings],
    chance: 10,
    carryModifier: draft.context.uneventfulCarry ? activity.outcome.rank : 0,
    nextUneventfulCarry: null,
    guaranteed: false,
    guarantees: activity.plan.filter(
      (effect): effect is Guarantee => effect.kind === 'event_guarantee',
    ),
    tree: [],
    selected: [],
    dispatch: [],
    chanceModifier: 0,
  };
  result.guaranteed = result.guarantees.length > 0;
  result.chance = calculateEventChance(
    draft,
    activity.outcome,
    result.carryModifier,
  );

  result.chanceModifier = draft.activity.operatingSettlementId
    ? (projectSettlements(
        activity.outcome.settlements,
        draft.week,
      ).settlements.find(
        (town) => town.settlementId === draft.activity.operatingSettlementId,
      )?.eventChanceModifier ?? null)
    : 0;
  return {
    draft,
    activity,
    result,
    expanded,
  };
}
function finalizeEventSelection(result: EventSelectionProjection) {
  for (const event of result.selected)
    result.dispatch.push(dispatchEvent(event, result.dispatch));
  result.tree = [
    ...new Map(result.tree.map((event) => [event.eventId, event])).values(),
  ];
  result.requirements = [...new Set(result.requirements)];
  result.warnings = [...new Set(result.warnings)];
  result.ready = result.requirements.length === 0;
}

// Selection keeps occurrence identities and raw facts; effect resolvers consume
// dispatch in order. A Twice clause never collapses the recorded source events.
export function projectEventSelection(
  draft: WeeklyDraft,
  activity: Pick<
    ActivityProjection,
    'requirements' | 'warnings' | 'plan' | 'outcome' | 'teamUse'
  >,
  replacement?: {
    parentEventId: string;
    tree: Event[];
    automatic: boolean;
    expanded: boolean;
  },
): EventSelectionProjection {
  const context = createSelectionContext(
    draft,
    activity,
    replacement?.expanded ?? false,
  );
  const { result } = context;
  if (replacement) {
    selectReplacement(context, replacement);
    result.requirements = [...new Set(result.requirements)];
    result.warnings = [...new Set(result.warnings)];
    result.ready = result.requirements.length === 0;
    return result;
  }
  const automaticSources = selectAutomaticEvents(context);
  const forcedCalm = draft.context.queuedEffects.some(
    (effect) =>
      effect.startsWeek <= draft.week &&
      draft.week <= effect.endsWeek &&
      effect.effect.kind === 'all_is_calm',
  );
  if (!forcedCalm) {
    selectGuaranteedEvents(context);
    if (!result.guaranteed) selectChanceEvent(context);
  }
  finalizeEventSelection(result);
  if (result.ready)
    result.nextUneventfulCarry =
      !draft.context.firstMilitiaWeek &&
      !forcedCalm &&
      automaticSources.length === 0 &&
      result.selected.length < 2 &&
      result.selected.every((event) => event.eventType === 'all_is_calm');
  return result;
}
