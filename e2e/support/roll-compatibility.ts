import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ConvexClient } from 'convex/browser';
import { expect, type Page } from '@playwright/test';
import type { z } from 'zod';
import type { draftKeySchema } from '../../convex/lib/canonicalStorageValidators';
import type { WeeklyDraftEdit } from '../../src/lib/weekly-draft-contract';
import type { RawRoll } from '../../src/lib/weekly-draft-facts';
import { createConvexDraftTransport } from '../../src/lib/convex-draft-persistence';
import { savePrivate, type Run } from './process';
import {
  expectBoundedWeekHost,
  expectNoHorizontalOverflow,
  expectReachable,
} from './responsive-shell';
import { saveStatus } from './week-frame';

type DraftKey = z.infer<typeof draftKeySchema>;
// Test-only construction of the approved dice-total form. No page writes this
// representation in the current delivery; the scenario proves the current
// pages read it honestly when a newer editor has recorded it.
function total(sides: number, diceCount: number, diceTotal: number): RawRoll {
  return {
    sides,
    diceCount,
    diceTotal,
    provenance: { kind: 'table' },
    modifiers: [],
  };
}
export type ConnectablePage = Pick<Page, 'waitForFunction' | 'evaluate'>;
export type AuthenticatedClient = Pick<ConvexClient, 'setAuth'>;
// Wait for the page's Clerk session BEFORE configuring the client: `setAuth`
// requests a token immediately, and a still-loading page answers null, so
// the client would authenticate as nobody (same ordering as
// `prepareContract`). Provider logs may contain authentication payloads;
// keep them out of the harness report.
export async function connectAs(
  page: ConnectablePage,
  convexUrl: string,
): Promise<ConvexClient>;
export async function connectAs<Client extends AuthenticatedClient>(
  page: ConnectablePage,
  convexUrl: string,
  createClient: (url: string) => Client,
): Promise<Client>;
export async function connectAs(
  page: ConnectablePage,
  convexUrl: string,
  createClient: (url: string) => AuthenticatedClient = (url) =>
    new ConvexClient(url, { logger: false }),
): Promise<AuthenticatedClient> {
  await page.waitForFunction(() => Boolean(window.Clerk?.session));
  const client = createClient(convexUrl);
  client.setAuth(async ({ forceRefreshToken }) =>
    page.evaluate(
      async (skipCache) =>
        (await window.Clerk.session?.getToken({
          template: 'convex',
          skipCache,
        })) ?? null,
      forceRefreshToken,
    ),
  );
  return client;
}

