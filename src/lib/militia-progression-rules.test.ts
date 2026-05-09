import { describe, expect, it } from 'vitest';
import {
  getTreasuryShortageReferenceBalance,
  shouldApplyTreasuryShortagePenalty,
} from '~/lib/militia-progression-rules';

describe('treasury shortage rules', () => {
  it('uses the upkeep-start treasury snapshot when present', () => {
    expect(
      getTreasuryShortageReferenceBalance({
        currentTreasury: 55,
        upkeepTreasurySnapshot: 35,
      }),
    ).toBe(35);
  });

  it('still applies the current week shortage penalty after a later deposit', () => {
    expect(
      shouldApplyTreasuryShortagePenalty({
        rank: 4,
        currentTreasury: 55,
        upkeepTreasurySnapshot: 35,
      }),
    ).toBe(true);
  });

  it('does not create the current week shortage penalty from a later withdrawal', () => {
    expect(
      shouldApplyTreasuryShortagePenalty({
        rank: 4,
        currentTreasury: 35,
        upkeepTreasurySnapshot: 55,
      }),
    ).toBe(false);
  });

  it('falls back to the live treasury when no upkeep snapshot exists', () => {
    expect(
      shouldApplyTreasuryShortagePenalty({
        rank: 4,
        currentTreasury: 35,
      }),
    ).toBe(true);
  });
});
