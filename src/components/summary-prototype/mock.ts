// PROTOTYPE — mock week 14 and an in-memory reducer for the Summary prototype
// (Wayfinder #110, map #99). Amounts are shown in gp; the real store keeps copper.

export type Phase = 'upkeep' | 'activity' | 'event' | 'persistent';
export const phaseLabels: Record<Phase, string> = {
  upkeep: 'Upkeep',
  activity: 'Activity',
  event: 'Event',
  persistent: 'Persistent',
};
export const phases: Phase[] = ['upkeep', 'activity', 'event', 'persistent'];

export type TeamStatus = 'active' | 'disabled' | 'missing' | 'blocked';
export const teamStatuses: TeamStatus[] = [
  'active',
  'disabled',
  'missing',
  'blocked',
];
export type Reputation =
  | 'Hostile'
  | 'Unfriendly'
  | 'Indifferent'
  | 'Friendly'
  | 'Helpful';
export const reputations: Reputation[] = [
  'Hostile',
  'Unfriendly',
  'Indifferent',
  'Friendly',
  'Helpful',
];
export type ValueField = 'rank' | 'training' | 'treasury' | 'notoriety';
export const valueFields: { key: ValueField; label: string; unit: string }[] = [
  { key: 'training', label: 'Training', unit: '' },
  { key: 'treasury', label: 'Treasury', unit: ' gp' },
  { key: 'notoriety', label: 'Notoriety', unit: '' },
  { key: 'rank', label: 'Rank', unit: '' },
];

export type AdjustmentBody =
  | {
      kind: 'militia_value';
      field: ValueField;
      operation: 'add' | 'set';
      value: number;
    }
  | { kind: 'team_status'; teamId: string; status: TeamStatus }
  | {
      kind: 'settlement_reputation';
      settlementId: string;
      reputation: Reputation;
    }
  | { kind: 'event_end'; eventId: string };
export type Adjustment = {
  adjustmentId: string;
  reason: string;
} & AdjustmentBody;
export type AdjustmentKind = Adjustment['kind'];
export const kinds: { kind: AdjustmentKind; label: string; hint: string }[] = [
  {
    kind: 'militia_value',
    label: 'Militia value',
    hint: 'Training, treasury, notoriety or rank',
  },
  {
    kind: 'team_status',
    label: 'Team condition',
    hint: 'Active, disabled, missing or blocked',
  },
  {
    kind: 'settlement_reputation',
    label: 'Settlement reputation',
    hint: 'Hostile to Helpful',
  },
  {
    kind: 'event_end',
    label: 'End persistent event',
    hint: 'Stops an event carrying on',
  },
];

export type Team = {
  teamId: string;
  name: string;
  type: string;
  status: TeamStatus;
};
export type Settlement = {
  settlementId: string;
  name: string;
  reputation: Reputation;
};
export type PersistentEvent = {
  eventId: string;
  name: string;
  since: number;
  ended: boolean;
  note?: string;
};
export type Snapshot = {
  week: number;
  rank: number;
  training: number;
  treasury: number;
  notoriety: number;
  focus: string;
  teams: Team[];
  settlements: Settlement[];
  events: PersistentEvent[];
  queued: string[];
};

export type Exception = {
  exceptionId: string;
  phase: Phase;
  itemId: string;
  subject: string;
  rule: string;
  reason: string;
  obsolete?: boolean;
};
export type Recorded = {
  acknowledgementId: string;
  phase: Phase;
  itemId: string;
  subject: string;
  outcome: string;
};
export type Consequence = {
  id: string;
  phase: Phase;
  text: string;
  delta?: string;
  detail?: string;
};

export const minimumGp = 400;
export const rankNeeded = 150;

export const start: Snapshot = {
  week: 14,
  rank: 8,
  training: 132,
  treasury: 1240,
  notoriety: 64,
  focus: 'Security',
  teams: [
    {
      teamId: 'scouts',
      name: 'Hollow Scouts',
      type: 'Scouts · tier 2',
      status: 'active',
    },
    {
      teamId: 'smugglers',
      name: 'Riverside Smugglers',
      type: 'Smugglers · tier 1',
      status: 'active',
    },
    {
      teamId: 'rangers',
      name: 'Fangwood Rangers',
      type: 'Rangers · tier 2',
      status: 'disabled',
    },
    {
      teamId: 'spies',
      name: 'Nightglass Spies',
      type: 'Spies · tier 1',
      status: 'missing',
    },
  ],
  settlements: [
    { settlementId: 'phaendar', name: 'Phaendar', reputation: 'Friendly' },
    {
      settlementId: 'longshadow',
      name: 'Longshadow',
      reputation: 'Indifferent',
    },
    { settlementId: 'nunder', name: 'Fort Nunder', reputation: 'Unfriendly' },
  ],
  events: [
    { eventId: 'patrols', name: 'Hobgoblin Patrols', since: 11, ended: false },
    { eventId: 'shortage', name: 'Supply Shortage', since: 12, ended: false },
  ],
  queued: [],
};

