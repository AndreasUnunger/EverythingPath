// PROTOTYPE — mock Event phase for Wayfinder #108 (map #99). Nothing here
// reads or writes Convex. A tiny reducer stands in for Weekly Draft edits, and
// `project()` imitates the event selection and outcome rules: chance, table
// roll with the operating settlement's modifier, Roll Twice, replacements,
// Twice clauses, per-event inputs, checks, mitigation, Sabotage and outcomes.

export const rank = 8;
export const notoriety = 64;
export const trainingStart = 125;
export const treasuryStartGp = 118;
export const week = 14;

export const teams = [
  { id: 't-hands', name: 'Quiet Hands', type: 'Spies', tier: 3, status: 'active', used: true },
  { id: 't-runners', name: 'Night Runners', type: 'Specialists', tier: 3, status: 'active', used: true },
  { id: 't-wardens', name: 'Ash Wardens', type: 'Guards', tier: 2, status: 'active', used: false },
  { id: 't-long', name: 'Longshanks', type: 'Scouts', tier: 1, status: 'disabled', used: false },
] as const;
export const settlements = [
  { id: 's-phaendar', name: 'Phaendar', reputation: 'Helpful', modifier: 0, refuge: true, operated: true },
  { id: 's-ekkerd', name: 'Ekkerd', reputation: 'Friendly', modifier: -5, refuge: false, operated: true },
  { id: 's-teilwood', name: 'Teilwood', reputation: 'Unfriendly', modifier: 5, refuge: false, operated: false },
] as const;
export const people = [
  { id: 'p-amara', name: 'Amara Voss', role: 'Ambassador', pc: true, skills: { diplomacy: 11, bluff: 6, intimidate: 4 } },
  { id: 'p-doran', name: 'Doran Kest', role: 'Strategist', pc: true, skills: { diplomacy: 3, bluff: 5, intimidate: 9 } },
  { id: 'p-ilse', name: 'Ilse Marrow', role: 'Marshal', pc: false, skills: { diplomacy: 5, bluff: 2, intimidate: 7 } },
] as const;
export const hiddenPeople = [{ id: 'h-wren', name: 'Wren Ashby', settlementId: 's-phaendar' }];
export const caches = [{ id: 'c-mill', name: 'Ekkerd mill cache', kind: 'Minor', status: 'hidden' }];
export const items = [{ id: 'i-ring', name: 'Ring of unknown make' }];
export const carriedEvents = [{ id: 'ev-theft-9', name: 'Theft', startedWeek: 9 }];
const checkBonus = { loyalty: 8, secrecy: 6, security: 3 } as const;
export type Check = keyof typeof checkBonus;
export type Skill = 'diplomacy' | 'bluff' | 'intimidate';

export type EventType =
  | 'week_of_serenity' | 'war_games' | 'night_ops' | 'broke_the_code' | 'found_fire' | 'high_morale'
  | 'turn_around' | 'festival' | 'market_day' | 'hidden_agenda' | 'all_is_calm' | 'roll_twice'
  | 'calm_before_the_storm' | 'turncoat' | 'cache_discovered' | 'rivalry' | 'missing_in_action'
  | 'theft' | 'raid' | 'invasion' | 'low_morale' | 'sickness' | 'double_agent' | 'week_of_pain';

