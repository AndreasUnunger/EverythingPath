import {
  exerciseSectionNavigation,
  openWeekFromList,
} from './support/shell-navigation';
import { test } from './support/fixtures';

// Split from the access journey with its own case, seeded like `smoke`: one
// campaign with a rank-1 militia and one officer, alone in the cohort's member
// organization. The player starts where access left it: on Week 1 · Event,
// opened from the campaign list.
test.use({ caseKey: 'campaignSections' });
test('members move between campaign sections at every width and through browser history', async ({
  players,
}) => {
  await openWeekFromList(players.player);
  await exerciseSectionNavigation(players.player);
});
