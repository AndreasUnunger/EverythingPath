import { createWeeklyDraft } from '../src/lib/weekly-draft';
import { weeklyDraftDataSchema } from '../src/lib/weekly-draft-contract';
import { militiaSnapshotSchema } from '../src/lib/canonical-weekly-source';
import { normalizeCharacterKind } from '../src/lib/character-kind';
import { v } from 'convex/values';
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import {
  guardFixtureScope,
  isCanonicalCase,
  roleKeys,
  type CaseKey,
  type FixtureScope,
  type WorkerCohort,
} from '../e2e/fixtures/catalog';

const caseKey = v.union(
  v.literal('smoke'),
  v.literal('isolation'),
  v.literal('existingMilitia'),
  v.literal('characterLedger'),
  v.literal('completeWeek'),
  v.literal('realtimeActionSlot'),
  v.literal('canonicalPersistence'),
  v.literal('workspaceUpkeep'),
  v.literal('workspaceNotoriety'),
  v.literal('workspaceRecovery'),
  v.literal('workspacePersistent'),
  v.literal('workspaceConfirmation'),
  v.literal('workspaceUpkeepLayout'),
  v.literal('workspaceEventReview'),
  v.literal('workspaceActivity'),
  v.literal('workspaceSettlementTouch'),
  v.literal('workspaceDrillRolls'),
  v.literal('campaignHome'),
  v.literal('campaignSections'),
  v.literal('legacyAddresses'),
  v.literal('legacyWeekLinks'),
);
const scopeArgs = {
  namespace: v.string(),
  version: v.number(),
  workerKey: v.string(),
  caseKey,
  token: v.string(),
};

// The harness always passes the cases its running test owns in this cohort.
export const isolationArgs = { isolatedWith: v.optional(v.array(caseKey)) };

function authorize(scope: FixtureScope) {
  // Installed Convex 1.34 has no generated `env` API; keep the supported runtime
  // interface until the project upgrades to the version in its AI guidelines.
  return guardFixtureScope(process.env, scope);
}

function bounded<T>(documents: T[], limit = 100) {
  if (documents.length > limit)
    throw new Error(
      'E2E fixture graph exceeds cleanup limit; recreate the preview',
    );
  return documents;
}

async function campaigns(ctx: QueryCtx | MutationCtx, scope: FixtureScope) {
  const rows = bounded(
    await ctx.db
      .query('campaign')
      .withIndex('by_e2eFixture_namespace_and_workerKey_and_caseKey', (q) =>
        q
          .eq('e2eFixture.namespace', scope.namespace)
          .eq('e2eFixture.workerKey', scope.workerKey)
          .eq('e2eFixture.caseKey', scope.caseKey),
      )
      .take(2),
    1,
  );
  for (const row of rows)
    if (row.e2eFixture?.version !== scope.version)
      throw new Error('E2E fixture version mismatch');
  return rows;
}

// Isolation canary: while a test runs, its cohort's member organization holds
// only that test's owned and comparison campaigns, and the outsider
// organization holds none. Another test sharing the cohort, a failed cleanup or
// an application-created campaign would change what the journeys see listed.
async function assertCohortIsolated(
  ctx: MutationCtx,
  scope: FixtureScope,
  worker: WorkerCohort,
  isolatedWith: CaseKey[],
) {
  if (!isolatedWith.includes(scope.caseKey))
    throw new Error('E2E isolation canary must include the reset case');
  const member = bounded(
    await ctx.db
      .query('campaign')
      .withIndex('by_organization', (q) =>
        q.eq('organizationId', worker.organizationId),
      )
      .take(101),
  );
  const outsider = await ctx.db
    .query('campaign')
    .withIndex('by_organization', (q) =>
      q.eq('organizationId', worker.outsiderOrganizationId),
    )
    .take(1);
  const foreign = member.filter(
    ({ e2eFixture }) =>
      e2eFixture?.namespace !== scope.namespace ||
      e2eFixture.version !== scope.version ||
      e2eFixture.workerKey !== scope.workerKey ||
      !(isolatedWith as string[]).includes(e2eFixture.caseKey),
  );
  if (foreign.length > 0 || outsider.length > 0)
    throw new Error(
      `E2E isolation canary: ${foreign.length} foreign member and ${outsider.length} outsider campaigns in ${scope.workerKey}`,
    );
}

