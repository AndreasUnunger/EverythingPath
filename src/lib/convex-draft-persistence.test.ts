import { expect, test } from 'vitest';
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
