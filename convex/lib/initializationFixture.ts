import type { Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { saveRoster } from './canonicalRoster';
import { saveCampaignContext } from './canonicalCampaignContext';
import { emptyCampaignContext } from '../../src/lib/canonical-campaign-context';
export async function seedInitializationCampaign(
  ctx: MutationCtx,
  existingCampaignId?: Id<'campaign'>,
) {
  const ids = await (async () => {
    if (!existingCampaignId)
      await ctx.db.insert('user', {
        tokenIdentifier: 'test|gm',
        orgIds: [{ orgId: 'org', role: 'admin' }],
      });
    if (!existingCampaignId)
      await ctx.db.insert('user', {
        tokenIdentifier: 'test|player',
        orgIds: [{ orgId: 'org', role: 'member' }],
      });
    const campaignId =
      existingCampaignId ??
      (await ctx.db.insert('campaign', {
        name: 'Campaign',
        ownerId: 'gm',
        organizationId: 'org',
        description: '',
      }));
    const characterId = await ctx.db.insert('character', {
      campaignId,
      name: 'Officer',
      ownerId: 'gm',
      level: 12,
      description: 'Retain notes',
      strength: 10,
      dexterity: 11,
      constitution: 12,
      intelligence: 13,
      wisdom: 14,
      charisma: 15,
    });
    const militiaId = await ctx.db.insert('militia', {
      campaignId,
      name: 'Mid-campaign',
      rank: 4,
      highestBoonReached: 5,
      HQLocation: 'HQ',
      treasury: 123.45,
      training: 42,
      focus: 'Security',
      notoriety: 17,
      commandant: characterId,
    });
    const weekId = await ctx.db.insert('militiaWeekState', {
      militiaId,
      weekNumber: 9,
      phase: 'event',
      isFirstWeek: false,
      skippedUpkeepThisWeek: false,
      upkeepTreasurySnapshot: 200,
      uneventfulBonusCarry: 3,
      lastPersistentBuyoffWeek: 6,
      queuedEffects: [
        {
          kind: 'organization_check_modifier',
          checkType: 'security',
          modifierTotal: -2,
          appliesWeek: 10,
        },
      ],
      stagedActivityActionIds: ['drill_militia'],
      lockVersion: 7,
      rollbackHistory: [{ discarded: true }],
    });
    const historyId = await ctx.db.insert('militiaResolutionRecord', {
      campaignId,
      militiaId,
      weekNumber: 8,
      source: 'confirmation',
      rulesetVersion: 1,
      baselinePlan: [],
      finalPlan: [],
      warnings: [],
      tableAdjustments: [],
      finalOutcome: {
        militia: { training: 42, treasury: 123.45, notoriety: 17 },
        nextUneventfulBonusCarry: 3,
        resolvedEvents: [],
      },
      createdAt: 1,
    });
    const teamId = await ctx.db.insert('militiaTeam', {
      militiaId,
      teamId: 'defenders',
      managerSource: 'character',
      managerCharacterId: characterId,
    });
    await ctx.db.insert('militiaTeamState', {
      militiaId,
      teamId: 'defenders',
      status: 'missing',
      notes: 'Lost patrol',
    });
    await ctx.db.insert('militiaSettlementState', {
      militiaId,
      settlementKey: 'town',
      reputation: 'Friendly',
      isSecured: true,
      temporaryShift: -1,
      refugeActivatedWeek: 7,
      refugeActiveUntilWeek: 10,
    });
    const eventId = await ctx.db.insert('militiaEventState', {
      militiaId,
      weekNumber: 8,
      eventType: 'sickness',
      isPersistent: true,
      startedWeek: 7,
      resolved: false,
      mitigationUntilWeek: 8,
    });
    const orderId = await ctx.db.insert('militiaOrder', {
      militiaId,
      description: 'Sword',
      costPaid: 12.34,
      orderedWeek: 8,
      dueWeek: 9,
      deliveryDays: 1,
      status: 'pending',
      sourceAction: 'special_order',
    });
    const cacheId = await ctx.db.insert('militiaCache', {
      militiaId,
      label: 'Cache',
      cacheClass: 'minor',
      location: 'Forest',
      contentsSummary: 'Supplies',
      status: 'hidden',
      isSecureLocation: true,
      createdWeek: 4,
      updatedWeek: 5,
    });
    return {
      scope: { campaignId, militiaId },
      characterId,
      historyId,
      weekId,
      teamId,
      eventId,
      orderId,
      cacheId,
    };
  })();
  const roster = {
    people: [{ characterId: ids.characterId, kind: 'pc' as const, hitDice: 8 }],
    officers: [{ role: 'commandant' as const, characterId: ids.characterId }],
    teams: [
      {
        teamId: `legacy-team:${ids.teamId}`,
        teamType: 'defenders' as const,
        name: 'Patrol',
        status: 'missing' as const,
        managerCharacterId: ids.characterId,
        rewardCapExempt: false,
        notes: 'Lost patrol',
      },
    ],
  };
  const context = {
    ...emptyCampaignContext(),
    resolutionAssets: {
      economy: {
        items: [
          {
            itemId: 'sword',
            name: 'Sword',
            valueCopper: 1234,
            weight: 2,
            location: 'order' as const,
          },
        ],
        caches: [
          {
            cacheId: ids.cacheId,
            cacheClass: 'minor' as const,
            location: 'Forest',
            secure: true,
            extradimensional: false,
            itemIds: [],
            status: 'hidden' as const,
            returnActivityWeek: null,
          },
        ],
        orders: [
          {
            orderId: ids.orderId,
            itemId: 'sword',
            source: 'special_order' as const,
            settlementId: 'town',
            mode: 'purchase' as const,
            orderedWeek: 8,
            orderedDay: 55,
            dueDay: 56,
            dueActivityWeek: null,
            priceCopper: 1234,
            deliveryDays: 1,
            enchantmentValueCopper: 0,
            receipt: null,
          },
        ],
        markets: [],
      },
      characterActions: { people: [] },
      eventBenefits: { skills: [], markets: [] },
    },
    treasuryCopper: 12345,
    firstMilitiaWeek: false,
    startDay: 56,
    uneventfulCarry: true,
    lastBuyoffWeek: 6,
    operatingSettlementId: 'town',
    settlements: [
      {
        settlementId: 'town',
        name: 'Town',
        reputation: 'Friendly' as const,
        secured: true,
        occupied: false,
        temporaryReputationShift: -1,
        refugeActivatedWeek: 7,
        refugeActiveUntilWeek: 10,
      },
    ],
    events: [
      {
        eventId: ids.eventId,
        eventType: 'sickness' as const,
        startedWeek: 7,
        order: 0,
        targets: [
          { kind: 'team' as const, teamId: `legacy-team:${ids.teamId}` },
        ],
        persistent: true,
        resolved: false,
        mitigationUntilWeek: 8,
        endedWeek: null,
        notes: '',
      },
    ],
    items: [{ itemId: 'sword', name: 'Sword', valueCopper: 1234 }],
    orders: [
      {
        orderId: ids.orderId,
        itemId: 'sword',
        settlementId: 'town',
        orderedDay: 55,
        dueDay: 56,
        priceCopper: 1234,
        receipt: null,
        receiptStatus: 'unreceived' as const,
        source: 'special_order' as const,
        orderedWeek: 8,
        dueActivityWeek: null,
        deliveryDays: 1,
        expedited: true,
        enchantment: null,
        notes: '',
      },
    ],
    caches: [
      {
        cacheId: ids.cacheId,
        label: 'Cache',
        cacheClass: 'minor' as const,
        location: 'Forest',
        contents: 'Supplies',
        status: 'hidden' as const,
        secure: true,
      },
    ],
    queuedEffects: [
      {
        effectId: 'q',
        sourceId: `legacy-queue:${ids.weekId}:0`,
        startsWeek: 10,
        endsWeek: 10,
        effect: {
          kind: 'check_modifier' as const,
          check: 'security' as const,
          value: -2,
        },
      },
    ],
    bonuses: [
      {
        bonusId: 'reward',
        source: 'Reward',
        check: 'loyalty' as const,
        value: 2,
        availableWeek: 9,
        consumedWeek: null,
      },
    ],
  };
  await saveRoster(ctx, { ...ids.scope, expectedRevision: null, roster });
  await saveCampaignContext(ctx, {
    ...ids.scope,
    expectedRevision: null,
    context,
  });
  return { ...ids, roster, context };
}
