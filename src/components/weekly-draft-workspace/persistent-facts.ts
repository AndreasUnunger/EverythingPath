import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import type { WorkspaceSource } from '~/lib/weekly-workspace-source';
import type { CanonicalResolutionPreview } from '~/lib/canonical-weekly-resolution';
import { eventView } from './event-facts';
import { activityLabel } from './activity-labels';
import type { PersistentView } from './types';

export function persistentView(
  draft: WeeklyDraft,
  source: WorkspaceSource,
  preview: CanonicalResolutionPreview,
): PersistentView {
  const projection = preview.phases?.persistent;
  const options = eventView(draft, source, preview).options;
  const events = [...draft.context.carriedEvents].sort(
    (a, b) =>
      a.startedWeek - b.startedWeek ||
      a.order - b.order ||
      a.eventId.localeCompare(b.eventId),
  );
  return {
    phase: 'persistent',
    ready: projection?.ready ?? false,
    firstBuyoff: draft.context.lastBuyoffWeek === null,
    nextBuyoffWeek: projection?.nextBuyoffWeek ?? null,
    buyoffCostCopper: projection?.buyoffCostCopper ?? null,
    options,
    events: events.map((event, index) => {
      const requirements = (projection?.requirements ?? []).filter((key) =>
        key.startsWith(`${event.eventId}:`),
      );
      const existing = draft.rulesExceptions.filter(
        (entry) => entry.subjectId === event.eventId,
      );
      return {
        ...structuredClone(event),
        name: `${activityLabel(event.eventType)} · Event ${index + 1}`,
        ageWeeks: draft.week - event.startedWeek,
        targetNames: event.targets.map((target) => {
          const [field, id] = Object.entries(target).find(
            ([key]) => key !== 'kind',
          )!;
          return (
            options[field]?.find((option) => option.value === id)?.label ??
            `Unavailable ${target.kind}`
          );
        }),
        decision: structuredClone(
          draft.persistent.decisions.find(
            (decision) => decision.eventId === event.eventId,
          ) ?? null,
        ),
        ended: projection?.endedEventIds.includes(event.eventId) ?? false,
        changes:
          projection?.plan.filter(
            (change) => 'eventId' in change && change.eventId === event.eventId,
          ) ?? [],
        checks:
          projection?.checks.filter((check) =>
            check.checkId.startsWith(`${event.eventId}:`),
          ) ?? [],
        requirements,
        warnings: (projection?.warnings ?? []).filter((key) =>
          key.startsWith(`${event.eventId}:`),
        ),
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
    requirements: projection?.requirements ?? [],
    warnings: projection?.warnings ?? [],
  };
}
