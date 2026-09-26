import { expect, type Page } from '@playwright/test';
import { openCampaignSection } from './interactions';
import { saveStatus } from './week-frame';

// Build real same-document history through the shell, so a native
// beforeunload warning cannot accidentally satisfy the departure contract.
export async function prepareWeekHistory(page: Page) {
  await openCampaignSection(page, 'characters');
  await expect(
    page.getByRole('region', { name: 'Character Ledger', exact: true }),
  ).toBeVisible();
  const charactersUrl = page.url();
  await openCampaignSection(page, 'week');
  return charactersUrl;
}

export async function stayOnPendingWeek(
  page: Page,
  direction: 'back' | 'forward',
  feedback: 'Saving changes…' | 'Confirming the week…',
) {
  const weekUrl = page.url();
  if (direction === 'back') await page.goBack();
  else await page.goForward();
  const warning = page.getByRole('dialog', {
    name: 'Changes are still saving',
    exact: true,
  });
  await expect(warning).toBeVisible();
  await warning.getByRole('button', { name: 'Stay', exact: true }).click();
  await expect(warning).toBeHidden();
  await expect(page).toHaveURL(weekUrl);
  await expect(saveStatus(page)).toHaveText(feedback);
  await expect(page.getByRole('heading', { name: /^Week \d+ · / })).toHaveCount(
    1,
  );
}

export async function leavePendingWeek(
  page: Page,
  direction: 'back' | 'forward',
  charactersUrl: string,
) {
  if (direction === 'back') await page.goBack();
  else await page.goForward();
  const warning = page.getByRole('dialog', {
    name: 'Changes are still saving',
    exact: true,
  });
  await expect(warning).toBeVisible();
  await warning
    .getByRole('button', { name: 'Leave anyway', exact: true })
    .click();
  await expect(warning).toBeHidden();
  await expect(page).toHaveURL(charactersUrl);
  await expect(
    page.getByRole('region', { name: 'Character Ledger', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Week \d+ · / })).toHaveCount(
    0,
  );
}
