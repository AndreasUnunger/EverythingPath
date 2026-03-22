export type UpkeepRollTotals = {
  attritionTotal?: number;
  notorietyPenaltyTotal?: number;
  maxNotorietyLoyaltyCheckTotal?: number;
  nearestSettlementKey?: string;
  treasuryPenaltyTotal?: number;
};

export type EventRollTotals = {
  eventChanceTotal?: number;
  eventTriggerRollTotal?: number;
  eventPercentileTotal?: number;
  rollTwiceFirstTotal?: number;
  rollTwiceSecondTotal?: number;
  guaranteedFirstPercentileTotal?: number;
  guaranteedSecondPercentileTotal?: number;
  guaranteedChosen?: 'first' | 'second';
  sabotageCheckTotal?: number;
  sabotageNotorietyIncreaseTotal?: number;
};

export type ActivityRollTotals = {
  activateBlackMarketCheckTotal?: number;
  activateBlackMarketNotorietyIncreaseTotal?: number;
  dismissTeamCheckTotal?: number;
  dismissTeamNotorietyIncreaseTotal?: number;
  drillMilitiaCheckTotal?: number;
  drillMilitiaTrainingGainTotal?: number;
  earnGoldCheckTotal?: number;
  earnGoldTotal?: number;
  earnGoldNotorietyIncreaseTotal?: number;
  gatherInformationCheckTotal?: number;
  gatherInformationNotorietyIncreaseTotal?: number;
  knowledgeCheckTotal?: number;
  recruitTeamCheckTotal?: number;
  recruitTeamNotorietyIncreaseTotal?: number;
  reduceDangerCheckTotal?: number;
  reduceDangerNotorietyIncreaseTotal?: number;
  rescueCharacterCheckTotal?: number;
  rescueCharacterTargetLevelTotal?: number;
  rescueCharacterNotorietyIncreaseTotal?: number;
  restoreCharacterCostTotal?: number;
  secureCacheCheckTotal?: number;
  specialActionCostTotal?: number;
  specialOrderItemCostTotal?: number;
  spreadPropagandaCheckTotal?: number;
  specialOrderDeliveryDaysTotal?: number;
};

export function readUpkeepRollTotals(
  value: UpkeepRollTotals | Record<string, never> | undefined,
) {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return {
    attritionTotal:
      'attritionTotal' in value && typeof value.attritionTotal === 'number'
        ? value.attritionTotal
        : undefined,
    notorietyPenaltyTotal:
      'notorietyPenaltyTotal' in value &&
      typeof value.notorietyPenaltyTotal === 'number'
        ? value.notorietyPenaltyTotal
        : undefined,
    maxNotorietyLoyaltyCheckTotal:
      'maxNotorietyLoyaltyCheckTotal' in value &&
      typeof value.maxNotorietyLoyaltyCheckTotal === 'number'
        ? value.maxNotorietyLoyaltyCheckTotal
        : undefined,
    nearestSettlementKey:
      'nearestSettlementKey' in value &&
      typeof value.nearestSettlementKey === 'string'
        ? value.nearestSettlementKey
        : undefined,
    treasuryPenaltyTotal:
      'treasuryPenaltyTotal' in value &&
      typeof value.treasuryPenaltyTotal === 'number'
        ? value.treasuryPenaltyTotal
        : undefined,
  };
}

export function readEventRollTotals(
  value: EventRollTotals | Record<string, never> | undefined,
) {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return {
    eventChanceTotal:
      'eventChanceTotal' in value && typeof value.eventChanceTotal === 'number'
        ? value.eventChanceTotal
        : undefined,
    eventTriggerRollTotal:
      'eventTriggerRollTotal' in value &&
      typeof value.eventTriggerRollTotal === 'number'
        ? value.eventTriggerRollTotal
        : undefined,
    eventPercentileTotal:
      'eventPercentileTotal' in value &&
      typeof value.eventPercentileTotal === 'number'
        ? value.eventPercentileTotal
        : undefined,
    rollTwiceFirstTotal:
      'rollTwiceFirstTotal' in value &&
      typeof value.rollTwiceFirstTotal === 'number'
        ? value.rollTwiceFirstTotal
        : undefined,
    rollTwiceSecondTotal:
      'rollTwiceSecondTotal' in value &&
      typeof value.rollTwiceSecondTotal === 'number'
        ? value.rollTwiceSecondTotal
        : undefined,
    guaranteedFirstPercentileTotal:
      'guaranteedFirstPercentileTotal' in value &&
      typeof value.guaranteedFirstPercentileTotal === 'number'
        ? value.guaranteedFirstPercentileTotal
        : undefined,
    guaranteedSecondPercentileTotal:
      'guaranteedSecondPercentileTotal' in value &&
      typeof value.guaranteedSecondPercentileTotal === 'number'
        ? value.guaranteedSecondPercentileTotal
        : undefined,
    guaranteedChosen:
      'guaranteedChosen' in value &&
      (value.guaranteedChosen === 'first' || value.guaranteedChosen === 'second')
        ? value.guaranteedChosen
        : undefined,
    sabotageCheckTotal:
      'sabotageCheckTotal' in value &&
      typeof value.sabotageCheckTotal === 'number'
        ? value.sabotageCheckTotal
        : undefined,
    sabotageNotorietyIncreaseTotal:
      'sabotageNotorietyIncreaseTotal' in value &&
      typeof value.sabotageNotorietyIncreaseTotal === 'number'
        ? value.sabotageNotorietyIncreaseTotal
        : undefined,
  };
}

