import {
  uneventfulCarryBlockers,
  type UneventfulCarryBlocker,
} from '~/lib/rules-event-selection';
import { invasionChallengeRating } from '~/lib/rules-threat-events';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import {
  codes,
  whatHappened,
  type EventPanelContext,
  type EventPanelItem,
} from './event-panel-context';
import { eventChange } from './event-messages';
import { eventName } from './event-tree-facts';
import { orderCarriedEvents, ordinal } from './persistent-sections';
import type {
  EventEndingChoice,
  EventOutcomeFamily,
  EventPanel,
  EventRetainedField,
  EventRetainedTarget,
} from './types';

type Item = EventPanelItem;
type Change = Item['changes'][number];
type Carried = WeeklyDraft['context']['carriedEvents'][number];
type Occurrence = Item['occurrence'];
type OutcomePanel = Extract<EventPanel, { family: 'outcome' }>;

const OUTCOME_FAMILIES: readonly EventOutcomeFamily[] = [
  'all_is_calm',
  'calm_before_the_storm',
  'high_morale',
  'invasion',
  'night_ops',
  'war_games',
  'week_of_pain',
  'week_of_serenity',
];

export function isOutcomeFamily(
  type: string | null,
): type is EventOutcomeFamily {
  return OUTCOME_FAMILIES.includes(type as EventOutcomeFamily);
}

const signed = (value: number) =>
  value < 0 ? `−${Math.abs(value)}` : `+${value}`;
