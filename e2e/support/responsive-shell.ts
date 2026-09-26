import { expect, type Locator, type Page } from '@playwright/test';

// Geometry and reachability checks for the campaign shell (#150). Viewport
// resizing here is layout evidence only: headless browsers open no OS
// keyboard and report zero safe-area insets, so keyboard and notch behavior
// need a real device.

export async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
    'no horizontal page overflow',
  ).toBe(true);
}

// The phone bar is the visible sections navigation that carries More.
function bottomNavigation(page: Page) {
  return page
    .locator('nav[aria-label="Campaign sections"]:visible')
    .filter({ has: page.getByRole('button', { name: 'More' }) });
}

/**
 * The control is inside the visual viewport on both axes, sits above the
 * phone bottom bar when that bar is shown, and accepts a pointer without
 * force. `toBeVisible` alone misses occlusion by fixed chrome.
 */
export async function expectReachable(page: Page, control: Locator) {
  await control.scrollIntoViewIfNeeded();
  await expect(control).toBeVisible();
  const bounds = await control.boundingBox();
  expect(bounds, 'control has visible bounds').not.toBeNull();
  const { width, height } = page.viewportSize()!;
  expect(bounds!.x, 'control left edge fits viewport').toBeGreaterThanOrEqual(
    0,
  );
  expect(
    bounds!.x + bounds!.width,
    'control right edge fits viewport',
  ).toBeLessThanOrEqual(width + 1);
  expect(bounds!.y, 'control top edge fits viewport').toBeGreaterThanOrEqual(0);
  expect(
    bounds!.y + bounds!.height,
    'control bottom edge fits viewport',
  ).toBeLessThanOrEqual(height + 1);
  const nav = bottomNavigation(page);
  if ((await nav.count()) > 0 && !(await isInDialog(control))) {
    const bar = (await nav.first().boundingBox())!;
    expect(
      bounds!.y + bounds!.height,
      'control sits above the bottom navigation',
    ).toBeLessThanOrEqual(bar.y + 1);
  }
  await control.click({ trial: true });
}

function isInDialog(control: Locator) {
  return control.evaluate(
    (element) => element.closest('[role="dialog"]') !== null,
  );
}

async function expectFocusInsideMore(page: Page) {
  expect(
    await page.evaluate(() => {
      const active = document.activeElement;
      if (!active || active === document.body) return 'body';
      if (active.closest('header, nav')) return 'chrome';
      return 'inside';
    }),
    'focus stays out of the page chrome behind the sheet',
  ).toBe('inside');
}

async function expectMoreClosed(page: Page) {
  await expect(page.getByRole('dialog', { name: 'More' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'More' })).toBeFocused();
}

/** Phone bottom bar and More sheet: names, dismissal, focus return, layout. */
export async function exercisePhoneShell(page: Page) {
  const { width, height } = page.viewportSize()!;
  const nav = page
    .getByRole('navigation', { name: 'Campaign sections', exact: true })
    .locator('visible=true');
  await expect(nav).toHaveCount(1);
  for (const name of ['Finished weeks', 'Militia', 'Characters & officers']) {
    await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
  }
  await expect(nav.getByRole('link', { name: /^Week( \d+)?$/ })).toBeVisible();
  await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  await expectNoHorizontalOverflow(page);
  const heading = page.getByRole('heading').first();
  await expectReachable(page, heading);
  const switcher = page.getByRole('combobox', { name: 'Active campaign' });
  await expectReachable(page, switcher);

  const more = page.getByRole('button', { name: 'More' });
  await expectReachable(page, more);
  await more.focus();
  await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog', { name: 'More' });
  await expect(sheet).toBeVisible();
  const organizationGroup = sheet.getByRole('group', {
    name: 'Organization',
    exact: true,
  });
  const organization = organizationGroup.getByRole('combobox', {
    name: 'Organization',
  });
  await expectReachable(page, organization);
  const label = organizationGroup.getByText('Organization', { exact: true });
  const labelBox = (await label.boundingBox())!;
  const controlBox = (await organization.boundingBox())!;
  expect(
    labelBox.y + labelBox.height,
    'organization label sits above its control',
  ).toBeLessThanOrEqual(controlBox.y + 1);
  await expectReachable(
    page,
    organizationGroup.getByRole('button', { name: 'New organization' }),
  );
  const account = sheet.getByRole('group', { name: 'Account', exact: true });
  await expectReachable(page, account.getByRole('button').first());
  for (let step = 0; step < 6; step += 1) {
    await page.keyboard.press('Tab');
    await expectFocusInsideMore(page);
  }
  for (let step = 0; step < 6; step += 1) {
    await page.keyboard.press('Shift+Tab');
    await expectFocusInsideMore(page);
  }
  // Escape closes only the open chooser, then the sheet.
  await organization.click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toBeHidden();
  await expect(sheet).toBeVisible();
  await page.keyboard.press('Escape');
  await expectMoreClosed(page);

  await more.click();
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Close', exact: true }).click();
  await expectMoreClosed(page);
  expect(page.viewportSize()).toEqual({ width, height });
}

/**
 * Desktop (from 1280px): the Week route's host ends within the viewport and
 * its last control is reachable by scrolling the host, not clipped.
 */
export async function expectBoundedWeekHost(page: Page) {
  const host = page.locator('[data-week-host]');
  await expect(host).toHaveCount(1);
  const { height } = page.viewportSize()!;
  const header = (await page.locator('header').first().boundingBox())!;
  const box = (await host.boundingBox())!;
  expect(box.y, 'week host starts after the top bar').toBeGreaterThanOrEqual(
    header.y + header.height - 1,
  );
  expect(
    box.y + box.height,
    'week host ends within the viewport',
  ).toBeLessThanOrEqual(height + 1);
  const last = host.locator('button:visible').last();
  await expectReachable(page, last);
}

export async function expectUnboundedPage(page: Page) {
  await expect(page.locator('[data-week-host]')).toHaveCount(0);
}
