// PROTOTYPE — mock Activity for Wayfinder #106 (map #99). Nothing here reads or
// writes Convex. A tiny in-memory reducer stands in for Weekly Draft edits so
// placing, moving, swapping and team choice can be tried by touch.

export type Category = 'Espionage' | 'Intelligence' | 'Military' | 'Treasury';
export type TeamStatus = 'ready' | 'disabled' | 'missing';

export type Team = {
  id: string;
  name: string;
  type: string;
  tier: 1 | 2 | 3;
  category: Category;
  status: TeamStatus;
};

export type Action = {
  id: string;
  name: string;
  /** Team types that can take this action; null when no team is needed. */
  teamTypes: string[] | null;
  check: string | null;
  cost: string | null;
  effect: string;
};

export const rank = 8;
export const rankAllowance = 3;
export const strategistBonus = 1;
export const allowance = rankAllowance + strategistBonus;

export const teams: Team[] = [
  { id: 't-wardens', name: 'Iron Wardens', type: 'Defenders', tier: 1, category: 'Military', status: 'ready' },
  { id: 't-coin', name: 'Coin Circle', type: 'Merchants', tier: 2, category: 'Treasury', status: 'ready' },
  { id: 't-whisper', name: 'Whisper Net', type: 'Informants', tier: 1, category: 'Intelligence', status: 'ready' },
  { id: 't-hands', name: 'Quiet Hands', type: 'Spies', tier: 3, category: 'Espionage', status: 'disabled' },
  { id: 't-runners', name: 'Night Runners', type: 'Specialists', tier: 3, category: 'Military', status: 'missing' },
];

export const actions: Action[] = [
  { id: 'drill', name: 'Drill Militia', teamTypes: null, check: 'Loyalty DC 18', cost: '50 gp', effect: 'Training +2d6. Once per Activity.' },
  { id: 'earn', name: 'Earn Gold', teamTypes: ['Patrons', 'Merchants', 'Fixers', 'Black Marketeers'], check: 'Loyalty', cost: null, effect: 'Gain check × tier gp.' },
  { id: 'gather', name: 'Gather Information', teamTypes: ['Informants', 'Conspirators', 'Scholars', 'Spellcasters'], check: 'Secrecy DC 15', cost: null, effect: 'Rumor, location, person or settlement.' },
  { id: 'reduce', name: 'Reduce Danger', teamTypes: ['Defenders', 'Infiltrators', 'Guardians', 'Specialists'], check: 'Security', cost: null, effect: 'Lower the danger in an area.' },
  { id: 'broker', name: 'Broker Market', teamTypes: ['Merchants', 'Fixers', 'Black Marketeers'], check: null, cost: 'varies', effect: 'Buy or sell goods.' },
  { id: 'recruit', name: 'Recruit Team', teamTypes: null, check: 'By team type', cost: null, effect: 'Add a tier 1 team.' },
  { id: 'upgrade', name: 'Upgrade Team', teamTypes: null, check: null, cost: 'By tier', effect: 'Raise a team one tier.' },
  { id: 'secure', name: 'Secure Cache', teamTypes: ['Moles', 'Propagandists', 'Saboteurs', 'Spies'], check: 'Secrecy', cost: 'By cache', effect: 'Place a supply cache.' },
  { id: 'covert', name: 'Covert Action', teamTypes: ['Spies'], check: null, cost: null, effect: 'Augment the next action.' },
  { id: 'propaganda', name: 'Spread Propaganda', teamTypes: ['Propagandists', 'Saboteurs', 'Spies'], check: 'Secrecy', cost: null, effect: 'Shift a settlement’s attitude.' },
  { id: 'strike', name: 'Strike Team', teamTypes: ['Specialists'], check: 'Security', cost: null, effect: 'Strike a target.' },
  { id: 'rescue', name: 'Rescue Character', teamTypes: ['Infiltrators', 'Guardians', 'Specialists'], check: 'Security', cost: null, effect: 'Free a captured character.' },
  { id: 'lielow', name: 'Lie Low', teamTypes: null, check: null, cost: null, effect: 'Notoriety −1d6. Uses the whole Activity.' },
  { id: 'guarantee', name: 'Guarantee Event', teamTypes: null, check: null, cost: null, effect: 'An event happens this week.' },
  { id: 'dismiss', name: 'Dismiss Team', teamTypes: null, check: 'Loyalty DC 10', cost: null, effect: 'Remove a team.' },
  { id: 'officer', name: 'Change Officer Role', teamTypes: null, check: null, cost: null, effect: 'Reassign an officer.' },
  { id: 'special', name: 'Special', teamTypes: null, check: null, cost: null, effect: 'A table-agreed action.' },
];

export const settlements = [
  { id: '', label: 'No settlement' },
  { id: 's-phaendar', label: 'Phaendar' },
  { id: 's-ekkerd', label: 'Ekkerd' },
];

