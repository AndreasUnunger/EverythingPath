import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { draftKeySchema } from '../convex/lib/canonicalStorageValidators';
import { test, expect } from './support/fixtures';
import {
  canonicalPersistenceFixtureCall,
  loadRun,
  savePrivate,
} from './support/process';
import { controlNextDraftEdit } from './support/held-mutation';

test.use({ caseKey: 'canonicalPersistence' });
test('players prepare shared Upkeep with independent navigation and save recovery', async ({
  players,
  ownedCase,
}) => {
  test.setTimeout(150_000);
  const run = await loadRun();
  const scope = draftKeySchema.parse(
    await canonicalPersistenceFixtureCall(run, 'initializeUpkeep', {
      scope: ownedCase.scope,
      draftId: randomUUID(),
    }),
  );
  const route = `/canonical-workspace?campaign=${scope.campaignId}`;
  const network = await controlNextDraftEdit(
    players.gm,
    run.fixture!.convexUrl,
  );
  const gm = players.gm,
    player = players.player;
  const die = (page: typeof gm) =>
    page.getByRole('textbox', { name: 'Attrition Loyalty die', exact: true });
  const training = (page: typeof gm) =>
    page.getByRole('textbox', { name: 'Attrition training die', exact: true });
  const saved = () =>
    expect(gm.getByRole('status')).toHaveText('Changes saved.');
  try {
    await Promise.all([
      gm.goto(route),
      player.goto(route),
      players.outsider.goto(route),
    ]);
    await expect(
      gm.getByRole('heading', { name: 'Week 4 · Upkeep', exact: true }),
    ).toBeVisible();
    await expect(
      player.getByRole('heading', { name: 'Week 4 · Upkeep', exact: true }),
    ).toBeVisible();
    await expect(
      players.outsider.getByRole('textbox', {
        name: 'Attrition Loyalty die',
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(gm.getByText('Calculated bonus')).toContainText('+3');
    await expect(gm.getByText('1d20 · DC 10')).toBeVisible();
    await die(gm).fill('10');
    await expect(die(player)).toHaveValue('10');
    await training(gm).fill('3');
    await expect(training(player)).toHaveValue('3');
    await expect(gm.getByTestId('upkeep-training')).toHaveText('11');
    await saved();
    await die(gm).pressSequentially('x');
    await expect(die(gm)).toHaveValue('10');
    await expect(
      gm.getByRole('alert').filter({ hasText: 'Use digits only.' }),
    ).toBeVisible();
    await gm.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await gm.evaluate(() => navigator.clipboard.writeText('12x'));
    await die(gm).press('ControlOrMeta+A');
    await die(gm).press('ControlOrMeta+V');
    await expect(die(gm)).toHaveValue('10');
    await die(gm).fill('0');
    await expect(die(player)).toHaveValue('0');
    await expect(
      gm.getByText('Your entered value is retained for the table.', {
        exact: false,
      }),
    ).toBeVisible();
    await die(gm).fill('');
    await die(gm).press('Tab');
    await expect(die(player)).toHaveValue('');
    await expect(
      gm.getByRole('alert').filter({ hasText: 'A value is required.' }),
    ).toBeVisible();
    await die(gm).fill('10');
    await expect(die(player)).toHaveValue('10');
    await training(gm).fill('3');
    await expect(training(player)).toHaveValue('3');
    await saved();
    await gm
      .getByRole('button', { name: 'Stage transfer', exact: true })
      .click();
    await expect(
      gm.getByRole('alert').filter({ hasText: 'An amount is required.' }),
    ).toBeVisible();
    await savePrivate(
      join(run.artifactDirectory, 'canonical-upkeep-errors-tablet.png'),
      await gm.screenshot({ fullPage: true }),
    );
    await gm
      .getByRole('textbox', { name: 'Transfer amount (copper)', exact: true })
      .fill('7');
    await gm
      .getByRole('button', { name: 'Stage transfer', exact: true })
      .click();
    await expect(player.getByTestId('upkeep-treasury')).toHaveText('5007 cp');
    await saved();
    const captured = network.hold();
    await die(gm).fill('12');
    await captured;
    await expect(gm.getByRole('status')).toHaveText('Saving changes…');
    await gm.getByRole('button', { name: 'Activity', exact: true }).tap();
    await expect(
      gm.getByRole('heading', { name: 'Week 4 · Activity', exact: true }),
    ).toBeVisible();
    await expect(
      player.getByRole('heading', { name: 'Week 4 · Upkeep', exact: true }),
    ).toBeVisible();
    await gm.getByRole('button', { name: 'Summary', exact: true }).click();
    await expect(
      gm.getByRole('button', { name: 'Confirm week', exact: true }),
    ).toBeDisabled();
    const dialog = gm.waitForEvent('dialog');
    const reload = gm.reload({ timeout: 10_000 }).catch(() => null);
    const warning = await dialog;
    expect(warning.type()).toBe('beforeunload');
    await warning.dismiss();
    await reload;
    await die(player).fill('14');
    await expect(player.getByRole('status')).toHaveText('Changes saved.');
    network.release();
    await expect(gm.getByRole('status')).toHaveText(
      'Changes could not be saved. The latest saved values are shown.',
    );
    await gm.getByRole('button', { name: 'Upkeep', exact: true }).click();
    await expect(die(gm)).toHaveValue('14');
    await die(gm).fill('16');
    await expect(die(player)).toHaveValue('16');
    await saved();
    await gm.getByRole('button', { name: 'Summary', exact: true }).click();
    await expect(
      gm.getByRole('button', { name: 'Confirm week', exact: true }),
    ).toBeEnabled();
    await gm.getByRole('button', { name: 'Upkeep', exact: true }).click();
    for (const [name, width, height] of [
      ['tablet', 1194, 834],
      ['phone', 390, 844],
      ['desktop', 1440, 900],
    ] as const) {
      await gm.setViewportSize({ width, height });
      await expect(
        gm.getByRole('heading', { name: 'Week 4 · Upkeep', exact: true }),
      ).toBeVisible();
      expect(
        await gm.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      const officer = gm.getByRole('combobox', {
        name: 'Officer',
        exact: true,
      });
      const controlBounds = await officer.boundingBox();
      const arrowBounds = await officer.locator('svg').last().boundingBox();
      expect(controlBounds).not.toBeNull();
      expect(arrowBounds).not.toBeNull();
      expect(arrowBounds!.x + arrowBounds!.width).toBeLessThanOrEqual(
        controlBounds!.x + controlBounds!.width,
      );
      if (name === 'phone') {
        await officer.tap();
        await expect(gm.getByRole('option').first()).toBeVisible();
        await gm.keyboard.press('Escape');
      }
      await savePrivate(
        join(run.artifactDirectory, `canonical-upkeep-${name}.png`),
        await gm.screenshot({ fullPage: true }),
      );
    }
    await gm.setViewportSize({ width: 1194, height: 834 });
    await player.getByRole('button', { name: 'Summary', exact: true }).click();
    await expect(
      player.getByRole('button', { name: 'Confirm week', exact: true }),
    ).toBeEnabled();
    await player
      .getByRole('button', { name: 'Confirm week', exact: true })
      .click();
    await expect(player.getByRole('heading', { name: /Week 5/ })).toBeVisible();
    await expect(gm.getByRole('heading', { name: /Week 5/ })).toBeVisible();
  } finally {
    network.release();
  }
});
