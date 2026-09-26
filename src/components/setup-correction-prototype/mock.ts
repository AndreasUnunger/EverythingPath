// PROTOTYPE — in-memory militia state, section definitions and reducer for
// /prototype/setup-correction (Wayfinder #113, map #99). Throwaway. Numbers are
// kept as strings so the zod-style "empty vs not a number" errors can be shown.

import { MILITIA_ADVANCEMENT } from '~/lib/militia-progression-rules';

export type Value = string | boolean;
export type Row = { id: string } & Record<string, Value>;

export type Column = {
  key: string;
  label: string;
  kind: 'text' | 'number' | 'bool' | 'choice' | 'person' | 'team' | 'settlement' | 'long';
  options?: readonly string[];
  required?: boolean;
  optional?: boolean;
  wide?: boolean;
};

export const ROLES = ['commandant', 'marshal', 'overseer', 'recruiter', 'sentinel', 'strategist'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_EFFECT: Record<Role, string> = {
  commandant: 'Drill Militia adds each commandant’s Hit Dice',
  marshal: 'Security bonus equal to Cha modifier',
  overseer: '+1 to both secondary checks',
  recruiter: 'Loyalty bonus equal to Cha modifier',
  sentinel: 'Secrecy bonus equal to Cha modifier',
  strategist: '+1 militia action; that action gets +2',
};

export type Block = { key: keyof Snapshot; label: string; columns: Column[]; single?: boolean; addLabel?: string };
export type SectionKey = 'values' | 'week' | 'people' | 'teams' | 'settlements' | 'conditions' | 'items' | 'caches' | 'orders' | 'marketplaces' | 'benefits';
export type Section = { key: SectionKey; label: string; blocks: Block[]; correctable: boolean; hint?: string };

const teamTypes = ['moles', 'propagandists', 'saboteurs', 'spies', 'informants', 'conspirators', 'scholars', 'spellcasters', 'defenders', 'infiltrators', 'guardians', 'specialists', 'patrons', 'merchants', 'blackMarketeers', 'fixers'];

export const sections: Section[] = [
  {
    key: 'values',
    label: 'Values',
    correctable: true,
    blocks: [
      {
        key: 'values',
        label: 'Militia values',
        single: true,
        columns: [
          { key: 'focus', label: 'Focus', kind: 'choice', options: ['Loyalty', 'Security', 'Secrecy'], required: true },
          { key: 'rank', label: 'Rank', kind: 'number', required: true },
          { key: 'training', label: 'Training', kind: 'number', required: true },
          { key: 'treasury', label: 'Treasury (gp)', kind: 'number', required: true },
          { key: 'notoriety', label: 'Notoriety', kind: 'number', required: true },
        ],
      },
    ],
  },
  {
    key: 'week',
    label: 'Week',
    correctable: false,
    hint: 'Changes through the week',
    blocks: [
      {
        key: 'week',
        label: 'Week context',
        single: true,
        columns: [
          { key: 'week', label: 'Current week', kind: 'number', required: true },
          { key: 'startDay', label: 'Week start day', kind: 'text', required: true },
          { key: 'firstWeek', label: 'First militia week', kind: 'bool' },
          { key: 'prevUneventful', label: 'Previous week was uneventful', kind: 'bool' },
          { key: 'lastBuyoff', label: 'Last persistent buyoff week', kind: 'number', optional: true },
          { key: 'phase', label: 'Open phase', kind: 'choice', options: ['upkeep', 'activity', 'event', 'persistent'], required: true },
        ],
      },
    ],
  },
  {
    key: 'people',
    label: 'People & officers',
    correctable: false,
    hint: 'Edited on Characters & officers',
    blocks: [
      {
        key: 'people',
        label: 'Militia people',
        addLabel: 'Add character',
        columns: [
          { key: 'name', label: 'Name', kind: 'text', required: true },
          { key: 'level', label: 'Level', kind: 'number', required: true },
          { key: 'cha', label: 'Cha mod', kind: 'number', required: true },
          { key: 'kind', label: 'Kind', kind: 'choice', options: ['pc', 'npc'], required: true },
          { key: 'hitDice', label: 'Hit Dice', kind: 'number', optional: true },
          { key: 'roles', label: 'Officer roles', kind: 'text', optional: true },
        ],
      },
    ],
  },
  {
    key: 'teams',
    label: 'Teams',
    correctable: true,
    blocks: [
      {
        key: 'teams',
        label: 'Teams',
        addLabel: 'Add team',
        columns: [
          { key: 'name', label: 'Name', kind: 'text', required: true },
          { key: 'type', label: 'Type', kind: 'choice', options: teamTypes, required: true },
          { key: 'condition', label: 'Condition', kind: 'choice', options: ['active', 'disabled', 'missing'], required: true },
          { key: 'manager', label: 'Manager', kind: 'person', optional: true },
          { key: 'rewardExempt', label: 'Reward team, exempt from limit', kind: 'bool' },
          { key: 'notes', label: 'Notes', kind: 'long', optional: true, wide: true },
        ],
      },
    ],
  },
  {
    key: 'settlements',
    label: 'Settlements',
    correctable: true,
    blocks: [
      {
        key: 'settlements',
        label: 'Settlements',
        addLabel: 'Add settlement',
        columns: [
          { key: 'name', label: 'Name', kind: 'text', required: true },
          { key: 'reputation', label: 'Reputation', kind: 'choice', options: ['Hostile', 'Unfriendly', 'Indifferent', 'Friendly', 'Helpful'], required: true },
          { key: 'secured', label: 'Secured', kind: 'bool' },
          { key: 'occupied', label: 'Occupied', kind: 'bool' },
          { key: 'tempShift', label: 'Temporary reputation shift', kind: 'number', optional: true },
        ],
      },
    ],
  },
  {
    key: 'conditions',
    label: 'Character conditions',
    correctable: true,
    blocks: [
      {
        key: 'conditions',
        label: 'Character conditions',
        addLabel: 'Add condition',
        columns: [
          { key: 'character', label: 'Character', kind: 'person', required: true },
          { key: 'condition', label: 'Condition', kind: 'choice', options: ['captured', 'in_refuge', 'missing'], required: true },
          { key: 'location', label: 'Location', kind: 'text', optional: true },
          { key: 'sinceWeek', label: 'Since week', kind: 'number', optional: true },
        ],
      },
    ],
  },
  {
    key: 'items',
    label: 'Items',
    correctable: true,
    blocks: [
      {
        key: 'items',
        label: 'Items',
        addLabel: 'Add item',
        columns: [
          { key: 'name', label: 'Name', kind: 'text', required: true },
          { key: 'value', label: 'Value (gp)', kind: 'number', required: true },
          { key: 'owner', label: 'Owner', kind: 'person', optional: true },
          { key: 'identified', label: 'Identified', kind: 'bool' },
          { key: 'location', label: 'Location', kind: 'text', optional: true },
        ],
      },
    ],
  },
  {
    key: 'caches',
    label: 'Caches',
    correctable: true,
    blocks: [
      {
        key: 'caches',
        label: 'Caches',
        addLabel: 'Add cache',
        columns: [
          { key: 'location', label: 'Location', kind: 'text', required: true },
          { key: 'cacheClass', label: 'Class', kind: 'choice', options: ['minor', 'moderate', 'major'], required: true },
          { key: 'status', label: 'Status', kind: 'choice', options: ['hidden', 'discovered', 'recovered'], required: true },
          { key: 'secure', label: 'Secure location', kind: 'bool' },
        ],
      },
    ],
  },
  {
    key: 'orders',
    label: 'Orders',
    correctable: true,
    blocks: [
      {
        key: 'orders',
        label: 'Orders',
        addLabel: 'Add order',
        columns: [
          { key: 'item', label: 'Ordered item', kind: 'text', required: true },
          { key: 'settlement', label: 'Delivery settlement', kind: 'settlement', required: true },
          { key: 'kind', label: 'Kind', kind: 'choice', options: ['day', 'market'], required: true },
          { key: 'orderedWeek', label: 'Ordered week', kind: 'number', required: true },
          { key: 'dueWeek', label: 'Due week', kind: 'number', required: true },
          { key: 'price', label: 'Price paid (gp)', kind: 'number', required: true },
        ],
      },
    ],
  },
  {
    key: 'marketplaces',
    label: 'Marketplaces',
    correctable: true,
    blocks: [
      {
        key: 'marketplaces',
        label: 'Marketplaces',
        addLabel: 'Add marketplace',
        columns: [
          { key: 'settlement', label: 'Settlement', kind: 'settlement', required: true },
          { key: 'source', label: 'Source', kind: 'text', required: true },
          { key: 'availableWeek', label: 'Available week', kind: 'number', required: true },
          { key: 'expiresWeek', label: 'Expires week', kind: 'number', optional: true },
          { key: 'contraband', label: 'Contraband allowed', kind: 'bool' },
        ],
      },
    ],
  },
  {
    key: 'benefits',
    label: 'Carried benefits',
    correctable: true,
    blocks: [
      {
        key: 'skillBenefits',
        label: 'Skill benefits',
        addLabel: 'Add skill benefit',
        columns: [
          { key: 'characters', label: 'Benefiting characters', kind: 'text', required: true },
          { key: 'skills', label: 'Affected skills', kind: 'text', required: true },
          { key: 'bonus', label: 'Bonus', kind: 'number', required: true },
          { key: 'endsWeek', label: 'Ends week', kind: 'number', optional: true },
        ],
      },
      {
        key: 'marketDays',
        label: 'Market Day',
        addLabel: 'Add Market Day',
        columns: [
          { key: 'settlements', label: 'Discount settlements', kind: 'text', required: true },
          { key: 'startsWeek', label: 'Starts week', kind: 'number', required: true },
          { key: 'endsWeek', label: 'Ends week', kind: 'number', required: true },
        ],
      },
    ],
  },
];

export const sectionByKey = (key: SectionKey) => sections.find((s) => s.key === key)!;

// Read-only in Militia Corrections: these change through the week.
export const carriedBlocks: Block[] = [
  {
    key: 'persistentEvents',
    label: 'Persistent events',
    addLabel: 'Add event',
    columns: [
      { key: 'type', label: 'Event', kind: 'choice', options: ['sickness', 'low_morale', 'traitor', 'spy_network', 'shortages'], required: true },
      { key: 'startedWeek', label: 'Started week', kind: 'number', required: true },
      { key: 'order', label: 'Processing order', kind: 'number', required: true },
      { key: 'mitigationWeek', label: 'Mitigation week', kind: 'number', optional: true },
    ],
  },
  {
    key: 'queuedEffects',
    label: 'Queued effects',
    addLabel: 'Add queued effect',
    columns: [
      { key: 'source', label: 'Source', kind: 'text', required: true },
      { key: 'effect', label: 'Effect', kind: 'text', required: true },
      { key: 'startsWeek', label: 'Starts week', kind: 'number', required: true },
      { key: 'endsWeek', label: 'Ends week', kind: 'number', optional: true },
    ],
  },
  {
    key: 'oneUseBonuses',
    label: 'One-use bonuses',
    addLabel: 'Add bonus',
    columns: [
      { key: 'source', label: 'Source', kind: 'text', required: true },
      { key: 'appliesTo', label: 'Applies to', kind: 'choice', options: ['Loyalty', 'Security', 'Secrecy', 'any check'], required: true },
      { key: 'amount', label: 'Amount', kind: 'number', required: true },
      { key: 'team', label: 'Team', kind: 'team', optional: true },
    ],
  },
];

export type Snapshot = {
  values: Row;
  week: Row;
  people: Row[];
  teams: Row[];
  settlements: Row[];
  conditions: Row[];
  items: Row[];
  caches: Row[];
  orders: Row[];
  marketplaces: Row[];
  skillBenefits: Row[];
  marketDays: Row[];
  persistentEvents: Row[];
  queuedEffects: Row[];
  oneUseBonuses: Row[];
  notes: string;
};

export const existingSnapshot: Snapshot = {
  values: { id: 'values', focus: 'Loyalty', rank: '3', training: '18', treasury: '412', notoriety: '64' },
  week: { id: 'week', week: '14', startDay: 'Oathday, 9 Lamashan', firstWeek: false, prevUneventful: true, lastBuyoff: '11', phase: 'upkeep' },
  people: [
    { id: 'p1', name: 'Bren Marrow', level: '5', cha: '3', kind: 'pc', hitDice: '', roles: 'commandant', onRoster: true },
    { id: 'p2', name: 'Aria Vell', level: '5', cha: '1', kind: 'pc', hitDice: '', roles: 'marshal', onRoster: true },
    { id: 'p3', name: 'Tomas Reed', level: '4', cha: '0', kind: 'pc', hitDice: '', roles: '', onRoster: true },
    { id: 'p4', name: 'Grom Ashvale', level: '3', cha: '2', kind: 'npc', hitDice: '4', roles: 'strategist', onRoster: true },
    { id: 'p5', name: 'Sela Dunmark', level: '2', cha: '-1', kind: 'npc', hitDice: '', roles: '', onRoster: true },
    { id: 'p6', name: 'Old Wick', level: '1', cha: '0', kind: 'npc', hitDice: '', roles: '', onRoster: false },
  ],
  teams: [
    { id: 't1', name: 'Scouts', type: 'spies', condition: 'active', manager: 'p4', rewardExempt: false, notes: '' },
    { id: 't2', name: 'Ashvale Irregulars', type: 'defenders', condition: 'disabled', manager: 'p4', rewardExempt: false, notes: 'Lost two in the mill fire' },
    { id: 't3', name: 'Whisperers', type: 'informants', condition: 'active', manager: 'p5', rewardExempt: false, notes: '' },
    { id: 't4', name: 'Bell-ringers', type: 'propagandists', condition: 'missing', manager: 'p4', rewardExempt: true, notes: 'Reward from Phaendar council' },
  ],
  settlements: [
    { id: 's1', name: 'Phaendar', reputation: 'Friendly', secured: true, occupied: false, tempShift: '' },
    { id: 's2', name: 'Teilwood', reputation: 'Unfriendly', secured: false, occupied: true, tempShift: '-1' },
    { id: 's3', name: 'Longshadow', reputation: 'Indifferent', secured: false, occupied: false, tempShift: '' },
  ],
  conditions: [{ id: 'c1', character: 'p3', condition: 'captured', location: 'Fort Ristin cells', sinceWeek: '12' }],
  items: [
    { id: 'i1', name: 'Wand of cure light wounds', value: '750', owner: 'p2', identified: true, location: 'Phaendar cache' },
    { id: 'i2', name: 'Sealed Ironfang dispatch', value: '0', owner: '', identified: false, location: 'With Scouts' },
  ],
  caches: [{ id: 'k1', location: 'Old mill cellar, Phaendar', cacheClass: 'moderate', status: 'hidden', secure: true }],
  orders: [{ id: 'o1', item: 'Alchemist’s fire ×6', settlement: 's1', kind: 'market', orderedWeek: '13', dueWeek: '15', price: '120' }],
  marketplaces: [{ id: 'm1', settlement: 's3', source: 'Longshadow black market', availableWeek: '12', expiresWeek: '16', contraband: true }],
  skillBenefits: [{ id: 'b1', characters: 'Aria Vell', skills: 'Diplomacy', bonus: '2', endsWeek: '' }],
  marketDays: [],
  persistentEvents: [
    { id: 'e1', type: 'sickness', startedWeek: '12', order: '1', mitigationWeek: '13' },
    { id: 'e2', type: 'low_morale', startedWeek: '13', order: '2', mitigationWeek: '' },
  ],
  queuedEffects: [{ id: 'q1', source: 'Found Fire (week 13)', effect: '+2 Security this week', startsWeek: '14', endsWeek: '14' }],
  oneUseBonuses: [{ id: 'u1', source: 'High Morale (week 11)', appliesTo: 'any check', amount: '2', team: '' }],
  notes: 'Started the tracker mid-campaign after the Fort Ristin raid.',
};

export const newSnapshot: Snapshot = {
  values: { id: 'values', focus: '', rank: '1', training: '0', treasury: '100', notoriety: '0' },
  week: { id: 'week', week: '1', startDay: '', firstWeek: true, prevUneventful: false, lastBuyoff: '', phase: 'upkeep' },
  people: existingSnapshot.people.map((p) => ({ ...p, roles: '', hitDice: '', onRoster: p.kind === 'pc' })),
  teams: [],
  settlements: [{ id: 's1', name: 'Phaendar', reputation: 'Indifferent', secured: false, occupied: false, tempShift: '' }],
  conditions: [],
  items: [],
  caches: [],
  orders: [],
  marketplaces: [],
  skillBenefits: [],
  marketDays: [],
  persistentEvents: [],
  queuedEffects: [],
  oneUseBonuses: [],
  notes: '',
};

// ---------------------------------------------------------------- validation

// Empty strings mean unset, so `??` alone won't do.
export const orElse = (v: Value | undefined, fallback: Value): Value => (v === '' || v === undefined ? fallback : v);

export type Problem = { section: SectionKey | 'carried'; block: string; rowId: string; field: string; text: string };
export type Warning = { section: SectionKey | 'carried'; text: string };

const num = (v: Value | undefined) => (typeof v === 'string' && /^-?\d+$/.test(v.trim()) ? Number(v) : null);

export function errorsFor(snapshot: Snapshot, only?: SectionKey[]): Problem[] {
  const out: Problem[] = [];
  for (const section of sections) {
    if (only && !only.includes(section.key)) continue;
    for (const block of section.blocks) {
      const rows = block.single ? [snapshot[block.key] as Row] : (snapshot[block.key] as Row[]);
      for (const row of rows) {
        for (const col of block.columns) {
          const v = row[col.key];
          if (col.kind === 'bool') continue;
          const empty = v === undefined || v === '' || v === null;
          if (empty && col.required) out.push({ section: section.key, block: block.key, rowId: row.id, field: col.key, text: `${col.label} is required.` });
          else if (!empty && col.kind === 'number' && num(v) === null) out.push({ section: section.key, block: block.key, rowId: row.id, field: col.key, text: `${col.label} must be a whole number.` });
        }
      }
    }
  }
  return out;
}

export const personName = (s: Snapshot, id: Value | undefined) => s.people.find((p) => p.id === id)?.name ?? '';
export const teamName = (s: Snapshot, id: Value | undefined) => s.teams.find((t) => t.id === id)?.name ?? '';
export const settlementName = (s: Snapshot, id: Value | undefined) => s.settlements.find((t) => t.id === id)?.name ?? '';
export const rolesOf = (p: Row) => String(p.roles ?? '').split(',').map((r) => r.trim()).filter(Boolean) as Role[];

export function managerLimit(p: Row) {
  const cha = num(p.cha) ?? 0;
  if (p.kind === 'pc' || rolesOf(p).length) return Math.max(1, cha);
  return 1;
}

export function warningsFor(s: Snapshot): Warning[] {
  const out: Warning[] = [];
  const rank = num(s.values.rank);
  const training = num(s.values.training);
  const treasury = num(s.values.treasury);
  const notoriety = num(s.values.notoriety);
  const adv = rank === null ? undefined : MILITIA_ADVANCEMENT.find((r) => r.rank === rank);
  if (rank !== null && !adv) out.push({ section: 'values', text: 'Rank is outside the standard advancement table (1–20).' });
  if (adv && training !== null && training < adv.training) out.push({ section: 'values', text: `Training is below the rank ${rank} threshold of ${adv.training}. Rank never decreases after training loss; check this against your table history.` });
  const pcLevels = s.people.filter((p) => p.kind === 'pc' && p.onRoster !== false).map((p) => num(p.level) ?? 0);
  if (rank !== null && pcLevels.length && rank > Math.max(...pcLevels)) out.push({ section: 'values', text: 'Rank exceeds the highest active PC level.' });
  if (training !== null && training < 0) out.push({ section: 'values', text: 'Training is below zero.' });
  if (treasury !== null && rank !== null && treasury < rank * 100) out.push({ section: 'values', text: 'Treasury is below the normal minimum. Upkeep may require a training loss.' });
  if (notoriety !== null && (notoriety < 0 || notoriety > 100)) out.push({ section: 'values', text: 'Notoriety is outside the normal range of 0–100.' });
  const counted = s.teams.filter((t) => !t.rewardExempt).length;
  if (adv && counted > adv.teams) out.push({ section: 'teams', text: `${counted} counted teams exceed the rank ${rank} limit of ${adv.teams}.` });
  for (const p of s.people) {
    const managed = s.teams.filter((t) => t.manager === p.id).length;
    if (managed > managerLimit(p)) out.push({ section: 'teams', text: `${p.name} manages ${managed} teams, above the normal limit of ${managerLimit(p)}.` });
    if (rolesOf(p).length > 1) out.push({ section: 'people', text: `${p.name} holds more than one officer role.` });
  }
  if (s.week.phase === 'persistent' && s.persistentEvents.length === 0) out.push({ section: 'week', text: 'There are no carried persistent events. The week will open in Upkeep.' });
  return out;
}

// What the open Weekly Draft references. Only teams and settlements here.
export const stagedReferences = (scenario: Scenario) =>
  scenario.stagedSlot
    ? [
        { kind: 'team' as const, id: 't1', where: 'Activity slot 2 (Drill Militia)' },
        { kind: 'settlement' as const, id: 's2', where: 'Operating from (Activity)' },
        { kind: 'person' as const, id: 'p4', where: 'Activity slot 3 (Change Officer Role)' },
      ]
    : [];

export function impactOf(latest: Snapshot, edited: Snapshot, scenario: Scenario): string[] {
  const out: string[] = [];
  for (const ref of stagedReferences(scenario)) {
    if (ref.kind === 'team') {
      const before = latest.teams.find((t) => t.id === ref.id);
      const after = edited.teams.find((t) => t.id === ref.id);
      if (before && !after) out.push(`Removing ${before.name} leaves ${ref.where} without a team.`);
      else if (before && after && after.condition !== 'active' && before.condition === 'active') out.push(`Marking ${before.name} ${after.condition} leaves ${ref.where} with a team that can’t act.`);
    }
    if (ref.kind === 'settlement') {
      const before = latest.settlements.find((t) => t.id === ref.id);
      if (before && !edited.settlements.find((t) => t.id === ref.id)) out.push(`Removing ${before.name} leaves ${ref.where} without a settlement.`);
    }
    if (ref.kind === 'person') {
      const before = latest.people.find((t) => t.id === ref.id);
      const after = edited.people.find((t) => t.id === ref.id);
      if (before && (!after || after.onRoster === false)) out.push(`Removing ${before.name} from the roster leaves ${ref.where} without a character.`);
    }
  }
  return out;
}

// ------------------------------------------------------------------- state

export type Scenario = { mode: 'new' | 'existing'; stagedSlot: boolean; setupDoneElsewhere: boolean };
export type Screen = 'setup' | 'militia' | 'characters';

export type Correction = {
  section: SectionKey | 'people';
  draft: Snapshot;
  reason: string;
  openedRevision: number;
  conflict: boolean;
  attempted: boolean;
};

export type State = {
  scenario: Scenario;
  latest: Snapshot;
  revision: number;
  changedSince: { revision: number; section: SectionKey | 'people'; by: string; summary: string }[];
  setup: { draft: Snapshot; step: number; visited: number[]; savedAt: string | null; attempted: boolean };
  correction: Correction | null;
  savedCorrections: { section: string; reason: string; by: string }[];
  feedback: string;
  remoteFlash: string | null;
};

export const setupSteps = [
  { key: 'starting', label: 'Starting point', sections: ['values'] as SectionKey[] },
  { key: 'week', label: 'Week', sections: ['week'] as SectionKey[] },
  { key: 'people', label: 'People & officers', sections: ['people'] as SectionKey[] },
  { key: 'teams', label: 'Teams', sections: ['teams'] as SectionKey[] },
  { key: 'settlements', label: 'Settlements', sections: ['settlements'] as SectionKey[] },
  { key: 'conditions', label: 'Character conditions', sections: ['conditions'] as SectionKey[], optional: true },
  { key: 'assets', label: 'Assets', sections: ['items', 'caches', 'orders', 'marketplaces'] as SectionKey[], optional: true },
  { key: 'carried', label: 'Carried effects', sections: ['benefits'] as SectionKey[], optional: true, carried: true },
  { key: 'review', label: 'Review & start', sections: [] as SectionKey[] },
];

export function initialState(scenario?: Partial<Scenario>): State {
  const sc: Scenario = { mode: 'existing', stagedSlot: true, setupDoneElsewhere: false, ...scenario };
  return {
    scenario: sc,
    latest: existingSnapshot,
    revision: 7,
    changedSince: [],
    setup: { draft: sc.mode === 'new' ? newSnapshot : existingSnapshot, step: 0, visited: [0], savedAt: null, attempted: false },
    correction: null,
    savedCorrections: [],
    feedback: 'Saved',
    remoteFlash: null,
  };
}

export type Action =
  | { kind: 'scenario'; key: keyof Scenario; value: Scenario[keyof Scenario] }
  | { kind: 'setup:step'; step: number }
  | { kind: 'setup:patch'; fn: (s: Snapshot) => Snapshot }
  | { kind: 'setup:attempt' }
  | { kind: 'setup:start' }
  | { kind: 'correct:open'; section: SectionKey | 'people' }
  | { kind: 'correct:patch'; fn: (s: Snapshot) => Snapshot }
  | { kind: 'correct:reason'; reason: string }
  | { kind: 'correct:cancel' }
  | { kind: 'correct:save' }
  | { kind: 'correct:redo' }
  | { kind: 'remote:teams' }
  | { kind: 'remote:values' }
  | { kind: 'reset' };

const stamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// Merge the edited section into the latest snapshot; the rest is the latest.
function mergeSection(latest: Snapshot, edited: Snapshot, section: SectionKey | 'people'): Snapshot {
  const keys = section === 'people' ? ['people'] : sectionByKey(section).blocks.map((b) => b.key);
  const next = { ...latest };
  for (const k of keys) (next as Record<string, unknown>)[k] = edited[k as keyof Snapshot];
  return next;
}

export function reduce(state: State, action: Action): State {
  switch (action.kind) {
    case 'scenario': {
      const scenario = { ...state.scenario, [action.key]: action.value };
      if (action.key === 'mode') return { ...initialState(scenario) };
      return { ...state, scenario };
    }
    case 'setup:step':
      return { ...state, setup: { ...state.setup, step: action.step, visited: [...new Set([...state.setup.visited, action.step])] } };
    case 'setup:patch':
      return { ...state, setup: { ...state.setup, draft: action.fn(state.setup.draft), savedAt: stamp() } };
    case 'setup:attempt':
      return { ...state, setup: { ...state.setup, attempted: true } };
    case 'setup:start':
      return { ...state, latest: state.setup.draft, revision: state.revision + 1, feedback: 'Militia started', scenario: { ...state.scenario } };
    case 'correct:open': {
      if (state.correction) return state;
      return { ...state, correction: { section: action.section, draft: state.latest, reason: '', openedRevision: state.revision, conflict: false, attempted: false } };
    }
    case 'correct:patch':
      return state.correction ? { ...state, correction: { ...state.correction, draft: action.fn(state.correction.draft) } } : state;
    case 'correct:reason':
      return state.correction ? { ...state, correction: { ...state.correction, reason: action.reason } } : state;
    case 'correct:cancel':
      return { ...state, correction: null };
    case 'correct:redo':
      return state.correction ? { ...state, correction: { ...state.correction, draft: state.latest, openedRevision: state.revision, conflict: false } } : state;
    case 'correct:save': {
      const c = state.correction;
      if (!c) return state;
      const errors = errorsFor(c.draft, c.section === 'people' ? [] : [c.section]);
      if (!c.reason.trim() || errors.length) return { ...state, correction: { ...c, attempted: true } };
      const conflict = state.changedSince.some((ch) => ch.revision > c.openedRevision && ch.section === c.section);
      if (conflict) return { ...state, correction: { ...c, conflict: true, attempted: true } };
      const merged = mergeSection(state.latest, c.draft, c.section);
      return {
        ...state,
        latest: merged,
        revision: state.revision + 1,
        correction: null,
        savedCorrections: [{ section: c.section, reason: c.reason, by: 'you' }, ...state.savedCorrections],
        feedback: `Saved ${stamp()}`,
      };
    }
    case 'remote:teams': {
      const revision = state.revision + 1;
      const latest: Snapshot = { ...state.latest, teams: state.latest.teams.map((t) => (t.id === 't3' ? { ...t, name: 'Whisperers of Teilwood', condition: 'disabled' } : t)) };
      return { ...state, latest, revision, changedSince: [...state.changedSince, { revision, section: 'teams', by: 'Mira', summary: 'Whisperers renamed and marked disabled' }], remoteFlash: 'Mira corrected Teams' };
    }
    case 'remote:values': {
      const revision = state.revision + 1;
      const latest: Snapshot = { ...state.latest, values: { ...state.latest.values, treasury: '380' } };
      return { ...state, latest, revision, changedSince: [...state.changedSince, { revision, section: 'values', by: 'Mira', summary: 'Treasury 412 → 380 gp' }], remoteFlash: 'Mira corrected Values' };
    }
    case 'reset':
      return initialState(state.scenario);
  }
}

// Human summaries for section read views and the conflict comparison.
export function summarize(s: Snapshot, section: SectionKey | 'people'): string[] {
  switch (section) {
    case 'values':
      return [`Focus ${String(orElse(s.values.focus, '—'))}`, `Rank ${s.values.rank}`, `Training ${s.values.training}`, `Treasury ${s.values.treasury} gp`, `Notoriety ${s.values.notoriety}`];
    case 'week':
      return [`Week ${s.week.week}, opens in ${s.week.phase}`, String(orElse(s.week.startDay, 'no start day')), s.week.prevUneventful ? 'Previous week uneventful' : 'Previous week had an event', s.week.lastBuyoff ? `Last buyoff week ${s.week.lastBuyoff}` : 'No buyoff yet'];
    case 'people':
      return s.people.filter((p) => p.onRoster !== false).map((p) => `${p.name} · ${String(p.kind).toUpperCase()}${p.hitDice ? ` · ${p.hitDice} HD` : ''}${p.roles ? ` · ${p.roles}` : ''}`);
    case 'teams':
      return s.teams.map((t) => `${t.name} · ${t.type} · ${t.condition}${t.manager ? ` · managed by ${personName(s, t.manager)}` : ''}`);
    case 'settlements':
      return s.settlements.map((t) => `${t.name} · ${t.reputation}${t.secured ? ' · secured' : ''}${t.occupied ? ' · occupied' : ''}${t.tempShift ? ` · shift ${t.tempShift}` : ''}`);
    case 'conditions':
      return s.conditions.map((c) => `${personName(s, c.character)} · ${c.condition}${c.location ? ` · ${c.location}` : ''}`);
    case 'items':
      return s.items.map((i) => `${i.name} · ${i.value} gp${i.owner ? ` · ${personName(s, i.owner)}` : ''}${i.identified ? '' : ' · unidentified'}`);
    case 'caches':
      return s.caches.map((c) => `${c.location} · ${c.cacheClass} · ${c.status}`);
    case 'orders':
      return s.orders.map((o) => `${o.item} · ${settlementName(s, o.settlement)} · due week ${o.dueWeek}`);
    case 'marketplaces':
      return s.marketplaces.map((m) => `${m.source} · ${settlementName(s, m.settlement)} · weeks ${m.availableWeek}–${String(orElse(m.expiresWeek, '∞'))}`);
    case 'benefits':
      return [...s.skillBenefits.map((b) => `${b.characters}: +${b.bonus} ${b.skills}`), ...s.marketDays.map((m) => `Market Day at ${m.settlements}, weeks ${m.startsWeek}–${m.endsWeek}`)];
  }
}

export const countOf = (s: Snapshot, section: SectionKey | 'people') => (section === 'values' || section === 'week' ? null : summarize(s, section).length);
