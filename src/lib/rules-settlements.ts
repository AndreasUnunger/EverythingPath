import type { CampaignContext } from './canonical-campaign-context';
import { REPUTATION_LEVELS } from './militia-domain';

export type FoundationPurchase = {
  purchaseId: string;
  settlementId: string;
  priceCopper: number;
  marketDay?: boolean;
};
const reputationEffects = {
  Hostile: {
    socialDcModifier: 5,
    pricePercent: 5,
    eventChanceModifier: 0,
    sightingDays: [1, 4],
  },
  Unfriendly: {
    socialDcModifier: 2,
    pricePercent: 0,
    eventChanceModifier: 5,
    sightingDays: null,
  },
  Indifferent: {
    socialDcModifier: 0,
    pricePercent: 0,
    eventChanceModifier: 0,
    sightingDays: null,
  },
  Friendly: {
    socialDcModifier: -2,
    pricePercent: 0,
    eventChanceModifier: -5,
    sightingDays: null,
  },
  Helpful: {
    socialDcModifier: 0,
    pricePercent: -5,
    eventChanceModifier: 0,
    sightingDays: null,
  },
};
export function projectSettlements(
  settlements: CampaignContext['settlements'],
  week: number,
) {
  const requirements: string[] = [];
  const facts = settlements.map((settlement) => {
    if (
      settlement.reputation === null ||
      settlement.temporaryReputationShift === null ||
      (settlement.reduceDangerReputationShift === undefined) !==
        (settlement.reduceDangerUntilWeek === undefined)
    ) {
      requirements.push(`settlement:${settlement.settlementId}:reputation`);
      return {
        ...settlement,
        reputation: null,
        socialDcModifier: null,
        pricePercent: null,
        eventChanceModifier: null,
        sightingDays: null,
      };
    }
    const shiftedIndex = Math.max(
      0,
      Math.min(
        4,
        REPUTATION_LEVELS.indexOf(settlement.reputation) +
          settlement.temporaryReputationShift +
          (settlement.reduceDangerUntilWeek !== undefined &&
          settlement.reduceDangerUntilWeek >= week
            ? (settlement.reduceDangerReputationShift ?? 0)
            : 0),
      ),
    );
    let reputation = REPUTATION_LEVELS[shiftedIndex]!;
    const refuge =
      settlement.refugeActivatedWeek !== null &&
      settlement.refugeActiveUntilWeek !== null &&
      settlement.refugeActivatedWeek <= week &&
      week <= settlement.refugeActiveUntilWeek;
    if (refuge && (reputation === 'Hostile' || reputation === 'Unfriendly'))
      reputation = REPUTATION_LEVELS[shiftedIndex + 1]!;
    return { ...settlement, reputation, ...reputationEffects[reputation] };
  });
  return { settlements: facts, requirements };
}
export function getPurchaseCostCopper(
  priceCopper: number,
  reputationPercent: number,
  marketDay: boolean,
  discountPercent = 0,
) {
  return Math.round(
    (priceCopper *
      (100 + reputationPercent) *
      (marketDay ? 95 : 100) *
      (100 - discountPercent)) /
      1000000,
  );
}
export function projectPurchases(
  purchases: FoundationPurchase[],
  settlements: ReturnType<typeof projectSettlements>['settlements'],
) {
  return purchases.map((purchase) => {
    const settlement = settlements.find(
      (x) => x.settlementId === purchase.settlementId,
    );
    const percent = settlement?.pricePercent;
    // Compound discounts before rounding once to the nearest copper.
    const costCopper =
      percent === null || percent === undefined
        ? null
        : getPurchaseCostCopper(
            purchase.priceCopper,
            percent,
            purchase.marketDay ?? false,
          );
    return { ...purchase, costCopper };
  });
}
