import type { CanonicalWeekState } from '~/lib/canonical-weekly-source';
import type { ResultCell, ResultRow } from './review-facts';
import {
  describeValue,
  fieldLabel,
  gp,
  words,
  type ReviewNames,
} from './review-text';

// Now / Rules Baseline / Final comparison over the union of facts in the
// three states. Values are compared semantically (by their stable
// serialization), never by formatted text. A fact missing from a recorded
// part of a state is `absent`; a column, or a part of it, that is not known
// (an incomplete preview, or a frozen record that never stored it) is
// `unavailable`, never zero or unchanged.

type DeepReadonly<T> = T extends (infer E)[]
  ? readonly DeepReadonly<E>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;
type WeekState = DeepReadonly<CanonicalWeekState>;
/**
 * Any of the three compared states; only read, never mutated. A frozen record
 * may lack its militia facts or week context (`null`), and an older artifact
 * format may hold only loose `recorded` facts by field name.
 */
export type ComparedState = {
  militiaSnapshot: WeekState['militiaSnapshot'] | null;
  context: WeekState['context'] | null;
  recorded?: Readonly<Record<string, unknown>>;
};

/** Which part of a state records a fact, and so decides its availability. */
type Part = 'militia' | 'context' | 'recorded';
type Fact = {
  key: string;
  group: string;
  label: string;
  value: unknown;
  text: string;
  absent: string;
  part: Part;
};

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stable(entry)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

const personKinds: Record<string, string> = {
  pc: 'Player character',
  officer_npc: 'Officer NPC',
  other_npc: 'Other NPC',
  npc: 'NPC',
};

function omit<T extends object>(value: T, ...keys: string[]) {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !keys.includes(key)),
  );
}

type Snapshot = WeekState['militiaSnapshot'];
type Context = WeekState['context'];

function fact(
  key: string,
  group: string,
  label: string,
  value: unknown,
  text: string,
  absent = 'None',
  part: Part = 'militia',
): Fact {
  return { key, group, label, value, text, absent, part };
}
type EntitySpec<T> = {
  prefix: string;
  group: string;
  identity: keyof T & string;
  /** Fields already shown in the label, left out of the value text. */
  labelled?: (keyof T & string)[];
  label: (entity: T) => string;
  absent?: string;
};
/**
 * Recorded entities compared as a whole: identity is dropped from the value
 * and, with any labelled fields, from the readable text.
 */
function entityFacts<T extends object>(
  entities: readonly T[] | undefined,
  spec: EntitySpec<T>,
  names: ReviewNames,
): Fact[] {
  return (entities ?? []).map((entity) =>
    fact(
      `${spec.prefix}:${String(entity[spec.identity])}`,
      spec.group,
      spec.label(entity),
      omit(entity, spec.identity),
      describeValue(
        omit(entity, spec.identity, ...(spec.labelled ?? [])),
        names,
      ),
      spec.absent,
    ),
  );
}

// Militia values by their stored field. Older artifacts may record any of
// them loosely; they share the row of the complete snapshot's value.
const militiaValues = {
  rank: { key: 'rank', label: 'Rank', text: String },
  training: { key: 'training', label: 'Training', text: String },
  treasuryCopper: { key: 'treasury', label: 'Treasury', text: gp },
  notoriety: { key: 'notoriety', label: 'Notoriety', text: String },
} as const;
type MilitiaValue = keyof typeof militiaValues;

function militiaValueFact(field: MilitiaValue, value: number, part: Part) {
  const spec = militiaValues[field];
  return fact(
    `militia:${spec.key}`,
    'Militia',
    spec.label,
    value,
    spec.text(value),
    'None',
    part,
  );
}
function focusFact(focus: string | null, part: Part) {
  return fact(
    'militia:focus',
    'Militia',
    'Focus',
    focus,
    focus ?? 'None',
    'None',
    part,
  );
}

