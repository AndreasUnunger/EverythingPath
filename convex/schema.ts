import { campaignContextDataSchema } from '../src/lib/canonical-campaign-context';
import { canonicalRosterDataSchema } from '../src/lib/canonical-roster';
import { zodOutputToConvex } from 'convex-helpers/server/zod4';
import { defineSchema, defineTable } from 'convex/server';
import { draftStorageValidator, operationStorageValidator, recordStorageValidator } from './lib/canonicalStorageValidators';
import { v } from 'convex/values';
import {
  activityActionIdValidator,
  eventTypeValidator,
  reputationValidator,
  tableAdjustmentValidator,
  teamIdValidator,
  teamStatusValidator,
  weeklyResolutionChangeValidator,
} from '../src/lib/weekly-resolution-contract';

export const spellValidator = v.object({
  name: v.string(),
  spellLevel: v.string(),
  school: v.string(),
  subschool: v.string(),
  descriptor: v.string(),
  castingTime: v.string(),
  components: v.string(),
  hasCostlyComponents: v.boolean(),
  range: v.string(),
  area: v.string(),
  effect: v.string(),
  targets: v.string(),
  duration: v.string(),
  dismissible: v.boolean(),
  shapeable: v.boolean(),
  savingThrow: v.string(),
  spellResistance: v.string(),
  description: v.string(),
  descriptionFormatted: v.string(),
  source: v.string(),
  fullText: v.string(),
  verbal: v.boolean(),
  somatic: v.boolean(),
  material: v.boolean(),
  requiresFocus: v.boolean(),
  requiresDivineFocus: v.boolean(),
  sorcerer: v.nullable(v.number()),
  wizard: v.nullable(v.number()),
  cleric: v.nullable(v.number()),
  druid: v.nullable(v.number()),
  ranger: v.nullable(v.number()),
  bard: v.nullable(v.number()),
  paladin: v.nullable(v.number()),
  alchemist: v.nullable(v.number()),
  summoner: v.nullable(v.number()),
  witch: v.nullable(v.number()),
  inquisitor: v.nullable(v.number()),
  oracle: v.nullable(v.number()),
  antipaladin: v.nullable(v.number()),
  magus: v.nullable(v.number()),
  adept: v.nullable(v.number()),
  deity: v.string(),
  SLALevel: v.nullable(v.number()),
  domain: v.string(),
  shortDescription: v.string(),
  acid: v.boolean(),
  air: v.boolean(),
  chaotic: v.boolean(),
  cold: v.boolean(),
  curse: v.boolean(),
  darkness: v.boolean(),
  death: v.boolean(),
  disease: v.boolean(),
  earth: v.boolean(),
  electricity: v.boolean(),
  emotion: v.boolean(),
  evil: v.boolean(),
  fear: v.boolean(),
  fire: v.boolean(),
  force: v.boolean(),
  good: v.boolean(),
  languageDependent: v.boolean(),
  lawful: v.boolean(),
  light: v.boolean(),
  mindAffecting: v.boolean(),
  pain: v.boolean(),
  poison: v.boolean(),
  shadow: v.boolean(),
  sonic: v.boolean(),
  water: v.boolean(),
  linkText: v.nullable(v.string()),
  id: v.number(),
  materialCosts: v.nullable(v.number()),
  bloodline: v.string(),
  patron: v.string(),
  mythicText: v.string(),
  augmented: v.string(),
  mythic: v.boolean(),
  bloodrager: v.nullable(v.number()),
  shaman: v.nullable(v.number()),
  psychic: v.nullable(v.number()),
  medium: v.nullable(v.number()),
  mesmerist: v.nullable(v.number()),
  occultist: v.nullable(v.number()),
  spiritualist: v.nullable(v.number()),
  skald: v.nullable(v.number()),
  investigator: v.nullable(v.number()),
  hunter: v.nullable(v.number()),
  ruse: v.boolean(),
  draconic: v.boolean(),
  meditative: v.boolean(),
  summonerUnchained: v.nullable(v.number()),
});

export const characterValidator = v.object({
  name: v.string(),
  // Widened during ownerId migration. Narrow back to v.string() after backfill.
  ownerId: v.union(v.string(), v.number()),
  campaignId: v.id('campaign'),
  description: v.string(),
  kind: v.optional(v.union(v.literal('pc'), v.literal('officer_npc'))),
  isActive: v.optional(v.boolean()),
  level: v.number(),
  strength: v.number(),
  dexterity: v.number(),
  constitution: v.number(),
  wisdom: v.number(),
  charisma: v.number(),
  intelligence: v.number(),
});

