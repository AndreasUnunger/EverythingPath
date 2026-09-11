import {
  projectPersistentWeek,
  preparePersistentSuccessor,
} from './rules-persistent-events';
import { actionChoiceEvents } from './weekly-draft-facts';
import {
  weeklyDraftSchema,
  weekStartFactsSchema,
  type WeeklyDraft,
} from './weekly-draft-contract';
import {
  reviewedWeeklySourceSchema,
  weeklySourceKey,
  type ReviewedWeeklySource,
  type CanonicalWeekState,
} from './canonical-weekly-source';
import {
  canonicalResolutionRecordSchema,
  resolutionArtifactSchema,
} from './canonical-resolution-record';
import type { UpkeepSnapshot } from './rules-upkeep';

export const CANONICAL_WEEKLY_RULESET_VERSION = 2;
type Phases = ReturnType<typeof projectPersistentWeek>;
export type CanonicalResolutionEffects = {
  upkeep: Phases['upkeep']['plan'];
  activity: Phases['activity']['plan'];
  event: Phases['event']['plan'];
  sabotage: Phases['event']['sabotage'];
  persistent: Phases['persistent']['plan'];
  adjudication: Pick<
    WeeklyDraft,
    'acknowledgements' | 'rulesExceptions' | 'tableAdjustments'
  >;
};
// A complete, typed replacement is the write plan. The accompanying ordered
// effects explain it; persistence must never replay their arithmetic as well.
export type CanonicalResolutionPlan = {
  before: CanonicalWeekState;
  after: CanonicalWeekState;
  effects: CanonicalResolutionEffects;
};
export type CanonicalResolutionPreview = {
  status: 'ready' | 'incomplete';
  rulesetVersion: number;
  sourceKey: string;
  source: ReviewedWeeklySource | null;
  requirements: string[];
  warnings: string[];
  phases: Phases | null;
  baseline: CanonicalWeekState | null;
  outcome: CanonicalWeekState | null;
  baselinePlan: CanonicalResolutionPlan | null;
  finalPlan: CanonicalResolutionPlan | null;
};

export function projectWeeklyDraft(input: {
  revision: WeeklyDraft;
  militiaSnapshot: UpkeepSnapshot;
}): CanonicalResolutionPreview {
  const parsed = reviewedWeeklySourceSchema.safeParse(input);
  if (!parsed.success)
    return {
      status: 'incomplete',
      rulesetVersion: CANONICAL_WEEKLY_RULESET_VERSION,
      sourceKey: '',
      source: null,
      requirements: parsed.error.issues.map(
        (issue) => `${issue.path.join('.')}:${issue.message}`,
      ),
      warnings: [],
      phases: null,
      baseline: null,
      outcome: null,
      baselinePlan: null,
      finalPlan: null,
    };
  const source = parsed.data;
  const draft = weeklyDraftSchema.parse(source.revision);
  const phases = projectPersistentWeek(draft, source.militiaSnapshot);
  const requirements = referenceRequirements(
    draft,
    source.militiaSnapshot,
    phases.persistent.outcome,
  );
  requirements.push(
    ...phases.upkeep.requirements,
    ...phases.activity.requirements,
    ...phases.event.requirements,
    ...phases.persistent.requirements,
  );
  const warnings = [
    ...new Set([
      ...phases.upkeep.warnings,
      ...phases.activity.warnings,
      ...phases.event.warnings,
      ...phases.persistent.warnings,
    ]),
  ];
  const before: CanonicalWeekState = {
    week: draft.week,
    militiaSnapshot: structuredClone(source.militiaSnapshot),
    context: weekStartFactsSchema.strip().parse(draft.context),
  };
  // A partial forecast retains all known outcomes without pretending an unknown
  // carry or incomplete week is a confirmable successor.
  const prepared =
    phases.ready && phases.event.nextUneventfulCarry !== null
      ? preparePersistentSuccessor(draft, phases.event, phases.persistent)
      : null;
  const baseline: CanonicalWeekState = prepared
    ? {
        week: prepared.week,
        context: prepared.context,
        militiaSnapshot: prepared.outcome,
      }
    : {
        week: draft.week,
        militiaSnapshot: structuredClone(phases.persistent.outcome),
        context: weekStartFactsSchema.parse({
          ...before.context,
          carriedEvents: structuredClone(phases.persistent.persistentEvents),
          queuedEffects: structuredClone(phases.persistent.queuedEffects),
          lastBuyoffWeek: phases.persistent.lastBuyoffWeek,
        }),
      };
  const outcome = structuredClone(baseline);
  applyAdjustments(draft, outcome, requirements, warnings);
  const effects: CanonicalResolutionEffects = {
    upkeep: phases.upkeep.plan,
    activity: phases.activity.plan,
    event: phases.event.plan,
    sabotage: phases.event.sabotage,
    persistent: phases.persistent.plan,
    adjudication: {
      acknowledgements: structuredClone(draft.acknowledgements),
      rulesExceptions: structuredClone(draft.rulesExceptions),
      tableAdjustments: [],
    },
  };
  const ready = phases.ready && prepared !== null && requirements.length === 0;
  return {
    status: ready ? 'ready' : 'incomplete',
    rulesetVersion: CANONICAL_WEEKLY_RULESET_VERSION,
    sourceKey: weeklySourceKey(source),
    source,
    requirements: [...new Set(requirements)],
    warnings,
    phases,
    baseline,
    outcome,
    baselinePlan: ready ? { before, after: baseline, effects } : null,
    finalPlan: ready
      ? {
          before: structuredClone(before),
          after: outcome,
          effects: {
            ...structuredClone(effects),
            adjudication: {
              ...structuredClone(effects.adjudication),
              tableAdjustments: structuredClone(draft.tableAdjustments),
            },
          },
        }
      : null,
  };
}