function militiaFacts(snapshot: Snapshot): Fact[] {
  return [
    ...(Object.keys(militiaValues) as MilitiaValue[]).map((field) =>
      militiaValueFact(field, snapshot[field], 'militia'),
    ),
    focusFact(snapshot.focus, 'militia'),
  ];
}

function teamFacts(snapshot: Snapshot, names: ReviewNames): Fact[] {
  const absent = 'Not on roster';
  return snapshot.roster.teams.flatMap((team) => {
    const key = `team:${team.teamId}`;
    const manager = team.managerCharacterId;
    const details = omit(
      team,
      'teamId',
      'name',
      'status',
      'teamType',
      'managerCharacterId',
    );
    return [
      fact(
        `${key}:status`,
        'Teams',
        team.name,
        team.status,
        words(team.status),
        absent,
      ),
      fact(
        `${key}:type`,
        'Teams',
        `${team.name} · type`,
        team.teamType,
        words(team.teamType),
        absent,
      ),
      fact(
        `${key}:manager`,
        'Teams',
        `${team.name} · manager`,
        manager,
        manager ? names.character(manager) : 'None',
        absent,
      ),
      fact(
        `${key}:details`,
        'Teams',
        `${team.name} · details`,
        details,
        describeValue(details, names),
        absent,
      ),
    ];
  });
}

function settlementFacts(snapshot: Snapshot, names: ReviewNames): Fact[] {
  return snapshot.settlements.flatMap((settlement) => {
    const key = `settlement:${settlement.settlementId}`;
    const reputation = settlement.reputation;
    const details = omit(settlement, 'settlementId', 'name', 'reputation');
    return [
      fact(
        `${key}:reputation`,
        'Settlements',
        settlement.name,
        reputation,
        reputation ? words(reputation) : 'Unknown',
      ),
      fact(
        `${key}:details`,
        'Settlements',
        `${settlement.name} · details`,
        details,
        describeValue(details, names),
      ),
    ];
  });
}

function rosterFacts(
  snapshot: Snapshot,
  names: ReviewNames,
  reading: StateReading,
): Fact[] {
  const people = snapshot.roster.people.map((person) =>
    fact(
      `person:${person.characterId}`,
      'Roster',
      names.character(person.characterId),
      omit(person, 'characterId'),
      `${personKinds[person.kind] ?? words(person.kind)} · ${hitDiceText(snapshot, person, reading)}`,
      'Not on roster',
    ),
  );
  const characters = snapshot.characters.map((character) =>
    fact(
      `character:${character.characterId}`,
      'Characters',
      names.character(character.characterId),
      omit(character, 'characterId'),
      `Level ${character.level} · Str ${character.strength} · Dex ${character.dexterity} · Con ${character.constitution} · Int ${character.intelligence} · Wis ${character.wisdom} · Cha ${character.charisma}${character.isActive ? '' : ' · Inactive'}`,
    ),
  );
  return [...people, ...officerFacts(snapshot, names), ...characters];
}

// The effective Hit Dice the rules use (`getEffectiveHitDice`, which this
// renderer may not import): the override, or else the level of the character
// in this same state, when a blank meant level for it. A record confirmed
// before that rule shows only what it stored.
function hitDiceText(
  snapshot: Snapshot,
  person: Snapshot['roster']['people'][number],
  reading: StateReading,
) {
  const character = snapshot.characters.find(
    (entry) => entry.characterId === person.characterId,
  );
  const hitDice =
    person.hitDice ??
    (reading.isBlankHitDiceLevel && character ? character.level : null);
  if (hitDice !== null) return `${hitDice} Hit Dice`;
  return `Hit Dice ${reading.isFrozen ? 'not recorded' : 'not set'}`;
}