export const rulesBaseline: Snapshot = {
  ...start,
  week: 15,
  training: 125,
  treasury: 1245,
  notoriety: 66,
  teams: [
    {
      teamId: 'scouts',
      name: 'Hollow Scouts',
      type: 'Scouts · tier 2',
      status: 'disabled',
    },
    {
      teamId: 'smugglers',
      name: 'Riverside Smugglers',
      type: 'Smugglers · tier 1',
      status: 'active',
    },
    {
      teamId: 'rangers',
      name: 'Fangwood Rangers',
      type: 'Rangers · tier 2',
      status: 'active',
    },
    {
      teamId: 'spies',
      name: 'Nightglass Spies',
      type: 'Spies · tier 1',
      status: 'active',
    },
  ],
  settlements: [
    { settlementId: 'phaendar', name: 'Phaendar', reputation: 'Friendly' },
    { settlementId: 'longshadow', name: 'Longshadow', reputation: 'Friendly' },
    { settlementId: 'nunder', name: 'Fort Nunder', reputation: 'Unfriendly' },
  ],
  events: [
    {
      eventId: 'patrols',
      name: 'Hobgoblin Patrols',
      since: 11,
      ended: false,
      note: 'mitigated this week',
    },
    {
      eventId: 'shortage',
      name: 'Supply Shortage',
      since: 12,
      ended: true,
      note: 'bought off',
    },
  ],
  queued: ['Hobgoblin Patrols: −2 on Security checks in week 15'],
};

export const consequences: Consequence[] = [
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
    id: 'e1',
    phase: 'event',
    text: 'Event chance 35% · roll 22',
    detail: 'an event occurs',
  },
  {
    id: 'e2',
    phase: 'event',
    text: 'Ambush',
    detail: 'Security 9 + 5 = 14 vs DC 16 · failed',
    delta: 'Hollow Scouts disabled · Notoriety +2',
  },
  {
    id: 'p1',
    phase: 'persistent',
    text: 'Supply Shortage · bought off',
    detail: 'paid to the Kining merchants',
    delta: 'Treasury −60 gp · ends',
  },
  {
    id: 'p2',
    phase: 'persistent',
    text: 'Hobgoblin Patrols · mitigated',
    detail: 'carries into week 15',
    delta: '−2 on Security checks next week',
  },
];

const baseExceptions: Exception[] = [
  {
    exceptionId: 'x1',
    phase: 'activity',
    itemId: 'a2',
    subject: 'Slot 2 · Earn Gold · Riverside Smugglers',
    rule: 'Team already acted',
    reason: 'The Smugglers split up; the GM allowed a second job.',
  },
  {
    exceptionId: 'x2',
    phase: 'event',
    itemId: 'e2',
    subject: 'Event 1 · Ambush',
    rule: 'Event eligibility',
    reason: 'The patrols make an ambush plausible even at 35%.',
  },
];
const obsoleteException: Exception = {
  exceptionId: 'x3',
  phase: 'activity',
  itemId: 'a5',
  subject: 'Slot 5 · Sabotage',
  rule: 'Action allowance',
  reason: 'Extra action during the ambush',
  obsolete: true,
};
const baseRecorded: Recorded[] = [
  {
    acknowledgementId: 'k1',
    phase: 'event',
    itemId: 'e2',
    subject: 'Event 1 · Ambush',
    outcome:
      'The Scouts fell back to Hollow Crossing with two wounded; the hobgoblins took the supply cart.',
  },
  {
    acknowledgementId: 'k2',
    phase: 'persistent',
    itemId: 'p1',
    subject: 'Supply Shortage',
    outcome:
      'Paid off through the Kining merchants; grain reaches the camp next week.',
  },
];
const baseAdjustments: Adjustment[] = [
  {
    adjustmentId: 'j1',
    kind: 'militia_value',
    field: 'treasury',
    operation: 'add',
    value: 500,
    reason: 'Reward for the Longshadow rescue',
  },
];

