import type { ActivityProjection } from '~/lib/rules-activity';
import { raidRescueDc } from '~/lib/rules-character-actions';
import { eventMitigationAttempted } from '~/lib/rules-event-checks';
import type { EventOutcomeProjection } from '~/lib/rules-event-outcomes';
import { isRefugeActive } from '~/lib/rules-settlements';
import {
  RAID_CAPTURE_CHANCE,
  RAID_SECURITY_DC,
  SICKNESS_TWICE_LOYALTY_DC,
} from '~/lib/rules-threat-events';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import { actionChoiceEvents, type RawRoll } from '~/lib/weekly-draft-facts';
import { eventCheckFacts } from './event-check-facts';
import { eventChange } from './event-messages';
import type {
  ActivityTeamFact,
  EventOccurrenceFacts,
  EventPanel,
  EventRaidPerson,
  EventRetainedTarget,
  EventTargetCard,
  EventTargetChoice,
  EventWhatHappened,
} from './types';

type Item = Omit<EventOccurrenceFacts, 'panel'>;
type Change = Item['changes'][number];
type TeamFamily = Extract<EventPanel, { family: 'team' }>['eventType'];

// What the event-specific controls need beyond the occurrence itself. Teams,
// refuges and hidden people are read after Activity: events before this one
// in the week never add them, and the rules stop a second Raid on a refuge
// the first one closed.
export type EventPanelContext = {
  draft: WeeklyDraft;
  projection: EventOutcomeProjection | undefined;
  activity: ActivityProjection | undefined;
  teams: ActivityTeamFact[];
  personName: (characterId: string) => string | null;
  settlementName: (settlementId: string) => string | null;
  // "Event 3 · Sickness"
  eventLabel: (eventId: string) => string;
  modifierLabel: (source: string, recorded: RawRoll | undefined) => string;
};

const TEAM_FAMILIES: readonly TeamFamily[] = [
  'missing_in_action',
  'sickness',
  'turn_around',
];

/**
 * The event-specific controls of one occurrence: Missing in Action,
 * Sickness, Turn Around and Raid. Other families return null and keep the
 * general details editor until their own controls ship.
 */
export function eventPanel(
  item: Item,
  context: EventPanelContext,
): EventPanel | null {
  const type = item.resolvedType;
  if (type === 'raid') return raidPanel(item, context);
  if (TEAM_FAMILIES.includes(type as TeamFamily))
    return teamPanel(item, type as TeamFamily, context);
  return null;
}

function codes(item: Item) {
  const id = item.occurrence.eventId;
  return {
    has: (tail: string) => item.requirements.includes(`${id}:${tail}`),
  };
}

function whatHappened(
  item: Item,
  context: EventPanelContext,
  hint: string,
): EventWhatHappened {
  const subjectId = `event:${item.occurrence.eventId}`;
  const recorded = context.draft.acknowledgements.find(
    (entry) => entry.subjectId === subjectId,
  );
  return {
    subjectId,
    // The rules ask for it while it is missing, and use it once recorded.
    required:
      codes(item).has('acknowledgement') ||
      item.changes.some((change) => change.kind === 'event_acknowledgement'),
    hint,
    acknowledgement: recorded
      ? {
          acknowledgementId: recorded.acknowledgementId,
          outcome: recorded.outcome,
        }
      : null,
  };
}

function teamName(context: EventPanelContext, teamId: string) {
  return context.teams.find((team) => team.teamId === teamId)?.name ?? null;
}

const conditionWords: Record<string, string> = {
  active: 'Active',
  disabled: 'Disabled',
  missing: 'Missing',
};

// The first occurrence of this event type when this one is its Twice.
function firstOccurrence(item: Item, context: EventPanelContext) {
  if (item.mode !== 'twice') return null;
  const first = context.projection?.dispatch.find(
    (entry) => entry.event.eventId === item.occurrence.eventId,
  )?.firstEventId;
  if (!first || first === item.occurrence.eventId) return null;
  const event = [
    ...context.draft.event.occurrences,
    ...context.draft.activity.slots.flatMap((slot) =>
      actionChoiceEvents(slot.choice),
    ),
  ].find((entry) => entry.eventId === first);
  return {
    eventId: first,
    label: context.eventLabel(first),
    teamIds:
      event?.targets?.flatMap((target) =>
        target.kind === 'team' ? [target.teamId] : [],
      ) ?? [],
  };
}

