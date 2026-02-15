import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { campaignValidator, militiaValidator } from './schema';
import { hasAccessToOrg } from './user';
import type { IMilitia, ITeam } from '../src/lib/types';
import teams from './data/teams';

export const getMilitia = query({
  args: {
    campaignId: v.optional(v.id('campaign')),
    organizationId: v.optional(campaignValidator.fields.organizationId),
  },
  handler: async (ctx, args) => {
    if (!args.campaignId || !args.organizationId) {
      return null;
    }
    const { campaignId, organizationId } = args;

    const hasAccess = await hasAccessToOrg(ctx, organizationId);

    if (!hasAccess) {
      return null;
    }

    const campaign = await ctx.db.get('campaign', campaignId);
    if (campaign?.organizationId !== organizationId) {
      return null;
    }

    const militia = await ctx.db
      .query('militia')
      .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
      .first();
    if (!militia) {
      return null;
    }

    const teamsResult = await ctx.db
      .query('militiaTeam')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
      .collect();

    const iTeams: ITeam[] = teams.filter((team) =>
      teamsResult.find((innerTeam) => innerTeam.teamId === team.id),
    );

    const iMilitia: IMilitia = { ...militia, teams: iTeams };

    return iMilitia;
  },
});

export const createMilitia = mutation({
  args: {
    militia: militiaValidator,
    organizationId: campaignValidator.fields.organizationId,
  },
  async handler(ctx, args) {
    const userHasAccessObject = await hasAccessToOrg(ctx, args.organizationId);

    if (!userHasAccessObject) {
      throw new ConvexError('You do not have access to this org');
    }

    const campaign = await ctx.db.get('campaign', args.militia.campaignId);
    if (campaign?.organizationId !== args.organizationId) {
      throw new ConvexError('No campaign exists for this organization');
    }

    const militiaResult = await ctx.db
      .query('militia')
      .withIndex('by_campaign', (q) => q.eq('campaignId', campaign._id))
      .first();
    if (militiaResult) {
      throw new ConvexError('This campaign already has a militia');
    }

    await ctx.db.insert('militia', args.militia);
  },
});