export const campaignValidator = v.object({
  name: v.string(),
  ownerId: v.string(),
  organizationId: v.string(),
  description: v.string(),
  inGameDate: v.optional(v.string()),
  e2eFixture: v.optional(
    v.object({
      namespace: v.string(),
      version: v.number(),
      workerKey: v.string(),
      caseKey: v.string(),
      campaignKey: v.string(),
    }),
  ),
});

export const phaseValidator = v.union(
  v.literal('upkeep'),
  v.literal('activity'),
  v.literal('event'),
  v.literal('persistent'),
  v.literal('week_closed'),
);

export const queueEffectValidator = v.object({
  kind: v.union(
    v.literal('week_of_pain_checks_penalty'),
    v.literal('double_upkeep_attrition'),
    v.literal('week_of_serenity_checks_bonus'),
    v.literal('double_next_activity_training_gain'),
    v.literal('all_is_calm_auto_next_week'),
    v.literal('auto_event_roll_once'),
    v.literal('auto_event_roll_twice'),
    v.literal('organization_check_modifier'),
    v.literal('activity_action_block'),
    v.literal('team_check_modifier'),
    v.literal('table_note'),
  ),
  appliesWeek: v.number(),
  note: v.optional(v.string()),
  checkType: v.optional(
    v.union(
      v.literal('all'),
      v.literal('activity'),
      v.literal('loyalty'),
      v.literal('security'),
      v.literal('secrecy'),
    ),
  ),
  modifierTotal: v.optional(v.number()),
  blockedActionId: v.optional(v.literal('secure_cache')),
  teamId: v.optional(v.string()),
  location: v.optional(v.string()),
  strikeTeamMode: v.optional(
    v.union(v.literal('combat_support'), v.literal('extraction')),
  ),
  sourceEventType: v.optional(v.string()),
});

export const militiaValidator = v.object({
  name: v.string(),
  campaignId: v.id('campaign'),
  rank: v.number(),
  highestBoonReached: v.number(),
  HQLocation: v.string(),
  treasury: v.number(),
  // Widened during notoriety migration. Narrow back to required after backfill.
  notoriety: v.optional(v.number()),
  focus: v.nullable(
    v.union(v.literal('Secrecy'), v.literal('Loyalty'), v.literal('Security')),
  ),
  training: v.number(),
  ambassador: v.optional(v.id('character')),
  commandant: v.optional(v.id('character')),
  marshal: v.optional(v.id('character')),
  overseer: v.optional(v.id('character')),
  spymaster: v.optional(v.id('character')),
  strategist: v.optional(v.id('character')),
});

export const officerRoleValidator = v.union(
  v.literal('ambassador'),
  v.literal('commandant'),
  v.literal('marshal'),
  v.literal('overseer'),
  v.literal('spymaster'),
  v.literal('strategist'),
);

export const teamManagerSourceValidator = v.union(
  v.literal('character'),
  v.literal('freeform'),
);

export const teamManagerKindValidator = v.union(
  v.literal('pc'),
  v.literal('officer_npc'),
  v.literal('other_npc'),
);

export const weeklyResolutionWarningValidator = v.object({
  code: v.string(),
  message: v.string(),
  ruleSource: v.optional(v.string()),
});

export const resolvedMilitiaEventValidator = v.object({
  eventType: eventTypeValidator,
  rolledValue: v.number(),
  isTwiceClause: v.boolean(),
});

export const cacheClassValidator = v.union(
  v.literal('minor'),
  v.literal('intermediate'),
  v.literal('major'),
);

export const cacheStatusValidator = v.union(
  v.literal('hidden'),
  v.literal('pending_return'),
  v.literal('retrieved'),
  v.literal('lost'),
);

export const cacheModeValidator = v.union(
  v.literal('place'),
  v.literal('retrieve'),
);

export const trackedPersonKindValidator = v.union(
  v.literal('pc'),
  v.literal('officer_npc'),
  v.literal('other_npc'),
);

export const trackedPersonStatusValidator = v.union(
  v.literal('active'),
  v.literal('hidden'),
  v.literal('captured'),
  v.literal('recovering'),
  v.literal('contact'),
);

