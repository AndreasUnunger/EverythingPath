import { militiaSnapshotSchema } from '../src/lib/canonical-weekly-source';
import { zodOutputToConvex } from 'convex-helpers/server/zod4';
import { defineSchema, defineTable } from 'convex/server';
import {
  draftStorageValidator,
  operationStorageValidator,
  recordStorageValidator,
} from './lib/canonicalStorageValidators';
import { v } from 'convex/values';
import {
  abilityTargets,
  abilityKeys,
  bonusTypes,
  modifierConditionSchema,
  modifierTargets,
} from '../src/lib/character-sheet';
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

// Stored record kinds (see src/lib/character-kind.ts).
export const characterKindValidator = v.union(
  v.literal('pc'),
  v.literal('npc'),
);

export const characterValidator = v.object({
  name: v.string(),
  ownerId: v.optional(v.string()),
  ownerLastOperationId: v.optional(v.string()),
  campaignId: v.optional(v.id('campaign')),
  sheetDemo: v.optional(v.literal(true)),
  description: v.string(),
  kind: characterKindValidator,
  isActive: v.boolean(),
  sheetMode: v.optional(v.union(v.literal('militiaOnly'), v.literal('full'))),
  sheetRevision: v.optional(v.number()),
  sheetLastOperationId: v.optional(v.string()),
  sheetUpdatedBy: v.optional(v.string()),
  level: v.number(),
  strength: v.number(),
  dexterity: v.number(),
  constitution: v.number(),
  wisdom: v.number(),
  charisma: v.number(),
  intelligence: v.number(),
});

const modifierConditionValidator = zodOutputToConvex(
  modifierConditionSchema,
).extend({
  situation: v.optional(
    v.union(
      v.string(),
      v.object({ local: v.string() }),
      v.object({ option: v.id('catalogEntry') }),
    ),
  ),
  whileActive: v.optional(v.id('catalogEntry')),
});
export const modifierValidator = v.object({
  target: v.union(...modifierTargets.map((target) => v.literal(target))),
  bonusType: v.union(...bonusTypes.map((type) => v.literal(type))),
  value: v.union(v.number(), v.object({ formula: v.string() })),
  condition: v.optional(modifierConditionValidator),
  stacksWithinEntry: v.optional(v.literal(true)),
});
const baseModifierValidator = modifierValidator
  .pick('target', 'bonusType', 'value')
  .extend({
    target: v.union(
      ...Object.values(abilityTargets).map((target) => v.literal(target)),
    ),
    bonusType: v.literal('base'),
    value: v.number(),
  });
