import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { campaignValidator, militiaValidator } from './schema';
import { hasAccessToOrg } from './user';
import type { IMilitia, ITeam } from '../src/lib/types';
import type { Id } from './_generated/dataModel';
import teams from './data/teams';

const officerRoleValidator = v.union(
  v.literal('ambassador'),
  v.literal('commandant'),
  v.literal('marshal'),
  v.literal('overseer'),
  v.literal('spymaster'),
  v.literal('strategist'),
);

function getOfficerAssignmentWarnings({
  source,
  characterKind,
}: {
  source: 'direct' | 'action';
  characterKind?: 'pc' | 'officer_npc';
}) {
  const warnings: { code: string; message: string }[] = [];

  if (source === 'direct') {
    warnings.push({
      code: 'requires_change_officer_role_action',
      message:
        'Officer role updated now. If your table is tracking actions strictly, spend one Activity action on Change Officer Role to reconcile this update.',
    });
  }

  if (characterKind && characterKind !== 'pc' && characterKind !== 'officer_npc') {
    warnings.push({
      code: 'character_kind_unexpected',
      message: 'Assigned character type is not typical for officer roles.',
    });
  }

  return warnings;
}

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

export const assignOfficerRole = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    militiaId: v.id('militia'),
    role: officerRoleValidator,
    characterId: v.optional(v.id('character')),
    source: v.union(v.literal('direct'), v.literal('action')),
    reason: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const access = await hasAccessToOrg(ctx, args.organizationId);
    if (!access) {
      throw new ConvexError('You do not have access to this org');
    }

    const militia = await ctx.db.get('militia', args.militiaId);
    if (!militia) {
      throw new ConvexError('Militia not found');
    }

    const campaign = await ctx.db.get('campaign', militia.campaignId);
    if (campaign?.organizationId !== args.organizationId) {
      throw new ConvexError('No campaign exists for this organization');
    }

    let characterKind: 'pc' | 'officer_npc' | undefined;
    if (args.characterId) {
      const character = await ctx.db.get('character', args.characterId);
      if (!character) {
        throw new ConvexError('Character not found');
      }
      if (character.campaignId !== militia.campaignId) {
        throw new ConvexError(
          'Character must belong to the same campaign as the militia',
        );
      }
      if (character.isActive === false) {
        throw new ConvexError(
          'Cannot assign an archived character to an officer role',
        );
      }
      characterKind = character.kind;
    }

    const warnings = getOfficerAssignmentWarnings({
      source: args.source,
      characterKind,
    });

    await ctx.db.patch('militia', args.militiaId, {
      [args.role]: args.characterId,
    } as Partial<{
      ambassador: Id<'character'> | undefined;
      commandant: Id<'character'> | undefined;
      marshal: Id<'character'> | undefined;
      overseer: Id<'character'> | undefined;
      spymaster: Id<'character'> | undefined;
      strategist: Id<'character'> | undefined;
    }>);

    if (warnings.length || args.reason) {
      const createdAt = Date.now();
      for (const warning of warnings) {
        await ctx.db.insert('militiaOverrideNote', {
          militiaId: args.militiaId,
          scope: 'militia',
          fieldPath: `officer.${args.role}`,
          warningCode: warning.code,
          isIntentionalOverride: args.source === 'direct',
          reason: args.reason,
          actorUserId: access.user.tokenIdentifier,
          createdAt,
        });
      }
    }

    return { warnings };
  },
});
