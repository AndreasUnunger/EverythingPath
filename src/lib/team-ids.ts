export const TEAM_IDS = [
  'moles',
  'propagandists',
  'saboteurs',
  'spies',
  'informants',
  'conspirators',
  'scholars',
  'spellcasters',
  'defenders',
  'infiltrators',
  'guardians',
  'specialists',
  'patrons',
  'merchants',
  'blackMarketeers',
  'fixers',
] as const;

export type TeamId = (typeof TEAM_IDS)[number];

const TEAM_ID_LABELS: Record<TeamId, string> = {
  moles: 'Moles',
  propagandists: 'Propagandists',
  saboteurs: 'Saboteurs',
  spies: 'Spies',
  informants: 'Informants',
  conspirators: 'Conspirators',
  scholars: 'Scholars',
  spellcasters: 'Spellcasters',
  defenders: 'Defenders',
  infiltrators: 'Infiltrators',
  guardians: 'Guardians',
  specialists: 'Specialists',
  patrons: 'Patrons',
  merchants: 'Merchants',
  blackMarketeers: 'Black Marketeers',
  fixers: 'Fixers',
};

export function isTeamId(value: string): value is TeamId {
  return TEAM_IDS.includes(value as TeamId);
}

export function formatTeamIdLabel(teamId: TeamId) {
  return TEAM_ID_LABELS[teamId];
}
