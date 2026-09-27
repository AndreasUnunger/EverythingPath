import type { UpkeepSnapshot } from './rules-upkeep';
import type { WeeklyDraft } from './weekly-draft-contract';
import { draftReferenceRequirements } from './weekly-draft-references';

export type StagedChoicePhase =
  | 'upkeep'
  | 'activity'
  | 'event'
  | 'persistent'
  | 'summary';

// Which phases of the open week hold staged choices that a Militia correction
// would leave pointing at something it removes. References that were already
// broken are not blamed on the correction; carried-context references are
// rejected by the correction itself and are not counted here.
export function correctionStagedChoices(
  draft: WeeklyDraft,
  current: UpkeepSnapshot,
  edited: UpkeepSnapshot,
): { phase: StagedChoicePhase; count: number }[] {
  const before = new Set(draftReferenceRequirements(draft, current, current));
  const counts = new Map<StagedChoicePhase, number>();
  for (const requirement of draftReferenceRequirements(draft, edited, edited)) {
    if (before.has(requirement)) continue;
    const phase = referencePhase(draft, requirement);
    if (phase) counts.set(phase, (counts.get(phase) ?? 0) + 1);
  }
  return [...counts].map(([phase, count]) => ({ phase, count }));
}

function referencePhase(
  draft: WeeklyDraft,
  requirement: string,
): StagedChoicePhase | null {
  const [owner = ''] = requirement.split(':');
  if (['team', 'upkeep'].includes(owner)) return 'upkeep';
  if (owner === 'activity') return 'activity';
  if (owner === 'adjustment') return 'summary';
  if (draft.activity.slots.some((slot) => slot.choice?.choiceId === owner))
    return 'activity';
  if (draft.event.occurrences.some((event) => event.eventId === owner))
    return 'event';
  if (draft.persistent.decisions.some((decision) => decision.eventId === owner))
    return 'persistent';
  return null;
}
