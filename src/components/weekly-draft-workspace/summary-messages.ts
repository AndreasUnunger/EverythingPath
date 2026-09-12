import type { PhaseView } from './types';
import { eventRequirement, eventWarning } from './event-messages';
import { activityWarning } from './activity-warnings';
import { choiceFieldLabel } from './structured-choice-field';
type Summary = Extract<PhaseView, { phase: 'summary' }>;
export function summaryMessage(code: string, view: Summary, warning = false) {
  const adjustment = view.adjustments.find((item) =>
    code.startsWith(`adjustment:${item.adjustmentId}:`),
  );
  if (adjustment)
    return code.endsWith('numeric-overflow')
      ? `Table Adjustment “${adjustment.reason}” exceeds the supported whole-number range.`
      : code.endsWith(`:${adjustment.reason}`)
        ? `Table Adjustment: ${adjustment.reason}`
        : `Table Adjustment “${adjustment.reason}”: choose an available ${code.split(':').at(-1)}.`;
  const owner = (view.options.subjectId ?? [])
    .filter(
      (item) =>
        code.startsWith(`${item.value}:`) ||
        code.startsWith(`team:${item.value}:`) ||
        code.startsWith(`transfer:${item.value}:`),
    )
    .sort((a, b) => b.value.length - a.value.length)[0];
  const prefix = owner
    ? `${owner.label}: `
    : code.startsWith('upkeep:')
      ? 'Upkeep: '
      : code.startsWith('event:')
        ? 'Event: '
        : '';
  const tail = owner
    ? code.slice(code.indexOf(owner.value) + owner.value.length + 1)
    : code;
  const key = tail.replace(/:exception$/, '');
  const messages: Record<string, string> = {
    'upkeep:attrition:roll': 'Enter the attrition Loyalty roll.',
    'upkeep:notoriety:nearest-settlement':
      'Choose the nearest settlement for Notoriety consequences.',
    'rank:boon-acknowledgement': 'Record the earned rank boon.',
    'rank:ap-cap': 'The militia rank exceeds the adventure progression limit.',
    'rank:pc-cap':
      'The militia rank exceeds the highest player-character level.',
    'return:roll': 'Enter the missing team’s return roll.',
    'recovery-funds': 'Recovery costs exceed the available treasury.',
    'recovery-cost-baseline':
      'The entered recovery cost differs from the calculated cost.',
    'removal-exception':
      'Removing this team requires a reasoned Rules Exception.',
    'persistent-ending':
      'Ending this event requires a reasoned Rules Exception.',
    'buyoff-cooldown':
      'This buyoff falls within the militia’s four-week waiting period.',
    'buyoff-cost-recomputed':
      'The recorded amount differs from the calculated buyoff cost.',
    'officer-assignment':
      'Choose an assigned officer or record a reasoned Rules Exception.',
    treasury: 'The calculated cost exceeds the available treasury.',
    funds: 'This transfer exceeds the available treasury.',
    officer: 'This transfer is for a character without an officer assignment.',
  };
  if (messages[key]) return prefix + messages[key];
  if (warning && owner?.label.includes('Slot'))
    return prefix + activityWarning(`${owner.value}:${tail}`, owner.value);
  if (
    warning &&
    /roll-range|calculated-event|event-eligibility|alchemical-reward/.test(code)
  )
    return prefix + eventWarning(code);
  const translated = eventRequirement(code);
  if (!translated.startsWith('An earlier')) return prefix + translated;
  if (owner)
    return `${prefix}${choiceFieldLabel(tail.replaceAll(':', '_').replaceAll('-', '_'))}. ${warning ? 'Review this departure with the table.' : 'Complete this decision before confirming.'}`;
  if (/reference|Unknown|source|revision/.test(code))
    return 'A selected character, team, settlement or asset is no longer available. Review the affected choice.';
  return `${prefix}A required rule decision needs attention. Review the phase’s highlighted choices.`;
}
