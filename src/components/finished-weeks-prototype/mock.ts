// PROTOTYPE — mock finished weeks for Wayfinder #117. Shapes follow the
// canonical resolution record loosely (provenance, ruleset version, audit
// entries, warnings with codes, exceptions, adjustments, outcomes), flattened
// into what the page shows. No store, no persistence.

export type Phase = 'upkeep' | 'activity' | 'event' | 'persistent';
export const phases: Phase[] = ['upkeep', 'activity', 'event', 'persistent'];
export const phaseLabels: Record<Phase, string> = {
  upkeep: 'Upkeep',
  activity: 'Activity',
  event: 'Event',
  persistent: 'Persistent',
};

export type Provenance =
  | 'confirmation'
  | 'historical_reconstruction'
  | 'historical_correction';
export const provenanceLabels: Record<Provenance, string> = {
  confirmation: 'Confirmed week',
  historical_reconstruction: 'Historical reconstruction',
  historical_correction: 'Historical correction',
};

export type Consequence = {
  id: string;
  phase: Phase;
  text: string;
  detail?: string;
  delta?: string;
};
export type Exception = {
  exceptionId: string;
  phase: Phase;
  itemId: string;
  subject: string;
  rule: string;
  reason: string;
};
export type Outcome = {
  acknowledgementId: string;
  phase: Phase;
  itemId: string;
  subject: string;
  outcome: string;
};
/** Record warnings carry a code and message; `itemId` is the client's guess at
 * the item they belong to (derived from the code), absent when unmappable. */
export type Warning = {
  code: string;
  message: string;
  phase: Phase;
  itemId?: string;
};
export type Adjustment = {
  adjustmentId: string;
  kind: string;
  effect: string;
  reason: string;
};
export type Row = {
  key: string;
  group: string;
  label: string;
  before: string;
  baseline: string;
  final: string;
};
export type Snapshot = {
  rank: number;
  training: number;
  treasury: number;
  notoriety: number;
  focus: string;
  teams: string;
  events: number;
};

export type Entry = {
  recordId: string;
  sequence: number; // 0-based
  provenance: Provenance;
  recordedAt: string;
  rulesetVersion: number;
  supersedesRecordId: string | null;
  note?: string;
};

export type WeekRecord = {
  week: number;
  entries: Entry[]; // oldest first; the last one is the effective record
  headline: string[]; // chips for lists and tiles
  phaseDelta: Record<Phase, string[]>;
  consequences: Consequence[];
  exceptions: Exception[];
  outcomes: Outcome[];
  warnings: Warning[];
  adjustments: Adjustment[];
  before: Snapshot;
  after: Snapshot;
  rows: Row[];
  roster: string;
  queued: string[];
  context: string[]; // recorded choices and week context
};

const snap = (
  rank: number,
  training: number,
  treasury: number,
  notoriety: number,
  teams: string,
  events: number,
): Snapshot => ({
  rank,
  training,
  treasury,
  notoriety,
  focus: 'Security',
  teams,
  events,
});

const rowsFor = (b: Snapshot, a: Snapshot, extra: Row[] = []): Row[] => [
  {
    key: 'rank',
    group: 'Militia',
    label: 'Rank',
    before: `${b.rank}`,
    baseline: `${a.rank}`,
    final: `${a.rank}`,
  },
  {
    key: 'training',
    group: 'Militia',
    label: 'Training',
    before: `${b.training}`,
    baseline: `${a.training}`,
    final: `${a.training}`,
  },
  {
    key: 'treasury',
    group: 'Militia',
    label: 'Treasury',
    before: `${b.treasury} gp`,
    baseline: `${a.treasury} gp`,
    final: `${a.treasury} gp`,
  },
  {
    key: 'notoriety',
    group: 'Militia',
    label: 'Notoriety',
    before: `${b.notoriety}`,
    baseline: `${a.notoriety}`,
    final: `${a.notoriety}`,
  },
  {
    key: 'focus',
    group: 'Militia',
    label: 'Focus',
    before: b.focus,
    baseline: a.focus,
    final: a.focus,
  },
  ...extra,
];

