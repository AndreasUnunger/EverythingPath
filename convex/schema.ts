import { defineSchema, defineTable } from 'convex/server';
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

export const characterValidator = v.object({
  name: v.string(),
  ownerId: v.string(),
  campaignId: v.id('campaign'),
  description: v.string(),
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
});

export const reputationValidator = v.union(
  v.literal('Hostile'),
  v.literal('Unfriendly'),
  v.literal('Indifferent'),
  v.literal('Friendly'),
  v.literal('Helpful'),
);

export const phaseValidator = v.union(
  v.literal('upkeep'),
  v.literal('activity'),
  v.literal('event'),
  v.literal('week_closed'),
);

export const teamStatusValidator = v.union(
  v.literal('active'),
  v.literal('disabled'),
  v.literal('missing'),
  v.literal('blocked'),
);

export const eventTypeValidator = v.union(
  v.literal('all_is_calm'),
  v.literal('broke_the_code'),
  v.literal('cache_discovered'),
  v.literal('calm_before_the_storm'),
  v.literal('double_agent'),
  v.literal('festival'),
  v.literal('found_fire'),
  v.literal('hidden_agenda'),
  v.literal('high_morale'),
  v.literal('invasion'),
  v.literal('low_morale'),
  v.literal('market_day'),
  v.literal('missing_in_action'),
  v.literal('night_ops'),
  v.literal('raid'),
  v.literal('rivalry'),
  v.literal('roll_twice'),
  v.literal('sickness'),
  v.literal('theft'),
  v.literal('turn_around'),
  v.literal('turncoat'),
  v.literal('war_games'),
  v.literal('week_of_pain'),
  v.literal('week_of_serenity'),
);

export const queueEffectValidator = v.object({
  kind: v.string(),
  appliesWeek: v.number(),
  note: v.optional(v.string()),
});

export const militiaValidator = v.object({
  name: v.string(),
  campaignId: v.id('campaign'),
  rank: v.number(),
  highestBoonReached: v.number(),
  HQLocation: v.string(),
  treasury: v.number(),
  notoriety: v.number(),
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

export const teamIdValidator = v.union(
  v.literal('moles'),
  v.literal('propagandists'),
  v.literal('saboteurs'),
  v.literal('spies'),
  v.literal('informants'),
  v.literal('conspirators'),
  v.literal('scholars'),
  v.literal('spellcasters'),
  v.literal('defenders'),
  v.literal('infiltrators'),
  v.literal('guardians'),
  v.literal('specialists'),
  v.literal('patrons'),
  v.literal('merchants'),
  v.literal('blackMarketeers'),
  v.literal('fixers'),
);

export const militiaTeamValidator = v.object({
  militiaId: v.id('militia'),
  teamId: teamIdValidator,
});

export const militiaWeekStateValidator = v.object({
  militiaId: v.id('militia'),
  weekNumber: v.number(),
  phase: phaseValidator,
  isFirstWeek: v.boolean(),
  skippedUpkeepThisWeek: v.boolean(),
  uneventfulBonusCarry: v.number(),
  queuedEffects: v.array(queueEffectValidator),
  lockVersion: v.number(),
});

export const militiaSettlementStateValidator = v.object({
  militiaId: v.id('militia'),
  settlementKey: v.string(),
  reputation: reputationValidator,
  isSecured: v.boolean(),
  temporaryShift: v.optional(v.number()),
  refugeActiveUntilWeek: v.optional(v.number()),
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

export const roles = v.union(v.literal('admin'), v.literal('member'));

export default defineSchema({
  character: defineTable(characterValidator),
  campaign: defineTable(campaignValidator).index('by_organization', [
    'organizationId',
  ]),
  militia: defineTable(militiaValidator).index('by_campaign', ['campaignId']),
  militiaTeam: defineTable(militiaTeamValidator).index('by_militiaId', [
    'militiaId',
  ]),
  militiaWeekState: defineTable(militiaWeekStateValidator)
    .index('by_militiaId', ['militiaId'])
    .index('by_militiaId_week', ['militiaId', 'weekNumber']),
  militiaSettlementState: defineTable(militiaSettlementStateValidator)
    .index('by_militiaId', ['militiaId'])
    .index('by_militiaId_settlement', ['militiaId', 'settlementKey']),
  militiaTeamState: defineTable(militiaTeamStateValidator)
    .index('by_militiaId', ['militiaId'])
    .index('by_militiaId_teamId', ['militiaId', 'teamId']),
  militiaEventState: defineTable(militiaEventStateValidator)
    .index('by_militiaId', ['militiaId'])
    .index('by_militiaId_week', ['militiaId', 'weekNumber'])
    .index('by_militiaId_persistent', ['militiaId', 'isPersistent']),
  militiaOverrideNote: defineTable(militiaOverrideNoteValidator)
    .index('by_militiaId', ['militiaId'])
    .index('by_militiaId_scope', ['militiaId', 'scope']),
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
