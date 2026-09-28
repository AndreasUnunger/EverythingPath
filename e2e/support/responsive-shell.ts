import { expect, type Locator, type Page } from '@playwright/test';

// Geometry and reachability checks for the campaign shell (#150) and the
// Week frame (#151). Viewport resizing here is layout evidence only:
// headless browsers open no OS keyboard and report zero safe-area insets,
// so keyboard and notch behavior need a real device. The phone layout
// applies below 768px; from 768px the top bar carries the section links.
// The Week route is bounded to the viewport at every width and scrolls its
// editor column; every other page scrolls as a document.

// The document, and on the bounded Week route also the frame that clips it,
// the editor column that scrolls, the docked reference panel and any open
// dialog or sheet, all fit their own width. The top bar and its status
// position (#153) are checked by their boxes too: a header that clips its
// own overflow would hide controls without any document overflow.
export async function expectNoHorizontalOverflow(page: Page) {
  const overflowing = await page.evaluate(() => {
    const boxes = [
      document.documentElement,
      ...document.querySelectorAll(
        'header, [data-shell-slot="top-bar-status"], [data-shell-frame="bounded"], [data-week-host], [data-week-editor], [data-week-reference], [role="dialog"]',
      ),
    ];
    return boxes
      .filter((box) => box.scrollWidth > box.clientWidth + 1)
      .map((box) => box.tagName.toLowerCase());
  });
  expect(overflowing, 'no horizontal overflow').toEqual([]);
  const { width } = page.viewportSize()!;
  for (const box of await page
    .locator(
      'header :is(a, button, [role="combobox"], [data-week-status], [data-week-remote-note]):visible',
    )
    .all()) {
    const bounds = (await box.boundingBox())!;
    expect(
      bounds.x + bounds.width,
      'top bar content fits the viewport',
    ).toBeLessThanOrEqual(width + 1);
    expect(
      bounds.x,
      'top bar content starts inside the viewport',
    ).toBeGreaterThanOrEqual(-1);
  }
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
  // The footer is pinned under the editor column only; the reference panel
  // beside it legitimately occupies the same vertical band.
  const footer = page.locator('[data-week-footer]:visible');
  const isInEditor = await isEditorContent(control);
  if ((await footer.count()) > 0 && isInEditor) {
    const pinned = (await footer.first().boundingBox())!;
    expect(
      bounds!.y + bounds!.height,
      'editor content sits above the pinned week footer',
    ).toBeLessThanOrEqual(pinned.y + 1);
  }
  // The editor column clips what it scrolls: a control above its top edge
  // sits behind the pinned stepper, and one taller than the column can never
  // be seen whole. Long text is read by scrolling, so only controls count.
  if (isInEditor && (await isControl(control))) {
    const column = (await page.locator('[data-week-editor]').boundingBox())!;
    expect(
      bounds!.y,
      'editor content starts inside its scroll column',
    ).toBeGreaterThanOrEqual(column.y - 1);
    expect(
      bounds!.y + bounds!.height,
      'editor content ends inside its scroll column',
    ).toBeLessThanOrEqual(column.y + column.height + 1);
  }
  await control.click({ trial: true });
}

/**
 * Every enabled control shown in `scope` is reachable (see
 * `expectReachable`). Each is focused first, as a keyboard or a tap would,
 * so the page scrolls it clear of pinned chrome the way a player's focus
 * does. Visually hidden and aria-hidden elements (such as a native select
 * mirroring a custom one) are not controls a player reaches.
 */
export async function expectControlsReachable(
  page: Page,
  scope: Locator,
  what: string,
) {
  const controls = scope.locator(
    ':is(button, input, textarea, a[href], [role="combobox"]):visible:not(:disabled):not([aria-disabled="true"]):not([aria-hidden="true"]):not(.sr-only)',
  );
  expect(await controls.count(), `${what}: controls`).toBeGreaterThan(0);
  for (const control of await controls.all()) {
    await control.focus();
    await expectReachable(page, control);
  }
}

