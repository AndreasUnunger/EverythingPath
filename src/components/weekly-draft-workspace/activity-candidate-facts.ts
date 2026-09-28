import { eventName } from './event-tree-facts';
import type { ActivityCandidateSet, EventBlock, EventView } from './types';

// Each Activity choice's event candidates as the Event phase reads them:
// labels, resolved names, statuses and open items come from Event's own
// facts, so both phases describe a candidate the same way.

function nestedCount(block: EventBlock): number {
  return [...block.children, ...block.hidden, ...block.legacy].reduce(
    (count, child) => count + 1 + nestedCount(child),
    0,
  );
}

export function activityCandidateSets(
  event: EventView,
): ActivityCandidateSet[] {
  return event.candidates.map((set) => ({
    choiceId: set.choiceId,
    active: set.active,
    candidates: set.blocks.map((block) => ({
      eventId: block.eventId,
      label: block.label,
      name: eventName(block.item.resolvedType),
      status: block.statusLabel,
      chosen: block.candidate?.chosen ?? false,
      nested: nestedCount(block),
    })),
    issues: set.issues,
  }));
}
