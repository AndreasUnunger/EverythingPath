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

// The campaign list/home selects a row (its address changes to the
// campaign's home); campaign pages use the top-bar campaign switcher, which
// opens the chosen campaign's home (CAMP-01). Either way the helper ends on
// that home with the campaign's row selected, unless it was already open.
export function campaignRows(page: Page) {
  return page
    .getByRole('navigation', { name: 'Campaigns', exact: true })
    .locator('visible=true');
}

export async function selectCampaign(page: Page, name: string) {
  const rows = campaignRows(page);
  const switcher = page.getByRole('combobox', { name: 'Active campaign' });
  await expect
    .poll(async () => (await rows.count()) + (await switcher.count()), {
      message: 'the campaign list or a campaign page is shown',
    })
    .toBeGreaterThan(0);
  if ((await rows.count()) > 0) {
    const row = rows.getByRole('link').filter({ hasText: name });
    await expect(row).toHaveCount(1);
    await row.click();
    await expect(row).toHaveAttribute('aria-current', 'page');
    await expect(page).toHaveURL(/\/campaigns\/[^/]+$/);
    return;
  }
  // Choosing the current campaign again changes nothing and stays here.
  if ((await switcher.textContent())?.trim() === name) return;
  await switcher.click();
  await page.getByRole('option', { name, exact: true }).click();
  // The switcher keeps showing the current campaign until the route changes,
  // so wait for the home rather than reading the switcher.
  await expect(page).toHaveURL(/\/campaigns\/[^/]+$/);
  await expectSelectedCampaign(page, name);
}

/** The list/home's selected row names this campaign. */
export async function expectSelectedCampaign(page: Page, name: string) {
  await expect(
    campaignRows(page).locator('a[aria-current="page"]'),
  ).toContainText(name);
}

// Three places offer a campaign's screens, and each is chosen only where it
// is the sole owner of that destination:
// - Campaign pages: the one visible "Campaign sections" navigation (top bar
//   or phone bottom bar) for week, history, militia and characters. Setup is
//   not a section item there; its link sits in page content (an empty state).
// - The campaign list/home (`/campaigns` and `/campaigns/<id>`): no shell
//   sections exist, so the selected campaign's home content owns every
//   destination (#189). The week is its Continue week link, which opens the
//   first unready phase; history is All finished weeks (the recent rows add
//   `?week=`); setup exists only without a militia.
// - The Week reference panel repeats militia/characters/history links; those
//   are exercised by the reference helpers and never chosen here.
// Exactly one link must match in the chosen owner; duplicates fail loudly.
export async function openCampaignSection(
  page: Page,
  section: 'week' | 'history' | 'militia' | 'characters' | 'setup',
) {
  const home = /^\/campaigns(?:\/[^/]+)?\/?$/.test(
    new URL(page.url()).pathname,
  );
  let link: Locator;
  if (home) {
    link = page
      .getByRole('main')
      .locator(
        section === 'week'
          ? 'a[href*="/week?"]:visible'
          : `a[href$="/${section}"]:visible`,
      );
  } else {
    const shell = page
      .getByRole('navigation', { name: 'Campaign sections', exact: true })
      .locator('visible=true');
    await expect(shell, 'a campaign page is shown').toHaveCount(1);
    link =
      section === 'setup'
        ? page.locator('main').locator('a[href$="/setup"]:visible')
        : shell.locator(`a[href$="/${section}"], a[href*="/${section}?"]`);
  }
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
