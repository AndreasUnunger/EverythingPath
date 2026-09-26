// PROTOTYPE — mock campaign data and an in-memory reducer for the Characters &
// officers prototype (Wayfinder #114, map #99). Kind is `pc | npc` (#112).
// The `kindHome` scenario switches which copy of kind the UI treats as real.

import { abilityModifier } from '~/lib/ability-scores';

export type Kind = 'pc' | 'npc';
export type Role =
  | 'ambassador'
  | 'marshal'
  | 'spymaster'
  | 'strategist'
  | 'commandant'
  | 'overseer';
export const roles: Role[] = [
  'marshal',
  'ambassador',
  'spymaster',
  'strategist',
  'commandant',
  'overseer',
];
export const roleLabel: Record<Role, string> = {
  ambassador: 'Ambassador',
  marshal: 'Marshal',
  spymaster: 'Spymaster',
  strategist: 'Strategist',
  commandant: 'Commandant',
  overseer: 'Overseer',
};
type Check = 'Loyalty' | 'Secrecy' | 'Security';
const checkRole: Partial<Record<Role, { check: Check; abilities: Ability[] }>> =
  {
    ambassador: { check: 'Loyalty', abilities: ['constitution', 'charisma'] },
    spymaster: { check: 'Secrecy', abilities: ['dexterity', 'intelligence'] },
    marshal: { check: 'Security', abilities: ['strength', 'wisdom'] },
  };
export const roleRule: Record<Role, string> = {
  ambassador: 'Loyalty bonus from Con or Cha',
  marshal: 'Security bonus from Str or Wis',
  spymaster: 'Secrecy bonus from Dex or Int',
  strategist: '+1 militia action; that action gets +2',
  commandant: 'Hit Dice as training on a successful Drill',
  overseer: '+1 to both secondary checks; adds to one chosen event',
};

export type Ability =
  | 'strength'
  | 'dexterity'
  | 'constitution'
  | 'intelligence'
  | 'wisdom'
  | 'charisma';
export const abilityShort: Record<Ability, string> = {
  strength: 'Str',
  dexterity: 'Dex',
  constitution: 'Con',
  intelligence: 'Int',
  wisdom: 'Wis',
  charisma: 'Cha',
};
export const abilities = Object.keys(abilityShort) as Ability[];

export type Character = Record<Ability, number> & {
  id: string;
  name: string;
  level: number;
  kind: Kind; // the character-record copy
  notes: string;
  archived: boolean;
};
export type Person = {
  characterId: string;
  kind: Kind;
  hitDice: number | null;
}; // the roster copy
export type Officer = { role: Role; characterId: string };
export type Team = { id: string; name: string; managerId: string | null };
export type Pending = {
  characterId: string;
  from: Role | null;
  to: Role;
  slot: number;
};

export type Roster = { people: Person[]; officers: Officer[]; teams: Team[] };
export type Scenario = {
  kindHome: 'record' | 'roster';
  conflict: boolean;
  noPending: boolean;
};
export type EditSection = 'officers' | 'roster' | 'both';
export type State = {
  characters: Character[];
  roster: Roster;
  focus: Check;
  pending: Pending[];
  edit: {
    section: EditSection;
    reason: string;
    draft: Roster;
    conflict: boolean;
  } | null;
  scenario: Scenario;
  feedback: string;
  remote: string | null;
};

const c = (
  id: string,
  name: string,
  kind: Kind,
  level: number,
  [str, dex, con, int, wis, cha]: number[],
  notes = '',
  archived = false,
): Character => ({
  id,
  name,
  kind,
  level,
  strength: str!,
  dexterity: dex!,
  constitution: con!,
  intelligence: int!,
  wisdom: wis!,
  charisma: cha!,
  notes,
  archived,
});

