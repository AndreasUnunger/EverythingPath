const TRAINING_THRESHOLDS: Record<number, number> = {
  1: 0,
  2: 10,
  3: 15,
  4: 20,
  5: 30,
  6: 40,
  7: 55,
  8: 75,
  9: 105,
  10: 160,
  11: 235,
  12: 330,
  13: 475,
  14: 665,
  15: 855,
  16: 1350,
  17: 1900,
  18: 2700,
  19: 3850,
  20: 5350,
};

const FOCUSED_CHECK_BONUSES: Record<number, number> = {
  1: 2,
  2: 3,
  3: 3,
  4: 4,
  5: 4,
  6: 5,
  7: 5,
  8: 6,
  9: 6,
  10: 7,
  11: 7,
  12: 8,
  13: 8,
  14: 9,
  15: 9,
  16: 10,
  17: 10,
  18: 11,
  19: 11,
  20: 12,
};

const SECONDARY_CHECK_BONUSES: Record<number, number> = {
  1: 0,
  2: 0,
  3: 1,
  4: 1,
  5: 1,
  6: 2,
  7: 2,
  8: 2,
  9: 3,
  10: 3,
  11: 3,
  12: 4,
  13: 4,
  14: 4,
  15: 5,
  16: 5,
  17: 5,
  18: 6,
  19: 6,
  20: 6,
};

export type MilitiaFocusCheck = 'Loyalty' | 'Secrecy' | 'Security';

export function getMinimumTrainingForRank(rank: number) {
  return TRAINING_THRESHOLDS[rank];
}

export function getFocusedCheckBonusForRank(rank: number) {
  return FOCUSED_CHECK_BONUSES[rank];
}

export function getSecondaryCheckBonusForRank(rank: number) {
  return SECONDARY_CHECK_BONUSES[rank];
}

export function getOrganizationCheckBonusesForMilitia({
  rank,
  focus,
}: {
  rank: number;
  focus: MilitiaFocusCheck | null | undefined;
}) {
  const focusedBonus = getFocusedCheckBonusForRank(rank);
  const secondaryBonus = getSecondaryCheckBonusForRank(rank);

  if (focusedBonus === undefined || secondaryBonus === undefined) {
    return {
      loyalty: 0,
      secrecy: 0,
      security: 0,
    };
  }

  return {
    loyalty: focus === 'Loyalty' ? focusedBonus : secondaryBonus,
    secrecy: focus === 'Secrecy' ? focusedBonus : secondaryBonus,
    security: focus === 'Security' ? focusedBonus : secondaryBonus,
  };
}

export function getMinimumTreasuryForRank(rank: number) {
  return rank * 10;
}

export function getMilitiaNotoriety(notoriety?: number) {
  return notoriety ?? 0;
}

export function getTreasuryShortageReferenceBalance({
  currentTreasury,
  upkeepTreasurySnapshot,
}: {
  currentTreasury: number;
  upkeepTreasurySnapshot?: number;
}) {
  return upkeepTreasurySnapshot ?? currentTreasury;
}

export function shouldApplyTreasuryShortagePenalty({
  rank,
  currentTreasury,
  upkeepTreasurySnapshot,
}: {
  rank: number;
  currentTreasury: number;
  upkeepTreasurySnapshot?: number;
}) {
  return (
    getTreasuryShortageReferenceBalance({
      currentTreasury,
      upkeepTreasurySnapshot,
    }) < getMinimumTreasuryForRank(rank)
  );
}

export function getMaxActionsForRank(rank: number) {
  if (rank >= 19) return 6;
  if (rank >= 15) return 5;
  if (rank >= 11) return 4;
  if (rank >= 7) return 3;
  if (rank >= 1) return 2;
  return 1;
}

export function getMaxActionsForMilitia({
  rank,
  strategistAssigned,
}: {
  rank: number;
  strategistAssigned: boolean;
}) {
  return getMaxActionsForRank(rank) + (strategistAssigned ? 1 : 0);
}
