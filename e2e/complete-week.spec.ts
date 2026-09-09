import type { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import {
  actionSlot,
  selectCampaign,
  visiblePlace,
} from './support/interactions';

test.use({ caseKey: 'completeWeek' });

async function expectCommittedWeek(page: Page) {
  await expect(
    page.getByRole('heading', { name: 'Week 3', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('textbox', {
      name: 'Training attrition total',
      exact: true,
    }),
  ).toHaveValue('');
  await page
    .getByRole('button', { name: 'Continue to Activity', exact: true })
    .click();
  await expect(actionSlot(page, 1)).not.toContainText('Drill Militia');

  await page.getByRole('tab', { name: 'LEDGER', exact: true }).click();
  const militia = page.getByRole('region', {
    name: 'Militia State',
    exact: true,
  });
  await expect(militia).toBeVisible();
  const open = militia.getByRole('button', { name: 'Open', exact: true });
  if (await open.count()) await open.click();
  const core = page.getByRole('region', { name: 'Militia Core', exact: true });
  for (const [label, value] of [
    ['Training', '12'],
    ['Treasury', '90'],
    ['Notoriety', '0'],
  ] as const) {
    await expect(
      core.getByRole('textbox', { name: label, exact: true }),
    ).toHaveValue(value);
  }
  const week = page.getByRole('region', { name: 'Week Context', exact: true });
  await expect(
    week.getByRole('textbox', { name: 'Week number', exact: true }),
  ).toHaveValue('3');
  await expect(
    week.getByRole('combobox', { name: 'Current phase', exact: true }),
  ).toHaveText('Upkeep');
  await expect(
    week.getByRole('textbox', { name: 'Uneventful bonus carry', exact: true }),
  ).toHaveValue('1');
}

test('a player confirms a complete week and reloads its outcome', async ({
  players,
  hasTouch,
  ownedCase,
}) => {
  const page = players.player;
  await page.goto('/campaigns');
  await selectCampaign(page, ownedCase.campaignName);
  await expect(
    page.getByRole('heading', { name: 'Week 2', exact: true }),
  ).toBeVisible();

  await page
    .getByRole('textbox', { name: 'Training attrition total', exact: true })
    .fill('2');
  await page
    .getByRole('button', { name: 'Continue to Activity', exact: true })
    .click();
  await visiblePlace(page, 'Drill Militia', 1, hasTouch ? 'tap' : 'keyboard');
  await page
    .getByRole('textbox', { name: 'check total', exact: true })
    .fill('15');
  await page
    .getByRole('textbox', { name: 'training gain total', exact: true })
    .fill('4');
  await page
    .getByRole('button', { name: 'Continue to Event', exact: true })
    .click();
  await expect(
    page.getByRole('textbox', { name: 'Event chance total', exact: true }),
  ).toHaveValue('10');
  await page
    .getByRole('textbox', { name: 'Event trigger roll total', exact: true })
    .fill('100');
  await expect(
    page.getByText('No event this week; skip Table 6-3 roll.', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Continue to Summary', exact: true })
    .click();

  // Review the saved draft through the production preview before its normal
  // Confirm Week action submits the reviewed revision. Stale revision rejection
  // and atomicity are covered by the mutation harness, not browser internals.
  for (const text of [
    'Resolution Preview',
    'Attrition total: 2',
    'Slot 1: Drill Militia',
    'Drill Militia check total: 15',
    'Drill Militia training gain total: 4',
    'Next uneventful bonus: 1',
    'Events: None',
    'Event chance total: 10',
    'Trigger roll total: 100',
  ]) {
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }
  await expect(
    page.getByText('Militia: training 12, treasury 90, notoriety 0', {
      exact: true,
    }),
  ).toHaveCount(2);
  await page.getByRole('button', { name: 'Confirm Week', exact: true }).click();
  await expectCommittedWeek(page);

  await page.reload();
  await selectCampaign(page, ownedCase.campaignName);
  await expectCommittedWeek(page);
});
