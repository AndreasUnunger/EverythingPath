import { exerciseCampaignHome } from './support/campaign-home';
import { test } from './support/fixtures';

// Split from the access journey (#187) with its own case, seeded like
// `smoke`: one campaign with a rank-1 militia and one officer, alone in the
// cohort's member organization. The GM, player and outsider are separate
// signed-in sessions, as in access.
test.use({ caseKey: 'campaignHome' });
test('members choose and edit their campaign home and outsiders never see it', async ({
  players,
  ownedCase,
}) => {
  // Members land on the list and home; outsiders see an empty organization.
  await exerciseCampaignHome(
    players.player,
    players.gm,
    players.outsider,
    ownedCase.campaignName,
  );
});
