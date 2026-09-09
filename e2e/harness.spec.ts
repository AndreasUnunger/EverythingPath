import { test, expect } from './support/fixtures';

test('synthetic campaign is visible to both declared members', async ({
  players,
  ownedCase,
}) => {
  for (const page of [players.gm, players.player]) {
    await page.goto('/campaigns');
    await expect(
      page.getByRole('combobox', { name: 'Active campaign' }),
    ).toContainText(ownedCase.campaignName);
    await expect(
      page.getByRole('tab', { name: 'ADVANCE MILITIA' }),
    ).toBeVisible();
  }
  expect(await ownedCase.inspect()).toMatchObject({
    campaignCount: 1,
    identityCount: 3,
    militia: { treasury: 100, week: 1 },
  });
});
