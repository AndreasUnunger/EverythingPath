import { expect, type Locator, type Page } from '@playwright/test';

// Geometry and reachability checks for the campaign shell (#150). Viewport
// resizing here is layout evidence only: headless browsers open no OS
// keyboard and report zero safe-area insets, so keyboard and notch behavior
// need a real device. The phone layout applies below 768px; from 768px the
// top bar carries the section links, and from 1280px the Week host is bounded.

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
 * The control is inside the visual viewport on both axes and accepts a
 * pointer without force. Page content (not part of the bottom bar, not in a
 * dialog) must also sit above the phone bottom bar. `toBeVisible` alone
 * misses occlusion by fixed chrome.
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
  if ((await nav.count()) > 0 && (await isPageContent(control))) {
    // The whole sticky bar, including the Week frame's status strip above
    // the tabs, must not cover page content.
    const bar = (await nav.first().locator('..').boundingBox())!;
    expect(
      bounds!.y + bounds!.height,
      'page content sits above the bottom bar and its status strip',
    ).toBeLessThanOrEqual(bar.y + 1);
  }
  const footer = page.locator('[data-week-footer]:visible');
  if ((await footer.count()) > 0 && (await isPageContent(control))) {
    const pinned = (await footer.first().boundingBox())!;
    expect(
      bounds!.y + bounds!.height,
      'page content sits above the pinned week footer',
    ).toBeLessThanOrEqual(pinned.y + 1);
  }
  await control.click({ trial: true });
}

// Page content is anything outside a dialog, outside the sticky bar that
// holds the bottom navigation and outside the week footer (their own
// controls sit in them by design).
function isPageContent(control: Locator) {
  return control.evaluate((element) => {
    if (element.closest('[role="dialog"]')) return false;
    if (element.closest('[data-week-footer]')) return false;
    const bar = Array.from(
      document.querySelectorAll('nav[aria-label="Campaign sections"]'),
    ).find((nav) => nav.querySelector('button'))?.parentElement;
    return !bar?.contains(element);
  });
}

async function expectFocusInsideMore(page: Page) {
  expect(
    await page
      .getByRole('dialog', { name: 'More' })
      .evaluate((dialog) => dialog.contains(document.activeElement)),
    'focus stays inside the More sheet',
  ).toBe(true);
}

async function expectMoreClosed(page: Page) {
  await expect(page.getByRole('dialog', { name: 'More' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'More' })).toBeFocused();
}

function sectionNames(nav: Locator) {
  return Promise.all([
    ...['Finished weeks', 'Militia', 'Characters & officers'].map((name) =>
      expect(nav.getByRole('link', { name, exact: true })).toBeVisible(),
    ),
    expect(nav.getByRole('link', { name: /^Week( \d+)?$/ })).toBeVisible(),
    expect(nav.locator('[aria-current="page"]')).toHaveCount(1),
  ]);
}

/** Below 768px: phone bottom bar and More sheet — names, dismissal, focus return, layout. */
export async function exercisePhoneShell(page: Page) {
  const { width, height } = page.viewportSize()!;
  expect(width, 'phone layout applies below 768px').toBeLessThan(768);
  const nav = page
    .getByRole('navigation', { name: 'Campaign sections', exact: true })
    .locator('visible=true');
  await expect(nav).toHaveCount(1);
  await expect(nav.getByRole('button', { name: 'More' })).toBeVisible();
  await sectionNames(nav);
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
  await expectReachable(
    page,
    account.getByRole('button', { name: 'Manage account', exact: true }),
  );
  await expectReachable(
    page,
    account.getByRole('button', { name: 'Sign out', exact: true }),
  );
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

/** From 768px (including a short phone-landscape viewport): top-bar links, no bottom bar. */
export async function exerciseTopBarShell(page: Page) {
  expect(page.viewportSize()!.width).toBeGreaterThanOrEqual(768);
  const nav = page
    .getByRole('navigation', { name: 'Campaign sections', exact: true })
    .locator('visible=true');
  await expect(nav).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'More' })).toBeHidden();
  await sectionNames(nav);
  await expectNoHorizontalOverflow(page);
  await expectReachable(page, page.getByRole('heading').first());
  await expectReachable(
    page,
    page.getByRole('combobox', { name: 'Active campaign' }),
  );
  await expectReachable(
    page,
    nav.getByRole('link', { name: 'Characters & officers', exact: true }),
  );
}

/**
 * Desktop (from 1280px): the Week route's host ends within the viewport and
 * its last control is reachable by scrolling the host, not clipped.
 */
export async function expectBoundedWeekHost(page: Page) {
  expect(page.viewportSize()!.width).toBeGreaterThanOrEqual(1280);
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
  // The page itself never scrolls; the editor column does. Its last enabled
  // control is reached by scrolling that column, with the pinned footer and
  // the stepper rail staying inside the viewport.
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollHeight <= window.innerHeight + 1 &&
        window.scrollY === 0,
    ),
    'the document does not scroll on the desktop week',
  ).toBe(true);
  const last = host.locator('main button:visible:enabled').last();
  await expectReachable(page, last);
  const footer = host.locator('[data-week-footer]:visible');
  if ((await footer.count()) > 0) {
    const pinned = (await footer.first().boundingBox())!;
    expect(
      pinned.y + pinned.height,
      'week footer ends within the viewport',
    ).toBeLessThanOrEqual(height + 1);
  }
  const rail = host.getByRole('navigation', { name: 'Week phases' });
  if ((await rail.count()) > 0) {
    const bounds = (await rail.boundingBox())!;
    expect(
      bounds.y + bounds.height,
      'stepper rail ends within the viewport',
    ).toBeLessThanOrEqual(height + 1);
  }
}

/**
 * Below 1280px, and on every non-week page: the page scrolls as a document
 * and its last control is reachable that way. The week wrapper, when
 * present, must not own the scrolling.
 */
export async function expectDocumentScrolledPage(page: Page) {
  const host = page.locator('[data-week-host]');
  if ((await host.count()) > 0) {
    expect(
      await host.evaluate(
        (element) => element.scrollHeight <= element.clientHeight + 1,
      ),
      'week wrapper does not scroll internally',
    ).toBe(true);
  }
  // A page taller than the viewport scrolls as a document; a shorter one
  // has nothing to scroll and its controls are simply in view.
  const scrolled = await page.evaluate(() => {
    const tall = document.documentElement.scrollHeight > window.innerHeight + 1;
    if (tall) window.scrollTo(0, document.documentElement.scrollHeight);
    return !tall || window.scrollY > 0;
  });
  expect(scrolled, 'a tall page scrolls as a document').toBe(true);
  await expectReachable(page, page.locator('main button:visible').last());
}