const catalogEntryFields = v.object({
  scope: v.literal('character'),
  characterId: v.id('character'),
  name: v.string(),
  ruleIdentity: v.string(),
  sourceKey: v.optional(v.string()),
  stacksWithItself: v.boolean(),
  sources: v.array(
    v.object({ book: v.string(), pages: v.optional(v.string()) }),
  ),
});
export const sheetEntryDetailValidator = v.union(
  v.object({
    kind: v.literal('spellEffect'),
    lastsOverOneDay: v.boolean(),
    defaultCasterLevel: v.number(),
  }),
  v.object({ kind: v.literal('condition') }),
  v.object({ kind: v.literal('item'), consumable: v.boolean() }),
  v.object({ kind: v.literal('spell') }),
);
export const abilityValidator = v.union(
  ...abilityKeys.map((ability) => v.literal(ability)),
);
export const abilityChangeKindValidator = v.union(
  v.literal('abilityDamage'),
  v.literal('abilityDrain'),
);
export const catalogEntryValidator = v.union(
  catalogEntryFields.extend({
    modifiers: v.array(modifierValidator),
    detail: v.object({ kind: v.literal('class') }),
  }),
  catalogEntryFields.extend({
    modifiers: v.array(baseModifierValidator),
    detail: v.object({ kind: v.literal('base') }),
  }),
  catalogEntryFields.extend({
    modifiers: v.array(modifierValidator),
    detail: v.object({ kind: v.literal('manual') }),
  }),
  catalogEntryFields.extend({
    modifiers: v.array(modifierValidator),
    detail: sheetEntryDetailValidator,
  }),
);
export const creationSettingsValidator = v.object({
  abilityMethod: v.union(
    v.object({ kind: v.literal('pointBuy'), budget: v.number() }),
    v.object({ kind: v.literal('rolled'), budget: v.optional(v.number()) }),
  ),
  traitCount: v.number(),
  campaignTraitRequired: v.boolean(),
});
export const characterSheetEntryValidator = v.union(
  v.object({
    characterId: v.id('character'),
    kind: v.literal('abilityDamage'),
    active: v.boolean(),
    state: v.object({
      kind: v.literal('abilityDamage'),
      ability: abilityValidator,
      points: v.number(),
    }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('abilityDrain'),
    active: v.boolean(),
    state: v.object({
      kind: v.literal('abilityDrain'),
      ability: abilityValidator,
      points: v.number(),
    }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('spellEffect'),
    active: v.boolean(),
    catalogEntryId: v.id('catalogEntry'),
    state: v.object({
      kind: v.literal('spellEffect'),
      casterLevel: v.number(),
    }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('condition'),
    active: v.boolean(),
    catalogEntryId: v.id('catalogEntry'),
    state: v.object({ kind: v.literal('condition') }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('item'),
    active: v.boolean(),
    catalogEntryId: v.id('catalogEntry'),
    state: v.object({ kind: v.literal('item') }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('spell'),
    active: v.boolean(),
    catalogEntryId: v.id('catalogEntry'),
    state: v.object({ kind: v.literal('spell') }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('manual'),
    active: v.boolean(),
    catalogEntryId: v.id('catalogEntry'),
    state: v.object({ kind: v.literal('manual') }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('base'),
    active: v.literal(true),
    catalogEntryId: v.id('catalogEntry'),
    state: v.object({
      kind: v.literal('base'),
      ...creationSettingsValidator.partial().fields,
    }),
  }),
  v.object({
    characterId: v.id('character'),
    kind: v.literal('classLevel'),
    active: v.literal(true),
    state: v.object({
      kind: v.literal('classLevel'),
      classEntryId: v.union(v.id('catalogEntry'), v.null()),
      position: v.number(),
      hpGained: v.union(v.number(), v.null()),
    }),
  }),
);

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

export const militiaValidator = v.object({
  campaignId: v.id('campaign'),
  name: v.string(),
});

export const roles = v.union(v.literal('admin'), v.literal('member'));

export default defineSchema({
  initialMigrationControl: defineTable({
    key: v.literal('character-sheet'),
    epoch: v.number(),
    closed: v.boolean(),
    authority: v.union(v.literal('legacy'), v.literal('sheet')),
    runId: v.id('initialMigrationRun'),
    acceptWebhooksAfter: v.optional(v.number()),
  }).index('by_key', ['key']),
  initialMigrationRun: defineTable({
    operationId: v.string(),
    epoch: v.number(),
    state: v.union(
      v.literal('maintenance'),
      v.literal('aborted'),
      v.literal('activated'),
    ),
    frontendBuild: v.string(),
    catalogManifest: v.string(),
    startedAt: v.number(),
    deadline: v.number(),
    abortedAt: v.optional(v.number()),
  }).index('by_operationId', ['operationId']),
  canonicalSourceCorrection: defineTable({
    campaignId: v.id('campaign'),
    militiaId: v.id('militia'),
    expectedRevision: v.number(),
    revision: v.number(),
    reason: v.string(),
    actor: v.string(),
    createdAt: v.number(),
  }).index('by_militiaId', ['militiaId']),
  campaignCutover: defineTable({
    key: v.literal('weekly-draft'),
    status: v.union(v.literal('paused'), v.literal('canonical')),
    operationId: v.string(),
    oldRelease: v.string(),
    newRelease: v.string(),
    campaignIds: v.array(v.id('campaign')),
    pausedAt: v.number(),
    reopenedAt: v.optional(v.number()),
    backup: v.optional(
      v.object({
        sha256: v.string(),
        location: v.string(),
        verifiedRestoreDeployment: v.string(),
        retainUntil: v.number(),
      }),
    ),
  }).index('by_key', ['key']),
  canonicalMilitiaState: defineTable({
    campaignId: v.id('campaign'),
    militiaId: v.id('militia'),
    revision: v.number(),
    snapshot: zodOutputToConvex(militiaSnapshotSchema),
  }).index('by_militiaId', ['militiaId']),
  canonicalCampaignInitialization: defineTable({
    campaignId: v.id('campaign'),
    militiaId: v.id('militia'),
    initializationId: v.string(),
    setupNotes: v.optional(v.string()),
    draftId: v.string(),
    sourceToken: v.string(),
  }).index('by_militiaId', ['militiaId']),
  canonicalResolutionRecord: defineTable(recordStorageValidator)
    .index('by_recordId', ['recordId'])
    .index('by_sourceDraftId', ['record.source.draftId'])
    .index('by_campaignId_and_week_and_sequence', [
      'campaignId',
      'week',
      'sequence',
    ])
    .index('by_militiaId', ['militiaId']),
  canonicalDraftTarget: defineTable({
    campaignId: v.id('campaign'),
    militiaId: v.id('militia'),
    draftId: v.string(),
    target: v.string(),
    revision: v.number(),
    subtreeRevision: v.number(),
  })
    .index('by_draftId_and_target', ['draftId', 'target'])
    .index('by_draftId_and_revision', ['draftId', 'revision'])
    .index('by_militiaId', ['militiaId']),
  canonicalDraftOperation: defineTable(operationStorageValidator)
    .index('by_draftId_and_operationId', ['draftId', 'operationId'])
    .index('by_draftId_and_acceptedRevision', ['draftId', 'acceptedRevision'])
    .index('by_militiaId', ['militiaId']),
  canonicalWeeklyDraft: defineTable(draftStorageValidator)
    .index('by_draftId', ['draftId'])
    .index('by_campaignId_and_status', ['campaignId', 'status'])
    .index('by_militiaId', ['militiaId']),
  e2eFixtureIdentity: defineTable({
    namespace: v.string(),
    workerKey: v.string(),
    userId: v.id('user'),
  })
    .index('by_namespace_and_workerKey', ['namespace', 'workerKey'])
    .index('by_userId', ['userId']),
  catalogEntry: defineTable(catalogEntryValidator).index('by_characterId', [
    'characterId',
  ]),
  acceptedWarning: defineTable({
    characterId: v.id('character'),
    check: v.string(),
    subject: v.string(),
    fingerprint: v.string(),
    acceptedBy: v.string(),
    acceptedAt: v.number(),
  }).index('by_characterId', ['characterId']),
  characterSheetEntry: defineTable(characterSheetEntryValidator).index(
    'by_characterId',
    ['characterId'],
  ),
  character: defineTable(characterValidator)
    .index('by_campaignId', ['campaignId'])
    .index('by_ownerId', ['ownerId']),
  campaign: defineTable(campaignValidator)
    .index('by_organization', ['organizationId'])
    .index('by_e2eFixture_namespace_and_workerKey_and_caseKey', [
      'e2eFixture.namespace',
      'e2eFixture.workerKey',
      'e2eFixture.caseKey',
    ]),
  militia: defineTable(militiaValidator).index('by_campaign', ['campaignId']),
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
    characterSheetDemo: v.optional(v.literal(true)),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    webhookUpdatedAt: v.optional(v.number()),
    orgIds: v.array(
      v.object({
        orgId: v.string(),
        role: roles,
        webhookUpdatedAt: v.optional(v.number()),
      }),
    ),
  }).index('by_tokenIdentifier', ['tokenIdentifier']),
  organizationMembership: defineTable({
    userId: v.id('user'),
    organizationId: v.string(),
  })
    .index('by_organizationId_and_userId', ['organizationId', 'userId'])
    .index('by_userId_and_organizationId', ['userId', 'organizationId']),
});