function applyAdjustments(
  draft: WeeklyDraft,
  outcome: CanonicalWeekState,
  requirements: string[],
  warnings: string[],
) {
  for (const adjustment of draft.tableAdjustments) {
    warnings.push(`adjustment:${adjustment.adjustmentId}:${adjustment.reason}`);
    const state = outcome.militiaSnapshot;
    if (adjustment.kind === 'militia_value') {
      state[adjustment.field] =
        adjustment.operation === 'set'
          ? adjustment.value
          : state[adjustment.field] + adjustment.value;
      if (!Number.isSafeInteger(state[adjustment.field]))
        requirements.push(
          `adjustment:${adjustment.adjustmentId}:numeric-overflow`,
        );
    } else if (adjustment.kind === 'team_status') {
      const team = state.roster.teams.find(
        (team) => team.teamId === adjustment.teamId,
      );
      if (team) team.status = adjustment.status;
      else requirements.push(`adjustment:${adjustment.adjustmentId}:team`);
    } else if (adjustment.kind === 'settlement_reputation') {
      const settlement = state.settlements.find(
        (entry) => entry.settlementId === adjustment.settlementId,
      );
      if (settlement) settlement.reputation = adjustment.reputation;
      else
        requirements.push(`adjustment:${adjustment.adjustmentId}:settlement`);
    } else {
      const known = outcome.context.carriedEvents.some(
        (event) => event.eventId === adjustment.eventId,
      );
      if (!known) {
        requirements.push(`adjustment:${adjustment.adjustmentId}:event`);
        continue;
      }
      outcome.context.carriedEvents = outcome.context.carriedEvents.filter(
        (event) => event.eventId !== adjustment.eventId,
      );
      outcome.context.queuedEffects = outcome.context.queuedEffects.filter(
        (effect) => effect.sourceId !== adjustment.eventId,
      );
    }
  }
}

