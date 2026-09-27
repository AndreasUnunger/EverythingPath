import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { savePrivate } from './process';
import { expectNoHorizontalOverflow } from './responsive-shell';
import type { controlNextDraftEdit } from './held-mutation';
import { expectSaveFailed, saveStatus } from './week-frame';
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
  // Blocks are labelled hierarchically: Roll Twice children of Event 1 are
  // Event 1.1 and Event 1.2, whatever else is added later. `path` is the part
  // after "Event ".
  const table = (page: Page, path: string) =>
    page.getByRole('textbox', {
      name: `Event ${path} table roll`,
      exact: true,
    });
  const occurrence = (page: Page, path: string) =>
    page.getByRole('group', { name: `Event ${path}`, exact: true });
  await Promise.all([phase(gm, 'Event'), phase(player, 'Event')]);
  const previousChance = await chance(gm).inputValue();
  // A triggered chance roll prepares the rolled event's blank position on
  // every device; nobody adds it by hand.
  await chance(gm).fill('1');
  await expect(chance(player)).toHaveValue('1');
  await expect(table(player, '1')).toHaveValue('');
  await expect(table(player, '1')).toBeEnabled();
  await table(gm, '1').fill('50');
  await expect(
    occurrence(player, '1').getByText('Two more', { exact: true }),
  ).toBeVisible();
  // The first Roll Twice brings its two blank child positions with it.
  await expect(table(player, '1.1')).toHaveValue('');
  await expect(table(player, '1.2')).toHaveValue('');
  await expect(table(player, '1.1')).toBeEnabled();
  await expect(table(player, '1.2')).toBeEnabled();
  for (const retired of [
    'Add rolled event',
    'Add Roll Twice child',
    'Add replacement event',
    'Remove Event 1 and its branches',
  ])
    await expect(
      gm.getByRole('button', { name: retired, exact: true }),
    ).toHaveCount(0);
  await table(gm, '1.1').fill('45');
  await table(player, '1.2').fill('82');
  await expect(
    occurrence(gm, '1.2').getByText('Invasion', { exact: true }),
  ).toBeVisible();
  // Moving Event 1 away from Roll Twice hides its children; returning restores
  // them with their rolls and identities.
  await table(gm, '1').fill('10');
  await expect(table(player, '1.1')).toBeHidden();
  await expect(table(player, '1.2')).toBeHidden();
  await table(gm, '1').fill('50');
  await expect(table(player, '1.1')).toHaveValue('45');
  await expect(table(player, '1.2')).toHaveValue('82');
  await occurrence(gm, '1.2')
    .getByText('Edit Event 1.2 details', { exact: true })
    .click();
  await occurrence(gm, '1.2')
    .getByRole('textbox', { name: 'Average Party Level', exact: true })
    .fill('4');
  await occurrence(gm, '1.2')
    .getByRole('button', { name: 'Save occurrence', exact: true })
    .click();
  await occurrence(player, '1.2')
    .getByText('Edit Event 1.2 details', { exact: true })
    .click();
  await expect(
    occurrence(player, '1.2').getByRole('textbox', {
      name: 'Average Party Level',
      exact: true,
    }),
  ).toHaveValue('4');
  await occurrence(player, '1.2')
    .getByRole('textbox', {
      name: 'Event outcome acknowledgement',
      exact: true,
    })
    .fill('The table drove the invaders away.');
  await occurrence(player, '1.2')
    .getByRole('button', {
      name: 'Save event outcome acknowledgement',
      exact: true,
    })
    .click();
  await expect(
    occurrence(gm, '1.2').getByRole('textbox', {
      name: 'Event outcome acknowledgement',
      exact: true,
    }),
  ).toHaveValue('The table drove the invaders away.');
  await table(gm, '1.1').fill('0');
  await expect(table(player, '1.1')).toHaveValue('0');
  await table(gm, '1.1').fill('');
  await expect(table(player, '1.1')).toHaveValue('');
  // Sickness (89–96) asks for its team on cards and for what happened; a
  // choice on one device shows as chosen on the other.
  await table(gm, '1.1').fill('90');
  const sickTeam = (page: Page) =>
    occurrence(page, '1.1').getByRole('group', {
      name: /^Team that falls sick/,
    });
  const firstTeam = (page: Page) =>
    sickTeam(page).getByRole('button', { pressed: false }).first();
  const teamName = await firstTeam(player).getAttribute('aria-label');
  await firstTeam(player).click();
  await expect(
    sickTeam(gm).getByRole('button', { name: teamName!, exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  const happened = (page: Page) =>
    occurrence(page, '1.1').getByRole('textbox', {
      name: 'What happened',
      exact: true,
    });
  await happened(gm).fill('The fever reached the camp.');
  await occurrence(gm, '1.1')
    .getByRole('button', { name: 'Save what happened', exact: true })
    .click();
  await expect(happened(player)).toHaveValue('The fever reached the camp.');
  await occurrence(player, '1.1')
    .getByRole('button', { name: 'Clear what happened', exact: true })
    .click();
  await sickTeam(player)
    .getByRole('button', { name: 'Clear team that falls sick', exact: true })
    .click();
  await expect(happened(gm)).toHaveValue('');
  // The GM's next roll saves the whole occurrence it sees. Built before the
  // cleared team arrives, it would be refused as stale (#143 §5), so the GM
  // first sees the player's clear.
  await expect(
    sickTeam(gm).getByRole('button', { name: teamName!, exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
  await table(gm, '1.1').fill('45');
  await expect(table(player, '1.1')).toHaveValue('45');
  const observer = await gm.context().newPage();
  try {
    await observer.goto(gm.url());
    await phase(observer, 'Event');
    await expect(table(observer, '1.1')).toHaveValue('45');
    const held = network.hold();
    await table(gm, '1.1').fill('46');
    await held;
    await expect(saveStatus(gm)).toHaveText('Saving changes…');
    await phase(gm, 'Review & confirm');
    await table(player, '1.1').fill('47');
    // A third read-only tab proves the competing mutation was accepted before releasing the stale edit.
    await expect(table(observer, '1.1')).toHaveValue('47');
    network.release();
    await expectSaveFailed(gm);
    await expect(
      gm.getByRole('heading', { name: /· Review & confirm$/ }),
    ).toBeVisible();
  } finally {
    network.release();
    await observer.close();
  }
  await phase(gm, 'Event');
  await expect(table(gm, '1.1')).toHaveValue('47');
  await table(gm, '1.1').fill('45');
  await expect(table(player, '1.1')).toHaveValue('45');
  for (const [name, width, height] of [
    ['tablet', 1194, 834],
    ['phone', 390, 844],
    ['desktop', 1440, 900],
  ] as const) {
    await gm.setViewportSize({ width, height });
    await expectNoHorizontalOverflow(gm);
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
  await occurrence(gm, '1.2')
    .getByRole('button', { name: 'Clear event acknowledgement', exact: true })
    .click();
  await expect(
    occurrence(player, '1.2').getByRole('textbox', {
      name: 'Event outcome acknowledgement',
      exact: true,
    }),
  ).toHaveValue('');
  // Restore the supported journey's quiet week so its exact Confirmation
  // assertions remain meaningful. The recorded events stay on record, unused.
  await chance(gm).fill(previousChance);
  await expect(chance(player)).toHaveValue(previousChance);
  await expect(table(player, '1')).toBeHidden();
  await expect(
    player.getByText(/^Kept on record, not used this week/),
  ).toBeVisible();
  await gm.setViewportSize({ width: 1194, height: 834 });
}