// One recorded target of a kind is the selection; any other recorded one
// (a second target, or one no longer known) stays until cleared.
function targetChoice({
  label,
  hint,
  required,
  recorded,
  choices,
  name,
  missing,
}: {
  label: string;
  hint: string | null;
  required: boolean;
  recorded: string[];
  choices: EventTargetCard[];
  name: (value: string) => string | null;
  // What a recorded target no longer known is called and why it stays.
  missing: { label: string; reason: string };
}): EventTargetChoice {
  const [only] = recorded;
  const known = (value: string) =>
    choices.some((choice) => choice.value === value);
  const selected =
    recorded.length === 1 && only !== undefined && known(only) ? only : null;
  const retained: EventRetainedTarget[] = recorded.flatMap((value) =>
    value === selected
      ? []
      : [
          known(value)
            ? {
                value,
                label: name(value) ?? missing.label,
                reason: `Only one is affected. Choose it, or clear this one.`,
              }
            : {
                value,
                label: name(value) ?? missing.label,
                reason: missing.reason,
              },
        ],
  );
  return { label, hint, required, selected, choices, retained };
}

function teamChoice({
  item,
  context,
  label,
  hint,
  required,
  describe,
}: {
  item: Item;
  context: EventPanelContext;
  label: string;
  hint: string | null;
  required: boolean;
  describe: (team: ActivityTeamFact) => (string | null | undefined)[];
}): EventTargetChoice {
  return targetChoice({
    label,
    hint,
    required,
    recorded:
      item.occurrence.targets?.flatMap((target) =>
        target.kind === 'team' ? [target.teamId] : [],
      ) ?? [],
    choices: context.teams.map((team) => ({
      value: team.teamId,
      label: team.name,
      description: [
        team.typeName && team.tier !== null
          ? `${team.typeName} · tier ${team.tier}`
          : team.typeName,
        ...describe(team),
      ]
        .filter(Boolean)
        .join(' · '),
    })),
    name: (teamId) => teamName(context, teamId),
    missing: {
      label: 'A team no longer on the roster',
      reason:
        'This team is no longer on the roster. Clear it or choose another team.',
    },
  });
}

// Turn Around recovers every disabled team; only without one does a team
// gain the bonus. A team recorded before a recovery stays until cleared.
function turnAroundTeam(
  item: Item,
  context: EventPanelContext,
  describe: (team: ActivityTeamFact) => (string | null | undefined)[],
): EventTargetChoice {
  const recovered = item.changes.some(
    (change) => change.kind === 'event_team_recovery',
  );
  const team = teamChoice({
    item,
    context,
    label: 'Team that gains +2 on one check next Activity',
    hint: recovered
      ? 'Disabled teams recover instead, so no team gains the bonus.'
      : 'No team is disabled, so one team gains the bonus.',
    required: codes(item).has('team'),
    describe,
  });
  if (!recovered) return team;
  const unused = team.selected
    ? [
        {
          value: team.selected,
          label: teamName(context, team.selected) ?? 'A team',
          reason: 'Not used: disabled teams recover instead.',
        },
      ]
    : [];
  return {
    ...team,
    selected: null,
    choices: [],
    retained: [...unused, ...team.retained],
  };
}

function teamPanel(
  item: Item,
  eventType: TeamFamily,
  context: EventPanelContext,
): EventPanel {
  const { has } = codes(item);
  const occurrence = item.occurrence;
  const first = firstOccurrence(item, context);
  const used = new Set(context.activity?.teamUse.usedTeamIds ?? []);
  const describe = (team: ActivityTeamFact) => [
    used.has(team.teamId) ? 'Acted this week' : 'Did not act this week',
    team.condition !== 'active' ? conditionWords[team.condition] : null,
    first?.teamIds.includes(team.teamId) ? `Chosen in ${first.label}` : null,
  ];
  const sameAsFirst = first ? `The same team as ${first.label}.` : null;
  const team =
    eventType === 'turn_around'
      ? turnAroundTeam(item, context, describe)
      : teamChoice({
          item,
          context,
          label:
            eventType === 'sickness'
              ? 'Team that falls sick'
              : 'Team that goes missing',
          hint:
            sameAsFirst ??
            (eventType === 'sickness'
              ? 'A random team.'
              : 'A random team that acted this week.'),
          required: has('team') || has('same-team'),
          describe,
        });
  const sicknessSave = eventType === 'sickness' && item.mode === 'twice';
  const roll = occurrence.rolls?.check;
  const check = sicknessSave
    ? eventCheckFacts({
        checkId: `${occurrence.eventId}:sickness`,
        check: 'loyalty',
        dc: SICKNESS_TWICE_LOYALTY_DC,
        target: null,
        mandatory: true,
        projected: context.projection?.checks.find(
          (entry) => entry.checkId === `${occurrence.eventId}:sickness`,
        ),
        requirements: item.requirements,
        recorded: roll,
        modifierLabel: context.modifierLabel,
        result: {
          success: 'The team stays, disabled.',
          failure: 'The team is lost.',
        },
      })
    : null;
  return {
    family: 'team',
    eventType,
    team,
    check,
    checkRoll: roll,
    retainedCheck: !sicknessSave && Boolean(roll),
    whatHappened: whatHappened(
      item,
      context,
      eventType === 'turn_around'
        ? 'What the table made of it.'
        : 'How the team was picked, and what the table made of it.',
    ),
    outcomes: item.changes.flatMap((change) => outcomeLine(change, context)),
  };
}

