import { v } from 'convex/values';
import type { Doc } from '../_generated/dataModel';
import type { ReadCtx } from '../types';
import { getUserByTokenIdentifier } from '../user';

export const characterOwnerValidator = v.object({
  userId: v.id('user'),
  name: v.string(),
  isMine: v.boolean(),
});

export function projectOwner(user: Doc<'user'>, actor?: string) {
  const trimmedName = user.name?.trim() ?? '';
  return {
    userId: user._id,
    name: trimmedName.length > 0 ? trimmedName : 'Unnamed member',
    isMine: user.tokenIdentifier === actor,
  };
}

export async function readCharacterOwners(
  ctx: ReadCtx,
  characters: Doc<'character'>[],
  actor?: string,
) {
  const identity = actor ?? (await ctx.auth.getUserIdentity())?.tokenIdentifier;
  const ownerIds = new Set(
    characters.flatMap((character) =>
      character.ownerId ? [character.ownerId] : [],
    ),
  );
  return new Map(
    await Promise.all(
      [...ownerIds].map(async (ownerId) => {
        const user = await getUserByTokenIdentifier(ctx, ownerId);
        return [ownerId, user ? projectOwner(user, identity) : null] as const;
      }),
    ),
  );
}