export const trackedPersonLocationValidator = v.union(
  v.literal('hq'),
  v.literal('refuge'),
  v.literal('settlement'),
  v.literal('site'),
  v.literal('unknown'),
);

export const covertActionModeValidator = v.union(
  v.literal('augment_action'),
  v.literal('place_contact'),
);

export const strikeTeamModeValidator = v.union(
  v.literal('combat_support'),
  v.literal('extraction'),
);

export const restoreCharacterModeValidator = v.union(
  v.literal('party_ability_damage'),
  v.literal('party_hit_points'),
  v.literal('party_lesser_restorative'),
  v.literal('break_enchantment'),
  v.literal('raise_dead'),
  v.literal('restoration'),
  v.literal('stone_to_flesh'),
  v.literal('custom'),
);

export const orderStatusValidator = v.union(
  v.literal('pending'),
  v.literal('delivered'),
  v.literal('cancelled'),
);

export const marketplaceSourceActionValidator = v.union(
  v.literal('activate_black_market'),
  v.literal('broker_market'),
);

export const marketplaceAvailabilityTierValidator = v.union(
  v.literal('small_town'),
  v.literal('small_city'),
);

export const militiaTeamValidator = v.object({
  militiaId: v.id('militia'),
  teamId: teamIdValidator,
  managerSource: v.optional(teamManagerSourceValidator),
  managerCharacterId: v.optional(v.id('character')),
  managerName: v.optional(v.string()),
  managerKind: v.optional(teamManagerKindValidator),
  managerCharisma: v.optional(v.number()),
});