export type TableEntry = { min: number; max: number; type: EventType; name: string; text: string; twice: string | null; persistentCapable?: boolean };
export const eventTable: TableEntry[] = [
  { min: 1, max: 4, type: 'week_of_serenity', name: 'Week of Serenity', text: 'Next week: +5 on all organization checks, and the next Activity training gain is doubled.', twice: 'No additional effect.' },
  { min: 5, max: 12, type: 'war_games', name: 'War Games', text: `Training increases by the militia's rank (${rank}).`, twice: `Training increases by ${rank} again.` },
  { min: 13, max: 16, type: 'night_ops', name: 'Night Ops', text: 'PCs gain +2 to Stealth after dark for the week.', twice: 'The bonus becomes +5.' },
  { min: 17, max: 20, type: 'broke_the_code', name: 'Broke the Code', text: 'Identify one magic item of any caster level. PCs gain +2 Knowledge (local) for the week.', twice: 'The bonus becomes +5.' },
  { min: 21, max: 24, type: 'found_fire', name: 'Found Fire', text: 'Each PC gets one non-poison alchemical item worth up to 100 gp. Security checks gain +2 this coming week.', twice: 'Choose one additional item worth up to 100 gp.' },
  { min: 25, max: 28, type: 'high_morale', name: 'High Morale', text: 'End one current persistent event immediately. Loyalty checks gain +2 this coming week.', twice: 'End two persistent events, and the bonus becomes +5.' },
  { min: 29, max: 32, type: 'turn_around', name: 'Turn Around', text: 'All disabled teams recover. If none is disabled, one team gains +2 on one check next Activity.', twice: null },
  { min: 33, max: 36, type: 'festival', name: 'Festival', text: 'Choose a recently used town. PCs gain +2 morale to Bluff, Diplomacy and Intimidate there for the week.', twice: 'The bonus becomes +5.' },
  { min: 37, max: 40, type: 'market_day', name: 'Market Day', text: 'One operated town (PC choice): all items and services gain an extra 5% discount.', twice: 'Applies to all operated marketplaces, including Broker Markets.' },
  { min: 41, max: 44, type: 'hidden_agenda', name: 'Hidden Agenda', text: 'The militia gains +2 on all Activity phase checks this week.', twice: 'The bonus becomes +5.' },
  { min: 45, max: 48, type: 'all_is_calm', name: 'All Is Calm', text: 'No event this week.', twice: 'Next week skips the event chance roll and is calm; this does not build the uneventful bonus.' },
  { min: 49, max: 52, type: 'roll_twice', name: 'Roll Twice', text: 'Roll and resolve two events. Roll Twice takes effect only once per Event phase; another Roll Twice is rerolled.', twice: null },
  { min: 53, max: 56, type: 'calm_before_the_storm', name: 'Calm before the Storm', text: 'No event now. Next week an event is rolled and applied automatically before the normal Event phase. This week does not count as uneventful.', twice: 'Next week two automatic events, then the normal Event phase.' },
  { min: 57, max: 60, type: 'turncoat', name: 'Turncoat', text: `Training decreases by 1d6 + ${rank}.`, twice: `One full team defects (GM choice) unless an officer succeeds at Diplomacy DC ${10 + rank}; even then that team is unavailable next Activity.` },
  { min: 61, max: 64, type: 'cache_discovered', name: 'Cache Discovered', text: `Lose one hidden cache and its contents. Mitigate: Secrecy check DC ${10 + rank} to retrieve it.`, twice: 'All caches are discovered.' },
  { min: 65, max: 68, type: 'rivalry', name: 'Rivalry', text: 'Two random teams cannot act next Activity phase.', twice: 'Persistent until an officer succeeds at DC 20 Bluff, Diplomacy or Intimidate.', persistentCapable: true },
  { min: 69, max: 72, type: 'missing_in_action', name: 'Missing in Action', text: 'One random team that operated this week is unavailable next week.', twice: 'The team returns at the end of the following week, but disabled.' },
  { min: 73, max: 76, type: 'theft', name: 'Theft', text: 'The militia treasury is halved. Mitigate: DC 20 Loyalty reduces the loss to 10%.', twice: 'Becomes persistent: the militia loses half of all incoming treasury until a successful Reduce Danger.', persistentCapable: true },
  { min: 77, max: 80, type: 'raid', name: 'Raid', text: `In a random settlement with active refuges, all refuges deactivate. Hidden persons may be captured and recovered next week via Rescue Character (DC ${5 + rank}). Mitigate: DC 20 Security per person halves the capture chance.`, twice: null },
  { min: 81, max: 84, type: 'invasion', name: 'Invasion', text: 'The GM presents a random combat encounter at CR APL + 1.', twice: null },
  { min: 85, max: 88, type: 'low_morale', name: 'Low Morale', text: 'Loyalty checks suffer −2.', twice: 'Becomes persistent.', persistentCapable: true },
  { min: 89, max: 96, type: 'sickness', name: 'Sickness', text: 'One random team becomes disabled.', twice: 'The team is lost unless the militia succeeds at a DC 20 Loyalty check.' },
  { min: 97, max: 99, type: 'double_agent', name: 'Double Agent', text: 'Secure Cache cannot be used next Activity. Secrecy checks suffer −2.', twice: 'Becomes persistent.', persistentCapable: true },
  { min: 100, max: 100, type: 'week_of_pain', name: 'Week of Pain', text: 'Next week: −1 on all organization checks, and the next Upkeep training loss is doubled.', twice: 'No additional effect.' },
];
export const entryFor = (total: number) => eventTable.find((e) => total <= e.max) ?? eventTable[eventTable.length - 1]!;
const independent: EventType[] = ['invasion', 'raid', 'turn_around', 'war_games'];

// ---------------------------------------------------------------------------
// State

export type Origin =
  | { kind: 'rolled' }
  | { kind: 'automatic'; sourceId: string }
  | { kind: 'roll_twice'; parentId: string }
  | { kind: 'replacement'; parentId: string };
export type Reward = { personId: string; name: string; gp: number };
export type Sabotage = { teamId: string | null; check: Check | null; roll: number | null; notorietyRoll: number | null };
export type Occurrence = {
  id: string;
  origin: Origin;
  /** Set when the occurrence is a candidate of a Guarantee Event Activity choice. */
  candidateOf?: string;
  tableRoll: number | null;
  /** A table modifier added at the table, beyond the settlement's. */
  extra: { value: number; reason: string } | null;
  targets: string[];
  apl: number | null;
  rolls: Record<string, number | null>;
  mitigation: 'unattempted' | 'attempted';
  officerId: string | null;
  skill: Skill;
  rewards: Reward[];
  sabotage: Sabotage | null;
};
export type Scenario = { guaranteed: boolean; automatic: boolean; unfriendly: boolean; uneventful: boolean; forcedCalm: boolean };
export type State = {
  scenario: Scenario;
  chanceRoll: number | null;
  occurrences: Occurrence[];
  selectedCandidateId: string | null;
  acknowledgements: Record<string, string>;
  exceptions: Record<string, string>;
  feedback: string;
  remote: boolean;
};

export const guaranteeChoice = { id: 'ch-guarantee', label: 'Guarantee Event', slot: 2, team: 'Quiet Hands' };
export const automaticSource = { id: 'q-calm-13', label: 'Calm before the Storm', week: 13, count: 1 };

const occurrence = (id: string, origin: Origin, tableRoll: number | null = null, rest: Partial<Occurrence> = {}): Occurrence => ({
  id, origin, tableRoll, extra: null, targets: [], apl: null, rolls: {}, mitigation: 'unattempted', officerId: null, skill: 'diplomacy', rewards: [], sabotage: null, ...rest,
});

export function initialState(): State {
  return {
    scenario: { guaranteed: false, automatic: false, unfriendly: false, uneventful: true, forcedCalm: false },
    chanceRoll: 41,
    occurrences: [
      // Operating from Ekkerd (Friendly) takes 5 off each table roll.
      occurrence('ev-1', { kind: 'rolled' }, 55), // 50: Roll Twice
      occurrence('ev-2', { kind: 'roll_twice', parentId: 'ev-1' }, 94), // 89: Sickness
      occurrence('ev-3', { kind: 'roll_twice', parentId: 'ev-1' }, 87, { apl: 8 }), // 82: Invasion
    ],
    selectedCandidateId: null,
    acknowledgements: {},
    exceptions: {},
    feedback: 'All changes saved.',
    remote: false,
  };
}

