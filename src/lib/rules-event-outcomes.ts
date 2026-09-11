import {
  resolveRecurringEvent,
  type RecurringEventChange,
} from './rules-recurring-events';
import { projectActivity } from './rules-activity';
import {
  resolveThreatEvent,
  finishEventTeamReturns,
  type ThreatEventChange,
} from './rules-threat-events';
import { operatedSettlementIds } from './rules-event-context';
import {
  projectEventShaping,
  type EventShapingProjection,
} from './rules-event-shaping';
import {
  projectEventSelection,
  dispatchEvent,
  type EventDispatch,
} from './rules-event-selection';
import type { EventBenefits } from './rules-event-benefits';
import type { UpkeepSnapshot } from './rules-upkeep';
import type { WeeklyDraft } from './weekly-draft-contract';

type Event = EventDispatch['event'];
type Receipt = WeeklyDraft['acknowledgements'][number];
type Queue = WeeklyDraft['context']['queuedEffects'][number];
type Bonus = UpkeepSnapshot['bonuses'][number];
export type EventOutcomeChange =
  | ThreatEventChange
  | RecurringEventChange
  | { kind: 'event_queue'; eventId: string; effect: Queue }
  | {
      kind: 'event_skill_benefit';
      eventId: string;
      benefit: EventBenefits['skills'][number];
    }
  | {
      kind: 'event_market_benefit';
      eventId: string;
      benefit: EventBenefits['markets'][number];
    }
  | {
      kind: 'event_item';
      eventId: string;
      item: NonNullable<UpkeepSnapshot['economy']>['items'][number];
      acknowledgement: Receipt;
    }
  | {
      kind: 'event_identification';
      eventId: string;
      itemId: string;
      acknowledgement: Receipt;
    }
  | { kind: 'event_acknowledgement'; eventId: string; acknowledgement: Receipt }
  | {
      kind: 'event_team_recovery';
      eventId: string;
      teamId: string;
      before: 'disabled';
      after: 'active';
    }
  | { kind: 'event_check_bonus'; eventId: string; bonus: Bonus }
  | { kind: 'event_training'; eventId: string; before: number; after: number };
export type EventOutcomeProjection = EventShapingProjection & {
  plan: EventOutcomeChange[];
  queuedEffects: Queue[];
  persistentEvents: WeeklyDraft['context']['carriedEvents'][number][];
  endedEventIds: string[];
};