export function readActivityRollTotals(
  value: ActivityRollTotals | Record<string, never> | undefined,
) {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return {
    activateBlackMarketCheckTotal:
      'activateBlackMarketCheckTotal' in value &&
      typeof value.activateBlackMarketCheckTotal === 'number'
        ? value.activateBlackMarketCheckTotal
        : undefined,
    activateBlackMarketNotorietyIncreaseTotal:
      'activateBlackMarketNotorietyIncreaseTotal' in value &&
      typeof value.activateBlackMarketNotorietyIncreaseTotal === 'number'
        ? value.activateBlackMarketNotorietyIncreaseTotal
        : undefined,
    dismissTeamCheckTotal:
      'dismissTeamCheckTotal' in value &&
      typeof value.dismissTeamCheckTotal === 'number'
        ? value.dismissTeamCheckTotal
        : undefined,
    dismissTeamNotorietyIncreaseTotal:
      'dismissTeamNotorietyIncreaseTotal' in value &&
      typeof value.dismissTeamNotorietyIncreaseTotal === 'number'
        ? value.dismissTeamNotorietyIncreaseTotal
        : undefined,
    drillMilitiaCheckTotal:
      'drillMilitiaCheckTotal' in value &&
      typeof value.drillMilitiaCheckTotal === 'number'
        ? value.drillMilitiaCheckTotal
        : undefined,
    drillMilitiaTrainingGainTotal:
      'drillMilitiaTrainingGainTotal' in value &&
      typeof value.drillMilitiaTrainingGainTotal === 'number'
        ? value.drillMilitiaTrainingGainTotal
        : undefined,
    earnGoldCheckTotal:
      'earnGoldCheckTotal' in value && typeof value.earnGoldCheckTotal === 'number'
        ? value.earnGoldCheckTotal
        : undefined,
    earnGoldTotal:
      'earnGoldTotal' in value && typeof value.earnGoldTotal === 'number'
        ? value.earnGoldTotal
        : undefined,
    earnGoldNotorietyIncreaseTotal:
      'earnGoldNotorietyIncreaseTotal' in value &&
      typeof value.earnGoldNotorietyIncreaseTotal === 'number'
        ? value.earnGoldNotorietyIncreaseTotal
        : undefined,
    gatherInformationCheckTotal:
      'gatherInformationCheckTotal' in value &&
      typeof value.gatherInformationCheckTotal === 'number'
        ? value.gatherInformationCheckTotal
        : undefined,
    gatherInformationNotorietyIncreaseTotal:
      'gatherInformationNotorietyIncreaseTotal' in value &&
      typeof value.gatherInformationNotorietyIncreaseTotal === 'number'
        ? value.gatherInformationNotorietyIncreaseTotal
        : undefined,
    knowledgeCheckTotal:
      'knowledgeCheckTotal' in value &&
      typeof value.knowledgeCheckTotal === 'number'
        ? value.knowledgeCheckTotal
        : undefined,
    recruitTeamCheckTotal:
      'recruitTeamCheckTotal' in value &&
      typeof value.recruitTeamCheckTotal === 'number'
        ? value.recruitTeamCheckTotal
        : undefined,
    recruitTeamNotorietyIncreaseTotal:
      'recruitTeamNotorietyIncreaseTotal' in value &&
      typeof value.recruitTeamNotorietyIncreaseTotal === 'number'
        ? value.recruitTeamNotorietyIncreaseTotal
        : undefined,
    reduceDangerCheckTotal:
      'reduceDangerCheckTotal' in value &&
      typeof value.reduceDangerCheckTotal === 'number'
        ? value.reduceDangerCheckTotal
        : undefined,
    reduceDangerNotorietyIncreaseTotal:
      'reduceDangerNotorietyIncreaseTotal' in value &&
      typeof value.reduceDangerNotorietyIncreaseTotal === 'number'
        ? value.reduceDangerNotorietyIncreaseTotal
        : undefined,
    rescueCharacterCheckTotal:
      'rescueCharacterCheckTotal' in value &&
      typeof value.rescueCharacterCheckTotal === 'number'
        ? value.rescueCharacterCheckTotal
        : undefined,
    rescueCharacterTargetLevelTotal:
      'rescueCharacterTargetLevelTotal' in value &&
      typeof value.rescueCharacterTargetLevelTotal === 'number'
        ? value.rescueCharacterTargetLevelTotal
        : undefined,
    rescueCharacterNotorietyIncreaseTotal:
      'rescueCharacterNotorietyIncreaseTotal' in value &&
      typeof value.rescueCharacterNotorietyIncreaseTotal === 'number'
        ? value.rescueCharacterNotorietyIncreaseTotal
        : undefined,
    restoreCharacterCostTotal:
      'restoreCharacterCostTotal' in value &&
      typeof value.restoreCharacterCostTotal === 'number'
        ? value.restoreCharacterCostTotal
        : undefined,
    secureCacheCheckTotal:
      'secureCacheCheckTotal' in value &&
      typeof value.secureCacheCheckTotal === 'number'
        ? value.secureCacheCheckTotal
        : undefined,
    specialActionCostTotal:
      'specialActionCostTotal' in value &&
      typeof value.specialActionCostTotal === 'number'
        ? value.specialActionCostTotal
        : undefined,
    specialOrderItemCostTotal:
      'specialOrderItemCostTotal' in value &&
      typeof value.specialOrderItemCostTotal === 'number'
        ? value.specialOrderItemCostTotal
        : undefined,
    spreadPropagandaCheckTotal:
      'spreadPropagandaCheckTotal' in value &&
      typeof value.spreadPropagandaCheckTotal === 'number'
        ? value.spreadPropagandaCheckTotal
        : undefined,
    specialOrderDeliveryDaysTotal:
      'specialOrderDeliveryDaysTotal' in value &&
      typeof value.specialOrderDeliveryDaysTotal === 'number'
        ? value.specialOrderDeliveryDaysTotal
        : undefined,
  };
}