export const militiaWeekStateValidator = v.object({
  militiaId: v.id('militia'),
  weekNumber: v.number(),
  phase: phaseValidator,
  isFirstWeek: v.boolean(),
  skippedUpkeepThisWeek: v.boolean(),
  upkeepTreasurySnapshot: v.optional(v.number()),
  uneventfulBonusCarry: v.number(),
  queuedEffects: v.array(queueEffectValidator),
  lastPersistentBuyoffWeek: v.optional(v.number()),
  stagedActivityActionIds: v.array(v.union(v.null(), activityActionIdValidator)),
  stagedActivityTeamIds: v.optional(v.array(v.union(v.null(), teamIdValidator))),
  activityTeamOperations: v.optional(
    v.object({
      recruits: v.array(
        v.object({
          slotIndex: v.number(),
          teamId: teamIdValidator,
        }),
      ),
      dismissals: v.array(
        v.object({
          slotIndex: v.number(),
          teamId: teamIdValidator,
        }),
      ),
      upgrades: v.array(
        v.object({
          slotIndex: v.number(),
          fromTeamId: teamIdValidator,
          toTeamId: teamIdValidator,
        }),
      ),
    }),
  ),
  activityOfficerOperations: v.optional(
    v.object({
      changes: v.array(
        v.object({
          slotIndex: v.number(),
          role: officerRoleValidator,
          characterId: v.optional(v.id('character')),
        }),
      ),
    }),
  ),
  activityAssetOperations: v.optional(
    v.object({
      refuges: v.array(
        v.object({
          slotIndex: v.number(),
          settlementKey: v.string(),
        }),
      ),
      reduceDangerTargets: v.optional(
        v.array(
          v.object({
            slotIndex: v.number(),
            settlementKey: v.string(),
          }),
        ),
      ),
      spreadPropagandaTargets: v.optional(
        v.array(
          v.object({
            slotIndex: v.number(),
            settlementKey: v.string(),
          }),
        ),
      ),
      strikeTeams: v.optional(
        v.array(
          v.object({
            slotIndex: v.number(),
            mode: strikeTeamModeValidator,
            location: v.optional(v.string()),
            notes: v.optional(v.string()),
          }),
        ),
      ),
      caches: v.array(
        v.object({
          slotIndex: v.number(),
          mode: cacheModeValidator,
          cacheId: v.optional(v.string()),
          label: v.optional(v.string()),
          cacheClass: v.optional(cacheClassValidator),
          location: v.optional(v.string()),
          contentsSummary: v.optional(v.string()),
          isSecureLocation: v.optional(v.boolean()),
          checkTotal: v.optional(v.number()),
        }),
      ),
      orders: v.array(
        v.object({
          slotIndex: v.number(),
          description: v.string(),
          notes: v.optional(v.string()),
          costPaid: v.optional(v.number()),
          deliveryDays: v.optional(v.number()),
        }),
      ),
      marketplaces: v.optional(
        v.array(
          v.object({
            slotIndex: v.number(),
            label: v.optional(v.string()),
            purchaseSummary: v.optional(v.string()),
            notes: v.optional(v.string()),
          }),
        ),
      ),
      covertActions: v.optional(
          v.array(
            v.object({
              slotIndex: v.number(),
              mode: v.optional(covertActionModeValidator),
              targetSource: v.optional(
                v.union(v.literal('character'), v.literal('freeform')),
              ),
              followupSlotIndex: v.optional(v.number()),
              characterId: v.optional(v.id('character')),
              displayName: v.optional(v.string()),
              personKind: v.optional(trackedPersonKindValidator),
              siteName: v.optional(v.string()),
            notes: v.optional(v.string()),
          }),
        ),
      ),
      rescues: v.optional(
          v.array(
            v.object({
              slotIndex: v.number(),
              targetSource: v.optional(
                v.union(
                  v.literal('tracked'),
                  v.literal('character'),
                  v.literal('freeform'),
                ),
              ),
              targetStatusId: v.optional(v.string()),
              characterId: v.optional(v.id('character')),
              displayName: v.optional(v.string()),
              personKind: v.optional(trackedPersonKindValidator),
              targetLevel: v.optional(v.number()),
            destinationType: v.optional(
              v.union(
                v.literal('hq'),
                v.literal('refuge'),
                v.literal('settlement'),
              ),
            ),
            destinationSettlementKey: v.optional(v.string()),
          }),
        ),
      ),
      restorations: v.optional(
          v.array(
            v.object({
              slotIndex: v.number(),
              targetSource: v.optional(
                v.union(
                  v.literal('tracked'),
                  v.literal('character'),
                  v.literal('freeform'),
                ),
              ),
              targetStatusId: v.optional(v.string()),
              characterId: v.optional(v.id('character')),
              displayName: v.optional(v.string()),
              personKind: v.optional(trackedPersonKindValidator),
            mode: v.optional(restoreCharacterModeValidator),
            customCostTotal: v.optional(v.number()),
          }),
        ),
      ),
    }),
  ),
  upkeepTeamOperations: v.optional(
    v.object({
      disabledRecoveries: v.array(
        v.object({
          teamId: teamIdValidator,
          paid: v.boolean(),
        }),
      ),
      missingChecks: v.array(
        v.object({
          teamId: teamIdValidator,
          securityCheckTotal: v.optional(v.number()),
          permanentlyLost: v.optional(v.boolean()),
        }),
      ),
    }),
  ),
  eventMitigations: v.optional(
    v.object({
      cacheDiscoveredMitigationTotal: v.optional(v.number()),
      theftMitigationTotal: v.optional(v.number()),
      sicknessTwiceLoyaltyTotal: v.optional(v.number()),
      turncoatTrainingLossTotal: v.optional(v.number()),
      turncoatOfficerCheckTotal: v.optional(v.number()),
      turncoatSelectedTeamId: v.optional(teamIdValidator),
      rivalrySelectedTeamIds: v.optional(v.array(teamIdValidator)),
      missingInActionSelectedTeamId: v.optional(teamIdValidator),
      sicknessSelectedTeamId: v.optional(teamIdValidator),
      turnAroundBoostTeamId: v.optional(teamIdValidator),
    }),
  ),
  tableAdjustments: v.optional(v.array(tableAdjustmentValidator)),
  weekWarnings: v.optional(
    v.array(
      v.object({
        code: v.string(),
        message: v.string(),
      }),
    ),
  ),
  upkeepRollTotals: v.optional(
    v.object({
      attritionTotal: v.optional(v.number()),
      notorietyPenaltyTotal: v.optional(v.number()),
      maxNotorietyLoyaltyCheckTotal: v.optional(v.number()),
      nearestSettlementKey: v.optional(v.string()),
      treasuryPenaltyTotal: v.optional(v.number()),
    }),
  ),
  activityRollTotals: v.optional(
    v.object({
      activateBlackMarketCheckTotal: v.optional(v.number()),
      activateBlackMarketNotorietyIncreaseTotal: v.optional(v.number()),
      dismissTeamCheckTotal: v.optional(v.number()),
      dismissTeamNotorietyIncreaseTotal: v.optional(v.number()),
      drillMilitiaCheckTotal: v.optional(v.number()),
      drillMilitiaTrainingGainTotal: v.optional(v.number()),
      earnGoldCheckTotal: v.optional(v.number()),
      earnGoldTotal: v.optional(v.number()),
      earnGoldNotorietyIncreaseTotal: v.optional(v.number()),
      gatherInformationCheckTotal: v.optional(v.number()),
      gatherInformationNotorietyIncreaseTotal: v.optional(v.number()),
      knowledgeCheckTotal: v.optional(v.number()),
      guaranteeEventNotorietyIncreaseTotal: v.optional(v.number()),
      recruitTeamCheckTotal: v.optional(v.number()),
      recruitTeamNotorietyIncreaseTotal: v.optional(v.number()),
      reduceDangerCheckTotal: v.optional(v.number()),
      reduceDangerNotorietyIncreaseTotal: v.optional(v.number()),
      rescueCharacterCheckTotal: v.optional(v.number()),
      rescueCharacterTargetLevelTotal: v.optional(v.number()),
      rescueCharacterNotorietyIncreaseTotal: v.optional(v.number()),
      restoreCharacterCostTotal: v.optional(v.number()),
      secureCacheCheckTotal: v.optional(v.number()),
      specialActionCostTotal: v.optional(v.number()),
      specialOrderItemCostTotal: v.optional(v.number()),
      spreadPropagandaCheckTotal: v.optional(v.number()),
      specialOrderDeliveryDaysTotal: v.optional(v.number()),
    }),
  ),
  eventRollTotals: v.optional(
    v.object({
      eventChanceTotal: v.optional(v.number()),
      eventTriggerRollTotal: v.optional(v.number()),
      eventPercentileTotal: v.optional(v.number()),
      rollTwiceFirstTotal: v.optional(v.number()),
      rollTwiceSecondTotal: v.optional(v.number()),
      guaranteedFirstPercentileTotal: v.optional(v.number()),
      guaranteedSecondPercentileTotal: v.optional(v.number()),
      guaranteedChosen: v.optional(
        v.union(v.literal('first'), v.literal('second')),
      ),
      sabotageCheckTotal: v.optional(v.number()),
      sabotageNotorietyIncreaseTotal: v.optional(v.number()),
    }),
  ),
  rollbackHistory: v.optional(v.array(v.any())),
  lockVersion: v.number(),
});