function raidPanel(item: Item, context: EventPanelContext): EventPanel {
  const { has } = codes(item);
  const occurrence = item.occurrence;
  const eventId = occurrence.eventId;
  const week = context.draft.week;
  const towns = context.activity?.outcome.settlements ?? [];
  const people = context.activity?.outcome.characterActions?.people ?? [];
  const hiddenIn = (settlementId: string) =>
    people.filter(
      (person) =>
        person.status === 'hidden' &&
        person.location.kind === 'refuge' &&
        person.location.settlementId === settlementId,
    );
  const recorded =
    occurrence.targets?.flatMap((target) =>
      target.kind === 'settlement' ? [target.settlementId] : [],
    ) ?? [];
  const choices: EventTargetCard[] = towns
    .filter(
      (town) =>
        isRefugeActive(town, week) || recorded.includes(town.settlementId),
    )
    .map((town) => {
      const count = hiddenIn(town.settlementId).length;
      return {
        value: town.settlementId,
        label: town.name,
        description: [
          isRefugeActive(town, week) ? 'Active refuge' : 'No active refuge',
          `${count} hidden ${count === 1 ? 'person' : 'people'}`,
        ].join(' · '),
      };
    });
  const settlement = targetChoice({
    label: 'Settlement raided',
    hint: 'A random settlement with an active refuge.',
    required: has('settlement'),
    recorded,
    choices,
    name: context.settlementName,
    missing: {
      label: 'A settlement no longer in this campaign',
      reason:
        'This settlement is no longer in the campaign. Clear it or choose another.',
    },
  });
  const selected = settlement.selected;
  const inputs = occurrence.targetChecks ?? [];
  const hidden = selected ? hiddenIn(selected) : [];
  const name = (characterId: string) =>
    context.personName(characterId) ?? 'An unnamed character';
  const raidPeople: EventRaidPerson[] = hidden.map((person) => {
    const input = inputs.find(
      (entry) =>
        entry.target.kind === 'character' &&
        entry.target.characterId === person.characterId,
    );
    const checkRoll = input?.rolls?.check;
    const attempted = eventMitigationAttempted(
      input?.mitigation ?? occurrence.mitigation,
      checkRoll ?? occurrence.rolls?.check,
    );
    const checkId = `${eventId}:${person.characterId}:mitigation`;
    const check = eventCheckFacts({
      checkId,
      check: 'security',
      dc: RAID_SECURITY_DC,
      target: name(person.characterId),
      mandatory: false,
      projected: context.projection?.checks.find(
        (entry) => entry.checkId === checkId,
      ),
      requirements: item.requirements,
      recorded: checkRoll,
      overseerRecorded: Boolean(input?.overseerCharacterId),
      modifierLabel: context.modifierLabel,
      result: {
        success: `Capture chance falls to ${RAID_CAPTURE_CHANCE.mitigated}%.`,
        failure: 'The check fails: capture is certain.',
      },
    });
    const capture = item.changes.find(
      (change) =>
        change.kind === 'event_capture' &&
        change.characterId === person.characterId,
    );
    const mitigated = attempted && check.succeeded === true;
    return {
      characterId: person.characterId,
      name: name(person.characterId),
      mitigation: attempted ? 'attempted' : 'unattempted',
      explicit: input?.mitigation !== undefined,
      check,
      checkRoll,
      capture: {
        applies: mitigated,
        chance:
          capture?.kind === 'event_capture'
            ? capture.chance
            : attempted && check.succeeded === null
              ? null
              : mitigated
                ? RAID_CAPTURE_CHANCE.mitigated
                : RAID_CAPTURE_CHANCE.unmitigated,
        recorded: input?.rolls?.loss,
        required: has(`${person.characterId}:capture:1d100`),
      },
    };
  });
  const retainedPeople = inputs.flatMap((entry, index) => {
    const target = entry.target;
    if (
      target.kind === 'character' &&
      hidden.some((person) => person.characterId === target.characterId)
    )
      return [];
    return [
      {
        index,
        value:
          target.kind === 'character' ? target.characterId : `entry:${index}`,
        label:
          target.kind === 'character'
            ? name(target.characterId)
            : 'A check that names no person',
        reason: selected
          ? 'Not hidden in this refuge. Remove this recorded check.'
          : 'Kept until a settlement is chosen.',
      },
    ];
  });
  return {
    family: 'raid',
    settlement,
    people: raidPeople,
    retainedPeople,
    legacyMitigation: occurrence.mitigation ?? null,
    legacyCheckRoll: Boolean(occurrence.rolls?.check),
    noPeople:
      selected && !hidden.length
        ? has('tracked-people')
          ? 'Hidden people are not tracked for this militia yet.'
          : 'Nobody is hidden in this refuge, so nobody can be captured.'
        : null,
    whatHappened: whatHappened(
      item,
      context,
      'How the settlement was picked, and what the table made of it.',
    ),
    outcomes: item.changes.flatMap((change) => outcomeLine(change, context)),
  };
}

