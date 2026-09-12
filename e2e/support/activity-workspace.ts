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
  await choose(player, 'Earn Gold', 1);
  await card(gm, 2, 'Drill Militia').click();
  await gm
    .getByRole('button', { name: 'Replace Action Slot 1', exact: true })
    .click();
  await expect(card(player, 1, 'Drill Militia')).toBeVisible();
  await expect(card(player, 2, 'Earn Gold')).toBeVisible();
  await slot(player, 1)
    .getByText('Edit Drill Militia details', { exact: true })
    .click();
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
  await drag(gm, card(gm, 3, 'Drill Militia'), null);
  await expect(slot(player, 3).getByText('Empty slot')).toBeVisible();
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
  await choose(player, 'Earn Gold', 1, true);
  network.release();
  await expect(
    gm.getByRole('status').filter({ hasText: 'Changes could not be saved.' }),
  ).toBeVisible();
  await gm.getByRole('button', { name: 'Activity', exact: true }).click();
  await expect(card(gm, 1, 'Earn Gold')).toBeVisible();
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
    [2, 'Earn Gold'],
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
