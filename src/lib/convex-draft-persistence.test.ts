import { expect, test, vi } from 'vitest';
import { ConvexError } from 'convex/values';
import { ConvexClient } from 'convex/browser';
import { draftKeySchema } from '../../convex/lib/canonicalStorageValidators';
import { createConvexDraftTransport } from './convex-draft-persistence';

test('a transport bound to a closed draft cannot redirect an edit to its successor', async () => {
  const client = new ConvexClient('https://unused.convex.cloud', {
    disabled: true,
    logger: false,
  });
  const transport = createConvexDraftTransport(
    client,
    draftKeySchema.parse({
      campaignId: 'campaign',
      militiaId: 'militia',
      draftId: 'closed',
    }),
  );
  try {
    await expect(
      transport.send({
        draftId: 'successor',
        operationId: 'late',
        baseRevision: 0,
        edit: { kind: 'event_chance', roll: null },
      }),
    ).rejects.toThrow('Unknown draft');
  } finally {
    await client.close();
  }
});

test.each(['edit', 'confirm'] as const)(
  'the %s adapter preserves only the exact public maintenance rejection',
  async (kind) => {
    const client = new ConvexClient('https://unused.convex.cloud', {
      disabled: true,
      logger: false,
    });
    const mutation = vi.spyOn(client, 'mutation');
    const transport = createConvexDraftTransport(
      client,
      draftKeySchema.parse({
        campaignId: 'campaign',
        militiaId: 'militia',
        draftId: 'week',
      }),
    );
    const perform = () =>
      kind === 'edit'
        ? transport.send({
            draftId: 'week',
            operationId: 'edit',
            baseRevision: 0,
            edit: { kind: 'event_chance', roll: null },
          })
        : transport.confirm({
            operationId: 'confirm',
            reviewed: {
              draftId: 'week',
              revision: 0,
              sourceRevision: 0,
              sourceKey: 'source',
              rulesetVersion: 1,
            },
          });
    try {
      mutation.mockRejectedValue(
        new ConvexError(
          'Campaign editing is paused for maintenance. Please try again later.',
        ),
      );
      await expect(perform()).rejects.toMatchObject({
        failureReason:
          'Campaign editing is paused for maintenance. Please try again later.',
      });
      for (const data of [
        'Private campaign id secret',
        'Campaign editing is paused for maintenance. Please try again later. secret',
        {
          message:
            'Campaign editing is paused for maintenance. Please try again later.',
        },
      ]) {
        mutation.mockRejectedValue(new ConvexError(data));
        await expect(perform()).rejects.toMatchObject({ failureReason: null });
      }
    } finally {
      mutation.mockRestore();
      await client.close();
    }
  },
);
