import { ConvexError } from 'convex/values';
import type { Id } from '../_generated/dataModel';
import type { ReadCtx } from '../types';
import { hasAccessToOrg } from '../user';

type CampaignScope = {
  campaignId: Id<'campaign'>;
  organizationId: string;
};

export async function requireCharacterCampaignAccess(
  ctx: ReadCtx,
  { campaignId, organizationId }: CampaignScope,
) {
  const access = await hasAccessToOrg(ctx, organizationId);
  if (!access) throw new ConvexError('You do not have access to this org');
  const campaign = await ctx.db.get('campaign', campaignId);
  if (campaign?.organizationId !== organizationId)
    throw new ConvexError('No campaign exists for this organization');
  return { campaign, access };
}

export async function listAccessibleCharacters(
  ctx: ReadCtx,
  args: Partial<CampaignScope> & { includeInactive?: boolean },
) {
  const { campaignId, organizationId } = args;
  if (!campaignId || !organizationId) return [];
  const access = await hasAccessToOrg(ctx, organizationId);
  if (!access) return [];
  const campaign = await ctx.db.get('campaign', campaignId);
  if (campaign?.organizationId !== organizationId) return [];

  const characters = await ctx.db
    .query('character')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
    .collect();
  return args.includeInactive
    ? characters
    : characters.filter((character) => character.isActive);
}

export async function requireCharacterAccess(
  ctx: ReadCtx,
  args: {
    characterId: Id<'character'>;
    organizationId: string;
  },
) {
  const character = await ctx.db.get('character', args.characterId);
  if (!character) throw new ConvexError('Character not found');
  await requireCharacterCampaignAccess(ctx, {
    campaignId: character.campaignId,
    organizationId: args.organizationId,
  });
  return character;
}
