import {
  eventInputRollSides,
  eventMitigationInput,
} from '~/lib/rules-event-checks';
import { actionChoiceEvents } from '~/lib/weekly-draft-facts';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import type { WorkspaceSource } from '~/lib/weekly-workspace-source';
import type { CanonicalResolutionPreview } from '~/lib/canonical-weekly-resolution';
import { activityView } from './activity-facts';
import { activityReferenceOptions } from './activity-input-options';
import { activityLabel } from './activity-labels';
import type { EventView } from './types';
export function eventView(
  draft: WeeklyDraft,
  source: WorkspaceSource,
  preview: CanonicalResolutionPreview,
): EventView {
  const projection = preview.phases?.event;
  const occurrences = [
    ...draft.event.occurrences.map((occurrence) => ({
      occurrence,
      owner: null,
    })),
    ...draft.activity.slots.flatMap((slot) =>
      slot.choice
        ? actionChoiceEvents(slot.choice).map((occurrence) => ({
            occurrence,
            owner: { slotId: slot.slotId, choice: slot.choice! },
          }))
        : [],
    ),
  ];
  const references = activityReferenceOptions(
    { choiceId: '', actionId: 'lie_low' },
    activityView(draft, source, preview),
  );
  return {
    phase: 'event',
    ready: projection?.ready ?? false,
    chance: projection?.chance ?? 10,
    chanceRoll: draft.event.chanceRoll ?? null,
    chanceModifier: projection?.chanceModifier ?? null,
    guaranteed: projection?.guaranteed ?? false,
    occurrences: occurrences.map(({ occurrence, owner }) => {
      const resolved = projection?.tree.find(
        (event) => event.eventId === occurrence.eventId,
      );
      const prefixes = [
        occurrence.eventId,
        occurrence.sabotage?.choiceId,
      ].filter(Boolean);
      return {
        occurrence: structuredClone(occurrence),
        owner: structuredClone(owner),
        resolvedType: resolved?.eventType ?? null,
        optionalMitigation: eventMitigationInput(
          resolved ?? occurrence,
          projection?.dispatch.find(
            (entry) => entry.event.eventId === occurrence.eventId,
          )?.mode ?? null,
        ),
        rollSides: eventInputRollSides(resolved?.eventType ?? null),
        exceptionChoices: eventExceptions(
          occurrence,
          draft,
          projection?.requirements ?? [],
          projection?.warnings ?? [],
        ),
        changes:
          projection?.plan.filter(
            (change) => change.eventId === occurrence.eventId,
          ) ?? [],
        mode:
          projection?.dispatch.find(
            (entry) => entry.event.eventId === occurrence.eventId,
          )?.mode ?? null,
        selected:
          projection?.selected.some(
            (event) => event.eventId === occurrence.eventId,
          ) ?? false,
        negated:
          projection?.negatedEventIds.includes(occurrence.eventId) ?? false,
        requirements:
          projection?.requirements.filter((key) =>
            prefixes.some((id) => key.startsWith(`${id}:`)),
          ) ?? [],
        warnings:
          projection?.warnings.filter((key) =>
            prefixes.some((id) => key.startsWith(`${id}:`)),
          ) ?? [],
      };
    }),
    acknowledgements: structuredClone(draft.acknowledgements),
    exceptions: structuredClone(draft.rulesExceptions),
    checks: projection?.checks ?? [],
    options: {
      ...references,
      eventId: references.eventId.map((option) => {
        const index = occurrences.findIndex(
          ({ occurrence }) => occurrence.eventId === option.value,
        );
        const resolved = projection?.tree.find(
          (event) => event.eventId === option.value,
        );
        return index < 0
          ? option
          : {
              ...option,
              label: `Event ${index + 1}: ${activityLabel(resolved?.eventType ?? 'awaiting_roll')}`,
            };
      }),
      itemId: [
        ...new Map(
          [
            ...references.itemId,
            ...occurrences.flatMap(({ occurrence }) =>
              (occurrence.rewards ?? []).map((reward) => ({
                value: reward.itemId,
                label: reward.name,
              })),
            ),
            ...(projection?.outcome.economy?.items ?? []).map((item) => ({
              value: item.itemId,
              label: item.name,
            })),
          ].map((item) => [item.value, item]),
        ).values(),
      ],
      parentEventId: occurrences.map(({ occurrence }, index) => ({
        value: occurrence.eventId,
        label: `Event ${index + 1}: ${activityLabel(projection?.tree.find((event) => event.eventId === occurrence.eventId)?.eventType ?? 'awaiting_roll')}`,
      })),
    },
    requirements: projection?.requirements ?? [],
    warnings: projection?.warnings ?? [],
  };
}

function eventExceptions(
  occurrence: WeeklyDraft['event']['occurrences'][number],
  draft: WeeklyDraft,
  requirements: string[],
  warnings: string[],
) {
  const subjects = [
    occurrence.eventId,
    occurrence.sabotage?.choiceId,
    ...(occurrence.rewards ?? []).map((reward) => reward.itemId),
  ].filter((id): id is string => Boolean(id));
  const existing = draft.rulesExceptions.filter((exception) =>
    subjects.includes(exception.subjectId),
  );
  const candidates = requirements.flatMap((key) => {
    if (!key.endsWith(':exception')) return [];
    const reward = occurrence.rewards?.find(
      (reward) =>
        key === `${occurrence.eventId}:reward:${reward.itemId}:exception`,
    );
    if (reward)
      return [{ subjectId: reward.itemId, ruleId: 'alchemical-reward' }];
    const subjectId = subjects.find((id) => key.startsWith(`${id}:`));
    return subjectId
      ? [
          {
            subjectId,
            ruleId: key.slice(subjectId.length + 1, -':exception'.length),
          },
        ]
      : [];
  });
  if (warnings.includes(`${occurrence.eventId}:event-eligibility`))
    candidates.push({
      subjectId: occurrence.eventId,
      ruleId: 'event-eligibility',
    });
  return [
    ...new Map(
      [
        ...existing,
        ...candidates.map(
          (candidate) =>
            existing.find(
              (exception) =>
                exception.subjectId === candidate.subjectId &&
                exception.ruleId === candidate.ruleId,
            ) ?? {
              ...candidate,
              exceptionId: `event:${candidate.subjectId}:${candidate.ruleId}`,
              reason: '',
            },
        ),
      ].map((exception) => [exception.exceptionId, exception]),
    ).values(),
  ];
}
