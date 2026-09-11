import {
  actionChoiceEvents,
  persistentEventSchema,
} from './weekly-draft-facts';
import {
  getMinimumTreasuryForRank,
  getAdvancementForRank,
} from './militia-progression-rules';
import { eventCheck, eventDie } from './rules-event-checks';
import {
  projectActivityAndEvents,
  type EventOutcomeProjection,
} from './rules-event-outcomes';
import { projectUpkeep, type UpkeepSnapshot } from './rules-upkeep';
import { operatedSettlementIds } from './rules-event-context';
import { createWeeklyDraft } from './weekly-draft';
import type { WeeklyDraft, WeekStartFacts } from './weekly-draft-contract';

type Decision = WeeklyDraft['persistent']['decisions'][number];
export type PersistentChange =
  | { kind: 'upkeep_team_return'; teamId: string; status: 'active' }
  | { kind: 'persistent_retained'; eventId: string }
  | {
      kind: 'persistent_ended';
      eventId: string;
      reason: 'buyoff' | 'officer' | 'recorded';
      acknowledgement?: Extract<Decision, { kind: 'end' }>['acknowledgement'];
    }
  | {
      kind: 'persistent_buyoff';
      eventId: string;
      costCopper: number;
      before: number;
      after: number;
    }
  | {
      kind: 'persistent_mitigation';
      eventId: string;
      week: number;
      succeeded: boolean;
      total: number;
      dc: number;
    }
  | {
      kind: 'persistent_officer_check';
      eventId: string;
      characterId: string;
      skill: string;
      total: number;
      dc: number;
      succeeded: boolean;
    };

