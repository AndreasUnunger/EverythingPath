import { ConvexError } from 'convex/values';
import {
  customCtx,
  customMutation,
} from 'convex-helpers/server/customFunctions';
import {
  mutation,
  internalMutation,
  type QueryCtx,
} from '../_generated/server';

export async function readCutover(ctx: Pick<QueryCtx, 'db'>) {
  return await ctx.db
    .query('campaignCutover')
    .withIndex('by_key', (q) => q.eq('key', 'weekly-draft'))
    .unique();
}

export async function requireCampaignWrites(ctx: Pick<QueryCtx, 'db'>) {
  const control = await readCutover(ctx);
  if (control?.status === 'paused')
    throw new ConvexError(
      'Campaign editing is paused for maintenance. Please try again later.',
    );
}

const writable = customCtx(
  async (ctx: Parameters<typeof requireCampaignWrites>[0]) => {
    await requireCampaignWrites(ctx);
    return {};
  },
);

// Reading the same control row in every transaction also orders in-flight writes
// against the pause. Operational functions intentionally use the raw builders.
export const campaignMutation = customMutation(mutation, writable);
export const campaignInternalMutation = customMutation(
  internalMutation,
  writable,
);
