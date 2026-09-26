import { expect, type Page } from '@playwright/test';

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
  const line = page.locator('[data-week-readiness]:visible');
  await expect(line).toHaveCount(1);
  await expect(line).toHaveText(
    /^(|\d+ decisions? left|Review .*|Confirming the week…)$/,
  );
  await expect(line).not.toContainText(/ready for confirmation|attention/i);
  await previous(locked ? 'Event' : 'Persistent').click();
  await nav.getByRole('button', { name: 'Upkeep', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Previous', exact: true }),
  ).toBeDisabled();
  await expect(next('Activity')).toBeEnabled();
  await expect(page.locator('[data-week-readiness]:visible')).toHaveText(
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
  const origin = /^Step \d of 5 · (.+)$/.exec(
    (await trigger.innerText()).split('\n')[0]!.trim(),
  )?.[1];
  expect(origin, 'the step button names the current phase').toBeTruthy();
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
  await expect(sheet.locator('button[aria-current="step"]')).toHaveCount(1);
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
  // Choose a different available step, then return.
  await trigger.click();
  await expect(sheet).toBeVisible();
  const target = origin === 'Activity' ? 'Event' : 'Activity';
  await sheet.getByRole('button', { name: target, exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`phase=${target.toLowerCase()}`));
  await expect(trigger).toContainText(target);
  const strip = page.locator('[data-week-readiness]:visible');
  await expect(strip).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: /^Previous: /, exact: false }),
  ).toBeVisible();
  await trigger.click();
  await sheet.getByRole('button', { name: origin!, exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(trigger).toContainText(origin!);
}
