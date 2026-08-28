import { v, type Infer } from 'convex/values';
import {
  EVENT_TYPES,
  MILITIA_ACTIVITY_ACTION_IDS,
  REPUTATION_LEVELS,
  TEAM_IDS,
  TEAM_STATUSES,
} from './militia-domain';

function literalUnion<const Value extends string>(values: readonly Value[]) {
  return v.union(...values.map((value: Value) => v.literal(value)));
}

export const activityActionIdValidator = literalUnion(
  MILITIA_ACTIVITY_ACTION_IDS,
);
export const teamIdValidator = literalUnion(TEAM_IDS);
export const eventTypeValidator = literalUnion(EVENT_TYPES);
export const reputationValidator = literalUnion(REPUTATION_LEVELS);
export const teamStatusValidator = literalUnion(TEAM_STATUSES);

export const tableAdjustmentValidator = v.union(
  v.object({
    kind: v.literal('militia_value'),
    field: v.union(
      v.literal('training'),
      v.literal('treasury'),
      v.literal('notoriety'),
    ),
    operation: v.union(v.literal('add'), v.literal('set')),
    value: v.number(),
    reason: v.string(),
  }),
  v.object({
    kind: v.literal('settlement_reputation'),
    settlementKey: v.string(),
    reputation: reputationValidator,
    reason: v.string(),
  }),
  v.object({
    kind: v.literal('team_status'),
    teamId: teamIdValidator,
    status: teamStatusValidator,
    reason: v.string(),
  }),
  v.object({
    kind: v.literal('event_status'),
    eventType: eventTypeValidator,
    operation: v.literal('add'),
    isPersistent: v.boolean(),
    reason: v.string(),
  }),
  v.object({
    kind: v.literal('event_status'),
    eventType: eventTypeValidator,
    operation: v.literal('resolve'),
    reason: v.string(),
  }),
);

export type TableAdjustment = Infer<typeof tableAdjustmentValidator>;

export const weeklyResolutionChangeValidator = v.union(
  v.object({
    kind: v.literal('militia_values'),
    training: v.number(),
    treasury: v.number(),
    notoriety: v.number(),
  }),
  v.object({
    kind: v.literal('lower_settlement_reputation'),
    settlementKey: v.string(),
  }),
  v.object({
    kind: v.literal('set_settlement_reputation'),
    settlementKey: v.string(),
    reputation: reputationValidator,
  }),
  v.object({
    kind: v.literal('set_team_status'),
    teamId: teamIdValidator,
    status: teamStatusValidator,
  }),
  v.object({
    kind: v.literal('add_event'),
    eventType: eventTypeValidator,
    isPersistent: v.boolean(),
  }),
  v.object({
    kind: v.literal('resolve_event'),
    eventType: eventTypeValidator,
  }),
  v.object({
    kind: v.literal('recover_team'),
    teamId: teamIdValidator,
    source: v.union(v.literal('paid_recovery'), v.literal('missing_return')),
  }),
  v.object({
    kind: v.literal('remove_team'),
    teamId: teamIdValidator,
    source: v.union(v.literal('permanently_lost'), v.literal('dismissed')),
  }),
  v.object({
    kind: v.literal('recruit_team'),
    teamId: teamIdValidator,
    addToRoster: v.boolean(),
    initializeState: v.boolean(),
  }),
  v.object({
    kind: v.literal('upgrade_team'),
    fromTeamId: teamIdValidator,
    toTeamId: teamIdValidator,
  }),
);

export type WeeklyResolutionChange = Infer<
  typeof weeklyResolutionChangeValidator
>;