// This is a projection of staged decisions; it never mutates a campaign or the
// fixed week-start eligibility. Each decision observes older resolved instances.
export function projectPersistentEvents(
  draft: WeeklyDraft,
  event: EventOutcomeProjection,
) {
  const state = structuredClone(event);
  const plan: PersistentChange[] = [];
  const requirements: string[] = [];
  const warnings: string[] = [];
  let lastBuyoffWeek = draft.context.lastBuyoffWeek;
  const ordered = [...state.persistentEvents].sort(
    (a, b) =>
      a.startedWeek - b.startedWeek ||
      a.order - b.order ||
      a.eventId.localeCompare(b.eventId),
  );
  const decisions = [
    ...draft.persistent.decisions,
    ...draft.event.occurrences.flatMap((entry) =>
      entry.persistentDecision ? [entry.persistentDecision] : [],
    ),
    ...draft.activity.slots.flatMap((slot) =>
      actionChoiceEvents(slot.choice).flatMap((entry) =>
        entry.persistentDecision ? [entry.persistentDecision] : [],
      ),
    ),
  ];
  const required = (id: string, key: string) =>
    requirements.push(`${id}:${key}`);
  function exception(id: string, rule: string) {
    warnings.push(`${id}:${rule}`);
    const accepted = draft.rulesExceptions.some(
      (entry) =>
        entry.subjectId === id && entry.ruleId === rule && entry.reason.trim(),
    );
    if (!accepted) required(id, `${rule}:exception`);
    return accepted;
  }
  function end(
    id: string,
    reason: 'buyoff' | 'officer' | 'recorded',
    acknowledgement?: Extract<Decision, { kind: 'end' }>['acknowledgement'],
  ) {
    state.persistentEvents = state.persistentEvents.filter(
      (entry) => entry.eventId !== id,
    );
    state.queuedEffects = state.queuedEffects.filter(
      (entry) => entry.sourceId !== id,
    );
    state.endedEventIds.push(id);
    plan.push({
      kind: 'persistent_ended',
      eventId: id,
      reason,
      ...(acknowledgement ? { acknowledgement } : {}),
    });
  }
  for (const decision of decisions) {
    if (
      !ordered.some((entry) => entry.eventId === decision.eventId) &&
      !state.endedEventIds.includes(decision.eventId)
    )
      required(decision.eventId, 'persistent-event');
    if (
      decisions.filter((entry) => entry.eventId === decision.eventId).length > 1
    )
      required(decision.eventId, 'duplicate-decision');
  }
  for (const current of ordered) {
    const decision = decisions.find(
      (entry) => entry.eventId === current.eventId,
    );
    const id = current.eventId;
    if (current.eventType === 'rivalry') {
      const targets = current.targets.filter(
        (target) => target.kind === 'team',
      );
      if (
        targets.length !== 2 ||
        new Set(targets.map((target) => target.teamId)).size !== 2 ||
        targets.some(
          (target) =>
            !state.outcome.roster.teams.some(
              (team) => team.teamId === target.teamId,
            ),
        )
      ) {
        required(id, 'teams');
        continue;
      }
    }
    if (!decision || decision.kind === 'unattempted') {
      plan.push({ kind: 'persistent_retained', eventId: id });
      continue;
    }
    if (
      !draft.context.persistentPhaseEligible &&
      !exception(id, 'persistent-phase')
    )
      continue;
    if (decision.kind === 'buyoff') {
      if (!getAdvancementForRank(state.outcome.rank)) {
        required(id, 'rank');
        continue;
      }
      const costCopper =
        2 * getMinimumTreasuryForRank(state.outcome.rank) * 100;
      let permitted = true;
      if (lastBuyoffWeek !== null && draft.week < lastBuyoffWeek + 4)
        permitted = exception(id, 'buyoff-cooldown') && permitted;
      if (state.outcome.treasuryCopper < costCopper)
        permitted = exception(id, 'treasury') && permitted;
      if (
        decision.costCopper !== undefined &&
        decision.costCopper !== costCopper
      )
        warnings.push(`${id}:buyoff-cost-recomputed`);
      if (!permitted) continue;
      const before = state.outcome.treasuryCopper;
      state.outcome.treasuryCopper -= costCopper;
      plan.push({
        kind: 'persistent_buyoff',
        eventId: id,
        costCopper,
        before,
        after: state.outcome.treasuryCopper,
      });
      lastBuyoffWeek = draft.week;
      end(id, 'buyoff');
      continue;
    }
    if (decision.kind === 'end') {
      if (
        decision.acknowledgement.subjectId !== id ||
        !decision.acknowledgement.outcome.trim()
      ) {
        required(id, 'ending-acknowledgement');
        continue;
      }
      if (exception(id, 'persistent-ending'))
        end(id, 'recorded', decision.acknowledgement);
      continue;
    }
    if (current.eventType === 'rivalry') {
      const input = decision.officerCheck;
      if (!input) {
        required(id, 'officer-check');
        continue;
      }
      if (
        !state.outcome.characters.some(
          (character) => character.characterId === input.characterId,
        )
      ) {
        required(id, 'officer');
        continue;
      }
      if (
        !state.outcome.roster.officers.some(
          (officer) => officer.characterId === input.characterId,
        ) &&
        !exception(id, 'officer-assignment')
      )
        continue;
      const die = eventDie(state, input.roll, `${id}:officer`, 20);
      if (input.skillBonus === undefined) required(id, 'skill-bonus');
      if (die === null || input.skillBonus === undefined) continue;
      const extras = new Map(
        (input.roll?.modifiers ?? [])
          .filter(
            (modifier) =>
              !['skill', 'skill-bonus', 'charisma', input.characterId].includes(
                modifier.sourceId,
              ),
          )
          .map((modifier) => [modifier.sourceId, modifier.value]),
      );
      const total =
        die +
        input.skillBonus +
        [...extras.values()].reduce((sum, value) => sum + value, 0);
      plan.push({
        kind: 'persistent_officer_check',
        eventId: id,
        characterId: input.characterId,
        skill: input.skill,
        total,
        dc: 20,
        succeeded: total >= 20,
      });
      if (total >= 20) end(id, 'officer');
    } else if (current.eventType === 'theft') {
      const total = eventCheck(
        draft,
        state,
        {
          eventId: id,
          eventType: 'theft',
          origin: { kind: 'rolled' },
          overseerCharacterId: decision.overseerCharacterId,
        },
        'loyalty',
        decision.rolls?.check,
        `${id}:mitigation`,
        'persistent',
      );
      if (total === null) continue;
      plan.push({
        kind: 'persistent_mitigation',
        eventId: id,
        week: draft.week,
        total,
        dc: 20,
        succeeded: total >= 20,
      });
      state.persistentEvents = state.persistentEvents.map((entry) => {
        if (entry.eventId !== id) return entry;
        const copy = persistentEventSchema.parse(entry);
        if (total >= 20)
          copy.mitigation = { week: draft.week, retainedIncomePercent: 90 };
        else delete copy.mitigation;
        return copy;
      });
    } else {
      // These events prescribe no repeatable mitigation roll. Narrative ending
      // remains explicit via the reasoned ending decision, never a guessed DC.
      required(id, 'no-mitigation-rule');
    }
  }
  requirements.push(...state.requirements);
  warnings.push(...state.warnings);
  return {
    ready: requirements.length === 0,
    eligible: draft.context.persistentPhaseEligible,
    requirements: [...new Set(requirements)],
    warnings: [...new Set(warnings)],
    plan,
    outcome: state.outcome,
    persistentEvents: state.persistentEvents.sort(
      (a, b) =>
        a.startedWeek - b.startedWeek ||
        a.order - b.order ||
        a.eventId.localeCompare(b.eventId),
    ),
    endedEventIds: [...new Set(state.endedEventIds)],
    queuedEffects: state.queuedEffects,
    lastBuyoffWeek,
    nextBuyoffWeek: lastBuyoffWeek === null ? draft.week : lastBuyoffWeek + 4,
    buyoffCostCopper: 2 * getMinimumTreasuryForRank(state.outcome.rank) * 100,
    checks: state.checks,
    checkUsage: state.checkUsage,
  };
}

