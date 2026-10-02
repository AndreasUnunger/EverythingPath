import { ConvexError, v } from 'convex/values';
import { type MutationCtx, type QueryCtx, query } from './_generated/server';
import { gatedWebhookMutation } from './lib/writeGate';
import { roles } from './schema';

async function getUserByTokenIdentifier(
  ctx: QueryCtx | MutationCtx,
  tokenIdentifier: string,
) {
  return await ctx.db
    .query('user')
    .withIndex('by_tokenIdentifier', (q) =>
      q.eq('tokenIdentifier', tokenIdentifier),
    )
    .first();
}

export async function getUser(
  ctx: QueryCtx | MutationCtx,
  tokenIdentifier: string,
) {
  const user = await getUserByTokenIdentifier(ctx, tokenIdentifier);

  if (!user) {
    throw new ConvexError('expected user to be defined');
  }

  return user;
}

function isNewerWebhook(updatedAt?: number, storedUpdatedAt?: number) {
  if (
    updatedAt !== undefined &&
    (!Number.isSafeInteger(updatedAt) || updatedAt < 0)
  )
    throw new ConvexError(
      'Identity update timestamp must be a nonnegative integer.',
    );
  return (
    storedUpdatedAt === undefined ||
    (updatedAt !== undefined && updatedAt > storedUpdatedAt)
  );
}

const profileArgs = {
  tokenIdentifier: v.string(),
  name: v.string(),
  image: v.string(),
  webhookUpdatedAt: v.optional(v.number()),
};

async function upsertProfile(
  ctx: MutationCtx,
  args: {
    tokenIdentifier: string;
    name: string;
    image: string;
    webhookUpdatedAt?: number;
  },
) {
  const user = await getUserByTokenIdentifier(ctx, args.tokenIdentifier);
  if (!isNewerWebhook(args.webhookUpdatedAt, user?.webhookUpdatedAt))
    return null;
  if (user) await ctx.db.patch('user', user._id, args);
  else await ctx.db.insert('user', { ...args, orgIds: [] });
  return null;
}

export const createUser = gatedWebhookMutation({
  args: profileArgs,
  returns: v.null(),
  handler: upsertProfile,
});

export const updateUser = gatedWebhookMutation({
  args: profileArgs,
  returns: v.null(),
  handler: upsertProfile,
});

const membershipArgs = {
  tokenIdentifier: v.string(),
  orgId: v.string(),
  role: roles,
  webhookUpdatedAt: v.optional(v.number()),
};

async function upsertMembership(
  ctx: MutationCtx,
  args: {
    tokenIdentifier: string;
    orgId: string;
    role: 'admin' | 'member';
    webhookUpdatedAt?: number;
  },
) {
  const user = await getUser(ctx, args.tokenIdentifier);
  const existing = user.orgIds.find((org) => org.orgId === args.orgId);
  if (!isNewerWebhook(args.webhookUpdatedAt, existing?.webhookUpdatedAt))
    return null;
  const membership = {
    orgId: args.orgId,
    role: args.role,
    ...(args.webhookUpdatedAt === undefined
      ? {}
      : { webhookUpdatedAt: args.webhookUpdatedAt }),
  };
  await ctx.db.patch('user', user._id, {
    orgIds: existing
      ? user.orgIds.map((org) => (org.orgId === args.orgId ? membership : org))
      : [...user.orgIds, membership],
  });
  return null;
}

export const addOrgIdToUser = gatedWebhookMutation({
  args: membershipArgs,
  returns: v.null(),
  handler: upsertMembership,
});

export const updateRoleInOrgForUser = gatedWebhookMutation({
  args: membershipArgs,
  returns: v.null(),
  handler: upsertMembership,
});

export const getUserProfile = query({
  args: { userId: v.id('user') },
  async handler(ctx, args) {
    const user = await ctx.db.get('user', args.userId);

    return {
      name: user?.name,
      image: user?.image,
    };
  },
});

export const getMe = query({
  args: {},
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      return null;
    }

    const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);

    return user ?? null;
  },
});

export const getOrgAccessStatus = query({
  args: {
    organizationId: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      return { state: 'unauthenticated' as const };
    }

    if (!args.organizationId) {
      return { state: 'no_org_selected' as const };
    }

    const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);

    if (!user) {
      return { state: 'no_access' as const };
    }

    const orgMembership = user.orgIds.find(
      (item) => item.orgId === args.organizationId,
    );
    const hasAccess =
      !!orgMembership || user.tokenIdentifier.includes(args.organizationId);

    if (!hasAccess) {
      return { state: 'no_access' as const };
    }

    return { state: 'ready' as const, role: orgMembership?.role };
  },
});

export async function hasAccessToOrg(
  ctx: QueryCtx | MutationCtx,
  orgId: string,
) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    return null;
  }

  const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);

  if (!user) {
    return null;
  }

  const hasAccess =
    user.orgIds.some((item) => item.orgId === orgId) ||
    user.tokenIdentifier.includes(orgId);

  if (!hasAccess) {
    return null;
  }

  return { user };
}
