import { openCampaignSection } from './support/interactions';
import { test, expect } from './support/fixtures';

test.use({ caseKey: 'characterLedger' });
test('players share character and officer assignment changes', async ({
  players,
}) => {
  for (const page of [players.gm, players.player]) {
    await page.goto('/campaigns');
    await openCampaignSection(page, 'week');
    // Continue week: the first week's first unready phase is Event.
    await expect(
      page.getByRole('heading', { name: 'Week 1 · Event' }),
    ).toBeVisible();
    await openCampaignSection(page, 'characters');
  }
  const player = players.player;
  await player
    .getByRole('region', { name: 'Characters', exact: true })
    .getByRole('button', { name: 'Add character', exact: true })
    .click();
  const dialog = player.getByRole('dialog', {
    name: 'Add character',
    exact: true,
  });
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Nara');
  // A cleared Hit Dice is refused in place, never saved as zero.
  const hitDice = dialog.getByRole('textbox', {
    name: 'Hit Dice',
    exact: true,
  });
  await hitDice.fill('');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog.getByText('Hit Dice is required')).toBeVisible();
  await hitDice.fill('4');
  await dialog.getByRole('textbox', { name: 'STR', exact: true }).fill('16');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();
  const gmCharacters = players.gm.getByRole('region', {
    name: 'Characters',
    exact: true,
  });
  await expect(
    gmCharacters.getByRole('row').filter({ hasText: 'Nara' }),
  ).toContainText(/Not on roster.*Nara.*4 HD/);
  // Characters & officers links straight to the People & officers fallback.
  await player
    .getByRole('link', { name: 'People & officers', exact: true })
    .click();
  await expect(player).toHaveURL(/\/militia\?section=people$/);
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
  // The GM's Characters & officers shows the accepted role on its card and
  // row as soon as the correction is saved.
  await expect(
    players.gm
      .getByRole('region', { name: 'Officers', exact: true })
      .getByRole('region', { name: 'Marshal', exact: true }),
  ).toContainText('Nara');
  await expect(
    gmCharacters.getByRole('row').filter({ hasText: 'Nara' }),
  ).toContainText(/On roster.*Nara.*4 HD.*Marshal/);
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
