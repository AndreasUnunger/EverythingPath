// PROTOTYPE — mock Upkeep for Wayfinder #107 (map #99). Nothing here reads or
// writes Convex. A tiny reducer stands in for Weekly Draft edits, and
// `project()` imitates `projectUpkeep` in the rules order: team recovery,
// attrition, maximum notoriety, treasury shortage, rank and boons, transfers.

export const rank = 8;
export const highestPcLevel = 9;
export const minimumGp = rank * 10;
const loyaltyBonus = [
  { label: 'Rank and focus', value: 6 },
  { label: 'Officers (Amara, Ambassador)', value: 2 },
];
const securityBonus = [
  { label: 'Rank and focus', value: 2 },
  { label: 'Officers (Ilse, Marshal)', value: 1 },
];
const sum = (xs: { value: number }[]) => xs.reduce((a, b) => a + b.value, 0);
const rankThresholds = [0, 0, 10, 15, 20, 30, 40, 55, 75, 105, 160];

export const people = [
  { id: 'p-amara', name: 'Amara Voss', roles: ['Ambassador'], pc: true },
  { id: 'p-doran', name: 'Doran Kest', roles: ['Strategist'], pc: true },
  { id: 'p-ilse', name: 'Ilse Marrow', roles: ['Marshal'], pc: false },
  { id: 'p-pell', name: 'Pell', roles: [], pc: false },
];
export const settlements = [
  { id: 's-phaendar', name: 'Phaendar', reputation: 'Helpful' },
  { id: 's-ekkerd', name: 'Ekkerd', reputation: 'Friendly' },
  { id: 's-teilwood', name: 'Teilwood', reputation: 'Indifferent' },
];
export const captainFeats = ['Great Fortitude', 'Iron Will', 'Lightning Reflexes'];

export type RollId = 'check' | 'training' | 'notoriety' | 'notorietyCheck' | 'loss';
export type TeamDecision = 'recover' | 'leave' | 'remove';
export type Transfer = { id: string; personId: string; direction: 'deposit' | 'withdraw'; gp: number };

export type State = {
  scenario: {
    firstWeek: boolean;
    maxNotoriety: boolean;
    lowTreasury: boolean;
    disabledTeam: boolean;
    missingTeam: boolean;
  };
  rolls: Partial<Record<RollId, (number | null)[]>>;
  settlementId: string | null;
  teams: Record<string, { decision?: TeamDecision; costGp?: number; costReason?: string; roll?: number }>;
  /** Rules Exception reasons keyed by `${rule}:${subject}`. */
  exceptions: Record<string, string>;
  /** Boon outcomes keyed by person id. */
  boons: Record<string, string>;
  transfers: Transfer[];
  feedback: string;
  remote: boolean;
};

export function initialState(): State {
  return {
    scenario: { firstWeek: false, maxNotoriety: false, lowTreasury: false, disabledTeam: true, missingTeam: true },
    rolls: { check: [14] },
    settlementId: null,
    teams: {},
    exceptions: {},
    boons: {},
    transfers: [{ id: 'tr-1', personId: 'p-doran', direction: 'deposit', gp: 25 }],
    feedback: 'All changes saved.',
    remote: false,
  };
}

export type Edit =
  | { kind: 'roll'; id: RollId; dice: (number | null)[] }
  | { kind: 'settlement'; settlementId: string | null }
  | { kind: 'team'; teamId: string; decision?: TeamDecision; costGp?: number; costReason?: string; roll?: number | null }
  | { kind: 'exception'; key: string; reason: string | null }
  | { kind: 'boon'; personId: string; outcome: string | null }
  | { kind: 'transfer_add'; transfer: Omit<Transfer, 'id'> }
  | { kind: 'transfer_remove'; id: string }
  | { kind: 'scenario'; key: keyof State['scenario']; on: boolean }
  | { kind: 'remote' }
  | { kind: 'reset' };

