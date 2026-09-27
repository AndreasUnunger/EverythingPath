import { ConvexError, v } from 'convex/values';
import { query, type QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import {
  requireScope,
  readResolutionRecordEntry,
} from './lib/canonicalDraftStorage';
import { canonicalRecordValidator } from './lib/canonicalStorageValidators';
import { canonicalResolutionRecordSchema } from '../src/lib/canonical-resolution-record';
import { projectHeadlineFacts } from '../src/lib/finished-week-headlines';
import { z } from 'zod';
import { zodOutputToConvex } from 'convex-helpers/server/zod4';

const provenanceValidator = zodOutputToConvex(
  canonicalResolutionRecordSchema.shape.provenance,
);
const headlineValue = v.union(v.string(), v.number(), v.boolean(), v.null());
const finishedWeekValidator = v.object({
  week: v.number(),
  effectiveRecordId: v.string(),
  effectiveSequence: v.number(),
  entryCount: v.number(),
  provenance: provenanceValidator,
  rulesetVersion: v.number(),
  createdAt: v.number(),
  headlineFacts: v.array(
    v.object({
      key: v.string(),
      label: v.string(),
      before: headlineValue,
      final: headlineValue,
      beforeRecorded: v.boolean(),
      finalRecorded: v.boolean(),
      unit: v.union(v.literal('number'), v.literal('gp'), v.literal('text')),
    }),
  ),
});
const weekSelector = z.number().int().nonnegative();
const listArgsSchema = z.strictObject({
  beforeWeek: weekSelector.optional(),
  limit: z.number().int().min(1).max(50).default(25),
  selectedWeek: weekSelector.optional(),
});

// The militia row is used solely to authorize campaign ownership, never to
// reconstruct historical facts. A campaign without a militia has no history.
async function historyScope(ctx: QueryCtx, campaignId: Id<'campaign'>) {
  const militia = await ctx.db
    .query('militia')
    .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
    .unique();
  if (!militia) throw new ConvexError('Campaign militia unavailable');
  return await requireScope(ctx, { campaignId, militiaId: militia._id });
}

function requireRecordMilitia(
  row: Doc<'canonicalResolutionRecord'>,
  militiaId: Id<'militia'>,
) {
  if (row.militiaId !== militiaId)
    throw new ConvexError('Invalid record militia reference');
  return row;
}

// Append-only storage gives each week a single chain whose highest sequence is
// the effective tip, so a descending index seek below a week boundary lands on
// the next older week's tip and skips that week's whole correction chain.
async function effectiveTip(
  ctx: QueryCtx,
  campaignId: Id<'campaign'>,
  week: { before: number | undefined } | { exact: number },
) {
  return await ctx.db
    .query('canonicalResolutionRecord')
    .withIndex('by_campaignId_and_week_and_sequence', (q) => {
      const campaign = q.eq('campaignId', campaignId);
      if ('exact' in week) return campaign.eq('week', week.exact);
      return week.before === undefined
        ? campaign
        : campaign.lt('week', week.before);
    })
    .order('desc')
    .first();
}

function finishedWeek(row: Doc<'canonicalResolutionRecord'>) {
  return {
    week: row.week,
    effectiveRecordId: row.recordId,
    effectiveSequence: row.sequence,
    // Sequences start at zero and every append supersedes the previous tip.
    entryCount: row.sequence + 1,
    provenance: row.record.provenance,
    rulesetVersion: row.record.rulesetVersion,
    createdAt: row._creationTime,
    headlineFacts: projectHeadlineFacts(row.record),
  };
}

// One bounded listing for Finished weeks and Campaign home's latest weeks:
// compact effective-record metadata only, never full records or artifacts.
export const list = query({
  args: {
    campaignId: v.id('campaign'),
    beforeWeek: v.optional(v.number()),
    limit: v.optional(v.number()),
    selectedWeek: v.optional(v.number()),
  },
  returns: v.object({
    weeks: v.array(finishedWeekValidator),
    earlierWeek: v.union(v.number(), v.null()),
    selected: v.union(finishedWeekValidator, v.null()),
  }),
  handler: async (ctx, { campaignId, ...selectors }) => {
    const parsed = listArgsSchema.safeParse(selectors);
    if (!parsed.success)
      throw new ConvexError('Invalid finished-week selection');
    const { beforeWeek, limit, selectedWeek } = parsed.data;
    const scope = await historyScope(ctx, campaignId);
    // One extra tip reveals whether an older page exists.
    const tips: Doc<'canonicalResolutionRecord'>[] = [];
    let before = beforeWeek;
    while (tips.length <= limit) {
      const tip = await effectiveTip(ctx, campaignId, { before });
      if (!tip) break;
      tips.push(requireRecordMilitia(tip, scope.militiaId));
      before = tip.week;
    }
    const weeks = tips.slice(0, limit).map(finishedWeek);
    const earlierWeek =
      tips.length > limit ? (weeks[weeks.length - 1]?.week ?? null) : null;
    if (selectedWeek === undefined)
      return { weeks, earlierWeek, selected: null };
    const listed = weeks.find((row) => row.week === selectedWeek);
    if (listed) return { weeks, earlierWeek, selected: listed };
    const tip = await effectiveTip(ctx, campaignId, { exact: selectedWeek });
    return {
      weeks,
      earlierWeek,
      selected: tip
        ? finishedWeek(requireRecordMilitia(tip, scope.militiaId))
        : null,
    };
  },
});

// Read-only history is separate from the open Workspace.
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
      createdAt: v.number(),
      previousWeek: v.union(v.number(), v.null()),
      nextWeek: v.union(v.number(), v.null()),
      audit: v.array(
        v.object({
          recordId: v.string(),
          sequence: v.number(),
          provenance: provenanceValidator,
          createdAt: v.number(),
        }),
      ),
      earlierSequence: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const scope = await historyScope(ctx, args.campaignId);
    const week =
      args.week === undefined ? undefined : weekSelector.parse(args.week);
    const before =
      args.beforeSequence === undefined
        ? undefined
        : z.number().int().nonnegative().parse(args.beforeSequence);
    const effective = await effectiveTip(
      ctx,
      args.campaignId,
      week === undefined ? { before: undefined } : { exact: week },
    );
    if (!effective) return null;
    requireRecordMilitia(effective, scope.militiaId);
    // Append enforces a single chain: every later sequence supersedes the then
    // effective record. Its highest sequence is therefore the unsuperseded tip.
    const selected =
      args.recordId === undefined
        ? {
            record: canonicalResolutionRecordSchema.parse(effective.record),
            createdAt: effective._creationTime,
          }
        : await readResolutionRecordEntry(ctx, {
            ...scope,
            recordId: args.recordId,
          });
    if (selected?.record.source.week !== effective.week)
      throw new ConvexError('Invalid historical week reference');
    const [previous, next, audit] = await Promise.all([
      effectiveTip(ctx, args.campaignId, { before: effective.week }),
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
      record: selected.record,
      createdAt: selected.createdAt,
      previousWeek: previous?.week ?? null,
      nextWeek: next?.week ?? null,
      audit: audit
        .slice(0, 5)
        .map(({ recordId, sequence, record, _creationTime }) => ({
          recordId,
          sequence,
          provenance: record.provenance,
          createdAt: _creationTime,
        })),
      earlierSequence: audit.length > 5 ? (audit[4]?.sequence ?? null) : null,
    };
  },
});