function isEditorContent(control: Locator) {
  return control.evaluate(
    (element) => element.closest('[data-week-editor]') !== null,
  );
}

function isControl(control: Locator) {
  return control.evaluate((element) =>
    element.matches(
      'button, input, select, textarea, a[href], summary, [role="button"], [role="combobox"]',
    ),
  );
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

// The page's first heading a sighted player sees. A visually hidden page
// title (sr-only: 1x1 px and clipped) is for screen readers; it never
// receives a pointer, so a trial click on it would wait forever.
function shownHeading(page: Page) {
  return page.getByRole('heading').and(page.locator(':not(.sr-only)')).first();
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
  await expectReachable(page, shownHeading(page));
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
  await expectReachable(page, shownHeading(page));
  await expectReachable(
    page,
    page.getByRole('combobox', { name: 'Active campaign' }),
  );
  await expectReachable(
    page,
    nav.getByRole('link', { name: 'Characters & officers', exact: true }),
  );
}

// The pinned Week chrome at the current width: the stepper (tablet row or
// desktop rail), the footer from 768px, and the phone bottom bar with its
// status strip below 768px. Each must end within the viewport.
async function pinnedWeekChrome(page: Page) {
  const chrome = [
    page
      .getByRole('navigation', { name: 'Week phases' })
      .locator('visible=true'),
    page.locator('[data-week-footer]:visible'),
    bottomNavigation(page).locator('..'),
  ];
  const boxes: { name: string; box: { y: number; height: number } }[] = [];
  for (const [index, locator] of chrome.entries()) {
    if ((await locator.count()) === 0) continue;
    const box = (await locator.first().boundingBox())!;
    boxes.push({ name: ['stepper', 'footer', 'bottom bar'][index]!, box });
  }
  return boxes;
}

/**
 * Waits until no finite CSS animation or transition is running, so a
 * geometry baseline is not captured mid-transition; perpetual decoration
 * must not prevent the check from running.
 */
export async function settleAnimations(page: Page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    for (;;) {
      const animations = document.getAnimations().filter((animation) => {
        const timing = animation.effect?.getComputedTiming();
        return (
          (animation.playState === 'running' || animation.pending) &&
          timing &&
          Number.isFinite(timing.endTime)
        );
      });
      if (animations.length === 0) return;
      // A responsive update may replace a transition, rejecting finished.
      // Re-read the animation list to also wait for its replacement.
      await Promise.allSettled(
        animations.map((animation) => animation.finished),
      );
    }
  });
}

/**
 * The Week route at every width: the host starts after the top bar and
 * ends within the viewport, the document never scrolls, and the editor
 * column is the scroller. With content taller than that column, its first
 * and last enabled controls are reached by scrolling the column while the
 * stepper, footer and phone bar stay exactly where they were. Editors with
 * no enabled controls must still expose their first and last text content.
 */