export type Edit =
  | { kind: 'chance'; roll: number | null }
  | { kind: 'add'; origin: Origin; candidateOf?: string; tableRoll?: number | null }
  | { kind: 'table'; id: string; roll: number | null }
  | { kind: 'occurrence'; id: string; patch: Partial<Omit<Occurrence, 'id' | 'origin'>> }
  | { kind: 'roll'; id: string; rollId: string; value: number | null }
  | { kind: 'remove'; id: string }
  | { kind: 'select_candidate'; id: string }
  | { kind: 'acknowledge'; id: string; text: string | null }
  | { kind: 'exception'; key: string; reason: string | null }
  | { kind: 'scenario'; key: keyof Scenario; on: boolean }
  | { kind: 'remote' }
  | { kind: 'reset' };

let counter = 0;
export function reduce(state: State, edit: Edit): State {
  const saved = { ...state, feedback: 'All changes saved.', remote: false };
  const patchOcc = (id: string, patch: Partial<Occurrence>) => ({
    ...saved,
    occurrences: state.occurrences.map((o) => (o.id === id ? { ...o, ...patch } : o)),
  });
  switch (edit.kind) {
    case 'chance':
      return { ...saved, chanceRoll: edit.roll };
    case 'add': {
      const id = `ev-new-${++counter}`;
      return {
        ...saved,
        occurrences: [...state.occurrences, occurrence(id, edit.origin, edit.tableRoll ?? null, edit.candidateOf ? { candidateOf: edit.candidateOf } : {})],
      };
    }
    case 'table':
      return patchOcc(edit.id, { tableRoll: edit.roll });
    case 'occurrence':
      return patchOcc(edit.id, edit.patch);
    case 'roll': {
      const o = state.occurrences.find((x) => x.id === edit.id);
      return o ? patchOcc(edit.id, { rolls: { ...o.rolls, [edit.rollId]: edit.value } }) : state;
    }
    case 'remove': {
      const removed = new Set([edit.id]);
      for (const o of state.occurrences) if ('parentId' in o.origin && removed.has(o.origin.parentId)) removed.add(o.id);
      return { ...saved, occurrences: state.occurrences.filter((o) => !removed.has(o.id)) };
    }
    case 'select_candidate':
      return { ...saved, selectedCandidateId: edit.id };
    case 'acknowledge': {
      const acknowledgements = { ...state.acknowledgements };
      if (edit.text) acknowledgements[edit.id] = edit.text;
      else delete acknowledgements[edit.id];
      return { ...saved, acknowledgements };
    }
    case 'exception': {
      const exceptions = { ...state.exceptions };
      if (edit.reason) exceptions[edit.key] = edit.reason;
      else delete exceptions[edit.key];
      return { ...saved, exceptions };
    }
    case 'scenario': {
      const scenario = { ...state.scenario, [edit.key]: edit.on };
      // Each situation gets a fitting starting tree so the variants have something to show.
      if (edit.key === 'guaranteed')
        return {
          ...state,
          scenario,
          chanceRoll: 41,
          selectedCandidateId: null,
          occurrences: edit.on
            ? [occurrence('cand-1', { kind: 'rolled' }, 30, { candidateOf: guaranteeChoice.id }), occurrence('cand-2', { kind: 'rolled' }, 73, { candidateOf: guaranteeChoice.id })]
            : initialState().occurrences,
        };
      if (edit.key === 'automatic')
        return {
          ...state,
          scenario,
          occurrences: edit.on
            ? [occurrence('auto-1', { kind: 'automatic', sourceId: automaticSource.id }, 58), ...state.occurrences.filter((o) => o.origin.kind !== 'automatic')]
            : state.occurrences.filter((o) => o.origin.kind !== 'automatic'),
        };
      return { ...state, scenario };
    }
    case 'remote':
      return { ...state, occurrences: state.occurrences.map((o) => (o.id === 'ev-2' ? { ...o, targets: ['t-wardens'] } : o)), feedback: 'All changes saved.', remote: true };
    case 'reset':
      return initialState();
  }
}

// ---------------------------------------------------------------------------
// Projection

export type Issue = { subject: string; text: string; exceptionKey?: string };
export type Modifier = { label: string; value: number };
export type CheckFact = {
  id: string;
  label: string;
  /** "Loyalty DC 20" or "Diplomacy DC 18". */
  kind: string;
  sides: number;
  die: number | null;
  modifiers: Modifier[];
  bonus: number;
  total: number | null;
  dc: number | null;
  outcome: string | null;
  /** True when the check is only rolled if the table attempts mitigation. */
  optional: boolean;
};
export type Input =
  | { kind: 'pick'; id: string; label: string; count: number; options: { id: string; title: string; note?: string }[]; value: string[] }
  | { kind: 'apl'; label: string; value: number | null }
  | { kind: 'officer'; label: string; dc: number; skills: Skill[]; value: { officerId: string | null; skill: Skill } }
  | { kind: 'rewards'; label: string; value: Reward[]; count: number }
  | { kind: 'extra_modifier'; value: Occurrence['extra'] };
