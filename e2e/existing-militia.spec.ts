import type { Locator, Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { select, selectCampaign } from './support/interactions';

test.use({ caseKey: 'existingMilitia', comparisonCaseKey: 'isolation' });

async function openLedger(page: Page, title: string) {
  const ledger = page.getByRole('region', { name: title, exact: true });
  await expect(ledger).toBeVisible();
  const open = ledger.getByRole('button', { name: 'Open', exact: true });
  if (await open.count()) await open.click();
  return ledger;
}

async function chooseCampaign(page: Page, name: string) {
  await selectCampaign(page, name);
  await page.getByRole('tab', { name: 'LEDGER', exact: true }).click();
}

async function saveDialog(dialog: Locator) {
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();
}

const managerWarning =
  'Warning: Managing 2 teams exceeds the normal limit of 1.';
const overrideNote =
  'GM exception: Orin manages both teams during the evacuation.';

async function expectExistingState(page: Page) {
  await openLedger(page, 'Militia State');
  const core = page.getByRole('region', { name: 'Militia Core', exact: true });
  for (const [label, value] of [
    ['Militia name', 'Chernasardo Veterans'],
    ['HQ location', 'Misthome'],
    ['Rank', '4'],
    ['Highest boon reached', '4'],
    ['Training', '24'],
    ['Treasury', '725'],
    ['Notoriety', '17'],
  ]) {
    await expect(
      core.getByRole('textbox', { name: label, exact: true }),
    ).toHaveValue(value!);
  }
  await expect(
    core.getByRole('combobox', { name: 'Focus', exact: true }),
  ).toHaveText('Secrecy');
  const week = page.getByRole('region', { name: 'Week Context', exact: true });
  await expect(
    week.getByRole('textbox', { name: 'Week number', exact: true }),
  ).toHaveValue('8');
  await expect(
    week.getByRole('combobox', { name: 'Current phase' }),
  ).toHaveText('Event');
  await expect(
    week.getByRole('textbox', { name: 'Uneventful bonus carry' }),
  ).toHaveValue('2');
  await expect(
    week.getByRole('combobox', { name: 'First week', exact: true }),
  ).toHaveText('No');
  await expect(
    week.getByRole('combobox', { name: 'Skipped upkeep this week' }),
  ).toHaveText('No');
  await expect(
    week.getByRole('textbox', { name: 'Last persistent buyoff week' }),
  ).toHaveValue('7');
  const queued = page.getByRole('region', {
    name: 'Queued Effects',
    exact: true,
  });
  await expect(queued).toContainText('Week Of Serenity Checks Bonus');
  await expect(queued).toContainText('Week 9');
  await expect(queued).toContainText('Aid promised by the forest spirits.');
  const events = page.getByRole('region', { name: 'Event State', exact: true });
  await expect(events).toContainText('Sickness');
  await expect(events).toContainText('Persistent');
  await expect(events).toContainText('Open');
  await expect(events).toContainText('Week 8 • Started 6');
  await expect(events).toContainText('Mitigation until: 9');

  const teams = await openLedger(page, 'Team Ledger');
  for (const [name, status] of [
    ['Moles', 'Active'],
    ['Informants', 'Disabled'],
    ['Defenders', 'Missing'],
  ]) {
    const row = teams
      .getByRole('row')
      .filter({ has: page.getByText(name!, { exact: true }) });
    await expect(row.getByText(status!, { exact: true })).toBeVisible();
    if (name !== 'Defenders') {
      await expect(row).toContainText('Orin • Other NPC • CHA 10');
      await expect(row).toContainText(managerWarning);
      await expect(row).toContainText(overrideNote);
    }
    if (name === 'Informants')
      await expect(row).toContainText('Unavailable until week: 9');
  }
  const settlements = await openLedger(page, 'Settlement Ledger');
  const settlement = settlements
    .getByRole('row')
    .filter({ has: page.getByText('Misthome', { exact: true }) });
  await expect(settlement).toContainText('Friendly');
  await expect(settlement.getByText('Secured', { exact: true })).toBeVisible();
  const characters = await openLedger(page, 'Character Ledger');
  const marshal = characters.getByRole('group', {
    name: 'Officer role: Marshal',
    exact: true,
  });
  await expect(marshal).toContainText('Nara');
  const officer = characters
    .getByRole('row')
    .filter({ has: page.getByText('Nara', { exact: true }) });
  await expect(officer).toContainText('Marshal');
  await expect(officer).toContainText('CHA 16');
}

test('existing militia state survives reload within its campaign', async ({
  page,
  ownedCase,
  comparisonCase,
}) => {
  // WebKit pointer clicks take about one second each; this full setup and
  // reload journey has over fifty before its final ledger assertions.
  test.setTimeout(120_000);
  if (!comparisonCase)
    throw new Error('This journey requires a comparison campaign');
  await page.goto('/campaigns');
  await chooseCampaign(page, ownedCase.campaignName);
  await openLedger(page, 'Militia State');
  await page
    .getByRole('button', { name: 'Initialize Militia', exact: true })
    .click();
  const initialize = page.getByRole('dialog', {
    name: 'Initialize Militia',
    exact: true,
  });
  await initialize
    .getByRole('textbox', { name: 'Militia name', exact: true })
    .fill('Chernasardo Veterans');
  await initialize
    .getByRole('textbox', { name: 'HQ location', exact: true })
    .fill('Misthome');
  const rank = initialize.getByRole('textbox', { name: 'Rank', exact: true });
  await rank.fill('');
  await initialize.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(rank).toHaveAttribute('aria-invalid', 'true');
  await expect(rank).toHaveAccessibleDescription('Rank is required');
  await expect(
    initialize.getByText('Rank is required', { exact: true }),
  ).toBeVisible();
  await rank.fill('four');
  await initialize.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(rank).toHaveAccessibleDescription('Rank must be a whole number');
  await expect(
    initialize.getByText('Rank must be a whole number', { exact: true }),
  ).toBeVisible();
  await expect(initialize).toBeVisible();
  for (const [label, value] of [
    ['Rank', '4'],
    ['Highest boon reached', '4'],
    ['Training', '24'],
    ['Treasury', '725'],
    ['Notoriety', '17'],
  ]) {
    await initialize
      .getByRole('textbox', { name: label, exact: true })
      .fill(value!);
  }
  await select(page, initialize, 'Focus', 'Secrecy');
  await saveDialog(initialize);

  const week = page.getByRole('region', { name: 'Week Context', exact: true });
  await week
    .getByRole('textbox', { name: 'Week number', exact: true })
    .fill('8');
  await select(page, week, 'Current phase', 'Event');
  await select(page, week, 'First week', 'No');
  await select(page, week, 'Skipped upkeep this week', 'No');
  await week.getByRole('textbox', { name: 'Uneventful bonus carry' }).fill('2');
  await week
    .getByRole('textbox', { name: 'Last persistent buyoff week' })
    .fill('7');
  await week.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    week.getByRole('button', { name: 'Save', exact: true }),
  ).toBeEnabled();

  await page
    .getByRole('button', { name: 'Add Queued Effect', exact: true })
    .click();
  const queue = page.getByRole('dialog', {
    name: 'Add Queued Effect',
    exact: true,
  });
  await select(page, queue, 'Queued effect', 'Week Of Serenity Checks Bonus');
  await queue.getByRole('textbox', { name: 'Applies week' }).fill('9');
  await queue
    .getByRole('textbox', { name: 'Note', exact: true })
    .fill('Aid promised by the forest spirits.');
  await saveDialog(queue);

  await page
    .getByRole('button', { name: 'Add Event State', exact: true })
    .click();
  const event = page.getByRole('dialog', {
    name: 'Add Event State',
    exact: true,
  });
  await event
    .getByRole('textbox', { name: 'Week number', exact: true })
    .fill('8');
  await select(page, event, 'Event type', 'Sickness');
  await select(page, event, 'Persistent', 'Yes');
  await select(page, event, 'Resolved', 'No');
  await event.getByRole('textbox', { name: 'Started week' }).fill('6');
  await event.getByRole('textbox', { name: 'Mitigation until week' }).fill('9');
  await saveDialog(event);

  await openLedger(page, 'Character Ledger');
  await page
    .getByRole('button', { name: 'Add Character', exact: true })
    .click();
  const character = page.getByRole('dialog', {
    name: 'New Character',
    exact: true,
  });
  await character
    .getByRole('textbox', { name: 'Name', exact: true })
    .fill('Nara');
  await character
    .getByRole('textbox', { name: 'Level', exact: true })
    .fill('6');
  await character.getByRole('textbox', { name: 'CHA', exact: true }).fill('16');
  await select(page, character, 'Officer role', 'Marshal');
  await saveDialog(character);

  const teams = await openLedger(page, 'Team Ledger');
  for (const [name, status] of [
    ['Moles', 'Active'],
    ['Informants', 'Disabled'],
    ['Defenders', 'Missing'],
  ]) {
    await teams.getByRole('button', { name: 'Add Team', exact: true }).click();
    const team = page.getByRole('dialog', { name: 'Add Team', exact: true });
    await select(page, team, 'Team', name!);
    await select(page, team, 'Status', status!);
    if (name === 'Informants')
      await team
        .getByRole('textbox', { name: 'Unavailable until week' })
        .fill('9');
    if (name !== 'Defenders') {
      await select(page, team, 'Manager source', 'Freeform manager');
      await team.getByRole('textbox', { name: 'Manager name' }).fill('Orin');
      await select(page, team, 'Manager type', 'Other NPC');
      await team.getByRole('textbox', { name: 'Manager Charisma' }).fill('10');
      await team
        .getByRole('textbox', { name: 'Notes', exact: true })
        .fill(overrideNote);
    }
    await saveDialog(team);
  }
  // A rules mismatch is retained with its explanation, unlike the structural error above.
  await expect(teams.getByText(managerWarning, { exact: true })).toHaveCount(2);

  await openLedger(page, 'Settlement Ledger');
  await page
    .getByRole('button', { name: 'Add Settlement', exact: true })
    .click();
  const settlement = page.getByRole('dialog', {
    name: 'Add Settlement',
    exact: true,
  });
  await settlement
    .getByRole('textbox', { name: 'Settlement name' })
    .fill('Misthome');
  await select(page, settlement, 'Reputation', 'Friendly');
  await select(page, settlement, 'Secured', 'Yes');
  await saveDialog(settlement);

  await expectExistingState(page);
  await page.reload();
  await chooseCampaign(page, ownedCase.campaignName);
  await expectExistingState(page);

  await chooseCampaign(page, comparisonCase.campaignName);
  await openLedger(page, 'Militia State');
  const core = page.getByRole('region', { name: 'Militia Core', exact: true });
  await expect(
    core.getByRole('textbox', { name: 'Militia name', exact: true }),
  ).toHaveValue('E2E isolation-militia');
  await expect(
    core.getByRole('textbox', { name: 'Treasury', exact: true }),
  ).toHaveValue('100');
  await expect(
    core.getByRole('textbox', { name: 'Rank', exact: true }),
  ).toHaveValue('1');
  await expect(
    core.getByRole('textbox', { name: 'Training', exact: true }),
  ).toHaveValue('0');
  await expect(
    core.getByRole('textbox', { name: 'Notoriety', exact: true }),
  ).toHaveValue('0');
  await expect(
    core.getByRole('combobox', { name: 'Focus', exact: true }),
  ).toHaveText('Loyalty');

  await expect(
    page
      .getByRole('region', { name: 'Week Context', exact: true })
      .getByRole('textbox', { name: 'Week number', exact: true }),
  ).toHaveValue('1');
  await expect(
    page.getByRole('region', { name: 'Queued Effects', exact: true }),
  ).toContainText('No queued effects recorded yet.');
  await expect(
    page.getByRole('region', { name: 'Event State', exact: true }),
  ).toContainText('No event state rows recorded yet.');
  await expect(await openLedger(page, 'Team Ledger')).toContainText(
    'No roster teams tracked yet.',
  );
  await expect(await openLedger(page, 'Settlement Ledger')).toContainText(
    'No tracked settlements yet.',
  );
  const comparisonCharacters = await openLedger(page, 'Character Ledger');
  await expect(
    comparisonCharacters.getByRole('group', {
      name: 'Officer role: Marshal',
      exact: true,
    }),
  ).toContainText('E2E isolation-officer');
  await expect(
    comparisonCharacters.getByText('Nara', { exact: true }),
  ).toHaveCount(0);

  await chooseCampaign(page, ownedCase.campaignName);
  await expectExistingState(page);
});
