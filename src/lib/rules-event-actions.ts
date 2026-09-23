import type { ActivityProjection } from './rules-activity';
import type { ActivityHelpers } from './rules-economy';
import type { WeeklyDraft } from './weekly-draft-contract';
import type { StagedActionChoice } from './weekly-draft-facts';
import { getMinimumTreasuryForRank } from './militia-progression-rules';
import { projectTeams } from './rules-teams';

type Choice = StagedActionChoice;
type Guarantee = Extract<
  Choice,
  { actionId: 'guarantee_event' | 'manipulate_events' }
>;
type Receipt = WeeklyDraft['acknowledgements'][number];
export type EventActionChange =
  | {
      kind: 'covert_augmentation';
      choiceId: string;
      targetChoiceId: string;
      teamId: string;
      bonus: number;
    }
  | {
      kind: 'covert_site';
      choiceId: string;
      teamId: string;
      mode: 'contact' | 'cache';
      location: string;
      availableWeek: number;
      expiresWeek: number;
      acknowledgement: Receipt;
    }
  | {
      kind: 'event_guarantee';
      choiceId: string;
      candidates: NonNullable<Guarantee['candidates']>;
      selectedEventId: string | null;
      acknowledgement: Receipt | null;
    };

export function resolveEventAction(
  draft: WeeklyDraft,
  result: ActivityProjection,
  choice: Choice,
  helpers: ActivityHelpers,
) {
  if (
    choice.actionId !== 'covert_action' &&
    choice.actionId !== 'guarantee_event' &&
    choice.actionId !== 'manipulate_events'
  )
    return false;
  const required = (key: string) =>
    result.requirements.push(`${choice.choiceId}:${key}`);
  const team = projectTeams(
    result.outcome.roster,
    result.outcome.characters,
  ).teams.find((team) => team.teamId === choice.teamId);
  if (choice.actionId !== 'guarantee_event') {
    if (!team) {
      required('team');
      return true;
    }
    if (
      team.teamType !==
        (choice.actionId === 'covert_action' ? 'spies' : 'guardians') &&
      !helpers.exception(draft, result, choice, 'team-action')
    )
      return true;
    if (team.managerCharacterId && !team.manager) {
      required('manager');
      return true;
    }
  }
  const acknowledgement =
    [...draft.acknowledgements, ...(choice.acknowledgements ?? [])].find(
      (entry) =>
        entry.subjectId === `${choice.actionId}:${choice.choiceId}` &&
        entry.outcome.trim(),
    ) ?? null;
  if (choice.actionId === 'covert_action') {
    if (!choice.mode) {
      required('mode');
      return true;
    }
    if (choice.mode === 'augment') {
      const choices = draft.activity.slots.flatMap((slot) =>
        slot.choice ? [slot.choice] : [],
      );
      const next =
        choices[
          choices.findIndex((entry) => entry.choiceId === choice.choiceId) + 1
        ];
      if (
        !choice.followingChoiceId ||
        choice.followingChoiceId !== next?.choiceId
      ) {
        required('immediately-following-choice');
        return true;
      }
      result.plan.push({
        kind: 'covert_augmentation',
        choiceId: choice.choiceId,
        targetChoiceId: next.choiceId,
        teamId: team!.teamId,
        bonus: team!.manager?.bonus ?? 0,
      });
    } else {
      if (!choice.location) required('location');
      if (!acknowledgement) required('acknowledgement');
      if (choice.location && acknowledgement)
        result.plan.push({
          kind: 'covert_site',
          choiceId: choice.choiceId,
          teamId: team!.teamId,
          mode: choice.mode,
          location: choice.location,
          availableWeek: draft.week,
          expiresWeek: draft.week,
          acknowledgement,
        });
    }
    return true;
  }
  if (choice.actionId === 'guarantee_event') {
    if (
      !helpers.spend(
        draft,
        result,
        choice,
        getMinimumTreasuryForRank(result.outcome.rank) * 100,
      )
    )
      return true;
    const gain = helpers.dice(result, choice, 'notoriety', 1, 6);
    if (gain !== null) helpers.value(result, choice, 'notoriety', gain);
  }
  if (!acknowledgement) required('acknowledgement');
  // Dice and branch completeness belong to Event selection: even an unfinished
  // selection must retain the already taken action's immediate cost and guarantee.
  result.plan.push({
    kind: 'event_guarantee',
    choiceId: choice.choiceId,
    candidates: structuredClone(choice.candidates ?? []),
    selectedEventId: choice.selectedEventId ?? null,
    acknowledgement,
  });
  return true;
}

export function finishCovertAction(
  result: ActivityProjection,
  choice: Choice,
  planStart: number,
  requirementStart: number,
) {
  const resolution = result.actionResults.find(
    (entry) => entry.choiceId === choice.choiceId,
  )!;
  const incomplete = result.requirements
    .slice(requirementStart)
    .some((key) => !key.startsWith(`${choice.choiceId}:notoriety:`));
  if (incomplete) resolution.succeeded = null;
  else if (!result.checks.some((entry) => entry.checkId === choice.choiceId))
    resolution.succeeded = true;
  if (
    resolution.succeeded !== true ||
    !result.plan.some(
      (effect) =>
        effect.kind === 'covert_augmentation' &&
        effect.targetChoiceId === choice.choiceId,
    )
  )
    return;
  const prior = result.plan.slice(0, planStart);
  for (const change of result.plan.slice(planStart)) {
    // Lie Low is the only action that lowers Notoriety. Every other recorded
    // effect is an attempted gain, even if the cap makes its observed delta
    // zero or negative for an imported above-cap value.
    if (change.kind === 'notoriety' && choice.actionId !== 'lie_low')
      result.outcome.notoriety -= change.after - change.before;
    else prior.push(change);
  }
  result.plan = prior;
  result.requirements = result.requirements.filter(
    (key) => !key.startsWith(`${choice.choiceId}:notoriety:`),
  );
}
