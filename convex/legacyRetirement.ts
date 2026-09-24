import { ConvexError, v } from 'convex/values';
import { internalMutation, type MutationCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { readCutover } from './lib/campaignRuntime';

// Only discarded legacy source and migration preparation belong here. The
// canonical state, operation ledger, history, characters and identities do not.
const retiredTables = [
  'militiaTeam',
  'militiaWeekState',
  'militiaResolutionRecord',
  'militiaSettlementState',
  'militiaCache',
  'militiaMarketplace',
  'militiaOrder',
  'militiaCharacterStatus',
  'militiaTeamState',
  'militiaEventState',
  'militiaOverrideNote',
  'canonicalRoster',
  'canonicalCampaignContext',
] as const;

export const batch = internalMutation({
  args: {
    operationId: v.string(),
    backupSha256: v.string(),
    militiaId: v.id('militia'),
  },
  returns: v.object({ deleted: v.number(), done: v.boolean() }),
  handler: async (ctx, args) => {
    const militia = await requireAcceptedMilitia(ctx, args);
    for (const table of retiredTables) {
      const rows = await ctx.db
        .query(table)
        .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
        .take(4);
      if (!rows.length) continue;
      for (const row of rows) await ctx.db.delete(table, row._id);
      return { deleted: rows.length, done: false };
    }
    // Preserve the ID used by every canonical reference. Remove all stale facts
    // together; never copy them over the state accepted since reopening.
    await ctx.db.replace('militia', militia._id, {
      campaignId: militia.campaignId,
      name: militia.name,
    });
    return { deleted: 0, done: true };
  },
});

async function requireAcceptedMilitia(
  ctx: MutationCtx,
  args: {
    operationId: string;
    backupSha256: string;
    militiaId: Id<'militia'>;
  },
) {
  const control = await readCutover(ctx);
  if (
    control?.status !== 'canonical' ||
    control.operationId !== args.operationId
  )
    throw new ConvexError('Accepted cutover is required before retirement');
  if (control.backup?.sha256 !== args.backupSha256)
    throw new ConvexError(
      'Identify the retained verified backup before retirement',
    );
  const militia = await ctx.db.get('militia', args.militiaId);
  if (!militia || !control.campaignIds.includes(militia.campaignId))
    throw new ConvexError('Militia is outside the accepted cutover');
  const source = await ctx.db
    .query('canonicalMilitiaState')
    .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
    .unique();
  const drafts = await ctx.db
    .query('canonicalWeeklyDraft')
    .withIndex('by_campaignId_and_status', (q) =>
      q.eq('campaignId', militia.campaignId).eq('status', 'open'),
    )
    .take(2);
  if (
    source?.campaignId !== militia.campaignId ||
    drafts.length !== 1 ||
    drafts[0]?.militiaId !== militia._id
  )
    throw new ConvexError('Canonical state and one open draft are required');
  return militia;
}