export type Scenario = {
  openDecisions: boolean;
  unsaved: boolean;
  stale: boolean;
  obsoleteException: boolean;
  noRulings: boolean;
};
export type State = {
  adjustments: Adjustment[];
  exceptions: Exception[];
  recorded: Recorded[];
  scenario: Scenario;
  remote: boolean;
  feedback: string;
};
export type Action =
  | { kind: 'adjust:add'; adjustment: Adjustment }
  | { kind: 'adjust:update'; adjustment: Adjustment }
  | { kind: 'adjust:remove'; adjustmentId: string }
  | { kind: 'adjust:move'; adjustmentId: string; by: -1 | 1 }
  | { kind: 'exception:reason'; exceptionId: string; reason: string }
  | { kind: 'exception:remove'; exceptionId: string }
  | { kind: 'scenario'; key: keyof Scenario; on: boolean }
  | { kind: 'remote' }
  | { kind: 'reset' };

export function initialState(): State {
  return {
    adjustments: structuredClone(baseAdjustments),
    exceptions: structuredClone(baseExceptions),
    recorded: structuredClone(baseRecorded),
    scenario: {
      openDecisions: false,
      unsaved: false,
      stale: false,
      obsoleteException: false,
      noRulings: false,
    },
    remote: false,
    feedback: 'Changes saved.',
  };
}

export function reduce(state: State, action: Action): State {
  const saved = { ...state, remote: false, feedback: 'Changes saved.' };
  switch (action.kind) {
    case 'adjust:add':
      return {
        ...saved,
        adjustments: [...state.adjustments, action.adjustment],
      };
    case 'adjust:update':
      return {
        ...saved,
        adjustments: state.adjustments.map((a) =>
          a.adjustmentId === action.adjustment.adjustmentId
            ? action.adjustment
            : a,
        ),
      };
    case 'adjust:remove':
      return {
        ...saved,
        adjustments: state.adjustments.filter(
          (a) => a.adjustmentId !== action.adjustmentId,
        ),
      };
    case 'adjust:move': {
      const next = [...state.adjustments];
      const i = next.findIndex((a) => a.adjustmentId === action.adjustmentId);
      const j = i + action.by;
      if (i < 0 || j < 0 || j >= next.length) return state;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return { ...saved, adjustments: next };
    }
    case 'exception:reason':
      return {
        ...saved,
        exceptions: state.exceptions.map((x) =>
          x.exceptionId === action.exceptionId
            ? { ...x, reason: action.reason }
            : x,
        ),
      };
    case 'exception:remove':
      return {
        ...saved,
        exceptions: state.exceptions.filter(
          (x) => x.exceptionId !== action.exceptionId,
        ),
      };
    case 'scenario': {
      const scenario = { ...state.scenario, [action.key]: action.on };
      let exceptions = state.exceptions;
      if (action.key === 'obsoleteException')
        exceptions = action.on
          ? [...exceptions.filter((x) => !x.obsolete), obsoleteException]
          : exceptions.filter((x) => !x.obsolete);
      return {
        ...state,
        scenario,
        exceptions,
        feedback: scenario.unsaved ? 'Saving changes…' : 'Changes saved.',
      };
    }
    case 'remote':
      return {
        ...state,
        remote: true,
        feedback: 'Changes saved.',
        adjustments: [
          ...state.adjustments,
          {
            adjustmentId: `r${state.adjustments.length}`,
            kind: 'team_status',
            teamId: 'scouts',
            status: 'active',
            reason:
              'The Scouts regrouped at the crossing; the GM waives the disable.',
          },
        ],
      };
    case 'reset':
      return initialState();
  }
}

export function applyAdjustments(
  base: Snapshot,
  adjustments: Adjustment[],
): Snapshot {
  const next: Snapshot = structuredClone(base);
  for (const a of adjustments) {
    if (a.kind === 'militia_value')
      next[a.field] = a.operation === 'add' ? next[a.field] + a.value : a.value;
    if (a.kind === 'team_status')
      next.teams = next.teams.map((t) =>
        t.teamId === a.teamId ? { ...t, status: a.status } : t,
      );
    if (a.kind === 'settlement_reputation')
      next.settlements = next.settlements.map((s) =>
        s.settlementId === a.settlementId
          ? { ...s, reputation: a.reputation }
          : s,
      );
    if (a.kind === 'event_end')
      next.events = next.events.map((e) =>
        e.eventId === a.eventId
          ? { ...e, ended: true, note: 'ended by the table' }
          : e,
      );
  }
  return next;
}

