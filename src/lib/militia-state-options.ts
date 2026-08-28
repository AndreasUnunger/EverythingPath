import type { EventType, TeamStatus } from './militia-domain';
import type { IQueuedEffect, ITrackedPerson, IWeekContextState } from './types';

export const militiaFocusOptions = ['Secrecy', 'Loyalty', 'Security'] as const;

export const weekPhaseOptions: IWeekContextState['phase'][] = [
  'upkeep',
  'activity',
  'event',
  'persistent',
  'week_closed',
];

export const cacheClassOptions = ['minor', 'intermediate', 'major'] as const;
export const cacheStatusOptions = ['hidden', 'pending_return', 'retrieved', 'lost'] as const;

export const orderStatusOptions = ['pending', 'delivered', 'cancelled'] as const;
export const orderSourceActionOptions = [
  'special_order',
  'broker_market',
  'activate_black_market',
] as const;

export const trackedPersonKindOptions = ['pc', 'officer_npc', 'other_npc'] as const;
export const trackedPersonStatusOptions = [
  'active',
  'hidden',
  'captured',
  'recovering',
  'contact',
] as const;
export const trackedPersonLocationOptions = [
  'hq',
  'refuge',
  'settlement',
  'site',
  'unknown',
] as const;
export const trackedPersonSourceActionOptions = [
  'manual',
  'covert_action',
  'rescue_character',
  'restore_character',
  'event_raid',
] as const;

export const queuedEffectKindOptions: IQueuedEffect['kind'][] = [
  'week_of_pain_checks_penalty',
  'double_upkeep_attrition',
  'week_of_serenity_checks_bonus',
  'double_next_activity_training_gain',
  'all_is_calm_auto_next_week',
  'auto_event_roll_once',
  'auto_event_roll_twice',
  'organization_check_modifier',
  'activity_action_block',
  'team_check_modifier',
  'table_note',
] as const;

export function formatFocusLabel(
  focus: (typeof militiaFocusOptions)[number] | null | undefined,
) {
  return focus ?? 'None';
}

export function formatWeekPhaseLabel(phase: IWeekContextState['phase']) {
  return capitalizeWords(phase.replaceAll('_', ' '));
}

export function formatTeamStatusLabel(status: TeamStatus) {
  return capitalizeWords(status);
}

export function formatCacheClassLabel(cacheClass: (typeof cacheClassOptions)[number]) {
  return capitalizeWords(cacheClass);
}

export function formatCacheStatusLabel(status: (typeof cacheStatusOptions)[number]) {
  return capitalizeWords(status.replaceAll('_', ' '));
}

export function formatOrderStatusLabel(status: (typeof orderStatusOptions)[number]) {
  return capitalizeWords(status);
}

export function formatOrderSourceActionLabel(
  sourceAction: (typeof orderSourceActionOptions)[number],
) {
  return capitalizeWords(sourceAction.replaceAll('_', ' '));
}

export function formatTrackedPersonKindLabel(kind: ITrackedPerson['personKind']) {
  if (kind === 'officer_npc') return 'Officer NPC';
  if (kind === 'other_npc') return 'Other NPC';
  return 'PC';
}

export function formatTrackedPersonStatusLabel(status: ITrackedPerson['status']) {
  return capitalizeWords(status);
}

export function formatTrackedPersonLocationLabel(
  locationType: ITrackedPerson['locationType'],
) {
  return capitalizeWords(locationType);
}

export function formatTrackedPersonSourceActionLabel(
  sourceAction: NonNullable<ITrackedPerson['sourceAction']>,
) {
  return capitalizeWords(sourceAction.replaceAll('_', ' '));
}

export function formatEventTypeLabel(eventType: EventType) {
  return capitalizeWords(eventType.replaceAll('_', ' '));
}

export function formatQueuedEffectKindLabel(kind: IQueuedEffect['kind']) {
  return capitalizeWords(kind.replaceAll('_', ' '));
}

function capitalizeWords(value: string) {
  return value.replace(/\b\w/g, (match) => match.toUpperCase());
}
