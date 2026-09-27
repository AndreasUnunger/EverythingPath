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
  const correctValues = page.getByRole('button', {
    name: 'Correct values',
    exact: true,
  });
  const treasury = page.getByRole('textbox', {
    name: 'Treasury (copper)',
    exact: true,
  });
  await correctValues.click();
  await expect(treasury).toHaveValue('72500');
  await expect(
    page.getByRole('textbox', { name: 'Rank', exact: true }),
  ).toHaveValue('4');
  // Values are corrected on their own, with a reason, keeping every other
  // imported fact.
  await treasury.fill('80000');
  await page
    .getByRole('textbox', { name: 'Reason for correction', exact: true })
    .fill('Sold a captured wand');
  await page
    .getByRole('button', { name: 'Save correction', exact: true })
    .click();
  await expect(page.getByText('Values corrected.').first()).toBeVisible();
  await expect(page.getByText('800 gp (80,000 cp)')).toBeVisible();
  await correctValues.click();
  for (const [name, value] of [
    ['Treasury (copper)', '80000'],
    ['Rank', '4'],
    ['Training', '24'],
    ['Notoriety', '17'],
  ])
    await expect(
      page.getByRole('textbox', { name: name!, exact: true }),
    ).toHaveValue(value!);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
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
