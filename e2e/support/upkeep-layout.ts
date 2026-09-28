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

// The scrolling ancestor of a card: the page's own scroller when no inner
// column scrolls.
function scrollerOf(card: Locator) {
  return card.evaluate((element) => {
    for (let node = element.parentElement; node; node = node.parentElement)
      if (
        ['auto', 'scroll'].includes(getComputedStyle(node).overflowY) &&
        node.scrollHeight > node.clientHeight + 1
      )
        return { found: true, scrollTop: node.scrollTop };
    return {
      found: false,
      scrollTop: (document.scrollingElement ?? document.documentElement)
        .scrollTop,
    };
  });
}

/**
 * Touch at the tablet size (touch is enabled in this project): a finger pan
 * that starts on a nearest-settlement card scrolls the week instead of
 * dragging the card, and changes no selection on either device; a tap then
 * chooses a card and a tap on the previous card restores it. Starts with
 * `selected` chosen and `other` not.
 */
export async function panAndTapSettlementCards(
  gm: Page,
  player: Page,
  selected: string,
  other: string,
) {
  const card = (page: Page, name: string) =>
    page
      .getByRole('group', { name: 'Nearest settlement', exact: true })
      .getByRole('button', { name, exact: true });
  const pressed = async (name: string, value: 'true' | 'false') => {
    for (const page of [gm, player])
      await expect(card(page, name)).toHaveAttribute('aria-pressed', value);
  };
  await pressed(selected, 'true');
  await pressed(other, 'false');
  const start = await card(gm, other).boundingBox();
  expect(start, 'a card under the pan').not.toBeNull();
  const before = await scrollerOf(card(gm, other));
  const x = Math.round(start!.x + start!.width / 2);
  const y = Math.round(start!.y + start!.height / 2);
  // With room above, the finger moves down and the week scrolls back up;
  // otherwise it moves up and the week scrolls on.
  const distance = before.scrollTop > 160 ? 160 : -160;
  // A finger's own touch events: headless Chromium's synthesized touch
  // scroll gesture sends only touchstart and touchend.
  const cdp = await gm.context().newCDPSession(gm);
  try {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y }],
    });
    for (let step = 1; step <= 20; step++)
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: Math.round(y + (distance * step) / 20) }],
      });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
  } finally {
    await cdp.detach();
  }
  await expect
    .poll(
      async () => (await scrollerOf(card(gm, other))).scrollTop,
      'the pan scrolled the week',
    )
    .not.toBe(before.scrollTop);
  await expect(card(gm, other)).not.toHaveAttribute('style', /translate/);
  await pressed(selected, 'true');
  await pressed(other, 'false');

  await card(gm, other).tap();
  await pressed(other, 'true');
  await pressed(selected, 'false');
  await card(gm, selected).tap();
  await pressed(selected, 'true');
  await pressed(other, 'false');
}
