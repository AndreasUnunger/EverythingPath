import type { TEAM_IDS } from './militia-domain';
import type { ActivityProjection } from './rules-activity';
import type { ActivityHelpers } from './rules-economy';
import type { WeeklyDraft } from './weekly-draft-contract';
import type { StagedActionChoice } from './weekly-draft-facts';
import type { TrackedCharacter } from './rules-character-state';

type Choice = Extract<
  StagedActionChoice,
  {
    actionId:
      | 'rescue_character'
      | 'restore_character'
      | 'gather_information'
      | 'knowledge_check'
      | 'strike_team'
      | 'special';
  }
>;
const teams: Record<Choice['actionId'], readonly (typeof TEAM_IDS)[number][]> =
  {
    rescue_character: ['infiltrators', 'guardians', 'specialists'],
    restore_character: ['spellcasters'],
    gather_information: [
      'informants',
      'conspirators',
      'scholars',
      'spellcasters',
    ],
    knowledge_check: ['scholars'],
    strike_team: ['specialists'],
    special: [],
  };
const scrollCosts = {
  break_enchantment: 112500,
  raise_dead: 612500,
  restoration: 170000,
  stone_to_flesh: 165000,
};
function update(
  result: ActivityProjection,
  choice: Choice,
  person: TrackedCharacter,
  after: TrackedCharacter,
) {
  result.plan.push({
    kind: 'tracked_character',
    choiceId: choice.choiceId,
    before: structuredClone(person),
    after: structuredClone(after),
  });
  Object.assign(person, after);
}
export function resolveCharacterChoice(
  draft: WeeklyDraft,
  result: ActivityProjection,
  staged: StagedActionChoice,
  helpers: ActivityHelpers,
) {
  if (!(staged.actionId in teams)) return false;
  const choice = staged as Choice;
  const required = (key: string) =>
    result.requirements.push(`${choice.choiceId}:${key}`);
  const exception = (rule: string) =>
    helpers.exception(draft, result, choice, rule);
  const team = result.outcome.roster.teams.find(
    (entry) => entry.teamId === choice.teamId,
  );
  if (choice.actionId !== 'special') {
    if (!team) {
      required('team');
      return true;
    }
    if (
      !teams[choice.actionId].includes(team.teamType) &&
      !exception('team-action')
    )
      return true;
  }
  const acknowledgement = [
    ...draft.acknowledgements,
    ...(choice.acknowledgements ?? []),
  ].find(
    (entry) =>
      entry.subjectId === `${choice.actionId}:${choice.choiceId}` &&
      entry.outcome.trim(),
  );
  if (!acknowledgement)
    required(`acknowledgement:${choice.actionId}:${choice.choiceId}`);
  const receipt = acknowledgement ? { ...acknowledgement } : null;
  const validLocation = (location: TrackedCharacter['location']) => {
    if (location.kind === 'headquarters') return true;
    if (location.kind === 'elsewhere') return exception('character-location');
    const settlement = result.outcome.settlements.find(
      (entry) => entry.settlementId === location.settlementId,
    );
    if (!settlement) {
      required('settlement');
      return false;
    }
    return (
      (settlement.refugeActivatedWeek !== null &&
        settlement.refugeActivatedWeek <= draft.week &&
        settlement.refugeActiveUntilWeek !== null &&
        settlement.refugeActiveUntilWeek >= draft.week) ||
      exception('active-refuge')
    );
  };
  const personFor = (characterId: string | undefined) => {
    if (
      !result.outcome.roster.people.some(
        (entry) => entry.characterId === characterId,
      ) ||
      !result.outcome.characters.some(
        (entry) => entry.characterId === characterId,
      )
    ) {
      required('character');
      return undefined;
    }
    const person = result.outcome.characterActions?.people.find(
      (entry) => entry.characterId === characterId,
    );
    if (!person) required('character-state');
    return person;
  };
  if (choice.actionId === 'special') {
    if (!choice.instruction) required('instruction');
    if (choice.costCopper === undefined) required('cost');
    if (!choice.instruction || choice.costCopper === undefined || !receipt)
      return true;
    if (helpers.spend(draft, result, choice, choice.costCopper))
      result.plan.push({
        kind: 'special_result',
        choiceId: choice.choiceId,
        instruction: choice.instruction,
        costCopper: choice.costCopper,
        acknowledgement: receipt,
      });
    return true;
  }
  if (
    choice.actionId === 'gather_information' ||
    choice.actionId === 'knowledge_check'
  ) {
    if (!choice.subject) required('subject');
    const total = helpers.check(
      draft,
      result,
      choice,
      'secrecy',
      choice.actionId === 'gather_information' ? 15 : undefined,
    );
    if (choice.actionId === 'gather_information')
      helpers.naturalOne(result, choice);
    if (choice.subject && total !== null && receipt)
      result.plan.push({
        kind: 'information',
        choiceId: choice.choiceId,
        subject: choice.subject,
        total,
        achievedDc: choice.actionId === 'knowledge_check' ? total : null,
        succeeded: choice.actionId === 'knowledge_check' || total >= 15,
        acknowledgement: receipt,
      });
    return true;
  }
  if (choice.actionId === 'strike_team') {
    if (!choice.mode) required('mode');
    if (!choice.location) required('location');
    if (!choice.mode || !choice.location || !receipt) return true;
    const common = {
      choiceId: choice.choiceId,
      location: choice.location,
      availableWeek: draft.week + 1,
      expiresWeek: draft.week + 1,
      uses: 1 as const,
      acknowledgement: receipt,
    };
    result.plan.push(
      choice.mode === 'support'
        ? {
            ...common,
            kind: 'strike_support',
            recipients: 'each_pc',
            bonusType: 'competence',
            attackBonus: 2,
            damageBonus: 2,
            saveBonus: 2,
            rounds: Math.max(1, Math.floor(result.outcome.rank / 2)),
          }
        : {
            ...common,
            kind: 'strike_extraction',
            stabilizeBleeding: true,
            gentleReposeCasterLevel: 12,
            extractBodiesTo: 'headquarters',
          },
    );
    return true;
  }
  if (choice.actionId === 'rescue_character') {
    const person = personFor(choice.characterId);
    if (!choice.destination) required('destination');
    if (!person || !choice.destination) return true;
    if (!validLocation(choice.destination)) return true;
    if (person.status !== 'captured' && !exception('character-captured'))
      return true;
    if (person.directRescueRequired && !exception('direct-rescue')) return true;
    const level = result.outcome.characters.find(
      (entry) => entry.characterId === person.characterId,
    )?.level;
    if (level === undefined || level === null) {
      required('character-level');
      return true;
    }
    if (choice.characterLevel !== undefined && choice.characterLevel !== level)
      result.warnings.push(`${choice.choiceId}:character-level`);
    if (!person.capture) {
      required('capture');
      return true;
    }
    if (person.capture.week > draft.week && !exception('capture-week'))
      return true;
    const dc =
      person.capture.source === 'raid' && person.capture.week + 1 === draft.week
        ? 5 + result.outcome.rank
        : 10 + level;
    const total = helpers.check(draft, result, choice, 'security', dc);
    if (total === null || !receipt) return true;
    const succeeded = total >= dc;
    helpers.value(
      result,
      choice,
      'notoriety',
      succeeded ? level : Math.floor(level / 2),
    );
    result.plan.push({
      kind: 'rescue_result',
      choiceId: choice.choiceId,
      characterId: person.characterId,
      dc,
      total,
      succeeded,
      acknowledgement: receipt,
    });
    if (succeeded)
      update(result, choice, person, {
        ...person,
        status: 'available',
        location: choice.destination,
        capture: null,
        rescuedWeek: draft.week,
      });
    return true;
  }
  if (!choice.mode) {
    required('mode');
    return true;
  }
  const party =
    choice.mode === 'ability_damage' ||
    choice.mode === 'hit_points' ||
    choice.mode === 'restorative_effect';
  if (choice.mode === 'restorative_effect') {
    if (!choice.effect) required('effect');
    if (choice.effectLevel === undefined) required('effect-level');
    if (!choice.effect || choice.effectLevel === undefined) return true;
    if (choice.effectLevel > 3 && !exception('restorative-level')) return true;
  }
  const ids = party
    ? result.outcome.roster.people
        .filter((entry) => entry.kind === 'pc')
        .map((entry) => entry.characterId)
    : [choice.characterId];
  if (!ids.length) {
    required('party');
    return true;
  }
  const targets = ids.map(personFor);
  if (targets.some((entry) => !entry)) return true;
  let valid = true;
  for (const person of targets) {
    if (!person) continue;
    if (person.status === 'captured' && !exception('character-captured'))
      valid = false;
    if (!validLocation(person.location)) valid = false;
  }
  if (choice.targetPresent === undefined) {
    required('target-present');
    valid = false;
  } else if (!choice.targetPresent && !exception('target-present'))
    valid = false;
  if (!valid || !receipt) return true;
  const cost =
    choice.mode in scrollCosts
      ? scrollCosts[choice.mode as keyof typeof scrollCosts]
      : 0;
  if (!helpers.spend(draft, result, choice, cost)) return true;
  result.plan.push({
    kind: 'restoration',
    choiceId: choice.choiceId,
    characterIds: targets.map((person) => person!.characterId),
    scope: party ? 'party' : 'individual',
    effect: choice.mode === 'restorative_effect' ? choice.effect! : choice.mode,
    effectLevel:
      choice.mode === 'restorative_effect' ? choice.effectLevel! : null,
    costCopper: cost,
    acknowledgement: receipt,
  });
  for (const person of targets)
    if (person)
      update(result, choice, person, {
        ...person,
        status:
          person.status === 'dead'
            ? choice.mode === 'raise_dead'
              ? 'recovering'
              : 'dead'
            : person.status === 'captured' || person.status === 'hidden'
              ? person.status
              : 'recovering',
        restoredWeek: draft.week,
      });
  return true;
}
