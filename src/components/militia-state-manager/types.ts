import type { Id } from '@convex/_generated/dataModel';
import { z } from 'zod';
import {
  cacheClassOptions,
  cacheStatusOptions,
  eventTypeOptions,
  militiaFocusOptions,
  orderSourceActionOptions,
  orderStatusOptions,
  queuedEffectKindOptions,
  teamStatusOptions,
  trackedPersonKindOptions,
  trackedPersonLocationOptions,
  trackedPersonSourceActionOptions,
  trackedPersonStatusOptions,
  weekPhaseOptions,
} from '~/lib/militia-state-options';
import { TEAM_IDS } from '~/lib/team-ids';
import type {
  IEventStateEntry,
  IMilitiaStateSetup,
  IQueuedEffect,
  ITrackedCache,
  ITrackedOrder,
  ITrackedPerson,
  IWeekContextState,
} from '~/lib/types';

function requiredWholeNumber(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((value) => /^-?\d+$/.test(value), {
      message: `${label} must be a whole number`,
    });
}

function optionalWholeNumber(label: string) {
  return z.string().trim().refine((value) => value === '' || /^-?\d+$/.test(value), {
    message: `${label} must be a whole number`,
  });
}

const yesNoOptions = ['yes', 'no'] as const;

export const militiaCoreFormSchema = z.object({
  name: z.string().trim().min(1, 'Militia name is required').max(100),
  rank: requiredWholeNumber('Rank'),
  highestBoonReached: requiredWholeNumber('Highest boon reached'),
  HQLocation: z.string().trim().min(1, 'HQ location is required').max(100),
  treasury: requiredWholeNumber('Treasury'),
  notoriety: requiredWholeNumber('Notoriety'),
  focus: z.union([z.enum(militiaFocusOptions), z.literal('none')]),
  training: requiredWholeNumber('Training'),
});

export type MilitiaCoreFormValues = z.infer<typeof militiaCoreFormSchema>;

export const weekContextFormSchema = z.object({
  weekNumber: requiredWholeNumber('Week number'),
  phase: z.enum(weekPhaseOptions),
  isFirstWeek: z.enum(yesNoOptions),
  skippedUpkeepThisWeek: z.enum(yesNoOptions),
  uneventfulBonusCarry: requiredWholeNumber('Uneventful bonus carry'),
  lastPersistentBuyoffWeek: optionalWholeNumber('Last persistent buyoff week'),
});

export type WeekContextFormValues = z.infer<typeof weekContextFormSchema>;

export const queueEffectFormSchema = z.object({
  kind: z.enum(queuedEffectKindOptions),
  appliesWeek: requiredWholeNumber('Applies week'),
  note: z.string().trim().max(200, 'Note must be 200 characters or fewer').optional().or(z.literal('')),
});

export type QueueEffectFormValues = z.infer<typeof queueEffectFormSchema>;

export const teamStateFormSchema = z.object({
  teamId: z.enum(TEAM_IDS),
  status: z.enum(teamStatusOptions),
  unavailableUntilWeek: optionalWholeNumber('Unavailable until week'),
  notes: z.string().trim().max(200, 'Notes must be 200 characters or fewer').optional().or(z.literal('')),
});

export type TeamStateFormValues = z.infer<typeof teamStateFormSchema>;

export const cacheStateFormSchema = z.object({
  label: z.string().trim().min(1, 'Cache label is required').max(100),
  cacheClass: z.enum(cacheClassOptions),
  location: z.string().trim().min(1, 'Location is required').max(120),
  contentsSummary: z.string().trim().min(1, 'Contents are required').max(200),
  status: z.enum(cacheStatusOptions),
  secureLocation: z.enum(yesNoOptions),
  createdWeek: requiredWholeNumber('Created week'),
  updatedWeek: requiredWholeNumber('Updated week'),
  retrievedWeek: optionalWholeNumber('Retrieved week'),
  lostWeek: optionalWholeNumber('Lost week'),
});

export type CacheStateFormValues = z.infer<typeof cacheStateFormSchema>;

export const orderStateFormSchema = z.object({
  description: z.string().trim().min(1, 'Order description is required').max(120),
  notes: z.string().trim().max(200, 'Notes must be 200 characters or fewer').optional().or(z.literal('')),
  costPaid: optionalWholeNumber('Cost paid'),
  deliveryDays: requiredWholeNumber('Delivery days'),
  orderedWeek: requiredWholeNumber('Ordered week'),
  dueWeek: requiredWholeNumber('Due week'),
  status: z.enum(orderStatusOptions),
  deliveredWeek: optionalWholeNumber('Delivered week'),
  sourceAction: z.union([z.enum(orderSourceActionOptions), z.literal('none')]),
  marketplaceId: z.string().optional().or(z.literal('')),
});

