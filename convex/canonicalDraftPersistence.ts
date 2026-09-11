import { internal } from './_generated/api';
import { internalMutation } from './_generated/server';
import {
  acceptedWeeklyPreviewSchema,
  confirmationOperationSchema,
  confirmationReceiptSchema,
} from '../src/lib/weekly-confirmation-contract';
import { previewDraft, confirmDraft } from './lib/canonicalConfirmation';
import { zodOutputToConvex } from 'convex-helpers/server/zod4';
import { z } from 'zod';
import { paginationOptsValidator } from 'convex/server';
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import {
  draftKeySchema,
  canonicalRecordValidator,
} from './lib/canonicalStorageValidators';
import {
  draftObservationSchema,
  draftOperationSchema,
  draftReceiptSchema,
  draftTargetPaginationValidator,
} from '../src/lib/weekly-draft-persistence-contract';
import {
  observeDraft,
  persistDraftOperation,
} from './lib/canonicalDraftPersistenceAuthority';
import {
  deploymentFixtureSchema,
  guardFixtureScope,
} from '../e2e/fixtures/catalog';
import { ConvexError, v } from 'convex/values';

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
  args: {
    ...zodOutputToConvex(
      draftKeySchema.extend({
        afterRevision: z.number().int().nonnegative(),
        observedRevision: z.number().int().nonnegative(),
        observedStatus: z.enum(['open', 'closed']),
      }),
    ).fields,
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    restart: v.boolean(),
    observation: zodOutputToConvex(draftObservationSchema),
    pagination: v.union(v.null(), draftTargetPaginationValidator),
  }),
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
        pagination: null,
        restart: true,
      };
    const result = await ctx.db
      .query('canonicalDraftTarget')
      .withIndex('by_draftId_and_revision', (q) =>
        q.eq('draftId', args.draftId).gt('revision', args.afterRevision),
      )
      .paginate(args.paginationOpts);
    return {
      restart: false,
      observation,
      pagination: {
        ...result,
        page: result.page.map((row) => ({
          target: row.target,
          revision: row.revision,
        })),
      },
    };
  },
});

export const preview = query({
  args: zodOutputToConvex(draftKeySchema),
  returns: zodOutputToConvex(acceptedWeeklyPreviewSchema),
  handler: async (ctx, args) => {
    await requireIsolated(ctx, args.campaignId);
    return await previewDraft(ctx, args);
  },
});
export const confirm = mutation({
  args: zodOutputToConvex(
    draftKeySchema.extend({ operation: confirmationOperationSchema }),
  ),
  returns: v.object({
    ...zodOutputToConvex(confirmationReceiptSchema.omit({ record: true }))
      .fields,
    record: canonicalRecordValidator,
  }),
  handler: async (ctx, args) => {
    await requireIsolated(ctx, args.campaignId);
    const receipt = await confirmDraft(ctx, args, args.operation);
    await ctx.scheduler.runAfter(
      0,
      internal.canonicalDraftPersistence.retireClosedDraft,
      { draftId: args.draftId, afterRevision: 0 },
    );
    return receipt;
  },
});

// Closure immediately removes editable authority. Retire historical base payloads
// and target tombstones in bounded transactions while retaining edit dedup receipts.
export const retireClosedDraft = internalMutation({
  args: { draftId: v.string(), afterRevision: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('canonicalWeeklyDraft')
      .withIndex('by_draftId', (q) => q.eq('draftId', args.draftId))
      .unique();
    if (row?.status !== 'closed') return null;
    const operations = await ctx.db
      .query('canonicalDraftOperation')
      .withIndex('by_draftId_and_acceptedRevision', (q) =>
        q
          .eq('draftId', args.draftId)
          .gt('acceptedRevision', args.afterRevision),
      )
      .take(4);
    for (const operation of operations)
      await ctx.db.patch('canonicalDraftOperation', operation._id, {
        acceptedDraft: undefined,
      });
    const targets = await ctx.db
      .query('canonicalDraftTarget')
      .withIndex('by_draftId_and_target', (q) => q.eq('draftId', args.draftId))
      .take(32);
    for (const target of targets)
      await ctx.db.delete('canonicalDraftTarget', target._id);
    if (operations.length === 4 || targets.length === 32)
      await ctx.scheduler.runAfter(
        0,
        internal.canonicalDraftPersistence.retireClosedDraft,
        {
          draftId: args.draftId,
          afterRevision:
            operations[operations.length - 1]?.acceptedRevision ??
            args.afterRevision,
        },
      );
    return null;
  },
});
