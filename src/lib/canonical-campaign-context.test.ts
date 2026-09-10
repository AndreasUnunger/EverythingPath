import { expect, test } from 'vitest';
import {
  campaignContextSchema,
  emptyCampaignContext,
} from './canonical-campaign-context';

test('[context.absence] setup preserves unknown facts separately from explicit zero and false', () => {
  const unknown = emptyCampaignContext();
  expect(campaignContextSchema.parse(unknown)).toEqual(unknown);
  const known = {
    ...unknown,
    startDay: 0,
    firstMilitiaWeek: false,
    uneventfulCarry: false,
    lastBuyoffWeek: 0,
    treasuryCopper: 0,
  };
  expect(campaignContextSchema.parse(known)).toEqual(known);
  expect(
    campaignContextSchema.safeParse({ ...known, treasuryCopper: 0.1 }).success,
  ).toBe(false);
});

test('[context.delivery] Broker Market keeps Activity timing and receipt contradictions are rejected', () => {
  const facts = {
    ...emptyCampaignContext(),
    items: [{ itemId: 'item', name: 'Supplies', valueCopper: 1 }],
    orders: [
      {
        orderId: 'order',
        itemId: 'item',
        settlementId: null,
        orderedDay: null,
        dueDay: null,
        priceCopper: 1,
        receipt: null,
        receiptStatus: 'unreceived' as const,
        source: 'broker_market' as const,
        orderedWeek: 2,
        dueActivityWeek: 3,
        deliveryDays: null,
        expedited: null,
        enchantment: null,
        notes: '',
      },
    ],
  };
  expect(campaignContextSchema.parse(facts)).toEqual(facts);
  expect(
    campaignContextSchema.safeParse({
      ...facts,
      orders: facts.orders.map((order) => ({
        ...order,
        receiptStatus: 'received',
      })),
    }).success,
  ).toBe(false);
  expect(
    campaignContextSchema.safeParse({
      ...facts,
      orders: facts.orders.map((order) => ({
        ...order,
        receipt: { receivedDay: 0, acknowledgementId: 'receipt' },
      })),
    }).success,
  ).toBe(false);
  expect(
    campaignContextSchema.safeParse({
      ...facts,
      orders: [...facts.orders, ...facts.orders],
    }).success,
  ).toBe(false);
});
