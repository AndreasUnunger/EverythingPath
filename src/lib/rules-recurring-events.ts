import type { EventOutcomeProjection } from './rules-event-outcomes';
import type { EventDispatch } from './rules-event-selection';
import type { WeeklyDraft } from './weekly-draft-contract';
import { eventCheck, eventDie } from './rules-event-checks';
type Persistent = WeeklyDraft['context']['carriedEvents'][number];
type Queue = WeeklyDraft['context']['queuedEffects'][number];
export type RecurringEventChange =
  | { kind: 'event_persistent'; eventId: string; event: Persistent }
  | { kind: 'event_end'; eventId: string; endedEventId: string }
  | {
      kind: 'event_treasury';
      eventId: string;
      before: number;
      after: number;
      retainedPercent: number;
    }
  | { kind: 'event_activity_bonus'; eventId: string; value: number };

export function resolveRecurringEvent(
  draft: WeeklyDraft,
  result: EventOutcomeProjection,
  dispatch: EventDispatch,
) {
  const { event, firstEventId, mode } = dispatch;
  const twice = mode === 'twice';
  const required = (key: string) =>
    result.requirements.push(`${event.eventId}:${key}`);
  function queue(
    effect: Queue['effect'],
    startsWeek = draft.week + 1,
    endsWeek = draft.week + 1,
    suffix = '',
  ) {
    const queued: Queue = {
      eventType: event.eventType,
      effectId: `event:${firstEventId}:${effect.kind}${suffix}`,
      sourceId: firstEventId,
      startsWeek,
      endsWeek,
      effect,
    };
    result.queuedEffects = result.queuedEffects.filter(
      (entry) => entry.effectId !== queued.effectId,
    );
    result.queuedEffects.push(queued);
    result.plan = result.plan.filter(
      (change) =>
        change.kind !== 'event_queue' ||
        change.effect.effectId !== queued.effectId,
    );
    result.plan.push({
      kind: 'event_queue',
      eventId: firstEventId,
      effect: queued,
    });
  }
  function dropQueues() {
    result.queuedEffects = result.queuedEffects.filter(
      (effect) => effect.sourceId !== firstEventId,
    );
    result.plan = result.plan.filter(
      (change) =>
        change.kind !== 'event_queue' ||
        change.effect.sourceId !== firstEventId,
    );
  }
  function persist(targets: Persistent['targets'] = []) {
    dropQueues();
    const existing = result.persistentEvents.find(
      (entry) => entry.eventId === firstEventId,
    );
    const persistent: Persistent = {
      eventId: firstEventId,
      eventType: event.eventType!,
      startedWeek: draft.week,
      order:
        existing?.order ??
        Math.max(-1, ...result.persistentEvents.map((entry) => entry.order)) +
          1,
      targets,
      sourceEventIds: [...new Set([firstEventId, event.eventId])],
    };
    result.persistentEvents = result.persistentEvents.filter(
      (entry) => entry.eventId !== firstEventId,
    );
    result.persistentEvents.push(persistent);
    result.plan = result.plan.filter(
      (change) =>
        change.kind !== 'event_persistent' ||
        change.event.eventId !== firstEventId,
    );
    result.plan.push({
      kind: 'event_persistent',
      eventId: firstEventId,
      event: persistent,
    });
  }
  function end(eventId: string) {
    result.persistentEvents = result.persistentEvents.filter(
      (entry) => entry.eventId !== eventId,
    );
    result.endedEventIds.push(eventId);
    result.queuedEffects = result.queuedEffects.filter(
      (effect) => effect.sourceId !== eventId,
    );
    result.plan.push({
      kind: 'event_end',
      eventId: event.eventId,
      endedEventId: eventId,
    });
  }
  switch (event.eventType) {
    case 'calm_before_the_storm':
      queue({ kind: 'automatic_events', count: twice ? 2 : 1 });
      return true;
    case 'double_agent':
    case 'low_morale': {
      if (twice) persist();
      else {
        queue(
          {
            kind: 'check_modifier',
            check: event.eventType === 'double_agent' ? 'secrecy' : 'loyalty',
            value: -2,
          },
          draft.week,
        );
        if (event.eventType === 'double_agent')
          queue({ kind: 'block_action', actionId: 'secure_cache' });
      }
      return true;
    }
    case 'hidden_agenda': {
      result.plan = result.plan.filter(
        (change) =>
          change.kind !== 'event_activity_bonus' ||
          change.eventId !== firstEventId,
      );
      result.plan.push({
        kind: 'event_activity_bonus',
        eventId: firstEventId,
        value: twice ? 5 : 2,
      });
      return true;
    }
    case 'high_morale': {
      const earlier = result.plan.filter(
        (change) =>
          change.kind === 'event_end' &&
          [firstEventId, event.eventId].includes(change.eventId),
      );
      const count = Math.min(
        (twice ? 2 : 1) - earlier.length,
        result.persistentEvents.length,
      );
      const targets = event.targets?.filter(
        (target) => target.kind === 'event',
      );
      const ordered = [...result.persistentEvents].sort(
        (a, b) =>
          a.startedWeek - b.startedWeek ||
          a.order - b.order ||
          a.eventId.localeCompare(b.eventId),
      );
      const ids = targets
        ? targets
            .map((target) => target.eventId)
            .filter(
              (id) =>
                !earlier.some(
                  (change) =>
                    change.kind === 'event_end' && change.endedEventId === id,
                ),
            )
        : ordered.slice(0, count).map((entry) => entry.eventId);
      if (
        ids.length !== count ||
        new Set(ids).size !== ids.length ||
        ids.some(
          (id) =>
            !result.persistentEvents.some((entry) => entry.eventId === id),
        )
      )
        required('persistent-targets');
      else for (const id of ids) end(id);
      queue({ kind: 'check_modifier', check: 'loyalty', value: twice ? 5 : 2 });
      return true;
    }
    case 'rivalry': {
      const targets =
        event.targets?.filter((target) => target.kind === 'team') ?? [];
      const acknowledgement = draft.acknowledgements.find(
        (entry) =>
          entry.subjectId === `event:${event.eventId}` && entry.outcome.trim(),
      );
      if (!acknowledgement) required('acknowledgement');
      else
        result.plan.push({
          kind: 'event_acknowledgement',
          eventId: event.eventId,
          acknowledgement,
        });
      if (
        targets.length !== 2 ||
        new Set(targets.map((target) => target.teamId)).size !== 2 ||
        targets.some(
          (target) =>
            !result.outcome.roster.teams.some(
              (team) => team.teamId === target.teamId,
            ),
        )
      ) {
        required('teams');
        return true;
      }
      if (twice) {
        const base =
          result.dispatch
            .find((entry) => entry.event.eventId === firstEventId)
            ?.event.targets?.filter((target) => target.kind === 'team') ?? [];
        if (
          base.length !== 2 ||
          base.some(
            (target) =>
              !targets.some((other) => other.teamId === target.teamId),
          )
        ) {
          required('same-teams');
          return true;
        }
        persist(targets);
      } else
        for (const target of targets)
          queue(
            {
              kind: 'team_unavailable',
              teamId: target.teamId,
              phase: 'activity',
            },
            draft.week + 1,
            draft.week + 1,
            `:${target.teamId}`,
          );
      if (twice && event.officerCheck) {
        const input = event.officerCheck;
        if (
          !result.outcome.characters.some(
            (character) => character.characterId === input.characterId,
          ) ||
          !result.outcome.roster.officers.some(
            (officer) => officer.characterId === input.characterId,
          )
        ) {
          required('officer');
          return true;
        }
        const raw = eventDie(
          result,
          input.roll,
          `${event.eventId}:rivalry`,
          20,
        );
        if (input.skillBonus === undefined) required('skill-bonus');
        if (raw === null || input.skillBonus === undefined) return true;
        const extras = new Map(
          (input.roll?.modifiers ?? [])
            .filter(
              (modifier) =>
                !['skill', 'skill-bonus', 'charisma'].includes(
                  modifier.sourceId,
                ),
            )
            .map((modifier) => [modifier.sourceId, modifier.value]),
        );
        const total =
          raw +
          input.skillBonus +
          [...extras.values()].reduce((sum, value) => sum + value, 0);
        result.plan.push({
          kind: 'event_officer_check',
          eventId: event.eventId,
          characterId: input.characterId,
          skill: input.skill,
          total,
          dc: 20,
          succeeded: total >= 20,
        });
        if (total >= 20) {
          dropQueues();
          if (
            result.persistentEvents.some(
              (entry) => entry.eventId === firstEventId,
            )
          )
            end(firstEventId);
        }
      }
      return true;
    }
    case 'theft': {
      if (twice) {
        persist();
        return true;
      }
      const attempted =
        event.mitigation === 'attempted' ||
        (event.mitigation !== 'unattempted' && !!event.rolls?.check);
      const total = attempted
        ? eventCheck(
            draft,
            result,
            event,
            'loyalty',
            event.rolls?.check,
            `${event.eventId}:theft`,
          )
        : null;
      if (attempted && total === null) return true;
      const retainedPercent = total !== null && total >= 20 ? 90 : 50;
      const before = result.outcome.treasuryCopper;
      result.outcome.treasuryCopper = Math.round(
        (before * retainedPercent) / 100,
      );
      result.plan.push({
        kind: 'event_treasury',
        eventId: event.eventId,
        before,
        after: result.outcome.treasuryCopper,
        retainedPercent,
      });
      return true;
    }
    case 'week_of_pain':
    case 'week_of_serenity': {
      for (const check of ['loyalty', 'secrecy', 'security'] as const)
        queue(
          {
            kind: 'check_modifier',
            check,
            value: event.eventType === 'week_of_pain' ? -1 : 5,
          },
          draft.week + 1,
          draft.week + 1,
          `:${check}`,
        );
      queue(
        event.eventType === 'week_of_pain'
          ? { kind: 'upkeep_loss_multiplier', value: 2 }
          : { kind: 'activity_training_multiplier', value: 2 },
      );
      return true;
    }
    default:
      return false;
  }
}
