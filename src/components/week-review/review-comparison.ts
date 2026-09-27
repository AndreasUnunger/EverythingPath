import type { CanonicalWeekState } from '~/lib/canonical-weekly-source';
import type { ResultCell, ResultRow } from './review-facts';
import { describeValue, gp, words, type ReviewNames } from './review-text';

// Now / Rules Baseline / Final comparison over the union of facts in the
// three states. Values are compared semantically (by their stable
// serialization), never by formatted text. A missing state column is
// `unavailable`; a fact missing from an available state is `absent`.

type DeepReadonly<T> = T extends (infer E)[]
  ? readonly DeepReadonly<E>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;
/** Any of the three compared states; only read, never mutated. */
export type ComparedState = DeepReadonly<CanonicalWeekState>;

type Fact = {
  key: string;
  group: string;
  label: string;
  value: unknown;
  text: string;
  absent: string;
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
};

function omit<T extends object>(value: T, ...keys: string[]) {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !keys.includes(key)),
  );
}

type Snapshot = ComparedState['militiaSnapshot'];
type Context = ComparedState['context'];

function fact(
  key: string,
  group: string,
  label: string,
  value: unknown,
  text: string,
  absent = 'None',
): Fact {
  return { key, group, label, value, text, absent };
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

function militiaFacts(snapshot: Snapshot): Fact[] {
  const militia = (key: string, label: string, value: unknown, text: string) =>
    fact(`militia:${key}`, 'Militia', label, value, text);
  return [
    militia('rank', 'Rank', snapshot.rank, String(snapshot.rank)),
    militia(
      'training',
      'Training',
      snapshot.training,
      String(snapshot.training),
    ),
    militia(
      'treasury',
      'Treasury',
      snapshot.treasuryCopper,
      gp(snapshot.treasuryCopper),
    ),
    militia(
      'notoriety',
      'Notoriety',
      snapshot.notoriety,
      String(snapshot.notoriety),
    ),
    militia('focus', 'Focus', snapshot.focus, snapshot.focus ?? 'None'),
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

function rosterFacts(snapshot: Snapshot, names: ReviewNames): Fact[] {
  const people = snapshot.roster.people.map((person) =>
    fact(
      `person:${person.characterId}`,
      'Roster',
      names.character(person.characterId),
      omit(person, 'characterId'),
      `${personKinds[person.kind] ?? words(person.kind)}${person.hitDice === null ? '' : ` · ${person.hitDice} Hit Dice`}`,
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
    fact(`context:${key}`, 'Next week', label, value, text, 'Not recorded');
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
    ),
  ];
}

/** Every comparable fact of one state, in Result row order. */
function stateFacts(state: ComparedState, names: ReviewNames): Fact[] {
  const snapshot = state.militiaSnapshot;
  return [
    ...militiaFacts(snapshot),
    ...teamFacts(snapshot, names),
    ...settlementFacts(snapshot, names),
    ...rosterFacts(snapshot, names),
    ...bonusFacts(snapshot, names),
    ...economyFacts(snapshot, names),
    ...conditionAndBenefitFacts(snapshot, names),
    ...nextWeekFacts(state.context, names),
    ...carriedForwardFacts(state.context, names),
  ];
}

function cell(
  fact: Fact | undefined,
  available: boolean,
  absent: string,
): ResultCell {
  if (!available) return { kind: 'unavailable' };
  if (!fact) return { kind: 'absent', text: absent };
  return { kind: 'value', text: fact.text, key: stable(fact.value) };
}
function differs(a: ResultCell, b: ResultCell) {
  if (a.kind === 'unavailable' || b.kind === 'unavailable') return false;
  if (a.kind === 'absent' || b.kind === 'absent') return a.kind !== b.kind;
  return a.key !== b.key;
}
/** The readable text of a Result cell; an unknown column is never a value. */
export function resultCellText(value: ResultCell) {
  return value.kind === 'unavailable' ? 'Not available' : value.text;
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

type Column = Map<string, Fact> | null;
function compareFact(row: Fact, columns: [Column, Column, Column]): ResultRow {
  const [now, baseline, final] = columns.map((facts) =>
    cell(facts?.get(row.key), facts !== null, row.absent),
  ) as [ResultCell, ResultCell, ResultCell];
  return {
    key: row.key,
    group: row.group,
    label: row.label,
    now,
    baseline,
    final,
    changed: differs(now, baseline) || differs(baseline, final),
    finalDiffers: differs(baseline, final),
    difference: adjustmentDifference(now, baseline, final),
  };
}

export function compareWeekStates({
  now,
  baseline,
  final,
  names,
}: {
  now: ComparedState;
  baseline: ComparedState | null;
  final: ComparedState | null;
  names: ReviewNames;
}): ResultRow[] {
  const columns = [now, baseline, final].map((state) =>
    state
      ? new Map(stateFacts(state, names).map((fact) => [fact.key, fact]))
      : null,
  ) as [Column, Column, Column];
  // Rows follow first appearance across Now, Rules Baseline and Final.
  const union = new Map<string, Fact>();
  for (const facts of columns)
    for (const [key, fact] of facts ?? [])
      if (!union.has(key)) union.set(key, fact);
  return [...union.values()].map((fact) => compareFact(fact, columns));
}

/** Changed-only by default; Show all reveals every fact. Presentation only. */
export function shownRows(rows: ResultRow[], showAll: boolean) {
  return showAll ? rows : rows.filter((row) => row.changed);
}
