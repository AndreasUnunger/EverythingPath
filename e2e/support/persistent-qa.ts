import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { savePrivate } from './process';
import {
  expectBoundedWeekHost,
  expectNoHorizontalOverflow,
  expectReachable,
} from './responsive-shell';
import { referencePanel } from './week-frame';
import { RIVALRY_ENDED } from './persistent-workspace';

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
  await expect(rivalry).toContainText(RIVALRY_ENDED);
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
  // Only the rule-supported Theft check exists, as one dice total.
  await expect(
    theft.getByRole('textbox', { name: 'Loyalty check', exact: true }),
  ).toBeVisible();
  await expect(
    theft.getByRole('combobox', { name: 'Character', exact: true }),
  ).toHaveCount(0);
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
    .getByRole('textbox', { name: 'Loyalty check', exact: true })
    .fill('20');
  await expect(theft).toContainText('Success ·');
  // Tablet, phone and desktop, then (#144 §6) phone landscape and the
  // narrower tablet with the reference panel closed.
  for (const [name, width, height] of [
    ['tablet', 1194, 834],
    ['phone', 390, 844],
    ['desktop', 1440, 900],
    ['phone-landscape', 844, 390],
    ['tablet-narrow-closed', 1180, 820],
  ] as const) {
    await page.setViewportSize({ width, height });
    const section = page.getByRole('region', {
      name: 'Persistent preparation',
    });
    await expect(section).toBeVisible();
    const closesPanel = name === 'tablet-narrow-closed';
    if (closesPanel) {
      await page.getByRole('button', { name: 'Hide reference panel' }).click();
      await expect(referencePanel(page)).toBeHidden();
    }
    await expectNoHorizontalOverflow(page);
    await expectBoundedWeekHost(page);
    if (name === 'phone-landscape' || closesPanel) {
      // The short viewport and the widened editor still reach the check and
      // the buyoff above the pinned week footer.
      await expectReachable(
        page,
        theft.getByRole('textbox', { name: 'Loyalty check', exact: true }),
      );
      // Every decision card, not only Buy off, is seen whole in the short
      // scroll column.
      for (const card of await theft
        .getByRole('group', { name: 'Theft · Event 1 decision', exact: true })
        .getByRole('button')
        .all())
        await expectReachable(page, card);
    }
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
    if (closesPanel) {
      await page.getByRole('button', { name: 'Show reference panel' }).click();
      await expect(referencePanel(page)).toBeVisible();
    }
  }
  // Replace the check with the previously reviewed buyoff.
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
  await expect(rivalry).toContainText(RIVALRY_ENDED);
  await page.setViewportSize({ width: 1194, height: 834 });
}
