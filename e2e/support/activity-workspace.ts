import { join } from 'node:path';
import { expect, type Page, type Locator } from '@playwright/test';
import { savePrivate } from './process';
import type { controlNextDraftEdit } from './held-mutation';
export async function exerciseActivityWorkspace(
  gm: Page,
  player: Page,
  network: Awaited<ReturnType<typeof controlNextDraftEdit>>,
  artifactDirectory: string,
) {
  await gm.setViewportSize({ width: 1194, height: 834 });
  const slot = (page: Page, position: number) =>
    page.locator(`[aria-label="Action Slot ${position}"]`);
  const card = (page: Page, position: number, action: string) =>
    slot(page, position).getByRole('button', {
      name: `Move ${action} from Action Slot ${position}`,
      exact: true,
    });
  const saved = (page: Page) =>
    expect(
      page.getByRole('status').filter({ hasText: /^Changes saved\.$/ }),
    ).toBeVisible();
  async function choose(
    page: Page,
    action: string,
    position: number,
    occupied = false,
  ) {
    await page
      .getByRole('button', { name: `Choose ${action}`, exact: true })
      .click();
    await page
      .getByRole('button', {
        name: `${occupied ? 'Replace' : 'Place in'} Action Slot ${position}`,
        exact: true,
      })
      .click();
    await saved(page);
  }
  async function drag(page: Page, source: Locator, target: Locator | null) {
    await source.scrollIntoViewIfNeeded();
    const start = await source.boundingBox();
    const end = target
      ? await target.boundingBox()
      : { x: 4, y: 4, width: 0, height: 0 };
    expect(start).not.toBeNull();
    expect(end).not.toBeNull();
    await page.mouse.move(
      start!.x + start!.width / 2,
      start!.y + start!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(end!.x + end!.width / 2, end!.y + 30, { steps: 12 });
    await page.mouse.up();
  }
  await gm.getByRole('button', { name: 'Activity', exact: true }).click();
  await choose(gm, 'Drill Militia', 1);
  await expect(
    player.getByRole('heading', { name: 'Week 4 · Upkeep', exact: true }),
  ).toBeVisible();
  await player.getByRole('button', { name: 'Activity', exact: true }).click();
  await expect(card(player, 1, 'Drill Militia')).toBeVisible();
  await slot(gm, 1)
    .getByText('Edit Drill Militia details', { exact: true })
    .click();
  await slot(gm, 1)
    .getByRole('textbox', { name: 'Cost (copper)', exact: true })
    .fill('0');
  await saved(gm);
  const rankException = slot(gm, 1).getByRole('group', {
    name: 'Maximum Rank exception',
    exact: true,
  });
  await rankException
    .getByRole('textbox', { name: 'Exception reason', exact: true })
    .fill('The table permits this training exercise');
  await rankException
    .getByRole('button', { name: 'Save exception reason', exact: true })
    .click();
  await saved(gm);
  await slot(gm, 1)
    .getByRole('group', { name: 'Team', exact: true })
    .getByRole('button', { name: 'Scouts', exact: true })
    .click();
  await saved(gm);
  await slot(gm, 1)
    .getByRole('textbox', { name: 'Check die 1', exact: true })
    .fill('10');
  await saved(gm);
  await slot(gm, 1)
    .getByText('Edit Drill Militia details', { exact: true })
    .click();
  await card(gm, 1, 'Drill Militia').click();
  await gm
    .getByRole('button', { name: 'Place in Action Slot 2', exact: true })
    .click();
  await expect(card(player, 2, 'Drill Militia')).toBeVisible();
  await choose(player, 'Gather Information', 1);
  await slot(player, 1)
    .getByText('Edit Gather Information details', { exact: true })
    .click();
  await slot(player, 1)
    .getByRole('textbox', { name: 'Subject', exact: true })
    .fill('Ironfang patrol routes');
  await slot(player, 1)
    .getByRole('button', { name: 'Save subject', exact: true })
    .click();
  await saved(player);
  await slot(player, 1)
    .getByText('Edit Gather Information details', { exact: true })
    .click();

  await card(gm, 2, 'Drill Militia').click();
  await gm
    .getByRole('button', { name: 'Swap with Action Slot 1', exact: true })
    .click();
  await expect(card(player, 1, 'Drill Militia')).toBeVisible();
  await expect(card(player, 2, 'Gather Information')).toBeVisible();
  await slot(player, 2)
    .getByText('Edit Gather Information details', { exact: true })
    .click();
  await expect(
    slot(player, 2).getByRole('textbox', { name: 'Subject', exact: true }),
  ).toHaveValue('Ironfang patrol routes');
  await slot(player, 2)
    .getByText('Edit Gather Information details', { exact: true })
    .click();

  await slot(player, 1)
    .getByText('Edit Drill Militia details', { exact: true })
    .click();
  await expect(
    slot(player, 1)
      .getByRole('group', { name: 'Team', exact: true })
      .getByRole('button', { name: 'Scouts', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    slot(player, 1).getByRole('textbox', {
      name: 'Cost (copper)',
      exact: true,
    }),
  ).toHaveValue('0');
  await expect(
    slot(player, 1).getByRole('textbox', { name: 'Check die 1', exact: true }),
  ).toHaveValue('10');
  await slot(player, 1)
    .getByText('Edit Drill Militia details', { exact: true })
    .click();
  await drag(gm, card(gm, 1, 'Drill Militia'), slot(gm, 3));
  await expect(card(player, 3, 'Drill Militia')).toBeVisible();
  await expect(
    slot(gm, 3).getByText(/exceeds the action allowance/),
  ).toBeVisible();
  await slot(gm, 3)
    .getByText('Edit Drill Militia details', { exact: true })
    .click();
  await expect(
    slot(gm, 3).getByRole('group', {
      name: 'Action Capacity exception',
      exact: true,
    }),
  ).toHaveCount(0);
  await gm.getByRole('button', { name: 'Summary', exact: true }).click();
  await expect(
    gm.getByRole('button', { name: 'Confirm week', exact: true }),
  ).toBeDisabled();
  await expect(
    gm
      .getByRole('region', { name: 'Required decisions' })
      .getByText(/restore the action allowance/),
  ).toBeVisible();
  await gm.getByRole('button', { name: 'Activity', exact: true }).click();
  await slot(gm, 3)
    .getByText('Edit Drill Militia details', { exact: true })
    .click();
  await slot(gm, 3)
    .getByRole('group', { name: 'Maximum Rank exception', exact: true })
    .getByRole('button', { name: 'Remove exception', exact: true })
    .click();
  await saved(gm);
  await slot(gm, 3)
    .getByText('Edit Drill Militia details', { exact: true })
    .click();
  await card(gm, 3, 'Drill Militia').click();
  await gm
    .getByRole('button', { name: 'Place in Action Slot 1', exact: true })
    .click();
  await expect(card(player, 1, 'Drill Militia')).toBeVisible();
  await expect(
    slot(gm, 1).getByText(/exceeds the action allowance/),
  ).toHaveCount(0);
  await drag(gm, card(gm, 1, 'Drill Militia'), null);
  await expect(slot(player, 1).getByText('Empty slot')).toBeVisible();
  await drag(
    gm,
    gm.getByRole('button', { name: 'Choose Drill Militia', exact: true }),
    slot(gm, 1),
  );
  await expect(card(player, 1, 'Drill Militia')).toBeVisible();
  const captured = network.hold();
  await gm.getByRole('button', { name: 'Choose Lie Low', exact: true }).click();
  await gm
    .getByRole('button', { name: 'Replace Action Slot 1', exact: true })
    .click();
  await captured;
  await gm.getByRole('button', { name: 'Event', exact: true }).click();
  await choose(player, 'Gather Information', 1, true);
  network.release();
  await expect(
    gm.getByRole('status').filter({ hasText: 'Changes could not be saved.' }),
  ).toBeVisible();
  await gm.getByRole('button', { name: 'Activity', exact: true }).click();
  await expect(card(gm, 1, 'Gather Information')).toBeVisible();
  await choose(gm, 'Drill Militia', 1, true);
  for (const [name, width, height] of [
    ['tablet', 1194, 834],
    ['phone', 390, 844],
    ['desktop', 1440, 900],
  ] as const) {
    await gm.setViewportSize({ width, height });
    expect(
      await gm.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await savePrivate(
      join(artifactDirectory, `canonical-activity-${name}.png`),
      await gm.screenshot({ fullPage: true }),
    );
  }
  await gm.setViewportSize({ width: 1194, height: 834 });
  for (const [position, action] of [
    [1, 'Drill Militia'],
    [2, 'Gather Information'],
  ] as const) {
    await card(gm, position, action).click();
    await gm
      .getByRole('button', { name: 'Clear selected choice', exact: true })
      .click();
    await expect(slot(player, position).getByText('Empty slot')).toBeVisible();
  }
  await Promise.all([
    gm.getByRole('button', { name: 'Upkeep', exact: true }).click(),
    player.getByRole('button', { name: 'Upkeep', exact: true }).click(),
  ]);
}