export function initialState(): State {
  const characters: Character[] = [
    c(
      'aria',
      'Aria Vell',
      'pc',
      6,
      [10, 14, 12, 15, 11, 16],
      'Bard. Talks the town round.',
    ),
    c(
      'bren',
      'Bren Ironhand',
      'pc',
      7,
      [18, 10, 14, 9, 13, 10],
      'Fighter. Leads the drills.',
    ),
    c('kess', 'Kess', 'pc', 5, [11, 17, 12, 15, 12, 9], 'Ranger.'),
    c('tobin', 'Tobin Ashe', 'pc', 5, [13, 12, 14, 10, 15, 8], 'Cleric.'),
    c(
      'sera',
      'Sera of Phaendar',
      'npc',
      4,
      [9, 11, 12, 13, 12, 17],
      'Innkeeper; everyone owes her.',
    ),
    c(
      'grom',
      'Grom',
      'npc',
      3,
      [16, 12, 15, 8, 10, 10],
      'Former Chernasardo ranger.',
    ),
    c('mattock', 'Old Mattock', 'npc', 2, [12, 9, 13, 10, 14, 11], ''),
    c(
      'dalla',
      'Dalla Rook',
      'pc',
      4,
      [15, 12, 13, 10, 11, 12],
      'Left the party in week 9.',
      true,
    ),
    c(
      'wren',
      'Wren',
      'npc',
      3,
      [10, 15, 11, 14, 12, 13],
      'Courier out of Tamran.',
    ),
    c(
      'halvard',
      'Halvard Stone',
      'pc',
      6,
      [16, 11, 15, 10, 12, 11],
      'Joined in week 13.',
    ),
  ];
  const people: Person[] = [
    { characterId: 'aria', kind: 'pc', hitDice: null },
    { characterId: 'bren', kind: 'pc', hitDice: 5 },
    { characterId: 'kess', kind: 'pc', hitDice: null },
    { characterId: 'tobin', kind: 'pc', hitDice: null },
    { characterId: 'sera', kind: 'npc', hitDice: null },
    { characterId: 'grom', kind: 'npc', hitDice: null },
    { characterId: 'mattock', kind: 'npc', hitDice: null },
    { characterId: 'dalla', kind: 'pc', hitDice: null },
  ];
  const officers: Officer[] = [
    { role: 'marshal', characterId: 'bren' },
    { role: 'commandant', characterId: 'bren' },
    { role: 'commandant', characterId: 'dalla' },
    { role: 'ambassador', characterId: 'sera' },
    { role: 'strategist', characterId: 'aria' },
    { role: 'overseer', characterId: 'grom' },
  ];
  const teams: Team[] = [
    { id: 't1', name: 'Scouts', managerId: 'kess' },
    { id: 't2', name: 'Foragers', managerId: 'grom' },
    { id: 't3', name: 'Smugglers', managerId: 'sera' },
    { id: 't4', name: 'Sappers', managerId: 'mattock' },
    { id: 't5', name: 'Town Watch', managerId: 'sera' },
  ];
  return {
    characters,
    roster: { people, officers, teams },
    focus: 'Loyalty',
    pending: [
      { characterId: 'aria', from: 'strategist', to: 'spymaster', slot: 3 },
    ],
    edit: null,
    scenario: { kindHome: 'record', conflict: false, noPending: false },
    feedback: 'Saved',
    remote: null,
  };
}

export type Action =
  | { kind: 'startEdit'; section: EditSection }
  | { kind: 'cancelEdit' }
  | { kind: 'setReason'; reason: string }
  | { kind: 'save' }
  | { kind: 'assign'; role: Role; characterId: string }
  | { kind: 'move'; characterId: string; from: Role; to: Role }
  | { kind: 'unassign'; role: Role; characterId: string }
  | { kind: 'join'; characterId: string; kind_: Kind }
  | { kind: 'leave'; characterId: string }
  | { kind: 'setHitDice'; characterId: string; hitDice: number | null }
  | { kind: 'setPersonKind'; characterId: string; kind_: Kind }
  | { kind: 'saveCharacter'; character: Character }
  | { kind: 'archive'; characterId: string; archived: boolean }
  | { kind: 'scenario'; key: keyof Scenario; value: Scenario[keyof Scenario] }
  | { kind: 'remote' }
  | { kind: 'reset' };

function withDraft(
  state: State,
  section: EditSection,
  f: (r: Roster) => Roster,
): State {
  const edit = state.edit ?? {
    section,
    reason: '',
    draft: state.roster,
    conflict: false,
  };
  return {
    ...state,
    edit: { ...edit, draft: f(edit.draft) },
    feedback: 'Not saved yet',
  };
}

