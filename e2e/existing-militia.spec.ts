import { test, expect } from './support/fixtures';
import { openCampaignSection, selectCampaign } from './support/interactions';
import { openSetupStep } from './support/setup-workspace';

test.use({ caseKey: 'existingMilitia', comparisonCaseKey: 'isolation' });
test('existing militia state survives reload within its campaign', async ({
  page,
  ownedCase,
  comparisonCase,
}) => {
  await page.goto('/campaigns');
  await selectCampaign(page, ownedCase.campaignName);
  // Without a militia the home offers Set up militia instead of Continue.
  await openCampaignSection(page, 'setup');
  await page
    .getByRole('button', { name: 'Existing militia', exact: true })
    .click();
  for (const [step, fields] of [
    [
      'Starting point',
      [
        ['Rank', '4'],
        ['Training', '24'],
        ['Treasury (copper)', '72500'],
        ['Notoriety', '17'],
      ],
    ],
    [
      'Week',
      [
        ['Current week', '8'],
        ['Week start day', '49'],
      ],
    ],
  ] as const) {
    await openSetupStep(page, step);
    for (const [name, value] of fields)
      await page.getByRole('textbox', { name, exact: true }).fill(value);
  }
  await openSetupStep(page, 'Review & start');
  await page
    .getByRole('button', { name: 'Start militia week', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Week 8 · Upkeep' }),
  ).toBeVisible();
  await page.goto('/campaigns');
  await page.reload();
  await selectCampaign(page, ownedCase.campaignName);
  await openCampaignSection(page, 'week');
  await expect(
    page.getByRole('heading', { name: 'Week 8 · Upkeep' }),
  ).toBeVisible();
  await openCampaignSection(page, 'militia');
  await page
    .getByRole('button', { name: 'Edit militia ledger', exact: true })
    .click();
  await expect(
    page.getByRole('textbox', { name: 'Treasury (copper)', exact: true }),
  ).toHaveValue('72500');
  await expect(
    page.getByRole('textbox', { name: 'Rank', exact: true }),
  ).toHaveValue('4');
  await selectCampaign(page, comparisonCase!.campaignName);
  // Continue week: the comparison's first week skips Upkeep (#189).
  await openCampaignSection(page, 'week');
  await expect(
    page.getByRole('heading', { name: 'Week 1 · Event' }),
  ).toBeVisible();
  await selectCampaign(page, ownedCase.campaignName);
  await openCampaignSection(page, 'week');
  await expect(
    page.getByRole('heading', { name: 'Week 8 · Upkeep' }),
  ).toBeVisible();
});
