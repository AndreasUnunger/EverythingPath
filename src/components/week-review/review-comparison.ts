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

function stateFacts(state: ComparedState, names: ReviewNames): Fact[] {
  const snapshot = state.militiaSnapshot;
  const context = state.context;
  const facts: Fact[] = [];
  const add = (
    key: string,
    group: string,
    label: string,
    value: unknown,
    text: string,
    absent = 'None',
  ) => facts.push({ key, group, label, value, text, absent });
  const militia = (key: string, label: string, value: unknown, text: string) =>
    add(`militia:${key}`, 'Militia', label, value, text);

  militia('rank', 'Rank', snapshot.rank, String(snapshot.rank));
  militia('training', 'Training', snapshot.training, String(snapshot.training));
  militia(
    'treasury',
    'Treasury',
    snapshot.treasuryCopper,
    gp(snapshot.treasuryCopper),
  );
  militia(
    'notoriety',
    'Notoriety',
    snapshot.notoriety,
    String(snapshot.notoriety),
  );
  militia('focus', 'Focus', snapshot.focus, snapshot.focus ?? 'None');

  for (const team of snapshot.roster.teams) {
    const key = `team:${team.teamId}`;
    add(
      `${key}:status`,
      'Teams',
      team.name,
      team.status,
      words(team.status),
      'Not on roster',
    );
    add(
      `${key}:type`,
      'Teams',
      `${team.name} · type`,
      team.teamType,
      words(team.teamType),
      'Not on roster',
    );
    add(
      `${key}:manager`,
      'Teams',
      `${team.name} · manager`,
      team.managerCharacterId,
      team.managerCharacterId
        ? names.character(team.managerCharacterId)
        : 'None',
      'Not on roster',
    );
    add(
      `${key}:details`,
      'Teams',
      `${team.name} · details`,
      omit(team, 'teamId', 'name', 'status', 'teamType', 'managerCharacterId'),
      describeValue(
        omit(
          team,
          'teamId',
          'name',
          'status',
          'teamType',
          'managerCharacterId',
        ),
        names,
      ),
      'Not on roster',
    );
  }
  for (const settlement of snapshot.settlements) {
    const key = `settlement:${settlement.settlementId}`;
    add(
      `${key}:reputation`,
      'Settlements',
      settlement.name,
      settlement.reputation,
      settlement.reputation ? words(settlement.reputation) : 'Unknown',
    );
    const rest = omit(settlement, 'settlementId', 'name', 'reputation');
    add(
      `${key}:details`,
      'Settlements',
      `${settlement.name} · details`,
      rest,
      describeValue(rest, names),
    );
  }
  for (const person of snapshot.roster.people)
    add(
      `person:${person.characterId}`,
      'Roster',
      names.character(person.characterId),
      omit(person, 'characterId'),
      `${personKinds[person.kind] ?? words(person.kind)}${person.hitDice === null ? '' : ` · ${person.hitDice} Hit Dice`}`,
      'Not on roster',
    );
  const roles = [
    ...new Set(snapshot.roster.officers.map((entry) => entry.role)),
  ];
  for (const role of roles) {
    const holders = snapshot.roster.officers
      .filter((entry) => entry.role === role)
      .map((entry) => entry.characterId)
      .sort();
    add(
      `officer:${role}`,
      'Officers',
      words(role),
      holders,
      holders.map((id) => names.character(id)).join(', '),
      'Unassigned',
    );
  }
  for (const character of snapshot.characters) {
    const rest = omit(character, 'characterId');
    add(
      `character:${character.characterId}`,
      'Characters',
      names.character(character.characterId),
      rest,
      `Level ${character.level} · Str ${character.strength} · Dex ${character.dexterity} · Con ${character.constitution} · Int ${character.intelligence} · Wis ${character.wisdom} · Cha ${character.charisma}${character.isActive ? '' : ' · Inactive'}`,
    );
  }
  for (const bonus of snapshot.bonuses)
    add(
      `bonus:${bonus.bonusId}`,
      'Bonuses',
      `${words(bonus.check)} bonus · ${names.source(bonus.source)}`,
      omit(bonus, 'bonusId'),
      describeValue(omit(bonus, 'bonusId', 'check'), names),
    );
  for (const item of snapshot.economy?.items ?? [])
    add(
      `item:${item.itemId}`,
      'Assets and delivery',
      item.name,
      omit(item, 'itemId'),
      describeValue(omit(item, 'itemId', 'name'), names),
    );
  for (const cache of snapshot.economy?.caches ?? [])
    add(
      `cache:${cache.cacheId}`,
      'Assets and delivery',
      `Cache at ${cache.location}`,
      omit(cache, 'cacheId'),
      describeValue(omit(cache, 'cacheId', 'location'), names),
    );
  for (const market of snapshot.economy?.markets ?? [])
    add(
      `market:${market.marketId}`,
      'Assets and delivery',
      `${words(market.source)} · ${names.settlement(market.settlementId)}`,
      omit(market, 'marketId'),
      describeValue(omit(market, 'marketId', 'source', 'settlementId'), names),
    );
  for (const order of snapshot.economy?.orders ?? [])
    add(
      `economy-order:${order.orderId}`,
      'Assets and delivery',
      `Order · ${names.item(order.itemId)}`,
      omit(order, 'orderId'),
      describeValue(omit(order, 'orderId', 'itemId'), names),
    );
  for (const person of snapshot.characterActions?.people ?? [])
    add(
      `condition:${person.characterId}`,
      'Character conditions',
      names.character(person.characterId),
      omit(person, 'characterId'),
      describeValue(omit(person, 'characterId'), names),
    );
  for (const benefit of [
    ...(snapshot.eventBenefits?.skills ?? []),
    ...(snapshot.eventBenefits?.markets ?? []),
  ])
    add(
      `benefit:${benefit.benefitId}`,
      'Event benefits',
      benefit.sourceEventIds.map((id) => names.event(id)).join(', ') ||
        'Event benefit',
      omit(benefit, 'benefitId'),
      describeValue(omit(benefit, 'benefitId', 'sourceEventIds'), names),
    );

  // Week-start facts always exist; an optional one missing is unrecorded.
  const next = (key: string, label: string, value: unknown, text: string) =>
    add(`context:${key}`, 'Next week', label, value, text, 'Not recorded');
  next('startDay', 'Start day', context.startDay, String(context.startDay));
  next(
    'uneventfulCarry',
    'Uneventful-week benefit',
    context.uneventfulCarry,
    context.uneventfulCarry ? 'Yes' : 'No',
  );
  next(
    'firstMilitiaWeek',
    'Skip first Upkeep',
    context.firstMilitiaWeek,
    context.firstMilitiaWeek ? 'Yes' : 'No',
  );
  next(
    'lastBuyoffWeek',
    'Last buyoff',
    context.lastBuyoffWeek,
    context.lastBuyoffWeek === null ? 'None' : `Week ${context.lastBuyoffWeek}`,
  );
  if (context.operatedSettlementIds)
    next(
      'operatedSettlementIds',
      'Operating from',
      [...context.operatedSettlementIds].sort(),
      context.operatedSettlementIds
        .map((id) => names.settlement(id))
        .join(', ') || 'None',
    );
  for (const event of context.carriedEvents) {
    const rest = omit(event, 'eventId', 'eventType', 'order');
    add(
      `carried:${event.eventId}`,
      'Persistent events',
      names.event(event.eventId),
      omit(event, 'eventId'),
      describeValue(rest, names),
      'Not carried',
    );
  }
  for (const effect of context.queuedEffects)
    add(
      `queued:${effect.effectId}`,
      'Queued effects',
      names.event(effect.sourceId),
      omit(effect, 'effectId'),
      `${describeValue(effect.effect, names)} · weeks ${effect.startsWeek}–${effect.endsWeek}`,
      'Not queued',
    );
  for (const order of context.orders)
    add(
      `order:${order.orderId}`,
      'Orders',
      `Order · ${names.item(order.itemId)}`,
      omit(order, 'orderId'),
      describeValue(omit(order, 'orderId', 'itemId'), names),
    );
  return facts;
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
const text = (value: ResultCell) =>
  value.kind === 'unavailable' ? 'Not available' : value.text;

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
  );
  const order = new Map<string, Fact>();
  for (const facts of columns)
    for (const [key, fact] of facts ?? [])
      if (!order.has(key)) order.set(key, fact);
  return [...order.values()].map((fact) => {
    const [a, b, c] = columns.map((facts) =>
      cell(facts?.get(fact.key), facts !== null, fact.absent),
    ) as [ResultCell, ResultCell, ResultCell];
    const finalDiffers = differs(b, c);
    return {
      key: fact.key,
      group: fact.group,
      label: fact.label,
      now: a,
      baseline: b,
      final: c,
      changed: differs(a, b) || finalDiffers,
      finalDiffers,
      difference: !finalDiffers
        ? null
        : differs(a, b) && !differs(a, c)
          ? `Table Adjustments reverse this week’s change: ${text(b)} returns to ${text(c)}.`
          : `Table Adjustments change the Rules Baseline ${text(b)} to ${text(c)}.`,
    };
  });
}

/** Changed-only by default; Show all reveals every fact. Presentation only. */
export function shownRows(rows: ResultRow[], showAll: boolean) {
  return showAll ? rows : rows.filter((row) => row.changed);
}
