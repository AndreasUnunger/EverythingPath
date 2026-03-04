import { describe, expect, it } from 'vitest';
import {
  lowerReputationWithFloorUnfriendly,
  validateStagedActionsLegality,
} from '@convex/weekBoardRules';

describe('weekBoardRules', () => {
  it('drops settlement reputation by one step with Unfriendly floor', () => {
    expect(lowerReputationWithFloorUnfriendly('Helpful')).toBe('Friendly');
    expect(lowerReputationWithFloorUnfriendly('Friendly')).toBe('Indifferent');
    expect(lowerReputationWithFloorUnfriendly('Indifferent')).toBe('Unfriendly');
    expect(lowerReputationWithFloorUnfriendly('Unfriendly')).toBe('Unfriendly');
    expect(lowerReputationWithFloorUnfriendly('Hostile')).toBe('Hostile');
  });

  it('rejects Lie Low when any other action is staged', () => {
    expect(() =>
      validateStagedActionsLegality({
        stagedActions: ['lie_low', 'earn_gold'],
        activeTeamIds: ['blackMarketeers'],
      }),
    ).toThrow(/Lie Low must be the only staged activity/);
  });

  it('rejects actions when no active capable teams can perform them', () => {
    expect(() =>
      validateStagedActionsLegality({
        stagedActions: ['gather_information'],
        activeTeamIds: ['fixers'],
      }),
    ).toThrow(/no active team can perform this action/);
  });

  it('rejects duplicate action count above capable active team count', () => {
    expect(() =>
      validateStagedActionsLegality({
        stagedActions: ['earn_gold', 'earn_gold', 'earn_gold'],
        activeTeamIds: ['blackMarketeers', 'fixers'],
      }),
    ).toThrow(/Cannot stage earn_gold 3 times with only 2 capable active team\(s\)/);
  });

  it('allows legal staging patterns', () => {
    expect(() =>
      validateStagedActionsLegality({
        stagedActions: ['drill_militia', 'earn_gold', 'gather_information'],
        activeTeamIds: ['blackMarketeers', 'conspirators'],
      }),
    ).not.toThrow();
  });
});