const plainWeek = (
  week: number,
  before: Snapshot,
  after: Snapshot,
  headline: string[],
  provenance: Provenance = 'confirmation',
): WeekRecord => ({
  week,
  entries: [
    {
      recordId: `w${week}-r0`,
      sequence: 0,
      provenance,
      recordedAt: `2026-0${week < 12 ? 8 : 9}-${String(2 + week).padStart(2, '0')}`,
      rulesetVersion: week < 13 ? 4 : 5,
      supersedesRecordId: null,
    },
  ],
  headline,
  phaseDelta: {
    upkeep: ['Training −4'],
    activity: ['Training +8', 'Treasury +30 gp'],
    event: ['Nothing happened'],
    persistent: [],
  },
  consequences: [
    {
      id: 'u1',
      phase: 'upkeep',
      text: 'Training attrition',
      detail: 'Loyalty 12 + 5 = 17 vs DC 15 · passed',
      delta: 'Training −4',
    },
    { id: 'u4', phase: 'upkeep', text: 'No treasury transfer' },
    {
      id: 'a1',
      phase: 'activity',
      text: 'Slot 1 · Drill Militia · Hollow Scouts',
      delta: 'Training +8',
    },
    {
      id: 'a2',
      phase: 'activity',
      text: 'Slot 2 · Earn Gold · Riverside Smugglers',
      detail: 'Profession 9 + 7 = 16 vs DC 15',
      delta: 'Treasury +30 gp',
    },
    { id: 'a3', phase: 'activity', text: 'Slot 3 · Lie Low · Fangwood Rangers' },
    {
      id: 'e1',
      phase: 'event',
      text: 'Event chance 27% · rolled 61',
      detail: 'no event this week',
    },
    {
      id: 'p0',
      phase: 'persistent',
      text: 'No carried events',
    },
  ],
  exceptions: [],
  outcomes: [],
  warnings: [],
  adjustments: [],
  before,
  after,
  rows: rowsFor(before, after),
  roster: 'Ilsa · Commandant · Orin · Quartermaster',
  queued: [],
  context: [
    'Operating from Longshadow',
    'Uneventful-week benefit: not carried',
    'Skip first Upkeep: no',
  ],
});

