import type { ConvexClient } from 'convex/browser';
import { ConvexError } from 'convex/values';
import { makeFunctionReference } from 'convex/server';
import type { z } from 'zod';
import type { draftKeySchema } from '../../convex/lib/canonicalStorageValidators';
import {
  draftObservationSchema,
  draftReceiptSchema,
  DraftRejected,
  DraftTransportFailure,
  type DraftTransport,
  type DraftOperation,
  type DraftObservation,
  type DraftReceipt,
} from './weekly-draft-persistence-contract';

type Key = z.infer<typeof draftKeySchema>;
// Typed references avoid coupling this isolated client to the live application's hooks.
const observe = makeFunctionReference<'query', Key, DraftObservation>(
  'canonicalDraftPersistence:observe',
);
const edit = makeFunctionReference<
  'mutation',
  Omit<Key, 'draftId'> & { operation: DraftOperation },
  DraftReceipt
>('canonicalDraftPersistence:edit');
export function createConvexDraftTransport(
  client: ConvexClient,
  key: Key,
): DraftTransport {
  return {
    async read() {
      return draftObservationSchema.parse(await client.query(observe, key));
    },
    async send(operation) {
      if (operation.draftId !== key.draftId)
        throw new DraftRejected('Unknown draft');
      try {
        return draftReceiptSchema.parse(
          await client.mutation(edit, {
            campaignId: key.campaignId,
            militiaId: key.militiaId,
            operation,
          }),
        );
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
      return client.onUpdate(
        observe,
        key,
        (value) => next(draftObservationSchema.parse(value)),
        failed,
      );
    },
  };
}
