import { join } from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';
import { savePrivate } from './process';
import type { controlNextDraftEdit } from './held-mutation';
import { expectSaveFailed, saveStatus } from './week-frame';

const phase = (page: Page, name: string) =>
  page.getByRole('button', { name, exact: true }).click();
const event = (page: Page, name: string) =>
  page.getByRole('group', { name, exact: true });
const button = (group: Locator, name: string) =>
  group.getByRole('button', { name, exact: true });

export async function exercisePersistentWorkspace(
  gm: Page,
  player: Page,
  network: Awaited<ReturnType<typeof controlNextDraftEdit>>,
  artifactDirectory: string,
) {
  await Promise.all([phase(gm, 'Persistent'), phase(player, 'Persistent')]);
  const old = (page: Page) => event(page, 'Theft · Event 1');
  const recent = (page: Page) => event(page, 'Theft · Event 2');
  const rivalry = (page: Page) => event(page, 'Rivalry · Event 3');
  await expect(old(gm)).toBeVisible();
  await expect(recent(player)).toBeVisible();
  await expect(rivalry(player)).toContainText('Scouts');
  await expect(rivalry(player)).toContainText('Rangers');
  await expect(
    gm
      .locator('[data-week-editor]')
      .getByText('First buyoff is available immediately.', { exact: true }),
  ).toBeVisible();
  await button(old(gm), 'Buy off event').click();
  await expect(old(player)).toContainText('Buyoff staged: 4000 cp.');
  await expect(
    gm
      .locator('[data-week-editor]')
      .getByText('Next buyoff: week 8.', { exact: true }),
  ).toBeVisible();
  await expect(
    recent(player).getByText('Buyoff staged: 4000 cp.', { exact: true }),
  ).toHaveCount(0);
  await button(recent(player), 'Buy off event').click();
  await expect(
    recent(gm).getByRole('textbox', {
      name: 'Persistent exception reason',
      exact: true,
    }),
  ).toBeVisible();
  await recent(gm)
    .getByRole('textbox', { name: 'Persistent exception reason', exact: true })
    .fill('The table permits both buyoffs this week.');
  await button(recent(gm), 'Save persistent exception reason').click();
  await expect(recent(player)).toContainText('Buyoff staged: 4000 cp.');
  await button(recent(player), 'Clear decision').click();
  await expect(
    recent(gm).getByText('Buyoff staged: 4000 cp.', { exact: true }),
  ).toHaveCount(0);
  await button(old(gm), 'Clear decision').click();
  await expect(
    old(player).getByText('Buyoff staged: 4000 cp.', { exact: true }),
  ).toHaveCount(0);

  await old(gm)
    .getByRole('textbox', { name: 'Ending outcome', exact: true })
    .fill('The table recovered the stolen goods.');
  await button(old(gm), 'Save ending outcome').click();
  await old(gm)
    .getByRole('textbox', { name: 'Persistent exception reason', exact: true })
    .fill('The thieves agreed to leave the militia alone.');
  await button(old(gm), 'Save persistent exception reason').click();
  await expect(old(player)).toContainText('Ending staged for Confirmation.');
  await expect(
    recent(player).getByText('Ending staged for Confirmation.', {
      exact: true,
    }),
  ).toHaveCount(0);
  await button(old(player), 'Clear decision').click();
  await expect(
    old(gm).getByText('Ending staged for Confirmation.', { exact: true }),
  ).toHaveCount(0);
  await button(old(gm), 'Attempt temporary mitigation').click();
  await button(old(gm), 'Add rolls').click();
  await button(old(gm), 'Add check').click();
  await expect(
    old(gm).getByRole('textbox', { name: 'Sides', exact: true }),
  ).toHaveValue('20');
  await button(old(gm), 'Add dice entry').click();
  const die = old(gm).getByRole('textbox', { name: 'Entry 1', exact: true });
  await die.fill('20');
  await die.pressSequentially('x');
  await expect(die).toHaveValue('20');
  await expect(
    old(gm).getByRole('alert').filter({ hasText: 'Use digits only.' }),
  ).toBeVisible();
  await die.fill('0');
  await expect(die).toHaveValue('0');
  await die.fill('');
  await expect(die).toHaveValue('');
  await die.fill('20');
  await button(old(gm), 'Save persistent decision').click();
  await expect(old(player)).toContainText('retains 90% of this week’s income.');

  const observer = await gm.context().newPage();
  try {
    await observer.goto(gm.url());
    await phase(observer, 'Persistent');
    await expect(old(observer)).toContainText(
      'retains 90% of this week’s income.',
    );
    const held = network.hold();
    await button(old(gm), 'Clear decision').click();
    await held;
    await expect(saveStatus(gm)).toHaveText('Saving changes…');
    await phase(gm, 'Event');
    await expect(
      player.getByRole('heading', { name: /· Persistent$/ }),
    ).toBeVisible();
    await button(old(player), 'Buy off event').click();
    await expect(old(observer)).toContainText('Buyoff staged: 4000 cp.');
    network.release();
    await expectSaveFailed(gm);
    await expect(gm.getByRole('heading', { name: /· Event$/ })).toBeVisible();
  } finally {
    network.release();
    await observer.close();
  }
  await phase(gm, 'Persistent');
  await expect(old(gm)).toContainText('Buyoff staged: 4000 cp.');
  await button(old(gm), 'Clear decision').click();
  await expect(
    old(player).getByText('Buyoff staged: 4000 cp.', { exact: true }),
  ).toHaveCount(0);
  await button(old(player), 'Buy off event').click();
  await expect(old(gm)).toContainText('Buyoff staged: 4000 cp.');
  await button(recent(gm), 'Buy off event').click();
  await expect(recent(player)).toContainText('Buyoff staged: 4000 cp.');

  await button(rivalry(player), 'Attempt officer ending').click();
  await button(rivalry(player), 'Add officer check').click();
  await rivalry(player)
    .getByRole('group', { name: 'Character', exact: true })
    .getByRole('button')
    .last()
    .click();
  await button(rivalry(player), 'Diplomacy').click();
  await rivalry(player)
    .getByRole('textbox', { name: 'Skill Bonus', exact: true })
    .fill('0');
  await button(rivalry(player), 'Add roll').click();
  await expect(
    rivalry(player).getByRole('textbox', { name: 'Sides', exact: true }),
  ).toHaveValue('20');
  await button(rivalry(player), 'Add dice entry').click();
  await rivalry(player)
    .getByRole('textbox', { name: 'Entry 1', exact: true })
    .fill('20');
  await button(rivalry(player), 'Save persistent decision').click();
  await expect(rivalry(gm)).toContainText('ends the event.');
  for (const page of [gm, player]) {
    await phase(page, 'Event');
    await phase(page, 'Persistent');
    await expect(
      page.getByRole('heading', { name: /· Persistent$/ }),
    ).toBeVisible();
    await expect(old(page)).toBeVisible();
    await expect(recent(page)).toBeVisible();
    await expect(rivalry(page)).toBeVisible();
  }
  for (const [name, width, height] of [
    ['tablet', 1194, 834],
    ['phone', 390, 844],
    ['desktop', 1440, 900],
  ] as const) {
    await gm.setViewportSize({ width, height });
    for (const control of await gm
      .locator('section[aria-label="Persistent preparation"]')
      .getByRole('button')
      .all()) {
      if (!(await control.isVisible())) continue;
      const bounds = await control.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      expect(
        await control.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true);
    }
    await savePrivate(
      join(artifactDirectory, `canonical-persistent-${name}.png`),
      await gm.screenshot({ fullPage: true }),
    );
  }
  await gm.setViewportSize({ width: 1194, height: 834 });
}
