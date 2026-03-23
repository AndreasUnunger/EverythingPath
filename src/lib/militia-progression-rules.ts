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

export function getMinimumTrainingForRank(rank: number) {
  return TRAINING_THRESHOLDS[rank];
}

export function getMinimumTreasuryForRank(rank: number) {
  return rank * 10;
}
