import type { EventView } from './types';
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
    return 'A die is outside its usual range. Your entered value is retained for the table.';
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
