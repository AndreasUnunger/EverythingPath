import { z } from 'zod';
import {
  EVENT_TYPES,
  REPUTATION_LEVELS,
  TEAM_IDS,
  TEAM_STATUSES,
} from './militia-domain';

// Domain identities are allocated by callers, never Convex document IDs or positions.
export const identitySchema = z.string().trim().min(1);
export const integerSchema = z.number().int().nonnegative();
const signedInteger = z.number().int();
const id = identitySchema;
const int = integerSchema;
const reason = z.string().trim().min(1);
export const rawRollSchema = z.strictObject({
  dice: z.array(int).min(1),
  sides: int.min(2),
  provenance: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('table') }),
    z.strictObject({ kind: z.literal('generated'), sourceId: id }),
  ]),
  modifiers: z.array(
    z.strictObject({ sourceId: id, value: signedInteger, reason }),
  ),
});

export const rollsSchema = z.partialRecord(
  z.enum([
    'check',
    'notoriety',
    'training',
    'delivery',
    'loss',
    'chance',
    'table',
    'duration',
    'reward',
  ]),
  rawRollSchema,
);
export const acknowledgementSchema = z.strictObject({
  acknowledgementId: id,
  subjectId: id,
  outcome: reason,
});
export const rulesExceptionSchema = z.strictObject({
  exceptionId: id,
  subjectId: id,
  ruleId: id,
  reason,
});
export const tableAdjustmentSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('militia_value'),
    adjustmentId: id,
    field: z.enum(['training', 'treasuryCopper', 'notoriety', 'rank']),
    operation: z.enum(['add', 'set']),
    value: signedInteger,
    reason,
  }),
  z.strictObject({
    kind: z.literal('settlement_reputation'),
    adjustmentId: id,
    settlementId: id,
    reputation: z.enum(REPUTATION_LEVELS),
    reason,
  }),
  z.strictObject({
    kind: z.literal('team_status'),
    adjustmentId: id,
    teamId: id,
    status: z.enum(TEAM_STATUSES),
    reason,
  }),
  z.strictObject({
    kind: z.literal('event_end'),
    adjustmentId: id,
    eventId: id,
    reason,
  }),
]);

export const eventTargetSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('event'), eventId: id }),
  z.strictObject({ kind: z.literal('item'), itemId: id }),
  z.strictObject({ kind: z.literal('team'), teamId: id }),
  z.strictObject({ kind: z.literal('settlement'), settlementId: id }),
  z.strictObject({ kind: z.literal('character'), characterId: id }),
  z.strictObject({ kind: z.literal('cache'), cacheId: id }),
]);
export const persistentEventSchema = z.strictObject({
  eventId: id,
  eventType: z.enum(EVENT_TYPES),
  startedWeek: int,
  order: int.nonnegative(),
  targets: z.array(eventTargetSchema),
});
export const orderSchema = z.strictObject({
  orderId: id,
  itemId: id,
  settlementId: id,
  orderedDay: int,
  dueDay: int,
  priceCopper: int,
  receipt: z
    .strictObject({ receivedDay: int, acknowledgementId: id })
    .nullable(),
});
export const queuedEffectSchema = z.strictObject({
  effectId: id,
  sourceId: id,
  startsWeek: int,
  endsWeek: int,
  effect: z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('check_modifier'),
      check: z.enum(['loyalty', 'secrecy', 'security']),
      value: signedInteger,
    }),
    z.strictObject({
      kind: z.literal('upkeep_loss_multiplier'),
      value: int.min(1),
    }),
    z.strictObject({ kind: z.literal('event_chance'), value: signedInteger }),
    z.strictObject({ kind: z.literal('block_action'), actionId: id }),
    z.strictObject({ kind: z.literal('team_unavailable'), teamId: id }),
    z.strictObject({ kind: z.literal('narrative'), instruction: reason }),
  ]),
});

export const persistentDecisionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('unattempted'), eventId: id }),
  z.strictObject({
    kind: z.literal('mitigate'),
    eventId: id,
    rolls: rollsSchema.optional(),
    targets: z.array(eventTargetSchema).optional(),
    strategistCharacterId: id.optional(),
  }),
  z.strictObject({
    kind: z.literal('buyoff'),
    eventId: id,
    costCopper: int.optional(),
  }),
  z.strictObject({
    kind: z.literal('end'),
    eventId: id,
    acknowledgement: acknowledgementSchema,
  }),
]);
const eventOccurrenceSchema = z.strictObject({
  eventId: id,
  origin: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('rolled') }),
    z.strictObject({ kind: z.literal('automatic'), sourceId: id }),
    z.strictObject({ kind: z.literal('roll_twice'), parentEventId: id }),
    z.strictObject({ kind: z.literal('replacement'), parentEventId: id }),
  ]),
  eventType: z.enum(EVENT_TYPES).optional(),
  tableRoll: rawRollSchema.optional(),
  rolls: rollsSchema.optional(),
  targets: z.array(eventTargetSchema).optional(),
  persistent: z.boolean().optional(),
  persistentDecision: persistentDecisionSchema.optional(),
  strategistCharacterId: id.optional(),
  overseerCharacterId: id.optional(),
  targetChecks: z
    .array(
      z.strictObject({
        target: eventTargetSchema,
        rolls: rollsSchema.optional(),
      }),
    )
    .optional(),
  sabotage: z
    .strictObject({
      choiceId: id,
      teamId: id.optional(),
      rolls: rollsSchema.optional(),
    })
    .optional(),
});
export const eventTreeSchema = z
  .array(eventOccurrenceSchema)
  .superRefine((events, ctx) => {
    const seen = new Set<string>();
    for (const event of events) {
      if (seen.has(event.eventId))
        ctx.addIssue({ code: 'custom', message: 'Duplicate event identity' });
      if (
        'parentEventId' in event.origin &&
        !seen.has(event.origin.parentEventId)
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'Event parent must precede its child',
        });
      }
      if (
        event.persistentDecision &&
        (!event.persistent ||
          event.persistentDecision.eventId !== event.eventId)
      )
        ctx.addIssue({
          code: 'custom',
          message: 'Persistent decision must belong to its event',
        });
      seen.add(event.eventId);
    }
  });

