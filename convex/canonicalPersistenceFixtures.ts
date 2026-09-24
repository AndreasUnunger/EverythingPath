import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';
import { mutation } from './_generated/server';
import { internal } from './_generated/api';
import { zodOutputToConvex } from 'convex-helpers/server/zod4';
import { z } from 'zod';
import { v } from 'convex/values';
import { confirmationInspectionSchema } from '../src/lib/weekly-confirmation-contract';
import { internalMutation, type MutationCtx } from './_generated/server';
import {
  scopeSchema as fixtureScopeSchema,
  guardFixtureScope,
} from '../e2e/fixtures/catalog';
import {
  draftKeySchema,
  canonicalRecordValidator,
} from './lib/canonicalStorageValidators';
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
    });
    return key;
  },
});
// One guarded transaction avoids a separate CLI startup for every contract case.
export const resetAndInitialize = internalMutation({
  args: {
    scope: zodOutputToConvex(fixtureScopeSchema),
    draftId: v.string(),
    now: v.number(),
  },
  returns: zodOutputToConvex(draftKeySchema),
  handler: async (ctx, args): Promise<z.infer<typeof draftKeySchema>> => {
    await ctx.runMutation(internal.e2eFixtures.resetCase, {
      ...args.scope,
      now: args.now,
    });
    return await ctx.runMutation(
      internal.canonicalPersistenceFixtures.initialize,
      {
        scope: args.scope,
        draftId: args.draftId,
      },
    );
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
    if (row?.campaignId !== args.campaignId || row.militiaId !== args.militiaId)
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

const lifecycleArgs = draftKeySchema.extend({ scope: fixtureScopeSchema });
async function ownedSource(
  ctx: MutationCtx,
  args: z.infer<typeof lifecycleArgs>,
) {
  const campaign = await ownedCampaign(ctx, args.scope);
  if (campaign._id !== args.campaignId)
    throw new Error('Wrong fixture campaign');
  const state = await ctx.db
    .query('canonicalMilitiaState')
    .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
    .unique();
  if (state?.campaignId !== campaign._id)
    throw new Error('Wrong fixture militia');
  const row = await ctx.db
    .query('canonicalWeeklyDraft')
    .withIndex('by_draftId', (q) => q.eq('draftId', args.draftId))
    .unique();
  if (row?.militiaId !== state.militiaId || row.campaignId !== campaign._id)
    throw new Error('Wrong fixture draft');
  return { state, row };
}
export const changeSource = internalMutation({
  args: zodOutputToConvex(
    lifecycleArgs.extend({
      change: z.enum(['revision', 'treasury', 'invalid_reference']),
    }),
  ),
  returns: v.null(),
  handler: async (ctx, args) => {
    const { state } = await ownedSource(ctx, args);
    const snapshot = militiaSnapshotSchema.parse(state.snapshot);
    if (args.change === 'treasury') snapshot.treasuryCopper += 7;
    if (args.change === 'invalid_reference')
      snapshot.bonuses.push({
        bonusId: 'broken',
        source: 'fixture',
        check: 'any',
        value: 1,
        teamId: 'foreign',
        phase: 'activity',
        availableWeek: 1,
        consumedWeek: null,
      });
    await ctx.db.patch('canonicalMilitiaState', state._id, {
      revision: state.revision + 1,
      snapshot,
    });
    return null;
  },
});
export const blockSuccessor = internalMutation({
  args: zodOutputToConvex(
    lifecycleArgs.extend({ operationId: z.string().min(1) }),
  ),
  returns: v.null(),
  handler: async (ctx, args) => {
    await ownedSource(ctx, args);
    // A real final-write identity collision proves rollback after snapshot,
    // immutable record and source closure writes, without a production fault flag.
    await ctx.db.insert('canonicalWeeklyDraft', {
      campaignId: args.campaignId,
      militiaId: args.militiaId,
      draftId: `next:${args.operationId}`,
      revision: 0,
      status: 'closed',
      draft: null,
    });
    return null;
  },
});
export const inspect = internalMutation({
  args: zodOutputToConvex(lifecycleArgs),
  returns: v.object({
    ...zodOutputToConvex(confirmationInspectionSchema.omit({ records: true }))
      .fields,
    records: v.array(canonicalRecordValidator),
  }),
  handler: async (ctx, args) => {
    const { state, row } = await ownedSource(ctx, args);
    const drafts = await ctx.db
      .query('canonicalWeeklyDraft')
      .withIndex('by_campaignId_and_status', (q) =>
        q.eq('campaignId', args.campaignId).eq('status', 'open'),
      )
      .take(2);
    const records = await ctx.db
      .query('canonicalResolutionRecord')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', args.militiaId))
      .take(10);
    return confirmationInspectionSchema.parse({
      sourceRevision: state.revision,
      snapshot: state.snapshot,
      source: {
        draftId: row.draftId,
        revision: row.revision,
        status: row.status,
        draft: row.draft,
        targetRevisions: [],
      },
      openDrafts: drafts.map((draft) => draft.draft),
      records: records.map((row) => row.record),
    });
  },
});

export const initializeUpkeep = internalMutation({
  args: {
    scope: zodOutputToConvex(fixtureScopeSchema),
    draftId: v.string(),
    choices: v.optional(v.boolean()),
    persistent: v.optional(v.boolean()),
  },
  returns: zodOutputToConvex(draftKeySchema),
  handler: async (ctx, args): Promise<z.infer<typeof draftKeySchema>> => {
    const key = await ctx.runMutation(
      internal.canonicalPersistenceFixtures.initialize,
      { scope: args.scope, draftId: args.draftId },
    );
    const { state, row } = await ownedSource(ctx, {
      ...key,
      scope: args.scope,
    });
    const character = await ctx.db
      .query('character')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', key.campaignId))
      .first();
    if (!character) throw new Error('Missing fixture officer');
    const snapshot = militiaSnapshotSchema.parse({
      ...state.snapshot,
      rank: 2,
      training: 14,
      treasuryCopper: 5000,
      roster: {
        people: [{ characterId: character._id, kind: 'pc', hitDice: 2 }],
        teams: args.choices
          ? [
              {
                teamId: 'upkeep-scouts',
                teamType: 'patrons',
                name: 'Scouts',
                status: 'disabled',
                managerCharacterId: null,
                rewardCapExempt: false,
                notes: '',
              },
            ]
          : [],
        officers: [{ characterId: character._id, role: 'ambassador' }],
      },
      settlements: args.choices
        ? [
            {
              settlementId: 'phaendar',
              name: 'Phaendar',
              reputation: 'Indifferent',
              secured: false,
              occupied: false,
              temporaryReputationShift: 0,
              refugeActivatedWeek: null,
              refugeActiveUntilWeek: null,
            },
            {
              settlementId: 'misthome',
              name: 'Misthome',
              reputation: 'Indifferent',
              secured: false,
              occupied: false,
              temporaryReputationShift: 0,
              refugeActivatedWeek: null,
              refugeActiveUntilWeek: null,
            },
          ]
        : [],
      characters: [
        {
          characterId: character._id,
          level: 2,
          strength: 10,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 10,
          charisma: 10,
          isActive: true,
        },
      ],
    });
    const draft = createWeeklyDraft({
      draftId: args.draftId,
      week: 4,
      slotIds: ['left', 'right', 'extra'],
      context: {
        firstMilitiaWeek: false,
        startDay: 21,
        uneventfulCarry: false,
        carriedEvents: [],
        queuedEffects: [],
        orders: [],
        lastBuyoffWeek: null,
      },
    });
    draft.event.chanceRoll = {
      dice: [100],
      sides: 100,
      provenance: { kind: 'table' },
      modifiers: [],
    };
    if (args.persistent) {
      snapshot.treasuryCopper = 50000;
      snapshot.roster.teams = ['Scouts', 'Rangers'].map((name, index) => ({
        teamId: `persistent-team-${index}`,
        teamType: 'patrons',
        name,
        status: 'active',
        managerCharacterId: null,
        rewardCapExempt: false,
        notes: '',
      }));
      draft.context = {
        ...draft.context,
        persistentPhaseEligible: true,
        carriedEvents: [
          {
            eventId: 'theft-old',
            eventType: 'theft',
            startedWeek: 1,
            order: 0,
            targets: [],
          },
          {
            eventId: 'theft-new',
            eventType: 'theft',
            startedWeek: 2,
            order: 1,
            targets: [],
          },
          {
            eventId: 'rivalry',
            eventType: 'rivalry',
            startedWeek: 3,
            order: 2,
            targets: snapshot.roster.teams.map((team) => ({
              kind: 'team',
              teamId: team.teamId,
            })),
          },
        ],
      };
      draft.upkeep.rolls = {
        check: {
          dice: [20],
          sides: 20,
          provenance: { kind: 'table' },
          modifiers: [],
        },
        training: {
          dice: [1],
          sides: 6,
          provenance: { kind: 'table' },
          modifiers: [],
        },
      };
    }
    await ctx.db.patch('canonicalMilitiaState', state._id, { snapshot });
    await ctx.db.patch('canonicalWeeklyDraft', row._id, {
      draft: weeklyDraftDataSchema.parse(draft),
      initialDraft: weeklyDraftDataSchema.parse(draft),
    });
    return key;
  },
});

// Test-only source installation remains bound to the owned disposable campaign.
export const installAcceptanceSource = internalMutation({
  args: zodOutputToConvex(
    lifecycleArgs.extend({
      draft: weeklyDraftDataSchema,
      snapshot: militiaSnapshotSchema,
    }),
  ),
  returns: v.null(),
  handler: async (ctx, args) => {
    const { state, row } = await ownedSource(ctx, args);
    if (row.status !== 'open' || row.revision !== 0 || state.revision !== 0)
      throw new Error('Acceptance source requires a fresh fixture');
    if (args.draft.draftId !== row.draftId || args.draft.revision !== 0)
      throw new Error('Acceptance draft identity mismatch');
    const draft = weeklyDraftDataSchema.parse(args.draft);
    const snapshot = militiaSnapshotSchema.parse(args.snapshot);
    await ctx.db.patch('canonicalMilitiaState', state._id, { snapshot });
    await ctx.db.patch('canonicalWeeklyDraft', row._id, {
      draft,
      initialDraft: draft,
    });
    return null;
  },
});

// A guarded canonical-only fixture replaces the completed migration rehearsal.
export const acceptedCampaign = mutation({
  args: { scope: zodOutputToConvex(fixtureScopeSchema) },
  returns: zodOutputToConvex(draftKeySchema),
  handler: async (ctx, args) => {
    const campaign = await ownedCampaign(ctx, args.scope);
    const militia = await ctx.db
      .query('militia')
      .withIndex('by_campaign', (q) => q.eq('campaignId', campaign._id))
      .unique();
    if (!militia) throw new Error('Missing fresh fixture militia');
    const state = await ctx.db
      .query('canonicalMilitiaState')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
      .first();
    if (state) throw new Error('Reset the accepted campaign fixture first');
    await ctx.db.delete('militia', militia._id);
    return (await seedAcceptedCampaign(ctx, campaign._id)).key;
  },
});