async function removeGraph(ctx: MutationCtx, scope: FixtureScope) {
  for (const campaign of await campaigns(ctx, scope)) {
    const militias = bounded(
      await ctx.db
        .query('militia')
        .withIndex('by_campaign', (q) => q.eq('campaignId', campaign._id))
        .take(101),
    );
    for (const militia of militias) {
      const tables = [
        'canonicalDraftTarget',
        'canonicalWeeklyDraft',
        'canonicalDraftOperation',
        'canonicalResolutionRecord',
        'canonicalMilitiaState',
        'canonicalSourceCorrection',
        'canonicalCampaignInitialization',
      ] as const;
      for (const table of tables) {
        const rows = bounded(
          await ctx.db
            .query(table)
            .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
            .take(101),
        );
        for (const row of rows) await ctx.db.delete(table, row._id);
      }
      await ctx.db.delete('militia', militia._id);
    }
    const characters = bounded(
      await ctx.db
        .query('character')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign._id))
        .take(101),
    );
    for (const character of characters) {
      const spells = bounded(
        await ctx.db
          .query('characterSpell')
          .withIndex('characterId', (q) => q.eq('characterId', character._id))
          .take(101),
      );
      for (const spell of spells)
        await ctx.db.delete('characterSpell', spell._id);
      await ctx.db.delete('character', character._id);
    }
    await ctx.db.delete('campaign', campaign._id);
  }
}

export const seedIdentityProjection = internalMutation({
  args: scopeArgs,
  returns: v.null(),
  handler: async (ctx, scope) => {
    const { config, worker } = authorize(scope);
    for (const role of roleKeys) {
      const tokenIdentifier = `https://${config.clerkHost}|${worker[role].userId}`;
      const existing = await ctx.db
        .query('user')
        .withIndex('by_tokenIdentifier', (q) =>
          q.eq('tokenIdentifier', tokenIdentifier),
        )
        .unique();
      const owned = existing
        ? await ctx.db
            .query('e2eFixtureIdentity')
            .withIndex('by_userId', (q) => q.eq('userId', existing._id))
            .unique()
        : null;
      if (
        existing &&
        (owned?.namespace !== scope.namespace ||
          owned.workerKey !== scope.workerKey)
      ) {
        throw new Error('E2E identity is not owned by this worker');
      }
      const user = {
        tokenIdentifier,
        name: `E2E ${role}`,
        image: '',
        orgIds: [
          {
            orgId:
              role === 'outsider'
                ? worker.outsiderOrganizationId
                : worker.organizationId,
            role: role === 'gm' ? ('admin' as const) : ('member' as const),
          },
        ],
      };
      if (existing) await ctx.db.replace('user', existing._id, user);
      else {
        const userId = await ctx.db.insert('user', user);
        await ctx.db.insert('e2eFixtureIdentity', {
          namespace: scope.namespace,
          workerKey: scope.workerKey,
          userId,
        });
      }
    }
    return null;
  },
});

