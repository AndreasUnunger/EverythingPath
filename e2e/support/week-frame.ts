import { expect, type Locator, type Page } from '@playwright/test';

// The Week frame (#151): five positions in rules order, readiness as each
// step's accessible description, a locked Persistent that stays visible,
// previous/next that skip it and never wrap, and the phone step sheet.
// Readiness counts are rules-driven, so these checks assert structure and
// the relationship between positions, not specific numbers.

const positions = [
  'Upkeep',
  'Activity',
  'Event',
  'Persistent',
  'Review & confirm',
] as const;

function stepper(page: Page) {
  return page
    .getByRole('navigation', { name: 'Week phases', exact: true })
    .locator('visible=true');
}

async function currentStep(page: Page) {
  return stepper(page).locator('button[aria-current="step"]');
}

// The readiness line lives in the visible frame chrome: the pinned footer
// from 768px (the full sentence), the strip above the bottom tabs below it
// (the short "N to decide" / "N warning(s)" form inside the reference
// trigger). An empty line (the correct Review & confirm state when
// confirmable) has no height, so the visible container is asserted and the
// line itself is read without a visibility requirement.
async function readinessLine(page: Page) {
  const chrome = page.locator(
    '[data-week-footer]:visible, [data-week-strip]:visible',
  );
  await expect(chrome).toHaveCount(1);
  const line = chrome.locator('[data-week-readiness]');
  await expect(line).toHaveCount(1);
  return line;
}

/**
 * Tablet and desktop (from 768px): stepper positions, descriptions, the
 * locked Persistent, and footer previous/next skipping and endpoints. Ends
 * on the phase it started on.
 */
