import { z } from 'zod';
import {
  REPUTATION_LEVELS,
  MILITIA_ACTIVITY_ACTION_IDS,
} from './militia-domain';
import {
  identitySchema as id,
  integerSchema as int,
  persistentEventSchema,
  orderSchema,
  queuedEffectSchema,
} from './weekly-draft-facts';

const text = z.string().trim().min(1, 'A value is required').max(500);
export const contextSettlementSchema = z
  .strictObject({
    settlementId: id,
    name: text,
    reputation: z.enum(REPUTATION_LEVELS).nullable(),
    secured: z.boolean().nullable(),
    occupied: z.boolean().nullable(),
    temporaryReputationShift: z.number().int().nullable(),
    reduceDangerReputationShift: z.number().int().optional(),
    reduceDangerUntilWeek: int.optional(),
    refugeActivatedWeek: int.nullable(),
    refugeActiveUntilWeek: int.nullable(),
  })
  .superRefine((settlement, ctx) => {
    if (
      (settlement.reduceDangerReputationShift === undefined) !==
      (settlement.reduceDangerUntilWeek === undefined)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['reduceDangerUntilWeek'],
        message:
          'A Reduce Danger benefit requires both its shift and expiry week',
      });
  });
export const contextEventSchema = persistentEventSchema.extend({
  startedWeek: int.nullable(),
  order: int.nullable(),
  targets: persistentEventSchema.shape.targets.nullable(),
  persistent: z.boolean(),
  resolved: z.boolean(),
  mitigationUntilWeek: int.nullable(),
  endedWeek: int.nullable(),
  notes: z.string().max(500),
});
export const contextOrderSchema = orderSchema.extend({
  settlementId: id.nullable(),
  orderedDay: int.nullable(),
  dueDay: z.number().nonnegative().nullable(),
  priceCopper: int.nullable(),
  source: z
    .enum(['special_order', 'broker_market', 'activate_black_market'])
    .nullable(),
  orderedWeek: int.nullable(),
  dueActivityWeek: int.nullable(),
  deliveryDays: int.nullable(),
  expedited: z.boolean().nullable(),
  enchantment: z
    .strictObject({ costCopper: int, days: z.number().nonnegative() })
    .nullable(),
  // Unknown legacy delivery is distinct from an explicit unreceived order.
  receiptStatus: z.enum(['unknown', 'unreceived', 'received']),
  notes: z.string().max(500),
});
export const contextBonusSchema = z.strictObject({
  bonusId: id,
  source: text,
  check: z.enum(['loyalty', 'security', 'secrecy', 'event_chance']),
  value: z.number().int(),
  availableWeek: int.nullable(),
  consumedWeek: int.nullable(),
});
export const contextCacheSchema = z.strictObject({
  cacheId: id,
  label: text,
  location: text,
  contents: z.string().max(1000),
  cacheClass: z.enum(['minor', 'intermediate', 'major']),
  status: z.enum(['hidden', 'retrieved', 'lost']),
  secure: z.boolean().nullable(),
});
// Additive preparation document. Unknown legacy facts remain null until preflight
// resolves them. Bounds protect Convex's document size, not militia rule limits.
export const campaignContextDataSchema = z.strictObject({
  operatingSettlementId: id.nullable(),
  treasuryCopper: z.number().int().nullable(),
  firstMilitiaWeek: z.boolean().nullable(),
  startDay: int.nullable(),
  uneventfulCarry: z.boolean().nullable(),
  lastBuyoffWeek: int.nullable(),
  settlements: z.array(contextSettlementSchema).max(128),
  events: z.array(contextEventSchema).max(128),
  orders: z.array(contextOrderSchema).max(128),
  bonuses: z.array(contextBonusSchema).max(128),
  queuedEffects: z.array(queuedEffectSchema).max(128),
  items: z
    .array(
      z.strictObject({ itemId: id, name: text, valueCopper: int.nullable() }),
    )
    .max(128),
  caches: z.array(contextCacheSchema).max(128),
});
export const campaignContextSchema = campaignContextDataSchema.superRefine(
  (facts, ctx) => {
    function issue(path: (string | number)[], message: string) {
      ctx.addIssue({ code: 'custom', path, message });
    }
    function unique(values: string[], path: string) {
      if (new Set(values).size !== values.length)
        issue([path], 'Each entry must have a unique identity');
    }
    unique(
      facts.settlements.map((x) => x.settlementId),
      'settlements',
    );
    unique(
      facts.events.map((x) => x.eventId),
      'events',
    );
    unique(
      facts.orders.map((x) => x.orderId),
      'orders',
    );
    unique(
      facts.bonuses.map((x) => x.bonusId),
      'bonuses',
    );
    unique(
      facts.queuedEffects.map((x) => x.effectId),
      'queuedEffects',
    );
    unique(
      facts.items.map((x) => x.itemId),
      'items',
    );
    unique(
      facts.caches.map((x) => x.cacheId),
      'caches',
    );
    facts.queuedEffects.forEach(({ effect }, i) => {
      if (
        effect.kind === 'block_action' &&
        !MILITIA_ACTIVITY_ACTION_IDS.some(
          (action) => action === effect.actionId,
        )
      )
        issue(
          ['queuedEffects', i, 'effect', 'actionId'],
          'Choose a militia action',
        );
    });
    const settlements = new Set(facts.settlements.map((x) => x.settlementId));
    if (
      facts.operatingSettlementId !== null &&
      !settlements.has(facts.operatingSettlementId)
    )
      issue(['operatingSettlementId'], 'Choose a settlement in this militia');
    const items = new Set(facts.items.map((x) => x.itemId));
    facts.orders.forEach((order, i) => {
      if (!items.has(order.itemId))
        issue(['orders', i, 'itemId'], 'Choose an item in this militia');
      if (order.settlementId !== null && !settlements.has(order.settlementId))
        issue(
          ['orders', i, 'settlementId'],
          'Choose a settlement in this militia',
        );
      if ((order.receiptStatus === 'received') !== (order.receipt !== null))
        issue(
          ['orders', i, 'receiptStatus'],
          'Received orders require a receipt; other orders cannot have one',
        );
    });
    const references = {
      settlement: settlements,
      item: items,
      cache: new Set(facts.caches.map((x) => x.cacheId)),
      event: new Set(facts.events.map((x) => x.eventId)),
    };
    facts.events.forEach((event, i) =>
      event.targets?.forEach((target, j) => {
        if (target.kind === 'team' || target.kind === 'character') return; // Checked against campaign-owned roster in persistence.
        const value =
          target.kind === 'settlement'
            ? target.settlementId
            : target.kind === 'item'
              ? target.itemId
              : target.kind === 'cache'
                ? target.cacheId
                : target.eventId;
        if (!references[target.kind].has(value))
          issue(['events', i, 'targets', j], 'Choose a target in this militia');
      }),
    );
  },
);
export type CampaignContext = z.infer<typeof campaignContextSchema>;
export function emptyCampaignContext(): CampaignContext {
  return {
    operatingSettlementId: null,
    treasuryCopper: null,
    firstMilitiaWeek: null,
    startDay: null,
    uneventfulCarry: null,
    lastBuyoffWeek: null,
    settlements: [],
    events: [],
    orders: [],
    bonuses: [],
    queuedEffects: [],
    items: [],
    caches: [],
  };
}
export function campaignContextWarnings(facts: CampaignContext) {
  const warnings: string[] = [];
  if (
    [facts.firstMilitiaWeek, facts.startDay, facts.uneventfulCarry].some(
      (x) => x === null,
    )
  )
    warnings.push('Complete the week-start facts before preparing a week.');
  if (facts.operatingSettlementId === null)
    warnings.push(
      'Choose the operating settlement before resolving settlement effects.',
    );
  if (
    facts.events.some(
      (x) => x.startedWeek === null || x.order === null || x.targets === null,
    )
  )
    warnings.push(
      'Resolve unknown event age, order and targets before preparing a week.',
    );
  if (
    facts.orders.some(
      (x) =>
        x.receiptStatus === 'unknown' ||
        x.source === null ||
        (x.source === 'special_order'
          ? x.dueDay === null
          : x.dueActivityWeek === null),
    )
  )
    warnings.push(
      'Complete order delivery and receipt facts before resolving delivery.',
    );
  if (
    facts.orders.some(
      (x) =>
        x.dueDay !== null && x.orderedDay !== null && x.dueDay < x.orderedDay,
    )
  )
    warnings.push(
      'An order is due before it was placed. Check the dates or record the table ruling in its notes.',
    );
  if (facts.treasuryCopper !== null && facts.treasuryCopper < 0)
    warnings.push('Treasury is below zero.');
  return warnings;
}
