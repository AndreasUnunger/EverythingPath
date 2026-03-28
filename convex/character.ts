import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { campaignValidator, characterValidator } from './schema';
import { hasAccessToOrg } from './user';
import type { MutationCtx, QueryCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';

async function assertCampaignAccess(
  ctx: QueryCtx | MutationCtx,
  campaignId: Id<'campaign'>,
  organizationId: string,
) {
  const access = await hasAccessToOrg(ctx, organizationId);
  if (!access) {
    throw new ConvexError('You do not have access to this org');
  }

  const campaign = await ctx.db.get('campaign', campaignId);
  if (campaign?.organizationId !== organizationId) {
    throw new ConvexError('No campaign exists for this organization');
  }

  return { campaign, access };
}

export const listByCampaign = query({
  args: {
    campaignId: v.optional(v.id('campaign')),
    organizationId: v.optional(campaignValidator.fields.organizationId),
    includeInactive: v.optional(v.boolean()),
  },
  async handler(ctx, args) {
    if (!args.campaignId || !args.organizationId) {
      return [];
    }

    const access = await hasAccessToOrg(ctx, args.organizationId);
    if (!access) {
      return [];
    }

    const campaign = await ctx.db.get('campaign', args.campaignId);
    if (campaign?.organizationId !== args.organizationId) {
      return [];
    }

    const characters = await ctx.db
      .query('character')
      .filter((q) => q.eq(q.field('campaignId'), args.campaignId))
      .collect();

    if (args.includeInactive) {
      return characters;
    }

    return characters.filter((character) => character.isActive !== false);
  },
});

export const createCharacter = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    character: v.object({
      campaignId: v.id('campaign'),
      name: characterValidator.fields.name,
      description: characterValidator.fields.description,
      kind: v.union(v.literal('pc'), v.literal('officer_npc')),
      level: characterValidator.fields.level,
      strength: characterValidator.fields.strength,
      dexterity: characterValidator.fields.dexterity,
      constitution: characterValidator.fields.constitution,
      wisdom: characterValidator.fields.wisdom,
      charisma: characterValidator.fields.charisma,
      intelligence: characterValidator.fields.intelligence,
    }),
  },
  async handler(ctx, args) {
    if (!args.character.name.trim()) {
      throw new ConvexError('Character name cannot be empty');
    }

    const { access } = await assertCampaignAccess(
      ctx,
      args.character.campaignId,
      args.organizationId,
    );

    return await ctx.db.insert('character', {
      ...args.character,
      ownerId: access.user.tokenIdentifier,
      isActive: true,
    });
  },
});

export const updateCharacter = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    characterId: v.id('character'),
    patch: v.object({
      name: v.optional(characterValidator.fields.name),
      description: v.optional(characterValidator.fields.description),
      kind: v.optional(v.union(v.literal('pc'), v.literal('officer_npc'))),
      level: v.optional(characterValidator.fields.level),
      strength: v.optional(characterValidator.fields.strength),
      dexterity: v.optional(characterValidator.fields.dexterity),
      constitution: v.optional(characterValidator.fields.constitution),
      wisdom: v.optional(characterValidator.fields.wisdom),
      charisma: v.optional(characterValidator.fields.charisma),
      intelligence: v.optional(characterValidator.fields.intelligence),
      isActive: v.optional(v.boolean()),
    }),
  },
  async handler(ctx, args) {
    if (args.patch.name !== undefined && !args.patch.name.trim()) {
      throw new ConvexError('Character name cannot be empty');
    }

    const character = await ctx.db.get('character', args.characterId);
    if (!character) {
      throw new ConvexError('Character not found');
    }

    await assertCampaignAccess(
      ctx,
      character.campaignId,
      args.organizationId,
    );

    await ctx.db.patch('character', args.characterId, args.patch);
  },
});

export const archiveCharacter = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    characterId: v.id('character'),
    isActive: v.boolean(),
  },
  async handler(ctx, args) {
    const character = await ctx.db.get('character', args.characterId);
    if (!character) {
      throw new ConvexError('Character not found');
    }

    await assertCampaignAccess(
      ctx,
      character.campaignId,
      args.organizationId,
    );

    await ctx.db.patch('character', args.characterId, { isActive: args.isActive });
  },
});

export const deleteCharacter = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    characterId: v.id('character'),
  },
  async handler(ctx, args) {
    const character = await ctx.db.get('character', args.characterId);
    if (!character) {
      throw new ConvexError('Character not found');
    }

    if (character.isActive !== false) {
      throw new ConvexError('Only archived characters can be hard deleted');
    }

    await assertCampaignAccess(ctx, character.campaignId, args.organizationId);

    await ctx.db.delete('character', args.characterId);
  },
});
