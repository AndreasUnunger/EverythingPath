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
  await openCampaignSection(page, 'week');
  await page.getByRole('link', { name: 'Set up militia', exact: true }).click();
  await expect(page).toHaveURL(/\/campaigns\/[^/]+\/setup$/);
  const setupUrl = page.url();
  await page
    .getByRole('button', { name: 'Existing militia', exact: true })
    .click();
  for (const [step, fields] of [
    [
      'Starting point',
      [
        ['Rank', 'four'],
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
  // A character created inline is shared at once but joins the roster only
  // when chosen.
  await openSetupStep(page, 'People & officers');
  await page
    .getByRole('button', { name: 'Add character', exact: true })
    .click();
  const dialog = page.getByRole('dialog', {
    name: 'New Character',
    exact: true,
  });
  await dialog
    .getByRole('textbox', { name: 'Name', exact: true })
    .fill('Setup Recruit');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole('button', { name: 'Add Setup Recruit', exact: true }),
  ).toBeVisible();
  // Reloading resumes the unfinished setup, invalid input included.
  await page.reload();
  await expect(
    page.getByRole('heading', {
      level: 2,
      name: 'People & officers',
      exact: true,
    }),
  ).toBeVisible();
  await openSetupStep(page, 'Starting point');
  await expect(
    page.getByRole('button', { name: 'Existing militia', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  const rank = page.getByRole('textbox', { name: 'Rank', exact: true });
  await expect(rank).toHaveValue('four');
  await expect(
    page.getByText('Enter a valid whole number for Rank.'),
  ).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Treasury (copper)', exact: true }),
  ).toHaveValue('72500');
  await rank.fill('4');
  await openSetupStep(page, 'Review & start');
  await page
    .getByRole('button', { name: 'Start militia week', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Week 8 · Upkeep' }),
  ).toBeVisible();
  // A later visit to Setup stays on the started page until a link is chosen.
  await page.goto(setupUrl);
  await expect(page.getByText('This militia is already set up.')).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Rank', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Open militia', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Open week 8', exact: true }).click();
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
  await openCampaignSection(page, 'week');
  await expect(
    page.getByRole('heading', { name: 'Week 1 · Upkeep' }),
  ).toBeVisible();
  await selectCampaign(page, ownedCase.campaignName);
  await openCampaignSection(page, 'week');
  await expect(
    page.getByRole('heading', { name: 'Week 8 · Upkeep' }),
  ).toBeVisible();
});
