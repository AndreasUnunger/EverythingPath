import { zodOutputToConvex } from 'convex-helpers/server/zod4';
import { type z } from 'zod';
import { v } from 'convex/values';
import { internalMutation, type MutationCtx } from './_generated/server';
import {
  scopeSchema as fixtureScopeSchema,
  guardFixtureScope,
} from '../e2e/fixtures/catalog';
import { draftKeySchema } from './lib/canonicalStorageValidators';
import { weeklyDraftDataSchema } from '../src/lib/weekly-draft-contract';
import { createWeeklyDraft } from '../src/lib/weekly-draft';
import { militiaSnapshotSchema } from '../src/lib/canonical-weekly-source';

type Scope = z.infer<typeof fixtureScopeSchema>;
async function ownedCampaign(ctx: MutationCtx, scope: Scope) {
  guardFixtureScope(process.env, scope);
  if (scope.caseKey !== 'canonicalPersistence')
    throw new Error('Wrong fixture case');
  const campaign = await ctx.db
    .query('campaign')
    .withIndex('by_e2eFixture_namespace_and_workerKey_and_caseKey', (q) =>
      q
        .eq('e2eFixture.namespace', scope.namespace)
        .eq('e2eFixture.workerKey', scope.workerKey)
        .eq('e2eFixture.caseKey', scope.caseKey),
    )
    .unique();
  if (campaign?.e2eFixture?.version !== scope.version)
    throw new Error('Missing owned fixture campaign');
  return campaign;
}
export const initialize = internalMutation({
  args: { scope: zodOutputToConvex(fixtureScopeSchema), draftId: v.string() },
  returns: zodOutputToConvex(draftKeySchema),
  handler: async (ctx, args) => {
    const campaign = await ownedCampaign(ctx, args.scope);
    const militia = await ctx.db
      .query('militia')
      .withIndex('by_campaign', (q) => q.eq('campaignId', campaign._id))
      .unique();
    if (!militia) throw new Error('Missing fixture militia');
    const existing = await ctx.db
      .query('canonicalWeeklyDraft')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
      .first();
    if (existing) throw new Error('Reset the owned case before initializing');
    const key = {
      campaignId: campaign._id,
      militiaId: militia._id,
      draftId: args.draftId,
    };
    const draft = weeklyDraftDataSchema.parse(
      createWeeklyDraft({
        draftId: args.draftId,
        week: 1,
        slotIds: ['left', 'right', 'extra'],
        context: {
          firstMilitiaWeek: true,
          startDay: 0,
          uneventfulCarry: false,
          carriedEvents: [],
          queuedEffects: [],
          orders: [],
          lastBuyoffWeek: null,
        },
      }),
    );
    const snapshot = militiaSnapshotSchema.parse({
      rank: 1,
      training: 0,
      treasuryCopper: 100,
      notoriety: 0,
      focus: 'Loyalty',
      roster: { people: [], teams: [], officers: [] },
      characters: [],
      settlements: [],
      bonuses: [],
    });
    await ctx.db.insert('canonicalMilitiaState', {
      campaignId: key.campaignId,
      militiaId: key.militiaId,
      revision: 0,
      snapshot,
    });
    await ctx.db.insert('canonicalWeeklyDraft', {
      ...key,
      status: 'open',
      draft,
      initialDraft: draft,
      revision: 0,
      targetRevisions: [],
    });
    return key;
  },
});
export const close = internalMutation({
  args: zodOutputToConvex(draftKeySchema.extend({ scope: fixtureScopeSchema })),
  returns: v.null(),
  handler: async (ctx, args) => {
    const campaign = await ownedCampaign(ctx, args.scope);
    if (campaign._id !== args.campaignId)
      throw new Error('Wrong fixture campaign');
    const row = await ctx.db
      .query('canonicalWeeklyDraft')
      .withIndex('by_draftId', (q) => q.eq('draftId', args.draftId))
      .unique();
    if (
      row?.campaignId !== args.campaignId ||
      row.militiaId !== args.militiaId
    )
      throw new Error('Wrong fixture draft');
    await ctx.db.patch('canonicalWeeklyDraft', row._id, {
      status: 'closed',
      draft: null,
      initialDraft: undefined,
    });
    const operations = await ctx.db
      .query('canonicalDraftOperation')
      .withIndex('by_draftId_and_operationId', (q) =>
        q.eq('draftId', args.draftId),
      )
      .take(101);
    if (operations.length > 100)
      throw new Error('Fixture operation limit exceeded');
    for (const operation of operations)
      await ctx.db.patch('canonicalDraftOperation', operation._id, {
        acceptedDraft: undefined,
      });
    return null;
  },
});
