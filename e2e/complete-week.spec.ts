import type { Page } from '@playwright/test';
import { openCampaignSection } from './support/interactions';
import { test, expect } from './support/fixtures';
import { loadRun } from './support/process';
import { observeDraftKey } from './support/draft-key';
import { controlTransport } from './support/transport';
import {
  confirmedWeekNotice,
  expectConfirmedWeek,
  referencePanel,
  remoteChangeNote,
  saveStatus,
} from './support/week-frame';

const heading = (page: Page, name: string) =>
  page.getByRole('heading', { name, exact: true });
const step = (page: Page, name: string) =>
  page.getByRole('button', { name, exact: true }).click();
const chanceRoll = (page: Page) =>
  page.getByRole('textbox', { name: 'Event chance roll', exact: true });
const militiaValues = (page: Page) =>
  referencePanel(page).getByRole('table', { name: 'Militia values' });

// Counts loading skeletons inserted from now on: a genuine handoff must never
// show one, and a final absence check alone would miss a transient flash.
async function watchSkeletons(page: Page) {
  await page.evaluate(() => {
    const window_ = window as Window & { __weekSkeletons?: number };
    window_.__weekSkeletons = 0;
    new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes)
          if (
            node instanceof Element &&
            (node.matches('[data-week-skeleton]') ||
              node.querySelector('[data-week-skeleton]'))
          )
            window_.__weekSkeletons! += 1;
    }).observe(document.body, { childList: true, subtree: true });
  });
  return () =>
    page.evaluate(
      () => (window as Window & { __weekSkeletons?: number }).__weekSkeletons,
    );
}

