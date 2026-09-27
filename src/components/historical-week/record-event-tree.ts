import type { CanonicalResolutionRecord } from '~/lib/canonical-resolution-record';
import type { StagedActionChoice } from '~/lib/weekly-draft-facts';

// The Event phase's hierarchical labels ("Event 1", "Event 2A", "Event 2A.1")
// derived from a frozen record's own recorded tree, with the same numbering
// as the live Event phase. Which top-level events took part is read from
// recorded facts only (queued automatic events, a recorded All Is Calm and
// the recorded event guarantees); the rules engine is never consulted.

type Source = CanonicalResolutionRecord['source'];
type Occurrence = Source['event']['occurrences'][number];
export type RecordedEventOwner = {
  slotIndex: number;
  choice: StagedActionChoice;
};
export type RecordedOccurrence = {
  occurrence: Occurrence;
  /** The Activity choice whose candidates hold this occurrence, if any. */
  owner: RecordedEventOwner | null;
  label: string;
};
type Located = {
  occurrence: Occurrence;
  owner: RecordedEventOwner | null;
  tree: readonly Occurrence[];
};

const candidateActions = new Set(['guarantee_event', 'manipulate_events']);

function inForce(
  source: Source,
  kind: Source['context']['queuedEffects'][number]['effect']['kind'],
  sourceId?: string,
) {
  return source.context.queuedEffects.some(
    (effect) =>
      effect.effect.kind === kind &&
      effect.startsWeek <= source.week &&
      source.week <= effect.endsWeek &&
      (sourceId === undefined || effect.sourceId === sourceId),
  );
}

function locate(source: Source): Located[] {
  const tree = source.event.occurrences;
  return [
    ...tree.map((occurrence) => ({ occurrence, owner: null, tree })),
    ...source.activity.slots.flatMap((slot, slotIndex) => {
      const choice = slot.choice;
      if (!choice || !candidateActions.has(choice.actionId)) return [];
      const events = 'candidates' in choice ? (choice.candidates ?? []) : [];
      return events.map((occurrence) => ({
        occurrence,
        owner: { slotIndex, choice },
        tree: events,
      }));
    }),
  ];
}

/**
 * Every recorded occurrence in resolution order with its hierarchical label.
 * `guaranteedChoiceIds` names the Activity choices whose recorded plan
 * guaranteed an event this week.
 */
export function recordedEventTree(
  source: Source,
  guaranteedChoiceIds: ReadonlySet<string>,
): RecordedOccurrence[] {
  const located = locate(source);
  const childrenOf = (entry: Located) =>
    entry.tree.flatMap((child) =>
      'parentEventId' in child.origin &&
      child.origin.parentEventId === entry.occurrence.eventId
        ? located.filter((other) => other.occurrence === child)
        : [],
    );
  const roots = located.filter(
    (entry) => !('parentEventId' in entry.occurrence.origin),
  );
  const automaticRoots = roots.filter(
    (entry) => !entry.owner && entry.occurrence.origin.kind === 'automatic',
  );
  const rolledRoots = roots.filter(
    (entry) => !entry.owner && entry.occurrence.origin.kind === 'rolled',
  );
  const order: Located[] = [];
  const visit = (entry: Located) => {
    order.push(entry);
    childrenOf(entry).forEach(visit);
  };
  [...automaticRoots, ...rolledRoots].forEach(visit);
  roots.filter((entry) => entry.owner).forEach(visit);
  for (const entry of located) if (!order.includes(entry)) order.push(entry);

  // All Is Calm replaces guaranteed and rolled events; automatic events and
  // a guarantee's candidates are the only other ways an event takes part.
  const calm = inForce(source, 'all_is_calm');
  const guaranteed = guaranteedChoiceIds.size > 0;
  const tookPart = (entry: Located) => {
    const { origin } = entry.occurrence;
    if (origin.kind === 'automatic')
      return inForce(source, 'automatic_events', origin.sourceId);
    return !calm && !guaranteed;
  };
  const candidateSets = source.activity.slots.flatMap((slot) =>
    slot.choice && candidateActions.has(slot.choice.actionId)
      ? [slot.choice.choiceId]
      : [],
  );
  const units = [
    ...[...automaticRoots, ...rolledRoots].map((root) => ({
      roots: [root],
      lettered: false,
      active: tookPart(root),
    })),
    ...candidateSets.map((choiceId) => ({
      roots: roots.filter((entry) => entry.owner?.choice.choiceId === choiceId),
      lettered: true,
      active: !calm && guaranteedChoiceIds.has(choiceId),
    })),
  ];

  // Numbering matches the Event phase: active top-level units in resolution
  // order, then the recorded ones that took no part; a candidate set shares
  // one number and letters its candidates; nested events extend their
  // parent's label by their position among all recorded siblings.
  const labels = new Map<Located, string>();
  const assign = (entry: Located, label: string) => {
    labels.set(entry, label);
    childrenOf(entry).forEach((child, index) =>
      assign(child, `${label}.${index + 1}`),
    );
  };
  let number = 0;
  for (const unit of [
    ...units.filter((entry) => entry.active),
    ...units.filter((entry) => !entry.active),
  ]) {
    if (unit.roots.length === 0) continue;
    number++;
    unit.roots.forEach((root, index) =>
      assign(
        root,
        `Event ${number}${unit.lettered ? String.fromCharCode(65 + index) : ''}`,
      ),
    );
  }
  for (const entry of order)
    if (!labels.has(entry)) assign(entry, `Event ${++number}`);
  return order.map((entry) => ({
    occurrence: entry.occurrence,
    owner: entry.owner,
    label: labels.get(entry) ?? 'Event',
  }));
}
