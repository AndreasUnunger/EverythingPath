import { openCampaignSection } from './support/interactions';
import {
  expectBoundedWeekHost,
  expectNoHorizontalOverflow,
  expectReachable,
} from './support/responsive-shell';
import {
  exercisePhoneReference,
  exercisePhoneSteps,
  exerciseReferenceHistoryFailure,
  exerciseReferencePanel,
  exerciseStatusDetails,
  exerciseWeekFrame,
  expectConfirmedWeek,
  expectSaveFailed,
  expectWideStatus,
  confirmedWeekNotice,
  referencePanel,
  remoteChangeNote,
  saveStatus,
} from './support/week-frame';
import {
  prepareWeekHistory,
  stayOnPendingWeek,
  leavePendingWeek,
} from './support/pending-navigation';
import { exerciseMilitiaSetup } from './support/setup-workspace';
import {
  reviewSummaryWorkspace,
  reviewSummarySettlement,
} from './support/summary-qa';
import { reviewPersistentWorkspace } from './support/persistent-qa';
import { exerciseEventWorkspace } from './support/event-workspace';
import { exercisePersistentWorkspace } from './support/persistent-workspace';
import { exerciseActivityWorkspace } from './support/activity-workspace';
import { exerciseRollCompatibility } from './support/roll-compatibility';
import { exerciseTeamConditionRows } from './support/team-conditions';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Page } from '@playwright/test';
import { join } from 'node:path';
import { draftKeySchema } from '../convex/lib/canonicalStorageValidators';
import { confirmationInspectionSchema } from '../src/lib/weekly-confirmation-contract';
import { test, expect } from './support/fixtures';
import {
  canonicalPersistenceFixtureCall,
  loadRun,
  fixtureCall,
  savePrivate,
} from './support/process';
import { controlNextDraftEdit } from './support/held-mutation';
import { controlTransport } from './support/transport';

function observeEditRejection(page: Page) {
  let rejected = false;
  page.on('websocket', (socket) => {
    const requests = new Set<number>();
    socket.on('framesent', ({ payload }) => {
      try {
        const parsed = z
          .object({
            type: z.literal('Mutation'),
            requestId: z.number(),
            udfPath: z.literal('canonicalDraftPersistence:edit'),
          })
          .safeParse(JSON.parse(payload.toString()));
        if (parsed.success) requests.add(parsed.data.requestId);
      } catch {
        /* Non-protocol frames are irrelevant. */
      }
    });
    socket.on('framereceived', ({ payload }) => {
      try {
        const parsed = z
          .object({
            type: z.literal('MutationResponse'),
            requestId: z.number(),
            success: z.literal(false),
          })
          .safeParse(JSON.parse(payload.toString()));
        if (parsed.success && requests.has(parsed.data.requestId))
          rejected = true;
      } catch {
        /* Provider payloads remain private. */
      }
    });
  });
  return () => rejected;
}

