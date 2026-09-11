import type { EventDispatch } from './rules-event-selection';
import type { EventOutcomeProjection } from './rules-event-outcomes';
import type { UpkeepSnapshot } from './rules-upkeep';
import type { WeeklyDraft } from './weekly-draft-contract';
import type { TrackedCharacter } from './rules-character-state';
import { eventCheck, eventDie } from './rules-event-checks';
type Event = EventDispatch['event'];
type Cache = NonNullable<UpkeepSnapshot['economy']>['caches'][number];
type Queue = WeeklyDraft['context']['queuedEffects'][number];
export type ThreatEventChange =
  | { kind: 'event_cache'; eventId: string; before: Cache; after: Cache }
  | {
      kind: 'event_item_location';
      eventId: string;
      itemId: string;
      before: string;
      after: 'held' | 'lost';
    }
  | {
      kind: 'event_team_status';
      eventId: string;
      teamId: string;
      before: string;
      after: 'disabled' | 'missing' | 'active';
    }
  | { kind: 'event_team_loss'; eventId: string; teamId: string }
  | {
      kind: 'event_refuge';
      eventId: string;
      settlementId: string;
      before: number | null;
      after: null;
    }
  | {
      kind: 'event_person';
      eventId: string;
      before: TrackedCharacter;
      after: TrackedCharacter;
    }
  | {
      kind: 'event_capture';
      eventId: string;
      characterId: string;
      chance: number;
      roll: number | null;
      captured: boolean;
    }
  | {
      kind: 'event_encounter';
      eventId: string;
      averagePartyLevel: number;
      challengeRating: number;
      acknowledgement: WeeklyDraft['acknowledgements'][number];
    }
  | {
      kind: 'event_officer_check';
      eventId: string;
      characterId: string;
      skill: 'diplomacy' | 'bluff' | 'intimidate';
      total: number;
      dc: number;
      succeeded: boolean;
    };

