import { expect, type Page } from '@playwright/test';
import { test } from './support/fixtures';

// Private Characters (#260): the owner creates one outside every campaign,
// edits it, and deletes it behind a question. Everyone else, member of the
// same organization or not, meets the same failure at its URL as at a URL
// that names no Character. Every expectation is what each browser shows; the
// server's authorization behind it is proven by the public Convex tests.

const tablet = { width: 1024, height: 768 };
const name = 'E2E private character';
const failure = 'The character sheet could not be loaded.';

function findScores(page: Page) {
  return page.getByRole('region', { name: 'Ability scores', exact: true });
}
function findScore(page: Page, label: string) {
  return findScores(page).getByRole('textbox', { name: label, exact: true });
}
function findDeleteQuestion(page: Page) {
  return page.getByRole('group', { name: `Delete ${name}?`, exact: true });
}
async function expectNoSheet(page: Page) {
  await expect(page.getByRole('alert')).toContainText(failure);
  await expect(page.getByText(name)).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Strength' })).toHaveCount(0);
  await expect(
    page
      .getByRole('main')
      .getByRole('link', { name: 'Characters', exact: true }),
  ).toBeVisible();
}

test.use({ caseKey: 'privateCharacter', viewport: tablet });
test('an owner creates, edits and deletes a private Character; its URL discloses nothing to anyone else', async ({
  players,
}) => {
  test.setTimeout(180_000);
  const owner = players.gm;

  await test.step('creation opens the new sheet outside every campaign', async () => {
    await owner.goto('/characters/new');
    await owner.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
    await owner
      .getByRole('button', { name: 'Create character', exact: true })
      .click();
    await expect(owner).toHaveURL(/\/characters\/[^/]+$/);
    await expect(owner.getByRole('heading', { level: 1, name })).toBeVisible();
    await expect(owner.getByText(name)).toHaveCount(1);
    await expect(owner.getByText('No campaign', { exact: true })).toBeVisible();
    await expect(
      owner
        .getByRole('main')
        .getByRole('link', { name: 'Characters', exact: true }),
    ).toBeVisible();
    await expect(
      owner.getByRole('button', {
        name: /Archive character|Restore character/,
      }),
    ).toHaveCount(0);
    await expect(
      owner
        .getByRole('navigation', { name: 'Sections', exact: true })
        .getByRole('link', { name: 'Characters', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(
      owner.getByRole('navigation', { name: 'Militia pages', exact: true }),
    ).toHaveCount(0);
  });
  const url = new URL(owner.url()).pathname;

  await test.step('edits save with no campaign and survive a reload', async () => {
    await findScore(owner, 'Strength').fill('14');
    await findScores(owner)
      .getByRole('button', { name: 'Save scores', exact: true })
      .click();
    await expect(
      findScores(owner)
        .getByRole('status')
        .filter({ hasText: 'Scores saved.' }),
    ).toBeVisible();
    await owner.reload();
    await expect(findScore(owner, 'Strength')).toHaveValue('14');
  });

  await test.step('another member and an outsider see what a missing Character shows', async () => {
    for (const other of [players.player, players.outsider]) {
      await other.goto(url);
      await expectNoSheet(other);
      await other.goto('/characters/not-a-character');
      await expectNoSheet(other);
    }
  });

  await test.step('deleting asks first; Keep and Escape write nothing', async () => {
    const trigger = owner.getByRole('button', {
      name: 'Delete character',
      exact: true,
    });
    await trigger.click();
    await expect(
      findDeleteQuestion(owner).getByRole('button', {
        name: `Keep ${name}`,
        exact: true,
      }),
    ).toBeFocused();
    await owner.keyboard.press('Escape');
    await expect(findDeleteQuestion(owner)).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await owner.keyboard.press('Enter');
    await owner.keyboard.press('Enter');
    await expect(findDeleteQuestion(owner)).toHaveCount(0);
    await expect(owner.getByRole('heading', { level: 1, name })).toBeVisible();
    await expect(findScore(owner, 'Strength')).toHaveValue('14');
  });

  await test.step('a confirmed deletion returns to the origin and the URL is gone', async () => {
    await owner
      .getByRole('button', { name: 'Delete character', exact: true })
      .click();
    await findDeleteQuestion(owner)
      .getByRole('button', { name: `Delete ${name}`, exact: true })
      .click();
    await expect(owner).toHaveURL(/\/characters$/);
    await owner.goto(url);
    await expectNoSheet(owner);
  });
});
