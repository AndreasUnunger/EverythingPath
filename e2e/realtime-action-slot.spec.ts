import { test, expect } from './support/fixtures';
import { openCampaignSection, pointerPlace } from './support/interactions';

test.use({ caseKey: 'realtimeActionSlot' });
test('players share a Staged Action Choice', async ({ players }) => {
  for (const page of [players.gm, players.player]) {
    await page.goto('/campaigns');
    await openCampaignSection(page, 'week');
    await page.getByRole('button', { name: 'Activity', exact: true }).click();
  }
  const card = players.player.getByRole('button', {
    name: 'Choose Earn Gold',
    exact: true,
  });
  const slot = players.player.locator('[aria-label="Action Slot 1"]');
  await pointerPlace(players.player, card, slot);
  await expect(
    players.gm.locator('[aria-label="Action Slot 1"]'),
  ).toContainText('Earn Gold');
  await players.player.reload();
  await players.player
    .getByRole('button', { name: 'Activity', exact: true })
    .click();
  await expect(
    players.player.locator('[aria-label="Action Slot 1"]'),
  ).toContainText('Earn Gold');
});
