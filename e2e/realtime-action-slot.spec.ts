import { loadRun } from './support/process';
import { test, expect } from './support/fixtures';
import {
  actionSlot,
  selectCampaign,
  visiblePlace,
} from './support/interactions';

test.use({ caseKey: 'realtimeActionSlot' });

test('players share a Staged Action Choice', async ({
  players,
  ownedCase,
}, info) => {
  const observers = [
    { player: 'staging player', page: players.player },
    { player: 'observing member', page: players.gm },
  ];
  let expected =
    'available Action Slot 1 with no Action Choice in week 1 Activity';

  try {
    for (const { player, page } of observers) {
      await test.step(`${player}: open the seeded Activity board`, async () => {
        await page.goto('/campaigns');
        await selectCampaign(page, ownedCase.campaignName);
        await expect(
          page.getByRole('heading', { name: 'Week 1', exact: true }),
        ).toBeVisible();
        await expect(actionSlot(page, 1), `${player}: ${expected}`).toHaveText(
          /^Activity Slot 1\s*Drag an activity card here$/,
        );
      });
    }

    expected =
      'Staged Action Choice Drill Militia in Action Slot 1, still in week 1';
    await test.step('staging player: tap Drill Militia into Action Slot 1', async () => {
      await visiblePlace(players.player, 'Drill Militia', 1, 'tap');
    });

    // Both contexts are connected before staging. The observing member never
    // reloads or writes to the slot. Confirmation belongs to the whole week.
    for (const { player, page } of observers) {
      await test.step(`${player}: observe ${expected}`, async () => {
        const slot = actionSlot(page, 1);
        await expect(slot, `${player}: ${expected}`).toContainText(
          'Drill Militia',
        );
        await expect(
          slot.getByText('Staged', { exact: true }),
          `${player}: ${expected}`,
        ).toBeVisible();
        await expect(
          page.getByRole('heading', { name: 'Week 1', exact: true }),
        ).toBeVisible();
      });
    }
    if (
      (await loadRun()).mode === 'nightly' &&
      info.project.name === 'chromium-tablet'
    ) {
      expected =
        'Change Officer Role replaces Drill Militia after observer reconnect and survives player reload';
      await test.step(`observing member: ${expected}`, async () => {
        await players.gm.context().setOffline(true);
        await visiblePlace(players.player, 'Change Officer Role', 1, 'tap');
        await players.gm.context().setOffline(false);
        await expect(
          actionSlot(players.gm, 1),
          `observing member: ${expected}`,
        ).toContainText('Change Officer Role');
        await players.player.reload();
        await selectCampaign(players.player, ownedCase.campaignName);
        for (const { player, page } of observers) {
          await expect(
            actionSlot(page, 1),
            `${player}: ${expected}`,
          ).toContainText('Change Officer Role');
          await expect(
            actionSlot(page, 1).getByText('Staged', { exact: true }),
          ).toBeVisible();
        }
      });
    }
  } catch (error) {
    const observations = await Promise.all(
      observers.map(async ({ player, page }) => {
        const state = await actionSlot(page, 1)
          .allTextContents()
          .catch(() => []);
        return `${player}: Action Slot 1 last visible state: ${state.join(' ') || 'not visible'}`;
      }),
    );
    // Only rendered domain text enters the sanitized report. The shared fixture
    // also retains safe application screenshots from both contexts on failure.
    throw new Error(
      `Realtime Action Slot journey expected ${expected}.\n${observations.join('\n')}\n${error instanceof Error ? error.message : 'Interaction failed'}`,
    );
  }
});