export type Choice = {
  choiceId: string;
  actionId: string;
  teamId?: string;
  roll?: number;
  exceptionReason?: string;
};
export type Slot = { slotId: string; choice: Choice | null };
export type State = {
  slots: Slot[];
  settlementId: string;
  feedback: string;
  /** Slot a simulated other player just changed. */
  remoteSlotId: string | null;
};

let counter = 0;
const id = (prefix: string) => `${prefix}-${++counter}`;

export function initialState(): State {
  return {
    slots: [
      { slotId: 'slot-1', choice: { choiceId: 'c-1', actionId: 'drill', roll: 14 } },
      { slotId: 'slot-2', choice: { choiceId: 'c-2', actionId: 'earn' } },
      { slotId: 'slot-3', choice: { choiceId: 'c-3', actionId: 'gather', teamId: 't-whisper' } },
      { slotId: 'slot-4', choice: null },
      { slotId: 'slot-5', choice: { choiceId: 'c-5', actionId: 'recruit' } },
    ],
    settlementId: 's-phaendar',
    feedback: 'Prepare actions together.',
    remoteSlotId: null,
  };
}

export type Edit =
  | { kind: 'place'; actionId: string; slotId: string; teamId?: string }
  | { kind: 'move'; from: string; to: string }
  | { kind: 'clear'; slotId: string }
  | { kind: 'team'; slotId: string; teamId: string | undefined }
  | { kind: 'roll'; slotId: string; roll: number | undefined }
  | { kind: 'exception'; slotId: string; reason: string | undefined }
  | { kind: 'add_slot' }
  | { kind: 'settlement'; settlementId: string }
  | { kind: 'assign'; actionId: string; teamId?: string }
  | { kind: 'unassign_team'; teamId: string }
  | { kind: 'remote' }
  | { kind: 'reset' };

const label = (slots: Slot[], slotId: string) =>
  `Action Slot ${slots.findIndex((s) => s.slotId === slotId) + 1}`;

export function reduce(state: State, edit: Edit): State {
  const slots = state.slots.map((s) => ({ ...s }));
  const find = (slotId: string) => slots.find((s) => s.slotId === slotId)!;
  switch (edit.kind) {
    case 'place': {
      const slot = find(edit.slotId);
      const replaced = slot.choice;
      slot.choice = { choiceId: id('c'), actionId: edit.actionId, teamId: edit.teamId };
      return {
        ...state,
        slots,
        remoteSlotId: null,
        feedback: `${actionById(edit.actionId).name} ${replaced ? 'replaced ' + actionById(replaced.actionId).name + ' in' : 'placed in'} ${label(slots, edit.slotId)}.`,
      };
    }
    case 'move': {
      if (edit.from === edit.to) return state;
      const from = find(edit.from);
      const to = find(edit.to);
      const moving = from.choice;
      from.choice = to.choice;
      to.choice = moving;
      return {
        ...state,
        slots,
        feedback: from.choice
          ? `Swapped ${label(slots, edit.from)} and ${label(slots, edit.to)}.`
          : `Moved ${actionById(moving!.actionId).name} to ${label(slots, edit.to)}.`,
      };
    }
    case 'clear': {
      const slot = find(edit.slotId);
      const name = slot.choice ? actionById(slot.choice.actionId).name : 'Choice';
      slot.choice = null;
      return { ...state, slots, feedback: `${name} cleared from ${label(slots, edit.slotId)}.` };
    }
    case 'team':
    case 'roll':
    case 'exception': {
      const slot = find(edit.slotId);
      if (!slot.choice) return state;
      slot.choice = {
        ...slot.choice,
        ...(edit.kind === 'team' && { teamId: edit.teamId }),
        ...(edit.kind === 'roll' && { roll: edit.roll }),
        ...(edit.kind === 'exception' && { exceptionReason: edit.reason }),
      };
      return { ...state, slots, feedback: 'Changes saved.' };
    }
    case 'add_slot':
      return { ...state, slots: [...slots, { slotId: id('slot'), choice: null }], feedback: 'Action slot added.' };
    case 'settlement':
      return { ...state, settlementId: edit.settlementId, feedback: 'Changes saved.' };
    case 'assign': {
      // Team-first: the team's slot if it already acts, else the first empty slot, else a new one.
      let slot =
        (edit.teamId && slots.find((s) => s.choice?.teamId === edit.teamId)) ||
        slots.find((s) => !s.choice);
      if (!slot) {
        slot = { slotId: id('slot'), choice: null };
        slots.push(slot);
      }
      slot.choice = { choiceId: id('c'), actionId: edit.actionId, teamId: edit.teamId };
      return {
        ...state,
        slots,
        feedback: `${actionById(edit.actionId).name} staged in ${label(slots, slot.slotId)}.`,
      };
    }
    case 'unassign_team': {
      const slot = slots.find((s) => s.choice?.teamId === edit.teamId);
      if (!slot) return state;
      slot.choice = null;
      return { ...state, slots, feedback: `${teamById(edit.teamId)!.name} is not acting.` };
    }
    case 'remote': {
      // Another player stages Reduce Danger with Iron Wardens in the first empty slot.
      const slot = slots.find((s) => !s.choice) ?? slots[slots.length - 1]!;
      slot.choice = { choiceId: id('c'), actionId: 'reduce', teamId: 't-wardens' };
      return { ...state, slots, remoteSlotId: slot.slotId, feedback: 'Another player changed Activity.' };
    }
    case 'reset':
      return initialState();
  }
}

