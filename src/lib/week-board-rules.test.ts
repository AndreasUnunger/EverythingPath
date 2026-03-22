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

  it('warns when no active capable teams can perform staged action', () => {
    const warnings = validateStagedActionsLegality({
      stagedActions: ['gather_information'],
      activeTeamIds: ['fixers'],
    });
    expect(warnings).toContainEqual(
      expect.objectContaining({
        code: 'action_requires_missing_team',
      }),
    );
  });

  it('warns on duplicate action count above capable active team count', () => {
    const warnings = validateStagedActionsLegality({
      stagedActions: ['earn_gold', 'earn_gold', 'earn_gold'],
      activeTeamIds: ['blackMarketeers', 'fixers'],
    });
    expect(warnings).toContainEqual(
      expect.objectContaining({
        code: 'action_capable_team_count_exceeded',
      }),
    );
  });

  it('allows legal staging patterns', () => {
    expect(
      validateStagedActionsLegality({
        stagedActions: ['drill_militia', 'earn_gold', 'gather_information'],
        activeTeamIds: ['blackMarketeers', 'conspirators'],
      }),
    ).toEqual([]);
  });
});
