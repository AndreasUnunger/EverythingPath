import type { UpkeepSnapshot } from './rules-upkeep';
import type { WeeklyDraft } from './weekly-draft-contract';
import { actionChoiceEvents } from './weekly-draft-facts';
import {
  draftReferenceIssues,
  type DraftReferenceIssue,
  type ReferenceKind,
} from './weekly-draft-references';

// Which choices of the open week refer to identities a militia source lacks,
// located by the choice a player repairs: an Activity slot by position, an
// Upkeep decision, an Event occurrence, a Persistent decision or a Table
// Adjustment. Carried context (carried events, queued effects, orders and
// operated settlements) is read-only here: a correction may not break it.

export type StagedChoicePhase =
  | 'upkeep'
  | 'activity'
  | 'event'
  | 'persistent'
  | 'summary';

export type ChoiceLocation =
  | { kind: 'upkeepTeam'; teamId: string }
  | { kind: 'nearestSettlement' }
  | {
      kind: 'activitySlot';
      slotId: string;
      /** 1-based position on the Activity board. */
      position: number;
      actionId: string;
    }
  | { kind: 'operatingSettlement' }
  | { kind: 'consumables' }
  | { kind: 'event'; eventId: string; eventType: string | null }
  | { kind: 'persistentDecision'; eventId: string; eventType: string | null }
  | { kind: 'tableAdjustment'; adjustmentId: string }
  | { kind: 'carriedEvent'; eventId: string; eventType: string | null }
  | { kind: 'queuedEffect'; effectId: string }
  | { kind: 'order'; orderId: string }
  | { kind: 'operatedSettlements' };

/** An identity a choice refers to that the source lacks. */
export type MissingReference = { kind: ReferenceKind; id: string };

export type StagedReference = {
  /** Stable identity of the choice, for keys and comparisons. */
  key: string;
  location: ChoiceLocation;
  /** The phase that repairs it; null for read-only carried context. */
  phase: StagedChoicePhase | null;
  missing: MissingReference[];
};

const phaseOf: Record<ChoiceLocation['kind'], StagedChoicePhase | null> = {
  upkeepTeam: 'upkeep',
  nearestSettlement: 'upkeep',
  activitySlot: 'activity',
  operatingSettlement: 'activity',
  consumables: 'activity',
  event: 'event',
  persistentDecision: 'persistent',
  tableAdjustment: 'summary',
  carriedEvent: null,
  queuedEffect: null,
  order: null,
  operatedSettlements: null,
};

function locationKey(location: ChoiceLocation) {
  switch (location.kind) {
    case 'upkeepTeam':
      return `upkeepTeam:${location.teamId}`;
    case 'activitySlot':
      return `activitySlot:${location.slotId}`;
    case 'event':
    case 'persistentDecision':
    case 'carriedEvent':
      return `${location.kind}:${location.eventId}`;
    case 'tableAdjustment':
      return `tableAdjustment:${location.adjustmentId}`;
    case 'queuedEffect':
      return `queuedEffect:${location.effectId}`;
    case 'order':
      return `order:${location.orderId}`;
    default:
      return location.kind;
  }
}

// Reference paths name their owner by prefix (see
// `draftReferenceRequirements`); owners are matched by their full identity so
// an identity containing ':' still locates correctly.
function locator(draft: WeeklyDraft) {
  const slots = draft.activity.slots.flatMap((slot, index) =>
    slot.choice ? [{ slot, position: index + 1, choice: slot.choice }] : [],
  );
  const slotLocation = ({
    slot,
    position,
    choice,
  }: (typeof slots)[number]): ChoiceLocation => ({
    kind: 'activitySlot',
    slotId: slot.slotId,
    position,
    actionId: choice.actionId,
  });
  const events = new Map<string, ChoiceLocation>();
  for (const event of draft.context.carriedEvents)
    events.set(event.eventId, {
      kind: 'carriedEvent',
      eventId: event.eventId,
      eventType: event.eventType,
    });
  for (const event of draft.event.occurrences)
    events.set(event.eventId, {
      kind: 'event',
      eventId: event.eventId,
      eventType: event.eventType ?? null,
    });
  // Events an Activity action produced are repaired in that slot.
  for (const entry of slots)
    for (const event of actionChoiceEvents(entry.choice))
      events.set(event.eventId, slotLocation(entry));
  const eventType = (eventId: string) => {
    const event = events.get(eventId);
    return event && 'eventType' in event ? event.eventType : null;
  };
  const prefixed = <T>(
    path: string,
    owner: string,
    items: readonly T[],
    id: (item: T) => string,
  ) => items.find((item) => path.startsWith(`${owner}:${id(item)}:`));

  return (path: string): ChoiceLocation | null => {
    if (path === 'upkeep:nearest-settlement')
      return { kind: 'nearestSettlement' };
    if (path === 'activity:operating-settlement')
      return { kind: 'operatingSettlement' };
    if (path.startsWith('activity:consumable:')) return { kind: 'consumables' };
    if (path.startsWith('context:operated-settlement:'))
      return { kind: 'operatedSettlements' };
    const decision = draft.upkeep.teamDecisions.find(
      (item) => path === `team:${item.teamId}`,
    );
    if (decision) return { kind: 'upkeepTeam', teamId: decision.teamId };
    const order = prefixed(
      path,
      'order',
      draft.context.orders,
      (x) => x.orderId,
    );
    if (order) return { kind: 'order', orderId: order.orderId };
    const effect = prefixed(
      path,
      'queue',
      draft.context.queuedEffects,
      (x) => x.effectId,
    );
    if (effect) return { kind: 'queuedEffect', effectId: effect.effectId };
    const adjustment = prefixed(
      path,
      'adjustment',
      draft.tableAdjustments,
      (x) => x.adjustmentId,
    );
    if (adjustment)
      return {
        kind: 'tableAdjustment',
        adjustmentId: adjustment.adjustmentId,
      };
    const persistent = prefixed(
      path,
      'decision',
      draft.persistent.decisions,
      (x) => x.eventId,
    );
    if (persistent)
      return {
        kind: 'persistentDecision',
        eventId: persistent.eventId,
        eventType: eventType(persistent.eventId),
      };
    // An event's own references and the persistent decision nested in it.
    for (const owner of ['event', 'decision'])
      for (const [eventId, location] of events)
        if (path.startsWith(`${owner}:${eventId}:`)) return location;
    const slot = slots.find(({ choice }) =>
      path.startsWith(`${choice.choiceId}:`),
    );
    return slot ? slotLocation(slot) : null;
  };
}