// Temporary Theft mitigation is a fact for this whole week's incoming gains.
// Recompute from source, not by refunding an earlier projected loss. An unstable
// feedback loop stays incomplete instead of selecting an arbitrary outcome.
export function projectPersistentWeek(
  draft: WeeklyDraft,
  snapshot: UpkeepSnapshot,
) {
  let mitigatedIds: string[] = [];
  const seen = new Set<string>();
  for (;;) {
    const key = mitigatedIds.join('|');
    seen.add(key);
    const prepared: WeeklyDraft = {
      ...draft,
      context: {
        ...draft.context,
        carriedEvents: draft.context.carriedEvents.map((entry) => {
          const copied = persistentEventSchema.parse(entry);
          if (mitigatedIds.includes(entry.eventId))
            copied.mitigation = { week: draft.week, retainedIncomePercent: 90 };
          return copied;
        }),
      },
    };
    const upkeep = projectUpkeep(prepared, snapshot);
    const { activity, event } = projectActivityAndEvents(
      prepared,
      upkeep.outcome,
    );
    const persistent = projectPersistentEvents(prepared, event);
    persistent.requirements = [
      ...new Set([...upkeep.requirements, ...persistent.requirements]),
    ];
    persistent.warnings = [
      ...new Set([...upkeep.warnings, ...persistent.warnings]),
    ];
    persistent.ready = persistent.requirements.length === 0;
    for (const change of upkeep.plan) {
      if (change.kind !== 'team_status' || change.timing !== 'end') continue;
      const team = persistent.outcome.roster.teams.find(
        (entry) => entry.teamId === change.teamId,
      );
      const replaced = event.plan.some(
        (entry) =>
          entry.kind === 'event_team_status' && entry.teamId === change.teamId,
      );
      if (team?.status === 'missing' && !replaced) {
        team.status = 'active';
        persistent.plan.push({
          kind: 'upkeep_team_return',
          teamId: team.teamId,
          status: 'active',
        });
      }
    }
    const next = persistent.plan
      .flatMap((change) =>
        change.kind === 'persistent_mitigation' && change.succeeded
          ? [change.eventId]
          : [],
      )
      .sort();
    if (next.join('|') === key)
      return {
        upkeep,
        activity,
        event,
        persistent,
        ready:
          upkeep.ready && activity.ready && event.ready && persistent.ready,
      };
    if (seen.has(next.join('|'))) {
      persistent.requirements.push('persistent:mitigation-cycle');
      persistent.ready = false;
      return { upkeep, activity, event, persistent, ready: false };
    }
    mitigatedIds = next;
  }
}

export function preparePersistentSuccessor(
  draft: WeeklyDraft,
  event: EventOutcomeProjection,
  persistent: ReturnType<typeof projectPersistentEvents>,
) {
  if (!persistent.ready || event.nextUneventfulCarry === null)
    throw new Error('Persistent successor requires a ready projection');
  const week = draft.week + 1;
  const context: WeekStartFacts = {
    firstMilitiaWeek: false,
    startDay: draft.context.startDay + 7,
    uneventfulCarry: event.nextUneventfulCarry,
    carriedEvents: persistent.persistentEvents.map((entry) => {
      const copy = persistentEventSchema.parse(entry);
      delete copy.mitigation;
      return copy;
    }),
    queuedEffects: persistent.queuedEffects
      .filter((effect) => effect.endsWeek >= week)
      .map((effect) => structuredClone(effect)),
    orders: [
      ...new Map([
        ...draft.context.orders.map(
          (order) => [order.orderId, structuredClone(order)] as const,
        ),
        ...(persistent.outcome.economy?.orders ?? []).flatMap((order) =>
          order.dueDay === null
            ? []
            : [
                [
                  order.orderId,
                  {
                    orderId: order.orderId,
                    itemId: order.itemId,
                    settlementId: order.settlementId,
                    orderedDay: order.orderedDay,
                    dueDay: order.dueDay,
                    priceCopper: order.priceCopper,
                    receipt: structuredClone(order.receipt),
                  },
                ] as const,
              ],
        ),
      ]).values(),
    ],
    lastBuyoffWeek: persistent.lastBuyoffWeek,
    operatedSettlementIds: operatedSettlementIds(draft, event),
  };
  const outcome = structuredClone(persistent.outcome);
  if (outcome.eventBenefits) {
    outcome.eventBenefits.skills = outcome.eventBenefits.skills.filter(
      (benefit) => benefit.endsWeek >= week,
    );
    outcome.eventBenefits.markets = outcome.eventBenefits.markets.filter(
      (benefit) => benefit.endsWeek >= week,
    );
  }
  return { week, context, outcome };
}

export function createPersistentSuccessor(
  draft: WeeklyDraft,
  event: EventOutcomeProjection,
  persistent: ReturnType<typeof projectPersistentEvents>,
  draftId: string,
  slotIds: string[],
) {
  const prepared = preparePersistentSuccessor(draft, event, persistent);
  return {
    ...prepared,
    draft: createWeeklyDraft({
      draftId,
      week: prepared.week,
      context: prepared.context,
      slotIds,
    }),
  };
}
