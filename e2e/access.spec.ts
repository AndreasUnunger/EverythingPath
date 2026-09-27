import { openCampaignSection } from './support/interactions';
import { exerciseCampaignHome } from './support/campaign-home';
import { exerciseShellNavigation } from './support/shell-navigation';
import { loadRun } from './support/process';
import { navigationAndPersistence } from './support/nightly-flows';
import { test, expect } from './support/fixtures';

test.use({ caseKey: 'smoke' });
test('organization members can open their campaign and outsiders cannot', async ({
  players,
  ownedCase,
}, info) => {
  // Members land on the list and home; outsiders see an empty organization.
  await exerciseCampaignHome(
    players.player,
    players.gm,
    players.outsider,
    ownedCase.campaignName,
  );
  await Promise.all(
    [players.gm, players.player].map(async (page) => {
      await openCampaignSection(page, 'week');
      await expect(
        page.getByRole('heading', { name: 'Week 1 · Upkeep' }),
      ).toBeVisible();
    }),
  );
  await exerciseShellNavigation(
    players.player,
    players.outsider,
    ownedCase.campaignName,
  );
  await expect(
    players.gm.getByRole('heading', { name: 'Week 1 · Upkeep' }),
  ).toBeVisible();
  if (
    (await loadRun()).mode === 'nightly' &&
    ['chromium-tablet', 'chromium-phone'].includes(info.project.name)
  )
    await navigationAndPersistence(players.player, ownedCase.campaignName);
  if (process.env.E2E_FORCE_FAILURE === 'true' && info.retry === 0)
    throw new Error(
      'E2E forced failure: verify sanitized evidence and red diagnostic retry',
    );
});
