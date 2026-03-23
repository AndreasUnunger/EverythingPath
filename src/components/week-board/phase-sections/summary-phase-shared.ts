'use client';

import { ACTION_CARDS } from '~/components/week-board/data';
import { getEventOverseerSupportLabel } from '~/components/week-board/officer-effects';
import type { ActivityAssetOperationsDraft } from '~/components/week-board/activity-asset-operations';
import type { ActionId } from '~/components/week-board/types';

type FormatManualTotal = (raw: string) => string;

export function hasManualTotal(raw: string) {
  return raw.trim().length > 0;
}

export function buildUpkeepSummaryItems({
  upkeepAttritionTotal,
  showMaxNotorietyPenalty,
  upkeepNotorietyPenaltyTotal,
  maxNotorietyLoyaltyCheckTotal,
  nearestSettlementKey,
  showTreasuryShortagePenalty,
  upkeepTreasuryPenaltyTotal,
  formatManualTotalForSummary,
}: {
  upkeepAttritionTotal: string;
  showMaxNotorietyPenalty: boolean;
  upkeepNotorietyPenaltyTotal: string;
  maxNotorietyLoyaltyCheckTotal: string;
  nearestSettlementKey: string;
  showTreasuryShortagePenalty: boolean;
  upkeepTreasuryPenaltyTotal: string;
  formatManualTotalForSummary: FormatManualTotal;
}) {
  const items: string[] = [];
  if (hasManualTotal(upkeepAttritionTotal)) {
    items.push(
      `Attrition total: ${formatManualTotalForSummary(upkeepAttritionTotal)}`,
    );
  }
  if (showMaxNotorietyPenalty && hasManualTotal(upkeepNotorietyPenaltyTotal)) {
    items.push(
      `Max-notoriety penalty total: ${formatManualTotalForSummary(upkeepNotorietyPenaltyTotal)}`,
    );
  }
  if (showMaxNotorietyPenalty && hasManualTotal(maxNotorietyLoyaltyCheckTotal)) {
    items.push(
      `Max-notoriety loyalty check total: ${formatManualTotalForSummary(maxNotorietyLoyaltyCheckTotal)}`,
    );
  }
  if (showMaxNotorietyPenalty && nearestSettlementKey.trim()) {
    items.push(`Nearest settlement: ${nearestSettlementKey.trim()}`);
  }
  if (showTreasuryShortagePenalty && hasManualTotal(upkeepTreasuryPenaltyTotal)) {
    items.push(
      `Treasury-shortage penalty total: ${formatManualTotalForSummary(upkeepTreasuryPenaltyTotal)}`,
    );
  }
  return items;
}

export function buildStagedSlotItems({
  slots,
  slotTeams,
}: {
  slots: Array<ActionId | null>;
  slotTeams: Array<string | null>;
}) {
  return slots
    .map((slotActionId, index) => {
      if (!slotActionId) return null;
      const action = ACTION_CARDS.find((card) => card.id === slotActionId);
      if (!action) return null;
      return `Slot ${index + 1}: ${action.title}${slotTeams[index] ? ` (${slotTeams[index]})` : ''}`;
    })
    .filter((item): item is string => item !== null);
}