// Each handler observes the preceding event's projected outcome. Selection and
// Sabotage retain all original occurrences, including suppressed duplicate effects.
export function projectEventOutcomes(
  draft: WeeklyDraft,
  shaping: EventShapingProjection,
): EventOutcomeProjection {
  const result: EventOutcomeProjection = {
    ...structuredClone(shaping),
    plan: [],
    persistentEvents: structuredClone([...draft.context.carriedEvents]),
    endedEventIds: [],
    queuedEffects: structuredClone([...draft.context.queuedEffects]),
  };
  const state = result.outcome;
  const operatedIds = operatedSettlementIds(draft, {
    outcome: state,
    teamUse: result.teamUse,
  });
  state.eventBenefits ??= { skills: [], markets: [] };
  const required = (event: Event, key: string) =>
    result.requirements.push(`${event.eventId}:${key}`);
  const pcs = state.roster.people
    .filter(
      (person) =>
        person.kind === 'pc' &&
        state.characters.some(
          (character) =>
            character.characterId === person.characterId && character.isActive,
        ),
    )
    .map((person) => person.characterId);
  function receipt(event: Event) {
    const value = draft.acknowledgements.find(
      (entry) =>
        entry.subjectId === `event:${event.eventId}` && entry.outcome.trim(),
    );
    if (!value) required(event, 'acknowledgement');
    else
      result.plan.push({
        kind: 'event_acknowledgement',
        eventId: event.eventId,
        acknowledgement: value,
      });
    return value;
  }
  function queue(
    event: Event,
    effect: Queue['effect'],
    sourceId = event.eventId,
  ) {
    const value: Queue = {
      effectId: `event:${sourceId}:${effect.kind}`,
      sourceId,
      startsWeek: draft.week + 1,
      endsWeek: draft.week + 1,
      effect,
    };
    if (result.queuedEffects.some((entry) => entry.effectId === value.effectId))
      return;
    result.queuedEffects.push(value);
    result.plan.push({
      kind: 'event_queue',
      eventId: event.eventId,
      effect: value,
    });
  }
  function settlement(event: Event, settlementId: string | null) {
    if (
      !settlementId ||
      !state.settlements.some((town) => town.settlementId === settlementId)
    ) {
      required(event, 'settlement');
      return;
    }
    if (!operatedIds.includes(settlementId)) {
      result.warnings.push(`${event.eventId}:event-settlement`);
      if (
        !draft.rulesExceptions.some(
          (entry) =>
            entry.subjectId === event.eventId &&
            entry.ruleId === 'event-settlement' &&
            entry.reason.trim(),
        )
      )
        required(event, 'event-settlement:exception');
    }
  }
  function skill(event: Event, firstEventId: string, twice: boolean) {
    const type = event.eventType;
    const festival = type === 'festival';
    const target =
      event.targets?.filter((target) => target.kind === 'settlement') ?? [];
    const existing = state.eventBenefits!.skills.find(
      (benefit) => benefit.benefitId === `event:${firstEventId}:skill`,
    );
    let settlementId: string | null = null;
    if (festival) {
      settlementId = twice
        ? (existing?.settlementId ?? null)
        : target.length === 1
          ? target[0]!.settlementId
          : null;
      settlement(event, settlementId);
      if (twice && target.some((town) => town.settlementId !== settlementId))
        required(event, 'same-settlement');
    }
    const benefit: EventBenefits['skills'][number] = {
      benefitId: `event:${firstEventId}:skill`,
      sourceEventIds: [...(existing?.sourceEventIds ?? []), event.eventId],
      characterIds: pcs,
      skills: festival
        ? ['bluff', 'diplomacy', 'intimidate']
        : type === 'night_ops'
          ? ['stealth']
          : ['knowledge_local'],
      bonusType: festival
        ? 'morale'
        : type === 'night_ops'
          ? 'circumstance'
          : 'untyped',
      value: twice ? 5 : 2,
      settlementId,
      afterDark: type === 'night_ops',
      startsWeek: draft.week + (festival ? 1 : 0),
      endsWeek: draft.week + (festival ? 1 : 0),
    };
    if (existing) Object.assign(existing, benefit);
    else state.eventBenefits!.skills.push(benefit);
    // Publish the effective benefit once; an enhancement replaces the earlier plan entry.
    result.plan = result.plan.filter(
      (change) =>
        change.kind !== 'event_skill_benefit' ||
        change.benefit.benefitId !== benefit.benefitId,
    );
    result.plan.push({
      kind: 'event_skill_benefit',
      eventId: firstEventId,
      benefit: structuredClone(benefit),
    });
  }
  const allOccurrences = [
    ...draft.event.occurrences,
    ...result.guarantees.flatMap((guarantee) => guarantee.candidates),
  ];
  const pending = [...result.dispatch];
  const applied: EventDispatch[] = [];
  for (let index = 0; index < pending.length; index++) {
    const dispatch = dispatchEvent(
      pending[index]!.event,
      applied.filter(
        (prior) => !result.negatedEventIds.includes(prior.event.eventId),
      ),
    );
    const { event, firstEventId, mode } = dispatch;
    if (
      result.negatedEventIds.includes(event.eventId) ||
      mode === 'no_additional_effect'
    ) {
      applied.push(dispatch);
      continue;
    }
    const twice = mode === 'twice';
    const exhausted =
      (event.eventType === 'raid' &&
        !state.settlements.some(
          (town) =>
            town.refugeActivatedWeek !== null &&
            town.refugeActiveUntilWeek !== null &&
            town.refugeActivatedWeek <= draft.week &&
            town.refugeActiveUntilWeek >= draft.week,
        )) ||
      (['sickness', 'turn_around', 'missing_in_action'].includes(
        event.eventType ?? '',
      ) &&
        state.roster.teams.length === 0) ||
      (event.eventType === 'cache_discovered' &&
        !twice &&
        !state.economy?.caches.some(
          (cache) => cache.status === 'hidden' || cache.status === 'returning',
        ));
    if (
      exhausted &&
      !draft.rulesExceptions.some(
        (entry) =>
          entry.subjectId === event.eventId &&
          entry.ruleId === 'event-eligibility' &&
          entry.reason.trim(),
      )
    ) {
      const automatic = (id: string): boolean => {
        const source = allOccurrences.find((entry) => entry.eventId === id);
        return (
          source?.origin.kind === 'automatic' ||
          !!(
            source &&
            'parentEventId' in source.origin &&
            automatic(source.origin.parentEventId)
          )
        );
      };
      const expanded = result.tree.some(
        (parent) =>
          parent.eventType === 'roll_twice' &&
          result.tree.some(
            (child) =>
              child.origin.kind === 'roll_twice' &&
              child.origin.parentEventId === parent.eventId,
          ),
      );
      const replacement = projectEventSelection(
        draft,
        {
          requirements: [],
          warnings: [],
          plan: [],
          outcome: state,
          teamUse: result.teamUse,
        },
        {
          parentEventId: event.eventId,
          tree: allOccurrences,
          automatic: automatic(event.eventId),
          expanded,
        },
      );
      result.requirements.push(...replacement.requirements);
      result.warnings.push(...replacement.warnings);
      result.tree.push(...replacement.tree);
      const replacements = replacement.selected.map((event) =>
        dispatchEvent(event, []),
      );
      pending.splice(index + 1, 0, ...replacements);
      continue;
    }
    const liveDraft = {
      ...draft,
      context: {
        ...draft.context,
        carriedEvents: result.persistentEvents,
        queuedEffects: result.queuedEffects,
      },
    };
    const reactive = projectEventShaping(
      liveDraft,
      {
        requirements: [],
        warnings: [],
        plan: [],
        outcome: state,
        teamUse: result.teamUse,
        checkUsage: result.checkUsage,
      },
      {
        ...result,
        requirements: [],
        warnings: [],
        selected: [event],
        dispatch: [dispatch],
      },
    );
    Object.assign(state, reactive.outcome);
    result.checkUsage = reactive.checkUsage;
    result.teamUse = reactive.teamUse;
    result.requirements.push(...reactive.requirements);
    result.warnings.push(...reactive.warnings);
    result.checks.push(...reactive.checks);
    result.sabotage.push(...reactive.sabotage);
    result.negatedEventIds.push(...reactive.negatedEventIds);
    applied.push(dispatch);
    result.dispatch = applied;
    if (result.negatedEventIds.includes(event.eventId)) continue;
    if (resolveRecurringEvent(draft, result, dispatch)) continue;
    if (resolveThreatEvent(draft, result, dispatch)) continue;
    switch (event.eventType) {
      case 'all_is_calm':
        if (twice) queue(event, { kind: 'all_is_calm' }, firstEventId);
        break;
      case 'broke_the_code': {
        const acknowledgement = receipt(event);
        skill(event, firstEventId, twice);
        if (twice) break;
        const targets =
          event.targets?.filter((target) => target.kind === 'item') ?? [];
        const item =
          targets.length === 1
            ? state.economy?.items.find(
                (item) => item.itemId === targets[0]!.itemId,
              )
            : undefined;
        if (!item) required(event, 'item');
        else if (acknowledgement) {
          item.identified = true;
          result.plan.push({
            kind: 'event_identification',
            eventId: event.eventId,
            itemId: item.itemId,
            acknowledgement,
          });
        }
        break;
      }
      case 'festival':
      case 'night_ops':
        receipt(event);
        skill(event, firstEventId, twice);
        break;
      case 'found_fire': {
        const acknowledgement = receipt(event);
        const rewards = event.rewards ?? [];
        for (const pc of pcs)
          if (rewards.filter((item) => item.characterId === pc).length !== 1)
            required(event, `reward:${pc}`);
        for (const item of rewards) {
          if (!pcs.includes(item.characterId)) {
            required(event, `reward:${item.characterId}:recipient`);
            continue;
          }
          const invalid =
            !item.alchemical || item.poison || item.valueCopper > 10000;
          if (invalid) {
            result.warnings.push(`${event.eventId}:alchemical-reward`);
            if (
              !draft.rulesExceptions.some(
                (entry) =>
                  entry.subjectId === item.itemId &&
                  entry.ruleId === 'alchemical-reward' &&
                  entry.reason.trim(),
              )
            ) {
              required(event, `reward:${item.itemId}:exception`);
              continue;
            }
          }
          state.economy ??= { items: [], caches: [], markets: [], orders: [] };
          if (
            state.economy.items.some(
              (existing) => existing.itemId === item.itemId,
            )
          ) {
            required(event, `reward:${item.itemId}:duplicate`);
            continue;
          }
          if (!acknowledgement) continue;
          const received = {
            itemId: item.itemId,
            ownerCharacterId: item.characterId,
            name: item.name,
            valueCopper: item.valueCopper,
            weight: item.weight,
            location: 'held' as const,
          };
          state.economy.items.push(received);
          result.plan.push({
            kind: 'event_item',
            eventId: event.eventId,
            item: received,
            acknowledgement,
          });
        }
        queue(
          event,
          { kind: 'check_modifier', check: 'security', value: 2 },
          firstEventId,
        );
        break;
      }
      case 'market_day': {
        receipt(event);
        const targets =
          event.targets?.filter((target) => target.kind === 'settlement') ?? [];
        const settlementIds = twice
          ? operatedIds
          : targets.length === 1
            ? [targets[0]!.settlementId]
            : [];
        if (!settlementIds.length) required(event, 'settlement');
        for (const settlementId of settlementIds)
          settlement(event, settlementId);
        const existing = state.eventBenefits.markets.find(
          (benefit) => benefit.benefitId === `event:${firstEventId}:market`,
        );
        const benefit: EventBenefits['markets'][number] = {
          benefitId: `event:${firstEventId}:market`,
          sourceEventIds: [...(existing?.sourceEventIds ?? []), event.eventId],
          settlementIds,
          discountPercent: 5,
          startsWeek: draft.week,
          endsWeek: draft.week,
        };
        if (existing) Object.assign(existing, benefit);
        else state.eventBenefits.markets.push(benefit);
        result.plan = result.plan.filter(
          (change) =>
            change.kind !== 'event_market_benefit' ||
            change.benefit.benefitId !== benefit.benefitId,
        );
        result.plan.push({
          kind: 'event_market_benefit',
          eventId: firstEventId,
          benefit: structuredClone(benefit),
        });
        break;
      }
      case 'turn_around': {
        const disabled = state.roster.teams.filter(
          (team) => team.status === 'disabled',
        );
        if (disabled.length) {
          for (const team of disabled) {
            team.status = 'active';
            result.plan.push({
              kind: 'event_team_recovery',
              eventId: event.eventId,
              teamId: team.teamId,
              before: 'disabled',
              after: 'active',
            });
          }
          break;
        }
        const targets =
          event.targets?.filter((target) => target.kind === 'team') ?? [];
        const team =
          targets.length === 1
            ? state.roster.teams.find(
                (team) => team.teamId === targets[0]!.teamId,
              )
            : undefined;
        if (!team) {
          required(event, 'team');
          break;
        }
        const bonus: Bonus = {
          bonusId: `event:${event.eventId}:team-check`,
          source: event.eventId,
          check: 'any',
          value: 2,
          teamId: team.teamId,
          phase: 'activity',
          availableWeek: draft.week + 1,
          consumedWeek: null,
        };
        state.bonuses.push(bonus);
        result.plan.push({
          kind: 'event_check_bonus',
          eventId: event.eventId,
          bonus,
        });
        break;
      }
      case 'war_games': {
        const before = state.training;
        state.training += state.rank;
        result.plan.push({
          kind: 'event_training',
          eventId: event.eventId,
          before,
          after: state.training,
        });
        break;
      }
      default:
        required(event, 'outcome');
    }
  }
  result.dispatch = applied;
  result.selected = applied.map((dispatch) => dispatch.event);
  finishEventTeamReturns(draft, result);
  result.requirements = [...new Set(result.requirements)];
  result.warnings = [...new Set(result.warnings)];
  result.ready = result.requirements.length === 0;
  return result;
}
export function projectActivityAndEvents(
  draft: WeeklyDraft,
  snapshot: UpkeepSnapshot,
) {
  let bonus = 0;
  const seen = new Set<number>();
  for (;;) {
    seen.add(bonus);
    const queued = bonus
      ? (['loyalty', 'secrecy', 'security'] as const).map((check) => ({
          effectId: `hidden-agenda:${check}`,
          sourceId: 'hidden-agenda',
          startsWeek: draft.week,
          endsWeek: draft.week,
          effect: {
            kind: 'check_modifier' as const,
            check,
            phase: 'activity' as const,
            value: bonus,
          },
        }))
      : [];
    const prepared: WeeklyDraft = {
      ...draft,
      context: {
        ...draft.context,
        queuedEffects: [...draft.context.queuedEffects, ...queued],
      },
    };
    const activity = projectActivity(prepared, snapshot);
    const eventDraft: WeeklyDraft = {
      ...prepared,
      context: {
        ...prepared.context,
        carriedEvents: prepared.context.carriedEvents.filter(
          (event) => !activity.endedEventIds.includes(event.eventId),
        ),
      },
    };
    const shaped = projectEventShaping(eventDraft, activity, undefined, true);
    const event = projectEventOutcomes(eventDraft, shaped);
    event.endedEventIds = [
      ...new Set([...activity.endedEventIds, ...event.endedEventIds]),
    ];
    event.queuedEffects = event.queuedEffects.filter(
      (effect) => effect.sourceId !== 'hidden-agenda',
    );
    const next = Math.max(
      0,
      ...event.plan.flatMap((change) =>
        change.kind === 'event_activity_bonus' ? [change.value] : [],
      ),
    );
    if (next === bonus) return { activity, event };
    if (seen.has(next)) {
      event.requirements.push('event:hidden-agenda-cycle');
      event.ready = false;
      return { activity, event };
    }
    bonus = next;
  }
}