export const resetCase = internalMutation({
  args: { ...scopeArgs, ...isolationArgs, now: v.number() },
  returns: v.object({ campaignId: v.id('campaign'), campaignKey: v.string() }),
  handler: async (ctx, args) => {
    const { config, worker, domain } = authorize(args);
    if (!Number.isSafeInteger(args.now) || args.now < 0)
      throw new Error('Fixture time must be a nonnegative integer');
    await removeGraph(ctx, args);
    const campaignId = await ctx.db.insert('campaign', {
      name: `E2E ${domain.campaign}`,
      ownerId: `https://${config.clerkHost}|${worker.gm.userId}`,
      organizationId: worker.organizationId,
      description: 'Disposable synthetic campaign',
      inGameDate: '4717-01-01',
      e2eFixture: {
        namespace: args.namespace,
        version: args.version,
        workerKey: args.workerKey,
        caseKey: args.caseKey,
        campaignKey: domain.campaign,
      },
    });
    // A leak throws, which also rolls this reset back.
    if (args.isolatedWith)
      await assertCohortIsolated(ctx, args, worker, args.isolatedWith);
    // The onboarding journey must create its militia and officers through the UI.
    if (args.caseKey === 'existingMilitia')
      return { campaignId, campaignKey: domain.campaign };
    const characterId =
      args.caseKey === 'characterLedger'
        ? undefined
        : await ctx.db.insert('character', {
            campaignId,
            ownerId: `https://${config.clerkHost}|${worker.gm.userId}`,
            name: `E2E ${domain.character}`,
            description: 'Synthetic officer',
            // The record owns the kind its roster mirror follows. Canonical
            // journeys play this officer as a PC (Setup and their seeded
            // rosters); the others seed an NPC roster.
            kind: isCanonicalCase(args.caseKey) ? 'pc' : 'npc',
            isActive: true,
            level: 1,
            strength: 10,
            dexterity: 10,
            constitution: 10,
            intelligence: 10,
            wisdom: 10,
            charisma: 10,
          });
    const militiaId = await ctx.db.insert('militia', {
      name: `E2E ${domain.militia}`,
      campaignId,
    });
    if (!isCanonicalCase(args.caseKey)) {
      const character = characterId
        ? await ctx.db.get('character', characterId)
        : null;
      const snapshot = militiaSnapshotSchema.parse({
        rank: 1,
        training: 0,
        treasuryCopper: 10000,
        notoriety: 0,
        focus: 'Loyalty',
        characters: character
          ? [
              {
                characterId: character._id,
                isActive: true,
                level: character.level,
                strength: character.strength,
                dexterity: character.dexterity,
                constitution: character.constitution,
                intelligence: character.intelligence,
                wisdom: character.wisdom,
                charisma: character.charisma,
              },
            ]
          : [],
        roster: {
          people: character
            ? [
                {
                  characterId: character._id,
                  kind: normalizeCharacterKind(character.kind),
                  hitDice: 1,
                },
              ]
            : [],
          teams: [],
          officers: [],
        },
        settlements: [],
        bonuses: [],
      });
      const draft = weeklyDraftDataSchema.parse(
        createWeeklyDraft({
          draftId: `fixture:${campaignId}`,
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
      await ctx.db.insert('canonicalMilitiaState', {
        campaignId,
        militiaId,
        revision: 0,
        snapshot,
      });
      await ctx.db.insert('canonicalWeeklyDraft', {
        campaignId,
        militiaId,
        draftId: draft.draftId,
        draft,
        initialDraft: draft,
        status: 'open',
        revision: 0,
      });
    }
    return { campaignId, campaignKey: domain.campaign };
  },
});

export const inspectCase = internalQuery({
  args: scopeArgs,
  returns: v.object({
    campaignKey: v.string(),
    campaignCount: v.number(),
    identityCount: v.number(),
    militia: v.union(
      v.null(),
      v.object({
        treasury: v.number(),
        training: v.number(),
        week: v.number(),
        phase: v.string(),
        stagedActions: v.array(v.union(v.string(), v.null())),
      }),
    ),
    characters: v.array(v.string()),
  }),
  handler: async (ctx, scope) => {
    const { domain } = authorize(scope);
    const rows = await campaigns(ctx, scope);
    const campaign = rows[0];
    let militia: {
      treasury: number;
      training: number;
      week: number;
      phase: string;
      stagedActions: (string | null)[];
    } | null = null;
    let characters: string[] = [];
    if (campaign) {
      const current = await ctx.db
        .query('militia')
        .withIndex('by_campaign', (q) => q.eq('campaignId', campaign._id))
        .unique();
      if (current) {
        const state = await ctx.db
          .query('canonicalMilitiaState')
          .withIndex('by_militiaId', (q) => q.eq('militiaId', current._id))
          .unique();
        const week = await ctx.db
          .query('canonicalWeeklyDraft')
          .withIndex('by_campaignId_and_status', (q) =>
            q.eq('campaignId', campaign._id).eq('status', 'open'),
          )
          .unique();
        if (state && week?.draft)
          militia = {
            treasury: state.snapshot.treasuryCopper / 100,
            training: state.snapshot.training,
            week: week.draft.week,
            phase: 'upkeep',
            stagedActions: week.draft.activity.slots.map(
              (slot) => slot.choice?.actionId ?? null,
            ),
          };
      }
      characters = bounded(
        await ctx.db
          .query('character')
          .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign._id))
          .take(101),
      )
        .map((row) => row.name)
        .sort();
    }
    const identities = bounded(
      await ctx.db
        .query('e2eFixtureIdentity')
        .withIndex('by_namespace_and_workerKey', (q) =>
          q.eq('namespace', scope.namespace).eq('workerKey', scope.workerKey),
        )
        .take(4),
      3,
    );
    return {
      campaignKey: domain.campaign,
      campaignCount: rows.length,
      identityCount: identities.length,
      militia,
      characters,
    };
  },
});

export const cleanupCase = internalMutation({
  args: scopeArgs,
  returns: v.null(),
  handler: async (ctx, scope) => {
    authorize(scope);
    await removeGraph(ctx, scope);
    return null;
  },
});