export const militiaResolutionRecordValidator = v.object({
  campaignId: v.id('campaign'),
  militiaId: v.id('militia'),
  weekNumber: v.number(),
  source: v.union(
    v.literal('confirmation'),
    v.literal('historical_reconstruction'),
  ),
  rulesetVersion: v.number(),
  draftRevision: v.optional(v.number()),
  baselinePlan: v.array(weeklyResolutionChangeValidator),
  finalPlan: v.array(weeklyResolutionChangeValidator),
  warnings: v.array(weeklyResolutionWarningValidator),
  tableAdjustments: v.array(tableAdjustmentValidator),
  finalOutcome: v.object({
    militia: v.object({
      training: v.number(),
      treasury: v.number(),
      notoriety: v.number(),
    }),
    nextUneventfulBonusCarry: v.number(),
    resolvedEvents: v.array(resolvedMilitiaEventValidator),
  }),
  supersedesRecordId: v.optional(v.id('militiaResolutionRecord')),
  createdAt: v.number(),
});

export const militiaSettlementStateValidator = v.object({
  militiaId: v.id('militia'),
  settlementKey: v.string(),
  reputation: reputationValidator,
  isSecured: v.boolean(),
  temporaryShift: v.optional(v.number()),
  refugeActiveUntilWeek: v.optional(v.number()),
  refugeActivatedWeek: v.optional(v.number()),
});

export const militiaTeamStateValidator = v.object({
  militiaId: v.id('militia'),
  teamId: teamIdValidator,
  status: teamStatusValidator,
  unavailableUntilWeek: v.optional(v.number()),
  notes: v.optional(v.string()),
});

export const militiaEventStateValidator = v.object({
  militiaId: v.id('militia'),
  weekNumber: v.number(),
  eventType: eventTypeValidator,
  isPersistent: v.boolean(),
  startedWeek: v.number(),
  endedWeek: v.optional(v.number()),
  mitigationUntilWeek: v.optional(v.number()),
  resolved: v.boolean(),
});