function referenceRequirements(
  draft: WeeklyDraft,
  before: UpkeepSnapshot,
  after: UpkeepSnapshot,
) {
  const requirements: string[] = [];
  const choices = draft.activity.slots.flatMap((slot) =>
    slot.choice ? [slot.choice] : [],
  );
  const events = [
    ...draft.context.carriedEvents,
    ...draft.event.occurrences,
    ...choices.flatMap(actionChoiceEvents),
  ];
  const teams = new Set(
    [...before.roster.teams, ...after.roster.teams].map((x) => x.teamId),
  );
  const characters = new Set(before.characters.map((x) => x.characterId));
  const settlements = new Set(before.settlements.map((x) => x.settlementId));
  const items = new Set(
    [...(before.economy?.items ?? []), ...(after.economy?.items ?? [])].map(
      (x) => x.itemId,
    ),
  );
  const caches = new Set(
    [...(before.economy?.caches ?? []), ...(after.economy?.caches ?? [])].map(
      (x) => x.cacheId,
    ),
  );
  const eventIds = new Set(events.map((x) => x.eventId));
  const check = (value: string | undefined, ids: Set<string>, path: string) => {
    if (value !== undefined && !ids.has(value))
      requirements.push(`${path}:reference`);
  };
  check(
    draft.activity.operatingSettlementId,
    settlements,
    'activity:operating-settlement',
  );
  check(
    draft.upkeep.nearestSettlementId,
    settlements,
    'upkeep:nearest-settlement',
  );
  for (const order of draft.context.orders) {
    check(order.itemId, items, `order:${order.orderId}:item`);
    check(order.settlementId, settlements, `order:${order.orderId}:settlement`);
  }
  for (const effect of draft.context.queuedEffects)
    if ('teamId' in effect.effect)
      check(effect.effect.teamId, teams, `queue:${effect.effectId}:team`);
  for (const transfer of draft.upkeep.treasuryTransfers)
    check(
      transfer.characterId,
      characters,
      `transfer:${transfer.transferId}:character`,
    );
  for (const decision of draft.upkeep.teamDecisions)
    check(decision.teamId, teams, `team:${decision.teamId}`);
  for (const choice of choices) {
    check(choice.teamId, teams, `${choice.choiceId}:team`);
    if ('targetTeamId' in choice)
      check(choice.targetTeamId, teams, `${choice.choiceId}:target-team`);
    if ('characterId' in choice)
      check(choice.characterId, characters, `${choice.choiceId}:character`);
    if ('chooserCharacterId' in choice)
      check(
        choice.chooserCharacterId,
        characters,
        `${choice.choiceId}:chooser`,
      );
    if ('settlementId' in choice)
      check(choice.settlementId, settlements, `${choice.choiceId}:settlement`);
  }
  for (const event of events)
    for (const target of event.targets ?? []) {
      const [value, ids] =
        target.kind === 'team'
          ? ([target.teamId, teams] as const)
          : target.kind === 'character'
            ? ([target.characterId, characters] as const)
            : target.kind === 'settlement'
              ? ([target.settlementId, settlements] as const)
              : target.kind === 'item'
                ? ([target.itemId, items] as const)
                : target.kind === 'cache'
                  ? ([target.cacheId, caches] as const)
                  : ([target.eventId, eventIds] as const);
      check(value, ids, `event:${event.eventId}:${target.kind}`);
    }
  return requirements;
}

export function resolveCanonicalWeeklyDraft(
  input: Parameters<typeof projectWeeklyDraft>[0],
) {
  const preview = projectWeeklyDraft(input);
  if (
    preview.status !== 'ready' ||
    !preview.finalPlan ||
    !preview.baselinePlan ||
    !preview.source
  )
    throw new Error(
      `Weekly Resolution is incomplete: ${preview.requirements.join(', ')}`,
    );
  return {
    ...preview,
    source: preview.source,
    baselinePlan: preview.baselinePlan,
    finalPlan: preview.finalPlan,
  };
}

// Re-evaluate only on the authority side from its current source, and compare the
// complete reviewed facts. A caller-supplied preview or plan is never authority.
export function resolveReviewedWeeklyDraft(
  input: Parameters<typeof projectWeeklyDraft>[0],
  reviewedSourceKey: string,
) {
  const result = resolveCanonicalWeeklyDraft(input);
  if (result.sourceKey !== reviewedSourceKey)
    throw new Error('Reviewed weekly source changed');
  return result;
}

export function applyCanonicalResolutionPlan(
  state: CanonicalWeekState,
  plan: CanonicalResolutionPlan,
) {
  if (weeklySourceKey(state) !== weeklySourceKey(plan.before))
    throw new Error('Weekly source state changed');
  return structuredClone(plan.after);
}

export function prepareCanonicalResolutionRecord(
  result: ReturnType<typeof resolveCanonicalWeeklyDraft>,
  recordId: string,
) {
  const artifact = (data: unknown) =>
    resolutionArtifactSchema.parse({
      formatVersion: 2,
      data: JSON.parse(JSON.stringify(data)) as unknown,
    });
  return canonicalResolutionRecordSchema.parse({
    recordId,
    provenance: 'confirmation',
    source: result.source.revision,
    sourceMilitiaSnapshot: result.source.militiaSnapshot,
    rulesetVersion: result.rulesetVersion,
    baselinePlan: artifact(result.baselinePlan),
    finalPlan: artifact(result.finalPlan),
    finalOutcome: artifact(result.finalPlan.after),
    adjudication: result.finalPlan.effects.adjudication,
    warnings: result.warnings.map((message) => ({
      code: message.split(':')[0]!,
      message,
    })),
    successorContext: result.finalPlan.after.context,
    supersedesRecordId: null,
  });
}
