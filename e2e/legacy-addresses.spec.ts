import {
  exerciseLegacyAddresses,
  openWeekFromList,
} from './support/shell-navigation';
import { test } from './support/fixtures';

// Split from the access journey with its own case, seeded like `smoke`: one
// campaign with a rank-1 militia and one officer, alone in the cohort's member
// organization, so the bare list selects it. The player starts where access
// left it: on Week 1 · Event, opened from the campaign list.
test.use({ caseKey: 'legacyAddresses' });
test('unknown campaigns stay unavailable and legacy addresses lead members to their campaign', async ({
  players,
  ownedCase,
}) => {
  await test.step('the player opens the week from the campaign list', () =>
    openWeekFromList(players.player));
  await test.step('the player follows unknown and legacy addresses', () =>
    exerciseLegacyAddresses(players.player, ownedCase.campaignName));
});
