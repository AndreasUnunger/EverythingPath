// PROTOTYPE — mock Persistent phase for Wayfinder #109 (map #99). Nothing here
// reads or writes Convex. A tiny reducer stands in for Weekly Draft edits, and
// `project()` imitates `projectPersistentEvents`: events are resolved oldest
// first, each buyoff observes the ones staged before it, and every decision
// yields requirements, warnings, Rules Exceptions and a staged outcome.

export const week = 14;
export const rank = 8;
export const minimumGp = rank * 10;
/** "2 × current minimum treasury value", rules cost of a buyoff. */
export const buyoffGp = 2 * minimumGp;
export const signed = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);

export const people = [
  { id: 'p-amara', name: 'Amara Voss', role: 'Ambassador', pc: true },
  { id: 'p-doran', name: 'Doran Kest', role: 'Strategist', pc: true },
  { id: 'p-ilse', name: 'Ilse Marrow', role: 'Overseer', pc: false },
  { id: 'p-pell', name: 'Pell', role: null, pc: false },
];
export const skills = [
  { value: 'diplomacy', label: 'Diplomacy' },
  { value: 'bluff', label: 'Bluff' },
  { value: 'intimidate', label: 'Intimidate' },
] as const;
export type Skill = (typeof skills)[number]['value'];

export type EventType = 'theft' | 'rivalry' | 'low-morale';
export type Carried = {
  id: string;
  type: EventType;
  startedWeek: number;
  /** Position among events that started the same week (0-based, as recorded). */
  order: number;
  targets: string[];
};
export const carried: Carried[] = [
  { id: 'e-theft-9', type: 'theft', startedWeek: 9, order: 0, targets: [] },
  { id: 'e-theft-12', type: 'theft', startedWeek: 12, order: 0, targets: [] },
  {
    id: 'e-rivalry-12',
    type: 'rivalry',
    startedWeek: 12,
    order: 1,
    targets: ['Scouts', 'Rangers'],
  },
  {
    id: 'e-morale-13',
    type: 'low-morale',
    startedWeek: 13,
    order: 0,
    targets: [],
  },
];

export const eventInfo: Record<
  EventType,
  {
    name: string;
    effect: string;
    mitigation: string | null;
    mitigateLabel: string | null;
  }
> = {
  theft: {
    name: 'Theft',
    effect:
      'Half of all incoming treasury gains are lost each week until a Reduce Danger action succeeds.',
    mitigation:
      'A Loyalty check against DC 20 keeps 90% of this week’s gains instead. It lasts one week and must be repeated; the event stays.',
    mitigateLabel: 'Loyalty check (this week only)',
  },
  rivalry: {
    name: 'Rivalry',
    effect: 'The two rival teams cannot act in the Activity phase.',
    mitigation:
      'An officer ends the Rivalry for good with a Diplomacy, Bluff or Intimidate check against DC 20.',
    mitigateLabel: 'Officer check to end it',
  },
  'low-morale': {
    name: 'Low Morale',
    effect: 'Loyalty checks suffer −2.',
    mitigation: null,
    mitigateLabel: null,
  },
};

export type DecisionKind = 'unattempted' | 'mitigate' | 'buyoff' | 'end';
export type Decision = {
  kind: DecisionKind;
  /** d20 for the Loyalty check (Theft) or the officer's check (Rivalry). */
  die?: number | null;
  /** The Overseer's character id when their support is used on this check. */
  overseerId?: string | null;
  officerId?: string | null;
  skill?: Skill;
  skillBonus?: number | null;
  /** The table-adjudicated ending. */
  outcome?: string;
};

export type State = {
  scenario: {
    /** The last buyoff was week 12, so the four-week wait runs until week 16. */
    cooldown: boolean;
    /** Treasury 120 gp: one buyoff is affordable, a second is not. */
    lowTreasury: boolean;
    /** A Reduce Danger action in Activity slot 2 already ends the second Theft. */
    endedInActivity: boolean;
    /** The Overseer role is not filled. */
    noOverseer: boolean;
    /** Upkeep and Event still have open decisions. */
    earlierPhasesOpen: boolean;
  };
  decisions: Record<string, Decision>;
  /** Rules Exception reasons keyed by `${eventId}:${rule}`. */
  exceptions: Record<string, string>;
  feedback: string;
  remote: boolean;
};