// Reader compatibility for the shared dice-total format (#154), run inside an
// existing fresh Upkeep session (both pages already open on the week): the
// current Upkeep, Event and Summary pages must read an incoming total as
// recorded data, never as blank required dice, keep readiness honest for a
// total that does not match the required specification, and let a player
// clear it through the existing whole-roll edit before re-entering legacy
// dice. The original week inputs are restored through ordinary edits so the
// caller's own journey continues with unchanged semantics.
export async function exerciseRollCompatibility(
  first: Page,
  second: Page,
  run: Run,
  key: DraftKey,
  observers: Page[] = [],
) {
  const phase = (page: Page, name: string) =>
    page.getByRole('button', { name, exact: true }).click();
  const group = (page: Page, name: string) =>
    page.getByRole('group', { name, exact: true });
  const trainingDie = (page: Page, index: number) =>
    page.getByRole('textbox', {
      name: `Attrition training die ${index}`,
      exact: true,
    });
  const heading = (page: Page) =>
    page.getByRole('heading', { name: 'Week 4 · Upkeep', exact: true });
  const client = await connectAs(second, run.fixture!.convexUrl);
  const transport = createConvexDraftTransport(client, key);
  async function record(
    edit: Extract<
      WeeklyDraftEdit,
      { kind: 'upkeep_roll' | 'event_chance' | 'upkeep' }
    >,
  ) {
    const observed = await transport.read();
    await transport.send({
      draftId: key.draftId,
      operationId: randomUUID(),
      baseRevision: observed.revision,
      edit,
    });
  }
  try {
    for (const page of [first, second])
      await expect(heading(page)).toBeVisible();
    const original = (await transport.read()).draft;
    expect(original?.draftId).toBe(key.draftId);
    // A newer editor records totals through the ordinary authenticated edit
    // while both devices watch: a zero d20 check (fails DC 10 with its
    // warning), the failure branch's complete 2d4 training total and a
    // percentile chance total that produces no event.
    await record({
      kind: 'upkeep_roll',
      field: 'check',
      roll: total(20, 1, 0),
    });
    await record({
      kind: 'upkeep_roll',
      field: 'training',
      roll: total(4, 2, 7),
    });
    await record({ kind: 'event_chance', roll: total(100, 1, 100) });
    // The incoming totals survive a full reload as recorded data.
    await first.reload();
    for (const page of [first, second]) {
      await expect(heading(page)).toBeVisible();
      const check = group(page, 'Attrition Loyalty roll');
      await expect(check).toContainText('Recorded total');
      await expect(check).toContainText('0');
      await expect(check).toContainText('1d20');
      const training = group(page, 'Attrition training roll');
      await expect(training).toContainText('Recorded total');
      await expect(training).toContainText('7');
      await expect(training).toContainText('2d4');
      // No total is ever shown as blank required individual dice.
      await expect(
        page.getByRole('textbox', { name: /Attrition (Loyalty|training) die/ }),
      ).toHaveCount(0);
      await expect(
        page.getByRole('alert').filter({ hasText: 'A value is required.' }),
      ).toHaveCount(0);
      await expect(
        page.getByText(
          /Attrition Loyalty total 0 is outside the usual 1–20 range/,
        ),
      ).toBeVisible();
      // The calculated check still resolves from the recorded total.
      await expect(
        page
          .locator('[data-week-editor]')
          .getByText('Calculated bonus')
          .first(),
      ).toBeVisible();
    }
    await phase(first, 'Event');
    const chance = group(first, 'Event chance roll');
    await expect(chance).toContainText('Recorded total');
    await expect(chance).toContainText('100');
    await expect(chance).toContainText('1d100');
    await expect(
      first.getByRole('textbox', { name: 'Event chance roll', exact: true }),
    ).toHaveCount(0);
    await phase(first, 'Review & confirm');
    await expect(
      first.getByRole('button', { name: 'Confirm week', exact: true }),
    ).toBeEnabled();
    await expect(first.getByRole('main')).toContainText(
      /outside its usual range/,
    );
    await phase(first, 'Upkeep');

    // A total for another specification arrives: the old pages show what was
    // recorded and what the step needs, and readiness becomes honest again.
    await record({
      kind: 'upkeep_roll',
      field: 'training',
      roll: total(6, 1, 5),
    });
    for (const page of [first, second]) {
      const training = group(page, 'Attrition training roll');
      await expect(training).toContainText('5');
      await expect(training).toContainText('1d6');
      await expect(training).toContainText(
        /needs 2d4, but the recorded total is for 1d6/,
      );
      await expect(trainingDie(page, 1)).toHaveCount(0);
    }
    await phase(second, 'Review & confirm');
    await expect(
      second.getByRole('button', { name: 'Confirm week', exact: true }),
    ).toBeDisabled();
    await expect(
      second
        .getByRole('region', { name: 'Required decisions', exact: true })
        .getByText('Upkeep: Enter the attrition training roll (2d4).'),
    ).toBeVisible();
    await phase(second, 'Upkeep');

    // Deliberate clear through the existing nullable edit, then legacy re-entry
    // with the current per-die writer; the untouched check total is preserved.
    await group(first, 'Attrition training roll')
      .getByRole('button', {
        name: 'Clear attrition training roll',
        exact: true,
      })
      .click();
    await expect(saveStatus(first)).toHaveText('Changes saved.');
    for (const page of [first, second]) {
      await expect(group(page, 'Attrition training roll')).toHaveCount(0);
      await expect(trainingDie(page, 1)).toHaveValue('');
      await expect(trainingDie(page, 2)).toHaveValue('');
    }
    await trainingDie(first, 1).fill('3');
    await expect(trainingDie(second, 1)).toHaveValue('3');
    await trainingDie(first, 2).fill('4');
    await expect(trainingDie(second, 2)).toHaveValue('4');
    await expect(saveStatus(first)).toHaveText('Changes saved.');
    await expect(group(second, 'Attrition Loyalty roll')).toContainText('0');
    await phase(second, 'Review & confirm');
    await expect(
      second.getByRole('button', { name: 'Confirm week', exact: true }),
    ).toBeEnabled();
    await phase(second, 'Upkeep');
    // The other device shows the re-entered legacy dice beside the untouched
    // recorded totals; storage-shape equality belongs to the persistence
    // contract suite, so the browser asserts only rendered outcomes.
    await expect(trainingDie(second, 1)).toHaveValue('3');
    await expect(trainingDie(second, 2)).toHaveValue('4');
    await phase(second, 'Event');
    const secondChance = group(second, 'Event chance roll');
    await expect(secondChance).toContainText('Recorded total');
    await expect(secondChance).toContainText('100');
    await expect(secondChance).toContainText('1d100');
    await phase(second, 'Upkeep');

    // The recorded-total presentation fits every target viewport with the
    // reference panel open and closed where it exists.
    for (const [name, width, height] of [
      ['phone', 390, 844],
      ['phone-landscape', 844, 390],
      ['tablet', 1180, 820],
      ['desktop', 1440, 900],
    ] as const) {
      await first.setViewportSize({ width, height });
      await expect(heading(first)).toBeVisible();
      await expectNoHorizontalOverflow(first);
      await expectBoundedWeekHost(first);
      await expectReachable(first, group(first, 'Attrition Loyalty roll'));
      if (width >= 1024) {
        await first
          .getByRole('button', { name: 'Hide reference panel' })
          .click();
        await expectNoHorizontalOverflow(first);
        await expectBoundedWeekHost(first);
        await first
          .getByRole('button', { name: 'Show reference panel' })
          .click();
      }
      await savePrivate(
        join(run.artifactDirectory, `canonical-roll-total-${name}.png`),
        await first.screenshot({ fullPage: true }),
      );
    }
    await first.setViewportSize({ width: 1194, height: 834 });

    // Restore the week's original inputs through ordinary edits so the
    // caller's journey continues exactly as before.
    await record({ kind: 'upkeep', inputs: original!.upkeep });
    await record({
      kind: 'event_chance',
      roll: original!.event.chanceRoll ?? null,
    });
    const originalCheck = original!.upkeep.rolls.check;
    const originalDie =
      originalCheck && 'dice' in originalCheck
        ? String(originalCheck.dice[0] ?? '')
        : '';
    const originalChance = original!.event.chanceRoll;
    const originalChanceDie =
      originalChance && 'dice' in originalChance
        ? String(originalChance.dice[0] ?? '')
        : '';
    // Every page shows the original legacy inputs again: the recorded-total
    // groups are gone and the legacy fields carry the original values.
    for (const page of [first, second, ...observers]) {
      await expect(group(page, 'Attrition Loyalty roll')).toHaveCount(0);
      await expect(group(page, 'Attrition training roll')).toHaveCount(0);
      await expect(
        page.getByRole('textbox', {
          name: 'Attrition Loyalty die',
          exact: true,
        }),
      ).toHaveValue(originalDie);
      await phase(page, 'Event');
      await expect(group(page, 'Event chance roll')).toHaveCount(0);
      await expect(
        page.getByRole('textbox', { name: 'Event chance roll', exact: true }),
      ).toHaveValue(originalChanceDie);
      await phase(page, 'Upkeep');
      await expect(heading(page)).toBeVisible();
    }
  } finally {
    await client.close();
  }
}
