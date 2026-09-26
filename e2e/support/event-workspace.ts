import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { savePrivate } from './process';
import type { controlNextDraftEdit } from './held-mutation';
export async function exerciseEventWorkspace(
  gm: Page,
  player: Page,
  network: Awaited<ReturnType<typeof controlNextDraftEdit>>,
  artifactDirectory: string,
) {
  const phase = (page: Page, name: string) =>
    page.getByRole('button', { name, exact: true }).click();
  const chance = (page: Page) =>
    page.getByRole('textbox', { name: 'Event chance roll', exact: true });
  const table = (page: Page, position: number) =>
    page.getByRole('textbox', {
      name: `Event ${position} table roll`,
      exact: true,
    });
  const occurrence = (page: Page, position: number) =>
    page.getByRole('group', { name: `Event ${position}`, exact: true });
  await Promise.all([phase(gm, 'Event'), phase(player, 'Event')]);
  const previousChance = await chance(gm).inputValue();
  await chance(gm).fill('1');
  await expect(chance(player)).toHaveValue('1');
  await gm
    .getByRole('button', { name: 'Add rolled event', exact: true })
    .click();
  await expect(table(player, 1)).toHaveValue('');
  await table(gm, 1).fill('50');
  await expect(occurrence(player, 1).getByRole('heading')).toHaveText(
    'Event 1: Roll Twice',
  );
  await occurrence(gm, 1)
    .getByRole('button', { name: 'Add Roll Twice child', exact: true })
    .click();
  await expect(table(player, 2)).toHaveValue('');
  await occurrence(gm, 1)
    .getByRole('button', { name: 'Add Roll Twice child', exact: true })
    .click();
  await expect(table(player, 3)).toHaveValue('');
  await table(gm, 2).fill('45');
  await table(player, 3).fill('82');
  await expect(occurrence(gm, 3).getByRole('heading')).toHaveText(
    'Event 3: Invasion',
  );
  await occurrence(gm, 3)
    .getByText('Edit Event 3 details', { exact: true })
    .click();
  await occurrence(gm, 3)
    .getByRole('textbox', { name: 'Average Party Level', exact: true })
    .fill('4');
  await occurrence(gm, 3)
    .getByRole('button', { name: 'Save occurrence', exact: true })
    .click();
  await occurrence(player, 3)
    .getByText('Edit Event 3 details', { exact: true })
    .click();
  await expect(
    occurrence(player, 3).getByRole('textbox', {
      name: 'Average Party Level',
      exact: true,
    }),
  ).toHaveValue('4');
  await occurrence(player, 3)
    .getByRole('textbox', {
      name: 'Event outcome acknowledgement',
      exact: true,
    })
    .fill('The table drove the invaders away.');
  await occurrence(player, 3)
    .getByRole('button', {
      name: 'Save event outcome acknowledgement',
      exact: true,
    })
    .click();
  await expect(
    occurrence(gm, 3).getByRole('textbox', {
      name: 'Event outcome acknowledgement',
      exact: true,
    }),
  ).toHaveValue('The table drove the invaders away.');
  await table(gm, 2).fill('0');
  await expect(table(player, 2)).toHaveValue('0');
  await table(gm, 2).fill('');
  await expect(table(player, 2)).toHaveValue('');
  await table(gm, 2).fill('45');
  await expect(table(player, 2)).toHaveValue('45');
  const observer = await gm.context().newPage();
  try {
    await observer.goto(gm.url());
    await phase(observer, 'Event');
    await expect(table(observer, 2)).toHaveValue('45');
    const held = network.hold();
    await table(gm, 2).fill('46');
    await held;
    await expect(
      gm.getByRole('status').filter({ hasText: 'Saving changes…' }),
    ).toBeVisible();
    await phase(gm, 'Review & confirm');
    await table(player, 2).fill('47');
    // A third read-only tab proves the competing mutation was accepted before releasing the stale edit.
    await expect(table(observer, 2)).toHaveValue('47');
    network.release();
    await expect(
      gm.getByRole('status').filter({ hasText: 'Changes could not be saved.' }),
    ).toBeVisible();
    await expect(
      gm.getByRole('heading', { name: /· Review & confirm$/ }),
    ).toBeVisible();
  } finally {
    network.release();
    await observer.close();
  }
  await phase(gm, 'Event');
  await expect(table(gm, 2)).toHaveValue('47');
  await table(gm, 2).fill('45');
  await expect(table(player, 2)).toHaveValue('45');
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
    for (const button of await gm
      .locator('section[aria-label="Event preparation"]')
      .getByRole('button')
      .all()) {
      if (!(await button.isVisible())) continue;
      const bounds = await button.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      expect(
        await button.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true);
    }
    await savePrivate(
      join(artifactDirectory, `canonical-event-${name}.png`),
      await gm.screenshot({ fullPage: true }),
    );
  }
  await occurrence(gm, 3)
    .getByRole('button', { name: 'Clear event acknowledgement', exact: true })
    .click();
  await expect(
    occurrence(player, 3).getByRole('textbox', {
      name: 'Event outcome acknowledgement',
      exact: true,
    }),
  ).toHaveValue('');
  // Restore the supported journey's prepared week so its exact Confirmation assertions remain meaningful.
  await occurrence(gm, 1)
    .getByRole('button', {
      name: 'Remove Event 1 and its branches',
      exact: true,
    })
    .click();
  await expect(table(player, 1)).toHaveCount(0);
  await chance(gm).fill(previousChance);
  await expect(chance(player)).toHaveValue(previousChance);
  await gm.setViewportSize({ width: 1194, height: 834 });
}
