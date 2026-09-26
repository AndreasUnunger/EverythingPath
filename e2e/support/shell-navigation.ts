import { expect, type Page } from '@playwright/test';
import { openCampaignSection } from './interactions';
import {
  exercisePhoneShell,
  exerciseTopBarShell,
  expectBoundedWeekHost,
  expectDocumentScrolledPage,
  expectNoHorizontalOverflow,
  expectReachable,
} from './responsive-shell';

export async function exerciseShellNavigation(
  page: Page,
  outsider: Page,
  campaignName: string,
) {
  const week = new URL(page.url());
  const campaignPath = week.pathname.replace(/\/week$/, '');
  const campaignId = campaignPath.split('/').at(-1)!;

  await openCampaignSection(page, 'characters');
  await expect(
    page.getByRole('region', { name: 'Character Ledger', exact: true }),
  ).toBeVisible();
  // Phone portrait, a short phone-landscape viewport below the 768px
  // breakpoint, and a short viewport at tablet width with the top-bar
  // layout; then back to this project's size.
  const original = page.viewportSize()!;
  try {
    for (const size of [
      { width: 390, height: 844 },
      { width: 740, height: 360 },
    ]) {
      await page.setViewportSize(size);
      await exercisePhoneShell(page);
    }
    await page.setViewportSize({ width: 844, height: 390 });
    await exerciseTopBarShell(page);
  } finally {
    await page.setViewportSize(original);
  }
  await expectNoHorizontalOverflow(page);
  await openCampaignSection(page, 'militia');
  await expect(
    page.getByRole('button', { name: 'Edit militia ledger', exact: true }),
  ).toBeVisible();
  // Non-week sections scroll as a normal document at every width.
  await expectDocumentScrolledPage(page);
  await expectReachable(
    page,
    page.getByRole('button', { name: 'Edit militia ledger', exact: true }),
  );
  await page.goBack();
  await expect(page).toHaveURL(`${week.origin}${campaignPath}/characters`);
  await page.goForward();
  await expect(page).toHaveURL(`${week.origin}${campaignPath}/militia`);
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Edit militia ledger', exact: true }),
  ).toBeVisible();

  for (const section of ['week', 'history', 'militia', 'characters', 'setup']) {
    await outsider.goto(`${campaignPath}/${section}`);
    await expect(
      outsider.getByText("This campaign isn't available", { exact: false }),
    ).toBeVisible();
    await expect(outsider.getByRole('heading', { name: /Week 1/ })).toHaveCount(
      0,
    );
    await expect(
      outsider.getByRole('region', { name: 'Character Ledger', exact: true }),
    ).toHaveCount(0);
    await expect(outsider.getByText(campaignName, { exact: true })).toHaveCount(
      0,
    );
  }

  await page.goto('/campaigns/not-a-campaign/week');
  await expect(
    page.getByText("This campaign isn't available", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Week 1 · Upkeep' }),
  ).toHaveCount(0);
  await expect(page).toHaveURL(/\/campaigns\/not-a-campaign\/week/);

  for (const legacy of [
    'canonical-workspace',
    'canonical-setup',
    'canonical-history',
  ]) {
    await page.goto(`/${legacy}`);
    await expect(page).toHaveURL(`${week.origin}/campaigns`);
    await expect(
      page.getByRole('combobox', { name: 'Active campaign' }),
    ).toContainText(campaignName);
  }
  await page.goto('/');
  await expect(page).toHaveURL(`${week.origin}/campaigns`);

  await page.goto(`${campaignPath}/militia/correct`);
  await expect(page).toHaveURL(`${week.origin}${campaignPath}/militia`);
  await expect(
    page.getByRole('button', { name: 'Edit militia ledger', exact: true }),
  ).toBeVisible();
  await page.goto(`/canonical-setup?campaign=${campaignId}`);
  await expect(page).toHaveURL(`${week.origin}${campaignPath}/setup`);
  await expect(
    page.getByRole('link', { name: /Open (current week|week 1)/ }),
  ).toBeVisible();
  await page.goto(`/canonical-history?campaign=${campaignId}`);
  await expect(page).toHaveURL(`${week.origin}${campaignPath}/history`);

  for (const phase of ['upkeep', 'activity', 'event', 'summary', 'invalid']) {
    await page.goto(
      `/canonical-workspace?campaign=${campaignId}&phase=${phase}`,
    );
    await expect(page).toHaveURL(new RegExp(`${campaignPath}/week(?:\\?|$)`));
    const title =
      phase === 'invalid'
        ? 'Upkeep'
        : phase === 'summary'
          ? 'Review & confirm'
          : `${phase[0]!.toUpperCase()}${phase.slice(1)}`;
    await expect(
      page.getByRole('heading', { name: `Week 1 · ${title}`, exact: true }),
    ).toBeVisible();
  }
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Week 1 · Upkeep', exact: true }),
  ).toBeVisible();
  await page.goto(campaignPath);
  await expect(page).toHaveURL(`${week.origin}${campaignPath}`);
  await expect(
    page.getByRole('heading', { name: 'Week 1 · Upkeep' }),
  ).toHaveCount(0);
  await openCampaignSection(page, 'week');
  await expect(
    page.getByRole('heading', { name: 'Week 1 · Upkeep', exact: true }),
  ).toBeVisible();
  // The week host is bounded after a non-week visit at every width, with
  // its editor scrolling inside and the frame chrome pinned.
  await expectBoundedWeekHost(page);
}