export type OrderStateFormValues = z.infer<typeof orderStateFormSchema>;

export const trackedPersonFormSchema = z.object({
  targetSource: z.union([z.literal('none'), z.literal('character')]),
  characterId: z.string().optional().or(z.literal('')),
  displayName: z.string().trim().min(1, 'Tracked person name is required').max(120),
  personKind: z.enum(trackedPersonKindOptions),
  status: z.enum(trackedPersonStatusOptions),
  level: optionalWholeNumber('Level'),
  locationType: z.enum(trackedPersonLocationOptions),
  settlementKey: z.string().trim().max(120).optional().or(z.literal('')),
  siteName: z.string().trim().max(120).optional().or(z.literal('')),
  notes: z.string().trim().max(200, 'Notes must be 200 characters or fewer').optional().or(z.literal('')),
  activeUntilWeek: optionalWholeNumber('Active until week'),
  hiddenSinceWeek: optionalWholeNumber('Hidden since week'),
  capturedSinceWeek: optionalWholeNumber('Captured since week'),
  rescuedWeek: optionalWholeNumber('Rescued week'),
  restoredWeek: optionalWholeNumber('Restored week'),
  rescueDcOverride: optionalWholeNumber('Rescue DC override'),
  sourceAction: z.enum(trackedPersonSourceActionOptions),
});

export type TrackedPersonFormValues = z.infer<typeof trackedPersonFormSchema>;

export const eventStateFormSchema = z.object({
  weekNumber: requiredWholeNumber('Week number'),
  eventType: z.enum(eventTypeOptions),
  isPersistent: z.enum(yesNoOptions),
  startedWeek: requiredWholeNumber('Started week'),
  endedWeek: optionalWholeNumber('Ended week'),
  mitigationUntilWeek: optionalWholeNumber('Mitigation until week'),
  resolved: z.enum(yesNoOptions),
});

export type EventStateFormValues = z.infer<typeof eventStateFormSchema>;

export type QueueEffectRecord = IQueuedEffect & { index: number };
export type TeamStateRecord = IMilitiaStateSetup['teamStates'][number];
export type CacheStateRecord = ITrackedCache;
export type OrderStateRecord = ITrackedOrder;
export type TrackedPersonRecord = ITrackedPerson;
export type EventStateRecord = IEventStateEntry;

export function buildMilitiaCoreFormValues(militia: {
  name: string;
  rank: number;
  highestBoonReached: number;
  HQLocation: string;
  treasury: number;
  notoriety: number;
  focus: 'Secrecy' | 'Loyalty' | 'Security' | null;
  training: number;
}): MilitiaCoreFormValues {
  return {
    name: militia.name,
    rank: String(militia.rank),
    highestBoonReached: String(militia.highestBoonReached),
    HQLocation: militia.HQLocation,
    treasury: String(militia.treasury),
    notoriety: String(militia.notoriety),
    focus: militia.focus ?? 'none',
    training: String(militia.training),
  };
}

export function buildWeekContextFormValues(
  state: IWeekContextState,
): WeekContextFormValues {
  return {
    weekNumber: String(state.weekNumber),
    phase: state.phase,
    isFirstWeek: state.isFirstWeek ? 'yes' : 'no',
    skippedUpkeepThisWeek: state.skippedUpkeepThisWeek ? 'yes' : 'no',
    uneventfulBonusCarry: String(state.uneventfulBonusCarry),
    lastPersistentBuyoffWeek:
      state.lastPersistentBuyoffWeek !== undefined
        ? String(state.lastPersistentBuyoffWeek)
        : '',
  };
}

export const defaultQueueEffectFormValues: QueueEffectFormValues = {
  kind: 'week_of_pain_checks_penalty',
  appliesWeek: '',
  note: '',
};

export const defaultTeamStateFormValues: TeamStateFormValues = {
  teamId: 'moles',
  status: 'active',
  unavailableUntilWeek: '',
  notes: '',
};

export const defaultCacheStateFormValues: CacheStateFormValues = {
  label: '',
  cacheClass: 'minor',
  location: '',
  contentsSummary: '',
  status: 'hidden',
  secureLocation: 'no',
  createdWeek: '',
  updatedWeek: '',
  retrievedWeek: '',
  lostWeek: '',
};

export const defaultOrderStateFormValues: OrderStateFormValues = {
  description: '',
  notes: '',
  costPaid: '',
  deliveryDays: '',
  orderedWeek: '',
  dueWeek: '',
  status: 'pending',
  deliveredWeek: '',
  sourceAction: 'none',
  marketplaceId: '',
};

