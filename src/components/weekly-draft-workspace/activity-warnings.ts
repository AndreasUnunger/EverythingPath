export function activityWarning(warning: string, choiceId: string): string {
  const code = warning.slice(choiceId.length + 1);
  if (code.endsWith('roll-range'))
    return 'A die is outside its usual range. Your entered value is retained for the table.';
  if (code === 'calculated-cost')
    return 'The entered cost differs from the rules calculation. The preview uses the calculated cost; changing this field does not adjust the treasury outcome.';
  const reasons: Record<string, string> = {
    'action-capacity': 'This choice exceeds the action allowance.',
    'team-capacity': 'Recruitment exceeds the team allowance.',
    'team-action': 'This team does not normally perform this action.',
    'team-unavailable': 'This team is unavailable for this Activity.',
    'team-used': 'This team has already acted this Activity.',
    'action-blocked': 'An event prevents this action during this Activity.',
    'lie-low-exclusivity': 'Lie Low normally uses the entire Activity.',
    'drill-limit': 'Drill Militia is normally available once per Activity.',
    treasury: 'The militia does not have enough funds for the calculated cost.',
  };
  return (
    reasons[code] ??
    `Review this choice with the table: ${code.split(':')[0]!.replaceAll('-', ' ').replaceAll('_', ' ')}.`
  );
}
