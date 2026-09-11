import { zodOutputToConvex } from 'convex-helpers/server/zod4';
import { z } from 'zod';
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
  draftTargetPageSchema,
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

export const targets = query({
  args: zodOutputToConvex(
    draftKeySchema.extend({
      afterRevision: z.number().int().nonnegative(),
      observedRevision: z.number().int().nonnegative(),
      observedStatus: z.enum(['open', 'closed']),
      cursor: z.string().nullable(),
    }),
  ),
  returns: zodOutputToConvex(draftTargetPageSchema),
  handler: async (ctx, args) => {
    await requireIsolated(ctx, args.campaignId);
    const observation = await observeDraft(ctx, args);
    if (observation.revision < args.observedRevision)
      throw new ConvexError('Unknown observed revision');
    if (
      observation.revision !== args.observedRevision ||
      observation.status !== args.observedStatus
    )
      return {
        observation,
        page: [],
        isDone: false,
        continueCursor: '',
        restart: true,
      };
    const result = await ctx.db
      .query('canonicalDraftTarget')
      .withIndex('by_draftId_and_revision', (q) =>
        q.eq('draftId', args.draftId).gt('revision', args.afterRevision),
      )
      .paginate({ numItems: 16, cursor: args.cursor });
    return {
      restart: false,
      observation,
      page: result.page.map((row) => ({
        target: row.target,
        revision: row.revision,
      })),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});
