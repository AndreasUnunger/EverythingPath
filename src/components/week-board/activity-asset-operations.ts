'use client';

import type { Id } from '@convex/_generated/dataModel';

export type CacheClass = 'minor' | 'intermediate' | 'major';
export type CacheMode = 'place' | 'retrieve';
export type CacheStatus = 'hidden' | 'pending_return' | 'retrieved' | 'lost';
export type OrderStatus = 'pending' | 'delivered' | 'cancelled';
export type TrackedPersonKind = 'pc' | 'officer_npc' | 'other_npc';
export type TrackedPersonStatus =
  | 'active'
  | 'hidden'
  | 'captured'
  | 'recovering'
  | 'contact';
export type TrackedPersonLocationType =
  | 'hq'
  | 'refuge'
  | 'settlement'
  | 'site'
  | 'unknown';
export type CovertActionMode = 'augment_action' | 'place_contact';
export type RestoreCharacterMode =
  | 'party_ability_damage'
  | 'party_hit_points'
  | 'party_lesser_restorative'
  | 'break_enchantment'
  | 'raise_dead'
  | 'restoration'
  | 'stone_to_flesh'
  | 'custom';

export type ActivityAssetOperationsDraft = {
  refuges: Array<{
    slotIndex: number;
    settlementKey: string;
  }>;
  caches: Array<{
    slotIndex: number;
    mode: CacheMode;
    cacheId?: string;
    label?: string;
    cacheClass?: CacheClass;
    location?: string;
    contentsSummary?: string;
    isSecureLocation?: boolean;
    checkTotal?: string;
  }>;
  orders: Array<{
    slotIndex: number;
    description: string;
    notes?: string;
    costPaid?: string;
    deliveryDays?: string;
  }>;
  covertActions: Array<{
    slotIndex: number;
    mode?: CovertActionMode;
    targetSource?: 'character' | 'freeform';
    followupSlotIndex?: number;
    characterId?: Id<'character'>;
    displayName?: string;
    personKind?: TrackedPersonKind;
    siteName?: string;
    notes?: string;
  }>;
  rescues: Array<{
    slotIndex: number;
    targetSource?: 'tracked' | 'character' | 'freeform';
    targetStatusId?: string;
    characterId?: Id<'character'>;
    displayName?: string;
    personKind?: TrackedPersonKind;
    targetLevel?: string;
    destinationType?: 'hq' | 'refuge' | 'settlement';
    destinationSettlementKey?: string;
  }>;
  restorations: Array<{
    slotIndex: number;
    targetSource?: 'tracked' | 'character' | 'freeform';
    targetStatusId?: string;
    characterId?: Id<'character'>;
    displayName?: string;
    personKind?: TrackedPersonKind;
    mode?: RestoreCharacterMode;
    customCostTotal?: string;
  }>;
};

export type SettlementLedgerEntry = {
  _id: string;
  settlementKey: string;
  reputation: 'Hostile' | 'Unfriendly' | 'Indifferent' | 'Friendly' | 'Helpful';
  isSecured: boolean;
  temporaryShift?: number;
  refugeActiveUntilWeek?: number;
  refugeActivatedWeek?: number;
};

export type CacheLedgerEntry = {
  _id: string;
  label: string;
  cacheClass: CacheClass;
  location: string;
  contentsSummary: string;
  status: CacheStatus;
  isSecureLocation: boolean;
  createdWeek: number;
  updatedWeek: number;
  retrievedWeek?: number;
  lostWeek?: number;
};

export type OrderLedgerEntry = {
  _id: string;
  description: string;
  notes?: string;
  costPaid: number;
  deliveryDays: number;
  orderedWeek: number;
  dueWeek: number;
  status: OrderStatus;
  deliveredWeek?: number;
};

export type TrackedPersonLedgerEntry = {
  _id: string;
  characterId?: Id<'character'>;
  displayName: string;
  personKind: TrackedPersonKind;
  status: TrackedPersonStatus;
  level?: number;
  locationType: TrackedPersonLocationType;
  settlementKey?: string;
  siteName?: string;
  notes?: string;
  activeUntilWeek?: number;
  hiddenSinceWeek?: number;
  capturedSinceWeek?: number;
  rescuedWeek?: number;
  restoredWeek?: number;
  rescueDcOverride?: number;
  sourceAction?: 'manual' | 'covert_action' | 'rescue_character' | 'restore_character' | 'event_raid';
};

export function createEmptyActivityAssetOperationsDraft(): ActivityAssetOperationsDraft {
  return {
    refuges: [],
    caches: [],
    orders: [],
    covertActions: [],
    rescues: [],
    restorations: [],
  };
}

export function getCacheDc({
  cacheClass,
  isSecureLocation,
}: {
  cacheClass: CacheClass;
  isSecureLocation?: boolean;
}) {
  const base =
    cacheClass === 'minor'
      ? 15
      : cacheClass === 'intermediate'
        ? 20
        : 30;
  return base + (isSecureLocation ? 5 : 0);
}