export const defaultTrackedPersonFormValues: TrackedPersonFormValues = {
  targetSource: 'none',
  characterId: '',
  displayName: '',
  personKind: 'pc',
  status: 'active',
  level: '',
  locationType: 'unknown',
  settlementKey: '',
  siteName: '',
  notes: '',
  activeUntilWeek: '',
  hiddenSinceWeek: '',
  capturedSinceWeek: '',
  rescuedWeek: '',
  restoredWeek: '',
  rescueDcOverride: '',
  sourceAction: 'manual',
};

export const defaultEventStateFormValues: EventStateFormValues = {
  weekNumber: '',
  eventType: 'all_is_calm',
  isPersistent: 'yes',
  startedWeek: '',
  endedWeek: '',
  mitigationUntilWeek: '',
  resolved: 'no',
};

export function buildQueueEffectFormValues(effect: IQueuedEffect): QueueEffectFormValues {
  return {
    kind: effect.kind,
    appliesWeek: String(effect.appliesWeek),
    note: effect.note ?? '',
  };
}

export function buildTeamStateFormValues(teamState: TeamStateRecord): TeamStateFormValues {
  return {
    teamId: teamState.teamId as TeamStateFormValues['teamId'],
    status: teamState.status,
    unavailableUntilWeek:
      teamState.unavailableUntilWeek !== undefined
        ? String(teamState.unavailableUntilWeek)
        : '',
    notes: teamState.notes ?? '',
  };
}

export function buildCacheStateFormValues(cache: CacheStateRecord): CacheStateFormValues {
  return {
    label: cache.label,
    cacheClass: cache.cacheClass,
    location: cache.location,
    contentsSummary: cache.contentsSummary,
    status: cache.status,
    secureLocation: cache.isSecureLocation ? 'yes' : 'no',
    createdWeek: String(cache.createdWeek),
    updatedWeek: String(cache.updatedWeek),
    retrievedWeek: cache.retrievedWeek !== undefined ? String(cache.retrievedWeek) : '',
    lostWeek: cache.lostWeek !== undefined ? String(cache.lostWeek) : '',
  };
}

export function buildOrderStateFormValues(order: OrderStateRecord): OrderStateFormValues {
  return {
    description: order.description,
    notes: order.notes ?? '',
    costPaid: order.costPaid !== undefined ? String(order.costPaid) : '',
    deliveryDays: String(order.deliveryDays),
    orderedWeek: String(order.orderedWeek),
    dueWeek: String(order.dueWeek),
    status: order.status,
    deliveredWeek: order.deliveredWeek !== undefined ? String(order.deliveredWeek) : '',
    sourceAction: order.sourceAction ?? 'none',
    marketplaceId: order.marketplaceId ?? '',
  };
}

export function buildTrackedPersonFormValues(
  person: TrackedPersonRecord,
): TrackedPersonFormValues {
  return {
    targetSource: person.characterId ? 'character' : 'none',
    characterId: person.characterId ?? '',
    displayName: person.displayName,
    personKind: person.personKind,
    status: person.status,
    level: person.level !== undefined ? String(person.level) : '',
    locationType: person.locationType,
    settlementKey: person.settlementKey ?? '',
    siteName: person.siteName ?? '',
    notes: person.notes ?? '',
    activeUntilWeek: person.activeUntilWeek !== undefined ? String(person.activeUntilWeek) : '',
    hiddenSinceWeek: person.hiddenSinceWeek !== undefined ? String(person.hiddenSinceWeek) : '',
    capturedSinceWeek:
      person.capturedSinceWeek !== undefined ? String(person.capturedSinceWeek) : '',
    rescuedWeek: person.rescuedWeek !== undefined ? String(person.rescuedWeek) : '',
    restoredWeek: person.restoredWeek !== undefined ? String(person.restoredWeek) : '',
    rescueDcOverride:
      person.rescueDcOverride !== undefined ? String(person.rescueDcOverride) : '',
    sourceAction: person.sourceAction ?? 'manual',
  };
}

export function buildEventStateFormValues(
  eventState: EventStateRecord,
): EventStateFormValues {
  return {
    weekNumber: String(eventState.weekNumber),
    eventType: eventState.eventType,
    isPersistent: eventState.isPersistent ? 'yes' : 'no',
    startedWeek: String(eventState.startedWeek),
    endedWeek: eventState.endedWeek !== undefined ? String(eventState.endedWeek) : '',
    mitigationUntilWeek:
      eventState.mitigationUntilWeek !== undefined
        ? String(eventState.mitigationUntilWeek)
        : '',
    resolved: eventState.resolved ? 'yes' : 'no',
  };
}

export type CharacterOption = {
  _id: Id<'character'>;
  name: string;
  kind?: 'pc' | 'officer_npc';
  level: number;
};
