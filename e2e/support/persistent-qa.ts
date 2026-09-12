import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { savePrivate } from './process';

/** Independent review of the carried-event controls on the authenticated page. */
export async function reviewPersistentWorkspace(
  page: Page,
  artifactDirectory: string,
) {
  const theft = page.getByRole('group', {
    name: 'Theft · Event 1',
    exact: true,
  });
  const rivalry = page.getByRole('group', {
    name: 'Rivalry · Event 3',
    exact: true,
  });
  await expect(theft).toContainText('Buyoff staged: 4000 cp.');
  await expect(rivalry).toContainText('ends the event.');
  await expect(
    rivalry.getByRole('button', { name: 'Add rolls', exact: true }),
  ).toHaveCount(0);
  await theft
    .getByRole('button', {
      name: 'Attempt temporary mitigation',
      exact: true,
    })
    .click();
  await theft.getByRole('button', { name: 'Add rolls', exact: true }).click();
  await expect(
    theft.getByRole('button', { name: 'Add check', exact: true }),
  ).toBeVisible();
  for (const name of [
    'notoriety',
    'training',
    'delivery',
    'loss',
    'chance',
    'table',
    'duration',
    'reward',
  ]) {
    await expect(
      theft.getByRole('button', { name: `Add ${name}`, exact: true }),
    ).toHaveCount(0);
  }
  await theft.getByRole('button', { name: 'Add check', exact: true }).click();
  await expect(
    theft.getByRole('textbox', { name: 'Sides', exact: true }),
  ).toHaveValue('20');
  await theft
    .getByRole('button', { name: 'Add dice entry', exact: true })
    .click();
  await theft.getByRole('textbox', { name: 'Entry 1', exact: true }).fill('20');
  for (const [name, width, height] of [
    ['tablet', 1194, 834],
    ['phone', 390, 844],
    ['desktop', 1440, 900],
  ] as const) {
    await page.setViewportSize({ width, height });
    const section = page.getByRole('region', {
      name: 'Persistent preparation',
    });
    await expect(section).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const control of await section.locator('button, input').all()) {
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
      join(artifactDirectory, `reviewer-persistent-${name}.png`),
      await page.screenshot({ fullPage: true }),
    );
  }
  // Discard the unsaved roll and restore the previously reviewed buyoff.
  await theft
    .getByRole('button', { name: 'Buy off event', exact: true })
    .click();
  await expect(theft).toContainText('Buyoff staged: 4000 cp.');
  await page.getByRole('button', { name: 'Summary', exact: true }).click();
  await expect(page.getByRole('heading', { name: /· Summary$/ })).toBeVisible();
  await page.getByRole('button', { name: 'Persistent', exact: true }).click();
  await expect(theft).toContainText('Buyoff staged: 4000 cp.');
  await expect(rivalry).toContainText('ends the event.');
  await page.setViewportSize({ width: 1194, height: 834 });
}
