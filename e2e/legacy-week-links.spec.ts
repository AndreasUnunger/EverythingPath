import {
  exerciseLegacyWeekLinks,
  openWeekFromList,
} from './support/shell-navigation';
import { test, expect } from './support/fixtures';

// Split from the access journey with its own case, seeded like `smoke`: one
// campaign whose first-militia-week draft opens at Event, alone in the cohort's
// member organization. The GM and player are separate signed-in sessions and
// start where access left them: on Week 1 · Event, opened from the campaign
// list. The GM stays there while the player follows the legacy week links.
test.use({ caseKey: 'legacyWeekLinks' });
test('legacy week links open their phase in a bounded week without moving other members', async ({
  players,
}) => {
  await Promise.all([players.gm, players.player].map(openWeekFromList));
  await exerciseLegacyWeekLinks(players.player);
  await expect(
    players.gm.getByRole('heading', { name: 'Week 1 · Event' }),
  ).toBeVisible();
});
