import type { Phase } from './types';
import {
  activitySlotAnchor,
  eventOccurrenceAnchor,
  localFormElementId,
  persistentEventAnchor,
  upkeepStepAnchor,
  type UpkeepStep,
} from './source-anchors';

// Where a Review & confirm Required decision or warning comes from: the
// phase whose own list carries the code (the earliest, since Event repeats
// Activity's) and, where it can be named, the item within it. Codes of a
// saved Table Adjustment stay in Review and focus that adjustment. This is
// navigation only; readiness and its counts are unchanged.

type SourcePhase = Exclude<Phase, 'summary'>;
export type ReviewSource = { phase: Phase; anchor: string | null };
export type ReviewSourceFacts = {
  codes: readonly string[];
  /** Each phase's own requirement and warning codes. */
  owners: Record<SourcePhase, readonly string[]>;
  slots: readonly { slotId: string; choiceId: string | null }[];
  eventIds: readonly string[];
  persistentEventIds: readonly string[];
  teamIds: readonly string[];
  transferIds: readonly string[];
  adjustmentIds: readonly string[];
};

const phases: SourcePhase[] = ['upkeep', 'activity', 'event', 'persistent'];

// An identifier names a whole `:`-separated part of a code, never a prefix
// of a longer identifier.
const names = (code: string, id: string) => `:${code}:`.includes(`:${id}:`);

function upkeepStep(code: string, facts: ReviewSourceFacts): UpkeepStep | null {
  if (/^upkeep:(boon|rank)\b|^rank:/.test(code)) return 'rank';
  if (code.startsWith('upkeep:attrition')) return 'attrition';
  if (code.startsWith('upkeep:notoriety')) return 'notoriety';
  if (code.startsWith('upkeep:shortage')) return 'shortage';
  if (
    code.startsWith('transfer:') ||
    facts.transferIds.some((id) => names(code, id))
  )
    return 'transfers';
  if (code.startsWith('team:') || facts.teamIds.some((id) => names(code, id)))
    return 'teams';
  return null;
}

function anchor(
  phase: SourcePhase,
  code: string,
  facts: ReviewSourceFacts,
): string | null {
  if (phase === 'upkeep') {
    const step = upkeepStep(code, facts);
    return step && upkeepStepAnchor(step);
  }
  if (phase === 'activity') {
    const slot = facts.slots.find(
      (item) =>
        names(code, item.slotId) ||
        (item.choiceId !== null && names(code, item.choiceId)),
    );
    return slot ? activitySlotAnchor(slot.slotId) : null;
  }
  const ids = phase === 'event' ? facts.eventIds : facts.persistentEventIds;
  const id = ids.find((item) => names(code, item));
  if (!id) return null;
  return phase === 'event'
    ? eventOccurrenceAnchor(id)
    : persistentEventAnchor(id);
}

function source(code: string, facts: ReviewSourceFacts): ReviewSource | null {
  const adjustment = facts.adjustmentIds.find((id) =>
    code.startsWith(`adjustment:${id}:`),
  );
  if (adjustment)
    return {
      phase: 'summary',
      anchor: localFormElementId(`adjustment:${adjustment}`),
    };
  const phase =
    phases.find((item) => facts.owners[item].includes(code)) ??
    (code.startsWith('upkeep:')
      ? 'upkeep'
      : code.startsWith('event:')
        ? 'event'
        : null);
  return phase && { phase, anchor: anchor(phase, code, facts) };
}

/** Each code's source, keyed by code; codes with no known source are absent. */
export function reviewSources(
  facts: ReviewSourceFacts,
): Record<string, ReviewSource> {
  return Object.fromEntries(
    facts.codes.flatMap((code) => {
      const found = source(code, facts);
      return found ? [[code, found]] : [];
    }),
  );
}
