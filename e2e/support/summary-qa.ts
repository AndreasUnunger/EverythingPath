import { join } from 'node:path';
import { expect, type Page, type Locator } from '@playwright/test';
import { savePrivate } from './process';
import { expectNoHorizontalOverflow } from './responsive-shell';
import { saveStatus } from './week-frame';
import {
  resultCell,
  showAllResultValues,
  summaryResult,
} from './summary-result';

const region = (page: Page) =>
  page.getByRole('region', { name: 'Table Adjustments', exact: true });
const button = (scope: Locator, name: string) =>
  scope.getByRole('button', { name, exact: true });
async function openSummary(page: Page) {
  await page
    .getByRole('button', { name: 'Review & confirm', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Review the week', exact: true }),
  ).toBeVisible();
}
async function start(page: Page, kind: string) {
  await region(page)
    .getByRole('group', { name: 'New Table Adjustment', exact: true })
    .getByRole('button', { name: kind, exact: true })
    .click();
  return region(page).locator('form').last();
}
async function save(page: Page, peer: Page, form: Locator, reason: string) {
  await form.getByRole('textbox', { name: 'Reason', exact: true }).fill(reason);
  await button(form, 'Save adjustment').click();
  await expect(
    region(peer)
      .getByRole('textbox', { name: 'Reason', exact: true })
      .filter({ visible: true })
      .last(),
  ).toHaveValue(reason);
  await expect(saveStatus(page)).toHaveText('Changes saved.');
}
async function choose(form: Locator, field: string, value: string) {
  await form
    .getByRole('group', { name: field, exact: true })
    .getByRole('button', { name: value, exact: true })
    .click();
}
const sectionLabels = [
  '1 Upkeep',
  '2 Activity',
  '3 Event',
  '4 Persistent',
  'Table Adjustments',
  'Result',
];
/** Four expanded phase sections, then Table Adjustments and Result, in order. */
async function expectSixSections(page: Page) {
  for (const name of sectionLabels) {
    const section = page.getByRole('region', { name, exact: true });
    await expect(section).toBeVisible();
    // Expanded: no collapsed disclosure hides a consequence.
    await expect(section.locator('details')).toHaveCount(0);
  }
  const order = await page
    .locator('section[aria-label]')
    .evaluateAll((sections) =>
      sections.map((section) => section.getAttribute('aria-label')),
    );
  expect(order.filter((label) => sectionLabels.includes(label!))).toEqual(
    sectionLabels,
  );
}

// Show all values lists every militia, roster, officer and next-week fact
// beside the changed ones.
async function openOutcomes(page: Page) {
  await showAllResultValues(page);
  const result = summaryResult(page);
  await expect(result).toContainText('Next week');
  await expect(result).toContainText('Roster');
  await expect(result).toContainText('Officers');
}

/** Real controls, all outcome disclosures, and responsive layout on the owned persistent fixture. */
export async function reviewSummaryWorkspace(
  page: Page,
  peer: Page,
  artifactDirectory: string,
) {
  await Promise.all([openSummary(page), openSummary(peer)]);
  await expectSixSections(page);
  // The carried event's consequence belongs to Persistent, not Event.
  await expect(
    page.getByRole('region', { name: '4 Persistent', exact: true }),
  ).toContainText('Theft · Event 1');
  await expect(
    page.getByRole('region', { name: '3 Event', exact: true }),
  ).not.toContainText('Theft · Event 1');
  const baseline = await summaryResult(page).innerText();
  let form = await start(page, 'Militia value');
  await expect(button(form, 'Treasury (copper)')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await button(form, 'Save adjustment').click();
  await expect(form.getByRole('alert')).not.toHaveCount(0);
  await expect(region(peer).locator('article')).toHaveCount(0);
  await choose(form, 'Operation', 'Set');
  await form.getByRole('textbox', { name: 'Value', exact: true }).fill('50000');
  await save(
    page,
    peer,
    form,
    'The table sets the treasury after the rules calculation.',
  );
  form = await start(page, 'Militia value');
  await form.getByRole('textbox', { name: 'Value', exact: true }).fill('-7');
  await save(page, peer, form, 'Seven copper paid for local supplies.');
  // Order matters: set 500 gp then −0.07 gp, or −0.07 gp then set 500 gp.
  await expect(await resultCell(page, 'Treasury', 'Final')).toHaveText(
    '499.93 gp',
  );
  await button(region(page), 'Move adjustment 2 earlier').click();
  await expect(await resultCell(peer, 'Treasury', 'Final')).toHaveText(
    '500 gp',
  );
  await button(region(page), 'Move adjustment 1 later').click();
  await expect(await resultCell(peer, 'Treasury', 'Final')).toHaveText(
    '499.93 gp',
  );
  form = await start(page, 'Team condition');
  await choose(form, 'Team', 'Scouts');
  await choose(form, 'Status', 'Disabled');
  await save(page, peer, form, 'Scouts rest after a narrative encounter.');
  form = await start(page, 'End persistent event');
  await choose(form, 'Event', 'Theft · Event 1');
  await save(page, peer, form, 'The thieves have left the region.');
  await expect(region(peer).locator('article')).toHaveCount(4);
  await openOutcomes(page);
  const final = summaryResult(page);
  await expect(await resultCell(page, 'Scouts', 'Final', 'Teams')).toHaveText(
    'Disabled',
  );
  await expect(final).not.toContainText('theft-old');
  await expect(final).not.toContainText('persistent-team-');
  for (const [name, width, height] of [
    ['tablet', 1194, 834],
    ['phone', 390, 844],
    ['desktop', 1440, 900],
  ] as const) {
    await page.setViewportSize({ width, height });
    await expectNoHorizontalOverflow(page);
    for (const control of await page.locator('main button, main input').all()) {
      if (!(await control.isVisible())) continue;
      const bounds = await control.boundingBox();
      const label =
        (await control.getAttribute('aria-label')) ??
        (await control.textContent());
      expect(bounds, `${name}: ${label}`).not.toBeNull();
      expect(bounds!.x, `${name}: ${label}`).toBeGreaterThanOrEqual(0);
      expect(
        bounds!.x + bounds!.width,
        `${name}: ${label}`,
      ).toBeLessThanOrEqual(width);
      if (await control.evaluate((element) => element.tagName === 'BUTTON'))
        expect(
          await control.evaluate(
            (element) => element.scrollWidth <= element.clientWidth,
          ),
          `${name}: ${label} text fits`,
        ).toBe(true);
    }
    const splitWords = await region(page)
      .locator('button')
      .evaluateAll((buttons) => {
        const split: string[] = [];
        for (const button of buttons) {
          const group = button
            .closest('[role="group"]')
            ?.getAttribute('aria-label');
          if (
            group &&
            !['Field', 'Operation', 'Status', 'New Table Adjustment'].includes(
              group,
            )
          )
            continue;
          const walker = document.createTreeWalker(
            button,
            NodeFilter.SHOW_TEXT,
          );
          let node = walker.nextNode();
          while (node) {
            for (const match of (node.textContent ?? '').matchAll(/\S+/g)) {
              const range = document.createRange();
              range.setStart(node, match.index);
              range.setEnd(node, match.index + match[0].length);
              if (range.getClientRects().length > 1) split.push(match[0]);
            }
            node = walker.nextNode();
          }
        }
        return split;
      });
    expect(
      splitWords,
      `${name}: adjustment cards keep individual words readable`,
    ).toEqual([]);
    await expect(region(page)).not.toContainText('TreasuryCopper');
    await savePrivate(
      join(artifactDirectory, `reviewer-summary-${name}.png`),
      await page.screenshot({ fullPage: true }),
    );
  }
  for (let count = 4; count > 0; count--) {
    await button(
      region(page).locator('article').last(),
      'Clear adjustment',
    ).click();
    await expect(region(peer).locator('article')).toHaveCount(count - 1);
  }
  await expect(saveStatus(page)).toHaveText('Changes saved.');
  // Compare the displayed pre-adjustment Result with the restored one, back
  // on the default changed-only presentation.
  await showAllResultValues(page, false);
  await expect(final).toHaveText(baseline, { useInnerText: true });
  await page.setViewportSize({ width: 1194, height: 834 });
}

/** Settlement variant uses the owned fixture that actually contains settlements. */
export async function reviewSummarySettlement(page: Page, peer: Page) {
  await Promise.all([openSummary(page), openSummary(peer)]);
  const count = await region(page).locator('article').count();
  const form = await start(page, 'Settlement reputation');
  await choose(form, 'Settlement', 'Phaendar');
  await choose(form, 'Reputation', 'Friendly');
  await save(
    page,
    peer,
    form,
    'The settlement welcomed the militia after a table ruling.',
  );
  const final = await resultCell(peer, 'Phaendar', 'Final', 'Settlements');
  await expect(final).toHaveText('Friendly');
  await button(
    region(page).locator('article').last(),
    'Clear adjustment',
  ).click();
  await expect(region(peer).locator('article')).toHaveCount(count);
  await expect(final).not.toHaveText('Friendly');
}
