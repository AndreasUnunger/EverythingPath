import type { WeeklyDraft } from './weekly-draft-contract';
type Event = WeeklyDraft['event']['occurrences'][number];

// Older drafts may select support on a reaction or target. Resolve that choice
// for the entire occurrence before its first check, regardless of target order.
export function eventOverseerSelection(event: Event) {
  const ids = [
    event.overseerCharacterId,
    event.sabotage?.overseerCharacterId,
    event.persistentDecision?.kind === 'mitigate'
      ? event.persistentDecision.overseerCharacterId
      : undefined,
    ...(event.targetChecks ?? []).map((target) => target.overseerCharacterId),
  ].filter((id): id is string => Boolean(id));
  return { characterId: ids[0], conflicting: new Set(ids).size > 1 };
}
