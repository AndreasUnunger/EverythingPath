import type { EventPositionGroup } from '~/lib/rules-event-selection';
import type { EventView } from './types';

type TopologyContext = {
  positions: readonly EventPositionGroup[];
  events: { eventId: string; sabotageId: string | null; label: string }[];
  candidateLabel: (choiceId: string) => string | null;
  sourceLabel: (sourceId: string) => string;
  settlementName: string | null;
  preparationFailed: boolean;
  warning: boolean;
};

// Wording for one Event requirement or warning that names its event, source
// or Activity choice, so This phase and each block identify what is open.
// Returns null for codes Event does not own.
export function eventTopologyMessage(
  code: string,
  context: TopologyContext,
): string | null {
  const preparing = context.preparationFailed
    ? 'could not be prepared. Use Retry in Event.'
    : 'is being prepared.';
  const overfull = (match: (group: EventPositionGroup) => boolean) =>
    context.positions.some(
      (group) => match(group) && group.eventIds.length > group.count,
    );
  if (code === 'event:chance:1d100')
    return 'Event chance: enter the chance roll (d100).';
  if (code === 'event:chance:roll-range')
    return 'Event chance: the roll is outside 1–100. The recorded value is kept for the table.';
  if (code === 'event:operating-settlement')
    return `Event chance: record ${context.settlementName ?? 'the operating settlement'}’s reputation, or choose another operating settlement in Activity.`;
  if (code === 'event:root:1')
    return overfull((group) => group.kind === 'rolled')
      ? 'The event: more than one rolled event is recorded. Clear the extra one to remove it.'
      : `The event: the rolled event ${preparing}`;
  const automatic = /^(.*):automatic-events:(\d+)$/.exec(code);
  if (automatic) {
    const label = context.sourceLabel(automatic[1]!);
    return overfull(
      (group) => group.kind === 'automatic' && group.sourceId === automatic[1],
    )
      ? `Automatic events from ${label}: more are recorded than the rules ask for. Clear the extra one to remove it.`
      : `Automatic events from ${label}: the ${automatic[2] === '1' ? 'event' : `${automatic[2]} events`} ${preparing}`;
  }
  for (const suffix of ['candidates:2', 'selected-event'] as const) {
    if (!code.endsWith(`:${suffix}`)) continue;
    const choiceId = code.slice(0, -suffix.length - 1);
    const label = context.candidateLabel(choiceId);
    if (!label) continue;
    if (suffix === 'selected-event')
      return `${label}: choose which event happens.`;
    return overfull(
      (group) => group.kind === 'candidates' && group.choiceId === choiceId,
    )
      ? `${label}: more than two candidates are recorded. Clear the extra one to remove it.`
      : `${label}: both event candidates ${preparing.replace('is ', 'are ')}`;
  }
  // The longest matching identity owns the code: an event or its Sabotage.
  const owner = context.events
    .flatMap((event) =>
      [event.eventId, event.sabotageId].flatMap((id) =>
        id && code.startsWith(`${id}:`) ? [{ id, event }] : [],
      ),
    )
    .sort((a, b) => b.id.length - a.id.length)[0];
  if (!owner) return null;
  const tail = code.slice(owner.id.length + 1);
  const prefix = `${owner.event.label}: `;
  if (tail === 'table:1d100') return `${prefix}enter the table roll (d100).`;
  if (tail === 'roll_twice:2')
    return overfull(
      (group) =>
        group.kind === 'roll_twice' && group.parentEventId === owner.id,
    )
      ? `${prefix}more than two Roll Twice events are recorded. Clear the extra one to remove it.`
      : `${prefix}its two Roll Twice events ${preparing.replace('is ', 'are ')}`;
  if (tail === 'replacement:1') {
    const group = context.positions.find(
      (entry) =>
        entry.kind === 'replacement' && entry.parentEventId === owner.id,
    );
    if (group && 'reroll' in group && group.reroll && !group.eventIds.length)
      return `${prefix}Roll Twice again: reroll and enter the new die.`;
    return overfull(
      (entry) =>
        entry.kind === 'replacement' && entry.parentEventId === owner.id,
    )
      ? `${prefix}more than one replacement is recorded. Clear the extra one to remove it.`
      : `${prefix}its replacement event ${preparing}`;
  }
  if (tail === 'automatic-event-source')
    return `${prefix}no automatic event is due from its source this week. Clear it to remove it.`;
  if (tail === 'event-eligibility')
    return `${prefix}cannot normally occur now. Roll its replacement, or keep it with a reasoned Rules Exception.`;
  const text = context.warning ? eventWarning(code) : eventRequirement(code);
  return `${prefix}${text}`;
}
export function eventRequirement(value: string) {
  const dice = /(?:^|:)([\w-]+):(\d+)d(\d+)$/.exec(value);
  if (dice) {
    const labels: Record<string, string> = {
      table: 'Event table roll',
      chance: 'Event chance roll',
      check: 'Check',
      loss: 'Loss roll',
      notoriety: 'Notoriety roll',
      capture: 'Capture roll',
      mitigation: 'Target mitigation check',
      sickness: 'Sickness check',
      theft: 'Theft check',
      rivalry: 'Rivalry officer check',
      diplomacy: 'Diplomacy officer check',
    };
    return `${labels[dice[1]!] ?? 'Required roll'}: enter ${dice[2]}d${dice[3]}.`;
  }
  const messages: [string, string][] = [
    ['roll_twice', 'Roll Twice needs two independent child events.'],
    ['replacement', 'A replacement event roll is required.'],
    ['acknowledgement', 'Record the table’s outcome acknowledgement.'],
    ['automatic-events', 'Add the required automatic event occurrences.'],
    ['automatic-event-source', 'Select an available automatic event source.'],
    ['event:root:1', 'Add one rolled event.'],
    ['average-party-level', 'Enter the average party level.'],
    ['skill-bonus', 'Enter the officer’s skill bonus.'],
    ['officer-check', 'Supply an officer check.'],
    ['exception', 'Record a reasoned exception or revise the selection.'],
    ['same-team', 'Choose the same team as the first occurrence.'],
    ['same-settlement', 'Choose the same settlement as the first occurrence.'],
    ['mitigation-target', 'Choose a target for mitigation.'],
    [
      'persistent-targets',
      'Choose the persistent events affected by this outcome.',
    ],
    ['tracked-people', 'Choose the affected tracked characters.'],
    ['recipient', 'Choose an active player character as the reward recipient.'],
    ['duplicate', 'Each reward needs its own item identity.'],
    ['reward', 'Record the required character rewards.'],
    ['selected-event', 'Select an Activity event candidate.'],
    ['candidates', 'Complete both Activity event candidates.'],
    ['settlement', 'Choose the affected settlement.'],
    ['team', 'Choose the affected team or teams.'],
    ['officer', 'Choose the officer for this check.'],
    ['cache', 'Choose the affected cache and review its contents.'],
    ['item', 'Choose the affected item.'],
    ['outcome', 'Record the event outcome.'],
    ['check-type', 'Choose the reactive action’s check.'],
  ];
  return (
    messages.find(([key]) => value.includes(key))?.[1] ??
    'An earlier phase or event decision needs attention.'
  );
}
export function eventWarning(value: string) {
  if (value.endsWith('roll-range'))
    return 'The roll is outside its usual range. The recorded value is retained for the table.';
  if (value.endsWith('calculated-event'))
    return 'The event type follows the modified table roll.';
  if (value.includes('alchemical-reward'))
    return 'The reward differs from the permitted alchemical item. Record an exception or revise it.';
  if (value.endsWith('event-eligibility'))
    return 'This event cannot normally occur in the current militia state. Supply a replacement or a reasoned exception.';
  return 'Review this event’s target, officer or team eligibility with the table.';
}
export function eventChange(
  change: EventView['occurrences'][number]['changes'][number],
) {
  if (
    'before' in change &&
    'after' in change &&
    (typeof change.before === 'string' || typeof change.before === 'number') &&
    (typeof change.after === 'string' || typeof change.after === 'number')
  ) {
    const labels: Record<string, string> = {
      event_treasury: 'Treasury (copper)',
      event_training: 'Training',
      event_team_status: 'Team condition',
      event_team_recovery: 'Team condition',
      event_reputation: 'Settlement reputation',
    };
    return `${labels[change.kind] ?? 'Outcome'}: ${String(change.before)} → ${String(change.after)}`;
  }
  const labels: Record<string, string> = {
    event_queue: 'An effect carries into future weeks.',
    event_persistent: 'A persistent event carries forward.',
    event_end: 'A persistent event ends.',
    event_item: 'A character receives the recorded item.',
    event_identification: 'The recorded item is identified.',
    event_acknowledgement: 'The table outcome is recorded.',
    event_activity_bonus: 'The event changes the Activity allowance.',
    event_capture: 'Character capture is resolved.',
    event_loss: 'The event records a loss.',
    event_check_bonus: 'The event grants a check bonus.',
    event_skill_benefit: 'The event grants a skill benefit.',
    event_market_benefit: 'The event grants market access.',
  };
  return (
    labels[change.kind] ?? 'The event outcome is included in the week preview.'
  );
}