let counter = 0;
export function reduce(state: State, edit: Edit): State {
  const saved = { ...state, feedback: 'All changes saved.', remote: false };
  switch (edit.kind) {
    case 'roll':
      return { ...saved, rolls: { ...state.rolls, [edit.id]: edit.dice } };
    case 'settlement':
      return { ...saved, settlementId: edit.settlementId };
    case 'team': {
      const { kind: _, teamId, ...rest } = edit;
      const next = { ...state.teams[teamId], ...rest };
      if (rest.roll === null) delete next.roll;
      return { ...saved, teams: { ...state.teams, [teamId]: next as State['teams'][string] } };
    }
    case 'exception': {
      const exceptions = { ...state.exceptions };
      if (edit.reason) exceptions[edit.key] = edit.reason;
      else delete exceptions[edit.key];
      return { ...saved, exceptions };
    }
    case 'boon': {
      const boons = { ...state.boons };
      if (edit.outcome) boons[edit.personId] = edit.outcome;
      else delete boons[edit.personId];
      return { ...saved, boons };
    }
    case 'transfer_add':
      return { ...saved, transfers: [...state.transfers, { ...edit.transfer, id: `tr-new-${++counter}` }] };
    case 'transfer_remove':
      return { ...saved, transfers: state.transfers.filter((t) => t.id !== edit.id) };
    case 'scenario':
      return { ...state, scenario: { ...state.scenario, [edit.key]: edit.on } };
    case 'remote':
      return {
        ...state,
        rolls: { ...state.rolls, training: [2] },
        feedback: 'All changes saved.',
        remote: true,
      };
    case 'reset':
      return initialState();
  }
}

// ---------------------------------------------------------------------------
// Projection

export type Modifier = { label: string; value: number };
export type RollFact = {
  id: RollId;
  step: 1 | 2 | 3;
  label: string;
  short: string;
  /** What the roll is for, e.g. "Loyalty DC 10" or "Training loss 2d4 + 8". */
  kind: string;
  dice: (number | null)[];
  sides: number;
  dc: number | null;
  modifiers: Modifier[];
  bonus: number;
  total: number | null;
  /** Plain-language result once entered. */
  outcome: string | null;
  /** Training change from this roll, once entered. */
  training: number | null;
  outOfRange: boolean;
};

export type Team = {
  id: string;
  name: string;
  type: string;
  tier: number;
  status: 'disabled' | 'missing';
  decision: TeamDecision | undefined;
  ruleCostGp: number;
  costGp: number;
  costReason: string;
  roll: number | undefined;
  rollModifiers: Modifier[];
  rollBonus: number;
  rollTotal: number | null;
  rollOutcome: string | null;
};

export type Issue = {
  /** What the line is about, so a variant can show it next to its item. */
  subject: string;
  text: string;
  /** Present when the table can proceed only with a reasoned Rules Exception. */
  exceptionKey?: string;
};

export type Projection = {
  skipped: boolean;
  notoriety: number;
  treasuryStartGp: number;
  trainingStart: number;
  rolls: RollFact[];
  teams: Team[];
  settlementRequired: boolean;
  settlementShown: boolean;
  shortage: boolean;
  /** Ledger lines in rules order. */
  trainingLines: { label: string; value: number | null; subject: string }[];
  treasuryLines: { label: string; value: number; subject: string }[];
  adjustments: { subject: string; label: string; value: number; reason: string }[];
  trainingAfter: number | null;
  treasuryAfterRulesGp: number;
  treasuryAfterGp: number;
  rankAfter: number | null;
  boons: { person: (typeof people)[number]; outcome: string }[];
  requirements: Issue[];
  warnings: Issue[];
  exceptions: { key: string; subject: string; title: string; text: string; reason: string }[];
  ready: boolean;
};

const entered = (dice: (number | null)[] | undefined, count: number) =>
  Array.from({ length: count }, (_, i) => dice?.[i] ?? null);