export function initialState(): State {
  return {
    scenario: {
      cooldown: false,
      lowTreasury: false,
      endedInActivity: false,
      noOverseer: false,
      earlierPhasesOpen: true,
    },
    decisions: {
      'e-theft-9': { kind: 'buyoff' },
      'e-rivalry-12': {
        kind: 'mitigate',
        officerId: 'p-amara',
        skill: 'diplomacy',
        skillBonus: 11,
        die: null,
      },
    },
    exceptions: {},
    feedback: 'All changes saved.',
    remote: false,
  };
}

export type Edit =
  | { kind: 'decide'; eventId: string; decision: Decision | null }
  | { kind: 'exception'; key: string; reason: string | null }
  | { kind: 'scenario'; key: keyof State['scenario']; on: boolean }
  | { kind: 'remote' }
  | { kind: 'reset' };

export function reduce(state: State, edit: Edit): State {
  const saved = { ...state, feedback: 'All changes saved.', remote: false };
  switch (edit.kind) {
    case 'decide': {
      const decisions = { ...state.decisions };
      if (edit.decision) decisions[edit.eventId] = edit.decision;
      else delete decisions[edit.eventId];
      if (edit.decision?.overseerId)
        for (const [id, d] of Object.entries(decisions))
          if (id !== edit.eventId && d.overseerId)
            decisions[id] = { ...d, overseerId: null };
      return { ...saved, decisions };
    }
    case 'exception': {
      const exceptions = { ...state.exceptions };
      if (edit.reason) exceptions[edit.key] = edit.reason;
      else delete exceptions[edit.key];
      return { ...saved, exceptions };
    }
    case 'scenario':
      return { ...state, scenario: { ...state.scenario, [edit.key]: edit.on } };
    case 'remote':
      return {
        ...state,
        decisions: {
          ...state.decisions,
          'e-rivalry-12': {
            ...state.decisions['e-rivalry-12'],
            kind: 'mitigate',
            die: 17,
          },
        },
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
export type Issue = { subject: string; text: string };
export type Exception = {
  key: string;
  subject: string;
  rule: string;
  text: string;
  reason: string;
};
export type Check = {
  label: string;
  die: number | null;
  modifiers: Modifier[];
  bonus: number;
  total: number | null;
  dc: number;
  succeeded: boolean | null;
};
export type EventView = Carried & {
  /** 1-based position in the oldest-first queue. */
  index: number;
  name: string;
  ageWeeks: number;
  decision: Decision;
  /** Set when another phase already ends this event (Activity or Event). */
  endedElsewhere: string | null;
  /** True when Confirmation would end the event. */
  ended: boolean;
  /** One line: what this week does to the event. */
  staged: string;
  stagedTone: 'ends' | 'stays' | 'open';
  check: Check | null;
  /** The Overseer's support for this check, if the role is filled. */
  overseer: { name: string; bonus: number; usedOn: string | null } | null;
  requirements: Issue[];
  warnings: Issue[];
  exceptions: Exception[];
  canMitigate: boolean;
};
export type Projection = {
  lastBuyoffWeek: number | null;
  /** Whether a buyoff staged this week is inside the four-week wait. */
  buyoffOpen: boolean;
  /** The week the next buyoff is allowed after this week's staged ones. */
  nextBuyoffWeek: number;
  buyoffsStaged: number;
  treasuryStartGp: number;
  treasuryAfterGp: number;
  carriedAfter: number;
  events: EventView[];
  requirements: Issue[];
  warnings: Issue[];
  exceptions: Exception[];
  earlierPhasesOpen: boolean;
  ready: boolean;
};

const exceptionText: Record<string, string> = {
  'buyoff-cooldown': 'Another buyoff falls inside the four-week wait.',
  treasury: 'The treasury cannot cover this buyoff.',
  'persistent-ending': 'A table-adjudicated ending needs the table’s reason.',
  'officer-assignment': 'The chosen character is not an officer.',
};

export function project(state: State): Projection {
  const { scenario } = state;
  const treasuryStartGp = scenario.lowTreasury ? 120 : 310;
  let treasury = treasuryStartGp;
  let lastBuyoff: number | null = scenario.cooldown ? 12 : null;
  let buyoffs = 0;
  const requirements: Issue[] = [];
  const warnings: Issue[] = [];
  const exceptions: Exception[] = [];

  const overseerRole = scenario.noOverseer
    ? null
    : { id: 'p-ilse', name: 'Ilse Marrow', bonus: 3 };
  const overseerUsedOn =
    Object.entries(state.decisions).find(
      ([, d]) =>
        d.kind === 'mitigate' &&
        overseerRole &&
        d.overseerId === overseerRole.id,
    )?.[0] ?? null;
  const ordered = [...carried].sort(
    (a, b) => a.startedWeek - b.startedWeek || a.order - b.order,
  );
  const events = ordered.map((event, i): EventView => {
    const info = eventInfo[event.type];
    const name = info.name;
    const subject = event.id;
    const decision: Decision = state.decisions[event.id] ?? {
      kind: 'unattempted',
    };
    const own: Issue[] = [];
    const ownWarnings: Issue[] = [];
    const ownExceptions: Exception[] = [];
    const require = (text: string) => own.push({ subject, text });
    const warn = (text: string) => ownWarnings.push({ subject, text });
    const except = (rule: string) => {
      const key = `${event.id}:${rule}`;
      const reason = state.exceptions[key] ?? '';
      ownExceptions.push({
        key,
        subject,
        rule,
        text: exceptionText[rule]!,
        reason,
      });
      if (!reason)
        require(
          `Record the Rules Exception: ${exceptionText[rule]!.replace(/\.$/, '').toLowerCase()}.`,
        );
      return Boolean(reason);
    };
    const endedElsewhere =
      scenario.endedInActivity && event.id === 'e-theft-12'
        ? 'Reduce Danger in Activity slot 2'
        : null;

    let ended = false;
    let staged = 'Stays';
    let stagedTone: EventView['stagedTone'] = 'stays';
    let check: Check | null = null;

    if (endedElsewhere) {
      ended = true;
      staged = `Ends · ${endedElsewhere}`;
      stagedTone = 'ends';
    } else if (decision.kind === 'buyoff') {
      let permitted = true;
      if (lastBuyoff !== null && week < lastBuyoff + 4)
        permitted = except('buyoff-cooldown') && permitted;
      if (treasury < buyoffGp) permitted = except('treasury') && permitted;
      if (permitted) {
        treasury -= buyoffGp;
        lastBuyoff = week;
        buyoffs += 1;
        ended = true;
        staged = `Ends · buyoff ${buyoffGp} gp`;
        stagedTone = 'ends';
      } else {
        staged = 'Buyoff needs a Rules Exception';
        stagedTone = 'open';
      }
    } else if (decision.kind === 'end') {
      if (!decision.outcome?.trim()) {
        require('Describe how the event ended at the table.');
        staged = 'Ending needs its outcome';
        stagedTone = 'open';
      } else if (except('persistent-ending')) {
        ended = true;
        staged = 'Ends · recorded at the table';
        stagedTone = 'ends';
      } else {
        staged = 'Ending needs a Rules Exception';
        stagedTone = 'open';
      }
    } else if (decision.kind === 'mitigate' && event.type === 'theft') {
      const modifiers: Modifier[] = [
        { label: 'Rank and focus', value: 6 },
        { label: 'Officers (Amara, Ambassador)', value: 2 },
      ];
      if (overseerRole && decision.overseerId === overseerRole.id)
        modifiers.push({
          label: `Overseer support (${overseerRole.name.split(' ')[0]}, Constitution)`,
          value: overseerRole.bonus,
        });
      const bonus = modifiers.reduce((a, m) => a + m.value, 0);
      const die = decision.die ?? null;
      const total = die === null ? null : die + bonus;
      if (die !== null && (die < 1 || die > 20))
        warn('The die is outside 1–20. Your value is kept for the table.');
      check = {
        label: 'Loyalty',
        die,
        modifiers,
        bonus,
        total,
        dc: 20,
        succeeded: total === null ? null : total >= 20,
      };
      if (die === null) {
        require('Enter the Loyalty check die.');
        staged = 'Stays · check pending';
        stagedTone = 'open';
      } else
        staged =
          total! >= 20
            ? 'Stays · keeps 90% of this week’s gains'
            : 'Stays · loses half of this week’s gains';
    } else if (decision.kind === 'mitigate' && event.type === 'rivalry') {
      const officer = people.find((p) => p.id === decision.officerId);
      const die = decision.die ?? null;
      let blocked = false;
      if (!officer) {
        require('Choose the officer making the check.');
        blocked = true;
      } else if (!officer.role)
        blocked = !except('officer-assignment') || blocked;
      if (decision.skillBonus == null) {
        require('Enter the officer’s skill bonus.');
        blocked = true;
      }
      if (die === null) {
        require('Enter the officer’s d20.');
        blocked = true;
      }
      if (die !== null && (die < 1 || die > 20))
        warn('The die is outside 1–20. Your value is kept for the table.');
      const skill =
        skills.find((s) => s.value === decision.skill)?.label ?? 'Diplomacy';
      const modifiers: Modifier[] =
        officer && decision.skillBonus != null
          ? [
              {
                label: `${officer.name.split(' ')[0]}’s ${skill}`,
                value: decision.skillBonus,
              },
            ]
          : [];
      const bonus = decision.skillBonus ?? 0;
      const total =
        die === null || decision.skillBonus == null ? null : die + bonus;
      check = {
        label: skill,
        die,
        modifiers,
        bonus,
        total,
        dc: 20,
        succeeded: total === null ? null : total >= 20,
      };
      if (blocked || total === null) {
        staged = 'Stays · officer check pending';
        stagedTone = 'open';
      } else if (total >= 20) {
        ended = true;
        staged = 'Ends · officer check succeeds';
        stagedTone = 'ends';
      } else staged = 'Stays · officer check fails';
    } else if (decision.kind === 'mitigate') {
      require('This event has no mitigation rule. Choose another decision.');
      staged = 'No mitigation rule';
      stagedTone = 'open';
    }

    requirements.push(...own);
    warnings.push(...ownWarnings);
    exceptions.push(...ownExceptions);
    return {
      ...event,
      index: i + 1,
      name,
      ageWeeks: week - event.startedWeek,
      decision,
      endedElsewhere,
      ended,
      staged,
      stagedTone,
      check,
      overseer: overseerRole
        ? {
            name: overseerRole.name.split(' ')[0]!,
            bonus: overseerRole.bonus,
            usedOn:
              overseerUsedOn && overseerUsedOn !== event.id
                ? `${eventInfo[carried.find((c) => c.id === overseerUsedOn)!.type].name} (week ${carried.find((c) => c.id === overseerUsedOn)!.startedWeek})`
                : null,
          }
        : null,
      requirements: own,
      warnings: ownWarnings,
      exceptions: ownExceptions,
      canMitigate: info.mitigation !== null,
    };
  });

  if (scenario.earlierPhasesOpen)
    requirements.push({
      subject: 'phases',
      text: 'Earlier phases still need preparation: Upkeep, Event.',
    });

  return {
    lastBuyoffWeek: scenario.cooldown ? 12 : null,
    buyoffOpen: !(scenario.cooldown && week < 12 + 4),
    nextBuyoffWeek: lastBuyoff === null ? week : lastBuyoff + 4,
    buyoffsStaged: buyoffs,
    treasuryStartGp,
    treasuryAfterGp: treasury,
    carriedAfter: events.filter((e) => !e.ended).length,
    events,
    requirements,
    warnings,
    exceptions,
    earlierPhasesOpen: scenario.earlierPhasesOpen,
    ready: requirements.length === 0,
  };
}