export async function exerciseWeekFrame(page: Page) {
  expect(page.viewportSize()!.width).toBeGreaterThanOrEqual(768);
  const nav = stepper(page);
  await expect(nav).toHaveCount(1);
  const buttons = nav.getByRole('button');
  await expect(buttons).toHaveCount(5);
  for (const [index, name] of positions.entries())
    await expect(buttons.nth(index)).toHaveAccessibleName(name);
  const current = await currentStep(page);
  await expect(current).toHaveCount(1);
  const origin = (await current.getAttribute('aria-label'))!;
  // Readiness is a description, never part of the name; Review & confirm
  // has none at all.
  for (const name of positions.slice(0, 4))
    await expect(
      nav.getByRole('button', { name, exact: true }),
    ).toHaveAccessibleDescription(/^(Ready|\d+ to decide|No carried events)/);
  await expect(
    nav.getByRole('button', { name: 'Review & confirm', exact: true }),
  ).not.toHaveAttribute('aria-describedby', /.+/);
  const persistent = nav.getByRole('button', {
    name: 'Persistent',
    exact: true,
  });
  const locked = await persistent.isDisabled();
  if (locked)
    await expect(persistent).toHaveAccessibleDescription('No carried events');
  const next = (name: string) =>
    page.getByRole('button', { name: `Next: ${name}`, exact: true });
  const previous = (name: string) =>
    page.getByRole('button', { name: `Previous: ${name}`, exact: true });

  await nav.getByRole('button', { name: 'Event', exact: true }).click();
  await expect(
    nav.getByRole('button', { name: 'Event', exact: true }),
  ).toHaveAttribute('aria-current', 'step');
  await expect(previous('Activity')).toBeEnabled();
  await expect(
    locked ? next('Review & confirm') : next('Persistent'),
  ).toBeEnabled();
  await (locked ? next('Review & confirm') : next('Persistent')).click();
  if (!locked) {
    await expect(
      nav.getByRole('button', { name: 'Persistent', exact: true }),
    ).toHaveAttribute('aria-current', 'step');
    await next('Review & confirm').click();
  }
  await expect(
    nav.getByRole('button', { name: 'Review & confirm', exact: true }),
  ).toHaveAttribute('aria-current', 'step');
  await expect(page).toHaveURL(/phase=summary/);
  // The last position: no wrap forward, and only a disabled-Confirmation
  // reason (or nothing) in the footer; never a ready/needs-attention line.
  await expect(
    page.getByRole('button', { name: 'Next', exact: true }),
  ).toBeDisabled();
  const line = await readinessLine(page);
  const reason = (await line.textContent())!.trim();
  const confirmable = await page
    .getByRole('button', { name: 'Confirm week', exact: true })
    .isEnabled();
  // Confirmable: nothing at all. Otherwise exactly one disabled reason;
  // never the removed ready/needs-attention sentence.
  if (confirmable) expect(reason, 'no caption when confirmable').toBe('');
  else
    expect(reason, 'only the disabled-Confirmation reason').toMatch(
      /^(\d+ decisions? left|Review .*|Confirming the week…)$/,
    );
  expect(reason).not.toMatch(/ready for confirmation|attention/i);
  await previous(locked ? 'Event' : 'Persistent').click();
  await nav.getByRole('button', { name: 'Upkeep', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Previous', exact: true }),
  ).toBeDisabled();
  await expect(next('Activity')).toBeEnabled();
  await expect(await readinessLine(page)).toHaveText(
    /^(Upkeep is ready\.|Complete the required rolls and decisions to finish Upkeep\.)/,
  );
  await nav.getByRole('button', { name: origin, exact: true }).click();
  await expect(await currentStep(page)).toHaveAttribute('aria-label', origin);
}

/**
 * Phone (below 768px): the Step N of 5 button opens a sheet listing every
 * position with the same semantics; Escape and choosing close it and focus
 * returns to the button. Ends on the phase it started on.
 */
export async function exercisePhoneSteps(page: Page) {
  expect(page.viewportSize()!.width).toBeLessThan(768);
  await expect(stepper(page)).toHaveCount(0);
  const trigger = page.getByRole('button', { name: /^Step \d of 5 · / });
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
  await trigger.focus();
  await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog', { name: /^Week \d+$/ });
  await expect(sheet).toBeVisible();
  const buttons = sheet.getByRole('button', {
    name: /^(Upkeep|Activity|Event|Persistent|Review & confirm)$/,
  });
  await expect(buttons).toHaveCount(5);
  for (const [index, name] of positions.entries())
    await expect(buttons.nth(index)).toHaveAccessibleName(name);
  const current = sheet.locator('button[aria-current="step"]');
  await expect(current).toHaveCount(1);
  // Capture the current phase from the sheet's semantic state while open.
  const origin = (await current.getAttribute('aria-label'))!;
  expect(positions).toContain(origin);
  await expect(
    sheet.getByRole('button', { name: 'Review & confirm', exact: true }),
  ).not.toHaveAttribute('aria-describedby', /.+/);
  expect(
    await sheet.evaluate((dialog) => dialog.contains(document.activeElement)),
    'focus moves into the step sheet',
  ).toBe(true);
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(trigger).toBeFocused();
  // The modal hides background controls from accessibility while open.
  // Once closed, the trigger's name (decorative glyph excluded) must agree
  // with the sheet's current phase and its numeric position.
  await expect(trigger).toHaveAccessibleName(
    new RegExp(
      `^Step ${positions.indexOf(origin as never) + 1} of 5 · ${origin}`,
    ),
  );
  // Choose a different available step, then return.
  await trigger.click();
  await expect(sheet).toBeVisible();
  const target = origin === 'Activity' ? 'Event' : 'Activity';
  await sheet.getByRole('button', { name: target, exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`phase=${target.toLowerCase()}`));
  await expect(trigger).toHaveAccessibleName(
    new RegExp(`^Step \\d of 5 · ${target}`),
  );
  await readinessLine(page);
  await expect(
    page.getByRole('button', { name: /^Previous: /, exact: false }),
  ).toBeVisible();
  await trigger.click();
  await sheet.getByRole('button', { name: origin, exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(trigger).toHaveAccessibleName(
    new RegExp(`^Step \\d of 5 · ${origin}`),
  );
}

// The reference surfaces (#152): from 768px a closable docked panel with
// This phase above Militia / Officers / History tabs and same-campaign
// links; below 768px the strip's middle opens a bottom sheet with the same
// body. Values are rules-driven, so these checks assert structure: Now and
// After columns, an honest After, link targets and local visibility.

/**
 * The one save/confirmation status of the Week. Other polite statuses can
 * legitimately exist beside it (the History tab's loading line), so save
 * feedback is always read from this element rather than any status.
 */
export function saveStatus(page: Page) {
  return page.getByRole('status').and(page.locator('[data-week-status]'));
}

export function referencePanel(page: Page) {
  return page.getByRole('complementary', { name: 'Reference panel' });
}

function campaignIdFromUrl(page: Page) {
  const match = /\/campaigns\/([^/?#]+)/.exec(page.url());
  expect(match, 'on a campaign page').not.toBeNull();
  return match![1]!;
}

// The History tab in health: the reader settles to at most three distinct
// recent effective weeks, or the empty state, never a failure card.
async function expectHealthyHistory(root: Locator, campaignId: string) {
  await expect(root.getByRole('status')).toBeHidden();
  await expect(root.getByRole('alert')).toHaveCount(0);
  const list = root.getByRole('list', { name: 'Recent weeks' });
  const empty = root.getByText('No finished weeks yet.', { exact: true });
  await expect(list.or(empty)).toHaveCount(1);
  if ((await list.count()) === 1) {
    const links = list.getByRole('link');
    const count = await links.count();
    expect(count, 'between one and three recent weeks').toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(3);
    const hrefs: string[] = [];
    for (const link of await links.all()) {
      const href = (await link.getAttribute('href'))!;
      expect(href).toMatch(
        new RegExp(`^/campaigns/${campaignId}/history\\?week=\\d+$`),
      );
      await expect(link).toHaveText(/^Week \d+$/);
      hrefs.push(href);
    }
    expect(new Set(hrefs).size, 'distinct weeks').toBe(hrefs.length);
  }
  await expect(
    root.getByRole('link', { name: 'All finished weeks', exact: true }),
  ).toHaveAttribute('href', `/campaigns/${campaignId}/history`);
}

async function expectReferenceBody(page: Page, root: Locator) {
  const campaignId = campaignIdFromUrl(page);
  await expect(root.getByRole('region', { name: 'This phase' })).toHaveCount(1);
  await expect(root.getByRole('tab', { name: 'Militia' })).toBeVisible();
  const values = root.getByRole('table', { name: 'Militia values' });
  await expect(values).toBeVisible();
  await expect(values.getByRole('columnheader', { name: 'Now' })).toBeVisible();
  await expect(
    values.getByRole('columnheader', { name: 'After the week' }),
  ).toBeVisible();
  for (const name of ['Rank', 'Training', 'Treasury', 'Notoriety', 'Focus'])
    await expect(
      values.getByRole('rowheader', { name, exact: true }),
    ).toBeVisible();
  // After the week is either a value or the explicit awaiting state; a
  // zero-looking fallback is never shown for an incomplete forecast.
  const training = values.getByRole('row', { name: /^Training/ });
  await expect(training.getByRole('cell').nth(0)).toHaveText(/^\d+$/);
  await expect(training.getByRole('cell').nth(1)).toHaveText(
    /^(\d+|Awaiting decisions)$/,
  );
  await expect(root.getByRole('region', { name: 'This week' })).toContainText(
    /used/,
  );
  await expect(
    root.getByRole('link', { name: 'Open militia', exact: true }),
  ).toHaveAttribute('href', `/campaigns/${campaignId}/militia`);
  await root.getByRole('tab', { name: 'Officers' }).click();
  await expect(
    root.getByRole('link', { name: 'Characters & officers', exact: true }),
  ).toHaveAttribute('href', `/campaigns/${campaignId}/characters`);
  await root.getByRole('tab', { name: 'History' }).click();
  await expectHealthyHistory(root, campaignId);
  await root.getByRole('tab', { name: 'Militia' }).click();
  // Long team, officer and event names wrap inside the fixed-width surface
  // rather than widening it or scrolling sideways.
  expect(
    await root.evaluate(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    ),
    'the reference surface does not overflow sideways',
  ).toBe(true);
}

// The panel scrolls its own long contents while the document, the editor
// column and the pinned chrome stay exactly where they were.
async function expectPanelScrolls(page: Page, panel: Locator) {
  const editor = page.locator('[data-week-editor]');
  const before = await page.evaluate(() => ({
    document: window.scrollY,
    editor: document.querySelector('[data-week-editor]')!.scrollTop,
    footer: document
      .querySelector('[data-week-footer]')!
      .getBoundingClientRect()
      .toJSON() as { y: number },
  }));
  const last = panel
    .locator('*:visible:not(:has(*))')
    .filter({ hasText: /\S/ });
  await expect(last.last()).toBeAttached();
  await last.last().scrollIntoViewIfNeeded();
  await expect(last.last()).toBeVisible();
  const tall = await panel.evaluate(
    (element) => element.scrollHeight > element.clientHeight + 1,
  );
  if (tall)
    expect(
      await panel.evaluate((element) => element.scrollTop),
      'the panel scrolled to reach its last content',
    ).toBeGreaterThan(0);
  const after = await page.evaluate(() => ({
    document: window.scrollY,
    editor: document.querySelector('[data-week-editor]')!.scrollTop,
    footer: document
      .querySelector('[data-week-footer]')!
      .getBoundingClientRect()
      .toJSON() as { y: number },
  }));
  expect(after.document, 'the document did not scroll').toBe(before.document);
  expect(after.editor, 'the editor did not scroll').toBe(before.editor);
  expect(after.footer.y, 'the footer stayed pinned').toBe(before.footer.y);
  await expect(editor).toBeVisible();
  await panel.evaluate((element) => element.scrollTo(0, 0));
}

/**
 * From 768px: the docked panel's body and links, its own scrolling, the
 * toggle, and the remembered (browser-local) visibility across a reload.
 */
export async function exerciseReferencePanel(page: Page) {
  expect(page.viewportSize()!.width).toBeGreaterThanOrEqual(768);
  const { height } = page.viewportSize()!;
  const panel = referencePanel(page);
  const show = page.getByRole('button', { name: 'Show reference panel' });
  const hide = page.getByRole('button', { name: 'Hide reference panel' });
  if (await show.isVisible()) await show.click();
  await expect(panel).toHaveCount(1);
  await expect(panel).toBeVisible();
  const box = (await panel.boundingBox())!;
  expect(
    box.y + box.height,
    'panel ends within the viewport',
  ).toBeLessThanOrEqual(height + 1);
  await expectReferenceBody(page, panel);
  await expectPanelScrolls(page, panel);
  await expect(hide).toHaveAttribute('aria-expanded', 'true');
  await hide.focus();
  await page.keyboard.press('Enter');
  await expect(panel).toBeHidden();
  await expect(show).toHaveAttribute('aria-expanded', 'false');
  await expect(show).toBeFocused();
  // The editor takes the panel's space; readiness stays in the stepper.
  await expect(
    stepper(page).locator('button[aria-current="step"]'),
  ).toHaveCount(1);
  await page.reload();
  await expect(show).toBeVisible();
  await expect(panel).toBeHidden();
  await show.click();
  await expect(panel).toBeVisible();
  await page.reload();
  await expect(panel).toBeVisible();
}

/**
 * A history read that fails stays inside the History tab (failure card and
 * Try again) while the editor keeps saving; a retry after the fault clears
 * restores the healthy list. `network` is the page's websocket control.
 */
export async function exerciseReferenceHistoryFailure(
  page: Page,
  network: { failHistory: (failing: boolean) => void },
  editInput: Locator,
  values: [string, string],
) {
  expect(page.viewportSize()!.width).toBeGreaterThanOrEqual(768);
  const campaignId = campaignIdFromUrl(page);
  const panel = referencePanel(page);
  await expect(panel).toBeVisible();
  // Leave History so the next visit subscribes afresh under the fault.
  await panel.getByRole('tab', { name: 'Militia' }).click();
  network.failHistory(true);
  await panel.getByRole('tab', { name: 'History' }).click();
  const failure = panel.getByRole('alert');
  await expect(failure).toHaveCount(1);
  await expect(failure).toHaveText(/Recent weeks could not be loaded\./);
  await expect(
    panel.getByRole('link', { name: 'All finished weeks', exact: true }),
  ).toHaveAttribute('href', `/campaigns/${campaignId}/history`);
  // Editing is unaffected: the input accepts a value and the Week's own
  // status reports the save.
  await editInput.fill(values[0]);
  await expect(editInput).toHaveValue(values[0]);
  await expect(saveStatus(page)).toHaveText('Changes saved.');
  await expect(failure).toHaveCount(1);
  network.failHistory(false);
  await failure.getByRole('button', { name: 'Try again', exact: true }).click();
  await expectHealthyHistory(panel, campaignId);
  await editInput.fill(values[1]);
  await expect(saveStatus(page)).toHaveText('Changes saved.');
  await panel.getByRole('tab', { name: 'Militia' }).click();
}

/**
 * Below 768px: the strip's middle button carries Training and Treasury and
 * opens the reference sheet; Escape and Close each close it and return
 * focus.
 */
export async function exercisePhoneReference(page: Page) {
  expect(page.viewportSize()!.width).toBeLessThan(768);
  await expect(referencePanel(page)).toBeHidden();
  const trigger = page.locator('[data-week-strip-trigger]');
  await expect(trigger).toHaveCount(1);
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAccessibleName(/^Reference:.*Training.*Treasury/);
  await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
  await trigger.focus();
  await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog', { name: 'Reference', exact: true });
  await expect(sheet).toBeVisible();
  expect(
    await sheet.evaluate((dialog) => dialog.contains(document.activeElement)),
    'focus moves into the reference sheet',
  ).toBe(true);
  await expectReferenceBody(page, sheet);
  // Tab never leaves the sheet while it is open.
  for (let step = 0; step < 8; step += 1) {
    await page.keyboard.press('Tab');
    expect(
      await sheet.evaluate((dialog) => dialog.contains(document.activeElement)),
      'focus stays inside the reference sheet',
    ).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(trigger).toBeFocused();
}