export function reduce(state: State, action: Action): State {
  switch (action.kind) {
    case 'startEdit':
      return {
        ...state,
        edit: {
          section: action.section,
          reason: '',
          draft: state.roster,
          conflict: false,
        },
      };
    case 'cancelEdit':
      return { ...state, edit: null, feedback: 'Saved' };
    case 'setReason':
      return state.edit
        ? { ...state, edit: { ...state.edit, reason: action.reason } }
        : state;
    case 'save': {
      if (!state.edit) return state;
      if (state.scenario.conflict && !state.edit.conflict)
        return { ...state, edit: { ...state.edit, conflict: true } };
      return {
        ...state,
        roster: state.edit.draft,
        edit: null,
        feedback: 'Saved',
        remote: null,
      };
    }
    case 'assign':
      return withDraft(state, 'officers', (r) => ({
        ...r,
        officers: r.officers.some(
          (o) => o.role === action.role && o.characterId === action.characterId,
        )
          ? r.officers
          : [
              ...r.officers,
              { role: action.role, characterId: action.characterId },
            ],
      }));
    case 'move':
      return withDraft(state, 'officers', (r) => ({
        ...r,
        officers: r.officers.map((o) =>
          o.role === action.from && o.characterId === action.characterId
            ? { ...o, role: action.to }
            : o,
        ),
      }));
    case 'unassign':
      return withDraft(state, 'officers', (r) => ({
        ...r,
        officers: r.officers.filter(
          (o) =>
            !(o.role === action.role && o.characterId === action.characterId),
        ),
      }));
    case 'join':
      return withDraft(state, 'roster', (r) => ({
        ...r,
        people: [
          ...r.people,
          {
            characterId: action.characterId,
            kind: action.kind_,
            hitDice: null,
          },
        ],
      }));
    case 'leave':
      return withDraft(state, 'roster', (r) => ({
        people: r.people.filter((p) => p.characterId !== action.characterId),
        officers: r.officers.filter(
          (o) => o.characterId !== action.characterId,
        ),
        teams: r.teams.map((t) =>
          t.managerId === action.characterId ? { ...t, managerId: null } : t,
        ),
      }));
    case 'setHitDice':
      return withDraft(state, 'roster', (r) => ({
        ...r,
        people: r.people.map((p) =>
          p.characterId === action.characterId
            ? { ...p, hitDice: action.hitDice }
            : p,
        ),
      }));
    case 'setPersonKind':
      return withDraft(state, 'roster', (r) => ({
        ...r,
        people: r.people.map((p) =>
          p.characterId === action.characterId
            ? { ...p, kind: action.kind_ }
            : p,
        ),
      }));
    case 'saveCharacter': {
      const exists = state.characters.some((x) => x.id === action.character.id);
      return {
        ...state,
        characters: exists
          ? state.characters.map((x) =>
              x.id === action.character.id ? action.character : x,
            )
          : [...state.characters, action.character],
        feedback: 'Saved',
      };
    }
    case 'archive':
      return {
        ...state,
        characters: state.characters.map((x) =>
          x.id === action.characterId ? { ...x, archived: action.archived } : x,
        ),
        feedback: 'Saved',
      };
    case 'scenario':
      return {
        ...state,
        scenario: { ...state.scenario, [action.key]: action.value },
      };
    case 'remote':
      return {
        ...state,
        roster: {
          ...state.roster,
          officers: [
            ...state.roster.officers,
            { role: 'spymaster', characterId: 'kess' },
          ],
        },
        remote: 'Another player made Kess the Spymaster',
        feedback: 'Updated by another player',
      };
    case 'reset':
      return initialState();
  }
}

// ---------- projection ----------

export type RosterRow = {
  character: Character;
  person: Person;
  kind: Kind;
  hitDiceShown: string;
  roles: Role[];
  manages: { count: number; limit: number; names: string[] };
  warnings: string[];
};
export type Holder = {
  characterId: string;
  name: string;
  counts: boolean;
  detail: string;
  archived: boolean;
};
export type RoleView = {
  role: Role;
  label: string;
  rule: string;
  holders: Holder[];
  effect: string;
  vacant: boolean;
  pending: string[];
};
export type Candidate = {
  characterId: string;
  name: string;
  kind: Kind;
  value: string;
  disabled?: string;
};
export type Projection = {
  state: State;
  editing: boolean;
  roster: Roster; // the draft while editing
  rows: RosterRow[]; // people on the roster (draft), incl. archived
  offRoster: Character[]; // active records not on the roster
  archived: Character[];
  roleViews: RoleView[];
  candidates: (role: Role) => Candidate[];
  saveWarnings: string[];
  strategistPreview: string | null;
  kindOf: (id: string) => Kind | null;
  rolesOf: (id: string) => Role[];
  characterById: (id: string) => Character;
};