export const militiaCacheValidator = v.object({
  militiaId: v.id('militia'),
  label: v.string(),
  cacheClass: cacheClassValidator,
  location: v.string(),
  contentsSummary: v.string(),
  status: cacheStatusValidator,
  isSecureLocation: v.boolean(),
  createdWeek: v.number(),
  updatedWeek: v.number(),
  retrievedWeek: v.optional(v.number()),
  lostWeek: v.optional(v.number()),
});

export const militiaOrderValidator = v.object({
  militiaId: v.id('militia'),
  description: v.string(),
  notes: v.optional(v.string()),
  costPaid: v.optional(v.number()),
  deliveryDays: v.number(),
  orderedWeek: v.number(),
  dueWeek: v.number(),
  status: orderStatusValidator,
  deliveredWeek: v.optional(v.number()),
  sourceAction: v.optional(
    v.union(
      v.literal('special_order'),
      v.literal('broker_market'),
      v.literal('activate_black_market'),
    ),
  ),
  marketplaceId: v.optional(v.id('militiaMarketplace')),
});

export const militiaMarketplaceValidator = v.object({
  militiaId: v.id('militia'),
  label: v.string(),
  sourceAction: marketplaceSourceActionValidator,
  teamId: teamIdValidator,
  availabilityTier: marketplaceAvailabilityTierValidator,
  availabilityThreshold: v.number(),
  saleValuePercent: v.number(),
  contrabandAllowed: v.boolean(),
  createdWeek: v.number(),
  activeUntilWeek: v.number(),
  marketDayDiscountPercent: v.optional(v.number()),
  marketDayAppliedWeek: v.optional(v.number()),
  notes: v.optional(v.string()),
});

export const militiaCharacterStatusValidator = v.object({
  militiaId: v.id('militia'),
  characterId: v.optional(v.id('character')),
  displayName: v.string(),
  personKind: trackedPersonKindValidator,
  status: trackedPersonStatusValidator,
  level: v.optional(v.number()),
  locationType: trackedPersonLocationValidator,
  settlementKey: v.optional(v.string()),
  siteName: v.optional(v.string()),
  notes: v.optional(v.string()),
  activeUntilWeek: v.optional(v.number()),
  hiddenSinceWeek: v.optional(v.number()),
  capturedSinceWeek: v.optional(v.number()),
  rescuedWeek: v.optional(v.number()),
  restoredWeek: v.optional(v.number()),
  rescueDcOverride: v.optional(v.number()),
  sourceAction: v.optional(
    v.union(
      v.literal('manual'),
      v.literal('covert_action'),
      v.literal('rescue_character'),
      v.literal('restore_character'),
      v.literal('event_raid'),
    ),
  ),
});

export const militiaOverrideNoteValidator = v.object({
  militiaId: v.id('militia'),
  scope: v.union(
    v.literal('militia'),
    v.literal('week_state'),
    v.literal('settlement'),
    v.literal('team'),
    v.literal('event'),
  ),
  targetId: v.optional(v.string()),
  fieldPath: v.string(),
  warningCode: v.string(),
  isIntentionalOverride: v.boolean(),
  reason: v.optional(v.string()),
  actorUserId: v.string(),
  createdAt: v.number(),
});

export const dataMigrationValidator = v.object({
  name: v.string(),
  status: v.union(
    v.literal('running'),
    v.literal('completed'),
    v.literal('failed'),
  ),
  stage: v.union(
    v.literal('characters'),
    v.literal('militias'),
    v.literal('done'),
  ),
  characterCursor: v.optional(v.string()),
  militiaCursor: v.optional(v.string()),
  migratedCharacterCount: v.number(),
  migratedMilitiaCount: v.number(),
  startedAt: v.number(),
  updatedAt: v.number(),
  completedAt: v.optional(v.number()),
  error: v.optional(v.string()),
});

export const roles = v.union(v.literal('admin'), v.literal('member'));

