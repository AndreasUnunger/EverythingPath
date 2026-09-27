import type { PersistentView } from './types';
export function persistentMessage(key: string) {
  const messages: Record<string, string> = {
    'buyoff-cooldown':
      'Another buyoff falls within the militia’s four-week waiting period. Record an exception or revise the decision.',
    treasury:
      'The treasury cannot cover this buyoff. Record an exception or revise the decision.',
    'buyoff-cost-recomputed':
      'The recorded amount differs from the projected buyoff cost. The rules cost is used.',
    'persistent-ending':
      'This recorded ending needs the table’s reasoned exception.',
    'officer-assignment':
      'The selected character is not currently an officer. Record an exception or choose an officer.',
    'persistent-phase':
      'No event was carried into this week. This decision needs a reasoned exception.',
    'roll-range':
      'The roll is outside its usual range. The recorded value is retained for the table.',
  };
  return (
    messages[key.split(':').at(-1)!] ??
    'Review this event’s decision with the table.'
  );
}
export function PersistentOutcomes({
  event,
  options,
}: {
  event: PersistentView['events'][number];
  options: PersistentView['options'];
}) {
  const inputs = event.decision?.kind === 'mitigate' ? event.decision : null;
  const modifiers = [
    ...(inputs?.officerCheck?.roll?.modifiers ?? []),
    ...Object.values(inputs?.rolls ?? {}).flatMap(
      (roll) => roll?.modifiers ?? [],
    ),
  ];
  const names: Record<string, string> = {
    'rank-focus': 'Rank and focus',
    officers: 'Officers',
    'overseer-support': 'Overseer support',
    strategist: 'Strategist',
    helpful: 'Helpful settlement support',
  };
  return (
    <div className="space-y-2 text-sm">
      {event.checks.map((check) => (
        <div key={check.checkId}>
          <p>
            Calculated bonus: {check.modifier >= 0 ? '+' : ''}
            {check.modifier} · Total: {check.total ?? 'Awaiting roll'} · DC 20
          </p>
          <ul
            aria-label="Persistent check modifiers"
            className="text-muted-foreground text-xs"
          >
            {check.modifiers.map((modifier) => (
              <li key={modifier.source}>
                {modifiers.find((input) => input.sourceId === modifier.source)
                  ?.reason ??
                  options.modifierSources?.find(
                    (option) => option.value === modifier.source,
                  )?.label ??
                  names[modifier.source] ??
                  'Calculated modifier'}
                : {modifier.value >= 0 ? '+' : ''}
                {modifier.value}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {event.changes.map((change) => {
        if (change.kind === 'persistent_buyoff')
          return (
            <p key={change.kind}>Buyoff staged: {change.costCopper} cp.</p>
          );
        if (change.kind === 'persistent_officer_check')
          return (
            <p key={change.kind}>
              Officer check: {change.total} / DC {change.dc} —{' '}
              {change.succeeded ? 'ends the event.' : 'the event remains.'}
            </p>
          );
        if (change.kind === 'persistent_mitigation')
          return (
            <p key={change.kind}>
              Temporary mitigation: {change.total} / DC {change.dc} —{' '}
              {change.succeeded
                ? 'retains 90% of this week’s income.'
                : 'the usual loss applies.'}
            </p>
          );
        return null;
      })}
    </div>
  );
}
