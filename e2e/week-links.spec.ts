import {
  exerciseUnknownCampaignAndEntry,
  exerciseWeekLinks,
  openWeekFromList,
} from './support/shell-navigation';
import { test, expect } from './support/fixtures';

// Split from the access journey with its own case, seeded like `smoke`: one
// campaign whose first-militia-week draft opens at Event, alone in the cohort's
// member organization. The GM and player are separate signed-in sessions and
// start where access left them: on Week 1 · Event, opened from the campaign
// list. The GM stays there while the player follows week links, then an
// unknown campaign's address and the app's entry.
test.use({ caseKey: 'weekLinks' });
test('week links open their phase in a bounded week without moving other members, and unknown campaigns stay unavailable', async ({
  players,
  ownedCase,
}) => {
  await test.step('members open the week from the campaign list', () =>
    Promise.all([players.gm, players.player].map(openWeekFromList)));
  await test.step('the player follows week links back to a bounded week', () =>
    exerciseWeekLinks(players.player));
  await test.step('the GM stays on its own phase', () =>
    expect(
      players.gm.getByRole('heading', { name: 'Week 1 · Event' }),
    ).toBeVisible());
  await test.step("the player follows an unknown campaign's address and the app's entry", () =>
    exerciseUnknownCampaignAndEntry(players.player, ownedCase.campaignName));
});
