// PROTOTYPE — mock campaigns for Wayfinder #118. Every field maps to an
// existing query: getCampaigns (name, description, inGameDate, _creationTime),
// workspace + draft observe (week, snapshot, client-derived readiness),
// canonicalHistory.read (finished weeks and provenance). Nothing is persisted.

import { getFantasyDateParts } from '~/helpers/ARDateConverter';

export type Phase = 'upkeep' | 'activity' | 'event' | 'persistent' | 'summary';

export const phaseLabels: Record<Phase, string> = {
  upkeep: 'Upkeep',
  activity: 'Activity',
  event: 'Event',
  persistent: 'Persistent',
  summary: 'Review & confirm',
};

export const phases: Phase[] = [
  'upkeep',
  'activity',
  'event',
  'persistent',
  'summary',
];

export type Readiness = { state: 'ready' | 'open' | 'locked'; label: string };

export type Provenance =
  | 'confirmation'
  | 'historical_reconstruction'
  | 'historical_correction';

export type Militia = {
  week: number;
  readiness: Record<Phase, Readiness>;
  rank: number;
  focus: 'Loyalty' | 'Security' | 'Secrecy' | null;
  teams: { name: string; status: 'active' | 'disabled' | 'missing' }[];
  officersFilled: number;
  settlements: { name: string; attitude: string }[];
  finished: { week: number; provenance: Provenance }[];
};

export type Campaign = {
  id: string;
  name: string;
  description: string;
  inGameDate?: string;
  createdAt: number;
  militia: Militia | null;
};

export const organizations = ['Thursday Group', 'Sunday Pathfinders'] as const;
export type Organization = (typeof organizations)[number];

export function initialCampaigns(): Record<Organization, Campaign[]> {
  return {
    'Thursday Group': [
      {
        id: 'ironfang',
        name: 'Ironfang Invasion',
        description:
          'Book 2, Thursday group. The Lastwall refugees regroup under Phaendar after the Molthuni push through the Fangwood.',
        inGameDate: '2017-03-12',
        createdAt: 1,
        militia: {
          week: 14,
          readiness: {
            upkeep: { state: 'ready', label: 'Ready' },
            activity: { state: 'open', label: '1 of 2 slots' },
            event: { state: 'open', label: 'Not rolled' },
            persistent: { state: 'open', label: '1 carried event' },
            summary: { state: 'open', label: 'Not ready' },
          },
          rank: 3,
          focus: 'Secrecy',
          teams: [
            { name: 'Red Hawks', status: 'active' },
            { name: 'Old Moss', status: 'disabled' },
            { name: 'Night Owls', status: 'missing' },
            { name: 'Grey Cloaks', status: 'active' },
          ],
          officersFilled: 5,
          settlements: [
            { name: 'Phaendar', attitude: 'Friendly' },
            { name: 'Crossroads', attitude: 'Neutral' },
          ],
          finished: [
            { week: 13, provenance: 'historical_correction' },
            { week: 12, provenance: 'confirmation' },
            { week: 11, provenance: 'confirmation' },
            { week: 10, provenance: 'confirmation' },
            { week: 9, provenance: 'historical_reconstruction' },
          ],
        },
      },
      {
        id: 'second-table',
        name: 'Second Table',
        description: '',
        createdAt: 2,
        militia: {
          week: 3,
          readiness: {
            upkeep: { state: 'ready', label: 'Ready' },
            activity: { state: 'ready', label: '2 of 2 slots' },
            event: { state: 'ready', label: 'No event' },
            persistent: { state: 'locked', label: 'Nothing carried' },
            summary: { state: 'ready', label: 'Ready' },
          },
          rank: 1,
          focus: null,
          teams: [
            { name: 'Ash Wardens', status: 'active' },
            { name: 'Quiet Step', status: 'active' },
          ],
          officersFilled: 2,
          settlements: [{ name: 'Phaendar', attitude: 'Indifferent' }],
          finished: [
            { week: 2, provenance: 'confirmation' },
            { week: 1, provenance: 'historical_reconstruction' },
          ],
        },
      },
      {
        id: 'longshadow',
        name: 'Wardens of Longshadow',
        description: 'Test run for the new group.',
        createdAt: 3,
        militia: null,
      },
    ],
    'Sunday Pathfinders': [],
  };
}

// Honest status: the first phase that isn't ready is "next up". There is no
// stored current phase; readiness is derived in the client.
export function nextUp(m: Militia): Phase | null {
  return (
    phases.find((p) => p !== 'summary' && m.readiness[p].state === 'open') ??
    null
  );
}

// Week number only (#118 sign-off: no "next up" phase on the campaign list).
export function statusLine(c: Campaign) {
  return c.militia ? `Week ${c.militia.week}` : 'Not set up';
}

// `inGameDate` is stored as an ISO date; the calendar shows it as Golarion.
export function formatInGameDate(value: string) {
  const parts = getFantasyDateParts(new Date(`${value}T00:00:00.000Z`));
  return `${parts.day} ${parts.month.name} ${parts.year}`;
}

export function continuePhase(m: Militia): Phase {
  return nextUp(m) ?? 'summary';
}

export function militiaLine(m: Militia) {
  const disabled = m.teams.filter((t) => t.status === 'disabled').length;
  const missing = m.teams.filter((t) => t.status === 'missing').length;
  const teamNotes = [
    disabled && `${disabled} disabled`,
    missing && `${missing} missing`,
  ].filter(Boolean);
  return [
    `Rank ${m.rank}`,
    m.focus ?? 'No focus',
    `${m.teams.length} teams${teamNotes.length ? ` (${teamNotes.join(', ')})` : ''}`,
    `${m.officersFilled} of 6 officers`,
    m.settlements.map((s) => `${s.name} ${s.attitude}`).join(', '),
  ].join(' · ');
}

export const provenanceBadge: Record<Provenance, string | null> = {
  confirmation: null,
  historical_correction: 'Corrected',
  historical_reconstruction: 'From setup',
};

export function validateName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return 'Enter a name.';
  if (trimmed.length < 2) return 'Name must be at least 2 characters.';
  if (trimmed.length > 50) return 'Name must be 50 characters or fewer.';
  return null;
}

// Where the user is. Destinations outside this ticket render a placeholder.
export type Place =
  | { page: 'list'; selected?: string }
  | { page: 'home'; id: string }
  | {
      page: 'week' | 'setup' | 'history' | 'militia' | 'characters';
      id: string;
      phase?: Phase;
      week?: number;
    };

export function address(place: Place) {
  if (place.page === 'list')
    return place.selected ? `/campaigns/${place.selected}` : '/campaigns';
  const base = `/campaigns/${place.id}`;
  switch (place.page) {
    case 'home':
      return base;
    case 'week':
      return `${base}/week?phase=${place.phase ?? 'upkeep'}`;
    case 'history':
      return `${base}/history${place.week ? `?week=${place.week}` : ''}`;
    default:
      return `${base}/${place.page}`;
  }
}

export type Scenario = {
  org: Organization;
  orgState: 'ready' | 'none' | 'denied' | 'error';
  loading: boolean;
  signedOut: boolean;
  createReturnsId: boolean;
};

export type ProtoProps = {
  campaigns: Campaign[];
  scenario: Scenario;
  place: Place;
  go: (place: Place) => void;
  create: (name: string, description: string) => Campaign;
  // Description: new update mutation (approved). In-game date: the existing
  // updateCampaignInGameDate.
  update: (
    id: string,
    patch: { description?: string; inGameDate?: string },
  ) => void;
  highlight: string | null;
  setHighlight: (id: string | null) => void;
};