export const actionById = (actionId: string) => actions.find((a) => a.id === actionId)!;
export const teamById = (teamId: string | undefined) => teams.find((t) => t.id === teamId);

export const teamsFor = (action: Action) =>
  action.teamTypes ? teams.filter((t) => action.teamTypes!.includes(t.type)) : [];
export const readyTeamsFor = (action: Action) => teamsFor(action).filter((t) => t.status === 'ready');
export const actionsFor = (team: Team) => actions.filter((a) => a.teamTypes?.includes(team.type));

export type ActionAvailability = 'team' | 'no-team' | 'unavailable';
export function availability(action: Action): ActionAvailability {
  if (!action.teamTypes) return 'no-team';
  return readyTeamsFor(action).length ? 'team' : 'unavailable';
}

export const teamStatusText: Record<TeamStatus, string> = {
  ready: 'Ready',
  disabled: 'Disabled · recover in Upkeep',
  missing: 'Missing · returns end of week',
};

export type SlotFacts = {
  slot: Slot;
  index: number;
  number: number;
  strategist: boolean;
  overAllowance: boolean;
  action: Action | null;
  team: Team | undefined;
  requirements: string[];
  warnings: string[];
  checkTotal: number | null;
};

const bonus = 7;

export function slotFacts(state: State): SlotFacts[] {
  return state.slots.map((slot, index) => {
    const choice = slot.choice;
    const action = choice ? actionById(choice.actionId) : null;
    const team = teamById(choice?.teamId);
    const requirements: string[] = [];
    const warnings: string[] = [];
    const overAllowance = index >= allowance && Boolean(choice);
    const strategist = index === allowance - 1;
    if (choice && action) {
      if (action.teamTypes && !team) requirements.push('Choose a team');
      if (action.check && choice.roll === undefined) requirements.push('Enter the check d20');
      if (team && team.status !== 'ready') warnings.push('This team is unavailable for this Activity.');
      if (team && action.teamTypes && !action.teamTypes.includes(team.type))
        warnings.push('This team does not normally perform this action.');
      if (team && state.slots.some((s, i) => i < index && s.choice?.teamId === team.id))
        warnings.push('This team has already acted this Activity.');
      if (action.id === 'drill' && state.slots.some((s, i) => i < index && s.choice?.actionId === 'drill'))
        warnings.push('Drill Militia is normally available once per Activity.');
      if (action.id === 'lielow' && state.slots.filter((s) => s.choice).length > 1)
        warnings.push('Lie Low normally uses the entire Activity.');
      if (action.teamTypes && !readyTeamsFor(action).length && !team)
        warnings.push('No ready team can take this action.');
      if (choice.roll !== undefined && (choice.roll < 1 || choice.roll > 20))
        warnings.push('The die is outside its usual range. Your entered value is kept.');
      if (overAllowance) warnings.push('Over the action allowance. Move it, clear it, or record a Rules Exception.');
    }
    return {
      slot,
      index,
      number: index + 1,
      strategist,
      overAllowance,
      action,
      team,
      requirements,
      warnings,
      checkTotal:
        choice?.roll !== undefined && action?.check
          ? choice.roll + bonus + (strategist ? 2 : 0)
          : null,
    };
  });
}

export const checkBonus = (facts: SlotFacts) => bonus + (facts.strategist ? 2 : 0);

export function phaseLists(state: State) {
  const facts = slotFacts(state);
  const name = (f: SlotFacts) => `Action Slot ${f.number} (${f.action?.name})`;
  return {
    requirements: facts.flatMap((f) => f.requirements.map((r) => `${name(f)}: ${r.toLowerCase()}`)),
    warnings: facts.flatMap((f) => f.warnings.map((w) => `${name(f)}: ${w}`)),
  };
}

export const used = (state: State) => state.slots.filter((s) => s.choice).length;

/** Which slot a team acts in, if any. */
export const slotOfTeam = (state: State, teamId: string) =>
  state.slots.findIndex((s) => s.choice?.teamId === teamId);
