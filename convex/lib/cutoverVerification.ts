import { ConvexError, compareValues } from 'convex/values';
import type { QueryCtx, MutationCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { readCutover } from './campaignRuntime';
import { preflightCampaignInitialization } from './campaignInitialization';
import { createWeeklyDraft } from '../../src/lib/weekly-draft';
import { weeklyDraftDataSchema } from '../../src/lib/weekly-draft-contract';

export async function requirePausedCutover(ctx: QueryCtx, operationId: string) {
  const control = await readCutover(ctx);
  if (control?.operationId !== operationId || control.status !== 'paused')
    throw new ConvexError(
      'This cutover is not paused; automatic rollback ends at reopening',
    );
  return control;
}

export async function verifyCutoverCampaign(
  ctx: QueryCtx,
  campaignId: Id<'campaign'>,
) {
  const militia = await ctx.db
    .query('militia')
    .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
    .unique();
  if (!militia) return { campaignId, week: null };
  const plan = await preflightCampaignInitialization(ctx, {
    campaignId,
    militiaId: militia._id,
  });
  const receipt = await ctx.db
    .query('canonicalCampaignInitialization')
    .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
    .unique();
  const source = await ctx.db
    .query('canonicalMilitiaState')
    .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
    .unique();
  const drafts = await ctx.db
    .query('canonicalWeeklyDraft')
    .withIndex('by_campaignId_and_status', (q) =>
      q.eq('campaignId', campaignId),
    )
    .take(2);
  const draft = drafts[0];
  const history = await ctx.db
    .query('canonicalResolutionRecord')
    .withIndex('by_campaignId_and_week_and_sequence', (q) =>
      q.eq('campaignId', campaignId),
    )
    .first();
  if (
    !plan.ready ||
    !plan.facts ||
    !plan.snapshot ||
    !plan.source.week ||
    receipt?.campaignId !== campaignId ||
    receipt.sourceToken !== plan.sourceToken ||
    source?.campaignId !== campaignId ||
    source.revision !== 0 ||
    compareValues(source.snapshot, plan.snapshot) !== 0 ||
    drafts.length !== 1 ||
    draft?.status !== 'open' ||
    draft.revision !== 0 ||
    draft.draftId !== receipt.draftId ||
    history
  )
    throw new ConvexError(
      'Campaign preservation/reset verification failed; keep writes paused',
    );
  const expected = createWeeklyDraft({
    draftId: receipt.draftId,
    week: plan.source.week.weekNumber,
    context: plan.facts,
    slotIds: [],
  });
  if (compareValues(draft.draft, weeklyDraftDataSchema.parse(expected)) !== 0)
    throw new ConvexError(
      'The initial draft must be empty and preserve week context',
    );
  return { campaignId, week: expected.week };
}

// CLI impersonation selects only public functions. Internal cutover calls already
// require deployment-admin access; bind the named operator for the same campaign
// membership checks and audit identity used by ordinary writes.
export function cutoverActor<Ctx extends QueryCtx | MutationCtx>(
  ctx: Ctx,
  operatorTokenIdentifier: string | undefined,
): Ctx {
  if (!operatorTokenIdentifier) return ctx;
  return {
    ...ctx,
    auth: {
      getUserIdentity: async () => ({
        tokenIdentifier: operatorTokenIdentifier,
        issuer: 'internal-cutover',
        subject: operatorTokenIdentifier,
      }),
    },
  };
}
