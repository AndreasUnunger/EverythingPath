import { z } from 'zod';
import { ConvexError } from 'convex/values';
import {
  campaignContextSchema,
  campaignContextWarnings,
  type CampaignContext,
} from '../../src/lib/canonical-campaign-context';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { requireScope } from './canonicalDraftStorage';
import { type scopeSchema } from './canonicalStorageValidators';

type Scope = z.infer<typeof scopeSchema>;
type ReadCtx = QueryCtx | MutationCtx;
async function findContext(ctx: ReadCtx, militiaId: Scope['militiaId']) {
  return ctx.db
    .query('canonicalCampaignContext')
    .withIndex('by_militiaId', (q) => q.eq('militiaId', militiaId))
    .unique();
}
async function validateReferences(
  ctx: ReadCtx,
  scope: Scope,
  context: CampaignContext,
) {
  const roster = await ctx.db
    .query('canonicalRoster')
    .withIndex('by_militiaId', (q) => q.eq('militiaId', scope.militiaId))
    .unique();
  if (roster && roster.campaignId !== scope.campaignId)
    throw new ConvexError('Invalid roster campaign');
  const teams = new Set(roster?.roster.teams.map((x) => x.teamId));
  for (const event of context.events)
    for (const target of event.targets ?? []) {
      if (target.kind === 'team' && !teams.has(target.teamId))
        throw new ConvexError('Team must belong to this militia');
      if (target.kind === 'character') {
        const id = ctx.db.normalizeId('character', target.characterId);
        const character = id && (await ctx.db.get('character', id));
        if (character?.campaignId !== scope.campaignId)
          throw new ConvexError('Character must belong to this campaign');
      }
    }
  for (const effect of context.queuedEffects) {
    if (
      effect.effect.kind === 'team_unavailable' &&
      !teams.has(effect.effect.teamId)
    )
      throw new ConvexError('Team must belong to this militia');
  }
}
// Preparation seam only: no registered endpoint or live consumer before cutover.
export async function readCampaignContext(ctx: ReadCtx, input: Scope) {
  const scope = await requireScope(ctx, input);
  const row = await findContext(ctx, scope.militiaId);
  if (!row) return null;
  if (row.campaignId !== scope.campaignId)
    throw new ConvexError('Invalid context campaign');
  const context = campaignContextSchema.parse(row.context);
  await validateReferences(ctx, scope, context);
  return {
    context,
    revision: row.revision,
    warnings: campaignContextWarnings(context),
  };
}
export async function saveCampaignContext(
  ctx: MutationCtx,
  input: Scope & { expectedRevision: number | null; context: CampaignContext },
) {
  const scope = await requireScope(ctx, input);
  const context = campaignContextSchema.parse(input.context);
  const expected = z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .parse(input.expectedRevision);
  const current = await findContext(ctx, scope.militiaId);
  if (current && current.campaignId !== scope.campaignId)
    throw new ConvexError('Invalid context campaign');
  if ((current?.revision ?? null) !== expected)
    throw new ConvexError(
      'Context changed. Review the latest campaign facts before saving.',
    );
  await validateReferences(ctx, scope, context);
  const revision = (current?.revision ?? -1) + 1;
  if (current)
    await ctx.db.patch('canonicalCampaignContext', current._id, {
      context,
      revision,
    });
  else
    await ctx.db.insert('canonicalCampaignContext', {
      ...scope,
      context,
      revision,
    });
  return { context, revision, warnings: campaignContextWarnings(context) };
}