test.use({ caseKey: 'canonicalPersistence' });
test('players prepare shared Upkeep with independent navigation and save recovery', async ({
  players,
  ownedCase,
}) => {
  test.setTimeout(420_000);
  const run = await loadRun();
  await exerciseMilitiaSetup(run, ownedCase.scope, players);
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
    page.getByRole('textbox', { name: 'Attrition Loyalty roll', exact: true });
  const training = (page: typeof gm) =>
    page.getByRole('textbox', { name: 'Attrition training roll', exact: true });
  const saved = () => expect(saveStatus(gm)).toHaveText('Changes saved.');
  try {
    await Promise.all([
      gm.goto(route),
      player.goto(route),
      players.outsider.goto(route),
    ]);
    await expect(
      gm.getByRole('heading', { name: 'Week 4 · Upkeep', exact: true }),
    ).toBeVisible();
    await expect(gm).toHaveURL(/\/campaigns\/[^/]+\/week(?:\?|$)/);
    await expect(
      player.getByRole('heading', { name: 'Week 4 · Upkeep', exact: true }),
    ).toBeVisible();
    await expect(
      players.outsider.getByText(/This campaign isn't available/),
    ).toBeVisible();
    await expect(
      players.outsider.getByRole('textbox', {
        name: 'Attrition Loyalty roll',
        exact: true,
      }),
    ).toHaveCount(0);
    const editor = gm.locator('[data-week-editor]');
    const attrition = editor.getByRole('region', {
      name: 'Training attrition',
      exact: true,
    });
    await expect(attrition.getByText('Loyalty DC 10')).toBeVisible();
    await expect(attrition).toContainText('bonus +3');
    // Initial load announces no other-player change on either device.
    await expect(remoteChangeNote(gm)).toBeEmpty();
    await expect(remoteChangeNote(player)).toBeEmpty();
    // The receiving player is typing in a field the other write does not
    // touch: the note names the phase without moving focus or phase.
    const transferAmount = player.getByRole('textbox', {
      name: 'Transfer amount (copper)',
      exact: true,
    });
    await transferAmount.focus();
    await die(gm).fill('10');
    await expect(die(player)).toHaveValue('10');
    await expect(remoteChangeNote(player)).toHaveText(
      'Another player changed Upkeep.',
    );
    const firstBatch = await remoteChangeNote(player).getAttribute(
      'data-week-remote-sequence',
    );
    await expect(transferAmount).toBeFocused();
    await expect(remoteChangeNote(gm)).toBeEmpty();
    await training(gm).fill('3');
    await expect(training(player)).toHaveValue('3');
    // A second accepted change in the same phase is a new batch (announced
    // again) with the same words; focus and both phases stay put.
    await expect(remoteChangeNote(player)).toHaveText(
      'Another player changed Upkeep.',
    );
    await expect(remoteChangeNote(player)).not.toHaveAttribute(
      'data-week-remote-sequence',
      firstBatch!,
    );
    await expect(transferAmount).toBeFocused();
    await expect(remoteChangeNote(gm)).toBeEmpty();
    await expect(
      player.getByRole('heading', { name: 'Week 4 · Upkeep', exact: true }),
    ).toBeVisible();
    await expect(
      gm.getByRole('heading', { name: 'Week 4 · Upkeep', exact: true }),
    ).toBeVisible();
    // The step header reports its own change: 13 succeeds, losing 1d6 = 3.
    await expect(attrition).toContainText('bonus +3 = total 13');
    await expect(attrition).toContainText('Training −3');
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
    // The advisory names the roll's usual range; zero is kept, not blocked.
    await expect(
      editor.getByText(
        'The usual range for 1d20 is 1–20. Your entered total is retained for the table.',
        { exact: true },
      ),
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
    await expect(
      player.getByRole('region', {
        name: 'Deposits and withdrawals',
        exact: true,
      }),
    ).toContainText('Treasury 50 gp → 50.07 gp');
    await saved();
    const charactersUrl = await prepareWeekHistory(gm);
    await expect(die(gm)).toHaveValue('10');
    const heldBack = network.hold();
    await die(gm).fill('11');
    await heldBack;
    await stayOnPendingWeek(gm, 'back', 'Saving changes…');
    await expect(die(gm)).toHaveValue('11');
    await expect(die(player)).toHaveValue('10');
    await leavePendingWeek(gm, 'back', charactersUrl);
    network.release();
    await expect(die(player)).toHaveValue('11');
    await gm.goForward();
    await expect(die(gm)).toHaveValue('11');
    await expect(
      gm.getByRole('heading', { name: 'Week 4 · Upkeep', exact: true }),
    ).toHaveCount(1);

    // Forward traversal has the same protection and must keep its direction
    // after Stay; Leave must consume that entry rather than push a duplicate.
    await openCampaignSection(gm, 'characters');
    await gm.goBack();
    await expect(die(gm)).toHaveValue('11');
    const heldForward = network.hold();
    await die(gm).fill('13');
    await heldForward;
    await stayOnPendingWeek(gm, 'forward', 'Saving changes…');
    await expect(die(gm)).toHaveValue('13');
    await expect(die(player)).toHaveValue('11');
    await leavePendingWeek(gm, 'forward', charactersUrl);
    network.release();
    await expect(die(player)).toHaveValue('13');
    await gm.goBack();
    await expect(die(gm)).toHaveValue('13');

    const captured = network.hold();
    await die(gm).fill('12');
    await captured;
    await expect(saveStatus(gm)).toHaveText('Saving changes…');
    await gm.getByRole('button', { name: 'Activity', exact: true }).tap();
    await expect(
      gm.getByRole('heading', { name: 'Week 4 · Activity', exact: true }),
    ).toBeVisible();
    await expect(
      player.getByRole('heading', { name: 'Week 4 · Upkeep', exact: true }),
    ).toBeVisible();
    await gm
      .getByRole('button', { name: 'Review & confirm', exact: true })
      .click();
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
    await expect(saveStatus(player)).toHaveText('Changes saved.');
    network.release();
    await expect(saveStatus(gm)).toHaveText(
      'Changes could not be saved. The latest saved values are shown.',
    );
    await expectSaveFailed(gm);
    // The failure sits in the top bar beside the campaign and section
    // controls without widening it. Below 768px (portrait and landscape
    // phones) it is the "Not saved" details button that opens the full
    // text; a wide short viewport keeps the visible sentence and offers no
    // phone trigger.
    await expectNoHorizontalOverflow(gm);
    await expectWideStatus(gm, true);
    for (const [width, height] of [
      [390, 844],
      [740, 360],
      [844, 390],
    ] as const) {
      await gm.setViewportSize({ width, height });
      await expectNoHorizontalOverflow(gm);
      await expectSaveFailed(gm);
      if (width < 768) await exerciseStatusDetails(gm, true);
      else await expectWideStatus(gm, true);
    }
    await gm.setViewportSize({ width: 1194, height: 834 });
    await expect(
      gm.getByRole('button', { name: 'Confirm week', exact: true }),
    ).toBeDisabled();
    const updatedReview = gm.getByRole('button', {
      name: 'Review updated week',
      exact: true,
    });
    await expect(updatedReview).toBeEnabled();
    await updatedReview.click();
    await expect(
      gm.getByRole('button', { name: 'Confirm week', exact: true }),
    ).toBeEnabled();
    await gm.getByRole('button', { name: 'Upkeep', exact: true }).click();
    await expect(die(gm)).toHaveValue('14');
    await die(gm).fill('16');
    await expect(die(player)).toHaveValue('16');
    await saved();
    await gm
      .getByRole('button', { name: 'Review & confirm', exact: true })
      .click();
    await expect(
      gm.getByRole('button', { name: 'Confirm week', exact: true }),
    ).toBeEnabled();
    await gm.getByRole('button', { name: 'Upkeep', exact: true }).click();
    await exerciseWeekFrame(gm);
    await exerciseReferencePanel(gm);
    await exerciseReferenceHistoryFailure(gm, network, die(gm), ['15', '16']);
    await expect(die(player)).toHaveValue('16');
    for (const [name, width, height] of [
      ['tablet', 1194, 834],
      ['tablet-narrow', 1180, 820],
      ['phone', 390, 844],
      ['desktop', 1440, 900],
    ] as const) {
      await gm.setViewportSize({ width, height });
      await expect(
        gm.getByRole('heading', { name: 'Week 4 · Upkeep', exact: true }),
      ).toBeVisible();
      if (name === 'phone') {
        await exercisePhoneSteps(gm);
        await exercisePhoneReference(gm);
      } else {
        // The panel is open at every wide size; the editor stays bounded
        // and reachable with it open and with it closed.
        await expect(referencePanel(gm)).toBeVisible();
        await expectNoHorizontalOverflow(gm);
        await expectBoundedWeekHost(gm);
        await gm.getByRole('button', { name: 'Hide reference panel' }).click();
        await expect(referencePanel(gm)).toBeHidden();
        await expectBoundedWeekHost(gm);
        await gm.getByRole('button', { name: 'Show reference panel' }).click();
        await expect(referencePanel(gm)).toBeVisible();
      }
      await expectNoHorizontalOverflow(gm);
      const officer = gm
        .getByRole('group', { name: 'Officer', exact: true })
        .getByRole('button')
        .first();
      const bounds = await officer.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      expect(
        await officer.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true);
      if (name === 'phone') {
        await officer.tap();
        await expect(officer).toHaveAttribute('aria-pressed', 'true');
        // The tapped control itself stays reachable above the bottom bar.
        await expectReachable(gm, officer);
      }
      await expectBoundedWeekHost(gm);
      await savePrivate(
        join(run.artifactDirectory, `canonical-upkeep-${name}.png`),
        await gm.screenshot({ fullPage: true }),
      );
    }
    await gm.setViewportSize({ width: 1194, height: 834 });
    await player
      .getByRole('button', { name: 'Review & confirm', exact: true })
      .click();
    await expect(
      player.getByRole('button', { name: 'Confirm week', exact: true }),
    ).toBeEnabled();
    await player
      .getByRole('button', { name: 'Confirm week', exact: true })
      .click();
    await expect(player.getByRole('heading', { name: /Week 5/ })).toBeVisible();
    await expect(gm.getByRole('heading', { name: /Week 5/ })).toBeVisible();
    await fixtureCall(run, 'resetCase', {
      ...ownedCase.scope,
      now: 1_700_000_000_000,
    });
    // The nearest settlement is chosen only at maximum notoriety, once the
    // Loyalty check fails; its cards are exercised on that fixture.
    const notorietyScope = draftKeySchema.parse(
      await canonicalPersistenceFixtureCall(run, 'initializeUpkeep', {
        scope: ownedCase.scope,
        draftId: randomUUID(),
        choices: true,
        maximumNotoriety: true,
        missingTeam: true,
      }),
    );
    const notorietyRoute = `/canonical-workspace?campaign=${notorietyScope.campaignId}`;
    await Promise.all([gm.goto(notorietyRoute), player.goto(notorietyRoute)]);
    await expect(die(gm)).toBeVisible();
    await die(gm).fill('10');
    await expect(die(player)).toHaveValue('10');
    await training(gm).fill('3');
    await expect(training(player)).toHaveValue('3');
    await gm
      .getByRole('textbox', {
        name: 'Maximum-notoriety training roll',
        exact: true,
      })
      .fill('5');
    await gm
      .getByRole('textbox', { name: 'Notoriety Loyalty roll', exact: true })
      .fill('1');
    await expect(
      player.getByRole('textbox', {
        name: 'Notoriety Loyalty roll',
        exact: true,
      }),
    ).toHaveValue('1');
    const settlementCards = gm.getByRole('group', {
      name: 'Nearest settlement',
      exact: true,
    });
    const selectedSettlement = gm.locator(
      '[aria-label="Nearest settlement selection"]',
    );
    await settlementCards.scrollIntoViewIfNeeded();
    const phaendar = settlementCards.getByRole('button', {
      name: 'Phaendar',
      exact: true,
    });
    const cardBounds = await phaendar.boundingBox();
    const targetBounds = await selectedSettlement.boundingBox();
    expect(cardBounds).not.toBeNull();
    expect(targetBounds).not.toBeNull();
    expect(cardBounds!.y).toBeGreaterThanOrEqual(0);
    expect(cardBounds!.y + cardBounds!.height).toBeLessThanOrEqual(834);
    expect(targetBounds!.y).toBeGreaterThanOrEqual(0);
    await gm.mouse.move(
      cardBounds!.x + cardBounds!.width / 2,
      cardBounds!.y + cardBounds!.height / 2,
    );
    await gm.mouse.down();
    await gm.mouse.move(
      targetBounds!.x + targetBounds!.width / 2,
      targetBounds!.y + targetBounds!.height / 2,
      { steps: 12 },
    );
    await expect(selectedSettlement).toHaveAttribute(
      'data-drop-active',
      'true',
    );
    await savePrivate(
      join(run.artifactDirectory, 'canonical-upkeep-drag-tablet.png'),
      await gm.screenshot({ fullPage: true }),
    );
    await gm.mouse.up();
    await expect(
      player
        .getByRole('group', { name: 'Nearest settlement', exact: true })
        .getByRole('button', { name: 'Phaendar', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    const misthome = settlementCards.getByRole('button', {
      name: 'Misthome',
      exact: true,
    });
    const invalidBounds = await misthome.boundingBox();
    expect(invalidBounds).not.toBeNull();
    await gm.mouse.move(
      invalidBounds!.x + invalidBounds!.width / 2,
      invalidBounds!.y + invalidBounds!.height / 2,
    );
    await gm.mouse.down();
    await gm.mouse.move(5, 5, { steps: 12 });
    await gm.mouse.up();
    await expect(
      gm.getByText(
        'Place the card in the highlighted selection area. Your selection is unchanged.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(phaendar).toHaveAttribute('aria-pressed', 'true');
    await expect(misthome).toHaveAttribute('aria-pressed', 'false');
    await exerciseTeamConditionRows(gm, player, run, notorietyScope);
    await fixtureCall(run, 'resetCase', {
      ...ownedCase.scope,
      now: 1_700_000_000_000,
    });
    const choicesScope = draftKeySchema.parse(
      await canonicalPersistenceFixtureCall(run, 'initializeUpkeep', {
        scope: ownedCase.scope,
        draftId: randomUUID(),
        choices: true,
      }),
    );
    const choicesRoute = `/canonical-workspace?campaign=${choicesScope.campaignId}`;
    await Promise.all([gm.goto(choicesRoute), player.goto(choicesRoute)]);
    await expect(die(gm)).toBeVisible();
    await die(gm).fill('10');
    await expect(die(player)).toHaveValue('10');
    await training(gm).fill('3');
    await expect(training(player)).toHaveValue('3');
    // Below maximum notoriety the step collapses and no settlement is asked.
    await expect(
      gm.getByRole('group', { name: 'Nearest settlement', exact: true }),
    ).toHaveCount(0);
    const recovery = gm.getByRole('group', {
      name: 'Scouts team condition',
      exact: true,
    });
    const remoteRecovery = player.getByRole('group', {
      name: 'Scouts team condition',
      exact: true,
    });
    const cost = (group: typeof recovery) =>
      group.getByRole('textbox', {
        name: 'Scouts: Recovery cost (gp)',
        exact: true,
      });
    const reason = (group: typeof recovery) =>
      group.getByRole('textbox', {
        name: 'Scouts: Reason for the changed cost',
        exact: true,
      });
    // Recover saves at once at the rules cost, shown in gp.
    await recovery
      .getByRole('button', { name: 'Recover', exact: true })
      .click();
    await expect(
      remoteRecovery.getByRole('button', { name: 'Recover', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(cost(recovery)).toHaveValue('20');
    await expect(cost(remoteRecovery)).toHaveValue('20');
    // A changed price stays local until its reason is present.
    await cost(recovery).fill('15');
    await expect(
      recovery.getByRole('alert').filter({
        hasText: 'A reason is required for a changed recovery cost.',
      }),
    ).toBeVisible();
    await expect(cost(remoteRecovery)).toHaveValue('20');
    await cost(recovery).fill('15x');
    await expect(
      recovery.getByRole('alert').filter({
        hasText: 'Enter an amount in gp, such as 12 or 0.07.',
      }),
    ).toBeVisible();
    await cost(recovery).fill('15');
    await reason(recovery).fill('Local healer donated supplies');
    await expect(cost(remoteRecovery)).toHaveValue('15');
    await expect(reason(remoteRecovery)).toHaveValue(
      'Local healer donated supplies',
    );
    await saved();
    // Both players change the price at once: every device converges on the
    // latest accepted edit, never a mix or an older price.
    await Promise.all([
      cost(recovery).fill('14'),
      cost(remoteRecovery).fill('16'),
    ]);
    await expect(async () => {
      const [local, remote] = await Promise.all([
        cost(recovery).inputValue(),
        cost(remoteRecovery).inputValue(),
      ]);
      expect(local).toBe(remote);
      expect(['14', '16']).toContain(local);
    }).toPass();
    await cost(recovery).fill('15');
    await expect(cost(remoteRecovery)).toHaveValue('15');
    await saved();
    // An accepted price and reason survive a reload.
    await player.reload();
    await expect(cost(remoteRecovery)).toHaveValue('15');
    await expect(reason(remoteRecovery)).toHaveValue(
      'Local healer donated supplies',
    );
    await gm
      .getByRole('button', { name: 'Review & confirm', exact: true })
      .click();
    await player
      .getByRole('button', { name: 'Review & confirm', exact: true })
      .click();
    for (const page of [gm, player]) {
      await expect(
        page
          .getByRole('region', { name: 'Rules Baseline', exact: true })
          .getByText('3000 cp', { exact: true }),
      ).toBeVisible();
      await expect(
        page
          .getByRole('region', { name: 'Final preview', exact: true })
          .getByText('3500 cp', { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Confirm week', exact: true }),
      ).toBeEnabled();
    }
    await savePrivate(
      join(run.artifactDirectory, 'canonical-recovery-summary-tablet.png'),
      await gm.screenshot({ fullPage: true }),
    );
    await gm.getByRole('button', { name: 'Upkeep', exact: true }).click();
    await player.getByRole('button', { name: 'Upkeep', exact: true }).click();
    // Leave disabled clears the recovery price and its adjustment.
    await recovery
      .getByRole('button', { name: 'Leave disabled', exact: true })
      .click();
    await expect(
      remoteRecovery.getByRole('button', {
        name: 'Leave disabled',
        exact: true,
      }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(cost(remoteRecovery)).toHaveCount(0);
    await expect(remoteRecovery.getByText(/Table Adjustment/)).toHaveCount(0);
    await recovery
      .getByRole('button', { name: 'Recover', exact: true })
      .click();
    await expect(cost(remoteRecovery)).toHaveValue('20');
    await expect(reason(remoteRecovery)).toHaveCount(0);
    await cost(recovery).fill('15');
    await reason(recovery).fill('Local healer donated supplies');
    await expect(
      remoteRecovery.getByRole('button', { name: 'Recover', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(cost(remoteRecovery)).toHaveValue('15');
    await saved();
    for (const [name, width, height] of [
      ['tablet', 1194, 834],
      ['phone', 390, 844],
    ] as const) {
      await gm.setViewportSize({ width, height });
      await expectNoHorizontalOverflow(gm);
      await savePrivate(
        join(run.artifactDirectory, `canonical-recovery-${name}.png`),
        await gm.screenshot({ fullPage: true }),
      );
    }
    await exerciseActivityWorkspace(gm, player, network, run.artifactDirectory);
    await exerciseEventWorkspace(gm, player, network, run.artifactDirectory);
    await reviewSummarySettlement(gm, player);
    await player
      .getByRole('button', { name: 'Review & confirm', exact: true })
      .click();
    await expect(
      player.getByRole('button', { name: 'Confirm week', exact: true }),
    ).toBeEnabled();
    // A Confirmation arriving while another player's action picker is open
    // closes it with the week; nothing is placed in either week.
    await gm.getByRole('button', { name: 'Activity', exact: true }).click();
    await gm
      .getByRole('button', {
        name: 'Choose an action for Action Slot 1',
        exact: true,
      })
      .click();
    await expect(gm.getByRole('dialog')).toBeVisible();
    await player
      .getByRole('button', { name: 'Confirm week', exact: true })
      .click();
    await expect(player.getByRole('heading', { name: /Week 5/ })).toBeVisible();
    await expect(gm.getByRole('dialog')).toHaveCount(0);
    await expect(gm.getByRole('heading', { name: /Week 5/ })).toBeVisible();
    const committed = confirmationInspectionSchema.parse(
      await canonicalPersistenceFixtureCall(run, 'inspect', {
        ...choicesScope,
        scope: ownedCase.scope,
      }),
    );
    expect(committed.snapshot.treasuryCopper).toBe(3500);
    expect(committed.records).toHaveLength(1);
    expect(committed.records[0]?.sourceMilitiaSnapshot?.treasuryCopper).toBe(
      5000,
    );
    expect(committed.records[0]?.source.upkeep.teamDecisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ decision: 'recover', costCopper: 2000 }),
      ]),
    );
    expect(committed.records[0]?.adjudication.tableAdjustments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'militia_value',
          field: 'treasuryCopper',
          value: 500,
          reason: 'Local healer donated supplies',
        }),
      ]),
    );
    await fixtureCall(run, 'resetCase', {
      ...ownedCase.scope,
      now: 1_700_000_000_000,
    });
    const persistentScope = draftKeySchema.parse(
      await canonicalPersistenceFixtureCall(run, 'initializeUpkeep', {
        scope: ownedCase.scope,
        draftId: randomUUID(),
        persistent: true,
      }),
    );
    const persistentRoute = `/canonical-workspace?campaign=${persistentScope.campaignId}`;
    await Promise.all([gm.goto(persistentRoute), player.goto(persistentRoute)]);
    await reviewSummaryWorkspace(gm, player, run.artifactDirectory);
    await exercisePersistentWorkspace(
      gm,
      player,
      network,
      run.artifactDirectory,
    );
    await reviewPersistentWorkspace(gm, run.artifactDirectory);
    const beforePersistentConfirmation = confirmationInspectionSchema.parse(
      await canonicalPersistenceFixtureCall(run, 'inspect', {
        ...persistentScope,
        scope: ownedCase.scope,
      }),
    );
    expect(beforePersistentConfirmation.snapshot.treasuryCopper).toBe(50000);
    expect(beforePersistentConfirmation.records).toHaveLength(0);
    await player
      .getByRole('button', { name: 'Review & confirm', exact: true })
      .click();
    await expect(
      player.getByRole('button', { name: 'Confirm week', exact: true }),
    ).toBeEnabled();
    await player
      .getByRole('button', { name: 'Confirm week', exact: true })
      .click();
    for (const page of [gm, player]) {
      await expect(page.getByRole('heading', { name: /Week 5/ })).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Persistent', exact: true }),
      ).toBeDisabled();
    }
    const afterPersistentConfirmation = confirmationInspectionSchema.parse(
      await canonicalPersistenceFixtureCall(run, 'inspect', {
        ...persistentScope,
        scope: ownedCase.scope,
      }),
    );
    expect(afterPersistentConfirmation.snapshot.treasuryCopper).toBe(42000);
    expect(afterPersistentConfirmation.records).toHaveLength(1);
    expect(afterPersistentConfirmation.openDrafts).toHaveLength(1);
    expect(afterPersistentConfirmation.openDrafts[0]?.context).toMatchObject({
      carriedEvents: [],
      lastBuyoffWeek: 4,
      persistentPhaseEligible: false,
    });
    await fixtureCall(run, 'resetCase', {
      ...ownedCase.scope,
      now: 1_700_000_000_000,
    });
    const summaryScope = draftKeySchema.parse(
      await canonicalPersistenceFixtureCall(run, 'initializeUpkeep', {
        scope: ownedCase.scope,
        draftId: randomUUID(),
      }),
    );
    const summaryRoute = `/canonical-workspace?campaign=${summaryScope.campaignId}`;
    const first = await gm.context().newPage();
    const second = await player.context().newPage();
    const late = await gm.context().newPage();
    const firstTransport = await controlTransport(
      first,
      run.fixture!.convexUrl,
    );
    const secondTransport = await controlTransport(
      second,
      run.fixture!.convexUrl,
    );
    const lateTransport = await controlNextDraftEdit(
      late,
      run.fixture!.convexUrl,
    );
    const lateRejected = observeEditRejection(late);
    const releases: (() => void)[] = [];
    const summary = (page: Page) =>
      page
        .getByRole('button', { name: 'Review & confirm', exact: true })
        .click();
    const confirm = (page: Page) =>
      page.getByRole('button', { name: 'Confirm week', exact: true });
    const confirming = (page: Page) =>
      page.getByRole('button', { name: 'Confirming…', exact: true });
    try {
      await Promise.all([
        first.goto(summaryRoute),
        second.goto(summaryRoute),
        late.goto(summaryRoute),
      ]);
      // Incoming dice totals are read, cleared and re-entered on this fresh
      // week before its original inputs are restored for the Confirmation race.
      await exerciseRollCompatibility(first, second, run, summaryScope, [late]);
      const confirmationCharactersUrl = await prepareWeekHistory(first);
      await die(first).fill('20');
      await expect(die(second)).toHaveValue('20');
      await training(first).fill('1');
      await expect(training(second)).toHaveValue('1');
      await Promise.all([summary(first), summary(second)]);
      await expect(confirm(first)).toBeEnabled();
      await expect(confirm(second)).toBeEnabled();
      const stale = firstTransport.next('delay-request');
      releases.push(stale.release);
      await confirm(first).click();
      await expect.poll(stale.observed).toBe(true);
      await expect(saveStatus(first)).toHaveText('Confirming the week…');
      await stayOnPendingWeek(first, 'back', 'Confirming the week…');
      // The initiating control itself reads Confirming… while held; the
      // ready label must not exist meanwhile.
      await expect(confirming(first)).toBeDisabled();
      await expect(confirming(first)).toHaveAttribute('aria-busy', 'true');
      await expect(confirm(first)).toHaveCount(0);
      await expect(confirmedWeekNotice(first)).toBeEmpty();
      await expect(
        second.getByRole('heading', {
          name: 'Week 4 · Review & confirm',
          exact: true,
        }),
      ).toBeVisible();
      await canonicalPersistenceFixtureCall(run, 'changeSource', {
        ...summaryScope,
        scope: ownedCase.scope,
        change: 'treasury',
      });
      await expect(
        second.getByRole('region', { name: 'Final preview', exact: true }),
      ).toContainText('5007 cp');
      stale.release();
      await expect(
        first.getByRole('button', { name: 'Review updated week', exact: true }),
      ).toBeEnabled();
      // Rejected as stale: back to the ready label, disabled, no success.
      await expect(confirm(first)).toBeDisabled();
      await expect(confirming(first)).toHaveCount(0);
      await expect(confirmedWeekNotice(first)).toBeEmpty();
      await expect(
        first.getByRole('heading', {
          name: 'Week 4 · Review & confirm',
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        first.getByRole('region', { name: 'Final preview', exact: true }),
      ).toContainText('5007 cp');
      await first
        .getByRole('button', { name: 'Review updated week', exact: true })
        .click();
      await expect(confirm(first)).toBeEnabled();
      await expect(confirm(second)).toBeEnabled();
      const delayed = lateTransport.hold();
      releases.push(() => lateTransport.release());
      await die(late).fill('7');
      await delayed;
      await summary(late);
      await expect(confirm(late)).toBeDisabled();
      await expect(
        late
          .getByRole('main')
          .getByText('Review will be ready when your changes are saved.', {
            exact: true,
          }),
      ).toBeVisible();
      const raceFirst = firstTransport.next('delay-request');
      const raceSecond = secondTransport.next('delay-request');
      releases.push(raceFirst.release, raceSecond.release);
      await Promise.all([confirm(first).click(), confirm(second).click()]);
      await expect.poll(raceFirst.observed).toBe(true);
      await expect.poll(raceSecond.observed).toBe(true);
      await leavePendingWeek(first, 'back', confirmationCharactersUrl);
      raceFirst.release();
      raceSecond.release();
      await expect(
        second.getByRole('heading', { name: /Week 5/ }),
      ).toBeVisible();
      // Every continuously observing device lands on the successor's Upkeep
      // with exactly one Week 4 notice and its exact history link, whether
      // it won, lost or merely watched. `first` left the Week meanwhile and
      // returns to a fresh page, which must not invent an old-week notice.
      await expectConfirmedWeek(second, 4);
      await expectConfirmedWeek(late, 4);
      await expect(saveStatus(second)).not.toHaveText('Confirming the week…');
      await expect(confirming(second)).toHaveCount(0);
      await first.goForward();

      for (const page of [first, second, late])
        await expect(
          page.getByRole('heading', { name: /Week 5/ }),
        ).toBeVisible();
      // A fresh load after returning never fabricates the transient notice.
      await expect(first.locator('[data-week-skeleton]')).toHaveCount(0);
      await expect(confirmedWeekNotice(first)).toBeEmpty();
      const secondTransition = await confirmedWeekNotice(second)
        .locator('[data-week-confirmed-transition]')
        .getAttribute('data-week-confirmed-transition');
      lateTransport.release();
      await expect.poll(lateRejected).toBe(true);
      // The delayed old edit was rejected without touching the new week or
      // the notices already shown.
      await expectConfirmedWeek(late, 4);
      await expect(confirmedWeekNotice(second)).toHaveCount(1);
      await expect(
        confirmedWeekNotice(second).locator('[data-week-confirmed-transition]'),
      ).toHaveAttribute('data-week-confirmed-transition', secondTransition!);
      await expect(die(late)).toHaveValue('');
      const resolved = confirmationInspectionSchema.parse(
        await canonicalPersistenceFixtureCall(run, 'inspect', {
          ...summaryScope,
          scope: ownedCase.scope,
        }),
      );
      expect(resolved.records).toHaveLength(1);
      expect(resolved.openDrafts).toHaveLength(1);
      expect(resolved.snapshot.treasuryCopper).toBe(5007);
      // The total writer confirmed one dice total against the 1d20 rule
      // specification; the record keeps exactly that form, with no dice key.
      expect(resolved.records[0]?.source.upkeep.rolls.check).toEqual({
        diceTotal: 20,
        diceCount: 1,
        sides: 20,
        provenance: { kind: 'table' },
        modifiers: [],
      });
      expect(resolved.openDrafts[0]?.upkeep.rolls.check).toBeUndefined();
      // The notice survives an ordinary save on the new week, stays
      // reachable on a phone beside the pinned chrome, and is dismissed
      // from inside itself.
      await die(second).fill('3');
      await expect(saveStatus(second)).toHaveText('Changes saved.');
      await expect(die(late)).toHaveValue('3');
      await expect(confirmedWeekNotice(second)).toHaveCount(1);
      await expect(
        confirmedWeekNotice(second).locator('[data-week-confirmed-transition]'),
      ).toHaveAttribute('data-week-confirmed-transition', secondTransition!);
      for (const [width, height] of [
        [390, 844],
        [844, 390],
        [1180, 820],
        [1440, 900],
      ] as const) {
        await second.setViewportSize({ width, height });
        await expectNoHorizontalOverflow(second);
        await expectBoundedWeekHost(second);
        await expectReachable(
          second,
          confirmedWeekNotice(second).getByRole('link', {
            name: 'Open in Finished weeks',
            exact: true,
          }),
        );
        await expectReachable(
          second,
          confirmedWeekNotice(second).getByRole('button', {
            name: 'Dismiss',
            exact: true,
          }),
        );
      }
      await second.setViewportSize({ width: 1194, height: 834 });
      await confirmedWeekNotice(second)
        .getByRole('button', { name: 'Dismiss', exact: true })
        .click();
      await expect(confirmedWeekNotice(second)).toBeEmpty();
      await expect(confirmedWeekNotice(late)).toHaveCount(1);
      await die(second).fill('');
      await expect(saveStatus(second)).toHaveText('Changes saved.');
      await expect(confirmedWeekNotice(second)).toBeEmpty();
      for (const page of [first, second, late]) {
        await summary(page);
        await expect(
          page.getByRole('region', { name: 'Final preview', exact: true }),
        ).toContainText('5007 cp');
      }
      await savePrivate(
        join(run.artifactDirectory, 'canonical-confirmation-successor.png'),
        await first.screenshot({ fullPage: true }),
      );
    } finally {
      for (const release of releases) release();
      await Promise.all([first.close(), second.close(), late.close()]);
    }
  } finally {
    network.release();
  }
});
