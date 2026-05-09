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
      return { state: 'no_org_selected' as const };
    }
    const organizationId = args.organizationId;

    const hasAccess = await hasAccessToOrg(ctx, organizationId);

    if (!hasAccess) {
      return { state: 'no_access' as const };
    }

    const campaigns = await ctx.db
      .query('campaign')
      .withIndex('by_organization', (q) =>
        q.eq('organizationId', organizationId),
      )
      .collect();

    return { state: 'ready' as const, campaigns };
  },
});

export const createCampaign = mutation({
  args: {
    name: campaignValidator.fields.name,
    description: campaignValidator.fields.description,
    organizationId: campaignValidator.fields.organizationId,
  },
  async handler(ctx, args) {
    const access = await hasAccessToOrg(ctx, args.organizationId);

    if (!access) {
      throw new ConvexError('You do not have access to this org');
    }

    await ctx.db.insert('campaign', {
      name: args.name,
      ownerId: access.user.tokenIdentifier,
      organizationId: args.organizationId,
      description: args.description,
    });
  },
});

export const updateCampaignInGameDate = mutation({
  args: {
    campaignId: v.id('campaign'),
    organizationId: campaignValidator.fields.organizationId,
    inGameDate: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const access = await hasAccessToOrg(ctx, args.organizationId);

    if (!access) {
      throw new ConvexError('You do not have access to this org');
    }

    const campaign = await ctx.db.get('campaign', args.campaignId);
    if (campaign?.organizationId !== args.organizationId) {
      throw new ConvexError('No campaign exists for this organization');
    }

    await ctx.db.patch('campaign', args.campaignId, {
      inGameDate: args.inGameDate,
    });

    return await ctx.db.get('campaign', args.campaignId);
  },
});
