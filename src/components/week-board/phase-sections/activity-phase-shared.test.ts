import { describe, expect, it } from 'vitest';
import { buildActivityActionEntries } from './activity-phase-shared';

describe('buildActivityActionEntries', () => {
  it('keeps repeatable actions legal after one copy is already staged', () => {
    const entries = buildActivityActionEntries({
      dragState: null,
      assignedActionIds: new Set(['earn_gold']),
      stagedActionIds: ['earn_gold'],
      hasNonLieLowStaged: true,
      hasLieLowStaged: false,
      rank: 2,
      treasury: 100,
      maxTeams: 4,
      teams: [
        {
          teamId: 'merchants',
          status: 'active',
          manager: {
            displayName: 'Quartermaster',
            charismaBonus: 1,
            maxTeams: 1,
            managedTeamCount: 1,
            warnings: [],
          },
        },
      ],
      activeTeamIds: ['merchants'],
    });

    const earnGoldEntry = entries.find((entry) => entry.card.id === 'earn_gold');
    expect(earnGoldEntry?.isLegal).toBe(true);
    expect(earnGoldEntry?.isDisabled).toBe(false);
    expect(earnGoldEntry?.isAssigned).toBe(false);
    expect(earnGoldEntry?.stagedCount).toBe(1);
  });

  it('keeps Drill Militia single-use in the deck', () => {
    const entries = buildActivityActionEntries({
      dragState: null,
      assignedActionIds: new Set(['drill_militia']),
      stagedActionIds: ['drill_militia'],
      hasNonLieLowStaged: true,
      hasLieLowStaged: false,
      rank: 2,
      treasury: 100,
      maxTeams: 4,
      teams: [],
      activeTeamIds: [],
    });

    const drillEntry = entries.find((entry) => entry.card.id === 'drill_militia');
    expect(drillEntry?.isLegal).toBe(false);
    expect(drillEntry?.isDisabled).toBe(true);
    expect(drillEntry?.isAssigned).toBe(true);
    expect(drillEntry?.stagedCount).toBe(1);
  });
});