export function buildOperationSummaryItems({
  slots,
  activityTeamOperations,
  activityOfficerOperations,
  activityAssetOperations,
}: {
  slots: Array<ActionId | null>;
  activityTeamOperations: {
    recruits: Array<{ slotIndex: number; teamId: string }>;
    dismissals: Array<{ slotIndex: number; teamId: string }>;
    upgrades: Array<{ slotIndex: number; fromTeamId: string; toTeamId: string }>;
  };
  activityOfficerOperations: {
    changes: Array<{
      slotIndex: number;
      role:
        | 'ambassador'
        | 'commandant'
        | 'marshal'
        | 'overseer'
        | 'spymaster'
        | 'strategist';
      characterId?: string;
    }>;
  };
  activityAssetOperations: ActivityAssetOperationsDraft;
}) {
  const teamItems = [
    ...activityTeamOperations.recruits.map(
      (entry) => `Recruit (slot ${entry.slotIndex + 1}): ${entry.teamId}`,
    ),
    ...activityTeamOperations.dismissals.map(
      (entry) => `Dismiss (slot ${entry.slotIndex + 1}): ${entry.teamId}`,
    ),
    ...activityTeamOperations.upgrades.map(
      (entry) =>
        `Upgrade (slot ${entry.slotIndex + 1}): ${entry.fromTeamId} -> ${entry.toTeamId}`,
    ),
  ];
  const officerItems = activityOfficerOperations.changes.map((entry) => {
    const roleLabel = entry.role.charAt(0).toUpperCase() + entry.role.slice(1);
    return `Change officer role (slot ${entry.slotIndex + 1}): ${roleLabel} -> ${entry.characterId ?? 'Unassign'}`;
  });
  const assetItems = [
    ...activityAssetOperations.refuges.map(
      (entry) =>
        `Activate refuge (slot ${entry.slotIndex + 1}): ${entry.settlementKey}`,
    ),
    ...activityAssetOperations.caches.flatMap((entry) => {
      if (entry.mode === 'retrieve' && entry.cacheId) {
        return [
          `Retrieve cache (slot ${entry.slotIndex + 1}): ${entry.cacheId}${entry.checkTotal ? `, check ${entry.checkTotal}` : ''}`,
        ];
      }
      if (
        entry.mode === 'place' &&
        entry.label &&
        entry.cacheClass &&
        entry.location &&
        entry.contentsSummary
      ) {
        return [
          `Place cache (slot ${entry.slotIndex + 1}): ${entry.label} [${entry.cacheClass}] at ${entry.location}${entry.isSecureLocation ? ', secure' : ''}${entry.checkTotal ? `, check ${entry.checkTotal}` : ''}`,
        ];
      }
      return [];
    }),
    ...activityAssetOperations.orders.flatMap((entry) => {
      if (!entry.description || !entry.costPaid || !entry.deliveryDays) {
        return [];
      }
      return [
        `Special order (slot ${entry.slotIndex + 1}): ${entry.description}, ${entry.costPaid} gp, ${entry.deliveryDays} day(s)`,
      ];
    }),
    ...activityAssetOperations.marketplaces.flatMap((entry) => {
      const slotActionId = slots[entry.slotIndex];
      if (
        slotActionId !== 'broker_market' &&
        slotActionId !== 'activate_black_market'
      ) {
        return [];
      }
      const actionTitle =
        ACTION_CARDS.find((card) => card.id === slotActionId)?.title ??
        'Marketplace action';
      const details = [
        entry.label?.trim(),
        entry.purchaseSummary?.trim()
          ? `purchases: ${entry.purchaseSummary.trim()}`
          : undefined,
        entry.notes?.trim(),
      ].filter((value): value is string => Boolean(value));
      if (details.length === 0) {
        return [];
      }
      return [`${actionTitle} (slot ${entry.slotIndex + 1}): ${details.join(' • ')}`];
    }),
    ...activityAssetOperations.covertActions.flatMap((entry) => {
      if (entry.mode === 'augment_action') {
        return [`Covert Action (slot ${entry.slotIndex + 1}): augment next staged action`];
      }
      if (entry.mode === 'place_contact' && entry.siteName) {
        return [
          `Covert Action (slot ${entry.slotIndex + 1}): place contact${entry.displayName ? ` ${entry.displayName}` : ''} at ${entry.siteName}`,
        ];
      }
      return [];
    }),
    ...activityAssetOperations.rescues.flatMap((entry) => {
      const target =
        entry.targetStatusId ??
        entry.characterId ??
        entry.displayName;
      if (!target) {
        return [];
      }
      return [
        `Rescue target (slot ${entry.slotIndex + 1}): ${target}${entry.targetLevel ? `, level ${entry.targetLevel}` : ''}${entry.destinationType ? `, to ${entry.destinationType}${entry.destinationSettlementKey ? ` (${entry.destinationSettlementKey})` : ''}` : ''}`,
      ];
    }),
    ...activityAssetOperations.restorations.flatMap((entry) => {
      const target =
        entry.targetStatusId ??
        entry.characterId ??
        entry.displayName;
      if (!target && !entry.mode) {
        return [];
      }
      return [
        `Restore target (slot ${entry.slotIndex + 1}): ${target ?? 'Party-wide effect'}${entry.mode ? `, ${entry.mode.replaceAll('_', ' ')}` : ''}${entry.customCostTotal ? `, ${entry.customCostTotal} gp` : ''}`,
      ];
    }),
  ];
  return [...teamItems, ...officerItems, ...assetItems];
}

