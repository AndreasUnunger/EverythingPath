import { test, expect } from './support/fixtures';

test.use({ caseKey: 'smoke' });

test('organization members can open their campaign and outsiders cannot', async ({
  players,
  ownedCase,
}, info) => {
  for (const page of [players.gm, players.player]) {
    await page.goto('/campaigns');
    const selector = page.getByRole('combobox', { name: 'Active campaign' });
    await expect(selector).toContainText(ownedCase.campaignName);
    await selector.click();
    await page
      .getByRole('option', { name: ownedCase.campaignName, exact: true })
      .click();
    await expect(selector).toContainText(ownedCase.campaignName);
    await expect(
      page.getByRole('heading', { name: 'Week 1', exact: true }),
    ).toBeVisible();
    await page.getByRole('tab', { name: 'LEDGER', exact: true }).click();
    await expect(
      page.getByText('E2E harness-officer', { exact: true }).first(),
    ).toBeVisible();
    await page
      .getByRole('tab', { name: 'ADVANCE MILITIA', exact: true })
      .click();
  }

  await players.outsider.goto('/campaigns');
  await expect(
    players.outsider.getByText('No campaigns in this organization', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    players.outsider.getByRole('combobox', { name: 'Active campaign' }),
  ).toHaveCount(0);
  await expect(
    players.outsider.getByText(ownedCase.campaignName, { exact: true }),
  ).toHaveCount(0);
  await expect(
    players.outsider.getByRole('heading', { name: 'Week 1', exact: true }),
  ).toHaveCount(0);
  await expect(
    players.outsider.getByRole('tab', { name: 'LEDGER', exact: true }),
  ).toHaveCount(0);

  // Explicit evidence drill: the retry executes the same real journey and passes,
  // but the reporter and required gate must still reject the overall run.
  if (process.env.E2E_FORCE_FAILURE === 'true' && info.retry === 0)
    throw new Error(
      'E2E forced failure: verify sanitized evidence and red diagnostic retry',
    );
});