export const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

export function project(state: State): Projection {
  const roster = state.edit?.draft ?? state.roster;
  const byId = new Map(state.characters.map((x) => [x.id, x]));
  const characterById = (id: string) => byId.get(id)!;
  const personOf = (id: string) =>
    roster.people.find((p) => p.characterId === id);
  const kindOf = (id: string): Kind | null => {
    const p = personOf(id);
    if (state.scenario.kindHome === 'record') return characterById(id).kind;
    return p ? p.kind : null;
  };
  const rolesOf = (id: string) =>
    roles.filter((r) =>
      roster.officers.some((o) => o.role === r && o.characterId === id),
    );
  const limitOf = (id: string) => {
    const kind = kindOf(id);
    const cha = abilityModifier(characterById(id).charisma);
    if (kind === 'pc' || rolesOf(id).length) return Math.max(1, cha);
    return 1;
  };
  const managed = (id: string) =>
    roster.teams.filter((t) => t.managerId === id);

  const rows: RosterRow[] = roster.people.map((person) => {
    const character = characterById(person.characterId);
    const teams = managed(person.characterId);
    const limit = limitOf(person.characterId);
    const warnings: string[] = [];
    const rs = rolesOf(person.characterId);
    if (rs.length > 1)
      warnings.push(`${character.name} holds ${rs.length} officer roles.`);
    if (character.archived && (rs.length || teams.length))
      warnings.push(`${character.name} is archived but still assigned.`);
    if (teams.length > limit)
      warnings.push(
        `${character.name} manages ${teams.length} teams; the limit is ${limit}.`,
      );
    return {
      character,
      person,
      kind: kindOf(person.characterId) ?? person.kind,
      hitDiceShown:
        person.hitDice === null
          ? `${character.level} (level)`
          : `${person.hitDice}`,
      roles: rs,
      manages: { count: teams.length, limit, names: teams.map((t) => t.name) },
      warnings,
    };
  });
  const onRoster = new Set(roster.people.map((p) => p.characterId));
  const offRoster = state.characters.filter(
    (x) => !x.archived && !onRoster.has(x.id),
  );
  const archived = state.characters.filter((x) => x.archived);

  const holdersOf = (role: Role) =>
    roster.officers
      .filter((o) => o.role === role)
      .map((o) => characterById(o.characterId));
  const hd = (id: string) => personOf(id)?.hitDice ?? characterById(id).level;

  const roleViews: RoleView[] = roles.map((role) => {
    const hs = holdersOf(role);
    const cr = checkRole[role];
    let effect = '';
    let holders: Holder[] = [];
    if (cr) {
      const scored = hs.map((h) => {
        const best = cr.abilities
          .map((a) => ({ a, mod: abilityModifier(h[a]) }))
          .sort((x, y) => y.mod - x.mod)[0]!;
        return { h, best };
      });
      const top = [...scored].sort((x, y) => y.best.mod - x.best.mod)[0];
      holders = scored.map(({ h, best }) => ({
        characterId: h.id,
        name: h.name,
        counts: top?.h.id === h.id,
        detail:
          top?.h.id === h.id
            ? `${abilityShort[best.a]} ${signed(best.mod)} → ${cr.check} ${signed(best.mod)}`
            : `adds nothing (does not stack)`,
        archived: h.archived,
      }));
      effect = top
        ? `${cr.check} ${signed(top.best.mod)} (${top.h.name}, ${abilityShort[top.best.a]})`
        : `Vacant: no ${cr.check} bonus`;
    } else if (role === 'commandant') {
      const total = hs.reduce((n, h) => n + hd(h.id), 0);
      holders = hs.map((h) => ({
        characterId: h.id,
        name: h.name,
        counts: true,
        detail: `${hd(h.id)} HD`,
        archived: h.archived,
      }));
      effect = hs.length
        ? `+${total} training on a successful Drill (${hs.map((h) => `${h.name} ${hd(h.id)} HD`).join(' + ')})`
        : 'Vacant: Drill Militia trains by the roll alone';
    } else if (role === 'strategist') {
      holders = hs.map((h, i) => ({
        characterId: h.id,
        name: h.name,
        counts: i === 0,
        detail:
          i === 0 ? '+1 action, +2 on it' : 'adds nothing (does not stack)',
        archived: h.archived,
      }));
      effect = hs.length
        ? '+1 militia action; that action gets +2'
        : 'Vacant: no extra action';
    } else {
      const secondary = (['Loyalty', 'Secrecy', 'Security'] as Check[]).filter(
        (x) => x !== state.focus,
      );
      holders = hs.map((h, i) => ({
        characterId: h.id,
        name: h.name,
        counts: i === 0,
        detail:
          i === 0
            ? `+1 ${secondary.join(', ')}`
            : 'adds nothing (does not stack)',
        archived: h.archived,
      }));
      effect = hs.length
        ? `+1 to ${secondary.join(' and ')}; adds to one chosen event's checks`
        : `Vacant: no bonus to ${secondary.join(' and ')}`;
    }
    const pending = state.scenario.noPending
      ? []
      : state.pending
          .filter((p) => p.to === role || p.from === role)
          .map(
            (p) =>
              `${characterById(p.characterId).name}: ${p.from ? roleLabel[p.from] : 'no role'} → ${roleLabel[p.to]} (Activity, slot ${p.slot})`,
          );
    return {
      role,
      label: roleLabel[role],
      rule: roleRule[role],
      holders,
      effect,
      vacant: hs.length === 0,
      pending,
    };
  });

  const candidates = (role: Role): Candidate[] =>
    roster.people
      .filter(
        (p) =>
          !roster.officers.some(
            (o) => o.role === role && o.characterId === p.characterId,
          ),
      )
      .map((p) => {
        const h = characterById(p.characterId);
        const cr = checkRole[role];
        const current = roleViews.find((v) => v.role === role)!;
        let value: string;
        if (cr) {
          const best = cr.abilities
            .map((a) => ({ a, mod: abilityModifier(h[a]) }))
            .sort((x, y) => y.mod - x.mod)[0]!;
          const now = current.holders
            .find((x) => x.counts)
            ?.detail.match(/[+-]\d+$/)?.[0];
          value = `${abilityShort[best.a]} ${signed(best.mod)} → ${cr.check} ${signed(best.mod)}${now ? `, currently ${now}` : ''}`;
        } else if (role === 'commandant')
          value = `${hd(h.id)} HD → +${hd(h.id)} training on Drill`;
        else if (role === 'strategist')
          value = current.vacant
            ? '+1 action, +2 on it'
            : 'adds nothing (does not stack)';
        else
          value = current.vacant
            ? '+1 secondary checks'
            : 'adds nothing (does not stack)';
        const other = rolesOf(h.id);
        return {
          characterId: h.id,
          name: h.name,
          kind: kindOf(h.id) ?? p.kind,
          value,
          disabled: h.archived
            ? 'archived'
            : other.length
              ? `already ${other.map((r) => roleLabel[r]).join(', ')}`
              : undefined,
        };
      })
      .sort((a, b) => (a.disabled ? 1 : 0) - (b.disabled ? 1 : 0));

  const saveWarnings = rows.flatMap((r) => r.warnings);
  const hadStrategist = state.roster.officers.some(
    (o) => o.role === 'strategist',
  );
  const hasStrategist = roster.officers.some((o) => o.role === 'strategist');
  if (state.edit && hadStrategist && !hasStrategist)
    saveWarnings.push(
      'Removing the Strategist leaves Activity slot 5 without an action this week.',
    );
  for (const p of state.roster.people) {
    const still = roster.people.some((x) => x.characterId === p.characterId);
    if (!still) {
      const cleared = managed(p.characterId).length;
      const name = characterById(p.characterId).name;
      saveWarnings.push(
        cleared
          ? `Removing ${name} clears the manager of ${managed(p.characterId)
              .map((t) => t.name)
              .join(' and ')}.`
          : `${name} leaves the roster and loses all officer roles.`,
      );
    }
  }
  const strategistPreview =
    state.edit && hadStrategist !== hasStrategist
      ? `Activity actions this week: ${hadStrategist ? '5 → 4' : '4 → 5'}`
      : null;

  return {
    state,
    editing: state.edit !== null,
    roster,
    rows,
    offRoster,
    archived,
    roleViews,
    candidates,
    saveWarnings,
    strategistPreview,
    kindOf,
    rolesOf,
    characterById,
  };
}
