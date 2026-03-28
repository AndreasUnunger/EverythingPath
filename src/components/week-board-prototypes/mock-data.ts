export type Phase = 'upkeep' | 'activity' | 'event';

export type ActionCard = {
  id: string;
  title: string;
  team: string;
  cost?: string;
  status: 'available' | 'claimed' | 'confirmed';
  teamRequired: boolean;
  allowedInPhase: Phase;
  fullText: string[];
};

export type EventItem = {
  id: string;
  name: string;
  tags: string[];
  fullText: string[];
};

export const mockWeekState = {
  week: 12,
  inGameDate: '4715 AR, Erastus 19',
  phase: 'activity' as Phase,
  rank: 3,
  training: 18,
  treasury: 34,
  notoriety: 32,
  maxActions: 2,
  maxTeams: 3,
  uneventfulBonusCarry: true,
  eventChancePreview: 35, // notoriety + rank after uneventful week
  reputation: {
    fangwoodKeep: 'Friendly',
    tamran: 'Indifferent',
    vigilance: 'Unfriendly',
  },
  conflictPolicy: 'Last write wins',
  weekAdvancePolicy: 'Any player can commit week transition',
};

export const mockActions: ActionCard[] = [
  {
    id: 'a1',
    title: 'Drill Militia',
    team: 'No Team Required',
    cost: 'minimum treasury value',
    status: 'confirmed',
    teamRequired: false,
    allowedInPhase: 'activity',
    fullText: [
      'No team required; once per Activity phase.',
      'Cost: minimum treasury value.',
      'Check: Loyalty vs 10 + rank.',
      'Success: training +2d6 plus Commandant bonuses.',
      'Natural 1: no auto-fail, but Notoriety +1d6.',
      'Unavailable if militia is already at current maximum rank.',
    ],
  },
  {
    id: 'a2',
    title: 'Reduce Danger',
    team: 'Defenders',
    cost: '1 action',
    status: 'claimed',
    teamRequired: true,
    allowedInPhase: 'activity',
    fullText: [
      'Teams: Defenders, Guardians, Infiltrators, Specialists.',
      'Check: DC 15 Security.',
      'Success: temporary +1 reputation step for week in target town.',
      'Success also allows militia members to walk openly in hostile/unfriendly settlements.',
      'Failure: Notoriety +1d4.',
    ],
  },
  {
    id: 'a3',
    title: 'Change Officer Role',
    team: 'No Team Required',
    cost: '1 action',
    status: 'available',
    teamRequired: false,
    allowedInPhase: 'activity',
    fullText: [
      'No team required; consumes one Activity action.',
      'One PC changes officer role.',
      'Allies/cohorts cannot change roles with this action.',
    ],
  },
  {
    id: 'a4',
    title: 'Lie Low',
    team: 'No Team Required',
    cost: 'all actions',
    status: 'available',
    teamRequired: false,
    allowedInPhase: 'activity',
    fullText: [
      'No team required.',
      'Must be the only action taken this Activity phase.',
      'Notoriety decreases by the total number of teams.',
    ],
  },
  {
    id: 'a5',
    title: 'Sabotage',
    team: 'Saboteurs',
    cost: 'reactive',
    status: 'available',
    teamRequired: true,
    allowedInPhase: 'event',
    fullText: [
      'Team: Saboteurs.',
      'Reactive action during Event phase if saboteurs are available.',
      'Check: DC 15 + rank to negate event.',
      'Notoriety increases by +1d6 whether success or failure.',
    ],
  },
];

export const mockTeams = [
  { id: 't1', name: 'Defenders', status: 'active' as const },
  { id: 't2', name: 'Spellcasters', status: 'active' as const },
  { id: 't3', name: 'Saboteurs', status: 'disabled' as const },
  { id: 't4', name: 'Guardians', status: 'missing' as const },
];

export const mockEvents: EventItem[] = [
  {
    id: 'e1',
    name: 'Roll Twice',
    tags: ['roll-twice', 'dual-resolution'],
    fullText: [
      'Roll and resolve two events.',
      'If the same event appears twice and it has a Twice clause, the second application uses only that Twice clause.',
      'Roll Twice can take effect only once per Event phase; additional Roll Twice results are rerolled.',
    ],
  },
  {
    id: 'e2',
    name: 'Low Morale',
    tags: ['persistent', 'twice-clause', 'mitigable'],
    fullText: [
      'The militia takes a -2 penalty on Loyalty checks.',
      'Twice: this event becomes persistent and continues across weeks until resolved through event handling rules.',
    ],
  },
  {
    id: 'e3',
    name: 'All Is Calm',
    tags: ['uneventful', 'bonus-carry'],
    fullText: [
      'No event occurs this week.',
      'Twice: in the next Event phase, skip the event-occurrence roll; this does not build the uneventful bonus chain for the following week.',
    ],
  },
];
