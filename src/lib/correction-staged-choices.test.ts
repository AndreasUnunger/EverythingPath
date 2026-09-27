import { expect, test } from 'vitest';
import { upkeepFixture } from '../../tests/rules/upkeep-fixture';
import type { UpkeepSnapshot } from './rules-upkeep';
import { correctionStagedChoices } from './correction-staged-choices';

function withScouts(snapshot: UpkeepSnapshot): UpkeepSnapshot {
  return {
    ...snapshot,
    roster: {
      ...snapshot.roster,
      teams: [
        {
          teamId: 'scouts',
          teamType: 'patrons',
          name: 'Scouts',
          status: 'disabled',
          managerCharacterId: null,
          rewardCapExempt: false,
          notes: '',
        },
      ],
    },
  };
}

test('removing a team with a staged Upkeep decision names the affected phase', () => {
  const { draft, snapshot } = upkeepFixture();
  const current = withScouts(snapshot);
  draft.upkeep.teamDecisions = [
    { teamId: 'scouts', decision: 'recover', costCopper: 3000 },
  ];
  const edited = { ...current, roster: { ...current.roster, teams: [] } };
  expect(correctionStagedChoices(draft, current, edited)).toEqual([
    { phase: 'upkeep', count: 1 },
  ]);
  // Keeping the team affects nothing.
  expect(correctionStagedChoices(draft, current, current)).toEqual([]);
});

test('references that were already broken before the correction are not blamed on it', () => {
  const { draft, snapshot } = upkeepFixture();
  draft.upkeep.teamDecisions = [{ teamId: 'gone', decision: 'leave' }];
  expect(correctionStagedChoices(draft, snapshot, snapshot)).toEqual([]);
});

test('an Activity choice aimed at the removed team is attributed to Activity', () => {
  const { draft, snapshot } = upkeepFixture();
  const current = withScouts(snapshot);
  draft.activity.slots[0]!.choice = {
    choiceId: 'dismiss',
    actionId: 'dismiss_team',
    targetTeamId: 'scouts',
    rolls: {},
  };
  draft.upkeep.teamDecisions = [{ teamId: 'scouts', decision: 'leave' }];
  const edited = { ...current, roster: { ...current.roster, teams: [] } };
  expect(correctionStagedChoices(draft, current, edited)).toEqual([
    { phase: 'upkeep', count: 1 },
    { phase: 'activity', count: 1 },
  ]);
});