const commonChoice = {
  choiceId: id,
  teamId: id.optional(),
  costCopper: int.optional(),
  rolls: rollsSchema.optional(),
  consumableIds: z.array(id).optional(),
  acknowledgements: z.array(acknowledgementSchema).optional(),
};
const settlement = { settlementId: id.optional() };
const character = {
  characterId: id.optional(),
  characterLevel: int.optional(),
};
const officerRole = z.enum([
  'ambassador',
  'commandant',
  'marshal',
  'overseer',
  'spymaster',
  'strategist',
]);
function action<const Name extends string, Shape extends z.ZodRawShape>(
  name: Name,
  shape: Shape,
) {
  return z.strictObject({
    ...commonChoice,
    actionId: z.literal(name),
    ...shape,
  });
}
export const stagedActionChoiceSchema = z
  .discriminatedUnion('actionId', [
    action('activate_black_market', settlement),
    action('activate_refuge', settlement),
    action('broker_market', {
      ...settlement,
      purchases: z
        .array(z.strictObject({ itemId: id, priceCopper: int }))
        .optional(),
    }),
    action('change_officer_role', {
      characterId: id.optional(),
      fromRole: officerRole.optional(),
      toRole: officerRole.optional(),
    }),
    action('covert_action', {
      mode: z.enum(['augment', 'contact', 'cache']).optional(),
      followingChoiceId: id.optional(),
      location: reason.optional(),
    }),
    action('dismiss_team', { targetTeamId: id.optional() }),
    action('drill_militia', {}),
    action('earn_gold', {}),
    action('gather_information', { subject: reason.optional() }),
    action('guarantee_event', {
      candidates: eventTreeSchema.optional(),
      selectedEventId: id.optional(),
    }),
    action('knowledge_check', { subject: reason.optional() }),
    action('lie_low', {}),
    action('manipulate_events', {
      candidates: eventTreeSchema.optional(),
      selectedEventId: id.optional(),
    }),
    action('recruit_team', { teamType: z.enum(TEAM_IDS).optional() }),
    action('reduce_danger', settlement),
    action('rescue_character', character),
    action('restore_character', {
      ...character,
      mode: z
        .enum([
          'ability_damage',
          'hit_points',
          'restorative_effect',
          'break_enchantment',
          'raise_dead',
          'restoration',
          'stone_to_flesh',
        ])
        .optional(),
      effect: reason.optional(),
      targetPresent: z.boolean().optional(),
    }),
    action('secure_cache', {
      mode: z.enum(['place', 'retrieve']).optional(),
      cacheId: id.optional(),
      cacheClass: z.enum(['minor', 'intermediate', 'major']).optional(),
      location: reason.optional(),
      secure: z.boolean().optional(),
    }),
    action('special', { instruction: reason.optional() }),
    action('special_order', {
      orderId: id.optional(),
      receipt: z
        .strictObject({ receivedDay: int, acknowledgementId: id })
        .optional(),
      ...settlement,
      itemId: id.optional(),
      mode: z.enum(['purchase', 'enchantment']).optional(),
      priceCopper: int.optional(),
      expedited: z.boolean().optional(),
      orderedDay: int.optional(),
    }),
    action('spread_propaganda', {
      ...settlement,
      occupied: z.boolean().optional(),
    }),
    action('strike_team', {
      mode: z.enum(['support', 'extraction']).optional(),
      location: reason.optional(),
    }),
    action('upgrade_team', {
      targetTeamId: id.optional(),
      toTeamType: z.enum(TEAM_IDS).optional(),
    }),
  ])
  .superRefine((choice, ctx) => {
    if (
      'selectedEventId' in choice &&
      choice.selectedEventId &&
      !choice.candidates?.some(
        (event) => event.eventId === choice.selectedEventId,
      )
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Unknown selected event candidate',
      });
    }
  });
export type StagedActionChoice = z.infer<typeof stagedActionChoiceSchema>;

export function actionChoiceEvents(choice: StagedActionChoice | null) {
  return choice && 'candidates' in choice ? (choice.candidates ?? []) : [];
}
