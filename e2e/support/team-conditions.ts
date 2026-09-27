import { randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import type { z } from 'zod';
import type { draftKeySchema } from '../../convex/lib/canonicalStorageValidators';
import { createConvexDraftTransport } from '../../src/lib/convex-draft-persistence';
import type { Run } from './process';
import { connectAs } from './roll-compatibility';

type DraftKey = z.infer<typeof draftKeySchema>;

// Upkeep team rows on a fresh week with the disabled Scouts and the missing
// Riders (#156): the missing team only rolls to return, shared on both
// devices, and a Remove choice staged by an older client stays visible and
// is cleared explicitly, with the Militia corrections route offered instead.
export async function exerciseTeamConditionRows(
  first: Page,
  second: Page,
  run: Run,
  key: DraftKey,
) {
  const riders = (page: Page) =>
    page.getByRole('group', { name: 'Riders return check', exact: true });
  const returnRoll = (page: Page) =>
    riders(page).getByRole('textbox', {
      name: 'Riders return roll',
      exact: true,
    });
  const scouts = (page: Page) =>
    page.getByRole('group', { name: 'Scouts team condition', exact: true });

  await expect(riders(first)).toContainText('Return check · Security DC 15');
  // The calculated bonus is known before the die is entered.
  await expect(riders(first)).toContainText(/bonus [+−]\d+/);
  await expect(
    riders(first).getByRole('button', { name: 'Recover', exact: true }),
  ).toHaveCount(0);
  await returnRoll(first).fill('1');
  await expect(returnRoll(second)).toHaveValue('1');
  for (const page of [first, second])
    await expect(riders(page)).toContainText(
      'Natural 1: the team is lost for good',
    );
  await returnRoll(second).fill('19');
  await expect(returnRoll(first)).toHaveValue('19');
  for (const page of [first, second])
    await expect(riders(page)).toContainText('Returns at the end of the week');

  const client = await connectAs(second, run.fixture!.convexUrl);
  try {
    const transport = createConvexDraftTransport(client, key);
    const observed = await transport.read();
    await transport.send({
      draftId: key.draftId,
      operationId: randomUUID(),
      baseRevision: observed.revision,
      edit: {
        kind: 'upkeep_team',
        teamId: 'upkeep-scouts',
        decision: { teamId: 'upkeep-scouts', decision: 'remove' },
      },
    });
  } finally {
    await client.close();
  }
  for (const page of [first, second]) {
    await expect(
      scouts(page).getByText(
        'This team still has a staged Remove choice, which Upkeep no longer offers.',
      ),
    ).toBeVisible();
    await expect(
      scouts(page).getByRole('button', { name: 'Recover', exact: true }),
    ).toHaveCount(0);
    await expect(
      scouts(page).getByRole('link', {
        name: 'Remove the team in Militia corrections',
      }),
    ).toHaveAttribute('href', `/campaigns/${key.campaignId}/militia`);
  }
  await scouts(first)
    .getByRole('button', { name: 'Clear Remove choice', exact: true })
    .click();
  for (const page of [first, second])
    await expect(
      scouts(page).getByRole('button', { name: 'Recover', exact: true }),
    ).toHaveAttribute('aria-pressed', 'false');
}
