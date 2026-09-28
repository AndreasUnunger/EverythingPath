import { join } from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';
import type { z } from 'zod';
import type { draftKeySchema } from '../../convex/lib/canonicalStorageValidators';
import { savePrivate, type Run } from './process';
import {
  expectBoundedWeekHost,
  expectNoHorizontalOverflow,
  expectReachable,
} from './responsive-shell';
import { stageLegacyRemove } from './team-conditions';

type DraftKey = z.infer<typeof draftKeySchema>;

// Upkeep's card and repair content at phone and desktop sizes (#140 §8
// bullet 5): the nearest-settlement cards, the missing team's return row,
// the staged-Remove repair and the rank feat cards. The settlement/rank
// journey exercises the same content at the tablet size only. Phone
// landscape leaves the editor column about 100px tall, so every choice card
// must still fit it whole.
const sizes = [
  ['phone', 390, 844],
  ['phone-landscape', 844, 390],
  ['desktop', 1440, 900],
] as const;

/** Every visible control in the groups: in the viewport, above the bars, its label fits. */
async function reviewControls(
  page: Page,
  state: string,
  groups: Locator[],
  artifactDirectory: string,
) {
  for (const [size, width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await expect(groups[0]!).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectBoundedWeekHost(page);
    for (const group of groups) {
      const controls = await group.locator('button, a, input').all();
      expect(controls.length, `${state} ${size}: controls`).toBeGreaterThan(0);
      for (const control of controls) {
        if (!(await control.isVisible())) continue;
        await expectReachable(page, control);
        const fit = await control.evaluate((element) => ({
          isButton: element.tagName === 'BUTTON',
          label: element.getAttribute('aria-label') ?? element.textContent,
          fits: element.scrollWidth <= element.clientWidth + 1,
        }));
        // Inputs scroll long values inside their bounds by design.
        if (fit.isButton)
          expect(fit.fits, `${state} ${size}: ${fit.label}`).toBe(true);
      }
    }
    await savePrivate(
      join(artifactDirectory, `canonical-upkeep-${state}-${size}.png`),
      await page.screenshot({ fullPage: true }),
    );
  }
  await page.setViewportSize({ width: 1194, height: 834 });
}

/**
 * On the settlement/rank fixture (maximum notoriety, the missing Riders, the
 * disabled Scouts, a rank gain), opened on one page at the tablet size.
 */
export async function reviewUpkeepChoiceLayout(
  page: Page,
  run: Run,
  key: DraftKey,
) {
  const roll = (name: string) =>
    page.getByRole('textbox', { name, exact: true });
  await expect(roll('Attrition Loyalty roll')).toBeVisible();
  await roll('Attrition Loyalty roll').fill('10');
  await roll('Attrition training roll').fill('3');
  await roll('Maximum-notoriety training roll').fill('5');
  // A failed Loyalty check at maximum notoriety asks for the settlement.
  await roll('Notoriety Loyalty roll').fill('1');
  const settlements = page.getByRole('group', {
    name: 'Nearest settlement',
    exact: true,
  });
  const phaendar = settlements.getByRole('button', {
    name: 'Phaendar',
    exact: true,
  });
  await phaendar.click();
  await expect(phaendar).toHaveAttribute('aria-pressed', 'true');
  const riders = page.getByRole('group', {
    name: 'Riders return check',
    exact: true,
  });
  await riders
    .getByRole('textbox', { name: 'Riders return roll', exact: true })
    .fill('19');
  await expect(riders).toContainText('Returns at the end of the week');
  const scouts = page.getByRole('group', {
    name: 'Scouts team condition',
    exact: true,
  });
  await stageLegacyRemove(page, run, key);
  await expect(
    scouts.getByRole('link', {
      name: 'Remove the team in Militia corrections',
    }),
  ).toBeVisible();
  await reviewControls(
    page,
    'repair',
    [settlements, riders, scouts],
    run.artifactDirectory,
  );

  await scouts
    .getByRole('button', { name: 'Clear Remove choice', exact: true })
    .click();
  await scouts
    .getByRole('button', { name: 'Leave disabled', exact: true })
    .click();
  const rank = page
    .locator('[data-week-editor]')
    .getByRole('region', { name: 'Rank', exact: true });
  await expect(rank).toContainText('Rank 8 → 9');
  const feats = rank.getByRole('group', { name: /rank 9 feat$/ });
  await expect(
    feats.getByRole('button', { name: 'Iron Will', exact: true }),
  ).toBeVisible();
  await reviewControls(page, 'rank', [feats], run.artifactDirectory);
}