const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? '' : 's'}`;

const carryReasons: Record<UneventfulCarryBlocker, string> = {
  first_week: 'the militia’s first week never counts',
  forced_calm: 'a calm forced by last week’s All Is Calm never counts',
  automatic_events: 'automatic events happen this week',
  two_events: 'more than one event happens this week',
  event: 'an event other than All Is Calm happens this week',
};

/**
 * Whether this week builds next week's uneventful chance bonus, and why not.
 * `carry` is the engine's answer: null until every Event roll and choice is
 * in; the reasons are read from the same rule the engine applies.
 */
export function uneventfulCarryText(
  context: Pick<EventPanelContext, 'draft' | 'projection'>,
  rank: number,
) {
  const projection = context.projection;
  const carry = projection?.nextUneventfulCarry ?? null;
  if (carry === null)
    return 'Whether this week counts as uneventful is settled once every roll and decision is in.';
  if (carry) return `Uneventful: next week’s event chance rises by ${rank}.`;
  const reasons = uneventfulCarryBlockers({
    firstMilitiaWeek: context.draft.context.firstMilitiaWeek,
    forcedCalm: projection?.forcedCalm ?? false,
    automaticEvents:
      projection?.positions.some((group) => group.kind === 'automatic') ??
      false,
    selected: projection?.selected ?? [],
  });
  return reasons.length
    ? `Not an uneventful week: ${reasons.map((reason) => carryReasons[reason]).join('; ')}.`
    : 'Not an uneventful week: no chance bonus next week.';
}

// When a queued effect applies, relative to the open week.
function inWeek(draft: WeeklyDraft, week: number) {
  return week === draft.week + 1
    ? `Next week (week ${week})`
    : week === draft.week
      ? `This week (week ${week})`
      : `Week ${week}`;
}

const checkNames = {
  loyalty: 'Loyalty',
  secrecy: 'Secrecy',
  security: 'Security',
};
const skillNames: Record<string, string> = {
  stealth: 'Stealth',
  knowledge_local: 'Knowledge (local)',
  bluff: 'Bluff',
  diplomacy: 'Diplomacy',
  intimidate: 'Intimidate',
};

/**
 * The occurrence's own changes as outcome lines, in the order the rules made
 * them. Queued check modifiers of one value and week read as one line, and
 * all three organization checks as "all organization checks".
 */
function outcomeLines(
  changes: readonly Change[],
  context: EventPanelContext,
  carriedName: (eventId: string) => string,
): string[] {
  const { draft } = context;
  const lines: string[] = [];
  const checkLines = new Map<string, { index: number; checks: string[] }>();
  for (const change of changes) {
    switch (change.kind) {
      case 'event_acknowledgement':
        break;
      case 'event_training':
        lines.push(
          `Training ${signed(change.after - change.before)}: ${change.before} → ${change.after}.`,
        );
        break;
      case 'event_end':
        lines.push(`${carriedName(change.endedEventId)} ends now.`);
        break;
      case 'event_encounter':
        lines.push(
          `The GM runs a combat encounter at CR ${change.challengeRating} (Average Party Level ${change.averagePartyLevel} + 1).`,
        );
        break;
      case 'event_skill_benefit': {
        const benefit = change.benefit;
        const skills = benefit.skills
          .map((skill) => skillNames[skill] ?? skill)
          .join(', ');
        lines.push(
          `${inWeek(draft, benefit.startsWeek)}: PCs gain ${signed(benefit.value)} ${benefit.bonusType} on ${skills}${benefit.afterDark ? ' after dark' : ''}.`,
        );
        break;
      }
      case 'event_queue': {
        const queued = change.effect;
        const effect = queued.effect;
        const when = inWeek(draft, queued.startsWeek);
        if (effect.kind === 'check_modifier') {
          const key = `${queued.startsWeek}:${effect.value}`;
          const entry = checkLines.get(key);
          if (entry) entry.checks.push(effect.check);
          else {
            checkLines.set(key, {
              index: lines.length,
              checks: [effect.check],
            });
            lines.push(key);
          }
        } else if (effect.kind === 'all_is_calm')
          lines.push(
            `${when} is calm: no event-chance roll and no rolled event, and it does not count as uneventful.`,
          );
        else if (effect.kind === 'automatic_events')
          lines.push(
            `${when}: ${plural(effect.count, 'automatic event')} before the normal Event roll.`,
          );
        else if (effect.kind === 'upkeep_loss_multiplier')
          lines.push(
            `${when}: Upkeep training loss is ${effect.value === 2 ? 'doubled' : `multiplied by ${effect.value}`}.`,
          );
        else if (effect.kind === 'activity_training_multiplier')
          lines.push(
            `${when}: Activity training gain is ${effect.value === 2 ? 'doubled' : `multiplied by ${effect.value}`}.`,
          );
        else lines.push(eventChange(change));
        break;
      }
      default:
        lines.push(eventChange(change));
    }
  }
  for (const [key, entry] of checkLines) {
    const [week, value] = key.split(':').map(Number) as [number, number];
    const all = ['loyalty', 'secrecy', 'security'].every((check) =>
      entry.checks.includes(check),
    );
    const names = all
      ? 'all organization checks'
      : `${entry.checks
          .map((check) => checkNames[check as keyof typeof checkNames])
          .join(', ')} checks`;
    lines[entry.index] = `${inWeek(draft, week)}: ${names} ${signed(value)}.`;
  }
  return lines;
}

/**
 * The calm, morale, narrative and training events: All Is Calm, Calm before
 * the Storm, High Morale, Invasion, Night Ops, War Games, Week of Pain and
 * Week of Serenity. Their outcome lines come from the engine's own changes;
 * High Morale's endings and Invasion's party level are their only inputs
 * besides What happened, which is required exactly where the engine asks.
 */
export function outcomePanel(
  item: Item,
  eventType: EventOutcomeFamily,
  context: EventPanelContext,
): OutcomePanel {
  const { has } = codes(item);
  const id = item.occurrence.eventId;
  const dispatch = context.projection?.dispatch ?? [];
  const position = (eventId: string) => {
    const index = dispatch.findIndex(
      (entry) => entry.event.eventId === eventId,
    );
    return index < 0 ? Number.POSITIVE_INFINITY : index;
  };
  const own = position(id);
  const first = dispatch.find(
    (entry) => entry.event.eventId === id,
  )?.firstEventId;
  const twiceOf =
    item.mode !== 'base' && item.mode !== null && first && first !== id
      ? first
      : null;
  const carriedName = carriedNames(context);
  const notes: string[] = [];
  if (twiceOf) {
    const label = context.eventLabel(twiceOf);
    if (item.mode === 'no_additional_effect')
      notes.push(`No additional effect: ${label} already applies this.`);
    else if (eventType === 'all_is_calm')
      notes.push(`Twice with ${label}: next week is calm too.`);
    else if (eventType === 'high_morale')
      notes.push(
        `Twice with ${label}: this one ends its own carried events; the combined Loyalty bonus is listed under ${label}.`,
      );
    else
      notes.push(
        `Twice with ${label}: the combined effect is listed under ${label}.`,
      );
  }
  const twins = dispatch.filter(
    (entry) =>
      entry.firstEventId === id &&
      entry.event.eventId !== id &&
      entry.mode === 'twice',
  );
  if (twins.length)
    notes.push(
      `Includes the Twice from ${twins.map((entry) => context.eventLabel(entry.event.eventId)).join(', ')}.`,
    );
  // War Games and Invasion never combine: each occurrence counts on its own.
  const earlier = dispatch.find(
    (entry) =>
      entry.event.eventType === eventType &&
      entry.event.eventId !== id &&
      position(entry.event.eventId) < own,
  );
  if (
    earlier &&
    item.mode === 'base' &&
    (eventType === 'war_games' || eventType === 'invasion')
  )
    notes.push(
      eventType === 'war_games'
        ? `Independent of ${context.eventLabel(earlier.event.eventId)}: each War Games adds its own training.`
        : `Independent of ${context.eventLabel(earlier.event.eventId)}: each Invasion is its own encounter.`,
    );
  if (eventType === 'all_is_calm' || eventType === 'calm_before_the_storm')
    notes.push(
      uneventfulCarryText(context, context.activity?.outcome.rank ?? 0),
    );

  const outcomes =
    eventType === 'all_is_calm' && item.mode === 'base'
      ? [
          'No event this week.',
          ...outcomeLines(item.changes, context, carriedName),
        ]
      : outcomeLines(item.changes, context, carriedName);
  const recorded = context.draft.acknowledgements.some(
    (entry) => entry.subjectId === `event:${id}`,
  );
  const accountHint: Partial<Record<EventOutcomeFamily, string>> = {
    invasion: 'How the encounter went at the table.',
    night_ops: 'What the night’s operations achieved.',
    war_games: 'The table’s outcome, in a sentence.',
    high_morale: 'The table’s outcome, in a sentence.',
  };
  // Calm events and the Weeks record no account; one recorded earlier stays
  // editable and clearable.
  const hint = accountHint[eventType];
  const account =
    hint || recorded || has('acknowledgement')
      ? whatHappened(
          item,
          context,
          hint ?? 'The table’s outcome, in a sentence.',
        )
      : null;
  const averagePartyLevel = item.occurrence.averagePartyLevel ?? null;
  return {
    family: 'outcome',
    eventType,
    endings:
      eventType === 'high_morale'
        ? endingChoice(item, context, { own, position, first, carriedName })
        : null,
    partyLevel:
      eventType === 'invasion'
        ? {
            value: averagePartyLevel,
            required: has('average-party-level'),
            challengeRating:
              averagePartyLevel === null
                ? null
                : invasionChallengeRating(averagePartyLevel),
          }
        : null,
    notes,
    whatHappened: account,
    outcomes,
    partial: item.requirements.some((code) => code.startsWith(`${id}:`)),
    retained: retainedFields(item.occurrence, eventType, context),
  };
}

// Carried events by identity, including ones this week makes persistent:
// "Theft (since week 9)".
function carriedNames(context: EventPanelContext) {
  const created = (context.projection?.plan ?? []).flatMap((change) =>
    change.kind === 'event_persistent' ? [change] : [],
  );
  return (eventId: string) => {
    const carried = context.draft.context.carriedEvents.find(
      (event) => event.eventId === eventId,
    );
    if (carried)
      return `${eventName(carried.eventType)} (since week ${carried.startedWeek})`;
    const made = created.find((change) => change.event.eventId === eventId);
    if (made)
      return `${eventName(made.event.eventType)} (from ${context.eventLabel(made.eventId)})`;
    return 'A carried event no longer recorded';
  };
}

// High Morale ends the carried events still current when it resolves: those
// carried in, less any Activity or earlier event ended, plus any an earlier
// event this week made persistent. Without a recorded choice the rules end
// the oldest; the Twice occurrence ends one more.
function endingChoice(
  item: Item,
  context: EventPanelContext,
  {
    own,
    position,
    first,
    carriedName,
  }: {
    own: number;
    position: (eventId: string) => number;
    first: string | undefined;
    carriedName: (eventId: string) => string;
  },
): EventEndingChoice {
  const id = item.occurrence.eventId;
  const plan = context.projection?.plan ?? [];
  const activityEnded = new Set(context.activity?.endedEventIds ?? []);
  const endedEarlier = new Set(
    plan.flatMap((change) =>
      change.kind === 'event_end' &&
      change.eventId !== id &&
      position(change.eventId) < own
        ? [change.endedEventId]
        : [],
    ),
  );
  const created = plan.flatMap((change) =>
    change.kind === 'event_persistent' &&
    Math.max(
      ...(change.event.sourceEventIds ?? [change.eventId]).map(position),
    ) < own
      ? [{ event: change.event, source: change.eventId }]
      : [],
  );
  const current: { event: Carried; source: string | null }[] = [
    ...context.draft.context.carriedEvents
      .filter((event) => !activityEnded.has(event.eventId))
      .map((event) => ({ event, source: null })),
    ...created,
  ].filter(({ event }) => !endedEarlier.has(event.eventId));
  const ordered = orderCarriedEvents(current.map(({ event }) => event));
  const twice = item.mode === 'twice' && first !== undefined && first !== id;
  const nominal = twice
    ? 2 -
      plan.filter(
        (change) => change.kind === 'event_end' && change.eventId === first,
      ).length
    : 1;
  const count = Math.max(0, Math.min(nominal, ordered.length));
  const recorded =
    item.occurrence.targets?.flatMap((target) =>
      target.kind === 'event' ? [target.eventId] : [],
    ) ?? [];
  const chosen = recorded.length > 0;
  const available = new Set(ordered.map((event) => event.eventId));
  const selected = chosen
    ? recorded.filter((eventId) => available.has(eventId))
    : item.changes.flatMap((change) =>
        change.kind === 'event_end' ? [change.endedEventId] : [],
      );
  const retained: EventRetainedTarget[] = recorded
    .filter((eventId) => !available.has(eventId))
    .map((eventId) => ({
      value: eventId,
      label: carriedName(eventId),
      reason: 'It is no longer current when this event resolves. Clear it.',
    }));
  const oldest =
    count === 1
      ? 'The oldest carried event ends'
      : `The ${count} oldest carried events end`;
  return {
    label:
      count > 1 ? 'Persistent events that end' : 'Persistent event that ends',
    hint: !ordered.length
      ? 'No carried persistent event is left to end. The Loyalty bonus still applies.'
      : count < nominal
        ? `Only ${plural(count, 'carried event')} ${count === 1 ? 'is' : 'are'} left to end, not ${nominal}. The Loyalty bonus still applies.`
        : chosen
          ? null
          : `${oldest} unless you choose ${count === 1 ? 'another' : 'others'}.`,
    required: codes(item).has('persistent-targets'),
    count,
    chosen,
    selected,
    choices: ordered.map((event) => {
      const source = current.find(
        (entry) => entry.event.eventId === event.eventId,
      )?.source;
      return {
        value: event.eventId,
        label: eventName(event.eventType) ?? 'A carried event',
        description: source
          ? `Persistent from ${context.eventLabel(source)}`
          : `Since week ${event.startedWeek} · ${ordinal(event.order + 1)} that week`,
      };
    }),
    retained,
  };
}

const decisionNames = {
  unattempted: 'Let it happen',
  mitigate: 'Mitigate',
  buyoff: 'Buy off',
  end: 'End',
} as const;

// Recorded inputs the event does not use, listed so each can be cleared.
function retainedFields(
  occurrence: Occurrence,
  eventType: EventOutcomeFamily,
  context: EventPanelContext,
): EventRetainedField[] {
  const fields: EventRetainedField[] = [];
  const unusedTargets = (occurrence.targets ?? []).filter(
    (target) => !(eventType === 'high_morale' && target.kind === 'event'),
  );
  if (unusedTargets.length)
    fields.push({
      field: 'targets',
      label: 'Targets',
      value: unusedTargets
        .map((target) => {
          switch (target.kind) {
            case 'team':
              return (
                context.teams.find((team) => team.teamId === target.teamId)
                  ?.name ?? 'A team'
              );
            case 'settlement':
              return (
                context.settlementName(target.settlementId) ?? 'A settlement'
              );
            case 'character':
              return context.personName(target.characterId) ?? 'A character';
            case 'event':
              return context.eventLabel(target.eventId);
            case 'item':
              return 'An item';
            case 'cache':
              return 'A cache';
          }
        })
        .join(', '),
    });
  if (eventType !== 'invasion' && occurrence.averagePartyLevel !== undefined)
    fields.push({
      field: 'averagePartyLevel',
      label: 'Average Party Level',
      value: String(occurrence.averagePartyLevel),
    });
  if (occurrence.mitigation)
    fields.push({
      field: 'mitigation',
      label: 'Mitigation',
      value:
        occurrence.mitigation === 'attempted' ? 'Attempted' : 'Let it happen',
    });
  if (occurrence.rolls && Object.keys(occurrence.rolls).length)
    fields.push({
      field: 'rolls',
      label: 'Rolls',
      value: Object.keys(occurrence.rolls)
        .map((name) => `${name} roll`)
        .join(', '),
    });
  if (occurrence.officerCheck)
    fields.push({
      field: 'officerCheck',
      label: 'Officer check',
      value:
        context.personName(occurrence.officerCheck.characterId) ??
        'An unnamed character',
    });
  if (occurrence.targetChecks?.length)
    fields.push({
      field: 'targetChecks',
      label: 'Target checks',
      value: plural(occurrence.targetChecks.length, 'check'),
    });
  if (occurrence.rewards?.length)
    fields.push({
      field: 'rewards',
      label: 'Rewards',
      value: occurrence.rewards.map((reward) => reward.name).join(', '),
    });
  if (occurrence.persistent !== undefined)
    fields.push({
      field: 'persistent',
      label: 'Persistent flag',
      value: occurrence.persistent ? 'Persistent' : 'Not persistent',
    });
  if (occurrence.persistentDecision)
    fields.push({
      field: 'persistentDecision',
      label: 'Persistent decision',
      value: decisionNames[occurrence.persistentDecision.kind],
    });
  if (occurrence.strategistCharacterId)
    fields.push({
      field: 'strategistCharacterId',
      label: 'Strategist',
      value:
        context.personName(occurrence.strategistCharacterId) ??
        'An unnamed character',
    });
  return fields;
}

/**
 * Event-identified wording for a code of a calm, morale, narrative or
 * training event; null leaves it to the general wording.
 */
export function outcomePanelMessage(
  panel: OutcomePanel,
  tail: string,
): string | null {
  if (tail === 'average-party-level') return 'enter the Average Party Level.';
  if (tail === 'persistent-targets' && panel.endings) {
    const { count } = panel.endings;
    if (count === 0)
      return 'no carried event is left to end. Clear the recorded choice.';
    return count === 1
      ? 'choose the carried event that ends.'
      : `choose the ${count} carried events that end.`;
  }
  return null;
}

/**
 * The ended carried events to record after pressing one card: it replaces
 * the choice when one event ends, and toggles within the recorded choice
 * when more end, dropping the earliest pick beyond the count. Starting from
 * the rules' default, a press starts a fresh choice.
 */
export function pressEnding(endings: EventEndingChoice, value: string) {
  if (endings.count <= 1) return [value];
  const recorded = endings.chosen ? endings.selected : [];
  if (recorded.includes(value))
    return recorded.filter((entry) => entry !== value);
  return [...recorded, value].slice(-endings.count);
}

/** The recorded ending choice without one entry, kept or no longer current. */
export function endingsWithout(endings: EventEndingChoice, value: string) {
  return [
    ...(endings.chosen ? endings.selected : []),
    ...endings.retained.map((entry) => entry.value),
  ].filter((entry) => entry !== value);
}
