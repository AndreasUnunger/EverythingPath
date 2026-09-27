import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { savePrivate } from './process';
import { expectNoHorizontalOverflow } from './responsive-shell';

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
  await expect(theft).toContainText('Ends · buyoff 40 gp');
  await expect(rivalry).toContainText('ends the event.');
  await expect(
    rivalry.getByRole('button', { name: 'Add rolls', exact: true }),
  ).toHaveCount(0);
  // Only the applicable check card: Theft has no officer card, Rivalry no
  // Loyalty card, and neither offers a recorded amount.
  await expect(
    theft.getByRole('button', { name: 'Officer check to end it', exact: true }),
  ).toHaveCount(0);
  await expect(
    rivalry.getByRole('button', {
      name: 'Loyalty check (this week only)',
      exact: true,
    }),
  ).toHaveCount(0);
  await theft
    .getByRole('button', {
      name: 'Loyalty check (this week only)',
      exact: true,
    })
    .click();
  await theft.getByRole('button', { name: 'Add rolls', exact: true }).click();
  // Only the rule-supported Theft check exists, as one dice total.
  await expect(
    theft.getByRole('textbox', { name: 'Check roll', exact: true }),
  ).toBeVisible();
  await expect(theft.getByText('1d20 · total of the dice only')).toBeVisible();
  for (const name of [
    'check',
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
  await expect(
    theft.getByRole('textbox', { name: 'Sides', exact: true }),
  ).toHaveCount(0);
  await theft
    .getByRole('textbox', { name: 'Check roll', exact: true })
    .fill('20');
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
    await expectNoHorizontalOverflow(page);
    await savePrivate(
      join(artifactDirectory, `reviewer-persistent-${name}.png`),
      await page.screenshot({ fullPage: true }),
    );
    for (const control of await section.locator('button, input').all()) {
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
      const description = `${name}: ${details.tag} ${details.label}`;
      const bounds = await control.boundingBox();
      expect(bounds, description).not.toBeNull();
      expect(bounds!.x, description).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width, description).toBeLessThanOrEqual(width);
      // Text inputs intentionally scroll long entered values inside their bounds.
      if (details.tag === 'BUTTON')
        expect(details.contentFits, description).toBe(true);
    }
  }
  // Discard the unsaved roll and restore the previously reviewed buyoff.
  await theft
    .getByRole('button', { name: 'Buy off · 40 gp', exact: true })
    .click();
  await expect(theft).toContainText('Ends · buyoff 40 gp');
  await page
    .getByRole('button', { name: 'Review & confirm', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: /· Review & confirm$/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Persistent', exact: true }).click();
  await expect(theft).toContainText('Ends · buyoff 40 gp');
  await expect(rivalry).toContainText('ends the event.');
  await page.setViewportSize({ width: 1194, height: 834 });
}
