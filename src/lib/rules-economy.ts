import type { WeeklyDraft } from './weekly-draft-contract';
import type {
  ActivityRollField,
  StagedActionChoice,
} from './weekly-draft-facts';
import type { ActivityProjection } from './rules-activity';
import type { EconomyState } from './rules-economy-state';
import type { TEAM_IDS } from './militia-domain';
import { getPurchaseCostCopper } from './rules-settlements';
import { projectSettlements } from './rules-settlements';
import teams from './militia-team-table';

type Choice = StagedActionChoice;
type Result = ActivityProjection;
type Item = EconomyState['items'][number];
type EconomyChoice = Extract<
  Choice,
  {
    actionId:
      | 'activate_black_market'
      | 'broker_market'
      | 'earn_gold'
      | 'secure_cache'
      | 'special_order';
  }
>;
export type ActivityHelpers = {
  income(
    draft: WeeklyDraft,
    result: Result,
    choice: Choice,
    grossCopper: number,
  ): void;
  dice(result: Result, choice: Choice, key: ActivityRollField): number | null;
  check(
    draft: WeeklyDraft,
    result: Result,
    choice: Choice,
    check?: 'loyalty' | 'secrecy' | 'security',
    dc?: number,
  ): number | null;
  value(
    result: Result,
    choice: Choice,
    kind: 'notoriety' | 'training' | 'treasuryCopper',
    delta: number,
  ): void;
  exception(
    draft: WeeklyDraft,
    result: Result,
    choice: Choice,
    rule: string,
  ): boolean;
  spend(
    draft: WeeklyDraft,
    result: Result,
    choice: Choice,
    cost: number,
  ): boolean;
  naturalOne(result: Result, choice: Choice): void;
};
export const economyActionTeams: Record<
  EconomyChoice['actionId'],
  readonly (typeof TEAM_IDS)[number][]
