import { loadRun } from './support/process';
import { navigationAndPersistence } from './support/nightly-flows';
import { test, expect } from './support/fixtures';

test.use({ caseKey: 'smoke' });
test('organization members can open their campaign and outsiders cannot', async ({
  players,
  ownedCase,
}, info) => {
  for (const page of [players.gm, players.player]) {
    await page.goto('/campaigns');
    await expect(
      page.getByRole('combobox', { name: 'Active campaign' }),
    ).toContainText(ownedCase.campaignName);
    await expect(
      page.getByRole('heading', { name: 'Week 1 · Upkeep' }),
    ).toBeVisible();
  }
  await players.outsider.goto('/campaigns');
  await expect(
    players.outsider.getByText('Create a campaign to get started.'),
  ).toBeVisible();
  await expect(
    players.outsider.getByText(ownedCase.campaignName, { exact: true }),
  ).toHaveCount(0);
  await expect(
    players.outsider.getByRole('heading', { name: 'Week 1 · Upkeep' }),
  ).toHaveCount(0);
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
