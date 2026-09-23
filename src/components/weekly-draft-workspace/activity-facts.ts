import { activityLabel } from './activity-labels';
import { activityOptionFacts } from './activity-option-facts';
import { MILITIA_ACTIVITY_ACTION_IDS } from '~/lib/militia-domain';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import type { WorkspaceSource } from '~/lib/weekly-workspace-source';
import type { CanonicalResolutionPreview } from '~/lib/canonical-weekly-resolution';
import type { ActivityView } from './types';
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
        calculatedCostCopper: (projection?.plan ?? []).reduce<number | null>(
          (cost, change) =>
            change.kind === 'treasuryCopper' &&
            change.choiceId === choiceId &&
            change.after < change.before
              ? (cost ?? 0) + change.before - change.after
              : cost,
          null,
        ),
        strategistBonus:
          projection?.slots.find((entry) => entry.slotId === slot.slotId)
            ?.strategistBonus ?? false,
        overAllowance:
          projection?.slots.find((entry) => entry.slotId === slot.slotId)
            ?.overAllowance ?? false,
        requirements:
          projection?.requirements.filter(
            (requirement) =>
              requirement.startsWith(`${choiceId}:`) ||
              (slot.choice?.actionId === 'special_order' &&
                Boolean(slot.choice.orderId) &&
                requirement.startsWith(`${slot.choice.orderId}:`)),
          ) ?? [],
        warnings,
        exceptions: [...ruleIds]
          .filter((ruleId) => ruleId !== 'action-capacity')
          .map((ruleId) => ({
            exceptionId:
              existing.find((exception) => exception.ruleId === ruleId)
                ?.exceptionId ?? `activity:${choiceId}:${ruleId}`,
            ruleId,
            reason:
              existing.find((exception) => exception.ruleId === ruleId)
                ?.reason ?? '',
          })),
      };
    }),
    actions: MILITIA_ACTIVITY_ACTION_IDS.map((actionId) => ({
      actionId,
      name: activityLabel(actionId),
    })),
    ...activityOptionFacts(draft, source, projection),
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
    startDay: draft.context.startDay,
    operatingSettlementId: draft.activity.operatingSettlementId ?? null,
    checks: projection?.checks ?? [],
    requirements: projection?.requirements ?? [],
    warnings: projection?.warnings ?? [],
  };
}