// The occurrence's own changes in the order the rules made them.
function outcomeLine(change: Change, context: EventPanelContext): string[] {
  const team = (teamId: string) =>
    teamName(context, teamId) ?? 'A team no longer on the roster';
  const person = (characterId: string) =>
    context.personName(characterId) ?? 'An unnamed character';
  switch (change.kind) {
    case 'event_acknowledgement':
      return [];
    case 'event_team_status':
    case 'event_team_recovery':
      return [
        `${team(change.teamId)}: ${conditionWords[change.before] ?? change.before} → ${conditionWords[change.after] ?? change.after}.`,
      ];
    case 'event_team_loss':
      return [`${team(change.teamId)} is lost.`];
    case 'event_check_bonus':
      return [
        `${change.bonus.teamId ? team(change.bonus.teamId) : 'A team'} gains +${change.bonus.value} on one check next Activity.`,
      ];
    case 'event_queue': {
      const effect = change.effect.effect;
      if (effect.kind === 'team_unavailable')
        return [
          `${team(effect.teamId)} is unavailable in week ${change.effect.startsWeek}.`,
        ];
      if (effect.kind === 'team_return')
        return [
          `${team(effect.teamId)} returns at the end of week ${change.effect.endsWeek}, ${effect.status === 'disabled' ? 'disabled' : 'active'}.`,
        ];
      return [eventChange(change)];
    }
    case 'event_refuge':
      return [
        `All refuges in ${context.settlementName(change.settlementId) ?? 'the settlement'} deactivate.`,
      ];
    case 'event_capture':
      return [
        change.roll === null
          ? `${person(change.characterId)} is captured: without a successful Security check capture is certain.`
          : `${person(change.characterId)} ${change.captured ? 'is captured' : 'escapes'}: capture roll ${change.roll} against ${change.chance}% or less.`,
      ];
    case 'event_person':
      return change.after.status === 'captured'
        ? [
            `${person(change.after.characterId)} can be recovered next week with Rescue Character at DC ${raidRescueDc(context.projection?.outcome.rank ?? 0)}.`,
          ]
        : [];
    default:
      return [eventChange(change)];
  }
}

/**
 * Event-identified wording for a requirement or warning of an occurrence
 * with event-specific controls; null leaves the code to the general wording.
 * `tail` is the code after `<eventId>:`.
 */
export function eventPanelMessage(
  panel: EventPanel,
  tail: string,
  warning: boolean,
): string | null {
  if (tail === 'acknowledgement') return 'record what happened.';
  if (panel.family === 'team') {
    if (tail === 'team' || tail === 'same-team')
      return panel.team
        ? `choose the ${panel.team.label.toLowerCase()}.${tail === 'same-team' && panel.team.hint ? ` ${panel.team.hint}` : ''}`
        : null;
    if (tail === 'team-operated')
      return 'the chosen team did not act this week.';
    if (tail === 'team-operated:exception')
      return warning
        ? 'the chosen team did not act this week.'
        : 'the chosen team did not act this week. Record a reasoned Rules Exception or choose a team that did.';
    if (/^sickness:(roll|\d+d\d+)$/.test(tail))
      return 'enter the Loyalty check (d20).';
    return null;
  }
  if (tail === 'settlement') return 'choose the raided settlement.';
  if (tail === 'tracked-people')
    return 'record who is hidden in the refuge before the Raid resolves.';
  if (tail === 'mitigation-target')
    return 'a recorded Security check names someone not hidden in this refuge. Remove it.';
  const person = /^(.+):(mitigation|capture):(roll|\d+d\d+)$/.exec(tail);
  if (person) {
    const entry = panel.people.find(
      (candidate) => candidate.characterId === person[1],
    );
    const name = entry?.name ?? 'a hidden person';
    return person[2] === 'mitigation'
      ? `enter the Security check for ${name} (d20).`
      : `enter the capture roll for ${name} (d100).`;
  }
  return null;
}