export function resolveThreatEvent(
  draft: WeeklyDraft,
  result: EventOutcomeProjection,
  dispatch: EventDispatch,
) {
  const { event, mode, firstEventId } = dispatch;
  const twice = mode === 'twice';
  const state = result.outcome;
  const required = (key: string) =>
    result.requirements.push(`${event.eventId}:${key}`);
  function receipt() {
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
    return acknowledgement;
  }
  function exception(ruleId: string) {
    result.warnings.push(`${event.eventId}:${ruleId}`);
    const accepted = draft.rulesExceptions.some(
      (entry) =>
        entry.subjectId === event.eventId &&
        entry.ruleId === ruleId &&
        entry.reason.trim(),
    );
    if (!accepted) required(`${ruleId}:exception`);
    return accepted;
  }
  function teamTarget() {
    const targets =
      event.targets?.filter((target) => target.kind === 'team') ?? [];
    const team =
      targets.length === 1
        ? state.roster.teams.find((team) => team.teamId === targets[0]!.teamId)
        : undefined;
    if (!team) required(state.roster.teams.length ? 'team' : 'replacement:1');
    return team;
  }
  function status(
    team: UpkeepSnapshot['roster']['teams'][number],
    after: 'disabled' | 'missing' | 'active',
  ) {
    const before = team.status;
    team.status = after;
    result.plan.push({
      kind: 'event_team_status',
      eventId: event.eventId,
      teamId: team.teamId,
      before,
      after,
    });
  }
  function lose(teamId: string) {
    state.roster.teams = state.roster.teams.filter(
      (team) => team.teamId !== teamId,
    );
    state.bonuses = state.bonuses.filter((bonus) => bonus.teamId !== teamId);
    result.queuedEffects = result.queuedEffects.filter(
      (effect) =>
        !('teamId' in effect.effect) || effect.effect.teamId !== teamId,
    );
    result.plan.push({
      kind: 'event_team_loss',
      eventId: event.eventId,
      teamId,
    });
  }
  function queue(effect: Queue['effect'], sourceId: string) {
    const queued: Queue = {
      effectId: `event:${sourceId}:${effect.kind}`,
      sourceId,
      startsWeek: draft.week + 1,
      endsWeek: draft.week + 1,
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
      eventId: event.eventId,
      effect: queued,
    });
  }
  function mitigate(
    target: NonNullable<Event['targets']>[number],
    check: 'security' | 'secrecy',
    dc: number,
  ) {
    const input = event.targetChecks?.find((input) =>
      target.kind === 'cache'
        ? input.target.kind === 'cache' &&
          input.target.cacheId === target.cacheId
        : target.kind === 'character' &&
          input.target.kind === 'character' &&
          input.target.characterId === target.characterId,
    );
    const attempted =
      (input?.mitigation ?? event.mitigation) === 'attempted' ||
      ((input?.mitigation ?? event.mitigation) !== 'unattempted' &&
        !!(input?.rolls?.check ?? event.rolls?.check));
    if (!attempted) return false;
    const targetId =
      'cacheId' in target
        ? target.cacheId
        : 'characterId' in target
          ? target.characterId
          : event.eventId;
    const total = eventCheck(
      draft,
      result,
      input
        ? { ...event, overseerCharacterId: input.overseerCharacterId }
        : event,
      check,
      input?.rolls?.check ??
        (target.kind === 'cache' && !twice ? event.rolls?.check : undefined),
      `${event.eventId}:${targetId}:mitigation`,
    );
    return total === null ? null : total >= dc;
  }
  switch (event.eventType) {
    case 'cache_discovered': {
      const eligible =
        state.economy?.caches.filter(
          (cache) => cache.status === 'hidden' || cache.status === 'returning',
        ) ?? [];
      // The actual Twice clause explicitly says no additional effect with no caches.
      if (!eligible.length) {
        if (!twice) required('replacement:1');
        return true;
      }
      const targets =
        event.targets?.filter((target) => target.kind === 'cache') ?? [];
      const caches = twice
        ? eligible
        : targets.length === 1
          ? eligible.filter((cache) => cache.cacheId === targets[0]!.cacheId)
          : [];
      if (!caches.length) {
        required('cache');
        return true;
      }
      for (const input of event.targetChecks ?? [])
        if (
          input.target.kind !== 'cache' ||
          !caches.some(
            (cache) =>
              input.target.kind === 'cache' &&
              cache.cacheId === input.target.cacheId,
          )
        )
          required('mitigation-target');
      for (const cache of caches) {
        const recovered = mitigate(
          { kind: 'cache', cacheId: cache.cacheId },
          'secrecy',
          10 + state.rank,
        );
        if (recovered === null) continue;
        if (
          cache.itemIds.some(
            (itemId) =>
              !state.economy!.items.some((item) => item.itemId === itemId),
          )
        ) {
          required(`cache:${cache.cacheId}:items`);
          continue;
        }
        const before = structuredClone(cache);
        cache.status = recovered ? 'retrieved' : 'lost';
        cache.returnActivityWeek = null;
        result.plan.push({
          kind: 'event_cache',
          eventId: event.eventId,
          before,
          after: structuredClone(cache),
        });
        for (const itemId of cache.itemIds) {
          const item = state.economy!.items.find(
            (item) => item.itemId === itemId,
          );
          if (!item) {
            required(`cache:${cache.cacheId}:item:${itemId}`);
            continue;
          }
          const before = item.location;
          item.location = recovered ? 'held' : 'lost';
          result.plan.push({
            kind: 'event_item_location',
            eventId: event.eventId,
            itemId,
            before,
            after: item.location,
          });
        }
      }
      return true;
    }
    case 'invasion': {
      const acknowledgement = receipt();
      if (event.averagePartyLevel === undefined)
        required('average-party-level');
      else if (acknowledgement)
        result.plan.push({
          kind: 'event_encounter',
          eventId: event.eventId,
          averagePartyLevel: event.averagePartyLevel,
          challengeRating: event.averagePartyLevel + 1,
          acknowledgement,
        });
      return true;
    }
    case 'missing_in_action': {
      const team = teamTarget();
      const acknowledgement = receipt();
      if (!team || !acknowledgement) return true;
      if (
        !result.teamUse.usedTeamIds.includes(team.teamId) &&
        !exception('team-operated')
      )
        return true;
      if (twice) {
        const original = result.plan.find(
          (change) =>
            change.kind === 'event_team_status' &&
            change.eventId === firstEventId,
        );
        if (
          original?.kind !== 'event_team_status' ||
          original.teamId !== team.teamId
        ) {
          required('same-team');
          return true;
        }
      }
      status(team, 'missing');
      const sourceId = `${firstEventId}:${team.teamId}`;
      queue({ kind: 'team_unavailable', teamId: team.teamId }, sourceId);
      queue(
        {
          kind: 'team_return',
          teamId: team.teamId,
          status: twice ? 'disabled' : 'active',
        },
        sourceId,
      );
      return true;
    }
    case 'sickness': {
      const team = teamTarget();
      const acknowledgement = receipt();
      if (!team || !acknowledgement) return true;
      if (!twice) {
        status(team, 'disabled');
        return true;
      }
      const original = result.plan.find(
        (change) =>
          change.kind === 'event_team_status' &&
          change.eventId === firstEventId,
      );
      if (
        original?.kind !== 'event_team_status' ||
        original.teamId !== team.teamId
      ) {
        required('same-team');
        return true;
      }
      const total = eventCheck(
        draft,
        result,
        event,
        'loyalty',
        event.rolls?.check,
        `${event.eventId}:sickness`,
      );
      if (total !== null && total < 20) lose(team.teamId);
      return true;
    }
    case 'turncoat': {
      if (!twice) {
        const loss = eventDie(
          result,
          event.rolls?.loss,
          `${event.eventId}:loss`,
          6,
        );
        if (loss !== null) {
          const before = state.training;
          state.training = Math.max(0, state.training - loss - state.rank);
          result.plan.push({
            kind: 'event_training',
            eventId: event.eventId,
            before,
            after: state.training,
          });
        }
        return true;
      }
      const team = teamTarget();
      const acknowledgement = receipt();
      if (!team || !acknowledgement) return true;
      const input = event.officerCheck;
      if (!input) {
        required('officer-check');
        return true;
      }
      if (
        !state.characters.some(
          (character) => character.characterId === input.characterId,
        )
      ) {
        required('officer');
        return true;
      }
      if (
        !state.roster.officers.some(
          (officer) => officer.characterId === input.characterId,
        ) &&
        !exception('officer')
      )
        return true;
      if (input.skill !== 'diplomacy' && !exception('officer-skill'))
        return true;
      const raw = eventDie(
        result,
        input.roll,
        `${event.eventId}:diplomacy`,
        20,
      );
      if (input.skillBonus === undefined) required('skill-bonus');
      if (raw === null || input.skillBonus === undefined) return true;
      const modifiers = new Map(
        (input.roll?.modifiers ?? [])
          .filter(
            (modifier) =>
              !['skill', 'skill-bonus', 'charisma'].includes(modifier.sourceId),
          )
          .map((modifier) => [modifier.sourceId, modifier.value]),
      );
      const total =
        raw +
        input.skillBonus +
        [...modifiers.values()].reduce((sum, value) => sum + value, 0);
      const dc = 10 + state.rank;
      const succeeded = total >= dc;
      result.plan.push({
        kind: 'event_officer_check',
        eventId: event.eventId,
        characterId: input.characterId,
        skill: input.skill,
        total,
        dc,
        succeeded,
      });
      if (succeeded)
        queue(
          { kind: 'team_unavailable', teamId: team.teamId, phase: 'activity' },
          `${firstEventId}:${team.teamId}`,
        );
      else lose(team.teamId);
      return true;
    }
    case 'raid': {
      const targets =
        event.targets?.filter((target) => target.kind === 'settlement') ?? [];
      const town =
        targets.length === 1
          ? state.settlements.find(
              (town) => town.settlementId === targets[0]!.settlementId,
            )
          : undefined;
      if (!town) {
        required('settlement');
        return true;
      }
      const active =
        town.refugeActivatedWeek !== null &&
        town.refugeActiveUntilWeek !== null &&
        town.refugeActivatedWeek <= draft.week &&
        town.refugeActiveUntilWeek >= draft.week;
      if (!active && !exception('event-eligibility')) return true;
      if (!receipt()) return true;
      if (!state.characterActions) {
        required('tracked-people');
        return true;
      }
      const people = state.characterActions.people.filter(
        (person) =>
          person.status === 'hidden' &&
          person.location.kind === 'refuge' &&
          person.location.settlementId === town.settlementId,
      );
      for (const input of event.targetChecks ?? [])
        if (
          input.target.kind !== 'character' ||
          !people.some(
            (person) =>
              input.target.kind === 'character' &&
              person.characterId === input.target.characterId,
          )
        )
          required('mitigation-target');
      const before = town.refugeActiveUntilWeek;
      town.refugeActivatedWeek = null;
      town.refugeActiveUntilWeek = null;
      result.plan.push({
        kind: 'event_refuge',
        eventId: event.eventId,
        settlementId: town.settlementId,
        before,
        after: null,
      });
      for (const person of people) {
        const target = {
          kind: 'character' as const,
          characterId: person.characterId,
        };
        const mitigated = mitigate(target, 'security', 20);
        if (mitigated === null) continue;
        const chance = mitigated ? 50 : 100;
        const input = event.targetChecks?.find(
          (input) =>
            input.target.kind === 'character' &&
            input.target.characterId === person.characterId,
        );
        const captureRoll = mitigated
          ? eventDie(
              result,
              input?.rolls?.loss,
              `${event.eventId}:${person.characterId}:capture`,
              100,
            )
          : null;
        if (mitigated && captureRoll === null) continue;
        const captured = chance === 100 || captureRoll! <= chance;
        result.plan.push({
          kind: 'event_capture',
          eventId: event.eventId,
          characterId: person.characterId,
          chance,
          roll: captureRoll,
          captured,
        });
        if (captured) {
          const before = structuredClone(person);
          person.status = 'captured';
          person.capture = { source: 'raid', week: draft.week };
          person.directRescueRequired = false;
          result.plan.push({
            kind: 'event_person',
            eventId: event.eventId,
            before,
            after: structuredClone(person),
          });
        }
      }
      return true;
    }
    default:
      return false;
  }
}

export function finishEventTeamReturns(
  draft: WeeklyDraft,
  result: EventOutcomeProjection,
) {
  for (const queued of draft.context.queuedEffects) {
    if (
      queued.effect.kind !== 'team_return' ||
      queued.startsWeek > draft.week ||
      queued.endsWeek < draft.week
    )
      continue;
    const team = result.outcome.roster.teams.find(
      (team) =>
        queued.effect.kind === 'team_return' &&
        team.teamId === queued.effect.teamId,
    );
    if (team?.status !== 'missing') continue;
    if (
      result.queuedEffects.some(
        (effect) =>
          effect.effect.kind === 'team_return' &&
          effect.effect.teamId === team.teamId &&
          effect.startsWeek > draft.week,
      )
    )
      continue;
    const before = team.status;
    team.status = queued.effect.status;
    result.plan.push({
      kind: 'event_team_status',
      eventId: queued.sourceId,
      teamId: team.teamId,
      before,
      after: team.status,
    });
  }
}
