import { test, expect } from './support/fixtures';

test.use({ caseKey: 'characterLedger' });
test('players share character and officer assignment changes', async ({
  players,
}) => {
  for (const page of [players.gm, players.player]) {
    await page.goto('/campaigns');
    await expect(
      page.getByRole('heading', { name: 'Week 1 · Upkeep' }),
    ).toBeVisible();
    await page.getByRole('tab', { name: 'Ledger', exact: true }).click();
    await page.getByRole('button', { name: /Character Ledger/ }).click();
  }
  const player = players.player;
  await player
    .getByRole('button', { name: 'Add Character', exact: true })
    .click();
  const dialog = player.getByRole('dialog', {
    name: 'New Character',
    exact: true,
  });
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Nara');
  await dialog.getByRole('textbox', { name: 'CHA', exact: true }).fill('16');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(
    players.gm.getByRole('row').filter({ hasText: 'Nara' }),
  ).toContainText('CHA 16');
  await player
    .getByRole('button', { name: 'Edit militia ledger', exact: true })
    .click();
  const officers = player
    .getByRole('heading', { name: 'Characters and officers', exact: true })
    .locator('..');
  await officers.getByRole('button', { name: /Nara/ }).click();
  await player.getByRole('button', { name: 'marshal', exact: true }).click();
  await player
    .getByRole('textbox', { name: 'Reason for correction', exact: true })
    .fill('Assign Nara as marshal');
  await player
    .getByRole('button', { name: 'Save correction', exact: true })
    .click();
  await expect(
    player.getByRole('button', { name: 'Save correction', exact: true }),
  ).toBeHidden();
  await players.gm.reload();
  await expect(
    players.gm.getByRole('heading', { name: 'Week 1 · Upkeep' }),
  ).toBeVisible();
  await players.gm.getByRole('tab', { name: 'Ledger', exact: true }).click();
  await players.gm
    .getByRole('button', { name: 'Edit militia ledger', exact: true })
    .click();
  await expect(
    players.gm.getByRole('button', { name: 'marshal', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});