export type EventFact = {
  id: string;
  number: number;
  depth: number;
  origin: Origin;
  parentId: string | null;
  candidateOf: string | null;
  /** Raw die, settlement modifier, extra table modifier, clamped total. */
  tableRoll: number | null;
  settlementModifier: Modifier | null;
  extra: Occurrence['extra'];
  total: number | null;
  type: EventType | null;
  entry: TableEntry | null;
  name: string;
  mode: 'base' | 'twice' | 'no_additional_effect' | null;
  /** How the event stands in the week's resolution. */
  status: 'awaiting' | 'expands' | 'selected' | 'twice' | 'no_additional_effect' | 'impossible' | 'negated' | 'not_selected' | 'rerolled';
  statusText: string;
  possible: boolean;
  /** Children this event still needs, by origin kind, for the tree to resolve. */
  needsChildren: { kind: 'roll_twice' | 'replacement'; count: number } | null;
  inputs: Input[];
  checks: CheckFact[];
  mitigation: { state: 'unavailable' | 'unattempted' | 'attempted'; label: string | null };
  outcomes: string[];
  acknowledgement: { required: boolean; text: string };
  sabotage: { available: boolean; value: Sabotage | null; dc: number; check: CheckFact | null; notorietyRoll: number | null; result: string | null; teams: { id: string; title: string; note: string }[] };
  requirements: Issue[];
  warnings: Issue[];
  exceptions: { key: string; subject: string; title: string; text: string; reason: string }[];
  children: EventFact[];
};
export type Projection = {
  chance: number;
  chanceModifiers: Modifier[];
  chanceRoll: number | null;
  /** What the chance roll decides. */
  chanceOutcome: 'pending' | 'event' | 'quiet' | 'skipped';
  chanceSkippedReason: string | null;
  operating: (typeof settlements)[number] | null;
  guarantee: { choice: typeof guaranteeChoice; candidates: EventFact[]; selectedId: string | null } | null;
  automatic: { source: typeof automaticSource; events: EventFact[] } | null;
  roots: EventFact[];
  /** All events in resolution order, flattened. */
  list: EventFact[];
  selected: EventFact[];
  requirements: Issue[];
  warnings: Issue[];
  ready: boolean;
  nextUneventfulCarry: boolean | null;
  after: { notoriety: number; trainingDelta: number; treasuryGp: number; teams: string[]; persistent: string[]; queued: string[] };
};

const signed = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);
const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? id;
const settlementName = (id: string) => settlements.find((s) => s.id === id)?.name ?? id;
const personName = (id: string) => people.find((p) => p.id === id)?.name ?? id;
export { signed, teamName, settlementName, personName };