/** One row per officer role, compared by its sorted holders. */
function officerFacts(snapshot: Snapshot, names: ReviewNames): Fact[] {
  const roles = [
    ...new Set(snapshot.roster.officers.map((entry) => entry.role)),
  ];
  return roles.map((role) => {
    const holders = snapshot.roster.officers
      .filter((entry) => entry.role === role)
      .map((entry) => entry.characterId)
      .sort();
    return fact(
      `officer:${role}`,
      'Officers',
      words(role),
      holders,
      holders.map((id) => names.character(id)).join(', '),
      'Unassigned',
    );
  });
}

function bonusFacts(snapshot: Snapshot, names: ReviewNames): Fact[] {
  return entityFacts(
    snapshot.bonuses,
    {
      prefix: 'bonus',
      group: 'Bonuses',
      identity: 'bonusId',
      labelled: ['check'],
      label: (bonus) =>
        `${words(bonus.check)} bonus · ${names.source(bonus.source)}`,
    },
    names,
  );
}

function economyFacts(snapshot: Snapshot, names: ReviewNames): Fact[] {
  const economy = snapshot.economy;
  const group = 'Assets and delivery';
  return [
    ...entityFacts(
      economy?.items,
      {
        prefix: 'item',
        group,
        identity: 'itemId',
        labelled: ['name'],
        label: (item) => item.name,
      },
      names,
    ),
    ...entityFacts(
      economy?.caches,
      {
        prefix: 'cache',
        group,
        identity: 'cacheId',
        labelled: ['location'],
        label: (cache) => `Cache at ${cache.location}`,
      },
      names,
    ),
    ...entityFacts(
      economy?.markets,
      {
        prefix: 'market',
        group,
        identity: 'marketId',
        labelled: ['source', 'settlementId'],
        label: (market) =>
          `${words(market.source)} · ${names.settlement(market.settlementId)}`,
      },
      names,
    ),
    ...entityFacts(
      economy?.orders,
      {
        prefix: 'economy-order',
        group,
        identity: 'orderId',
        labelled: ['itemId'],
        label: (order) => `Order · ${names.item(order.itemId)}`,
      },
      names,
    ),
  ];
}

function conditionAndBenefitFacts(
  snapshot: Snapshot,
  names: ReviewNames,
): Fact[] {
  const benefits = [
    ...(snapshot.eventBenefits?.skills ?? []),
    ...(snapshot.eventBenefits?.markets ?? []),
  ];
  return [
    ...entityFacts(
      snapshot.characterActions?.people,
      {
        prefix: 'condition',
        group: 'Character conditions',
        identity: 'characterId',
        label: (person) => names.character(person.characterId),
      },
      names,
    ),
    ...entityFacts(
      benefits,
      {
        prefix: 'benefit',
        group: 'Event benefits',
        identity: 'benefitId',
        labelled: ['sourceEventIds'],
        label: (benefit) =>
          benefit.sourceEventIds.map((id) => names.event(id)).join(', ') ||
          'Event benefit',
      },
      names,
    ),
  ];
}

// Week-start facts always exist; an optional one missing is unrecorded.
function nextWeekFacts(context: Context, names: ReviewNames): Fact[] {
  const next = (key: string, label: string, value: unknown, text: string) =>
    fact(
      `context:${key}`,
      'Next week',
      label,
      value,
      text,
      'Not recorded',
      'context',
    );
  const yesNo = (value: boolean) => (value ? 'Yes' : 'No');
  const operated = context.operatedSettlementIds;
  return [
    next('startDay', 'Start day', context.startDay, String(context.startDay)),
    next(
      'uneventfulCarry',
      'Uneventful-week benefit',
      context.uneventfulCarry,
      yesNo(context.uneventfulCarry),
    ),
    next(
      'firstMilitiaWeek',
      'Skip first Upkeep',
      context.firstMilitiaWeek,
      yesNo(context.firstMilitiaWeek),
    ),
    next(
      'lastBuyoffWeek',
      'Last buyoff',
      context.lastBuyoffWeek,
      context.lastBuyoffWeek === null
        ? 'None'
        : `Week ${context.lastBuyoffWeek}`,
    ),
    ...(operated
      ? [
          next(
            'operatedSettlementIds',
            'Operating from',
            [...operated].sort(),
            operated.map((id) => names.settlement(id)).join(', ') || 'None',
          ),
        ]
      : []),
  ];
}

