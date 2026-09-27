import { expect, type Locator, type Page } from '@playwright/test';

export async function select(
  page: Page,
  within: Locator,
  label: string,
  option: string,
) {
  await within.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

export async function selectCampaign(page: Page, name: string) {
  await page.getByRole('combobox', { name: 'Active campaign' }).click();
  await page.getByRole('option', { name, exact: true }).click();
  await expect(
    page.getByRole('combobox', { name: 'Active campaign' }),
  ).toContainText(name);
}

// Three places offer a campaign's screens, and each is chosen only where it
// is the sole owner of that destination:
// - Campaign pages: the one visible "Campaign sections" navigation (top bar
//   or phone bottom bar) for week, history, militia and characters. Setup is
//   not a section item there; its link sits in page content (the campaign
//   home card or an empty state).
// - The campaign directory (`/campaigns`, before any campaign page): no
//   shell sections exist, so the selected campaign's entry card navigation
//   ("<name> screens") is the only owner of every destination, setup included.
// - The Week reference panel repeats militia/characters/history links; those
//   are exercised by the reference helpers and never chosen here.
// Exactly one link must match in the chosen owner; duplicates fail loudly.
export async function openCampaignSection(
  page: Page,
  section: 'week' | 'history' | 'militia' | 'characters' | 'setup',
) {
  const shell = page
    .getByRole('navigation', { name: 'Campaign sections', exact: true })
    .locator('visible=true');
  const entry = page
    .getByRole('navigation', { name: / screens$/ })
    .locator('visible=true');
  await expect
    .poll(async () => (await shell.count()) + (await entry.count()), {
      message: 'a campaign page or the campaign directory is shown',
    })
    .toBeGreaterThan(0);
  const href = `a[href$="/${section}"], a[href*="/${section}?"]`;
  const link =
    (await shell.count()) > 0
      ? section === 'setup'
        ? page.locator('main').locator('a[href$="/setup"]:visible')
        : shell.locator(href)
      : entry.locator(href);
  await expect(link).toHaveCount(1);
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(
    new RegExp(`/campaigns/[^/]+/${section}(?:\\?|$)`),
  );
}

export function actionSlot(page: Page, number: number) {
  return page.getByRole('group', {
    name: `Activity Slot ${number}`,
    exact: true,
  });
}

export async function visiblePlace(
  page: Page,
  action: string,
  slot: number,
  input: 'keyboard' | 'tap' = 'keyboard',
) {
  const card = page.getByRole('group', {
    name: `Action Choice: ${action}`,
    exact: true,
  });
  const button = card.getByRole('button', {
    name: `Stage ${action} in Activity Slot ${slot}`,
    exact: true,
  });
  if (input === 'tap') await button.tap();
  else {
    await button.focus();
    await button.press('Enter');
  }
  await expect(actionSlot(page, slot)).toContainText(action);
}

export async function expectSharedState(
  observers: { player: string; state: Locator }[],
  expected: string | RegExp,
  domainObject: string,
) {
  await Promise.all(
    observers.map(async ({ player, state }) => {
      await expect(
        state,
        `${player}: ${domainObject} should show ${String(expected)}`,
      ).toHaveText(expected);
    }),
  );
}