function group(
  draft: WeeklyDraft,
  issues: readonly DraftReferenceIssue[],
): StagedReference[] {
  const locate = locator(draft);
  const grouped = new Map<string, StagedReference>();
  for (const issue of issues) {
    const location = locate(issue.path);
    if (!location) continue;
    const key = locationKey(location);
    const entry = grouped.get(key) ?? {
      key,
      location,
      phase: phaseOf[location.kind],
      missing: [],
    };
    if (
      !entry.missing.some(
        (item) => item.kind === issue.kind && item.id === issue.id,
      )
    )
      entry.missing.push({ kind: issue.kind, id: issue.id });
    grouped.set(key, entry);
  }
  // Week order: phase by phase, Activity slots by position.
  const rank = (reference: StagedReference) =>
    reference.phase === null
      ? phaseOrder.length
      : phaseOrder.indexOf(reference.phase);
  const position = ({ location }: StagedReference) =>
    location.kind === 'activitySlot' ? location.position : 0;
  return [...grouped.values()].sort(
    (a, b) => rank(a) - rank(b) || position(a) - position(b),
  );
}
const phaseOrder: StagedChoicePhase[] = [
  'upkeep',
  'activity',
  'event',
  'persistent',
  'summary',
];

/**
 * The open week's choices that refer to identities `source` lacks. The
 * source is passed as both sides of `draftReferenceIssues`, so an identity a
 * correction removed is missing even if an earlier source still had it.
 */
export function stagedReferences(
  draft: WeeklyDraft,
  source: UpkeepSnapshot,
): StagedReference[] {
  return group(draft, draftReferenceIssues(draft, source, source));
}

const sameMissing = (left: MissingReference, right: MissingReference) =>
  left.kind === right.kind && left.id === right.id;

export type CorrectionImpact = {
  /** Staged choices the correction newly leaves without their subject. */
  added: StagedReference[];
  /** Staged choices already missing a subject before the correction. */
  existing: StagedReference[];
  /** Carried context the correction breaks: it cannot be saved. */
  carried: StagedReference[];
};

/**
 * What a correction from `current` to `candidate` does to the open week:
 * the choices it newly breaks, naming only the identities it removes, apart
 * from choices that were already broken.
 */
export function correctionImpact(
  draft: WeeklyDraft,
  current: UpkeepSnapshot,
  candidate: UpkeepSnapshot,
): CorrectionImpact {
  const before = stagedReferences(draft, current);
  const after = stagedReferences(draft, candidate);
  const added: StagedReference[] = [];
  const carried: StagedReference[] = [];
  for (const reference of after) {
    const previous = before.find((item) => item.key === reference.key);
    const missing = reference.missing.filter(
      (item) => !previous?.missing.some((old) => sameMissing(old, item)),
    );
    if (missing.length === 0) continue;
    (reference.phase ? added : carried).push({ ...reference, missing });
  }
  return {
    added,
    existing: before.filter((reference) => reference.phase !== null),
    carried,
  };
}

/**
 * The phases holding staged choices a correction would leave without their
 * subject, with the number of such choices in each.
 */
export function correctionStagedChoices(
  draft: WeeklyDraft,
  current: UpkeepSnapshot,
  edited: UpkeepSnapshot,
): { phase: StagedChoicePhase; count: number }[] {
  const counts = new Map<StagedChoicePhase, number>();
  for (const { phase } of correctionImpact(draft, current, edited).added)
    if (phase) counts.set(phase, (counts.get(phase) ?? 0) + 1);
  return [...counts].map(([phase, count]) => ({ phase, count }));
}
