import { ConvexError, v } from 'convex/values';
import { query } from './_generated/server';
import { campaignMutation as mutation } from './lib/campaignRuntime';
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
  returns: v.id('campaign'),
  // The caller selects the returned id; names are not unique, so it never
  // needs to find the new campaign by name. Callers that ignore the result
  // keep working.
  async handler(ctx, args) {
    const access = await hasAccessToOrg(ctx, args.organizationId);

    if (!access) {
      throw new ConvexError('You do not have access to this org');
    }

    return await ctx.db.insert('campaign', {
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

// Independent of the in-game date: a header Save sends each changed field
// through its own mutation, so neither write can undo or overwrite the other.
// An empty string clears the description.
export const updateCampaignDescription = mutation({
  args: {
    campaignId: v.id('campaign'),
    organizationId: campaignValidator.fields.organizationId,
    description: campaignValidator.fields.description,
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
      description: args.description,
    });

    return await ctx.db.get('campaign', args.campaignId);
  },
});
