'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { Id } from '@convex/_generated/dataModel';
import { api as db } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import type { EventOverseerSupportTarget } from '~/components/week-board/officer-effects';
import type { ActionId, WeekPhase } from '~/components/week-board/types';

type ActivityTeamOperationsPatch = Partial<{
  recruits: Array<{ slotIndex: number; teamId: string }>;
  dismissals: Array<{ slotIndex: number; teamId: string }>;
  upgrades: Array<{ slotIndex: number; fromTeamId: string; toTeamId: string }>;
}>;

type ActivityOfficerOperationsPatch = Partial<{
  changes: Array<{
    slotIndex: number;
    role:
      | 'ambassador'
      | 'commandant'
      | 'marshal'
      | 'overseer'
      | 'spymaster'
      | 'strategist';
    characterId?: Id<'character'>;
  }>;
}>;

type ActivityAssetOperationsPatch = Partial<{
  refuges: Array<{ slotIndex: number; settlementKey: string }>;
  reduceDangerTargets: Array<{ slotIndex: number; settlementKey: string }>;
  spreadPropagandaTargets: Array<{ slotIndex: number; settlementKey: string }>;
  strikeTeams: Array<{
    slotIndex: number;
    mode: 'combat_support' | 'extraction';
    location?: string;
    notes?: string;
  }>;
  caches: Array<{
    slotIndex: number;
    mode: 'place' | 'retrieve';
    cacheId?: string;
    label?: string;
    cacheClass?: 'minor' | 'intermediate' | 'major';
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
  marketplaces: Array<{
    slotIndex: number;
    label?: string;
    purchaseSummary?: string;
    notes?: string;
  }>;
  covertActions: Array<{
    slotIndex: number;
    mode?: 'augment_action' | 'place_contact';
    targetSource?: 'character' | 'freeform';
    followupSlotIndex?: number;
    characterId?: Id<'character'>;
    displayName?: string;
    personKind?: 'pc' | 'officer_npc' | 'other_npc';
    siteName?: string;
    notes?: string;
  }>;
  rescues: Array<{
    slotIndex: number;
    targetSource?: 'tracked' | 'character' | 'freeform';
    targetStatusId?: string;
    characterId?: Id<'character'>;
    displayName?: string;
    personKind?: 'pc' | 'officer_npc' | 'other_npc';
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
    personKind?: 'pc' | 'officer_npc' | 'other_npc';
    mode?:
      | 'party_ability_damage'
      | 'party_hit_points'
      | 'party_lesser_restorative'
      | 'break_enchantment'
      | 'raise_dead'
      | 'restoration'
      | 'stone_to_flesh'
      | 'custom';
    customCostTotal?: string;
  }>;
}>;

type EventMitigationsPatch = Partial<{
  cacheDiscoveredMitigationTotal: string;
  theftMitigationTotal: string;
  sicknessTwiceLoyaltyTotal: string;
  turncoatTrainingLossTotal: string;
  turncoatOfficerCheckTotal: string;
  turncoatSelectedTeamId: string | null;
  rivalrySelectedTeamIds: string[];
  missingInActionSelectedTeamId: string | null;
  sicknessSelectedTeamId: string | null;
  turnAroundBoostTeamId: string | null;
  marketDayMarketplaceId: string | null;
  marketDayTownName: string | null;
  overseerEventSupportTarget: EventOverseerSupportTarget | null;
}>;

type UpkeepRollTotalsPatch = Partial<{
  attritionTotal: string;
  notorietyPenaltyTotal: string;
  maxNotorietyLoyaltyCheckTotal: string;
  nearestSettlementKey: string;
  treasuryPenaltyTotal: string;
}>;

type ActivityRollTotalsPatch = Partial<{
  activateBlackMarketCheckTotal: string;
  activateBlackMarketNotorietyIncreaseTotal: string;
  dismissTeamCheckTotal: string;
  dismissTeamNotorietyIncreaseTotal: string;
  drillMilitiaCheckTotal: string;
  drillMilitiaTrainingGainTotal: string;
  earnGoldCheckTotal: string;
  earnGoldTotal: string;
  earnGoldNotorietyIncreaseTotal: string;
  gatherInformationCheckTotal: string;
  gatherInformationNotorietyIncreaseTotal: string;
  guaranteeEventNotorietyIncreaseTotal: string;
  knowledgeCheckTotal: string;
  recruitTeamCheckTotal: string;
  recruitTeamNotorietyIncreaseTotal: string;
  reduceDangerCheckTotal: string;
  reduceDangerNotorietyIncreaseTotal: string;
  rescueCharacterCheckTotal: string;
  rescueCharacterTargetLevelTotal: string;
  rescueCharacterNotorietyIncreaseTotal: string;
  restoreCharacterCostTotal: string;
  secureCacheCheckTotal: string;
  specialActionCostTotal: string;
  specialOrderItemCostTotal: string;
  spreadPropagandaCheckTotal: string;
  specialOrderDeliveryDaysTotal: string;
}>;

type EventRollTotalsPatch = Partial<{
  eventChanceTotal: string;
  eventTriggerRollTotal: string;
  eventPercentileTotal: string;
  rollTwiceFirstTotal: string;
  rollTwiceSecondTotal: string;
  guaranteedFirstPercentileTotal: string;
  guaranteedSecondPercentileTotal: string;
  guaranteedChosen: 'first' | 'second' | null;
  sabotageCheckTotal: string;
  sabotageNotorietyIncreaseTotal: string;
}>;

export type WeekBoardPatch = {
  phase?: WeekPhase;
  weekNumber?: number;
  stagedActivityActionIds?: (ActionId | null)[];
  stagedActivityTeamIds?: (string | null)[];
  activityTeamOperations?: ActivityTeamOperationsPatch;
  activityOfficerOperations?: ActivityOfficerOperationsPatch;
  activityAssetOperations?: ActivityAssetOperationsPatch;
  eventMitigations?: EventMitigationsPatch;
  upkeepRollTotals?: UpkeepRollTotalsPatch;
  activityRollTotals?: ActivityRollTotalsPatch;
  eventRollTotals?: EventRollTotalsPatch;
};

type PendingResolver = {
  resolve: () => void;
  reject: (error: unknown) => void;
};

const AUTOSAVE_BATCH_WINDOW_MS = 80;

function mergeDefinedObject<T extends Record<string, unknown>>(
  current: T | undefined,
  next: T | undefined,
) {
  if (!current) return next;
  if (!next) return current;
  return {
    ...current,
    ...next,
  };
}

function mergeWeekBoardPatch(
  current: WeekBoardPatch | null,
  next: WeekBoardPatch,
): WeekBoardPatch {
  if (!current) return next;

  return {
    ...current,
    ...next,
    activityTeamOperations: mergeDefinedObject(
      current.activityTeamOperations,
      next.activityTeamOperations,
    ),
    activityOfficerOperations: mergeDefinedObject(
      current.activityOfficerOperations,
      next.activityOfficerOperations,
    ),
    activityAssetOperations: mergeDefinedObject(
      current.activityAssetOperations,
      next.activityAssetOperations,
    ),
    eventMitigations: mergeDefinedObject(
      current.eventMitigations,
      next.eventMitigations,
    ),
    upkeepRollTotals: mergeDefinedObject(
      current.upkeepRollTotals,
      next.upkeepRollTotals,
    ),
    activityRollTotals: mergeDefinedObject(
      current.activityRollTotals,
      next.activityRollTotals,
    ),
    eventRollTotals: mergeDefinedObject(
      current.eventRollTotals,
      next.eventRollTotals,
    ),
  };
}

export function useWeekBoardMutations(organizationId: string) {
  const saveWeekBoardState = useMutation(db.weekBoard.saveWeekBoardState);
  const commitCurrentPhase = useMutation(db.weekBoard.commitCurrentPhase);
  const goToPreviousWeek = useMutation(db.weekBoard.goToPreviousWeek);
  const applyTreasuryTransaction = useMutation(
    db.weekBoard.applyTreasuryTransaction,
  );
  const rankUpMilitia = useMutation(db.weekBoard.rankUpMilitia);
  const buyOffPersistentEvent = useMutation(db.weekBoard.buyOffPersistentEvent);
  const pendingPatchRef = useRef<WeekBoardPatch | null>(null);
  const pendingMilitiaIdRef = useRef<Id<'militia'> | null>(null);
  const pendingResolversRef = useRef<PendingResolver[]>([]);
  const pendingTimerRef = useRef<number | null>(null);

  const clearPendingTimer = useCallback(() => {
    if (pendingTimerRef.current !== null) {
      window.clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
  }, []);

  const flushQueuedPatch = useCallback(
    async (militiaId?: Id<'militia'>) => {
      const targetMilitiaId = militiaId ?? pendingMilitiaIdRef.current;
      const patch = pendingPatchRef.current;
      const pendingResolvers = pendingResolversRef.current;

      clearPendingTimer();
      pendingPatchRef.current = null;
      pendingMilitiaIdRef.current = null;
      pendingResolversRef.current = [];

      if (!targetMilitiaId || !patch) {
        pendingResolvers.forEach((resolver) => resolver.resolve());
        return;
      }

      try {
        await saveWeekBoardState({
          organizationId,
          militiaId: targetMilitiaId,
          patch: patch as never,
        });
        pendingResolvers.forEach((resolver) => resolver.resolve());
      } catch (error) {
        pendingResolvers.forEach((resolver) => resolver.reject(error));
        throw error;
      }
    },
    [clearPendingTimer, organizationId, saveWeekBoardState],
  );

  const queuePatch = useCallback(
    (militiaId: Id<'militia'>, patch: WeekBoardPatch) =>
      new Promise<void>((resolve, reject) => {
        if (
          pendingMilitiaIdRef.current &&
          pendingMilitiaIdRef.current !== militiaId
        ) {
          void flushQueuedPatch(pendingMilitiaIdRef.current)
            .then(() => {
              pendingMilitiaIdRef.current = militiaId;
              pendingPatchRef.current = mergeWeekBoardPatch(
                pendingPatchRef.current,
                patch,
              );
              pendingResolversRef.current.push({ resolve, reject });
              clearPendingTimer();
              pendingTimerRef.current = window.setTimeout(() => {
                void flushQueuedPatch(militiaId).catch((error) => {
                  void error;
                });
              }, AUTOSAVE_BATCH_WINDOW_MS);
            })
            .catch(reject);
          return;
        }

        pendingMilitiaIdRef.current = militiaId;
        pendingPatchRef.current = mergeWeekBoardPatch(pendingPatchRef.current, patch);
        pendingResolversRef.current.push({ resolve, reject });
        clearPendingTimer();
        pendingTimerRef.current = window.setTimeout(() => {
          void flushQueuedPatch(militiaId).catch((error) => {
            void error;
          });
        }, AUTOSAVE_BATCH_WINDOW_MS);
      }),
    [clearPendingTimer, flushQueuedPatch],
  );

  useEffect(
    () => () => {
      clearPendingTimer();
    },
    [clearPendingTimer],
  );

  const savePhase = async (militiaId: Id<'militia'>, phase: WeekPhase) => {
    await flushQueuedPatch(militiaId);
    await saveWeekBoardState({
      organizationId,
      militiaId,
      patch: { phase },
    });
  };

  const saveSlots = async (
    militiaId: Id<'militia'>,
    stagedActivityActionIds: (ActionId | null)[],
    stagedActivityTeamIds?: (string | null)[],
  ) => {
    await flushQueuedPatch(militiaId);
    await saveWeekBoardState({
      organizationId,
      militiaId,
      patch: {
        stagedActivityActionIds,
        stagedActivityTeamIds: stagedActivityTeamIds as never,
      },
    });
  };

  const saveStagedTeams = async (
    militiaId: Id<'militia'>,
    stagedActivityTeamIds: (string | null)[],
  ) => {
    await flushQueuedPatch(militiaId);
    await saveWeekBoardState({
      organizationId,
      militiaId,
      patch: { stagedActivityTeamIds: stagedActivityTeamIds as never },
    });
  };

  const queueActivityTeamOperationsPatch = async (
    militiaId: Id<'militia'>,
    activityTeamOperations: ActivityTeamOperationsPatch,
  ) => {
    await queuePatch(militiaId, {
      activityTeamOperations: activityTeamOperations as never,
    });
  };

  const queueActivityOfficerOperationsPatch = async (
    militiaId: Id<'militia'>,
    activityOfficerOperations: ActivityOfficerOperationsPatch,
  ) => {
    await queuePatch(militiaId, {
      activityOfficerOperations: activityOfficerOperations as never,
    });
  };

  const queueActivityAssetOperationsPatch = async (
    militiaId: Id<'militia'>,
    activityAssetOperations: ActivityAssetOperationsPatch,
  ) => {
    await queuePatch(militiaId, {
      activityAssetOperations: activityAssetOperations as never,
    });
  };

  const queueEventMitigationsPatch = async (
    militiaId: Id<'militia'>,
    eventMitigations: EventMitigationsPatch,
  ) => {
    await queuePatch(militiaId, {
      eventMitigations: eventMitigations as never,
    });
  };

  const queueUpkeepTotalsPatch = async (
    militiaId: Id<'militia'>,
    upkeepRollTotals: UpkeepRollTotalsPatch,
  ) => {
    await queuePatch(militiaId, { upkeepRollTotals });
  };

  const queueActivityRollTotalsPatch = async (
    militiaId: Id<'militia'>,
    activityRollTotals: ActivityRollTotalsPatch,
  ) => {
    await queuePatch(militiaId, { activityRollTotals });
  };

  const queueEventTotalsPatch = async (
    militiaId: Id<'militia'>,
    eventRollTotals: EventRollTotalsPatch,
  ) => {
    await queuePatch(militiaId, { eventRollTotals: eventRollTotals as never });
  };

  const continueToSummary = async (
    militiaId: Id<'militia'>,
    nextPhase: WeekPhase,
    eventRollTotals: {
      eventChanceTotal?: string;
      eventTriggerRollTotal?: string;
      eventPercentileTotal?: string;
      rollTwiceFirstTotal?: string;
      rollTwiceSecondTotal?: string;
      guaranteedFirstPercentileTotal?: string;
      guaranteedSecondPercentileTotal?: string;
      guaranteedChosen?: 'first' | 'second';
      sabotageCheckTotal?: string;
      sabotageNotorietyIncreaseTotal?: string;
    },
  ) => {
    await flushQueuedPatch(militiaId);
    await saveWeekBoardState({
      organizationId,
      militiaId,
      patch: {
        phase: nextPhase,
        eventRollTotals,
      },
    });
  };

  const commitPhase = async (militiaId: Id<'militia'>) => {
    await flushQueuedPatch(militiaId);
    await commitCurrentPhase({
      organizationId,
      militiaId,
    });
  };

  const goBackWeek = async (militiaId: Id<'militia'>) => {
    await flushQueuedPatch(militiaId);
    await goToPreviousWeek({
      organizationId,
      militiaId,
    });
  };

  const applyTreasuryUpdate = async (
    militiaId: Id<'militia'>,
    mode: 'deposit' | 'withdraw',
    amount: string,
  ) => {
    await flushQueuedPatch(militiaId);
    await applyTreasuryTransaction({
      organizationId,
      militiaId,
      depositTotal: mode === 'deposit' ? amount : '0',
      withdrawalTotal: mode === 'withdraw' ? amount : '0',
    });
  };

  const applyRankUp = async (militiaId: Id<'militia'>) => {
    await flushQueuedPatch(militiaId);
    await rankUpMilitia({
      organizationId,
      militiaId,
    });
  };

  const buyOffPersistentEventAction = async (
    militiaId: Id<'militia'>,
    eventStateId: Id<'militiaEventState'>,
  ) => {
    await flushQueuedPatch(militiaId);
    await buyOffPersistentEvent({
      organizationId,
      militiaId,
      eventStateId,
    });
  };

  return {
    queuePatch,
    flushQueuedPatchAction: flushQueuedPatch,
    savePhase,
    saveSlots,
    saveStagedTeams,
    queueActivityTeamOperationsPatch,
    queueActivityOfficerOperationsPatch,
    queueActivityAssetOperationsPatch,
    queueEventMitigationsPatch,
    queueUpkeepTotalsPatch,
    queueActivityRollTotalsPatch,
    queueEventTotalsPatch,
    continueToSummary,
    commitPhase,
    goBackWeek,
    applyTreasuryUpdate,
    applyRankUp,
    buyOffPersistentEventAction,
  };
}
