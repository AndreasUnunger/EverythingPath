import { join } from 'node:path';
import { z } from 'zod';
import { expect, type Page } from '@playwright/test';
import { fixtureCall, savePrivate, type Run } from './process';
import type { FixtureScope } from '../fixtures/catalog';
import { saveStatus } from './week-frame';

// Opens a guided Setup step from the step index (tablet and wider).
export async function openSetupStep(page: Page, step: string) {
  await page
    .getByRole('navigation', { name: 'Setup steps', exact: true })
    .getByRole('button', { name: step, exact: true })
    .click();
  await expect(
    page.getByRole('heading', { level: 2, name: step, exact: true }),
  ).toBeVisible();
}

// Uses the same owned campaign, auth contexts, reset and cleanup as #26/#27.
export async function exerciseMilitiaSetup(
  run: Run,
  scope: FixtureScope,
  players: { gm: Page; player: Page; outsider: Page },
) {
  for (const existing of [false, true]) {
    const { campaignId } = z.object({ campaignId: z.string() }).parse(
      await fixtureCall(run, 'resetCase', {
        ...scope,
        now: 1_700_000_000_000,
      }),
    );
    const route = `/canonical-setup?campaign=${campaignId}`;
    // Both members open Setup; each form keeps its own unfinished input.
    await Promise.all([
      players.gm.goto(route),
      players.player.goto(route),
      players.outsider.goto(route),
    ]);
    await expect(
      players.outsider.getByText("This campaign isn't available"),
    ).toBeVisible();
    await expect(players.gm).toHaveURL(
      new RegExp(`/campaigns/${campaignId}/setup$`),
    );
    const gm = players.gm;
    await players.player
      .getByRole('textbox', { name: 'Rank', exact: true })
      .fill('9');
    await expect(
      gm.getByRole('textbox', { name: 'Treasury (copper)', exact: true }),
    ).toHaveValue('1000');
    await expect(
      gm.getByRole('textbox', { name: 'Rank', exact: true }),
    ).toHaveValue('1');
    await gm
      .getByRole('group', { name: 'Focus', exact: true })
      .getByRole('button', { name: 'Security', exact: true })
      .click();
    if (existing) {
      await gm
        .getByRole('button', { name: 'Existing militia', exact: true })
        .click();
      await gm
        .getByRole('textbox', { name: 'Notoriety', exact: true })
        .fill('-1');
      // Rules warnings are advisory and shown on their step.
      await expect(gm.getByLabel('Rules warnings')).toContainText('0–100');
      await openSetupStep(gm, 'Week');
      await gm
        .getByRole('textbox', { name: 'Current week', exact: true })
        .fill('12');
      await gm
        .getByRole('textbox', { name: 'Week start day', exact: true })
        .fill('77');
      await openSetupStep(gm, 'Review & start');
      await expect(
        gm.getByRole('button', {
          name: 'Notoriety is outside the normal range of 0–100.',
          exact: true,
        }),
      ).toBeVisible();
      await gm
        .getByRole('textbox', { name: 'Setup notes (optional)', exact: true })
        .fill('The table starts this militia in week twelve.');
    }
    if (existing) {
      const choose = async (label: string, name: string) =>
        gm
          .getByRole('group', { name: label, exact: true })
          .getByRole('button', { name, exact: true })
          .click();
      const fill = async (name: string, value: string) =>
        gm.getByRole('textbox', { name, exact: true }).fill(value);
      await openSetupStep(gm, 'People & officers');
      await gm
        .getByRole('main')
        // The character's own "Add <name>", not the inline "Add character".
        .getByRole('button', { name: /^Add (?!character$)/ })
        .first()
        .click();
      // A commandant's blank Hit Dice follow the character's level (#196):
      // nothing below enters them, and the week still starts.
      await gm
        .getByRole('main')
        .getByRole('button', { name: 'commandant', exact: true })
        .click();
      await openSetupStep(gm, 'Character conditions');
      await gm
        .getByRole('button', { name: 'Add character condition', exact: true })
        .click();
      await gm
        .getByRole('group', { name: 'Character', exact: true })
        .getByRole('button')
        .first()
        .click();
      await openSetupStep(gm, 'Teams');
      await gm.getByRole('button', { name: 'Add team', exact: true }).click();
      await fill('Team name', 'Scouts');
      await openSetupStep(gm, 'Settlements');
      await gm
        .getByRole('button', { name: 'Add settlement', exact: true })
        .click();
      await fill('Settlement name', 'Home');
      await gm
        .getByRole('button', {
          name: 'Record Reduce Danger benefit',
          exact: true,
        })
        .click();
      await fill('Reduce Danger ends week', '13');
      await openSetupStep(gm, 'Carried effects');
      await gm.getByRole('button', { name: 'Add bonus', exact: true }).click();
      await fill('Bonus source', 'Prior mission');
      await choose('Bonus team (optional)', 'Scouts');
      await choose('Bonus phase (optional)', 'activity');
      await gm
        .getByRole('button', { name: 'Add Market Day benefit', exact: true })
        .click();
      await choose('Discount settlements', 'Home');
      // The open step and its entries stay in bounds on phone rows too.
      for (const [layout, width, height] of [
        ['tablet', 1194, 834],
        ['phone', 390, 844],
      ] as const) {
        await gm.setViewportSize({ width, height });
        await savePrivate(
          join(run.artifactDirectory, `canonical-setup-${layout}.png`),
          await gm.screenshot({ fullPage: true }),
        );
        for (const control of await gm
          .locator('main button, main input')
          .all()) {
          const box = await control.boundingBox();
          if (!box) continue;
          const label =
            (await control.getAttribute('name')) ??
            (await control.textContent());
          expect(box.x, `${layout}: ${label}`).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width, `${layout}: ${label}`).toBeLessThanOrEqual(
            width,
          );
        }
      }
      await gm.setViewportSize({ width: 1194, height: 834 });
    }
    await openSetupStep(gm, 'Starting point');
    const rank = gm.getByRole('textbox', { name: 'Rank', exact: true });
    await rank.fill('invalid');
    await expect(
      gm.getByText('Enter a valid whole number for Rank.'),
    ).toBeVisible();
    // Only Start is blocked; its summary links back to the field.
    await openSetupStep(gm, 'Review & start');
    await gm
      .getByRole('button', { name: 'Start militia week', exact: true })
      .click();
    await gm
      .getByRole('button', {
        name: 'Enter a valid value for Rank.',
        exact: true,
      })
      .click();
    await expect(rank).toBeFocused();
    await rank.fill('1');
    await openSetupStep(gm, 'Week');
    await gm
      .getByRole('group', { name: 'Open phase', exact: true })
      .getByRole('button', { name: 'event', exact: true })
      .click();
    await openSetupStep(gm, 'Review & start');
    await gm
      .getByRole('button', { name: 'Start militia week', exact: true })
      .click();
    await expect(
      gm.getByRole('heading', {
        name: `Week ${existing ? 12 : 1} · Event`,
        exact: true,
      }),
    ).toBeVisible();
    await expect(gm).toHaveURL(
      new RegExp(`/campaigns/${campaignId}/week\\?phase=event$`),
    );
    // The other member's open form follows the accepted setup to its week.
    await expect(players.player).toHaveURL(
      new RegExp(`/campaigns/${campaignId}/week(?:\\?|$)`),
    );
    await expect(
      players.player.getByRole('heading', {
        name: `Week ${existing ? 12 : 1} · Upkeep`,
        exact: true,
      }),
    ).toBeVisible();
    if (!existing)
      // A fresh setup recorded no notes, so there is no notes button.
      await expect(
        players.player.getByRole('button', {
          name: 'Setup notes',
          exact: true,
        }),
      ).toHaveCount(0);
    if (existing) {
      // Setup notes open from their button beside the status (#152); the
      // dialog traps focus and returns it on Escape and on Close.
      const notesButton = players.player.getByRole('button', {
        name: 'Setup notes',
        exact: true,
      });
      await notesButton.focus();
      await players.player.keyboard.press('Enter');
      const notes = players.player.getByRole('dialog', {
        name: 'Setup notes',
        exact: true,
      });
      await expect(notes).toContainText('week twelve');
      // The notes wrap inside the dialog; nothing is clipped sideways.
      expect(
        await notes.evaluate(
          (element) => element.scrollWidth <= element.clientWidth + 1,
        ),
        'notes wrap within the dialog',
      ).toBe(true);
      await players.player.keyboard.press('Escape');
      await expect(notes).toBeHidden();
      await expect(notesButton).toBeFocused();
      await notesButton.click();
      await expect(notes).toBeVisible();
      await notes.getByRole('button', { name: 'Close', exact: true }).click();
      await expect(notes).toBeHidden();
      await expect(notesButton).toBeFocused();
      // Resuming a militia requires ordinary Upkeep before confirmation.
      await players.player
        .getByRole('textbox', { name: 'Attrition Loyalty roll', exact: true })
        .fill('20');
      const training = players.player.getByRole('textbox', {
        name: 'Attrition training roll',
        exact: true,
      });
      await training.fill('1');
      await training.blur();
      await expect(saveStatus(players.player)).toHaveText('Changes saved.');
      // A natural 20 gains the 1d6 training roll.
      await expect(
        players.player.getByRole('region', {
          name: 'Training attrition',
          exact: true,
        }),
      ).toContainText('Training +1');
    }
    await gm
      .getByRole('textbox', { name: 'Event chance roll', exact: true })
      .fill('100');
    await gm
      .getByRole('textbox', { name: 'Event chance roll', exact: true })
      .blur();
    await players.player
      .getByRole('button', { name: 'Event', exact: true })
      .click();
    await expect(
      players.player.getByRole('textbox', {
        name: 'Event chance roll',
        exact: true,
      }),
    ).toHaveValue('100');
    await players.player
      .getByRole('button', { name: 'Review & confirm', exact: true })
      .click();
    await expect(
      players.player.getByRole('button', { name: 'Confirm week', exact: true }),
    ).toBeEnabled();
    await players.player
      .getByRole('button', { name: 'Confirm week', exact: true })
      .click();
    await expect(
      players.player.getByRole('heading', {
        name: `Week ${existing ? 13 : 2} · Upkeep`,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      gm.getByRole('heading', {
        name: `Week ${existing ? 13 : 2} · Upkeep`,
        exact: true,
      }),
    ).toBeVisible();
  }
  await fixtureCall(run, 'resetCase', { ...scope, now: 1_700_000_000_000 });
}