const w14Before = snap(8, 132, 440, 6, '5 active · 1 disabled', 2);
const w14After = snap(8, 125, 385, 8, '5 active · 1 disabled', 1);
const week14: WeekRecord = {
  week: 14,
  entries: [
    {
      recordId: 'w14-r0',
      sequence: 0,
      provenance: 'confirmation',
      recordedAt: '2026-09-19',
      rulesetVersion: 5,
      supersedesRecordId: null,
    },
  ],
  headline: ['Training −7', 'Treasury −55 gp', 'Scouts disabled', '1 event ends'],
  phaseDelta: {
    upkeep: ['Training −13', 'Treasury +20 gp', '2 teams back'],
    activity: ['Training +6', 'Treasury +45 gp', 'Longshadow ↑'],
    event: ['Scouts disabled', 'Notoriety +2'],
    persistent: ['Treasury −60 gp', '1 event ends'],
  },
  consequences: [
    {
      id: 'u1',
      phase: 'upkeep',
      text: 'Training attrition',
      detail: 'Loyalty 9 + 5 = 14 vs DC 15 · failed · 2d4 + 8 = 13',
      delta: 'Training −13',
    },
    {
      id: 'u2',
      phase: 'upkeep',
      text: 'Fangwood Rangers recovered',
      detail: 'paid the minimum treasury',
      delta: 'Treasury −80 gp',
    },
    {
      id: 'u3',
      phase: 'upkeep',
      text: 'Nightglass Spies returned',
      detail: 'Security 12 + 5 = 17 vs DC 15',
      delta: 'missing → active',
    },
    { id: 'u4', phase: 'upkeep', text: 'Deposit', delta: 'Treasury +100 gp' },
    {
      id: 'u5',
      phase: 'upkeep',
      text: 'Rank stays 8',
      detail: '25 training short of rank 9',
    },
    {
      id: 'a1',
      phase: 'activity',
      text: 'Slot 1 · Drill Militia · Hollow Scouts',
      detail: 'Strategist +2',
      delta: 'Training +6',
    },
    {
      id: 'a2',
      phase: 'activity',
      text: 'Slot 2 · Earn Gold · Riverside Smugglers',
      detail: 'Profession 11 + 7 = 18 vs DC 15',
      delta: 'Treasury +45 gp',
    },
    {
      id: 'a3',
      phase: 'activity',
      text: 'Slot 3 · Improve Reputation · Longshadow',
      detail: 'Diplomacy 15 + 4 = 19 vs DC 18',
      delta: 'Indifferent → Friendly',
    },
    {
      id: 'a4',
      phase: 'activity',
      text: 'Slot 4 · Change Officer Role',
      detail: 'Kasvarina becomes Strategist',
    },
    {
      id: 'a5',
      phase: 'activity',
      text: 'Slot 5 · Recruit Team · Village Militia',
      detail: 'past the allowance of 4',
      delta: 'Teams 6 → 7',
    },
    {
      id: 'e1',
      phase: 'event',
      text: 'Event chance 35% · rolled 22',
      detail: 'an event occurs',
    },
    {
      id: 'e2',
      phase: 'event',
      text: 'Ambush · Hollow Scouts',
      detail: 'Security 8 + 5 = 13 vs DC 16 · failed · not mitigated',
      delta: 'Scouts disabled',
    },
    {
      id: 'e3',
      phase: 'event',
      text: 'Notoriety rises',
      detail: 'Ambush reported in Longshadow',
      delta: 'Notoriety +2',
    },
    {
      id: 'p1',
      phase: 'persistent',
      text: 'Bandit Raids (since week 11) · bought off',
      detail: 'Overseer supported',
      delta: 'Treasury −60 gp',
    },
    {
      id: 'p2',
      phase: 'persistent',
      text: 'Informant (since week 13) · left alone',
      detail: 'still carried into week 15',
    },
  ],
  exceptions: [
    {
      exceptionId: 'x1',
      phase: 'activity',
      itemId: 'a5',
      subject: 'Slot 5 · Recruit Team',
      rule: 'Max actions 4',
      reason: 'GM granted a fifth action for the Longshadow rally',
    },
    {
      exceptionId: 'x2',
      phase: 'upkeep',
      itemId: 'u2',
      subject: 'Fangwood Rangers recovered',
      rule: 'Recovery below minimum treasury',
      reason: 'Treasury dipped below the minimum after the recovery; agreed at the table',
    },
  ],
  outcomes: [
    {
      acknowledgementId: 'k1',
      phase: 'event',
      itemId: 'e2',
      subject: 'Ambush',
      outcome:
        'The scouts were caught on the Marideth ford; two wounded, none lost.',
    },
  ],
  warnings: [
    {
      code: 'treasury-below-minimum',
      message: 'Treasury fell below the 400 gp minimum after the recovery.',
      phase: 'upkeep',
      itemId: 'u2',
    },
    {
      code: 'action-allowance-exceeded',
      message: 'Five actions were taken with an allowance of four.',
      phase: 'activity',
      itemId: 'a5',
    },
    {
      code: 'notoriety-threshold',
      message: 'Notoriety reached 8. Event chance rises next week.',
      phase: 'event',
    },
  ],
  adjustments: [
    {
      adjustmentId: 'ta1',
      kind: 'Militia value',
      effect: 'Treasury +200 gp',
      reason: 'Reward from the Longshadow council for the rally',
    },
    {
      adjustmentId: 'ta2',
      kind: 'End persistent event',
      effect: 'Informant ends',
      reason: 'The informant was unmasked during the session',
    },
  ],
  before: w14Before,
  after: w14After,
  rows: rowsFor(w14Before, w14After, [
    {
      key: 'treasury-final',
      group: 'Militia',
      label: 'Treasury',
      before: '440 gp',
      baseline: '385 gp',
      final: '585 gp',
    },
    {
      key: 'scouts',
      group: 'Team',
      label: 'Hollow Scouts',
      before: 'active',
      baseline: 'disabled',
      final: 'disabled',
    },
    {
      key: 'spies',
      group: 'Team',
      label: 'Nightglass Spies',
      before: 'missing',
      baseline: 'active',
      final: 'active',
    },
    {
      key: 'longshadow',
      group: 'Settlement',
      label: 'Longshadow',
      before: 'Indifferent',
      baseline: 'Friendly',
      final: 'Friendly',
    },
    {
      key: 'informant',
      group: 'Event',
      label: 'Informant',
      before: 'carried',
      baseline: 'carried',
      final: 'ended',
    },
    {
      key: 'raids',
      group: 'Event',
      label: 'Bandit Raids',
      before: 'carried',
      baseline: 'ended',
      final: 'ended',
    },
  ]).filter((r) => r.key !== 'treasury'),
  roster:
    'Kasvarina · Strategist (from this week) · Ilsa · Commandant · Orin · Quartermaster',
  queued: [
    'Notoriety 8: event chance +5% in week 15',
    'Hollow Scouts disabled: recovery due in week 15 Upkeep',
  ],
  context: [
    'Operating from Longshadow',
    'Uneventful-week benefit: not carried',
    'Skip first Upkeep: no',
    'Officers at confirmation: Ilsa (Commandant), Orin (Quartermaster)',
  ],
};

