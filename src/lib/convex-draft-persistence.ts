import type { ConvexClient } from 'convex/browser';
import { ConvexError } from 'convex/values';
import { api } from '../../convex/_generated/api';
import { createDraftTargetReader } from './draft-target-reader';
import type { z } from 'zod';
import type { draftKeySchema } from '../../convex/lib/canonicalStorageValidators';
import {
  draftObservationSchema,
  draftReceiptSchema,
  DraftRejected,
  DraftTransportFailure,
  type DraftTransport,
} from './weekly-draft-persistence-contract';

type Key = z.infer<typeof draftKeySchema>;
export function createConvexDraftTransport(
  client: ConvexClient,
  key: Key,
): DraftTransport {
  const hydrate = createDraftTargetReader((request) =>
    client.query(api.canonicalDraftPersistence.targets, { ...key, ...request }),
  );
  return {
    async read() {
      return await hydrate(
        draftObservationSchema.parse(
          await client.query(api.canonicalDraftPersistence.observe, key),
        ),
      );
    },
    async send(operation) {
      if (operation.draftId !== key.draftId)
        throw new DraftRejected('Unknown draft');
      try {
        const receipt = draftReceiptSchema.parse(
          await client.mutation(api.canonicalDraftPersistence.edit, {
            campaignId: key.campaignId,
            militiaId: key.militiaId,
            operation,
          }),
        );
        return { ...receipt, observation: await hydrate(receipt.observation) };
      } catch (error) {
        if (error instanceof ConvexError)
          throw new DraftRejected('Edit rejected');
        // Convex retries connectivity internally. A closed/interrupted client is
        // the remaining temporary transport boundary; validation is not retried.
        if (
          error instanceof Error &&
          error.message === 'ConvexClient has already been closed.'
        )
          throw new DraftTransportFailure('Connection interrupted');
        throw error;
      }
    },
    subscribe(next, failed) {
      let active = true;
      const unsubscribe = client.onUpdate(
        api.canonicalDraftPersistence.observe,
        key,
        (value) => {
          void hydrate(draftObservationSchema.parse(value)).then(
            (observation) => {
              if (active) next(observation);
            },
            (error) => {
              if (active) failed(error);
            },
          );
        },
        failed,
      );
      return () => {
        active = false;
        unsubscribe();
      };
    },
  };
}
