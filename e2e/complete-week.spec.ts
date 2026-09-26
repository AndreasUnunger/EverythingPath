import { openCampaignSection } from './support/interactions';
import { test, expect } from './support/fixtures';
import { saveStatus } from './support/week-frame';

test.use({ caseKey: 'completeWeek' });
test('a player confirms a complete week and reloads its outcome', async ({
  page,
}) => {
  await page.goto('/campaigns');
  await openCampaignSection(page, 'week');
  await expect(
    page.getByRole('heading', { name: 'Week 1 · Upkeep' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Event', exact: true }).click();
  const roll = page.getByRole('textbox', {
    name: 'Event chance roll',
    exact: true,
  });
  await roll.fill('100');
  await roll.blur();
  await expect(saveStatus(page)).toHaveText('Changes saved.');
  await page
    .getByRole('button', { name: 'Review & confirm', exact: true })
    .click();
  await page.getByRole('button', { name: 'Confirm week', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Week 2 · Upkeep' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Week 2 · Upkeep' }),
  ).toBeVisible();
  await openCampaignSection(page, 'history');
  await expect(page.getByRole('heading', { name: /Week 1/ })).toBeVisible();
});