export function describe(
  a: Adjustment,
  snap: Snapshot = rulesBaseline,
): string {
  switch (a.kind) {
    case 'militia_value': {
      const f = valueFields.find((v) => v.key === a.field)!;
      return a.operation === 'add'
        ? `${f.label} ${a.value >= 0 ? '+' : '−'}${Math.abs(a.value)}${f.unit}`
        : `${f.label} set to ${a.value}${f.unit}`;
    }
    case 'team_status':
      return `${snap.teams.find((t) => t.teamId === a.teamId)?.name ?? 'Team'} → ${a.status}`;
    case 'settlement_reputation':
      return `${snap.settlements.find((s) => s.settlementId === a.settlementId)?.name ?? 'Settlement'} → ${a.reputation}`;
    case 'event_end':
      return `End ${snap.events.find((e) => e.eventId === a.eventId)?.name ?? 'event'}`;
  }
}

/** Which rows of the outcome an adjustment touches; used to attach chips to rows. */
export function targetRow(a: Adjustment): string {
  if (a.kind === 'militia_value') return `value:${a.field}`;
  if (a.kind === 'team_status') return `team:${a.teamId}`;
  if (a.kind === 'settlement_reputation') return `settlement:${a.settlementId}`;
  return `event:${a.eventId}`;
}

export type Row = {
  key: string;
  group: 'Militia' | 'Teams' | 'Settlements' | 'Persistent events';
  label: string;
  sub?: string;
  start: string;
  baseline: string;
  final: string;
  adjustmentIds: string[];
  seed: AdjustmentBody;
};

export type Requirement = {
  id: string;
  text: string;
  phase: Phase;
  exceptionId?: string;
};
export type Warning = { id: string; text: string; phase: Phase };

export type Projection = {
  state: State;
  start: Snapshot;
  baseline: Snapshot;
  final: Snapshot;
  rows: Row[];
  adjustments: Adjustment[];
  exceptions: Exception[];
  recorded: Recorded[];
  consequences: Consequence[];
  requirements: Requirement[];
  warnings: Warning[];
  forecastPending: boolean;
  ready: boolean;
  blocker: string | null;
  changedRows: number;
};