function carriedForwardFacts(context: Context, names: ReviewNames): Fact[] {
  return [
    ...context.carriedEvents.map((event) =>
      fact(
        `carried:${event.eventId}`,
        'Persistent events',
        names.event(event.eventId),
        omit(event, 'eventId'),
        describeValue(omit(event, 'eventId', 'eventType', 'order'), names),
        'Not carried',
        'context',
      ),
    ),
    ...context.queuedEffects.map((effect) =>
      fact(
        `queued:${effect.effectId}`,
        'Queued effects',
        names.event(effect.sourceId),
        omit(effect, 'effectId'),
        `${describeValue(effect.effect, names)} · weeks ${effect.startsWeek}–${effect.endsWeek}`,
        'Not queued',
        'context',
      ),
    ),
    ...entityFacts(
      context.orders,
      {
        prefix: 'order',
        group: 'Orders',
        identity: 'orderId',
        labelled: ['itemId'],
        label: (order) => `Order · ${names.item(order.itemId)}`,
      },
      names,
    ).map((order): Fact => ({ ...order, part: 'context' })),
  ];
}

/**
 * Loose facts of an older artifact format. Militia values join their usual
 * row; anything else stays readable under its own field label.
 */
function recordedFacts(
  recorded: Readonly<Record<string, unknown>>,
  names: ReviewNames,
): Fact[] {
  return Object.entries(recorded).map(([field, value]) => {
    if (field in militiaValues && typeof value === 'number')
      return militiaValueFact(field as MilitiaValue, value, 'recorded');
    if (field === 'focus' && (typeof value === 'string' || value === null))
      return focusFact(value, 'recorded');
    return fact(
      `recorded:${field}`,
      'Recorded facts',
      fieldLabel(field),
      value,
      describeValue(value, names, field),
      'Not recorded',
      'recorded',
    );
  });
}

// How to read a compared state: a frozen record, and whether a blank Hit Dice
// override meant the level under the rules it was confirmed with.
type StateReading = { isFrozen: boolean; isBlankHitDiceLevel: boolean };

/** Every comparable fact of one state, in Result row order. */
function stateFacts(
  state: ComparedState,
  names: ReviewNames,
  reading: StateReading,
): Fact[] {
  const snapshot = state.militiaSnapshot;
  const context = state.context;
  return [
    ...(snapshot
      ? [
          ...militiaFacts(snapshot),
          ...teamFacts(snapshot, names),
          ...settlementFacts(snapshot, names),
          ...rosterFacts(snapshot, names, reading),
          ...bonusFacts(snapshot, names),
          ...economyFacts(snapshot, names),
          ...conditionAndBenefitFacts(snapshot, names),
        ]
      : []),
    ...(context
      ? [
          ...nextWeekFacts(context, names),
          ...carriedForwardFacts(context, names),
        ]
      : []),
    ...(state.recorded ? recordedFacts(state.recorded, names) : []),
  ];
}

type Column = { state: ComparedState; facts: Map<string, Fact> } | null;
const groupOrder = [
  'Militia',
  'Teams',
  'Settlements',
  'Roster',
  'Officers',
  'Characters',
  'Bonuses',
  'Assets and delivery',
  'Character conditions',
  'Event benefits',
  'Next week',
  'Persistent events',
  'Queued effects',
  'Orders',
  'Recorded facts',
];

/**
 * Whether a state records the part of the week a fact belongs to, so that
 * the fact's absence there is itself a fact. Loose older facts never are.
 */
function records(state: ComparedState, row: Fact) {
  if (row.part === 'context') return state.context !== null;
  if (row.part === 'recorded') return false;
  return state.militiaSnapshot !== null;
}