export default defineSchema({
  canonicalCampaignContext: defineTable({
    campaignId: v.id('campaign'),
    militiaId: v.id('militia'),
    revision: v.number(),
    context: zodOutputToConvex(campaignContextDataSchema),
  }).index('by_militiaId', ['militiaId']),
  canonicalRoster: defineTable({
    campaignId: v.id('campaign'),
    militiaId: v.id('militia'),
    revision: v.number(),
    roster: zodOutputToConvex(canonicalRosterDataSchema),
  }).index('by_militiaId', ['militiaId']),
  canonicalResolutionRecord: defineTable(recordStorageValidator)
    .index('by_recordId', ['recordId'])
    .index('by_sourceDraftId', ['record.source.draftId'])
    .index('by_campaignId_and_week_and_sequence', ['campaignId', 'week', 'sequence']),
  canonicalDraftOperation: defineTable(operationStorageValidator)
    .index('by_draftId_and_operationId', ['draftId', 'operationId']),
  canonicalWeeklyDraft: defineTable(draftStorageValidator)
    .index('by_draftId', ['draftId'])
    .index('by_campaignId_and_status', ['campaignId', 'status']),
  e2eFixtureIdentity: defineTable({
    namespace: v.string(), workerKey: v.string(), userId: v.id('user'),
  }).index('by_namespace_and_workerKey', ['namespace', 'workerKey'])
    .index('by_userId', ['userId']),
  character: defineTable(characterValidator).index('by_campaignId', [
    'campaignId',
  ]),
  campaign: defineTable(campaignValidator)
    .index('by_organization', ['organizationId'])
    .index('by_e2eFixture_namespace_and_workerKey_and_caseKey', [
      'e2eFixture.namespace',
      'e2eFixture.workerKey',
      'e2eFixture.caseKey',
    ]),
  militia: defineTable(militiaValidator).index('by_campaign', ['campaignId']),
  militiaTeam: defineTable(militiaTeamValidator).index('by_militiaId', [
    'militiaId',
  ]),
  militiaWeekState: defineTable(militiaWeekStateValidator)
    .index('by_militiaId', ['militiaId'])
    .index('by_militiaId_week', ['militiaId', 'weekNumber']),
  militiaResolutionRecord: defineTable(militiaResolutionRecordValidator)
    .index('by_campaignId_and_weekNumber', ['campaignId', 'weekNumber'])
    .index('by_militiaId_and_weekNumber', ['militiaId', 'weekNumber']),
  militiaSettlementState: defineTable(militiaSettlementStateValidator)
    .index('by_militiaId', ['militiaId'])
    .index('by_militiaId_settlement', ['militiaId', 'settlementKey']),
  militiaCache: defineTable(militiaCacheValidator)
    .index('by_militiaId', ['militiaId'])
    .index('by_militiaId_status', ['militiaId', 'status']),
  militiaMarketplace: defineTable(militiaMarketplaceValidator)
    .index('by_militiaId', ['militiaId'])
    .index('by_militiaId_activeUntilWeek', ['militiaId', 'activeUntilWeek']),
  militiaOrder: defineTable(militiaOrderValidator)
    .index('by_militiaId', ['militiaId'])
    .index('by_militiaId_status', ['militiaId', 'status']),
  militiaCharacterStatus: defineTable(militiaCharacterStatusValidator)
    .index('by_militiaId', ['militiaId'])
    .index('by_militiaId_status', ['militiaId', 'status'])
    .index('by_militiaId_characterId', ['militiaId', 'characterId']),
  militiaTeamState: defineTable(militiaTeamStateValidator)
    .index('by_militiaId', ['militiaId'])
    .index('by_militiaId_teamId', ['militiaId', 'teamId']),
  militiaEventState: defineTable(militiaEventStateValidator)
    .index('by_militiaId', ['militiaId'])
    .index('by_militiaId_week', ['militiaId', 'weekNumber'])
    .index('by_militiaId_persistent', ['militiaId', 'isPersistent'])
    .index('by_militiaId_persistent_resolved', [
      'militiaId',
      'isPersistent',
      'resolved',
    ]),
  militiaOverrideNote: defineTable(militiaOverrideNoteValidator)
    .index('by_militiaId', ['militiaId'])
    .index('by_militiaId_scope', ['militiaId', 'scope']),
  dataMigration: defineTable(dataMigrationValidator).index('by_name', ['name']),
  spell: defineTable(spellValidator).index('by_name', ['name']),
  characterSpell: defineTable(
    v.object({
      characterId: v.id('character'),
      spellId: v.id('spell'),
    }),
  )
    .index('characterId', ['characterId'])
    .index('spellId_characterId', ['spellId', 'characterId']),
  user: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    orgIds: v.array(
      v.object({
        orgId: v.string(),
        role: roles,
      }),
    ),
  }).index('by_tokenIdentifier', ['tokenIdentifier']),
});