export function project(state: State): Projection {
  const rulings = !state.scenario.noRulings;
  const adjustments = rulings ? state.adjustments : [];
  const exceptions = rulings ? state.exceptions : [];
  const recorded = rulings ? state.recorded : [];
  const final = applyAdjustments(rulesBaseline, adjustments);
  const byRow = (key: string) =>
    adjustments.filter((a) => targetRow(a) === key).map((a) => a.adjustmentId);
  const eventText = (e: PersistentEvent) =>
    e.ended
      ? `ends · ${e.note ?? 'ended'}`
      : `carries into week 15${e.note ? ` · ${e.note}` : ''}`;
  const rows: Row[] = [
    {
      key: 'value:rank',
      group: 'Militia',
      label: 'Rank',
      start: `${start.rank}`,
      baseline: `${rulesBaseline.rank}`,
      final: `${final.rank}`,
      adjustmentIds: byRow('value:rank'),
      seed: {
        kind: 'militia_value',
        field: 'rank',
        operation: 'set',
        value: rulesBaseline.rank,
      },
    },
    {
      key: 'value:training',
      group: 'Militia',
      label: 'Training',
      sub: `${rankNeeded} for rank 9`,
      start: `${start.training}`,
      baseline: `${rulesBaseline.training}`,
      final: `${final.training}`,
      adjustmentIds: byRow('value:training'),
      seed: {
        kind: 'militia_value',
        field: 'training',
        operation: 'add',
        value: 0,
      },
    },
    {
      key: 'value:treasury',
      group: 'Militia',
      label: 'Treasury',
      sub: `minimum ${minimumGp} gp`,
      start: `${start.treasury} gp`,
      baseline: `${rulesBaseline.treasury} gp`,
      final: `${final.treasury} gp`,
      adjustmentIds: byRow('value:treasury'),
      seed: {
        kind: 'militia_value',
        field: 'treasury',
        operation: 'add',
        value: 0,
      },
    },
    {
      key: 'value:notoriety',
      group: 'Militia',
      label: 'Notoriety',
      sub: 'of 100',
      start: `${start.notoriety}`,
      baseline: `${rulesBaseline.notoriety}`,
      final: `${final.notoriety}`,
      adjustmentIds: byRow('value:notoriety'),
      seed: {
        kind: 'militia_value',
        field: 'notoriety',
        operation: 'add',
        value: 0,
      },
    },
    ...final.teams.map(
      (t, i): Row => ({
        key: `team:${t.teamId}`,
        group: 'Teams',
        label: t.name,
        sub: t.type,
        start: start.teams[i]!.status,
        baseline: rulesBaseline.teams[i]!.status,
        final: t.status,
        adjustmentIds: byRow(`team:${t.teamId}`),
        seed: {
          kind: 'team_status',
          teamId: t.teamId,
          status: rulesBaseline.teams[i]!.status,
        },
      }),
    ),
    ...final.settlements.map(
      (s, i): Row => ({
        key: `settlement:${s.settlementId}`,
        group: 'Settlements',
        label: s.name,
        start: start.settlements[i]!.reputation,
        baseline: rulesBaseline.settlements[i]!.reputation,
        final: s.reputation,
        adjustmentIds: byRow(`settlement:${s.settlementId}`),
        seed: {
          kind: 'settlement_reputation',
          settlementId: s.settlementId,
          reputation: rulesBaseline.settlements[i]!.reputation,
        },
      }),
    ),
    ...final.events.map(
      (e, i): Row => ({
        key: `event:${e.eventId}`,
        group: 'Persistent events',
        label: e.name,
        sub: `since week ${e.since}`,
        start: 'carried',
        baseline: eventText(rulesBaseline.events[i]!),
        final: eventText(e),
        adjustmentIds: byRow(`event:${e.eventId}`),
        seed: { kind: 'event_end', eventId: e.eventId },
      }),
    ),
  ];
  const requirements: Requirement[] = [
    ...(state.scenario.openDecisions
      ? [
          {
            id: 'q1',
            text: 'Event 1 · Ambush: Enter the Security check roll (1d20).',
            phase: 'event' as const,
          },
          {
            id: 'q2',
            text: 'Slot 3 · Improve Reputation: Choose a team.',
            phase: 'activity' as const,
          },
        ]
      : []),
    ...exceptions.flatMap((x): Requirement[] =>
      x.obsolete
        ? [
            {
              id: x.exceptionId,
              phase: x.phase,
              exceptionId: x.exceptionId,
              text: `${x.subject}: Move this choice to an available slot, clear it, or restore the action allowance before confirming the week.`,
            },
          ]
        : x.reason.trim()
          ? []
          : [
              {
                id: x.exceptionId,
                phase: x.phase,
                exceptionId: x.exceptionId,
                text: `${x.subject}: ${x.rule}. Record a reasoned Rules Exception or revise the choice.`,
              },
            ],
    ),
    ...adjustments.flatMap((a): Requirement[] =>
      a.reason.trim()
        ? []
        : [
            {
              id: a.adjustmentId,
              phase: 'persistent',
              text: `Table Adjustment “${describe(a)}” needs a reason.`,
            },
          ],
    ),
  ];
  const warnings: Warning[] = [
    ...(exceptions.some((x) => x.exceptionId === 'x1')
      ? [
          {
            id: 'w1',
            phase: 'activity' as const,
            text: 'Slot 2 · Earn Gold: This team has already acted this Activity.',
          },
        ]
      : []),
    {
      id: 'w2',
      phase: 'upkeep',
      text: 'Fangwood Rangers: The entered recovery cost differs from the calculated cost.',
    },
  ];
  const forecastPending = state.scenario.unsaved;
  const ready = requirements.length === 0 && !forecastPending;
  const blocker = forecastPending
    ? 'Review will be ready when your changes are saved.'
    : requirements.length
      ? `${requirements.length} decision${requirements.length > 1 ? 's' : ''} left`
      : state.scenario.stale
        ? 'Review the updated week before confirming.'
        : null;
  return {
    state,
    start,
    baseline: rulesBaseline,
    final,
    rows,
    adjustments,
    exceptions,
    recorded,
    consequences,
    requirements,
    warnings,
    forecastPending,
    ready,
    blocker,
    changedRows: rows.filter((r) => r.baseline !== r.final).length,
  };
}

export const gp = (n: number) => `${n} gp`;
export let seq = 0;
export const newId = () => `n${++seq}`;