export async function expectBoundedWeekHost(page: Page) {
  // Resizing can start finite CSS transitions on the responsive chrome.
  // Capture its baseline only after those settle.
  await settleAnimations(page);
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
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollHeight <= window.innerHeight + 1 &&
        window.scrollY === 0,
    ),
    'the document does not scroll on the week',
  ).toBe(true);
  // Neither the body nor the bounded frame may be a scroll container: a
  // clipped-but-scrollable ancestor lets focus or scrolling into view move
  // the top bar and the pinned chrome off screen with no way back.
  expect(
    await page.evaluate(() =>
      [document.body, document.querySelector('[data-shell-frame]')]
        .filter((element): element is HTMLElement => element !== null)
        .filter((element) => {
          element.scrollTop = 1;
          const scrolled = element.scrollTop !== 0;
          element.scrollTop = 0;
          return scrolled;
        })
        .map((element) => element.tagName.toLowerCase()),
    ),
    'the shell around the week never scrolls',
  ).toEqual([]);
  const chrome = await pinnedWeekChrome(page);
  expect(chrome.length, 'some week chrome is pinned').toBeGreaterThan(0);
  for (const { name, box: pinned } of chrome)
    expect(
      pinned.y + pinned.height,
      `${name} ends within the viewport`,
    ).toBeLessThanOrEqual(height + 1);
  const editor = host.locator('[data-week-editor]');
  await expect(editor).toHaveCount(1);
  const controls = editor.locator(
    ':is(button, input, select, textarea, a[href], summary, [role="button"], [role="combobox"], [contenteditable="true"]):visible:not(:disabled):not([aria-disabled="true"])',
  );
  const targets = (await controls.count())
    ? controls
    : editor.locator('*:visible:not(:has(*))').filter({ hasText: /\S/ });
  expect(
    await targets.count(),
    'the editor has reachable controls or nonempty text content',
  ).toBeGreaterThan(0);
  const tall = await editor.evaluate(
    (element) => element.scrollHeight > element.clientHeight + 1,
  );
  await expectReachable(page, targets.last());
  if (tall) {
    // The last control in page order can sit near the top of a tall column,
    // so reach the lowest visible content to prove the column scrolls.
    // Only content a player can see and reach counts: skip faded or
    // click-through leaves such as an empty, hidden form message.
    const leaves = editor.locator('*:visible:not(:has(*))');
    const bottoms = await leaves.evaluateAll((elements) =>
      elements.map((element) => {
        const usable =
          element.checkVisibility({
            opacityProperty: true,
            visibilityProperty: true,
          }) &&
          getComputedStyle(element).pointerEvents !== 'none' &&
          (element.textContent?.trim() !== '' ||
            element.matches('button, input, select, textarea, a[href]'));
        return usable ? element.getBoundingClientRect().bottom : -Infinity;
      }),
    );
    await expectReachable(
      page,
      leaves.nth(bottoms.indexOf(Math.max(...bottoms))),
    );
    expect(
      await editor.evaluate((element) => element.scrollTop),
      'the editor column scrolled to reach its last target',
    ).toBeGreaterThan(0);
    expect(
      await page.evaluate(() => window.scrollY),
      'the document still did not scroll',
    ).toBe(0);
    expect(await pinnedWeekChrome(page), 'chrome unmoved after scroll').toEqual(
      chrome,
    );
  }
  await expectReachable(page, targets.first());
  expect(
    await editor.evaluate(
      (element) =>
        element.scrollTop >= 0 &&
        element.scrollTop <= element.scrollHeight - element.clientHeight + 1,
    ),
    'the editor stays within its scroll bounds',
  ).toBe(true);
  expect(await pinnedWeekChrome(page), 'chrome unmoved at the top').toEqual(
    chrome,
  );
}

/**
 * Every non-week page: the page scrolls as a document and its last control
 * is reachable that way. The bounded Week host never appears here.
 */
export async function expectDocumentScrolledPage(page: Page) {
  await expect(page.locator('[data-week-host]')).toHaveCount(0);
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

/**
 * Every visible one of `controls` lies within the viewport width, and each
 * button's label fits its own box. `size` names the viewport in messages.
 */
export async function expectControlsFit(
  controls: Locator,
  size: string,
  width: number,
) {
  for (const control of await controls.all()) {
    if (!(await control.isVisible())) continue;
    const details = await control.evaluate((element) => ({
      tag: element.tagName,
      label:
        element.getAttribute('aria-label') ??
        (element instanceof HTMLInputElement
          ? element.labels?.[0]?.textContent
          : element.textContent) ??
        'Unlabelled control',
      contentFits: element.scrollWidth <= element.clientWidth,
    }));
    const description = `${size}: ${details.tag} ${details.label}`;
    const bounds = await control.boundingBox();
    expect(bounds, description).not.toBeNull();
    expect(bounds!.x, description).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width, description).toBeLessThanOrEqual(width);
    // Text fields intentionally scroll long entered values inside their bounds.
    if (details.tag === 'BUTTON')
      expect(details.contentFits, description).toBe(true);
  }
}