export function buildEventOccurrenceItems({
  eventChanceTotal,
  eventTriggerRollTotal,
  hasGuaranteedEventAction,
  guaranteedEventFirstPercentileTotal,
  guaranteedEventSecondPercentileTotal,
  guaranteedEventChoice,
  sabotageCheckTotal,
  sabotageNotorietyIncreaseTotal,
  cacheDiscoveredMitigationTotal,
  theftMitigationTotal,
  sicknessTwiceLoyaltyTotal,
  turncoatOfficerCheckTotal,
  turncoatSelectedTeamId,
  missingInActionSelectedTeamId,
  sicknessSelectedTeamId,
  turnAroundBoostTeamId,
  marketDayMarketplaceLabel,
  marketDayTownName,
  marketDayAppliesToAllTrackedMarketplaces,
  rivalrySelectedTeamIds,
  overseerEventSupportTarget,
  formatManualTotalForSummary,
}: {
  eventChanceTotal: string;
  eventTriggerRollTotal: string;
  hasGuaranteedEventAction: boolean;
  guaranteedEventFirstPercentileTotal: string;
  guaranteedEventSecondPercentileTotal: string;
  guaranteedEventChoice: 'first' | 'second' | '';
  sabotageCheckTotal: string;
  sabotageNotorietyIncreaseTotal: string;
  cacheDiscoveredMitigationTotal: string;
  theftMitigationTotal: string;
  sicknessTwiceLoyaltyTotal: string;
  turncoatOfficerCheckTotal: string;
  turncoatSelectedTeamId: string;
  missingInActionSelectedTeamId: string;
  sicknessSelectedTeamId: string;
  turnAroundBoostTeamId: string;
  marketDayMarketplaceLabel: string;
  marketDayTownName: string;
  marketDayAppliesToAllTrackedMarketplaces: boolean;
  rivalrySelectedTeamIds: string[];
  overseerEventSupportTarget: '' | 'sabotage' | 'cache_discovered' | 'theft' | 'sickness_twice';
  formatManualTotalForSummary: FormatManualTotal;
}) {
  const items: string[] = [];
  if (hasManualTotal(eventChanceTotal)) {
    items.push(
      `Event chance total: ${formatManualTotalForSummary(eventChanceTotal)}`,
    );
  }
  if (hasManualTotal(eventTriggerRollTotal)) {
    items.push(
      `Trigger roll total: ${formatManualTotalForSummary(eventTriggerRollTotal)}`,
    );
  }
  if (hasGuaranteedEventAction && hasManualTotal(guaranteedEventFirstPercentileTotal)) {
    items.push(
      `Guaranteed roll 1: ${formatManualTotalForSummary(guaranteedEventFirstPercentileTotal)}`,
    );
  }
  if (hasGuaranteedEventAction && hasManualTotal(guaranteedEventSecondPercentileTotal)) {
    items.push(
      `Guaranteed roll 2: ${formatManualTotalForSummary(guaranteedEventSecondPercentileTotal)}`,
    );
  }
  if (hasGuaranteedEventAction && guaranteedEventChoice) {
    items.push(`Guaranteed selection: ${guaranteedEventChoice}`);
  }
  if (hasManualTotal(sabotageCheckTotal)) {
    items.push(
      `Sabotage check total: ${formatManualTotalForSummary(sabotageCheckTotal)}`,
    );
  }
  if (hasManualTotal(sabotageNotorietyIncreaseTotal)) {
    items.push(
      `Sabotage notoriety increase: ${formatManualTotalForSummary(sabotageNotorietyIncreaseTotal)}`,
    );
  }
  if (hasManualTotal(cacheDiscoveredMitigationTotal)) {
    items.push(
      `Cache mitigation total: ${formatManualTotalForSummary(cacheDiscoveredMitigationTotal)}`,
    );
  }
  if (hasManualTotal(theftMitigationTotal)) {
    items.push(
      `Theft mitigation total: ${formatManualTotalForSummary(theftMitigationTotal)}`,
    );
  }
  if (hasManualTotal(sicknessTwiceLoyaltyTotal)) {
    items.push(
      `Sickness Twice loyalty total: ${formatManualTotalForSummary(sicknessTwiceLoyaltyTotal)}`,
    );
  }
  if (hasManualTotal(turncoatOfficerCheckTotal)) {
    items.push(
      `Turncoat officer check total: ${formatManualTotalForSummary(turncoatOfficerCheckTotal)}`,
    );
  }
  if (missingInActionSelectedTeamId) {
    items.push(`Missing in Action team: ${missingInActionSelectedTeamId}`);
  }
  if (sicknessSelectedTeamId) {
    items.push(`Sickness team: ${sicknessSelectedTeamId}`);
  }
  if (turncoatSelectedTeamId) {
    items.push(`Turncoat team: ${turncoatSelectedTeamId}`);
  }
  if (turnAroundBoostTeamId) {
    items.push(`Turn Around boost team: ${turnAroundBoostTeamId}`);
  }
  if (marketDayAppliesToAllTrackedMarketplaces) {
    items.push('Market Day discount: all tracked marketplaces');
  } else if (marketDayMarketplaceLabel) {
    items.push(`Market Day marketplace: ${marketDayMarketplaceLabel}`);
  }
  if (marketDayTownName.trim()) {
    items.push(`Market Day town: ${marketDayTownName.trim()}`);
  }
  if (rivalrySelectedTeamIds.length > 0) {
    items.push(`Rivalry teams: ${rivalrySelectedTeamIds.join(', ')}`);
  }
  if (overseerEventSupportTarget) {
    items.push(
      `Overseer support: ${getEventOverseerSupportLabel(overseerEventSupportTarget)}`,
    );
  }
  return items;
}
