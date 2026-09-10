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
    eventTableModifier: 0,
    sightingDays: [1, 4],
  },
  Unfriendly: {
    socialDcModifier: 2,
    pricePercent: 0,
    eventTableModifier: 5,
    sightingDays: null,
  },
  Indifferent: {
    socialDcModifier: 0,
    pricePercent: 0,
    eventTableModifier: 0,
    sightingDays: null,
  },
  Friendly: {
    socialDcModifier: -2,
    pricePercent: 0,
    eventTableModifier: -5,
    sightingDays: null,
  },
  Helpful: {
    socialDcModifier: 0,
    pricePercent: -5,
    eventTableModifier: 0,
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
      settlement.temporaryReputationShift === null
    ) {
      requirements.push(`settlement:${settlement.settlementId}:reputation`);
      return {
        ...settlement,
        reputation: null,
        socialDcModifier: null,
        pricePercent: null,
        eventTableModifier: null,
        sightingDays: null,
      };
    }
    const shiftedIndex = Math.max(
      0,
      Math.min(
        4,
        REPUTATION_LEVELS.indexOf(settlement.reputation) +
          settlement.temporaryReputationShift,
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
        : Math.round(
            (purchase.priceCopper *
              (100 + percent) *
              (100 - (purchase.marketDay ? 5 : 0))) /
              10000,
          );
    return { ...purchase, costCopper };
  });
}
