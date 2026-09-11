import { zodOutputToConvex } from 'convex-helpers/server/zod4';
import { type z } from 'zod';
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import { draftKeySchema } from './lib/canonicalStorageValidators';
import {
  draftObservationSchema,
  draftOperationSchema,
  draftReceiptSchema,
} from '../src/lib/weekly-draft-persistence-contract';
import {
  observeDraft,
  persistDraftOperation,
} from './lib/canonicalDraftPersistenceAuthority';
import {
  deploymentFixtureSchema,
  guardFixtureScope,
} from '../e2e/fixtures/catalog';
import { ConvexError } from 'convex/values';

// Canonical editing is executable on the owned preview only until the cutover.
async function requireIsolated(
  ctx: QueryCtx | MutationCtx,
  campaignId: z.infer<typeof draftKeySchema>['campaignId'],
) {
  const campaign = await ctx.db.get('campaign', campaignId);
  const fixture = campaign?.e2eFixture;
  try {
    const config = deploymentFixtureSchema.parse(
      JSON.parse(process.env.E2E_FIXTURE_CONFIG ?? 'null'),
    );
    if (fixture?.caseKey !== 'canonicalPersistence')
      throw new Error('Unavailable');
    const token = config.workers.find(
      (worker) => worker.key === fixture.workerKey,
    )?.cases.canonicalPersistence;
    if (!token) throw new Error('Unavailable');
    guardFixtureScope(process.env, {
      ...fixture,
      caseKey: 'canonicalPersistence',
      token,
    });
  } catch {
    throw new ConvexError('Canonical editing is not enabled for this campaign');
  }
}
export const observe = query({
  args: zodOutputToConvex(draftKeySchema),
  returns: zodOutputToConvex(draftObservationSchema),
  handler: async (ctx, args) => {
    await requireIsolated(ctx, args.campaignId);
    return await observeDraft(ctx, args);
  },
});
const editArgs = draftKeySchema
  .omit({ draftId: true })
  .extend({ operation: draftOperationSchema });
export const edit = mutation({
  args: zodOutputToConvex(editArgs),
  returns: zodOutputToConvex(draftReceiptSchema),
  handler: async (ctx, args) => {
    await requireIsolated(ctx, args.campaignId);
    return await persistDraftOperation(
      ctx,
      {
        campaignId: args.campaignId,
        militiaId: args.militiaId,
        draftId: args.operation.draftId,
      },
      args.operation,
    );
  },
});