> = {
  activate_black_market: ['blackMarketeers'],
  broker_market: ['blackMarketeers', 'fixers', 'merchants'],
  earn_gold: ['blackMarketeers', 'fixers', 'merchants', 'patrons'],
  secure_cache: ['moles', 'propagandists', 'saboteurs', 'spies'],
  special_order: ['fixers'],
};
function required(result: Result, subjectId: string, key: string) {
  result.requirements.push(`${subjectId}:${key}`);
}
function acknowledged(
  draft: WeeklyDraft,
  result: Result,
  choice: Choice,
  subjectId: string,
) {
  const found = [
    ...draft.acknowledgements,
    ...(choice.acknowledgements ?? []),
  ].some((x) => x.subjectId === subjectId && x.outcome.trim());
  if (!found) required(result, choice.choiceId, `acknowledgement:${subjectId}`);
  return found;
}
function itemChange(result: Result, choiceId: string, item: Item, after: Item) {
  result.plan.push({
    kind: 'item',
    choiceId,
    before: { ...item },
    after: { ...after },
  });
  Object.assign(item, after);
}
function newItem(result: Result, choiceId: string, item: Item) {
  result.outcome.economy!.items.push(item);
  result.plan.push({
    kind: 'item',
    choiceId,
    before: null,
    after: { ...item },
  });
}
function purchasePrice(
  draft: WeeklyDraft,
  result: Result,
  choice: Choice,
  settlementId: string | undefined,
  copper: number,
  discount = 0,
) {
  const settlement = projectSettlements(
    result.outcome.settlements,
    draft.week,
  ).settlements.find((x) => x.settlementId === settlementId);
  if (
    settlement?.pricePercent === null ||
    settlement?.pricePercent === undefined
  ) {
    required(result, choice.choiceId, 'settlement');
    return null;
  }
  const marketDay = result.outcome.economy!.markets.some(
    (x) =>
      x.source === 'market_day' &&
      x.settlementId === settlementId &&
      x.availableWeek <= draft.week &&
      x.expiresWeek >= draft.week,
  );
  return getPurchaseCostCopper(
    copper,
    settlement.pricePercent,
    marketDay,
    discount,
  );
}
function team(
  draft: WeeklyDraft,
  result: Result,
  choice: EconomyChoice,
  helpers: ActivityHelpers,
) {
  const assigned = result.outcome.roster.teams.find(
    (x) => x.teamId === choice.teamId,
  );
  if (!assigned) {
    required(result, choice.choiceId, 'team');
    return null;
  }
  if (
    !economyActionTeams[choice.actionId].includes(assigned.teamType) &&
    !helpers.exception(draft, result, choice, 'team-action')
  )
    return null;
  return teams.find((x) => x.id === assigned.teamType)!;
}
function market(
  draft: WeeklyDraft,
  result: Result,
  choice: Extract<
    EconomyChoice,
    { actionId: 'activate_black_market' | 'broker_market' }
  >,
  teamType: string,
  helpers: ActivityHelpers,
) {
  const state = result.outcome.economy!;
  if (
    !result.outcome.settlements.some(
      (x) => x.settlementId === choice.settlementId,
    )
  ) {
    required(result, choice.choiceId, 'settlement');
    return;
  }
  const black = choice.actionId === 'activate_black_market';
  if (!helpers.spend(draft, result, choice, black ? 5000 : 10000)) return;
  if (black) {
    const total = helpers.check(draft, result, choice, 'secrecy', 20);
    if (total === null) return;
    if (total < 20) {
      const gain = helpers.dice(result, choice, 'notoriety');
      if (gain !== null) helpers.value(result, choice, 'notoriety', gain);
      return;
    }
  }
  const market: EconomyState['markets'][number] = {
    marketId: `market:${choice.choiceId}`,
    source: choice.actionId,
    settlementId: choice.settlementId!,
    availableWeek: draft.week,
    expiresWeek: draft.week,
    availability: teamType === 'merchants' ? 'small_town' : 'small_city',
    availabilityPercent: black ? 90 : null,
    salePercent: black ? 55 : 50,
    contraband: black,
  };
  state.markets.push(market);
  result.plan.push({
    kind: 'market',
    choiceId: choice.choiceId,
    market: { ...market },
  });
  for (const itemId of choice.sales ?? []) {
    const item = state.items.find((x) => x.itemId === itemId);
    if (item?.location !== 'held') {
      required(result, choice.choiceId, `sale:${itemId}`);
      continue;
    }
    itemChange(result, choice.choiceId, item, { ...item, location: 'sold' });
    helpers.income(
      draft,
      result,
      choice,
      Math.round((item.valueCopper * market.salePercent!) / 100),
    );
  }
  if (!choice.purchases) {
    required(result, choice.choiceId, 'purchases');
    return;
  }
  for (const purchase of choice.purchases) {
    const cost = purchasePrice(
      draft,
      result,
      choice,
      choice.settlementId,
      purchase.priceCopper,
    );
    if (state.items.some((x) => x.itemId === purchase.itemId)) {
      required(result, choice.choiceId, `duplicate-item:${purchase.itemId}`);
      continue;
    }
    if (!purchase.name || purchase.weight === undefined) {
      required(result, choice.choiceId, `item:${purchase.itemId}`);
      continue;
    }
    if (
      !acknowledged(draft, result, choice, `availability:${purchase.itemId}`) ||
      cost === null
    )
      continue;
    if (
      !helpers.spend(draft, result, { ...choice, costCopper: undefined }, cost)
    )
      continue;
    newItem(result, choice.choiceId, {
      itemId: purchase.itemId,
      name: purchase.name,
      weight: purchase.weight,
      valueCopper: purchase.priceCopper,
      location: 'order',
    });
    const order: EconomyState['orders'][number] = {
      orderId: `order:${choice.choiceId}:${purchase.itemId}`,
      itemId: purchase.itemId,
      source: choice.actionId,
      settlementId: choice.settlementId!,
      mode: 'purchase',
      orderedWeek: draft.week,
      orderedDay: draft.context.startDay,
      dueDay: null,
      dueActivityWeek: draft.week + 1,
      priceCopper: cost,
      deliveryDays: null,
      enchantmentValueCopper: 0,
      receipt: null,
    };
    state.orders.push(order);
    result.plan.push({
      kind: 'order',
      choiceId: choice.choiceId,
      order: { ...order },
    });
  }
}
function specialOrder(
  draft: WeeklyDraft,
  result: Result,
  choice: Extract<EconomyChoice, { actionId: 'special_order' }>,
  helpers: ActivityHelpers,
) {
  const state = result.outcome.economy!;
  for (const key of [
    'itemId',
    'orderId',
    'mode',
    'priceCopper',
    'expedited',
    'orderedDay',
    'settlementId',
  ] as const)
    if (choice[key] === undefined) required(result, choice.choiceId, key);
  if (
    !choice.itemId ||
    !choice.orderId ||
    !choice.mode ||
    choice.priceCopper === undefined ||
    choice.expedited === undefined ||
    choice.orderedDay === undefined ||
    !choice.settlementId
  )
    return;
  const existing = state.items.find((x) => x.itemId === choice.itemId);
  if (
    state.orders.some((x) => x.orderId === choice.orderId) ||
    (choice.mode === 'purchase' && existing)
  ) {
    required(result, choice.choiceId, 'duplicate-order-or-item');
    return;
  }
  if (choice.mode === 'enchantment' && existing?.location !== 'held') {
    required(result, choice.choiceId, 'existing-item');
    return;
  }
  if (
    choice.mode === 'purchase' &&
    (!choice.name || choice.weight === undefined)
  ) {
    required(result, choice.choiceId, 'item');
    return;
  }
  const baseDays = choice.expedited
    ? 1
    : helpers.dice(result, choice, 'delivery');
  const price = purchasePrice(
    draft,
    result,
    choice,
    choice.settlementId,
    choice.priceCopper,
    5,
  );
  if (
    !acknowledged(draft, result, choice, `availability:${choice.itemId}`) ||
    price === null ||
    baseDays === null
  )
    return;
  const duration =
    baseDays +
    (choice.mode === 'enchantment' ? choice.priceCopper / 100000 : 0);
  const cost = price + (choice.expedited ? 90000 : 0);
  if (!helpers.spend(draft, result, choice, cost)) return;
  if (existing)
    itemChange(result, choice.choiceId, existing, {
      ...existing,
      location: 'enchanting',
    });
  else
    newItem(result, choice.choiceId, {
      itemId: choice.itemId,
      name: choice.name!,
      weight: choice.weight!,
      valueCopper: choice.priceCopper,
      location: 'order',
    });
  const order: EconomyState['orders'][number] = {
    orderId: choice.orderId,
    itemId: choice.itemId,
    source: 'special_order',
    settlementId: choice.settlementId,
    mode: choice.mode,
    orderedWeek: draft.week,
    orderedDay: choice.orderedDay,
    dueDay: choice.orderedDay + duration,
    dueActivityWeek: null,
    priceCopper: cost,
    deliveryDays: duration,
    enchantmentValueCopper:
      choice.mode === 'enchantment' ? choice.priceCopper : 0,
    receipt: null,
  };
  state.orders.push(order);
  result.plan.push({
    kind: 'order',
    choiceId: choice.choiceId,
    order: structuredClone(order),
  });
}
const cacheLimits = {
  minor: { weight: 5, value: 90000, dc: 15, tier: 1 },
  intermediate: { weight: 10, value: 250000, dc: 20, tier: 2 },
  major: { weight: 20, value: Infinity, dc: 30, tier: 3 },
};
function cache(
  draft: WeeklyDraft,
  result: Result,
  choice: Extract<EconomyChoice, { actionId: 'secure_cache' }>,
  tier: number,
  helpers: ActivityHelpers,
) {
  const state = result.outcome.economy!;
  if (!choice.mode || !choice.cacheId) {
    required(result, choice.choiceId, 'cache-target');
    return;
  }
  const old = state.caches.find((x) => x.cacheId === choice.cacheId);
  if (choice.mode === 'retrieve') {
    if (old?.status !== 'hidden') {
      required(result, choice.choiceId, 'hidden-cache');
      return;
    }
    const limits = cacheLimits[old.cacheClass];
    if (
      tier < Math.max(limits.tier, old.secure ? 3 : 0) &&
      !helpers.exception(draft, result, choice, 'cache-tier')
    )
      return;
    const items = old.itemIds.map((id) =>
      state.items.find((x) => x.itemId === id),
    );
    if (items.some((x) => x?.location !== 'cache')) {
      required(result, choice.choiceId, 'cache-items');
      return;
    }
    const total = helpers.check(
      draft,
      result,
      choice,
      'secrecy',
      limits.dc + (old.secure ? 5 : 0),
    );
    if (total === null || total < limits.dc + (old.secure ? 5 : 0)) return;
    const before = structuredClone(old);
    old.status = 'retrieved';
    result.plan.push({
      kind: 'cache',
      choiceId: choice.choiceId,
      before,
      after: structuredClone(old),
    });
    for (const item of items)
      itemChange(result, choice.choiceId, item!, {
        ...item!,
        location: 'held',
      });
    return;
  }
  if (old) {
    required(result, choice.choiceId, 'duplicate-cache');
    return;
  }
  if (
    !choice.cacheClass ||
    !choice.location ||
    choice.secure === undefined ||
    choice.extradimensional === undefined ||
    choice.itemIds === undefined ||
    choice.purchases === undefined
  ) {
    required(result, choice.choiceId, 'cache-contents');
    return;
  }
  const limits = cacheLimits[choice.cacheClass];
  if (
    tier < Math.max(limits.tier, choice.secure ? 3 : 0) &&
    !helpers.exception(draft, result, choice, 'cache-tier')
  )
    return;
  const ids = [...choice.itemIds, ...choice.purchases.map((x) => x.itemId)];
  if (!ids.length || new Set(ids).size !== ids.length) {
    required(result, choice.choiceId, 'cache-items');
    return;
  }
  const owned = choice.itemIds.map((id) =>
    state.items.find((x) => x.itemId === id),
  );
  if (owned.some((x) => x?.location !== 'held')) {
    required(result, choice.choiceId, 'owned-items');
    return;
  }
  if (
    choice.purchases.some(
      (x) =>
        state.items.some((item) => item.itemId === x.itemId) ||
        !x.name ||
        x.weight === undefined,
    )
  ) {
    required(result, choice.choiceId, 'purchased-items');
    return;
  }
  const contents: Item[] = [
    ...(owned as Item[]),
    ...choice.purchases.map((x) => ({
      itemId: x.itemId,
      name: x.name!,
      weight: x.weight!,
      valueCopper: x.priceCopper,
      location: 'held' as const,
    })),
  ];
  const weight = contents.reduce((sum, item) => sum + item.weight, 0);
  const value = contents.reduce((sum, item) => sum + item.valueCopper, 0);
  const overweight =
    weight > limits.weight &&
    !(choice.cacheClass === 'major' && choice.extradimensional);
  if (
    (overweight || value > limits.value) &&
    !helpers.exception(draft, result, choice, 'cache-capacity')
  )
    return;
  let cost = 0;
  for (const purchase of choice.purchases) {
    const price = purchasePrice(
      draft,
      result,
      choice,
      choice.settlementId,
      purchase.priceCopper,
    );
    if (
      price === null ||
      !acknowledged(draft, result, choice, `availability:${purchase.itemId}`)
    )
      return;
    cost += price;
  }
  const total = helpers.check(
    draft,
    result,
    choice,
    'secrecy',
    limits.dc + (choice.secure ? 5 : 0),
  );
  if (total === null || !helpers.spend(draft, result, choice, cost)) return;
  const success = total >= limits.dc + (choice.secure ? 5 : 0);
  const location = success ? 'cache' : 'returning';
  for (const item of contents) {
    const existing = state.items.find((x) => x.itemId === item.itemId);
    if (existing)
      itemChange(result, choice.choiceId, existing, { ...existing, location });
    else newItem(result, choice.choiceId, { ...item, location });
  }
  const placed: EconomyState['caches'][number] = {
    cacheId: choice.cacheId,
    cacheClass: choice.cacheClass,
    location: choice.location,
    secure: choice.secure,
    extradimensional: choice.extradimensional,
    itemIds: ids,
    status: success ? 'hidden' : 'returning',
    returnActivityWeek: success ? null : draft.week + 1,
  };
  state.caches.push(placed);
  result.plan.push({
    kind: 'cache',
    choiceId: choice.choiceId,
    before: null,
    after: structuredClone(placed),
  });
}
export function resolveEconomyChoice(
  draft: WeeklyDraft,
  result: Result,
  choice: Choice,
  helpers: ActivityHelpers,
) {
  if (!(choice.actionId in economyActionTeams)) return false;
  const economyChoice = choice as EconomyChoice;
  const assigned = team(draft, result, economyChoice, helpers);
  if (!assigned) return true;
  if (economyChoice.actionId === 'earn_gold') {
    const total = helpers.check(draft, result, choice);
    helpers.naturalOne(result, choice);
    if (total !== null)
      helpers.income(draft, result, choice, total * assigned.tier * 100);
    return true;
  }
  if (!result.outcome.economy) {
    required(result, choice.choiceId, 'economy-state');
    return true;
  }
  switch (economyChoice.actionId) {
    case 'activate_black_market':
    case 'broker_market':
      market(draft, result, economyChoice, assigned.id, helpers);
      break;
    case 'secure_cache':
      cache(draft, result, economyChoice, assigned.tier, helpers);
      break;
    case 'special_order':
      specialOrder(draft, result, economyChoice, helpers);
      break;
  }
  return true;
}
export function prepareEconomy(draft: WeeklyDraft, result: Result) {
  const state = result.outcome.economy;
  if (!state) return;
  state.markets = state.markets.filter((market) => {
    if (market.expiresWeek >= draft.week) return true;
    result.plan.push({ kind: 'expire_market', marketId: market.marketId });
    return false;
  });
  for (const cache of state.caches) {
    if (
      cache.status !== 'returning' ||
      cache.returnActivityWeek === null ||
      cache.returnActivityWeek > draft.week
    )
      continue;
    const items = cache.itemIds.map((id) =>
      state.items.find((x) => x.itemId === id),
    );
    if (items.some((x) => x?.location !== 'returning')) {
      required(result, cache.cacheId, 'returning-items');
      continue;
    }
    const before = structuredClone(cache);
    cache.status = 'retrieved';
    cache.returnActivityWeek = null;
    result.plan.push({
      kind: 'cache',
      choiceId: cache.cacheId,
      before,
      after: structuredClone(cache),
    });
    for (const item of items)
      itemChange(result, cache.cacheId, item!, { ...item!, location: 'held' });
  }
  for (const order of state.orders) {
    if (
      order.source === 'special_order' ||
      order.receipt ||
      order.dueActivityWeek === null ||
      order.dueActivityWeek > draft.week
    )
      continue;
    receive(result, order, {
      receivedDay: draft.context.startDay,
      acknowledgementId: `activity:${draft.week}:${order.orderId}`,
    });
  }
}
function receive(
  result: Result,
  order: EconomyState['orders'][number],
  receipt: NonNullable<EconomyState['orders'][number]['receipt']>,
) {
  const item = result.outcome.economy!.items.find(
    (x) => x.itemId === order.itemId,
  );
  if (
    item?.location !== (order.mode === 'enchantment' ? 'enchanting' : 'order')
  ) {
    required(result, order.orderId, 'ordered-item');
    return;
  }
  itemChange(result, order.orderId, item, {
    ...item,
    location: 'held',
    valueCopper: item.valueCopper + order.enchantmentValueCopper,
  });
  order.receipt = {
    receivedDay: receipt.receivedDay,
    acknowledgementId: receipt.acknowledgementId,
  };
  result.plan.push({
    kind: 'receive_order',
    orderId: order.orderId,
    receipt: { ...order.receipt },
  });
}
export function receiveEconomyOrders(draft: WeeklyDraft, result: Result) {
  const receipts = [
    ...draft.orderReceipts,
    ...draft.activity.slots.flatMap((slot) =>
      slot.choice?.actionId === 'special_order' &&
      slot.choice.receipt &&
      slot.choice.orderId
        ? [{ orderId: slot.choice.orderId, ...slot.choice.receipt }]
        : [],
    ),
  ];
  for (const receipt of receipts) {
    const order = result.outcome.economy?.orders.find(
      (x) => x.orderId === receipt.orderId,
    );
    if (!order || order.receipt) {
      required(result, receipt.orderId, 'unreceived-order');
      continue;
    }
    if (order.dueDay === null || receipt.receivedDay < order.dueDay) {
      required(result, receipt.orderId, 'delivery-day');
      continue;
    }
    const acknowledgement = [
      ...draft.acknowledgements,
      ...draft.activity.slots.flatMap(
        (slot) => slot.choice?.acknowledgements ?? [],
      ),
    ].find(
      (x) =>
        x.acknowledgementId === receipt.acknowledgementId &&
        x.subjectId === order.orderId &&
        x.outcome.trim(),
    );
    if (!acknowledgement) {
      required(result, receipt.orderId, 'receipt-acknowledgement');
      continue;
    }
    receive(result, order, receipt);
  }
}
