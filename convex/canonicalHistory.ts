import { ConvexError, v } from 'convex/values';
import { query } from './_generated/server';
import { requireIsolated } from './lib/canonicalIsolation';
import {
  requireScope,
  readResolutionRecord,
} from './lib/canonicalDraftStorage';
import { canonicalRecordValidator } from './lib/canonicalStorageValidators';
import { canonicalResolutionRecordSchema } from '../src/lib/canonical-resolution-record';
import { z } from 'zod';
import { zodOutputToConvex } from 'convex-helpers/server/zod4';

// Read-only history is separate from the open Workspace. The militia row is used
// solely to authorize campaign ownership, never to reconstruct historical facts.
export const read = query({
  args: {
    campaignId: v.id('campaign'),
    week: v.optional(v.number()),
    recordId: v.optional(v.string()),
    beforeSequence: v.optional(v.number()),
  },
  returns: v.union(
    v.null(),
    v.object({
      week: v.number(),
      effectiveRecordId: v.string(),
      record: canonicalRecordValidator,
      previousWeek: v.union(v.number(), v.null()),
      nextWeek: v.union(v.number(), v.null()),
      audit: v.array(
        v.object({
          recordId: v.string(),
          sequence: v.number(),
          provenance: zodOutputToConvex(
            canonicalResolutionRecordSchema.shape.provenance,
          ),
        }),
      ),
      earlierSequence: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    await requireIsolated(ctx, args.campaignId);
    const militia = await ctx.db
      .query('militia')
      .withIndex('by_campaign', (q) => q.eq('campaignId', args.campaignId))
      .unique();
    if (!militia) throw new ConvexError('Campaign militia unavailable');
    const scope = { campaignId: args.campaignId, militiaId: militia._id };
    await requireScope(ctx, scope);
    const week =
      args.week === undefined
        ? undefined
        : z.number().int().nonnegative().parse(args.week);
    const before =
      args.beforeSequence === undefined
        ? undefined
        : z.number().int().nonnegative().parse(args.beforeSequence);
    const effective = await ctx.db
      .query('canonicalResolutionRecord')
      .withIndex('by_campaignId_and_week_and_sequence', (q) => {
        const campaign = q.eq('campaignId', args.campaignId);
        return week === undefined ? campaign : campaign.eq('week', week);
      })
      .order('desc')
      .first();
    if (!effective) return null;
    if (effective.militiaId !== scope.militiaId)
      throw new ConvexError('Invalid record militia reference');
    // Append enforces a single chain: every later sequence supersedes the then
    // effective record. Its highest sequence is therefore the unsuperseded tip.
    const record =
      args.recordId === undefined
        ? canonicalResolutionRecordSchema.parse(effective.record)
        : await readResolutionRecord(ctx, {
            ...scope,
            recordId: args.recordId,
          });
    if (record?.source.week !== effective.week)
      throw new ConvexError('Invalid historical week reference');
    const [previous, next, audit] = await Promise.all([
      ctx.db
        .query('canonicalResolutionRecord')
        .withIndex('by_campaignId_and_week_and_sequence', (q) =>
          q.eq('campaignId', args.campaignId).lt('week', effective.week),
        )
        .order('desc')
        .first(),
      ctx.db
        .query('canonicalResolutionRecord')
        .withIndex('by_campaignId_and_week_and_sequence', (q) =>
          q.eq('campaignId', args.campaignId).gt('week', effective.week),
        )
        .order('asc')
        .first(),
      ctx.db
        .query('canonicalResolutionRecord')
        .withIndex('by_campaignId_and_week_and_sequence', (q) => {
          const records = q
            .eq('campaignId', args.campaignId)
            .eq('week', effective.week);
          return before === undefined
            ? records
            : records.lt('sequence', before);
        })
        .order('desc')
        .take(6),
    ]);
    return {
      week: effective.week,
      effectiveRecordId: effective.recordId,
      record,
      previousWeek: previous?.week ?? null,
      nextWeek: next?.week ?? null,
      audit: audit.slice(0, 5).map(({ recordId, sequence, record }) => ({
        recordId,
        sequence,
        provenance: record.provenance,
      })),
      earlierSequence: audit.length > 5 ? (audit[4]?.sequence ?? null) : null,
    };
  },
});