test.use({ caseKey: 'completeWeek' });
test('a player confirms a complete week, every device moves to the next week once it is usable, and the outcome survives reload', async ({
  players,
}) => {
  test.setTimeout(240_000);
  const run = await loadRun();
  const gm = players.gm;
  const player = players.player;
  const gmTransport = await controlTransport(gm, run.fixture!.convexUrl);
  const playerTransport = await controlTransport(
    player,
    run.fixture!.convexUrl,
  );
  const draftKey = observeDraftKey(gm);
  for (const page of [gm, player]) {
    await page.goto('/campaigns');
    await openCampaignSection(page, 'week');
    await expect(heading(page, 'Week 1 · Upkeep')).toBeVisible();
    // Initial load announces nothing: no other-player note, no notice.
    await expect(remoteChangeNote(page)).toBeEmpty();
    await expect(confirmedWeekNotice(page)).toBeEmpty();
  }
  await step(gm, 'Event');
  await chanceRoll(gm).fill('100');
  await chanceRoll(gm).blur();
  await expect(saveStatus(gm)).toHaveText('Changes saved.');
  await step(player, 'Event');
  await expect(chanceRoll(player)).toHaveValue('100');
  await expect(remoteChangeNote(player)).toHaveText(
    'Another player changed Event.',
  );
  await expect(remoteChangeNote(gm)).toBeEmpty();
  // The observer keeps an independent, non-Upkeep phase throughout.
  await step(player, 'Activity');
  await expect(heading(player, 'Week 1 · Activity')).toBeVisible();
  const oldValues = (await militiaValues(player).textContent())!;
  await step(gm, 'Review & confirm');
  await expect(
    gm.getByRole('button', { name: 'Confirm week', exact: true }),
  ).toBeEnabled();
  // Hold each device's hydration of the successor draft independently while
  // the Confirmation, its receipt and the server's source updates flow: the
  // reviewed week must stay on screen read-only on both devices, with no
  // skeleton and no notice, until that device's successor is usable (#153).
  const key = await draftKey();
  const gmHold = gmTransport.holdSuccessorHydration(key);
  const playerHold = playerTransport.holdSuccessorHydration(key);
  const gmSkeletons = await watchSkeletons(gm);
  const playerSkeletons = await watchSkeletons(player);
  try {
    await gm.getByRole('button', { name: 'Confirm week', exact: true }).click();
    await expect(saveStatus(gm)).toHaveText('Confirming the week…');
    const confirming = gm.getByRole('button', {
      name: 'Confirming…',
      exact: true,
    });
    await expect(confirming).toBeDisabled();
    await expect(confirming).toHaveAttribute('aria-busy', 'true');
    await expect.poll(gmHold.observed, { timeout: 20_000 }).toBe(true);
    await expect.poll(playerHold.observed, { timeout: 20_000 }).toBe(true);
    expect(gmHold.failure()).toBeNull();
    expect(playerHold.failure()).toBeNull();
    // Caller: the old week stays, navigable and read-only, still Confirming.
    await expect(heading(gm, 'Week 1 · Review & confirm')).toBeVisible();
    await expect(confirming).toBeDisabled();
    await expect(confirmedWeekNotice(gm)).toBeEmpty();
    await step(gm, 'Event');
    await expect(heading(gm, 'Week 1 · Event')).toBeVisible();
    await expect(chanceRoll(gm)).toBeDisabled();
    await expect(chanceRoll(gm)).toHaveValue('100');
    await expect(militiaValues(gm)).toBeVisible();
    await expect(saveStatus(gm)).toHaveText('Confirming the week…');
    // Observer: same old facts, its own phase, every weekly write disabled,
    // Summary explains the wait; no notice, no skeleton.
    await expect(heading(player, 'Week 1 · Activity')).toBeVisible();
    await expect(confirmedWeekNotice(player)).toBeEmpty();
    await step(player, 'Event');
    await expect(heading(player, 'Week 1 · Event')).toBeVisible();
    await expect(chanceRoll(player)).toBeDisabled();
    await expect(chanceRoll(player)).toHaveValue('100');
    expect(await militiaValues(player).textContent()).toBe(oldValues);
    await step(player, 'Review & confirm');
    await expect(heading(player, 'Week 1 · Review & confirm')).toBeVisible();
    await expect(
      player.getByRole('button', { name: 'Confirm week', exact: true }),
    ).toBeDisabled();
    await expect(
      player.locator('[data-week-footer]:visible [data-week-readiness]'),
    ).toHaveText('Opening the next week…');
    await expect(saveStatus(player)).not.toHaveText('Confirming the week…');
    for (const page of [gm, player])
      await expect(page.locator('[data-week-skeleton]')).toHaveCount(0);
    // Release the observer first: it moves alone. The caller is still held.
    playerHold.release();
    await expectConfirmedWeek(player, 1);
    await expect(heading(gm, 'Week 1 · Event')).toBeVisible();
    await expect(confirmedWeekNotice(gm)).toBeEmpty();
    await expect(saveStatus(gm)).toHaveText('Confirming the week…');
    await expect(chanceRoll(gm)).toBeDisabled();
    gmHold.release();
    await expectConfirmedWeek(gm, 1);
    expect(gmHold.failure()).toBeNull();
    expect(playerHold.failure()).toBeNull();
  } finally {
    gmHold.release();
    playerHold.release();
  }
  expect(await gmSkeletons(), 'no skeleton on the caller').toBe(0);
  expect(await playerSkeletons(), 'no skeleton on the observer').toBe(0);
  await expect(saveStatus(gm)).not.toHaveText('Confirming the week…');
  await expect(
    gm.getByRole('button', { name: 'Confirming…', exact: true }),
  ).toHaveCount(0);
  await expect(remoteChangeNote(gm)).toBeEmpty();
  await expect(remoteChangeNote(player)).toBeEmpty();
  // Ordinary work on the new week neither repeats nor removes a notice.
  const transition = (page: Page) =>
    confirmedWeekNotice(page)
      .locator('[data-week-confirmed-transition]')
      .getAttribute('data-week-confirmed-transition');
  const gmTransition = await transition(gm);
  const playerTransition = await transition(player);
  await step(gm, 'Event');
  await expect(chanceRoll(gm)).toBeEnabled();
  await expect(chanceRoll(gm)).toHaveValue('');
  await chanceRoll(gm).fill('100');
  await chanceRoll(gm).blur();
  await expect(saveStatus(gm)).toHaveText('Changes saved.');
  await expect(remoteChangeNote(player)).toHaveText(
    'Another player changed Event.',
  );
  for (const [page, id] of [
    [gm, gmTransition],
    [player, playerTransition],
  ] as const) {
    await expect(confirmedWeekNotice(page)).toHaveCount(1);
    await expect(
      confirmedWeekNotice(page).locator('[data-week-confirmed-transition]'),
    ).toHaveAttribute('data-week-confirmed-transition', id!);
  }
  // The observer dismisses its notice; the caller's stays.
  await confirmedWeekNotice(player)
    .getByRole('button', { name: 'Dismiss', exact: true })
    .click();
  await expect(confirmedWeekNotice(player)).toBeEmpty();
  await expect(confirmedWeekNotice(gm)).toHaveCount(1);
  // The link opens the confirmed week in Finished weeks. Back returns to the
  // address that was left (Upkeep, chosen here), as a fresh load without a
  // fabricated notice.
  await step(gm, 'Upkeep');
  await expect(gm).toHaveURL(/phase=upkeep/);
  await confirmedWeekNotice(gm)
    .getByRole('link', { name: 'Open in Finished weeks', exact: true })
    .click();
  await expect(gm).toHaveURL(/\/history\?week=1$/);
  await expect(gm.getByRole('heading', { name: /Week 1/ })).toBeVisible();
  await gm.goBack();
  await expect(heading(gm, 'Week 2 · Upkeep')).toBeVisible();
  await expect(gm.locator('[data-week-skeleton]')).toHaveCount(0);
  await expect(confirmedWeekNotice(gm)).toBeEmpty();
  await gm.reload();
  await expect(heading(gm, 'Week 2 · Upkeep')).toBeVisible();
  await expect(confirmedWeekNotice(gm)).toBeEmpty();
  await openCampaignSection(gm, 'history');
  await expect(gm.getByRole('heading', { name: /Week 1/ })).toBeVisible();
});
