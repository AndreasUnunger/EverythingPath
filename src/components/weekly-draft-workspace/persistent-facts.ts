import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import type { WorkspaceSource } from '~/lib/weekly-workspace-source';
import type { CanonicalResolutionPreview } from '~/lib/canonical-weekly-resolution';
import { eventView } from './event-facts';
import { activityLabel } from './activity-labels';
import {
  buyoffAvailability,
  checkChoice,
  earlierPhases,
  earlierPhasesKey,
  isOwnRequirement,
  leaveNote,
  liveWarnings,
  orderCarriedEvents,
  ordinal,
  projectedResult,
  sourceEndings,
} from './persistent-sections';
import type { PersistentView } from './types';

export function persistentView(
  draft: WeeklyDraft,
  source: WorkspaceSource,
  preview: CanonicalResolutionPreview,
): PersistentView {
  const phases = preview.phases;
  const projection = phases?.persistent;
  const { options, overseer } = eventView(draft, source, preview);
  const events = orderCarriedEvents(draft.context.carriedEvents);
  const ownIds = events.map((event) => event.eventId);
  const allRequirements = projection?.requirements ?? [];
  const earlier = earlierPhases(allRequirements, ownIds, phases);
  // The rank, and so the rules cost, is settled once Upkeep is complete.
  const costPending = !phases?.upkeep.ready;
  const endings = sourceEndings(draft, phases);
  const warnings = liveWarnings(projection?.warnings ?? []);
  return {
    phase: 'persistent',
    ready: (projection?.ready ?? false) && earlier.length === 0,
    firstBuyoff: draft.context.lastBuyoffWeek === null,
    buyoffAvailability: buyoffAvailability(
      draft.week,
      draft.context.lastBuyoffWeek,
    ),
    nextBuyoffWeek: projection
      ? Math.max(draft.week, projection.nextBuyoffWeek)
      : null,
    buyoffCostCopper: costPending
      ? null
      : (projection?.buyoffCostCopper ?? null),
    earlierPhases: earlier,
    options,
    overseer,
    events: events.map((event, index) => {
      const requirements = allRequirements.filter((key) =>
        key.startsWith(`${event.eventId}:`),
      );
      const existing = draft.rulesExceptions.filter(
        (entry) => entry.subjectId === event.eventId,
      );
      const decision = structuredClone(
        draft.persistent.decisions.find(
          (entry) => entry.eventId === event.eventId,
        ) ?? null,
      );
      const changes =
        projection?.plan.filter(
          (change) => 'eventId' in change && change.eventId === event.eventId,
        ) ?? [];
      const endedBy = endings.get(event.eventId) ?? null;
      return {
        ...structuredClone(event),
        name: `${activityLabel(event.eventType)} · Event ${index + 1}`,
        typeLabel: activityLabel(event.eventType),
        ageWeeks: draft.week - event.startedWeek,
        orderLabel: `${ordinal(event.order + 1)} that week`,
        targetNames: event.targets.map((target) => {
          const [field, id] = Object.entries(target).find(
            ([key]) => key !== 'kind',
          )!;
          return (
            options[field]?.find((option) => option.value === id)?.label ??
            `Unavailable ${target.kind}`
          );
        }),
        decision,
        ended: projection?.endedEventIds.includes(event.eventId) ?? false,
        endedBy,
        result: projectedResult({
          event,
          decision,
          endedBy,
          changes,
          requirements,
          costPending,
        }),
        leaveNote: leaveNote(event.eventType),
        check: checkChoice(event.eventType),
        changes,
        checks:
          projection?.checks.filter((check) =>
            check.checkId.startsWith(`${event.eventId}:`),
          ) ?? [],
        requirements,
        warnings: warnings.filter((key) => key.startsWith(`${event.eventId}:`)),
        exceptions: [
          ...existing,
          ...requirements.flatMap((key) => {
            if (!key.endsWith(':exception')) return [];
            const ruleId = key.slice(
              event.eventId.length + 1,
              -':exception'.length,
            );
            return existing.some((entry) => entry.ruleId === ruleId)
              ? []
              : [
                  {
                    exceptionId: `persistent:${event.eventId}:${ruleId}`,
                    subjectId: event.eventId,
                    ruleId,
                    reason: '',
                  },
                ];
          }),
        ],
      };
    }),
    // Per-event decisions stay itemised; everything an earlier phase still
    // needs collapses into one "Earlier phases still need preparation" item.
    requirements: [
      ...allRequirements.filter((key) => isOwnRequirement(key, ownIds)),
      ...(earlier.length ? [earlierPhasesKey(earlier)] : []),
    ],
    warnings,
  };
}
