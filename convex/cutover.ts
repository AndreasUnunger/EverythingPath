import { ConvexError, compareValues, v } from 'convex/values';
import { internalMutation, internalQuery, query } from './_generated/server';
import { readCutover } from './lib/campaignRuntime';
import { zodOutputToConvex } from 'convex-helpers/server/zod4';
import { canonicalRosterDataSchema } from '../src/lib/canonical-roster';
import { campaignContextDataSchema } from '../src/lib/canonical-campaign-context';
import {
  preflightCampaignInitialization,
  initializeCampaign,
} from './lib/campaignInitialization';
import { saveRoster } from './lib/canonicalRoster';
import { saveCampaignContext } from './lib/canonicalCampaignContext';
import {
  verifyCutoverCampaign,
  cutoverActor,
  requirePausedCutover,
} from './lib/cutoverVerification';

export const status = query({
  args: {},
  returns: v.union(
    v.literal('legacy'),
    v.literal('paused'),
    v.literal('canonical'),
  ),
  handler: async (ctx) => (await readCutover(ctx))?.status ?? 'legacy',
});

const operator = { operatorTokenIdentifier: v.optional(v.string()) };
const scope = { campaignId: v.id('campaign'), militiaId: v.id('militia') };

export const inventory = internalQuery({
  args: {},
  returns: v.array(v.id('campaign')),
  handler: async (ctx) => {
    const campaigns = await ctx.db.query('campaign').take(129);
    if (campaigns.length > 128)
      throw new ConvexError('Prepare a paginated cutover for this deployment');
    return campaigns.map((campaign) => campaign._id);
  },
});

// CLI-only artifacts contain the complete reviewed source. They are not exposed
// to the browser and must be retained privately alongside the backup.
export const preflight = internalQuery({
  args: { ...scope, ...operator },
  returns: v.string(),
  handler: async (ctx, args) =>
    JSON.stringify(
      await preflightCampaignInitialization(
        cutoverActor(ctx, args.operatorTokenIdentifier),
        args,
      ),
    ),
});

