// PROTOTYPE — throwaway mock data for the navigation prototype (Wayfinder #102).
// Lives only on the `prototype/navigation` branch. Do not import from real code.

export const phases = [
  'upkeep',
  'activity',
  'event',
  'persistent',
  'summary',
] as const;
export type Phase = (typeof phases)[number];

export const phaseLabels: Record<Phase, string> = {
  upkeep: 'Upkeep',
  activity: 'Activity',
  event: 'Event',
  persistent: 'Persistent',
  summary: 'Summary',
};

export type Section =
  | 'campaigns'
  | 'home'
  | 'week'
  | 'history'
  | 'militia'
  | 'correct'
  | 'people'
  | 'setup';

export type Place = {
  campaignId: string;
  section: Section;
  phase: Phase;
  historyWeek: number;
};

export type MockCampaign = {
  id: string;
  name: string;
  description: string;
  militia: null | {
    week: number;
    phase: Phase;
    ready: Phase[];
    persistentAvailable: boolean;
    rank: number;
    training: number;
    treasury: string;
    notoriety: number;
    focus: string;
    teams: { name: string; type: string; condition: string; manager: string }[];
    officers: { role: string; holder: string | null }[];
  };
};

export const campaigns: MockCampaign[] = [
  {
    id: 'k57ironfang',
    name: 'Ironfang Invasion',
    description: 'Thursday group, book 2',
    militia: {
      week: 12,
      phase: 'activity',
      ready: ['upkeep'],
      persistentAvailable: true,
      rank: 3,
      training: 14,
      treasury: '48 gp 6 sp',
      notoriety: 7,
      focus: 'Secrecy',
      teams: [
        {
          name: 'Red Hawks',
          type: 'Scouts',
          condition: 'active',
          manager: 'Tamsin',
        },
        {
          name: 'Old Moss',
          type: 'Recruits',
          condition: 'disabled',
          manager: 'Brakk',
        },
        {
          name: 'Night Owls',
          type: 'Spies',
          condition: 'missing',
          manager: '—',
        },
      ],
      officers: [
        { role: 'Commandant', holder: 'Tamsin' },
        { role: 'Strategist', holder: 'Iolo' },
        { role: 'Manager', holder: 'Brakk' },
        { role: 'Quartermaster', holder: null },
        { role: 'Recruiter', holder: 'Iolo' },
      ],
    },
  },
  {
    id: 'k57second',
    name: 'Second Table',
    description: 'New group, no militia yet',
    militia: null,
  },
];

export const characters = [
  { name: 'Brakk', level: 6, kind: 'PC', stats: '16 12 14 10 13 8' },
  { name: 'Iolo', level: 6, kind: 'PC', stats: '10 14 12 18 12 10' },
  { name: 'Tamsin', level: 6, kind: 'PC', stats: '12 16 12 10 14 16' },
  {
    name: 'Wren Velisk',
    level: 4,
    kind: 'Officer NPC',
    stats: '10 12 10 12 14 15',
  },
];

export const finishedWeeks = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

export const mockCards = [
  'Drill Militia',
  'Reduce Danger',
  'Recruit',
  'Gather Info',
  'Lie Low',
  'Special Order',
];

export function campaignById(id: string) {
  return campaigns.find((c) => c.id === id) ?? campaigns[0]!;
}

export function initialPlace(): Place {
  const c = campaigns[0]!;
  return {
    campaignId: c.id,
    section: 'week',
    phase: c.militia?.phase ?? 'upkeep',
    historyWeek: 11,
  };
}

// Inventory ids (docs/ui-capability-inventory.md) that each section hosts,
// before any variant moves things around.
export const baseCoverage: Record<Section, string[]> = {
  campaigns: ['CAMP-01', 'CAMP-03', 'CAMP-04', 'CAMP-05', 'STATE-01…04'],
  home: ['CAMP-06 (description shown)'],
  week: ['WEEK-*', 'UPK-*', 'ACT-*', 'EVT-*', 'PER-*', 'SUM-*', 'NAV-15'],
  history: ['HIST-*'],
  militia: ['LEDG-01', 'LEDG-09', 'LEDG-10'],
  correct: ['LEDG-02', 'LEDG-04…08'],
  people: ['CHAR-*'],
  setup: ['SETUP-*'],
};
