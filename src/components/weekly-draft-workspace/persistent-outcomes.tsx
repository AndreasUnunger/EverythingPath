// The words for a carried event's rules codes: its warnings and the Rules
// Exceptions its decision needs.
export function persistentMessage(key: string) {
  const messages: Record<string, string> = {
    'buyoff-cooldown':
      'Another buyoff falls within the militia’s four-week waiting period. Record an exception or revise the decision.',
    treasury:
      'The treasury cannot cover this buyoff. Record an exception or revise the decision.',
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