const w12Before = snap(7, 118, 520, 4, '5 active', 1);
const w12After = snap(8, 128, 470, 5, '5 active', 1);
const week12: WeekRecord = {
  ...plainWeek(12, w12Before, w12After, ['Rank 8', 'Training +10', 'Treasury −50 gp']),
  entries: [
    {
      recordId: 'w12-r0',
      sequence: 0,
      provenance: 'confirmation',
      recordedAt: '2026-09-05',
      rulesetVersion: 4,
      supersedesRecordId: null,
    },
    {
      recordId: 'w12-r1',
      sequence: 1,
      provenance: 'historical_correction',
      recordedAt: '2026-09-12',
      rulesetVersion: 4,
      supersedesRecordId: 'w12-r0',
      note: 'Earn Gold roll re-entered (16, not 6)',
    },
    {
      recordId: 'w12-r2',
      sequence: 2,
      provenance: 'historical_correction',
      recordedAt: '2026-09-19',
      rulesetVersion: 5,
      supersedesRecordId: 'w12-r1',
      note: 'Rank promotion recorded at week 12, not 13',
    },
  ],
  phaseDelta: {
    upkeep: ['Training −4', 'Rank 7 → 8'],
    activity: ['Training +14', 'Treasury +30 gp'],
    event: ['Notoriety +1'],
    persistent: ['Treasury −80 gp'],
  },
  adjustments: [
    {
      adjustmentId: 'ta1',
      kind: 'Militia value',
      effect: 'Rank 8',
      reason: 'Promotion granted at the table after the Fort Nunder raid',
    },
  ],
  rows: rowsFor(w12Before, w12After).map((r) =>
    r.key === 'rank' ? { ...r, baseline: '7' } : r,
  ),
  warnings: [
    {
      code: 'rank-threshold-not-met',
      message: 'Training 128 is below the 150 needed for rank 8.',
      phase: 'upkeep',
      itemId: 'u1',
    },
  ],
};

const w10Before = snap(6, 90, 610, 3, '4 active', 0);
const w10After = snap(6, 96, 640, 3, '4 active', 0);
const week10: WeekRecord = {
  ...plainWeek(10, w10Before, w10After, ['Training +6', 'Treasury +30 gp'], 'historical_reconstruction'),
  context: [
    'Reconstructed at setup from the table notes',
    'Operating from Longshadow',
  ],
};

export const finishedWeeks: WeekRecord[] = [
  plainWeek(9, snap(6, 84, 580, 3, '4 active', 0), snap(6, 88, 610, 3, '4 active', 0), ['Training +4', 'Treasury +30 gp'], 'historical_reconstruction'),
  week10,
  plainWeek(11, w10After, snap(7, 104, 540, 4, '5 active', 1), ['Rank 7', 'Bandit Raids begins', 'Treasury −100 gp']),
  week12,
  plainWeek(13, w12After, w14Before, ['Training +4', 'Treasury −30 gp', 'Informant begins']),
  week14,
];

export const currentWeek = 15;

export const effectiveEntry = (w: WeekRecord) => w.entries[w.entries.length - 1]!;

export type Scenario = {
  loading: boolean;
  failed: boolean;
  empty: boolean;
  unavailable: boolean;
};
