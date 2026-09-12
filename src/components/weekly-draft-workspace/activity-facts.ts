import { MILITIA_ACTIVITY_ACTION_IDS } from '~/lib/militia-domain';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import type { WorkspaceSource } from '~/lib/weekly-workspace-source';
import type { CanonicalResolutionPreview } from '~/lib/canonical-weekly-resolution';
import type { ActivityView } from './types';
export function activityLabel(value: string) {
  return value
    .split('_')
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(' ');
}
export function activityView(
  draft: WeeklyDraft,
  source: WorkspaceSource,
  preview: CanonicalResolutionPreview,
): ActivityView {
  const projection = preview.phases?.activity;
  return {
    phase: 'activity',
    ready: projection?.ready ?? false,
    occupiedSlots: draft.activity.slots.filter((slot) => slot.choice).length,
    slots: draft.activity.slots.map((slot) => {
      const choiceId = slot.choice?.choiceId;
      const warnings =
        projection?.warnings.filter((warning) =>
          warning.startsWith(`${choiceId}:`),
        ) ?? [];
      const existing = draft.rulesExceptions.filter(
        (exception) => exception.subjectId === choiceId,
      );
      const ruleIds = new Set([
        ...existing.map((exception) => exception.ruleId),
        ...(projection?.requirements ?? [])
          .filter(
            (requirement) =>
              requirement.startsWith(`${choiceId}:`) &&
              requirement.endsWith(':exception'),
          )
          .map((requirement) =>
            requirement.slice(`${choiceId}:`.length, -':exception'.length),
          ),
      ]);
      return {
        ...structuredClone(slot),
        overAllowance:
          projection?.slots.find((entry) => entry.slotId === slot.slotId)
            ?.overAllowance ?? false,
        requirements:
          projection?.requirements.filter((requirement) =>
            requirement.startsWith(`${choiceId}:`),
          ) ?? [],
        warnings,
        exceptions: [...ruleIds].map((ruleId) => ({
          exceptionId:
            existing.find((exception) => exception.ruleId === ruleId)
              ?.exceptionId ?? `activity:${choiceId}:${ruleId}`,
          ruleId,
          reason:
            existing.find((exception) => exception.ruleId === ruleId)?.reason ??
            '',
        })),
      };
    }),
    actions: MILITIA_ACTIVITY_ACTION_IDS.map((actionId) => ({
      actionId,
      name: activityLabel(actionId),
    })),
    teams: (preview.phases?.upkeep.outcome ?? source.snapshot).roster.teams.map(
      (team) => ({
        value: team.teamId,
        label: team.name,
        description: activityLabel(team.status),
      }),
    ),
    settlements: source.snapshot.settlements.map((settlement) => ({
      value: settlement.settlementId,
      label: settlement.name,
    })),
    people: source.snapshot.roster.people.map((person) => ({
      value: person.characterId,
      label:
        source.people.find((entry) => entry.characterId === person.characterId)
          ?.name ?? 'Unnamed character',
    })),
    items: (source.snapshot.economy?.items ?? []).map((item) => ({
      value: item.itemId,
      label: item.name,
    })),
    caches: (source.snapshot.economy?.caches ?? []).map((cache) => ({
      value: cache.cacheId,
      label: cache.location,
    })),
    events: [...draft.context.carriedEvents, ...draft.event.occurrences].map(
      (event) => ({
        value: event.eventId,
        label: activityLabel(event.eventType ?? 'Unselected event'),
      }),
    ),
    bonuses: source.snapshot.bonuses.map((bonus) => ({
      value: bonus.bonusId,
      label: 'Available bonus',
    })),
    startDay: draft.context.startDay,
    operatingSettlementId: draft.activity.operatingSettlementId ?? null,
    checks: projection?.checks ?? [],
    requirements: projection?.requirements ?? [],
    warnings: projection?.warnings ?? [],
  };
}