function cell(column: Column, row: Fact, unrecorded?: string): ResultCell {
  const unavailable: ResultCell = unrecorded
    ? { kind: 'unavailable', text: unrecorded }
    : { kind: 'unavailable' };
  if (!column) return unavailable;
  const found = column.facts.get(row.key);
  if (found)
    return { kind: 'value', text: found.text, key: stable(found.value) };
  return records(column.state, row)
    ? { kind: 'absent', text: row.absent }
    : unavailable;
}
function differs(a: ResultCell, b: ResultCell) {
  if (a.kind === 'unavailable' || b.kind === 'unavailable') return false;
  if (a.kind === 'absent' || b.kind === 'absent') return a.kind !== b.kind;
  return a.key !== b.key;
}
/** The readable text of a Result cell; an unknown column is never a value. */
export function resultCellText(value: ResultCell) {
  return value.kind === 'unavailable'
    ? (value.text ?? 'Not available')
    : value.text;
}
function adjustmentDifference(
  now: ResultCell,
  baseline: ResultCell,
  final: ResultCell,
) {
  if (!differs(baseline, final)) return null;
  const from = resultCellText(baseline);
  const to = resultCellText(final);
  return differs(now, baseline) && !differs(now, final)
    ? `Table Adjustments reverse this week’s change: ${from} returns to ${to}.`
    : `Table Adjustments change the Rules Baseline ${from} to ${to}.`;
}

function compareFact(
  row: Fact,
  columns: [Column, Column, Column],
  unrecorded?: string,
): ResultRow {
  const [now, baseline, final] = columns.map((column) =>
    cell(column, row, unrecorded),
  ) as [ResultCell, ResultCell, ResultCell];
  return {
    key: row.key,
    group: row.group,
    label: row.label,
    now,
    baseline,
    final,
    // Without a Rules Baseline, Now and Final still show a change.
    changed:
      differs(now, baseline) ||
      differs(baseline, final) ||
      (baseline.kind === 'unavailable' && differs(now, final)),
    finalDiffers: differs(baseline, final),
    difference: adjustmentDifference(now, baseline, final),
  };
}

export function compareWeekStates({
  now,
  baseline,
  final,
  names,
  unrecorded,
  isBlankHitDiceLevel = unrecorded === undefined,
}: {
  now: ComparedState | null;
  baseline: ComparedState | null;
  final: ComparedState | null;
  names: ReviewNames;
  /** Text of an unknown value; a frozen record says it was not recorded. */
  unrecorded?: string;
  /**
   * Whether a blank Hit Dice override means the character's level, as it
   * always does for a live week; a frozen record passes what held under
   * its own Ruleset Version.
   */
  isBlankHitDiceLevel?: boolean;
}): ResultRow[] {
  const reading = { isFrozen: unrecorded !== undefined, isBlankHitDiceLevel };
  const columns = [now, baseline, final].map((state) =>
    state
      ? {
          state,
          facts: new Map(
            stateFacts(state, names, reading).map((fact) => [fact.key, fact]),
          ),
        }
      : null,
  ) as [Column, Column, Column];
  // Rows keep their group together and, within it, follow first appearance
  // across Now, Rules Baseline and Final.
  const union = new Map<string, Fact>();
  for (const column of columns)
    for (const [key, fact] of column?.facts ?? [])
      if (!union.has(key)) union.set(key, fact);
  const rank = (fact: Fact) => {
    const index = groupOrder.indexOf(fact.group);
    return index < 0 ? groupOrder.length : index;
  };
  return [...union.values()]
    .sort((a, b) => rank(a) - rank(b))
    .map((fact) => compareFact(fact, columns, unrecorded));
}

/** Changed-only by default; Show all reveals every fact. Presentation only. */
export function shownRows(rows: ResultRow[], showAll: boolean) {
  return showAll ? rows : rows.filter((row) => row.changed);
}
