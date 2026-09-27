import { openCampaignSection } from './support/interactions';
import { test, expect } from './support/fixtures';

test.use({ caseKey: 'characterLedger' });
test('players share character and officer assignment changes', async ({
  players,
}) => {
  for (const page of [players.gm, players.player]) {
    await page.goto('/campaigns');
    await openCampaignSection(page, 'week');
    await expect(
      page.getByRole('heading', { name: 'Week 1 · Upkeep' }),
    ).toBeVisible();
    await openCampaignSection(page, 'characters');
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
  await openCampaignSection(player, 'militia');
  await player.getByRole('button', { name: /^People & officers/ }).click();
  await player
    .getByRole('button', { name: 'Correct people & officers', exact: true })
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
  await openCampaignSection(players.gm, 'militia');
  await players.gm.reload();
  await expect(players.gm).toHaveURL(/\/campaigns\/[^/]+\/militia$/);
  await players.gm.getByRole('button', { name: /^People & officers/ }).click();
  await expect(
    players.gm.getByRole('listitem').filter({
      has: players.gm.getByRole('heading', { name: 'Nara', exact: true }),
    }),
  ).toContainText('Marshal');
  await players.gm
    .getByRole('button', { name: 'Correct people & officers', exact: true })
    .click();
  await expect(
    players.gm.getByRole('button', { name: 'marshal', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});
