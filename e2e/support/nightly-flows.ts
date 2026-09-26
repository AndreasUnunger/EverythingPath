import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { openCampaignSection, selectCampaign } from './interactions';
import { expectReachable } from './responsive-shell';

// Both axes plus a trial click: modal controls may overlay the phone bar,
// non-modal ones must sit above it.
const fitsViewport = expectReachable;

export async function navigationAndPersistence(
  page: Page,
  campaignName: string,
) {
  await test.step('player: navigation, form layout, reload persistence and cross-layout edits', async () => {
    await openCampaignSection(page, 'characters');
    const ledger = page.getByRole('region', {
      name: 'Character Ledger',
      exact: true,
    });
    const open = ledger.getByRole('button', { name: 'Open', exact: true });
    await fitsViewport(page, open);
    await open.click();
    const add = ledger.getByRole('button', {
      name: 'Add Character',
      exact: true,
    });
    // Non-modal page control: reachable above the phone bottom bar.
    await fitsViewport(page, add);
    await add.click();
    const dialog = page.getByRole('dialog', { name: 'New Character' });
    const name = dialog.getByRole('textbox', { name: 'Name', exact: true });
    const level = dialog.getByRole('textbox', { name: 'Level', exact: true });
    const save = dialog.getByRole('button', { name: 'Save', exact: true });
    for (const control of [name, level, save])
      await fitsViewport(page, control);
    await name.fill('Nightly Scout');
    await level.fill('4');
    await save.click();
    await expect(dialog).toBeHidden();
    const row = ledger
      .getByRole('row')
      .filter({ has: page.getByText('Nightly Scout', { exact: true }) });
    await expect(
      row,
      'player: newly saved Nightly Scout appears',
    ).toContainText('4');
    await page.reload();
    await selectCampaign(page, campaignName);
    await openCampaignSection(page, 'characters');
    await open.click();
    await expect(
      row,
      'player: Nightly Scout level 4 survives reload',
    ).toContainText('4');
    const original = page.viewportSize()!;
    await page.setViewportSize(
      original.width === 390
        ? { width: 1194, height: 834 }
        : { width: 390, height: 844 },
    );
    await row.getByRole('button', { name: 'Edit', exact: true }).click();
    const edit = page.getByRole('dialog', { name: 'Edit Character' });
    await fitsViewport(
      page,
      edit.getByRole('textbox', { name: 'Level', exact: true }),
    );
    await edit.getByRole('textbox', { name: 'Level', exact: true }).fill('5');
    await edit.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(edit).toBeHidden();
    await page.setViewportSize(original);
    await page.reload();
    await selectCampaign(page, campaignName);
    await openCampaignSection(page, 'characters');
    await open.click();
    await expect(
      row,
      'player: cross-layout edit persists as level 5',
    ).toContainText('5');
    await openCampaignSection(page, 'week');
    await expect(
      page.getByRole('heading', { name: 'Week 1 · Upkeep', exact: true }),
    ).toBeVisible();
  });
}
