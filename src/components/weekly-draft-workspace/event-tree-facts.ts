import { militiaEventTable } from '~/lib/militia-event-table';
import { normalizeRawRoll } from '~/lib/raw-roll';
import { RULE_ROLL_SPECS } from '~/lib/rules-roll-spec';
import {
  eventTableArithmetic,
  eventTypeForTableRoll,
  type EventPositionGroup,
} from '~/lib/rules-event-selection';
import type { EventOutcomeProjection } from '~/lib/rules-event-outcomes';
import {
  isCandidateChoice,
  uniquePositions,
  type EventTopologyPlan,
} from '~/lib/event-occurrence-preparation';
import { EVENT_RULES_TEXT } from '~/lib/event-rules-text';
import type { StagedActionChoice } from '~/lib/weekly-draft-facts';
import type { WeeklyDraft, WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import { activityLabel } from './activity-labels';
import type {
  EventBlock,
  EventBlockStatus,
  EventIssue,
  EventOccurrenceFacts,
} from './types';

type Event = WeeklyDraft['event']['occurrences'][number];
export type EventOwner = { slotId: string; choice: StagedActionChoice } | null;
export type LocatedEvent = { event: Event; owner: EventOwner; tree: Event[] };
// Surplus positions and the edit that removes one once its roll is cleared.
export type Repair = {
  surplus: (eventId: string) => boolean;
  removal: (eventId: string) => WeeklyDraftEdit | null;
};

export function eventName(type: string | null | undefined) {
  if (!type) return null;
  return (
    militiaEventTable.find((entry) => entry.eventType === type)?.name ??
    activityLabel(type)
  );
}

// Table roll arithmetic exactly as selection reads it: settlement reputation
// never applies here, and one value counts per modifier source.
// The shared engine arithmetic for a table roll, with its event's name.
export function eventTableFacts(roll: Event['tableRoll']): EventBlock['table'] {
  return {
    ...eventTableArithmetic(roll),
    name: eventName(eventTypeForTableRoll(roll)),
  };
}

const STATUS_LABELS: Record<EventBlockStatus, string> = {
  preparing: 'Preparing',
  awaiting_roll: 'Awaiting roll',
  happens: 'Happens',
  twice: 'Twice',
  no_additional_effect: 'No additional effect',
  two_more: 'Two more',
  reroll: 'Reroll',
  rerolled: 'Rerolled',
  cannot_occur: 'Cannot occur',
  kept: 'Kept by ruling',
  sabotaged: 'Sabotaged',
  candidate: 'Candidate',
  not_chosen: 'Not chosen',
  not_used: 'Not used',
  needs_repair: 'Needs repair',
};
const STATUS_TEXT: Record<EventBlockStatus, string> = {
  preparing: 'Preparing this event',
  awaiting_roll: 'Awaiting the table roll',
  happens: 'Happens this week',
  twice: 'Happens again this week: its Twice effect applies',
  no_additional_effect: 'Already happened this week: no additional effect',
  two_more: 'Roll two more events and resolve both',
  reroll: 'Roll Twice again: reroll and enter the new die',
  rerolled: 'Rerolled: the recorded reroll is below',
  cannot_occur: 'Cannot occur now: roll its replacement below',
  kept: 'Cannot normally occur; kept with a Rules Exception',
  sabotaged: 'Sabotaged: this event does not happen',
  candidate: 'A candidate: choose this event or the other one',
  not_chosen: 'Not chosen: its record is kept',
  not_used: 'Kept on record; not used this week',
  needs_repair:
    'More events are recorded here than the rules ask for; clear the extra one',
};
// The corpus rules for the event a complete table roll names. Its Twice
// clause is included only when that clause is what applies to this block (a
// second occurrence dispatched as Twice or with no additional effect).
export function eventRules(
  roll: Event['tableRoll'],
  mode: string | null,
): EventBlock['rules'] {
  const type = eventTypeForTableRoll(roll);
  if (!type) return null;
  const rules = EVENT_RULES_TEXT[type];
  const plain = (line: string) => line.replaceAll('`', '');
  return {
    name: eventName(type)!,
    text: rules.text.map(plain),
    twice:
      rules.twice && (mode === 'twice' || mode === 'no_additional_effect')
        ? plain(rules.twice)
        : null,
  };
}

function childKind(group: EventPositionGroup) {
  return group.kind === 'roll_twice' || group.kind === 'replacement'
    ? group
    : null;
}

/**
 * The Event tree as numbered, nested blocks. Membership in a traced position
 * group decides whether an occurrence takes part this week; everything else
 * stays visible as recorded input rather than being dropped or rewritten.
 */
export function eventTreeBlocks({
  draft,
  projection,
  plan,
  accepted,
  facts,
  issues,
}: {
  draft: WeeklyDraft;
  projection: EventOutcomeProjection | undefined;
  plan: EventTopologyPlan;
  accepted: ReadonlySet<string> | null;
  facts: (
    located: LocatedEvent,
    number: number,
  ) => Omit<EventOccurrenceFacts, 'number'> & { number?: number };
  issues: (codes: string[]) => EventIssue[];
}) {
  const positions = uniquePositions(projection?.positions ?? []);
  const located: LocatedEvent[] = [
    ...plan.trees.event.map((event) => ({
      event,
      owner: null,
      tree: plan.trees.event,
    })),
    ...plan.trees.candidates.flatMap(({ slotId, choiceId, events }) => {
      const choice = draft.activity.slots.find(
        (slot) => slot.slotId === slotId,
      )?.choice;
      return choice?.choiceId === choiceId && choice
        ? events.map((event) => ({
            event,
            owner: { slotId, choice },
            tree: events,
          }))
        : [];
    }),
  ];
  const byId = new Map(located.map((entry) => [entry.event.eventId, entry]));
  const childrenOf = (entry: LocatedEvent) =>
    entry.tree.filter(
      (event) =>
        'parentEventId' in event.origin &&
        event.origin.parentEventId === entry.event.eventId,
    );
  // Members of each traced group, including planned blank positions.
  const members = (group: EventPositionGroup) => {
    switch (group.kind) {
      case 'rolled':
        return plan.trees.event.filter(
          (event) => event.origin.kind === 'rolled',
        );
      case 'automatic':
        return plan.trees.event.filter(
          (event) =>
            event.origin.kind === 'automatic' &&
            event.origin.sourceId === group.sourceId,
        );
      case 'candidates':
        return (
          plan.trees.candidates.find((tree) => tree.choiceId === group.choiceId)
            ?.events ?? []
        ).filter((event) => event.origin.kind === 'rolled');
      case 'roll_twice':
      case 'replacement': {
        const parent = byId.get(group.parentEventId);
        return parent
          ? childrenOf(parent).filter(
              (event) => event.origin.kind === group.kind,
            )
          : [];
      }
    }
  };
  const active = new Set<string>();
  const overfull = new Set<string>();
  const groupOfParent = new Map<string, EventPositionGroup>();
  for (const group of positions) {
    const ids = members(group).map((event) => event.eventId);
    for (const id of ids) active.add(id);
    if (group.eventIds.length > group.count)
      for (const id of ids) overfull.add(id);
    const child = childKind(group);
    if (child) groupOfParent.set(child.parentEventId, group);
  }
  const activeCandidateSets = new Set(
    positions.flatMap((group) =>
      group.kind === 'candidates' ? [group.choiceId] : [],
    ),
  );

  // Numbers follow resolution order: automatic, rolled, then candidates,
  // each root before its nested events. Retained events keep their number.
  const order: LocatedEvent[] = [];
  const visit = (entry: LocatedEvent) => {
    order.push(entry);
    for (const child of childrenOf(entry)) visit(byId.get(child.eventId)!);
  };
  const roots = located.filter(
    (entry) => !('parentEventId' in entry.event.origin),
  );
  for (const entry of roots)
    if (entry.owner === null && entry.event.origin.kind === 'automatic')
      visit(entry);
  for (const entry of roots)
    if (entry.owner === null && entry.event.origin.kind === 'rolled')
      visit(entry);
  for (const entry of roots) if (entry.owner !== null) visit(entry);
  for (const entry of located) if (!order.includes(entry)) order.push(entry);
  const numbers = new Map(
    order.map((entry, index) => [entry.event.eventId, index + 1]),
  );

  const occurrences = order.map((entry) => ({
    ...facts(entry, numbers.get(entry.event.eventId)!),
    number: numbers.get(entry.event.eventId)!,
  }));
  const factsById = new Map(
    occurrences.map((item) => [item.occurrence.eventId, item]),
  );

  function status(entry: LocatedEvent, surplus: boolean): EventBlockStatus {
    const id = entry.event.eventId;
    const item = factsById.get(id)!;
    if (accepted && !accepted.has(id)) return 'preparing';
    if (!active.has(id)) return surplus ? 'needs_repair' : 'not_used';
    if (overfull.has(id)) return 'needs_repair';
    const table = normalizeRawRoll(
      entry.event.tableRoll,
      RULE_ROLL_SPECS.percentile,
    );
    if (table.status !== 'complete') return 'awaiting_roll';
    if (item.negated) return 'sabotaged';
    const group = groupOfParent.get(id);
    const choice = entry.owner?.choice;
    const candidateRoot =
      isCandidateChoice(choice) && entry.event.origin.kind === 'rolled';
    if (candidateRoot && choice.selectedEventId !== id)
      return group?.kind === 'replacement' && !group.reroll
        ? 'cannot_occur'
        : choice.selectedEventId
          ? 'not_chosen'
          : 'candidate';
    if (group?.kind === 'roll_twice') return 'two_more';
    if (group?.kind === 'replacement')
      return group.reroll
        ? group.eventIds.length > 0
          ? 'rerolled'
          : 'reroll'
        : 'cannot_occur';
    if (item.selected)
      return item.mode === 'twice'
        ? 'twice'
        : item.mode === 'no_additional_effect'
          ? 'no_additional_effect'
          : item.warnings.includes(`${id}:event-eligibility`)
            ? 'kept'
            : 'happens';
    return 'awaiting_roll';
  }
  function origin(entry: LocatedEvent) {
    const { origin } = entry.event;
    if ('parentEventId' in origin) {
      const parent = `Event ${numbers.get(origin.parentEventId) ?? '?'}`;
      if (origin.kind === 'roll_twice') return `From ${parent} (Roll Twice)`;
      const group = groupOfParent.get(origin.parentEventId);
      return group?.kind === 'replacement' && group.reroll
        ? `Recorded reroll of ${parent}`
        : `Replaces ${parent}`;
    }
    if (origin.kind === 'automatic') return 'Automatic';
    return entry.owner
      ? `Candidate · ${activityLabel(entry.owner.choice.actionId)}`
      : 'Rolled';
  }
  function block(entry: LocatedEvent, repair: Repair): EventBlock {
    const id = entry.event.eventId;
    const item = factsById.get(id)!;
    const isSurplus = repair.surplus(id);
    const current = status(entry, isSurplus);
    const children = childrenOf(entry).map((child) => byId.get(child.eventId)!);
    const choice = entry.owner?.choice;
    return {
      eventId: id,
      number: item.number,
      item,
      saved: !accepted || accepted.has(id),
      status: current,
      statusLabel: STATUS_LABELS[current],
      statusText: STATUS_TEXT[current],
      origin: origin(entry),
      table: eventTableFacts(entry.event.tableRoll),
      rules: eventRules(entry.event.tableRoll, item.mode),
      candidate:
        entry.owner &&
        choice &&
        isCandidateChoice(choice) &&
        entry.event.origin.kind === 'rolled'
          ? {
              slotId: entry.owner.slotId,
              choiceId: choice.choiceId,
              chosen: choice.selectedEventId === id,
            }
          : null,
      children: children
        .filter((child) => active.has(child.event.eventId))
        .map((child) => block(child, repair)),
      hidden: children
        .filter((child) => !active.has(child.event.eventId))
        .map((child) => block(child, repair)),
      surplus: isSurplus || overfull.has(id),
      removal: repair.removal(id),
      issues: issues([...item.requirements, ...item.warnings]),
    };
  }
  return {
    occurrences,
    numbers,
    active,
    activeCandidateSets,
    located,
    roots,
    block,
  };
}
