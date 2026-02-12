import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { campaignValidator } from './schema';
import { hasAccessToOrg } from './user';

export const getCampaigns = query({
  args: {
    organizationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.organizationId) {
      return [];
    }
    const organizationId = args.organizationId;

    const hasAccess = await hasAccessToOrg(ctx, organizationId);

    if (!hasAccess) {
      return [];
    }

    return await ctx.db
      .query('campaign')
      .withIndex('by_organization', (q) =>
        q.eq('organizationId', organizationId),
      )
      .collect();
  },
});

export const createCampaign = mutation({
  args: {
    name: campaignValidator.fields.name,
    description: campaignValidator.fields.description,
    organizationId: campaignValidator.fields.organizationId,
  },
  async handler(ctx, args) {
    const userHasAccessObject = await hasAccessToOrg(ctx, args.organizationId);

    if (!userHasAccessObject) {
      throw new ConvexError('You do not have access to this org');
    }

    await ctx.db.insert('campaign', {
      name: args.name,
      ownerId: userHasAccessObject.user.tokenIdentifier,
      organizationId: args.organizationId,
      description: args.description,
    });
  },
});
