import { openCampaignSection } from './support/interactions';
import { exerciseShellNavigation } from './support/shell-navigation';
import { loadRun } from './support/process';
import { navigationAndPersistence } from './support/nightly-flows';
import { test, expect } from './support/fixtures';

test.use({ caseKey: 'smoke' });
test('organization members can open their campaign and outsiders cannot', async ({
  players,
  ownedCase,
}, info) => {
  // Members open their campaign from the list. The list and home themselves
  // (landing, selection, header edits, outsider view) are the campaign-home
  // journey.
  await Promise.all(
    [players.gm, players.player].map(async (page) => {
      await page.goto('/campaigns');
      // Continue week opens the first unready phase: the first week skips
      // Upkeep and Activity has nothing required, so Event (#189).
      await openCampaignSection(page, 'week');
      await expect(
        page.getByRole('heading', { name: 'Week 1 · Event' }),
      ).toBeVisible();
    }),
  );
  await exerciseShellNavigation(
    players.player,
    players.outsider,
    ownedCase.campaignName,
  );
  await expect(
    players.gm.getByRole('heading', { name: 'Week 1 · Event' }),
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
