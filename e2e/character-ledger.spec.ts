import type { Locator, Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { select, selectCampaign } from './support/interactions';

test.use({ caseKey: 'characterLedger' });

async function openCampaignLedger(page: Page, campaignName: string) {
  await page.goto('/campaigns');
  await selectCampaign(page, campaignName);
  return await openCharacterLedger(page);
}

async function openCharacterLedger(page: Page) {
  await page.getByRole('tab', { name: 'LEDGER', exact: true }).click();
  const ledger = page.getByRole('region', {
    name: 'Character Ledger',
    exact: true,
  });
  await expect(ledger).toBeVisible();
  const open = ledger.getByRole('button', { name: 'Open', exact: true });
  if (await open.count()) await open.click();
  return ledger;
}

async function reloadCampaignLedger(page: Page, campaignName: string) {
  await page.reload();
  await selectCampaign(page, campaignName);
  return await openCharacterLedger(page);
}

async function createCharacter(
  page: Page,
  ledger: Locator,
  name: string,
  role: string,
) {
  await ledger.getByRole('button', { name: 'Add Character' }).click();
  const dialog = page.getByRole('dialog', { name: 'New Character' });
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
  await select(page, dialog, 'Officer role', role);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();
}

function characterRow(ledger: Locator, page: Page, name: string) {
  return ledger
    .getByRole('row')
    .filter({ has: page.getByText(name, { exact: true }) });
}

async function expectRole(ledger: Locator, role: string, character: string) {
  await expect(
    ledger.getByRole('group', { name: `Officer role: ${role}`, exact: true }),
  ).toContainText(character);
}

test('players share character and officer assignment changes', async ({
  players,
  ownedCase,
}) => {
  const [gmLedger, playerLedger] = await Promise.all([
    openCampaignLedger(players.gm, ownedCase.campaignName),
    openCampaignLedger(players.player, ownedCase.campaignName),
  ]);

  await createCharacter(players.gm, gmLedger, 'Rowan Vale', 'Marshal');
  await expect(
    characterRow(playerLedger, players.player, 'Rowan Vale'),
  ).toContainText('Marshal');
  await expectRole(playerLedger, 'Marshal', 'Rowan Vale');

  await createCharacter(players.gm, gmLedger, 'Sable Reed', 'Strategist');
  await expect(
    characterRow(playerLedger, players.player, 'Sable Reed'),
  ).toContainText('Strategist');
  await expectRole(playerLedger, 'Strategist', 'Sable Reed');

  await characterRow(playerLedger, players.player, 'Sable Reed')
    .getByRole('button', { name: 'Edit', exact: true })
    .click();
  const edit = players.player.getByRole('dialog', { name: 'Edit Character' });
  await select(players.player, edit, 'Officer role', 'Marshal');
  await edit.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(edit).toBeHidden();

  await expectRole(gmLedger, 'Marshal', 'Sable Reed');
  await expectRole(gmLedger, 'Strategist', 'Unassigned');
  await expect(characterRow(gmLedger, players.gm, 'Rowan Vale')).toContainText(
    'Open',
  );
  await expect(characterRow(gmLedger, players.gm, 'Sable Reed')).toContainText(
    'Marshal',
  );

  await gmLedger
    .getByRole('group', { name: 'Officer role: Marshal', exact: true })
    .getByRole('button', { name: 'Unassign', exact: true })
    .click();
  for (const [page, ledger] of [
    [players.gm, gmLedger],
    [players.player, playerLedger],
  ] as const) {
    await expectRole(ledger, 'Marshal', 'Unassigned');
    await expect(characterRow(ledger, page, 'Rowan Vale')).toContainText(
      'Open',
    );
    await expect(characterRow(ledger, page, 'Sable Reed')).toContainText(
      'Open',
    );
  }

  const [reloadedGmLedger, reloadedPlayerLedger] = await Promise.all([
    reloadCampaignLedger(players.gm, ownedCase.campaignName),
    reloadCampaignLedger(players.player, ownedCase.campaignName),
  ]);
  for (const [page, ledger] of [
    [players.gm, reloadedGmLedger],
    [players.player, reloadedPlayerLedger],
  ] as const) {
    await expectRole(ledger, 'Marshal', 'Unassigned');
    await expectRole(ledger, 'Strategist', 'Unassigned');
    await expect(characterRow(ledger, page, 'Rowan Vale')).toContainText(
      'Open',
    );
    await expect(characterRow(ledger, page, 'Sable Reed')).toContainText(
      'Open',
    );
  }
});
