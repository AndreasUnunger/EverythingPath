import { test, expect } from './support/fixtures';
import { openCampaignSection } from './support/interactions';

test.use({ caseKey: 'realtimeActionSlot' });
test('players share a Staged Action Choice', async ({ players }) => {
  for (const page of [players.gm, players.player]) {
    await page.goto('/campaigns');
    await openCampaignSection(page, 'week');
    await page.getByRole('button', { name: 'Activity', exact: true }).click();
  }
  const slot = (page: typeof players.gm) =>
    page.getByRole('group', { name: 'Action Slot 1', exact: true });
  await slot(players.player)
    .getByRole('button', {
      name: 'Choose an action for Action Slot 1',
      exact: true,
    })
    .tap();
  await players.player
    .getByRole('dialog')
    .getByRole('button', { name: 'Earn Gold', exact: true })
    .tap();
  await expect(slot(players.gm)).toContainText('Earn Gold');
  await players.player.reload();
  await players.player
    .getByRole('button', { name: 'Activity', exact: true })
    .click();
  await expect(slot(players.player)).toContainText('Earn Gold');
});
