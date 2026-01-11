import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { campaignValidator, militiaValidator } from './schema';
import { hasAccessToOrg } from './user';
import { IMilitia, ITeam } from '../src/lib/types';
import teams from './data/teams';

export const getMilitia = query({
  args: {
    campaignId: v.string(),
    organizationId: campaignValidator.fields.organizationId,
  },
  handler: async (ctx, args) => {
    const hasAccess = await hasAccessToOrg(ctx, args.organizationId ?? '');

    if (!hasAccess) {
      throw new ConvexError('You do not have access to this org');
    }

    const campaignResult = await ctx.db
      .query('campaign')
      .withIndex('by_organization', (q) =>
        q.eq('organizationId', args.organizationId),
      )
      .collect();

    if (campaignResult.length == 0) {
      throw new ConvexError('This organization has no campaigns');
    }

    const campaign = campaignResult.find((camp) => camp._id == args.campaignId);

    if (!campaign) {
      throw new ConvexError('No campaign exists for this campaign id');
    }

    const militiaResult = await ctx.db
      .query('militia')
      .withIndex('by_campaign', (q) => q.eq('campaignId', campaign._id))
      .collect();

    if (militiaResult.length == 0) {
      throw new ConvexError('This campaign has no militia');
    }

    const militia = militiaResult[0];

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

    const campaign = await ctx.db
      .query('campaign')
      .withIndex('by_organization', (q) =>
        q.eq('organizationId', args.organizationId),
      )
      .collect();

    if (campaign.length == 0) {
      throw new ConvexError('This organization has no campaign');
    }

    const militiaResult = await ctx.db
      .query('militia')
      .withIndex('by_campaign', (q) => q.eq('campaignId', campaign[0]._id))
      .collect();

    if (militiaResult.length != 0) {
      throw new ConvexError('This campaign already has a militia');
    }

    await ctx.db.insert('militia', {
      campaignId: campaign[0]._id,
      name: args.militia.name,
      rank: args.militia.rank,
      highestBoonReached: args.militia.highestBoonReached,
      HQLocation: args.militia.HQLocation,
      treasury: args.militia.treasury,
      focus: args.militia.focus,
      training: args.militia.training,
      ambassador: args.militia.ambassador,
      commandant: args.militia.commandant,
      marshal: args.militia.marshal,
      overseer: args.militia.overseer,
      spymaster: args.militia.spymaster,
      strategist: args.militia.strategist,
    });
  },
});
