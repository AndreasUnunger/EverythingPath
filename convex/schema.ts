import { militiaSnapshotSchema } from '../src/lib/canonical-weekly-source';
import { zodOutputToConvex } from 'convex-helpers/server/zod4';
import { defineSchema, defineTable } from 'convex/server';
import {
  draftStorageValidator,
  operationStorageValidator,
  recordStorageValidator,
} from './lib/canonicalStorageValidators';
import { v } from 'convex/values';
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
  ownerId: v.string(),
  campaignId: v.id('campaign'),
  description: v.string(),
  kind: characterKindValidator,
  isActive: v.boolean(),
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

export const militiaValidator = v.object({
  campaignId: v.id('campaign'),
  name: v.string(),
});

export const roles = v.union(v.literal('admin'), v.literal('member'));

export default defineSchema({
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