export function project(state: State): Projection {
  const s = state.scenario;
  const requirements: Issue[] = [];
  const warnings: Issue[] = [];
  const operating = s.unfriendly ? settlements[2] : settlements[1];
  const chanceModifiers: Modifier[] = [{ label: 'Notoriety', value: notoriety }];
  if (s.uneventful) chanceModifiers.push({ label: 'Uneventful last week (rank)', value: rank });
  const chance = Math.max(10, Math.min(95, chanceModifiers.reduce((a, b) => a + b.value, 0)));
  const after: Projection['after'] = { notoriety, trainingDelta: 0, treasuryGp: treasuryStartGp, teams: [], persistent: carriedEvents.map((e) => `${e.name} (week ${e.startedWeek})`), queued: [] };
  let expanded = false;
  let number = 0;
  const dispatched: { type: EventType; id: string }[] = [];
  const facts = new Map<string, EventFact>();

  const needException = (fact: EventFact, key: string, title: string, text: string) => {
    const reason = state.exceptions[key] ?? '';
    fact.exceptions.push({ key, subject: fact.id, title, text, reason });
    if (!reason) fact.requirements.push({ subject: fact.id, text: `Record a Rules Exception: ${title}`, exceptionKey: key });
    return Boolean(reason);
  };

  const check = (fact: EventFact, id: string, label: string, kind: Check | 'skill', dc: number, die: number | null, extraModifiers: Modifier[] = [], optional = false, officerBonus: number | null = null): CheckFact => {
    const modifiers: Modifier[] = kind === 'skill' ? (officerBonus === null ? [] : [{ label: 'Officer skill', value: officerBonus }]) : [{ label: 'Rank and focus', value: kind === 'loyalty' ? 6 : kind === 'secrecy' ? 4 : 2 }, { label: 'Officers', value: checkBonus[kind] - (kind === 'loyalty' ? 6 : kind === 'secrecy' ? 4 : 2) }, ...extraModifiers];
    const bonus = modifiers.reduce((a, b) => a + b.value, 0);
    const total = die === null ? null : die + bonus;
    const outcome = total === null ? null : total >= dc ? `Success (${total} vs DC ${dc})` : `Failure (${total} vs DC ${dc})`;
    const c: CheckFact = { id, label, kind: `${kind === 'skill' ? 'Skill' : kind[0]!.toUpperCase() + kind.slice(1)} DC ${dc}`, sides: 20, die, modifiers, bonus, total, dc, outcome, optional };
    if (die === null && !optional) fact.requirements.push({ subject: fact.id, text: `Enter the ${label} (d20)` });
    else if (die !== null && (die < 1 || die > 20)) fact.warnings.push({ subject: fact.id, text: `The ${label} die is outside 1–20. The value is kept.` });
    fact.checks.push(c);
    return c;
  };
  const die = (fact: EventFact, o: Occurrence, rollId: string, label: string, sides: number) => {
    const v = o.rolls[rollId] ?? null;
    if (v === null) fact.requirements.push({ subject: fact.id, text: `Enter the ${label} (d${sides})` });
    else if (v < 1 || v > sides) fact.warnings.push({ subject: fact.id, text: `The ${label} die is outside 1–${sides}. The value is kept.` });
    return v;
  };
  const pick = (fact: EventFact, o: Occurrence, id: string, label: string, count: number, options: Input extends { kind: 'pick' } ? never : { id: string; title: string; note?: string }[]) => {
    const value = o.targets.filter((t) => options.some((op) => op.id === t)).slice(0, count);
    fact.inputs.push({ kind: 'pick', id, label, count, options, value });
    if (value.length < count) fact.requirements.push({ subject: fact.id, text: count === 1 ? `${label}: choose one` : `${label}: choose ${count}` });
    return value;
  };
  const activeTeams = teams.filter((t) => t.status === 'active').map((t) => ({ id: t.id, title: t.name, note: `${t.type} · tier ${t.tier}${t.used ? ' · acted this week' : ''}` }));

  function resolveInputs(fact: EventFact, o: Occurrence) {
    const twice = fact.mode === 'twice';
    const acknowledged = state.acknowledgements[o.id] ?? '';
    const ack = (required: boolean) => {
      fact.acknowledgement = { required, text: acknowledged };
      if (required && !acknowledged) fact.requirements.push({ subject: fact.id, text: 'Record what happened at the table' });
      if (acknowledged) fact.outcomes.push(`Recorded: “${acknowledged}”`);
    };
    switch (fact.type) {
      case 'invasion': {
        fact.inputs.push({ kind: 'apl', label: 'Average party level', value: o.apl });
        if (o.apl === null) fact.requirements.push({ subject: fact.id, text: 'Enter the average party level' });
        else fact.outcomes.push(`The GM runs a combat encounter at CR ${o.apl + 1} (APL ${o.apl} + 1)`);
        ack(true);
        break;
      }
      case 'sickness': {
        const [team] = pick(fact, o, 'team', 'Team that falls sick', 1, activeTeams);
        if (twice) {
          const c = check(fact, 'sickness', 'Loyalty check', 'loyalty', 20, o.rolls.sickness ?? null);
          if (team) fact.outcomes.push(c.total === null ? `${teamName(team)} is lost unless the Loyalty check succeeds` : c.total >= 20 ? `${teamName(team)} stays, but disabled` : `${teamName(team)} is lost`);
          if (team && c.total !== null) after.teams.push(c.total >= 20 ? `${teamName(team)} disabled` : `${teamName(team)} lost`);
        } else if (team) {
          fact.outcomes.push(`${teamName(team)}: active → disabled`);
          after.teams.push(`${teamName(team)} disabled`);
        }
        ack(false);
        break;
      }
      case 'missing_in_action': {
        const [team] = pick(fact, o, 'team', 'Team gone missing', 1, activeTeams.filter((t) => teams.find((x) => x.id === t.id)?.used));
        if (team) {
          fact.outcomes.push(twice ? `${teamName(team)} returns at the end of next week, disabled` : `${teamName(team)} is unavailable next week`);
          after.queued.push(`${teamName(team)} unavailable next week`);
        }
        ack(false);
        break;
      }
      case 'turncoat': {
        const loss = die(fact, o, 'loss', 'training loss roll', 6);
        fact.outcomes.push(loss === null ? `Training −(1d6 + ${rank})` : `Training −${loss + rank} (${loss} + ${rank})`);
        if (loss !== null) after.trainingDelta -= loss + rank;
        if (twice) {
          const [team] = pick(fact, o, 'team', 'Team that would defect', 1, activeTeams);
          fact.inputs.push({ kind: 'officer', label: 'Officer', dc: 10 + rank, skills: ['diplomacy'], value: { officerId: o.officerId, skill: 'diplomacy' } });
          const officer = people.find((p) => p.id === o.officerId);
          if (!officer) fact.requirements.push({ subject: fact.id, text: 'Choose the officer who talks the team down' });
          const c = check(fact, 'diplomacy', 'Diplomacy check', 'skill', 10 + rank, o.rolls.diplomacy ?? null, [], false, officer?.skills.diplomacy ?? null);
          if (team) fact.outcomes.push(c.total === null ? `${teamName(team)} defects unless the Diplomacy check succeeds` : c.total >= 10 + rank ? `${teamName(team)} stays, but is unavailable next Activity` : `${teamName(team)} defects and is lost`);
        }
        ack(false);
        break;
      }
      case 'cache_discovered': {
        if (twice) fact.outcomes.push('All caches are discovered and lost');
        else {
          const [cache] = pick(fact, o, 'cache', 'Cache discovered', 1, caches.map((c) => ({ id: c.id, title: c.name, note: `${c.kind} · ${c.status}` })));
          fact.mitigation = { state: o.mitigation, label: `Secrecy DC ${10 + rank} to retrieve it` };
          if (o.mitigation === 'attempted') {
            const c = check(fact, 'mitigation', 'Secrecy check', 'secrecy', 10 + rank, o.rolls.mitigation ?? null);
            if (cache) fact.outcomes.push(c.total === null ? `${caches[0]!.name} is lost unless the Secrecy check succeeds` : c.total >= 10 + rank ? `${caches[0]!.name} is retrieved` : `${caches[0]!.name} and its contents are lost`);
          } else if (cache) fact.outcomes.push(`${caches[0]!.name} and its contents are lost`);
        }
        ack(false);
        break;
      }
      case 'theft': {
        if (twice) {
          fact.outcomes.push('Theft becomes persistent: half of all incoming treasury is lost until a successful Reduce Danger');
          after.persistent.push(`Theft (week ${week})`);
        } else {
          fact.mitigation = { state: o.mitigation, label: 'Loyalty DC 20 to reduce the loss to 10%' };
          const c = o.mitigation === 'attempted' ? check(fact, 'mitigation', 'Loyalty check', 'loyalty', 20, o.rolls.mitigation ?? null) : null;
          const reduced = c !== null && c.total !== null && c.total >= 20;
          const lossGp = reduced ? Math.round(treasuryStartGp * 0.1) : Math.round(treasuryStartGp / 2);
          if (c?.total !== null) {
            fact.outcomes.push(`Treasury ${treasuryStartGp} → ${treasuryStartGp - lossGp} gp (${reduced ? '10% lost' : 'halved'})`);
            after.treasuryGp -= lossGp;
          } else fact.outcomes.push('Treasury halved, or 10% lost if the Loyalty check succeeds');
        }
        ack(false);
        break;
      }
      case 'raid': {
        const [town] = pick(fact, o, 'settlement', 'Settlement raided', 1, settlements.filter((t) => t.refuge).map((t) => ({ id: t.id, title: t.name, note: 'active refuge' })));
        if (town) {
          fact.outcomes.push(`All refuges in ${settlementName(town)} deactivate`);
          for (const person of hiddenPeople.filter((p) => p.settlementId === town)) {
            fact.mitigation = { state: o.mitigation, label: `Security DC 20 per hidden person to halve their capture chance` };
            const m = o.mitigation === 'attempted' ? check(fact, `mitigation:${person.id}`, `Security check for ${person.name}`, 'security', 20, o.rolls[`mitigation:${person.id}`] ?? null) : null;
            const halved = m !== null && m.total !== null && m.total >= 20;
            const capture = die(fact, o, `capture:${person.id}`, `capture roll for ${person.name}`, 100);
            const threshold = halved ? 25 : 50;
            if (capture !== null) fact.outcomes.push(capture <= threshold ? `${person.name} is captured (${capture} ≤ ${threshold}); Rescue Character DC ${5 + rank} next week` : `${person.name} escapes (${capture} > ${threshold})`);
            else fact.outcomes.push(`${person.name} is captured on a capture roll of ${threshold} or less`);
          }
        }
        ack(false);
        break;
      }
      case 'rivalry': {
        const picked = pick(fact, o, 'teams', 'Rival teams', 2, activeTeams);
        if (picked.length === 2) fact.outcomes.push(`${picked.map(teamName).join(' and ')} cannot act next Activity`);
        if (twice) {
          fact.inputs.push({ kind: 'officer', label: 'Officer', dc: 20, skills: ['bluff', 'diplomacy', 'intimidate'], value: { officerId: o.officerId, skill: o.skill } });
          const officer = people.find((p) => p.id === o.officerId);
          if (!officer) fact.requirements.push({ subject: fact.id, text: 'Choose the officer who settles the rivalry' });
          const c = check(fact, 'rivalry', `${o.skill[0]!.toUpperCase() + o.skill.slice(1)} check`, 'skill', 20, o.rolls.rivalry ?? null, [], false, officer?.skills[o.skill] ?? null);
          fact.outcomes.push(c.total === null ? 'Rivalry becomes persistent unless the officer succeeds' : c.total >= 20 ? 'The rivalry is settled this week' : 'Rivalry carries forward as a persistent event');
          if (c.total !== null && c.total < 20) after.persistent.push(`Rivalry (week ${week})`);
        }
        ack(false);
        break;
      }
      case 'festival':
      case 'market_day': {
        const [town] = twice && fact.type === 'market_day' ? [] : pick(fact, o, 'settlement', fact.type === 'festival' ? 'Town celebrating' : 'Town with the market day', 1, settlements.filter((t) => t.operated).map((t) => ({ id: t.id, title: t.name, note: t.reputation })));
        if (fact.type === 'market_day' && twice) fact.outcomes.push('Extra 5% discount at every operated marketplace this week');
        else if (town) fact.outcomes.push(fact.type === 'festival' ? `${signed(twice ? 5 : 2)} morale to Bluff, Diplomacy and Intimidate in ${settlementName(town)} this week` : `Extra 5% discount in ${settlementName(town)} this week`);
        ack(false);
        break;
      }
      case 'found_fire': {
        const count = twice ? people.filter((p) => p.pc).length + 1 : people.filter((p) => p.pc).length;
        fact.inputs.push({ kind: 'rewards', label: 'Alchemical items (up to 100 gp each, no poison)', value: o.rewards, count });
        if (o.rewards.length < count) fact.requirements.push({ subject: fact.id, text: `Record ${count - o.rewards.length} more alchemical item${count - o.rewards.length > 1 ? 's' : ''}` });
        for (const r of o.rewards) {
          fact.outcomes.push(`${personName(r.personId)} receives ${r.name} (${r.gp} gp)`);
          if (r.gp > 100) {
            fact.warnings.push({ subject: fact.id, text: `${r.name} is worth more than 100 gp.` });
            needException(fact, `alchemical-reward:${o.id}:${r.name}`, `${r.name} beyond 100 gp`, 'The reward differs from the permitted alchemical item.');
          }
        }
        fact.outcomes.push('Security checks +2 this coming week');
        after.queued.push('Security +2 next week');
        ack(false);
        break;
      }
      case 'broke_the_code': {
        const [item] = pick(fact, o, 'item', 'Item identified', 1, items.map((i) => ({ id: i.id, title: i.name })));
        if (item) fact.outcomes.push(`${items[0]!.name} is identified`);
        fact.outcomes.push(`PCs gain ${signed(twice ? 5 : 2)} Knowledge (local) this week`);
        ack(false);
        break;
      }
      case 'high_morale': {
        const count = Math.min(twice ? 2 : 1, carriedEvents.length);
        const picked = count ? pick(fact, o, 'persistent', 'Persistent event that ends', count, carriedEvents.map((e) => ({ id: e.id, title: e.name, note: `since week ${e.startedWeek}` }))) : [];
        for (const id of picked) {
          const e = carriedEvents.find((x) => x.id === id)!;
          fact.outcomes.push(`${e.name} (week ${e.startedWeek}) ends now`);
          after.persistent = after.persistent.filter((p) => !p.startsWith(e.name));
        }
        fact.outcomes.push(`Loyalty checks ${signed(twice ? 5 : 2)} this coming week`);
        after.queued.push(`Loyalty ${signed(twice ? 5 : 2)} next week`);
        ack(false);
        break;
      }
      case 'low_morale':
      case 'double_agent': {
        if (twice) {
          fact.outcomes.push(`${fact.name} becomes persistent`);
          after.persistent.push(`${fact.name} (week ${week})`);
        } else fact.outcomes.push(fact.type === 'low_morale' ? 'Loyalty checks −2 this week' : 'No Secure Cache next Activity; Secrecy checks −2');
        ack(false);
        break;
      }
      case 'war_games':
        fact.outcomes.push(`Training +${rank}`);
        after.trainingDelta += rank;
        ack(false);
        break;
      case 'turn_around': {
        const disabled = teams.filter((t) => t.status === 'disabled');
        if (disabled.length) {
          fact.outcomes.push(`${disabled.map((t) => t.name).join(', ')}: disabled → active`);
          after.teams.push(...disabled.map((t) => `${t.name} recovers`));
        } else fact.outcomes.push('One team gains +2 on one check next Activity');
        ack(false);
        break;
      }
      case 'all_is_calm':
        fact.outcomes.push(twice ? 'Next week skips the chance roll and is calm' : 'No event this week');
        if (twice) after.queued.push('Next week is calm (no roll)');
        break;
      case 'calm_before_the_storm':
        fact.outcomes.push(`Next week: ${twice ? 'two automatic events' : 'one automatic event'}, then the normal Event phase`);
        after.queued.push(`${twice ? 2 : 1} automatic event${twice ? 's' : ''} next week`);
        break;
      case 'week_of_pain':
      case 'week_of_serenity':
      case 'night_ops':
      case 'hidden_agenda':
        fact.outcomes.push(fact.mode === 'no_additional_effect' ? 'No additional effect' : fact.entry!.text);
        if (fact.type === 'week_of_pain') after.queued.push('−1 on checks next week; next attrition doubled');
        if (fact.type === 'week_of_serenity') after.queued.push('+5 on checks next week; next training gain doubled');
        ack(false);
        break;
      default:
        ack(false);
    }
  }

  function resolveSabotage(fact: EventFact, o: Occurrence) {
    const available = fact.type !== 'all_is_calm' && fact.type !== 'calm_before_the_storm';
    const dc = 15 + rank;
    const eligible = teams.filter((t) => t.status === 'active' && t.tier === 3).map((t) => ({ id: t.id, title: t.name, note: `${t.type} · tier ${t.tier}${t.used ? ' · acted this week' : ''}` }));
    fact.sabotage = { available, value: o.sabotage, dc, check: null, notorietyRoll: null, result: null, teams: eligible };
    if (!available || !o.sabotage) return;
    const sb = o.sabotage;
    if (!sb.teamId) fact.requirements.push({ subject: fact.id, text: 'Sabotage: choose the team' });
    if (!sb.check) fact.requirements.push({ subject: fact.id, text: 'Sabotage: choose the check' });
    const c = sb.check ? check(fact, 'sabotage', `Sabotage ${sb.check} check`, sb.check, dc, sb.roll) : null;
    fact.sabotage.check = c;
    if (sb.notorietyRoll === null) fact.requirements.push({ subject: fact.id, text: 'Sabotage: enter the notoriety roll (d6)' });
    else after.notoriety = Math.min(100, after.notoriety + sb.notorietyRoll);
    fact.sabotage.notorietyRoll = sb.notorietyRoll;
    if (c && c.total !== null) {
      fact.sabotage.result = c.total >= dc ? `Sabotage succeeds: ${fact.name} does not happen` : `Sabotage fails: ${fact.name} happens as rolled`;
      if (c.total >= dc) {
        fact.status = 'negated';
        fact.statusText = 'Negated by Sabotage';
      }
    }
    if (sb.notorietyRoll !== null) fact.outcomes.push(`Notoriety +${sb.notorietyRoll} from the Sabotage attempt`);
  }

  function build(o: Occurrence, depth: number, candidate: boolean): EventFact {
    const settlementModifier = operating.modifier ? { label: `${operating.name} (${operating.reputation})`, value: operating.modifier } : null;
    const total = o.tableRoll === null ? null : Math.max(1, Math.min(100, o.tableRoll + operating.modifier + (o.extra?.value ?? 0)));
    const entry = total === null ? null : entryFor(total);
    const fact: EventFact = {
      id: o.id,
      number: ++number,
      depth,
      origin: o.origin,
      parentId: 'parentId' in o.origin ? o.origin.parentId : null,
      candidateOf: o.candidateOf ?? null,
      tableRoll: o.tableRoll,
      settlementModifier,
      extra: o.extra,
      total,
      type: entry?.type ?? null,
      entry,
      name: entry?.name ?? 'Awaiting roll',
      mode: null,
      status: 'awaiting',
      statusText: 'Awaiting the table roll',
      possible: true,
      needsChildren: null,
      inputs: [{ kind: 'extra_modifier', value: o.extra }],
      checks: [],
      mitigation: { state: 'unavailable', label: null },
      outcomes: [],
      acknowledgement: { required: false, text: state.acknowledgements[o.id] ?? '' },
      sabotage: { available: false, value: null, dc: 15 + rank, check: null, notorietyRoll: null, result: null, teams: [] },
      requirements: [],
      warnings: [],
      exceptions: [],
      children: [],
    };
    facts.set(o.id, fact);
    if (o.tableRoll === null) fact.requirements.push({ subject: fact.id, text: `Event ${fact.number}: enter the table roll (d100)` });
    else if (o.tableRoll < 1 || o.tableRoll > 100) fact.warnings.push({ subject: fact.id, text: `Event ${fact.number}: the table die is outside 1–100. The value is kept.` });
    if (o.extra && !o.extra.reason) fact.requirements.push({ subject: fact.id, text: `Event ${fact.number}: give a reason for the table modifier` });
    if (!entry) return fact;

    // Can this event occur in the current militia state?
    fact.possible =
      entry.type === 'cache_discovered' ? caches.some((c) => c.status === 'hidden')
        : entry.type === 'raid' ? settlements.some((t) => t.refuge)
          : entry.type === 'rivalry' ? teams.filter((t) => t.status === 'active').length >= 2
            : entry.type === 'missing_in_action' ? teams.some((t) => t.used)
              : true;
    const children = (kind: 'roll_twice' | 'replacement') => state.occurrences.filter((c) => c.origin.kind === kind && 'parentId' in c.origin && c.origin.parentId === o.id);
    if (!fact.possible) {
      fact.warnings.push({ subject: fact.id, text: `${entry.name} cannot occur right now (${entry.type === 'cache_discovered' ? 'no hidden cache' : entry.type === 'raid' ? 'no active refuge' : 'not enough teams'}).` });
      const excepted = Boolean(state.exceptions[`event-eligibility:${o.id}`]);
      fact.exceptions.push({ key: `event-eligibility:${o.id}`, subject: fact.id, title: `keep ${entry.name} although it cannot occur`, text: 'This event cannot normally occur in the current militia state.', reason: state.exceptions[`event-eligibility:${o.id}`] ?? '' });
      if (!excepted) {
        const reps = children('replacement');
        fact.status = 'impossible';
        fact.statusText = 'Cannot occur: roll a replacement or keep it with a Rules Exception';
        if (reps.length !== 1) {
          fact.needsChildren = { kind: 'replacement', count: 1 };
          fact.requirements.push({ subject: fact.id, text: `Event ${fact.number} (${entry.name}) cannot occur: roll a replacement or record a Rules Exception` });
        } else if (!candidate) fact.children = reps.map((c) => build(c, depth + 1, candidate));
        else fact.children = reps.map((c) => build(c, depth + 1, candidate));
        return fact;
      }
    }
    if (entry.type === 'roll_twice') {
      const expands = o.origin.kind !== 'automatic' && !expanded && !candidate;
      if (expands) expanded = true;
      const kind = expands ? 'roll_twice' : 'replacement';
      const count = expands ? 2 : 1;
      const kids = children(kind);
      fact.status = expands ? 'expands' : 'rerolled';
      fact.statusText = expands ? 'Roll two more and resolve both' : 'Roll Twice already used this phase: reroll';
      if (kids.length !== count) {
        fact.needsChildren = { kind, count };
        fact.requirements.push({ subject: fact.id, text: expands ? `Event ${fact.number} (Roll Twice): roll two more events` : `Event ${fact.number} (Roll Twice again): roll a replacement` });
      }
      if (!candidate) fact.children = kids.slice(0, count).map((c) => build(c, depth + 1, candidate));
      return fact;
    }
    if (candidate) {
      fact.status = state.selectedCandidateId === o.id ? 'selected' : 'not_selected';
      fact.statusText = fact.status === 'selected' ? 'Chosen candidate' : 'Not chosen';
      if (fact.status !== 'selected') return fact;
    }
    const first = dispatched.find((d) => d.type === entry.type);
    dispatched.push({ type: entry.type, id: o.id });
    fact.mode = !first || independent.includes(entry.type) ? 'base' : entry.type === 'week_of_pain' || entry.type === 'week_of_serenity' ? 'no_additional_effect' : 'twice';
    fact.status = fact.mode === 'twice' ? 'twice' : fact.mode === 'no_additional_effect' ? 'no_additional_effect' : 'selected';
    fact.statusText = fact.mode === 'twice' ? `Twice: ${entry.name} again, so its Twice clause applies` : fact.mode === 'no_additional_effect' ? 'Rolled twice: no additional effect' : 'Happens this week';
    resolveInputs(fact, o);
    resolveSabotage(fact, o);
    return fact;
  }

  const roots: EventFact[] = [];
  let automatic: Projection['automatic'] = null;
  let guarantee: Projection['guarantee'] = null;
  let chanceOutcome: Projection['chanceOutcome'] = 'pending';
  let chanceSkippedReason: string | null = null;

  if (s.automatic) {
    const events = state.occurrences.filter((o) => o.origin.kind === 'automatic').map((o) => build(o, 0, false));
    automatic = { source: automaticSource, events };
    if (events.length < automaticSource.count) requirements.push({ subject: 'automatic', text: `${automaticSource.label} (week ${automaticSource.week}): roll ${automaticSource.count} automatic event` });
    roots.push(...events);
  }
  if (s.forcedCalm) {
    chanceOutcome = 'skipped';
    chanceSkippedReason = 'All Is Calm rolled twice last week: no chance roll and no event this week.';
  } else if (s.guaranteed) {
    chanceOutcome = 'skipped';
    chanceSkippedReason = `${guaranteeChoice.label} in Action Slot ${guaranteeChoice.slot} guarantees an event: no chance roll.`;
    const candidates = state.occurrences.filter((o) => o.candidateOf === guaranteeChoice.id && o.origin.kind === 'rolled').map((o) => build(o, 0, true));
    guarantee = { choice: guaranteeChoice, candidates, selectedId: state.selectedCandidateId };
    if (candidates.length < 2) requirements.push({ subject: 'guarantee', text: 'Roll both event candidates (d100 each)' });
    else if (!state.selectedCandidateId || !candidates.some((c) => c.id === state.selectedCandidateId)) requirements.push({ subject: 'guarantee', text: 'Choose which candidate event happens' });
    for (const c of candidates) if (c.status === 'selected' || c.status === 'expands' || c.status === 'rerolled' || c.status === 'impossible') roots.push(c);
  } else {
    if (state.chanceRoll === null) requirements.push({ subject: 'chance', text: 'Enter the event chance roll (d100)' });
    else if (state.chanceRoll < 1 || state.chanceRoll > 100) warnings.push({ subject: 'chance', text: 'The chance die is outside 1–100. The value is kept.' });
    if (state.chanceRoll !== null) {
      chanceOutcome = state.chanceRoll < chance ? 'event' : 'quiet';
      if (chanceOutcome === 'event') {
        const rolled = state.occurrences.filter((o) => o.origin.kind === 'rolled' && !o.candidateOf);
        if (rolled.length === 0) requirements.push({ subject: 'chance', text: 'Roll on the event table (d100)' });
        roots.push(...rolled.slice(0, 1).map((o) => build(o, 0, false)));
      }
    }
  }

  const list: EventFact[] = [];
  const walk = (f: EventFact) => {
    list.push(f);
    f.children.forEach(walk);
  };
  roots.forEach(walk);
  if (guarantee) for (const c of guarantee.candidates) if (!list.includes(c)) list.push(c);
  const selected = list.filter((f) => ['selected', 'twice', 'no_additional_effect', 'negated'].includes(f.status));
  for (const f of list) {
    requirements.push(...f.requirements);
    warnings.push(...f.warnings);
  }
  const ready = requirements.length === 0;
  const nextUneventfulCarry = !ready ? null : !s.forcedCalm && !automatic && selected.length < 2 && selected.every((f) => f.type === 'all_is_calm');
  return {
    chance,
    chanceModifiers,
    chanceRoll: state.chanceRoll,
    chanceOutcome,
    chanceSkippedReason,
    operating,
    guarantee,
    automatic,
    roots,
    list,
    selected,
    requirements,
    warnings,
    ready,
    nextUneventfulCarry,
    after,
  };
}