const total = (dice: (number | null)[]) => (dice.every((x) => x !== null) ? dice.reduce((a, b) => a + b, 0) : null);

export const teamsFor = (s: State) =>
  [
    s.scenario.disabledTeam && { id: 't-hands', name: 'Quiet Hands', type: 'Spies', tier: 3, status: 'disabled' as const },
    s.scenario.missingTeam && { id: 't-runners', name: 'Night Runners', type: 'Specialists', tier: 3, status: 'missing' as const },
  ].filter(Boolean) as { id: string; name: string; type: string; tier: number; status: 'disabled' | 'missing' }[];

export function project(state: State): Projection {
  const s = state.scenario;
  const notoriety = s.maxNotoriety ? 100 : 64;
  const treasuryStartGp = s.lowTreasury ? 60 : 118;
  const trainingStart = 125;
  const requirements: Issue[] = [];
  const warnings: Issue[] = [];
  const exceptions: Projection['exceptions'] = [];
  const treasuryLines: Projection['treasuryLines'] = [];
  const trainingLines: Projection['trainingLines'] = [];
  const adjustments: Projection['adjustments'] = [];
  const base = {
    notoriety,
    treasuryStartGp,
    trainingStart,
  };
  if (s.firstWeek)
    return {
      ...base,
      skipped: true,
      rolls: [],
      teams: [],
      settlementRequired: false,
      settlementShown: false,
      shortage: false,
      trainingLines,
      treasuryLines,
      adjustments,
      trainingAfter: trainingStart,
      treasuryAfterRulesGp: treasuryStartGp,
      treasuryAfterGp: treasuryStartGp,
      rankAfter: rank,
      boons: [],
      requirements,
      warnings,
      exceptions,
      ready: true,
    };

  const needException = (key: string, subject: string, title: string, text: string) => {
    const reason = state.exceptions[key] ?? '';
    exceptions.push({ key, subject, title, text, reason });
    if (!reason) requirements.push({ subject, text: `Record a Rules Exception: ${title}`, exceptionKey: key });
  };

  // Start of Upkeep: team conditions
  let treasury = treasuryStartGp;
  const teams: Team[] = teamsFor(state).map((t) => {
    const saved = state.teams[t.id] ?? {};
    const roll = saved.roll;
    const rollTotal = t.status === 'missing' && roll !== undefined ? roll + sum(securityBonus) : null;
    const rollOutcome =
      rollTotal === null
        ? null
        : roll === 1
          ? 'Natural 1: the team is lost for good'
          : rollTotal >= 15
            ? 'Returns at the end of the week'
            : 'Stays missing';
    const team: Team = {
      ...t,
      decision: saved.decision,
      ruleCostGp: minimumGp,
      costGp: saved.costGp ?? minimumGp,
      costReason: saved.costReason ?? '',
      roll,
      rollModifiers: securityBonus,
      rollBonus: sum(securityBonus),
      rollTotal,
      rollOutcome,
    };
    if (team.decision === 'remove') {
      warnings.push({ subject: t.id, text: `Removing ${t.name} departs from normal Upkeep.` });
      needException(`upkeep-team-removal:${t.id}`, t.id, `remove ${t.name}`, 'Removing a team departs from normal Upkeep.');
      return team;
    }
    if (t.status === 'disabled') {
      if (!team.decision) requirements.push({ subject: t.id, text: `Decide whether to recover ${t.name}` });
      if (team.decision === 'recover') {
        if (treasury < minimumGp) {
          warnings.push({ subject: t.id, text: `${t.name} recovery costs more than the treasury holds.` });
          needException(`upkeep-recovery-funds:${t.id}`, t.id, `recover ${t.name} beyond funds`, 'This recovery exceeds the available treasury.');
        }
        treasury -= minimumGp;
        treasuryLines.push({ label: `Recover ${t.name}`, value: -minimumGp, subject: t.id });
        if (team.costGp !== minimumGp) {
          adjustments.push({
            subject: t.id,
            label: `${t.name} recovery cost`,
            value: minimumGp - team.costGp,
            reason: team.costReason,
          });
          if (!team.costReason) requirements.push({ subject: t.id, text: `Give a reason for the changed ${t.name} cost` });
        }
      }
    } else {
      if (roll === undefined) requirements.push({ subject: t.id, text: `Enter the ${t.name} return check` });
      else if (roll < 1 || roll > 20)
        warnings.push({ subject: t.id, text: `${t.name}'s return die is outside 1–20. The value is kept.` });
    }
    return team;
  });

  const rolls: RollFact[] = [];
  const rollFact = (
    f: Omit<RollFact, 'dice' | 'total' | 'outOfRange' | 'bonus' | 'outcome' | 'training'> & { count: number },
    effect: (dice: number[], total: number) => { outcome: string; training: number | null },
  ) => {
    const dice = entered(state.rolls[f.id], f.count);
    const sumDice = total(dice);
    const bonus = sum(f.modifiers);
    const t = sumDice === null ? null : sumDice + bonus;
    const outOfRange = dice.some((x) => x !== null && (x < 1 || x > f.sides));
    const e = sumDice === null ? null : effect(dice as number[], t!);
    const { count: _, ...rest } = f;
    const fact: RollFact = { ...rest, dice, bonus, total: t, outOfRange, outcome: e?.outcome ?? null, training: e?.training ?? null };
    rolls.push(fact);
    if (sumDice === null) requirements.push({ subject: f.id, text: `Enter the ${f.label.toLowerCase()}` });
    if (outOfRange) warnings.push({ subject: f.id, text: `${f.label} has a value outside 1–${f.sides}. The value is kept.` });
    return fact;
  };

  // Step 1: attrition
  const check = rollFact(
    {
      id: 'check',
      step: 1,
      label: 'Attrition Loyalty check',
      short: 'Loyalty',
      kind: 'Loyalty DC 10',
      count: 1,
      sides: 20,
      dc: 10,
      modifiers: loyaltyBonus,
    },
    ([die], t) =>
      die === 20
        ? { outcome: 'Natural 20: training +1d6', training: null }
        : t >= 10
          ? { outcome: 'Success: training −1d6', training: null }
          : { outcome: `Failure: training −(2d4 + ${rank})`, training: null },
  );
  let training: number | null = trainingStart;
  const change = (label: string, fact: RollFact | null, subject: string) => {
    const v = fact?.training ?? null;
    trainingLines.push({ label, value: v, subject });
    training = training === null || v === null ? null : training + v;
  };
  if (check.total !== null) {
    const nat20 = check.dice[0] === 20;
    const success = check.total >= 10;
    const f = rollFact(
      {
        id: 'training',
        step: 1,
        label: 'Attrition training roll',
        short: 'Training',
        kind: nat20 ? 'Training gain 1d6' : success ? 'Training loss 1d6' : `Training loss 2d4 + ${rank}`,
        count: nat20 || success ? 1 : 2,
        sides: nat20 || success ? 6 : 4,
        dc: null,
        modifiers: [],
      },
      (_, t) => {
        const v = nat20 ? t : success ? -t : -(t + rank);
        return { outcome: `Training ${v > 0 ? '+' : '−'}${Math.abs(v)}`, training: v };
      },
    );
    change('Attrition', f, 'training');
  } else change('Attrition', null, 'check');

  // Step 2: maximum notoriety
  let settlementRequired = false;
  if (notoriety >= 100) {
    const f = rollFact(
      {
        id: 'notoriety',
        step: 2,
        label: 'Maximum-notoriety training roll',
        short: 'Training',
        kind: `Training loss 1d20 + ${rank}`,
        count: 1,
        sides: 20,
        dc: null,
        modifiers: [],
      },
      (_, t) => ({ outcome: `Training −${t + rank}`, training: -(t + rank) }),
    );
    change('Maximum notoriety', f, 'notoriety');
    const c = rollFact(
      {
        id: 'notorietyCheck',
        step: 2,
        label: 'Notoriety Loyalty check',
        short: 'Loyalty',
        kind: 'Loyalty DC 15',
        count: 1,
        sides: 20,
        dc: 15,
        modifiers: loyaltyBonus,
      },
      (_, t) =>
        t >= 15
          ? { outcome: 'Success: reputation holds', training: null }
          : { outcome: 'Failure: nearest settlement drops one reputation step', training: null },
    );
    if (c.total !== null && c.total < 15) {
      settlementRequired = true;
      if (!state.settlementId) requirements.push({ subject: 'settlement', text: 'Choose the nearest settlement' });
    }
  }

  // Step 3: treasury shortage (after recovery costs)
  const shortage = treasury < minimumGp;
  if (shortage) {
    const f = rollFact(
      {
        id: 'loss',
        step: 3,
        label: 'Treasury-shortage training roll',
        short: 'Training',
        kind: `Training loss 2d4 + ${rank}`,
        count: 2,
        sides: 4,
        dc: null,
        modifiers: [],
      },
      (_, t) => ({ outcome: `Training −${t + rank}`, training: -(t + rank) }),
    );
    change('Treasury shortage', f, 'loss');
  }

  // Step 4: rank
  const rulesOpen = requirements.length > 0;
  let rankAfter: number | null = null;
  const boons: Projection['boons'] = [];
  if (!rulesOpen && training !== null) {
    let r = rank;
    while (r < 10 && training >= rankThresholds[r + 1]!) r++;
    if (r > highestPcLevel) {
      r = highestPcLevel;
      warnings.push({ subject: 'rank', text: 'Rank is held at the highest PC level (9).' });
    }
    rankAfter = r;
    if (r >= 9)
      for (const person of people.filter((p) => p.pc)) {
        const outcome = state.boons[person.id] ?? '';
        boons.push({ person, outcome });
        if (!outcome) requirements.push({ subject: `boon:${person.id}`, text: `Record ${person.name}'s Captain title feat` });
      }
  }

  // Step 5: transfers
  const treasuryAfterRulesGp = treasury;
  for (const t of state.transfers) {
    const person = people.find((p) => p.id === t.personId)!;
    if (person.roles.length === 0) {
      warnings.push({ subject: t.id, text: `${person.name} is not an officer.` });
      needException(`upkeep-transfer-officer:${t.id}`, t.id, `${t.direction} by ${person.name}, not an officer`, 'Only officers may deposit or withdraw.');
    }
    if (t.direction === 'withdraw' && t.gp > treasury) {
      warnings.push({ subject: t.id, text: `${person.name}'s withdrawal exceeds the treasury.` });
      needException(`upkeep-transfer-funds:${t.id}`, t.id, `withdraw ${t.gp} gp beyond funds`, 'This withdrawal exceeds the available treasury.');
    }
    const v = t.direction === 'deposit' ? t.gp : -t.gp;
    treasury += v;
    treasuryLines.push({ label: `${t.direction === 'deposit' ? 'Deposit' : 'Withdrawal'} · ${person.name}`, value: v, subject: t.id });
  }
  const treasuryAfterGp = treasury + adjustments.reduce((a, b) => a + b.value, 0);

  return {
    ...base,
    skipped: false,
    rolls,
    teams,
    settlementRequired,
    settlementShown: true,
    shortage,
    trainingLines,
    treasuryLines,
    adjustments,
    trainingAfter: training,
    treasuryAfterRulesGp,
    treasuryAfterGp,
    rankAfter,
    boons,
    requirements,
    warnings,
    exceptions,
    ready: requirements.length === 0,
  };
}

export const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n)}`;
export const personName = (id: string) => people.find((p) => p.id === id)?.name ?? 'Someone';