export const prepare = internalMutation({
  args: {
    ...scope,
    ...operator,
    operationId: v.string(),
    roster: zodOutputToConvex(canonicalRosterDataSchema),
    context: zodOutputToConvex(campaignContextDataSchema),
    rosterRevision: v.union(v.null(), v.number()),
    contextRevision: v.union(v.null(), v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const control = await requirePausedCutover(ctx, args.operationId);
    if (!control.campaignIds.includes(args.campaignId))
      throw new ConvexError('Campaign is outside this cutover');
    const receipt = await ctx.db
      .query('canonicalCampaignInitialization')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
      .unique();
    if (receipt)
      throw new ConvexError('Cannot change preparation after initialization');
    await saveRoster(cutoverActor(ctx, args.operatorTokenIdentifier), {
      ...args,
      expectedRevision: args.rosterRevision,
    });
    await saveCampaignContext(cutoverActor(ctx, args.operatorTokenIdentifier), {
      ...args,
      expectedRevision: args.contextRevision,
    });
    return null;
  },
});

export const recordBackup = internalMutation({
  args: {
    operationId: v.string(),
    sha256: v.string(),
    location: v.string(),
    verifiedRestoreDeployment: v.string(),
    retainUntil: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { operationId, ...backup }) => {
    const control = await requirePausedCutover(ctx, operationId);
    if (
      !/^[a-f0-9]{64}$/.test(backup.sha256) ||
      !backup.location.trim() ||
      !backup.verifiedRestoreDeployment.trim() ||
      backup.retainUntil <= Date.now()
    )
      throw new ConvexError(
        'Record a verified backup and future retention deadline',
      );
    if (control.backup && compareValues(control.backup, backup) !== 0)
      throw new ConvexError('The verified backup is already recorded');
    await ctx.db.patch('campaignCutover', control._id, { backup });
    return null;
  },
});

export const initialize = internalMutation({
  args: {
    ...scope,
    ...operator,
    operationId: v.string(),
    sourceToken: v.string(),
    initializationId: v.string(),
  },
  returns: v.object({ draftId: v.string(), initialized: v.boolean() }),
  handler: async (ctx, args) => {
    const control = await requirePausedCutover(ctx, args.operationId);
    if (!control.backup)
      throw new ConvexError('Verify the paused backup before initialization');
    if (!control.campaignIds.includes(args.campaignId))
      throw new ConvexError('Campaign is outside this cutover');
    return await initializeCampaign(
      cutoverActor(ctx, args.operatorTokenIdentifier),
      args,
    );
  },
});

export const verify = internalQuery({
  args: { operationId: v.string(), ...operator },
  returns: v.array(
    v.object({
      campaignId: v.id('campaign'),
      week: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const control = await requirePausedCutover(ctx, args.operationId);
    const results = [];
    for (const campaignId of control.campaignIds)
      results.push(
        await verifyCutoverCampaign(
          cutoverActor(ctx, args.operatorTokenIdentifier),
          campaignId,
        ),
      );
    return results;
  },
});

export const activate = internalMutation({
  args: { operationId: v.string(), ...operator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await readCutover(ctx);
    if (
      existing?.operationId === args.operationId &&
      existing.status === 'canonical'
    )
      return null;
    const control = await requirePausedCutover(ctx, args.operationId);
    if (!control.backup || control.backup.retainUntil <= Date.now())
      throw new ConvexError('A retained verified backup is required');
    for (const campaignId of control.campaignIds)
      await verifyCutoverCampaign(
        cutoverActor(ctx, args.operatorTokenIdentifier),
        campaignId,
      );
    await ctx.db.patch('campaignCutover', control._id, {
      status: 'canonical',
      reopenedAt: Date.now(),
    });
    return null;
  },
});

export const resumeLegacy = internalMutation({
  args: { operationId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const control = await requirePausedCutover(ctx, args.operationId);
    for (const campaignId of control.campaignIds) {
      const militia = await ctx.db
        .query('militia')
        .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
        .unique();
      if (
        militia &&
        (await ctx.db
          .query('canonicalMilitiaState')
          .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
          .first())
      )
        throw new ConvexError(
          'Restore the verified backup before resuming the old workflow',
        );
      if (
        await ctx.db
          .query('canonicalWeeklyDraft')
          .withIndex('by_campaignId_and_status', (q) =>
            q.eq('campaignId', campaignId),
          )
          .first()
      )
        throw new ConvexError(
          'Restore the verified backup before resuming the old workflow',
        );
    }
    await ctx.db.delete('campaignCutover', control._id);
    return null;
  },
});

export const pause = internalMutation({
  args: {
    operationId: v.string(),
    oldRelease: v.string(),
    newRelease: v.string(),
    campaignIds: v.array(v.id('campaign')),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (
      !args.operationId.trim() ||
      !args.oldRelease.trim() ||
      !args.newRelease.trim()
    )
      throw new ConvexError(
        'Record the operation and both releases before pausing',
      );
    const existing = await readCutover(ctx);
    if (existing) {
      const recorded = {
        operationId: existing.operationId,
        oldRelease: existing.oldRelease,
        newRelease: existing.newRelease,
        campaignIds: existing.campaignIds,
      };
      if (compareValues(recorded, args) !== 0)
        throw new ConvexError('A different cutover is already recorded');
      return null;
    }
    const campaigns = await ctx.db.query('campaign').take(129);
    if (
      campaigns.length > 128 ||
      campaigns.length !== args.campaignIds.length ||
      new Set(args.campaignIds).size !== args.campaignIds.length ||
      campaigns.some((c) => !args.campaignIds.includes(c._id))
    )
      throw new ConvexError(
        'Review the complete campaign inventory before pausing',
      );
    await ctx.db.insert('campaignCutover', {
      key: 'weekly-draft',
      status: 'paused',
      ...args,
      pausedAt: Date.now(),
    });
    return null;
  },
});
