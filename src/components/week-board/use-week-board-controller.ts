'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Id } from '@convex/_generated/dataModel';
import {
  createEmptyActivityAssetOperationsDraft,
  type ActivityAssetOperationsDraft,
} from '~/components/week-board/activity-asset-operations';
import { buildActivityRollSummaryRows } from '~/components/week-board/activity-roll-sections';
import {
  resolveEventTrigger,
  resolveMilitiaEventFromPercentile,
} from '~/components/week-board/event-utils';
import {
  readActivityRollTotals,
  readEventRollTotals,
  readUpkeepRollTotals,
} from '~/components/week-board/roll-totals';
import {
  buildOfficerEffects,
  getEventOverseerSupportOptions,
  type EventOverseerSupportTarget,
} from '~/components/week-board/officer-effects';
import {
  createEmptyWeekBoardControllerSyncedState,
  mergeWeekBoardControllerSyncedStateWithServer,
  type ActivityOfficerOperationsDraft,
  type ActivityTeamOperationsDraft,
  type OfficerRole,
  type WeekBoardControllerSyncedState,
} from '~/components/week-board/week-board-controller-sync';
import type { ActionId, DragState, WeekPhase } from '~/components/week-board/types';
import { useWeekBoardMutations } from '~/components/week-board/use-week-board-mutations';
import { useActivityCardDrag } from '~/hooks/use-activity-card-drag';
import { useDebouncedAutosave } from '~/hooks/use-debounced-autosave';
import { weekBoardStateQuery } from '~/lib/sharedQueries';

export function useWeekBoardController({
  campaignId,
  organizationId,
  canQuery,
}: {
  campaignId: Id<'campaign'> | undefined;
  organizationId: string;
  canQuery: boolean;
}) {
  const { data, isLoading } = weekBoardStateQuery(
    campaignId,
    organizationId,
    canQuery,
  );
  const mutations = useWeekBoardMutations(organizationId);

  const [upkeepAttritionTotal, setUpkeepAttritionTotal] = useState('');
  const [upkeepNotorietyPenaltyTotal, setUpkeepNotorietyPenaltyTotal] =
    useState('');
  const [maxNotorietyLoyaltyCheckTotal, setMaxNotorietyLoyaltyCheckTotal] =
    useState('');
  const [nearestSettlementKey, setNearestSettlementKey] = useState('');
  const [upkeepTreasuryPenaltyTotal, setUpkeepTreasuryPenaltyTotal] =
    useState('');
  const [eventChanceTotal, setEventChanceTotal] = useState('');
  const [eventTriggerRollTotal, setEventTriggerRollTotal] = useState('');
  const [eventPercentileTotal, setEventPercentileTotal] = useState('');
  const [eventRollTwiceFirst, setEventRollTwiceFirst] = useState('');
  const [eventRollTwiceSecond, setEventRollTwiceSecond] = useState('');
  const [guaranteedEventFirstPercentileTotal, setGuaranteedEventFirstPercentileTotal] =
    useState('');
  const [guaranteedEventSecondPercentileTotal, setGuaranteedEventSecondPercentileTotal] =
    useState('');
  const [guaranteedEventChoice, setGuaranteedEventChoice] = useState<
    'first' | 'second' | ''
  >('');
  const [sabotageCheckTotal, setSabotageCheckTotal] = useState('');
  const [sabotageNotorietyIncreaseTotal, setSabotageNotorietyIncreaseTotal] =
    useState('');
  const [treasuryAmount, setTreasuryAmount] = useState('');
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [activeDropSlotId, setActiveDropSlotId] = useState<string | null>(null);
  const [optimisticSlots, setOptimisticSlots] = useState<(ActionId | null)[] | null>(
    null,
  );
  const [optimisticTeams, setOptimisticTeams] = useState<(string | null)[] | null>(
    null,
  );
  const [activityTeamOperations, setActivityTeamOperations] =
    useState<ActivityTeamOperationsDraft>({
      recruits: [],
      dismissals: [],
      upgrades: [],
    });
  const [activityOfficerOperations, setActivityOfficerOperations] =
    useState<ActivityOfficerOperationsDraft>({
      changes: [],
    });
  const [activityAssetOperations, setActivityAssetOperations] =
    useState<ActivityAssetOperationsDraft>(
      createEmptyActivityAssetOperationsDraft(),
    );
  const [cacheDiscoveredMitigationTotal, setCacheDiscoveredMitigationTotal] =
    useState('');
  const [theftMitigationTotal, setTheftMitigationTotal] = useState('');
  const [sicknessTwiceLoyaltyTotal, setSicknessTwiceLoyaltyTotal] = useState('');
  const [turncoatOfficerCheckTotal, setTurncoatOfficerCheckTotal] = useState('');
  const [turncoatSelectedTeamId, setTurncoatSelectedTeamId] = useState('');
  const [missingInActionSelectedTeamId, setMissingInActionSelectedTeamId] =
    useState('');
  const [sicknessSelectedTeamId, setSicknessSelectedTeamId] = useState('');
  const [turnAroundBoostTeamId, setTurnAroundBoostTeamId] = useState('');
  const [marketDayMarketplaceId, setMarketDayMarketplaceId] = useState('');
  const [marketDayTownName, setMarketDayTownName] = useState('');
  const [rivalrySelectedTeamIds, setRivalrySelectedTeamIds] = useState<string[]>(
    [],
  );
  const [overseerEventSupportTarget, setOverseerEventSupportTarget] = useState<
    EventOverseerSupportTarget | ''
  >('');
  const [error, setError] = useState<string>();
  const slotRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lastSyncedServerStateRef = useRef(
    createEmptyWeekBoardControllerSyncedState(),
  );
  const lastSyncScopeKeyRef = useRef('');

  const minimumTreasury = data ? data.rank * 10 : 0;
  const showMaxNotorietyPenalty = Boolean(data && data.notoriety >= 100);
  const showTreasuryShortagePenalty = Boolean(
    data && data.treasury < minimumTreasury,
  );
  const stateAny = (data?.state ?? {}) as Record<string, unknown>;
  const syncScopeKey = `${data?.militiaId ?? ''}:${data?.state.weekNumber ?? 0}:${data?.state.phase ?? ''}`;

  useEffect(() => {
    if (!data?.state) return;
    const upkeepTotals = readUpkeepRollTotals(data.state.upkeepRollTotals);
    const eventTotals = readEventRollTotals(data.state.eventRollTotals);
    const defaultEventChance = clampNumber(
      data.notoriety + (data.state.uneventfulBonusCarry ?? 0),
      10,
      95,
    ).toString();
    const defaultTreasuryPenalty = showTreasuryShortagePenalty
      ? String(data.rank + 2)
      : '';
    const defaultNearestSettlement = data.settlementKeys[0] ?? '';
    const activityOperations =
      (stateAny.activityTeamOperations as
        | {
            recruits?: Array<{ slotIndex?: number; teamId?: string }>;
            dismissals?: Array<{ slotIndex?: number; teamId?: string }>;
            upgrades?: Array<{
              slotIndex?: number;
              fromTeamId?: string;
              toTeamId?: string;
            }>;
          }
        | undefined) ?? {
        recruits: [],
        dismissals: [],
        upgrades: [],
      };
    const normalizedActivityTeamOperations: ActivityTeamOperationsDraft = {
      recruits: (activityOperations.recruits ?? [])
        .filter((item) => typeof item.slotIndex === 'number' && typeof item.teamId === 'string')
        .map((item) => ({ slotIndex: item.slotIndex!, teamId: item.teamId! })),
      dismissals: (activityOperations.dismissals ?? [])
        .filter((item) => typeof item.slotIndex === 'number' && typeof item.teamId === 'string')
        .map((item) => ({ slotIndex: item.slotIndex!, teamId: item.teamId! })),
      upgrades: (activityOperations.upgrades ?? [])
        .filter(
          (item) =>
            typeof item.slotIndex === 'number' &&
            typeof item.fromTeamId === 'string' &&
            typeof item.toTeamId === 'string',
        )
        .map((item) => ({
          slotIndex: item.slotIndex!,
          fromTeamId: item.fromTeamId!,
          toTeamId: item.toTeamId!,
        })),
    };
    const activityOfficerOps =
      (stateAny.activityOfficerOperations as
        | {
            changes?: Array<{
              slotIndex?: number;
              role?: OfficerRole;
              characterId?: Id<'character'>;
            }>;
          }
        | undefined) ?? {
        changes: [],
      };
    const normalizedActivityOfficerOperations: ActivityOfficerOperationsDraft = {
      changes: (activityOfficerOps.changes ?? [])
        .filter(
          (item) =>
            typeof item.slotIndex === 'number' &&
            (item.role === 'ambassador' ||
              item.role === 'commandant' ||
              item.role === 'marshal' ||
              item.role === 'overseer' ||
              item.role === 'spymaster' ||
              item.role === 'strategist'),
        )
        .map((item) => ({
          slotIndex: item.slotIndex!,
          role: item.role!,
          characterId: item.characterId,
        })),
    };
    const activityAssetOps =
      (stateAny.activityAssetOperations as
        | {
            refuges?: Array<{ slotIndex?: number; settlementKey?: string }>;
            caches?: Array<{
              slotIndex?: number;
              mode?: 'place' | 'retrieve';
              cacheId?: string;
              label?: string;
              cacheClass?: 'minor' | 'intermediate' | 'major';
              location?: string;
              contentsSummary?: string;
              isSecureLocation?: boolean;
              checkTotal?: number;
            }>;
            orders?: Array<{
              slotIndex?: number;
              description?: string;
              notes?: string;
              costPaid?: number;
              deliveryDays?: number;
            }>;
            marketplaces?: Array<{
              slotIndex?: number;
              label?: string;
              purchaseSummary?: string;
              notes?: string;
            }>;
            covertActions?: Array<{
              slotIndex?: number;
              mode?: 'augment_action' | 'place_contact';
              targetSource?: 'character' | 'freeform';
              followupSlotIndex?: number;
              characterId?: Id<'character'>;
              displayName?: string;
              personKind?: 'pc' | 'officer_npc' | 'other_npc';
              siteName?: string;
              notes?: string;
            }>;
            rescues?: Array<{
              slotIndex?: number;
              targetSource?: 'tracked' | 'character' | 'freeform';
              targetStatusId?: string;
              characterId?: Id<'character'>;
              displayName?: string;
              personKind?: 'pc' | 'officer_npc' | 'other_npc';
              targetLevel?: number;
              destinationType?: 'hq' | 'refuge' | 'settlement';
              destinationSettlementKey?: string;
            }>;
            restorations?: Array<{
              slotIndex?: number;
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
              customCostTotal?: number;
            }>;
          }
        | undefined) ?? {
        refuges: [],
        caches: [],
        orders: [],
        marketplaces: [],
        covertActions: [],
        rescues: [],
        restorations: [],
      };
    const normalizedActivityAssetOperations: ActivityAssetOperationsDraft = {
      refuges: (activityAssetOps.refuges ?? [])
        .filter(
          (item) =>
            typeof item.slotIndex === 'number' &&
            typeof item.settlementKey === 'string',
        )
        .map((item) => ({
          slotIndex: item.slotIndex!,
          settlementKey: item.settlementKey!,
        })),
      caches: (activityAssetOps.caches ?? [])
        .filter(
          (item) =>
            typeof item.slotIndex === 'number' &&
            (item.mode === 'place' || item.mode === 'retrieve'),
        )
        .map((item) => ({
          slotIndex: item.slotIndex!,
          mode: item.mode!,
          cacheId: item.cacheId,
          label: item.label,
          cacheClass: item.cacheClass,
          location: item.location,
          contentsSummary: item.contentsSummary,
          isSecureLocation: item.isSecureLocation,
          checkTotal:
            typeof item.checkTotal === 'number'
              ? String(item.checkTotal)
              : undefined,
        })),
      orders: (activityAssetOps.orders ?? [])
        .filter(
          (item) =>
            typeof item.slotIndex === 'number' &&
            typeof item.description === 'string',
        )
        .map((item) => ({
          slotIndex: item.slotIndex!,
          description: item.description!,
          notes: item.notes,
          costPaid:
            typeof item.costPaid === 'number' ? String(item.costPaid) : undefined,
          deliveryDays:
            typeof item.deliveryDays === 'number'
              ? String(item.deliveryDays)
              : undefined,
        })),
      marketplaces: (activityAssetOps.marketplaces ?? [])
        .filter((item) => typeof item.slotIndex === 'number')
        .map((item) => ({
          slotIndex: item.slotIndex!,
          label: item.label,
          purchaseSummary: item.purchaseSummary,
          notes: item.notes,
        })),
      covertActions: (activityAssetOps.covertActions ?? [])
        .filter((item) => typeof item.slotIndex === 'number')
        .map((item) => ({
          slotIndex: item.slotIndex!,
          mode: item.mode,
          targetSource: item.targetSource,
          followupSlotIndex: item.followupSlotIndex,
          characterId: item.characterId,
          displayName: item.displayName,
          personKind: item.personKind,
          siteName: item.siteName,
          notes: item.notes,
        })),
      rescues: (activityAssetOps.rescues ?? [])
        .filter((item) => typeof item.slotIndex === 'number')
        .map((item) => ({
          slotIndex: item.slotIndex!,
          targetSource: item.targetSource,
          targetStatusId: item.targetStatusId,
          characterId: item.characterId,
          displayName: item.displayName,
          personKind: item.personKind,
          targetLevel:
            typeof item.targetLevel === 'number'
              ? String(item.targetLevel)
              : undefined,
          destinationType: item.destinationType,
          destinationSettlementKey: item.destinationSettlementKey,
        })),
      restorations: (activityAssetOps.restorations ?? [])
        .filter((item) => typeof item.slotIndex === 'number')
        .map((item) => ({
          slotIndex: item.slotIndex!,
          targetSource: item.targetSource,
          targetStatusId: item.targetStatusId,
          characterId: item.characterId,
          displayName: item.displayName,
          personKind: item.personKind,
          mode: item.mode,
          customCostTotal:
            typeof item.customCostTotal === 'number'
              ? String(item.customCostTotal)
              : undefined,
        })),
    };
    const eventMitigations =
      (stateAny.eventMitigations as Record<string, unknown> | undefined) ?? {};
    const nextServerState: WeekBoardControllerSyncedState = {
      upkeepAttritionTotal: upkeepTotals.attritionTotal?.toString() ?? '',
      upkeepNotorietyPenaltyTotal:
        upkeepTotals.notorietyPenaltyTotal?.toString() ?? '',
      maxNotorietyLoyaltyCheckTotal:
        upkeepTotals.maxNotorietyLoyaltyCheckTotal?.toString() ?? '',
      nearestSettlementKey:
        upkeepTotals.nearestSettlementKey ?? defaultNearestSettlement,
      upkeepTreasuryPenaltyTotal:
        upkeepTotals.treasuryPenaltyTotal?.toString() ?? defaultTreasuryPenalty,
      eventChanceTotal: eventTotals.eventChanceTotal?.toString() ?? defaultEventChance,
      eventTriggerRollTotal: eventTotals.eventTriggerRollTotal?.toString() ?? '',
      eventPercentileTotal: eventTotals.eventPercentileTotal?.toString() ?? '',
      eventRollTwiceFirst: eventTotals.rollTwiceFirstTotal?.toString() ?? '',
      eventRollTwiceSecond: eventTotals.rollTwiceSecondTotal?.toString() ?? '',
      guaranteedEventFirstPercentileTotal:
        eventTotals.guaranteedFirstPercentileTotal?.toString() ?? '',
      guaranteedEventSecondPercentileTotal:
        eventTotals.guaranteedSecondPercentileTotal?.toString() ?? '',
      guaranteedEventChoice: eventTotals.guaranteedChosen ?? '',
      sabotageCheckTotal: eventTotals.sabotageCheckTotal?.toString() ?? '',
      sabotageNotorietyIncreaseTotal:
        eventTotals.sabotageNotorietyIncreaseTotal?.toString() ?? '',
      activityTeamOperations: normalizedActivityTeamOperations,
      activityOfficerOperations: normalizedActivityOfficerOperations,
      activityAssetOperations: normalizedActivityAssetOperations,
      cacheDiscoveredMitigationTotal:
        typeof eventMitigations.cacheDiscoveredMitigationTotal === 'number'
          ? String(eventMitigations.cacheDiscoveredMitigationTotal)
          : '',
      theftMitigationTotal:
        typeof eventMitigations.theftMitigationTotal === 'number'
          ? String(eventMitigations.theftMitigationTotal)
          : '',
      sicknessTwiceLoyaltyTotal:
        typeof eventMitigations.sicknessTwiceLoyaltyTotal === 'number'
          ? String(eventMitigations.sicknessTwiceLoyaltyTotal)
          : '',
      turncoatOfficerCheckTotal:
        typeof eventMitigations.turncoatOfficerCheckTotal === 'number'
          ? String(eventMitigations.turncoatOfficerCheckTotal)
          : '',
      turncoatSelectedTeamId:
        typeof eventMitigations.turncoatSelectedTeamId === 'string'
          ? eventMitigations.turncoatSelectedTeamId
          : '',
      missingInActionSelectedTeamId:
        typeof eventMitigations.missingInActionSelectedTeamId === 'string'
          ? eventMitigations.missingInActionSelectedTeamId
          : '',
      sicknessSelectedTeamId:
        typeof eventMitigations.sicknessSelectedTeamId === 'string'
          ? eventMitigations.sicknessSelectedTeamId
          : '',
      turnAroundBoostTeamId:
        typeof eventMitigations.turnAroundBoostTeamId === 'string'
          ? eventMitigations.turnAroundBoostTeamId
          : '',
      marketDayMarketplaceId:
        typeof eventMitigations.marketDayMarketplaceId === 'string'
          ? eventMitigations.marketDayMarketplaceId
          : '',
      marketDayTownName:
        typeof eventMitigations.marketDayTownName === 'string'
          ? eventMitigations.marketDayTownName
          : '',
      rivalrySelectedTeamIds: Array.isArray(eventMitigations.rivalrySelectedTeamIds)
        ? eventMitigations.rivalrySelectedTeamIds.filter(
            (value): value is string => typeof value === 'string',
          )
        : [],
      overseerEventSupportTarget:
        eventMitigations.overseerEventSupportTarget === 'sabotage' ||
        eventMitigations.overseerEventSupportTarget === 'cache_discovered' ||
        eventMitigations.overseerEventSupportTarget === 'theft' ||
        eventMitigations.overseerEventSupportTarget === 'sickness_twice'
          ? eventMitigations.overseerEventSupportTarget
          : '',
    };
    const currentState: WeekBoardControllerSyncedState = {
      upkeepAttritionTotal,
      upkeepNotorietyPenaltyTotal,
      maxNotorietyLoyaltyCheckTotal,
      nearestSettlementKey,
      upkeepTreasuryPenaltyTotal,
      eventChanceTotal,
      eventTriggerRollTotal,
      eventPercentileTotal,
      eventRollTwiceFirst,
      eventRollTwiceSecond,
      guaranteedEventFirstPercentileTotal,
      guaranteedEventSecondPercentileTotal,
      guaranteedEventChoice,
      sabotageCheckTotal,
      sabotageNotorietyIncreaseTotal,
      activityTeamOperations,
      activityOfficerOperations,
      activityAssetOperations,
      cacheDiscoveredMitigationTotal,
      theftMitigationTotal,
      sicknessTwiceLoyaltyTotal,
      turncoatOfficerCheckTotal,
      turncoatSelectedTeamId,
      missingInActionSelectedTeamId,
      sicknessSelectedTeamId,
      turnAroundBoostTeamId,
      marketDayMarketplaceId,
      marketDayTownName,
      rivalrySelectedTeamIds,
      overseerEventSupportTarget,
    };
    const mergedState = mergeWeekBoardControllerSyncedStateWithServer({
      currentState,
      previousServerState: lastSyncedServerStateRef.current,
      nextServerState,
      resetToServer: lastSyncScopeKeyRef.current !== syncScopeKey,
    });

    setUpkeepAttritionTotal(mergedState.upkeepAttritionTotal);
    setUpkeepNotorietyPenaltyTotal(mergedState.upkeepNotorietyPenaltyTotal);
    setMaxNotorietyLoyaltyCheckTotal(mergedState.maxNotorietyLoyaltyCheckTotal);
    setNearestSettlementKey(mergedState.nearestSettlementKey);
    setUpkeepTreasuryPenaltyTotal(mergedState.upkeepTreasuryPenaltyTotal);
    setEventChanceTotal(mergedState.eventChanceTotal);
    setEventTriggerRollTotal(mergedState.eventTriggerRollTotal);
    setEventPercentileTotal(mergedState.eventPercentileTotal);
    setEventRollTwiceFirst(mergedState.eventRollTwiceFirst);
    setEventRollTwiceSecond(mergedState.eventRollTwiceSecond);
    setGuaranteedEventFirstPercentileTotal(
      mergedState.guaranteedEventFirstPercentileTotal,
    );
    setGuaranteedEventSecondPercentileTotal(
      mergedState.guaranteedEventSecondPercentileTotal,
    );
    setGuaranteedEventChoice(mergedState.guaranteedEventChoice);
    setSabotageCheckTotal(mergedState.sabotageCheckTotal);
    setSabotageNotorietyIncreaseTotal(
      mergedState.sabotageNotorietyIncreaseTotal,
    );
    setActivityTeamOperations(mergedState.activityTeamOperations);
    setActivityOfficerOperations(mergedState.activityOfficerOperations);
    setActivityAssetOperations(mergedState.activityAssetOperations);
    setCacheDiscoveredMitigationTotal(
      mergedState.cacheDiscoveredMitigationTotal,
    );
    setTheftMitigationTotal(mergedState.theftMitigationTotal);
    setSicknessTwiceLoyaltyTotal(mergedState.sicknessTwiceLoyaltyTotal);
    setTurncoatOfficerCheckTotal(mergedState.turncoatOfficerCheckTotal);
    setTurncoatSelectedTeamId(mergedState.turncoatSelectedTeamId);
    setMissingInActionSelectedTeamId(
      mergedState.missingInActionSelectedTeamId,
    );
    setSicknessSelectedTeamId(mergedState.sicknessSelectedTeamId);
    setTurnAroundBoostTeamId(mergedState.turnAroundBoostTeamId);
    setMarketDayMarketplaceId(mergedState.marketDayMarketplaceId);
    setMarketDayTownName(mergedState.marketDayTownName);
    setRivalrySelectedTeamIds(mergedState.rivalrySelectedTeamIds);
    setOverseerEventSupportTarget(mergedState.overseerEventSupportTarget);
    lastSyncedServerStateRef.current = nextServerState;
    lastSyncScopeKeyRef.current = syncScopeKey;
  }, [
    data,
    syncScopeKey,
    showTreasuryShortagePenalty,
    stateAny.activityTeamOperations,
    stateAny.activityOfficerOperations,
    stateAny.activityAssetOperations,
    stateAny.eventMitigations,
  ]);

  const phase = (data?.state.phase as WeekPhase | undefined) ?? 'upkeep';
  const hasActivePersistentEvents = (data?.activePersistentEvents?.length ?? 0) > 0;
  const availablePhases: WeekPhase[] = hasActivePersistentEvents || phase === 'persistent'
    ? ['upkeep', 'activity', 'event', 'persistent', 'week_closed']
    : ['upkeep', 'activity', 'event', 'week_closed'];
  const persistedSlots = useMemo(() => {
    const maxActions = data?.maxActions ?? 2;
    const base =
      data?.state.stagedActivityActionIds?.slice(0, maxActions) ??
      Array.from({ length: maxActions }, () => null);
    if (base.length < maxActions) {
      return [
        ...base,
        ...Array.from({ length: maxActions - base.length }, () => null),
      ];
    }
    return base;
  }, [data]);

  const persistedTeams = useMemo(() => {
    const maxActions = data?.maxActions ?? 2;
    const base =
      (stateAny.stagedActivityTeamIds as Array<string | null> | undefined)
        ?.slice(0, maxActions) ?? Array.from({ length: maxActions }, () => null);
    if (base.length < maxActions) {
      return [
        ...base,
        ...Array.from({ length: maxActions - base.length }, () => null),
      ];
    }
    return base;
  }, [data, stateAny.stagedActivityTeamIds]);

  const slots = optimisticSlots ?? persistedSlots;
  const slotTeams = optimisticTeams ?? persistedTeams;
  const assignedActionIds = new Set(
    slots.filter((slot): slot is ActionId => Boolean(slot)),
  );
  const stagedActionIds = slots.filter((slot): slot is ActionId => Boolean(slot));
  const hasLieLowStaged = stagedActionIds.includes('lie_low');
  const hasNonLieLowStaged = stagedActionIds.some((action) => action !== 'lie_low');
  const hasGuaranteedEventAction =
    stagedActionIds.includes('guarantee_event') ||
    stagedActionIds.includes('manipulate_events');

  const slotRows = useMemo(
    () =>
      slots.map((slotActionId, index) => ({
        slotId: `activity-slot-${index + 1}`,
        slotNumber: index + 1,
        slotActionId,
      })),
    [slots],
  );

  const resolvedEventTrigger = resolveEventTrigger({
    chanceRaw: eventChanceTotal,
    rollRaw: eventTriggerRollTotal,
    guaranteed: hasGuaranteedEventAction,
  });
  const eventWouldOccurBeforeSabotage =
    resolvedEventTrigger !== null && resolvedEventTrigger.status === 'event';
  const parsedSabotageCheck = Number(sabotageCheckTotal.trim());
  const sabotageAttempted =
    sabotageCheckTotal.trim() !== '' && Number.isFinite(parsedSabotageCheck);
  const sabotageNegatesEvent =
    eventWouldOccurBeforeSabotage &&
    sabotageAttempted &&
    parsedSabotageCheck >= 15 + (data?.rank ?? 0);
  const shouldResolveEventTable =
    eventWouldOccurBeforeSabotage && !sabotageNegatesEvent;
  const effectiveEventPercentileTotal =
    hasGuaranteedEventAction && shouldResolveEventTable
      ? guaranteedEventChoice === 'second'
        ? guaranteedEventSecondPercentileTotal
        : guaranteedEventFirstPercentileTotal || guaranteedEventSecondPercentileTotal
      : eventPercentileTotal;
  const resolvedEvent = shouldResolveEventTable
    ? resolveMilitiaEventFromPercentile(effectiveEventPercentileTotal)
    : null;
  const showRollTwiceFields =
    shouldResolveEventTable &&
    resolvedEvent !== null &&
    'event' in resolvedEvent &&
    resolvedEvent.event === 'Roll Twice';
  const resolvedRollTwiceFirst = resolveMilitiaEventFromPercentile(
    eventRollTwiceFirst,
  );
  const resolvedRollTwiceSecond = resolveMilitiaEventFromPercentile(
    eventRollTwiceSecond,
  );
  const resolvedEventNames = getResolvedEventNames({
    shouldResolveEventTable,
    resolvedEvent,
    showRollTwiceFields,
    resolvedRollTwiceFirst,
    resolvedRollTwiceSecond,
  });
  const marketDayAppliesToAllTrackedMarketplaces =
    showRollTwiceFields &&
    resolvedRollTwiceFirst !== null &&
    'event' in resolvedRollTwiceFirst &&
    resolvedRollTwiceFirst.event === 'Market Day' &&
    resolvedRollTwiceSecond !== null &&
    'event' in resolvedRollTwiceSecond &&
    resolvedRollTwiceSecond.event === 'Market Day';

  const serverUpkeepTotals = readUpkeepRollTotals(data?.state.upkeepRollTotals);
  const serverActivityTotals = readActivityRollTotals(data?.state.activityRollTotals);
  const serverEventTotals = readEventRollTotals(data?.state.eventRollTotals);

  const suggestedEventChanceTotal = data
    ? clampNumber(data.notoriety + (data.state.uneventfulBonusCarry ?? 0), 10, 95)
    : 10;
  const teams = data?.teams ?? [];
  const settlements = data?.settlements ?? [];
  const caches = data?.caches ?? [];
  const marketplaces = data?.marketplaces ?? [];
  const orders = data?.orders ?? [];
  const trackedPeople = data?.trackedPeople ?? [];
  const activeTeamIds = teams
    .filter((team) => team.status === 'active')
    .map((team) => team.teamId);
  const normalizedActivityTeamOperations = useMemo(
    () => normalizeActivityTeamOperationsForSlots(activityTeamOperations, slots),
    [activityTeamOperations, slots],
  );
  const normalizedActivityOfficerOperations = useMemo(
    () => normalizeActivityOfficerOperationsForSlots(activityOfficerOperations, slots),
    [activityOfficerOperations, slots],
  );
  const normalizedActivityAssetOperations = useMemo(
    () => normalizeActivityAssetOperationsForSlots(activityAssetOperations, slots),
    [activityAssetOperations, slots],
  );
  const officerEffects = useMemo(
    () =>
      buildOfficerEffects({
        focus: data?.focus,
        rank: data?.rank ?? 1,
        characters: (data?.assignableCharacters ?? []).map((character) => ({
          _id: character._id,
          name: character.name,
          kind: character.kind,
          level: character.level,
          strength: character.strength,
          dexterity: character.dexterity,
          constitution: character.constitution,
          intelligence: character.intelligence,
          wisdom: character.wisdom,
          charisma: character.charisma,
        })),
        baseAssignments: data?.officerAssignments ?? {},
        slots,
        activityOfficerOperations: normalizedActivityOfficerOperations,
      }),
    [
      data?.assignableCharacters,
      data?.focus,
      data?.officerAssignments,
      data?.rank,
      slots,
      normalizedActivityOfficerOperations,
    ],
  );
  const strategistBonusActionId =
    officerEffects.strategistBonusActionSlotIndex !== null
      ? slots[officerEffects.strategistBonusActionSlotIndex] ?? null
      : null;
  const activityRollSummaryRows = buildActivityRollSummaryRows({
    stagedActionIds,
    totals: serverActivityTotals,
    officerEffects,
    strategistBonusActionId,
    recruitTeamId: normalizedActivityTeamOperations.recruits[0]?.teamId,
    slotTeams,
    teams,
  });
  const overseerEventSupportOptions = useMemo(
    () =>
      getEventOverseerSupportOptions({
        officerEffects,
        eventWouldOccurBeforeSabotage,
        resolvedEventNames,
      }),
    [eventWouldOccurBeforeSabotage, officerEffects, resolvedEventNames],
  );
  const effectiveOverseerEventSupportTarget = overseerEventSupportOptions.some(
    (option) => option.value === overseerEventSupportTarget,
  )
    ? overseerEventSupportTarget
    : '';

  useDebouncedAutosave({
    enabled: Boolean(data?.militiaId),
    deps: [
      data?.militiaId,
      organizationId,
      upkeepAttritionTotal,
      upkeepNotorietyPenaltyTotal,
      maxNotorietyLoyaltyCheckTotal,
      nearestSettlementKey,
      upkeepTreasuryPenaltyTotal,
      showMaxNotorietyPenalty,
      showTreasuryShortagePenalty,
      serverUpkeepTotals,
    ],
    shouldSkip: () => {
      if (!data?.militiaId) return true;
      const localNotorietyPenalty = showMaxNotorietyPenalty
        ? upkeepNotorietyPenaltyTotal
        : '';
      const localMaxNotorietyLoyaltyCheck = showMaxNotorietyPenalty
        ? maxNotorietyLoyaltyCheckTotal
        : '';
      const localNearestSettlement = showMaxNotorietyPenalty
        ? nearestSettlementKey
        : '';
      const localTreasuryPenalty = showTreasuryShortagePenalty
        ? upkeepTreasuryPenaltyTotal
        : '';
      const serverNotorietyPenalty = showMaxNotorietyPenalty
        ? serverUpkeepTotals.notorietyPenaltyTotal?.toString() ?? ''
        : '';
      const serverMaxNotorietyLoyaltyCheck = showMaxNotorietyPenalty
        ? serverUpkeepTotals.maxNotorietyLoyaltyCheckTotal?.toString() ?? ''
        : '';
      const serverNearestSettlement = showMaxNotorietyPenalty
        ? serverUpkeepTotals.nearestSettlementKey ?? ''
        : '';
      const serverTreasuryPenalty = showTreasuryShortagePenalty
        ? serverUpkeepTotals.treasuryPenaltyTotal?.toString() ?? ''
        : '';

      if (
        upkeepAttritionTotal === (serverUpkeepTotals.attritionTotal?.toString() ?? '') &&
        localNotorietyPenalty === serverNotorietyPenalty &&
        localMaxNotorietyLoyaltyCheck === serverMaxNotorietyLoyaltyCheck &&
        localNearestSettlement === serverNearestSettlement &&
        localTreasuryPenalty === serverTreasuryPenalty
      ) {
        return true;
      }

      return !(
        isParsableManualTotal(upkeepAttritionTotal) &&
        isParsableManualTotal(localNotorietyPenalty) &&
        isParsableManualTotal(localMaxNotorietyLoyaltyCheck) &&
        isParsableManualTotal(localTreasuryPenalty)
      );
    },
    run: async () => {
      if (!data?.militiaId) return;
      setError(undefined);
      await mutations.saveUpkeepTotals(data.militiaId, {
        attritionTotal: upkeepAttritionTotal,
        notorietyPenaltyTotal: showMaxNotorietyPenalty
          ? upkeepNotorietyPenaltyTotal
          : undefined,
        maxNotorietyLoyaltyCheckTotal: showMaxNotorietyPenalty
          ? maxNotorietyLoyaltyCheckTotal
          : undefined,
        nearestSettlementKey: showMaxNotorietyPenalty
          ? nearestSettlementKey || undefined
          : undefined,
        treasuryPenaltyTotal: showTreasuryShortagePenalty
          ? upkeepTreasuryPenaltyTotal
          : undefined,
      });
    },
    onError: (innerError) => {
      setError(getErrorMessage(innerError, 'Failed to auto-save Upkeep totals.'));
    },
  });

  useDebouncedAutosave({
    enabled: Boolean(data?.militiaId),
    deps: [
      data?.militiaId,
      organizationId,
      activityOfficerOperations,
      stagedActionIds.join('|'),
      stateAny.activityOfficerOperations,
      slots.join('|'),
    ],
    shouldSkip: () => {
      if (!data?.militiaId) return true;
      const local = normalizedActivityOfficerOperations;
      const server =
        ((data.state as Record<string, unknown>).activityOfficerOperations as
          | {
              changes?: Array<{
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
            }
          | undefined) ?? {
        changes: [],
      };
      const serverNormalized = normalizeActivityOfficerOperationsForSlots(
        {
          changes: server.changes ?? [],
        },
        slots,
      );
      return (
        JSON.stringify(local.changes) === JSON.stringify(serverNormalized.changes)
      );
    },
    run: async () => {
      if (!data?.militiaId) return;
      await mutations.saveActivityOfficerOperations(data.militiaId, {
        changes: normalizedActivityOfficerOperations.changes,
      });
    },
    onError: (innerError) => {
      setError(
        getErrorMessage(innerError, 'Failed to auto-save officer role changes.'),
      );
    },
  });

  useDebouncedAutosave({
    enabled: Boolean(data?.militiaId),
    deps: [
      data?.militiaId,
      organizationId,
      activityTeamOperations,
      stagedActionIds.join('|'),
      stateAny.activityTeamOperations,
      slots.join('|'),
    ],
    shouldSkip: () => {
      if (!data?.militiaId) return true;
      const local = normalizedActivityTeamOperations;
      const server =
        ((data.state as Record<string, unknown>).activityTeamOperations as
          | {
              recruits?: Array<{ slotIndex: number; teamId: string }>;
              dismissals?: Array<{ slotIndex: number; teamId: string }>;
              upgrades?: Array<{
                slotIndex: number;
                fromTeamId: string;
                toTeamId: string;
              }>;
            }
          | undefined) ?? {
        recruits: [],
        dismissals: [],
        upgrades: [],
      };
      const serverNormalized = normalizeActivityTeamOperationsForSlots(
        {
          recruits: server.recruits ?? [],
          dismissals: server.dismissals ?? [],
          upgrades: server.upgrades ?? [],
        },
        slots,
      );
      return (
        JSON.stringify(local.recruits) ===
          JSON.stringify(serverNormalized.recruits) &&
        JSON.stringify(local.dismissals) ===
          JSON.stringify(serverNormalized.dismissals) &&
        JSON.stringify(local.upgrades) ===
          JSON.stringify(serverNormalized.upgrades)
      );
    },
    run: async () => {
      if (!data?.militiaId) return;
      await mutations.saveActivityTeamOperations(data.militiaId, {
        recruits: normalizedActivityTeamOperations.recruits,
        dismissals: normalizedActivityTeamOperations.dismissals,
        upgrades: normalizedActivityTeamOperations.upgrades,
      });
    },
    onError: (innerError) => {
      setError(
        getErrorMessage(innerError, 'Failed to auto-save team operations.'),
      );
    },
  });

  useDebouncedAutosave({
    enabled: Boolean(data?.militiaId),
    deps: [
      data?.militiaId,
      organizationId,
      activityAssetOperations,
      stagedActionIds.join('|'),
      stateAny.activityAssetOperations,
      slots.join('|'),
    ],
    shouldSkip: () => {
      if (!data?.militiaId) return true;
      const server =
        ((data.state as Record<string, unknown>).activityAssetOperations as
          | {
              refuges?: Array<{ slotIndex: number; settlementKey: string }>;
              caches?: Array<{
                slotIndex: number;
                mode: 'place' | 'retrieve';
                cacheId?: string;
                label?: string;
                cacheClass?: 'minor' | 'intermediate' | 'major';
                location?: string;
                contentsSummary?: string;
                isSecureLocation?: boolean;
                checkTotal?: number;
              }>;
              orders?: Array<{
                slotIndex: number;
                description: string;
                notes?: string;
                costPaid?: number;
                deliveryDays?: number;
              }>;
              marketplaces?: Array<{
                slotIndex: number;
                label?: string;
                purchaseSummary?: string;
                notes?: string;
              }>;
              covertActions?: Array<{
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
              rescues?: Array<{
                slotIndex: number;
                targetSource?: 'tracked' | 'character' | 'freeform';
                targetStatusId?: string;
                characterId?: Id<'character'>;
                displayName?: string;
                personKind?: 'pc' | 'officer_npc' | 'other_npc';
                targetLevel?: number;
                destinationType?: 'hq' | 'refuge' | 'settlement';
                destinationSettlementKey?: string;
              }>;
              restorations?: Array<{
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
                customCostTotal?: number;
              }>;
            }
          | undefined) ?? {
          refuges: [],
          caches: [],
          orders: [],
          marketplaces: [],
          covertActions: [],
          rescues: [],
          restorations: [],
        };
      const serverNormalized = normalizeActivityAssetOperationsForSlots(
        {
          refuges: server.refuges ?? [],
          caches: (server.caches ?? []).map((entry) => ({
            slotIndex: entry.slotIndex,
            mode: entry.mode,
            cacheId: entry.cacheId,
            label: entry.label,
            cacheClass: entry.cacheClass,
            location: entry.location,
            contentsSummary: entry.contentsSummary,
            isSecureLocation: entry.isSecureLocation,
            checkTotal:
              entry.checkTotal !== undefined ? String(entry.checkTotal) : undefined,
          })),
          orders: (server.orders ?? []).map((entry) => ({
            slotIndex: entry.slotIndex,
            description: entry.description,
            notes: entry.notes,
            costPaid:
              entry.costPaid !== undefined ? String(entry.costPaid) : undefined,
            deliveryDays:
              entry.deliveryDays !== undefined
                ? String(entry.deliveryDays)
                : undefined,
          })),
          marketplaces: (server.marketplaces ?? []).map((entry) => ({
            slotIndex: entry.slotIndex,
            label: entry.label,
            purchaseSummary: entry.purchaseSummary,
            notes: entry.notes,
          })),
          covertActions: (server.covertActions ?? []).map((entry) => ({
            slotIndex: entry.slotIndex,
            mode: entry.mode,
            targetSource: entry.targetSource,
            followupSlotIndex: entry.followupSlotIndex,
            characterId: entry.characterId,
            displayName: entry.displayName,
            personKind: entry.personKind,
            siteName: entry.siteName,
            notes: entry.notes,
          })),
          rescues: (server.rescues ?? []).map((entry) => ({
            slotIndex: entry.slotIndex,
            targetSource: entry.targetSource,
            targetStatusId: entry.targetStatusId,
            characterId: entry.characterId,
            displayName: entry.displayName,
            personKind: entry.personKind,
            targetLevel:
              entry.targetLevel !== undefined ? String(entry.targetLevel) : undefined,
            destinationType: entry.destinationType,
            destinationSettlementKey: entry.destinationSettlementKey,
          })),
          restorations: (server.restorations ?? []).map((entry) => ({
            slotIndex: entry.slotIndex,
            targetSource: entry.targetSource,
            targetStatusId: entry.targetStatusId,
            characterId: entry.characterId,
            displayName: entry.displayName,
            personKind: entry.personKind,
            mode: entry.mode,
            customCostTotal:
              entry.customCostTotal !== undefined
                ? String(entry.customCostTotal)
                : undefined,
          })),
        },
        slots,
      );
      return (
        JSON.stringify(normalizedActivityAssetOperations.refuges) ===
          JSON.stringify(serverNormalized.refuges) &&
        JSON.stringify(normalizedActivityAssetOperations.caches) ===
          JSON.stringify(serverNormalized.caches) &&
        JSON.stringify(normalizedActivityAssetOperations.orders) ===
          JSON.stringify(serverNormalized.orders) &&
        JSON.stringify(normalizedActivityAssetOperations.marketplaces) ===
          JSON.stringify(serverNormalized.marketplaces) &&
        JSON.stringify(normalizedActivityAssetOperations.covertActions) ===
          JSON.stringify(serverNormalized.covertActions) &&
        JSON.stringify(normalizedActivityAssetOperations.rescues) ===
          JSON.stringify(serverNormalized.rescues) &&
        JSON.stringify(normalizedActivityAssetOperations.restorations) ===
          JSON.stringify(serverNormalized.restorations)
      );
    },
    run: async () => {
      if (!data?.militiaId) return;
      await mutations.saveActivityAssetOperations(data.militiaId, {
        refuges: normalizedActivityAssetOperations.refuges,
        caches: normalizedActivityAssetOperations.caches,
        orders: normalizedActivityAssetOperations.orders,
        marketplaces: normalizedActivityAssetOperations.marketplaces,
        covertActions: normalizedActivityAssetOperations.covertActions,
        rescues: normalizedActivityAssetOperations.rescues,
        restorations: normalizedActivityAssetOperations.restorations,
      });
    },
    onError: (innerError) => {
      setError(
        getErrorMessage(innerError, 'Failed to auto-save settlement and asset details.'),
      );
    },
  });

  useDebouncedAutosave({
    enabled: Boolean(data?.militiaId),
    deps: [
      data?.militiaId,
      organizationId,
      cacheDiscoveredMitigationTotal,
      theftMitigationTotal,
      sicknessTwiceLoyaltyTotal,
      turncoatOfficerCheckTotal,
      turncoatSelectedTeamId,
      missingInActionSelectedTeamId,
      sicknessSelectedTeamId,
      turnAroundBoostTeamId,
      marketDayMarketplaceId,
      marketDayTownName,
      rivalrySelectedTeamIds.join('|'),
      effectiveOverseerEventSupportTarget,
      stateAny.eventMitigations,
      resolvedEventNames.join('|'),
    ],
    shouldSkip: () => {
      if (!data?.militiaId) return true;
      const server =
        ((data.state as Record<string, unknown>).eventMitigations as
          | Record<string, unknown>
          | undefined) ?? {};
      const hasCacheDiscovered = resolvedEventNames.includes('Cache Discovered');
      const hasTheft = resolvedEventNames.includes('Theft');
      const hasSickness = resolvedEventNames.includes('Sickness');
      const hasTurncoat = resolvedEventNames.includes('Turncoat');
      const hasMissingInAction = resolvedEventNames.includes('Missing in Action');
      const hasTurnAround = resolvedEventNames.includes('Turn Around');
      const hasMarketDay = resolvedEventNames.includes('Market Day');
      const hasRivalry = resolvedEventNames.includes('Rivalry');
      const hasOverseerEventSupport = effectiveOverseerEventSupportTarget !== '';
      return (
        (server.cacheDiscoveredMitigationTotal?.toString() ?? '') ===
          (hasCacheDiscovered ? cacheDiscoveredMitigationTotal : '') &&
        (server.theftMitigationTotal?.toString() ?? '') ===
          (hasTheft ? theftMitigationTotal : '') &&
        (server.sicknessTwiceLoyaltyTotal?.toString() ?? '') ===
          (hasSickness ? sicknessTwiceLoyaltyTotal : '') &&
        (server.turncoatOfficerCheckTotal?.toString() ?? '') ===
          (hasTurncoat ? turncoatOfficerCheckTotal : '') &&
        (server.turncoatSelectedTeamId ?? '') ===
          (hasTurncoat ? turncoatSelectedTeamId : '') &&
        (server.missingInActionSelectedTeamId ?? '') ===
          (hasMissingInAction ? missingInActionSelectedTeamId : '') &&
        (server.sicknessSelectedTeamId ?? '') ===
          (hasSickness ? sicknessSelectedTeamId : '') &&
        (server.turnAroundBoostTeamId ?? '') ===
          (hasTurnAround ? turnAroundBoostTeamId : '') &&
        (server.marketDayMarketplaceId ?? '') ===
          (hasMarketDay ? marketDayMarketplaceId : '') &&
        (server.marketDayTownName ?? '') ===
          (hasMarketDay ? marketDayTownName : '') &&
        JSON.stringify(server.rivalrySelectedTeamIds ?? []) ===
          JSON.stringify(hasRivalry ? rivalrySelectedTeamIds : []) &&
        (server.overseerEventSupportTarget ?? '') ===
          (hasOverseerEventSupport ? effectiveOverseerEventSupportTarget : '')
      );
    },
    run: async () => {
      if (!data?.militiaId) return;
      const hasCacheDiscovered = resolvedEventNames.includes('Cache Discovered');
      const hasTheft = resolvedEventNames.includes('Theft');
      const hasSickness = resolvedEventNames.includes('Sickness');
      const hasTurncoat = resolvedEventNames.includes('Turncoat');
      const hasMissingInAction = resolvedEventNames.includes('Missing in Action');
      const hasTurnAround = resolvedEventNames.includes('Turn Around');
      const hasMarketDay = resolvedEventNames.includes('Market Day');
      const hasRivalry = resolvedEventNames.includes('Rivalry');
      await mutations.saveEventMitigations(data.militiaId, {
        cacheDiscoveredMitigationTotal: hasCacheDiscovered
          ? cacheDiscoveredMitigationTotal
          : undefined,
        theftMitigationTotal: hasTheft ? theftMitigationTotal : undefined,
        sicknessTwiceLoyaltyTotal: hasSickness
          ? sicknessTwiceLoyaltyTotal
          : undefined,
        turncoatOfficerCheckTotal: hasTurncoat
          ? turncoatOfficerCheckTotal
          : undefined,
        turncoatSelectedTeamId: hasTurncoat
          ? turncoatSelectedTeamId || undefined
          : undefined,
        missingInActionSelectedTeamId: hasMissingInAction
          ? missingInActionSelectedTeamId || undefined
          : undefined,
        sicknessSelectedTeamId: hasSickness
          ? sicknessSelectedTeamId || undefined
          : undefined,
        turnAroundBoostTeamId: hasTurnAround
          ? turnAroundBoostTeamId || undefined
          : undefined,
        marketDayMarketplaceId: hasMarketDay
          ? marketDayMarketplaceId || undefined
          : undefined,
        marketDayTownName: hasMarketDay ? marketDayTownName || undefined : undefined,
        rivalrySelectedTeamIds:
          hasRivalry && rivalrySelectedTeamIds.length > 0
            ? rivalrySelectedTeamIds
            : undefined,
        overseerEventSupportTarget: effectiveOverseerEventSupportTarget || undefined,
      });
    },
    onError: (innerError) => {
      setError(
        getErrorMessage(innerError, 'Failed to auto-save event mitigations.'),
      );
    },
  });

  useDebouncedAutosave({
    enabled: Boolean(data?.militiaId),
    deps: [
      data?.militiaId,
      organizationId,
      eventChanceTotal,
      eventTriggerRollTotal,
      eventPercentileTotal,
      eventRollTwiceFirst,
      eventRollTwiceSecond,
      guaranteedEventFirstPercentileTotal,
      guaranteedEventSecondPercentileTotal,
      guaranteedEventChoice,
      hasGuaranteedEventAction,
      sabotageCheckTotal,
      sabotageNotorietyIncreaseTotal,
      shouldResolveEventTable,
      showRollTwiceFields,
      serverEventTotals,
    ],
    shouldSkip: () => {
      if (!data?.militiaId) return true;
      const localEventPercentile = shouldResolveEventTable
        ? hasGuaranteedEventAction
          ? ''
          : eventPercentileTotal
        : '';
      const localGuaranteedFirst = hasGuaranteedEventAction
        ? guaranteedEventFirstPercentileTotal
        : '';
      const localGuaranteedSecond = hasGuaranteedEventAction
        ? guaranteedEventSecondPercentileTotal
        : '';
      const localGuaranteedChoice = hasGuaranteedEventAction
        ? guaranteedEventChoice
        : '';
      const localFirst = showRollTwiceFields ? eventRollTwiceFirst : '';
      const localSecond = showRollTwiceFields ? eventRollTwiceSecond : '';
      const localSabotageCheck = eventWouldOccurBeforeSabotage
        ? sabotageCheckTotal
        : '';
      const localSabotageNotoriety = eventWouldOccurBeforeSabotage
        ? sabotageNotorietyIncreaseTotal
        : '';
      const serverEventChance = serverEventTotals.eventChanceTotal?.toString() ?? '';
      const serverEventTriggerRoll =
        serverEventTotals.eventTriggerRollTotal?.toString() ?? '';
      const serverEventPercentile = shouldResolveEventTable
        ? hasGuaranteedEventAction
          ? ''
          : serverEventTotals.eventPercentileTotal?.toString() ?? ''
        : '';
      const serverGuaranteedFirst = hasGuaranteedEventAction
        ? serverEventTotals.guaranteedFirstPercentileTotal?.toString() ?? ''
        : '';
      const serverGuaranteedSecond = hasGuaranteedEventAction
        ? serverEventTotals.guaranteedSecondPercentileTotal?.toString() ?? ''
        : '';
      const serverGuaranteedChoice = hasGuaranteedEventAction
        ? serverEventTotals.guaranteedChosen ?? ''
        : '';
      const serverFirst = showRollTwiceFields
        ? serverEventTotals.rollTwiceFirstTotal?.toString() ?? ''
        : '';
      const serverSecond = showRollTwiceFields
        ? serverEventTotals.rollTwiceSecondTotal?.toString() ?? ''
        : '';
      const serverSabotageCheck = eventWouldOccurBeforeSabotage
        ? serverEventTotals.sabotageCheckTotal?.toString() ?? ''
        : '';
      const serverSabotageNotoriety = eventWouldOccurBeforeSabotage
        ? serverEventTotals.sabotageNotorietyIncreaseTotal?.toString() ?? ''
        : '';

      if (
        eventChanceTotal === serverEventChance &&
        eventTriggerRollTotal === serverEventTriggerRoll &&
        localEventPercentile === serverEventPercentile &&
        localGuaranteedFirst === serverGuaranteedFirst &&
        localGuaranteedSecond === serverGuaranteedSecond &&
        localGuaranteedChoice === serverGuaranteedChoice &&
        localFirst === serverFirst &&
        localSecond === serverSecond &&
        localSabotageCheck === serverSabotageCheck &&
        localSabotageNotoriety === serverSabotageNotoriety
      ) {
        return true;
      }

      return !(
        isParsableManualTotal(eventChanceTotal) &&
        isParsableManualTotal(eventTriggerRollTotal) &&
        isParsableManualTotal(localEventPercentile) &&
        isParsableManualTotal(localGuaranteedFirst) &&
        isParsableManualTotal(localGuaranteedSecond) &&
        isParsableManualTotal(localFirst) &&
        isParsableManualTotal(localSecond) &&
        isParsableManualTotal(localSabotageCheck) &&
        isParsableManualTotal(localSabotageNotoriety)
      );
    },
    run: async () => {
      if (!data?.militiaId) return;
      setError(undefined);
      await mutations.saveEventTotals(data.militiaId, {
        eventChanceTotal,
        eventTriggerRollTotal,
        eventPercentileTotal: shouldResolveEventTable
          ? hasGuaranteedEventAction
            ? undefined
            : eventPercentileTotal
          : undefined,
        guaranteedFirstPercentileTotal: hasGuaranteedEventAction
          ? guaranteedEventFirstPercentileTotal
          : undefined,
        guaranteedSecondPercentileTotal: hasGuaranteedEventAction
          ? guaranteedEventSecondPercentileTotal
          : undefined,
        guaranteedChosen: hasGuaranteedEventAction
          ? guaranteedEventChoice || undefined
          : undefined,
        rollTwiceFirstTotal: showRollTwiceFields
          ? eventRollTwiceFirst
          : undefined,
        rollTwiceSecondTotal: showRollTwiceFields
          ? eventRollTwiceSecond
          : undefined,
        sabotageCheckTotal: eventWouldOccurBeforeSabotage
          ? sabotageCheckTotal
          : undefined,
        sabotageNotorietyIncreaseTotal: eventWouldOccurBeforeSabotage
          ? sabotageNotorietyIncreaseTotal
          : undefined,
      });
    },
    onError: (innerError) => {
      setError(getErrorMessage(innerError, 'Failed to auto-save Event totals.'));
    },
  });

  const setSlotAction = async (
    slotIndex: number,
    actionId: ActionId | null,
    sourceSlotIndex?: number,
  ) => {
    if (!data?.militiaId) return;
    if (
      actionId &&
      sourceSlotIndex === slotIndex &&
      slots[slotIndex] === actionId
    ) {
      return;
    }

    const previous = [...slots];
    const previousTeams = [...slotTeams];
    const previousActivityTeamOperations = activityTeamOperations;
    const previousActivityOfficerOperations = activityOfficerOperations;
    const previousActivityAssetOperations = activityAssetOperations;
    const next = [...slots];
    const nextTeams = [...slotTeams];
    let operationSourceIndex: number | undefined = sourceSlotIndex;
    let shouldSwapSlotIndexedData = false;
    if (
      actionId &&
      sourceSlotIndex !== undefined &&
      sourceSlotIndex !== slotIndex
    ) {
      const displaced = next[slotIndex] ?? null;
      const displacedTeam = nextTeams[slotIndex] ?? null;
      next[slotIndex] = actionId;
      next[sourceSlotIndex] = displaced;
      nextTeams[slotIndex] = nextTeams[sourceSlotIndex] ?? null;
      nextTeams[sourceSlotIndex] = displacedTeam;
      shouldSwapSlotIndexedData = true;
    } else if (actionId) {
      const existingIndex = next.findIndex((value) => value === actionId);
      if (existingIndex >= 0) {
        next[existingIndex] = null;
        nextTeams[existingIndex] = null;
        if (existingIndex !== slotIndex) {
          operationSourceIndex = existingIndex;
        }
      }
      next[slotIndex] = actionId;
    } else {
      next[slotIndex] = null;
      nextTeams[slotIndex] = null;
    }
    setOptimisticSlots(next);
    setOptimisticTeams(nextTeams);
    setActivityTeamOperations((current) =>
      remapActivityTeamOperationsForSlotChange(current, {
        slotIndex,
        actionId,
        sourceSlotIndex: operationSourceIndex,
        swapSourceAndTarget: shouldSwapSlotIndexedData,
      }),
    );
    setActivityOfficerOperations((current) =>
      remapActivityOfficerOperationsForSlotChange(current, {
        slotIndex,
        actionId,
        sourceSlotIndex: operationSourceIndex,
        swapSourceAndTarget: shouldSwapSlotIndexedData,
      }),
    );
    setActivityAssetOperations((current) =>
      remapActivityAssetOperationsForSlotChange(current, {
        slotIndex,
        actionId,
        sourceSlotIndex: operationSourceIndex,
        swapSourceAndTarget: shouldSwapSlotIndexedData,
      }),
    );

    setError(undefined);
    try {
      await mutations.saveSlots(data.militiaId, next, nextTeams);
      setOptimisticSlots(null);
      setOptimisticTeams(null);
    } catch (innerError) {
      setError(
        getErrorMessage(innerError, 'Failed to update staged activity slot.'),
      );
      setOptimisticSlots(previous);
      setOptimisticTeams(previousTeams);
      setActivityTeamOperations(previousActivityTeamOperations);
      setActivityOfficerOperations(previousActivityOfficerOperations);
      setActivityAssetOperations(previousActivityAssetOperations);
    }
  };

  const setSlotTeam = async (slotIndex: number, teamId: string | null) => {
    if (!data?.militiaId) return;
    const previousTeams = [...slotTeams];
    const nextTeams = [...slotTeams];
    nextTeams[slotIndex] = teamId;
    setOptimisticTeams(nextTeams);
    setError(undefined);
    try {
      await mutations.saveStagedTeams(data.militiaId, nextTeams);
      setOptimisticTeams(null);
    } catch (innerError) {
      setError(getErrorMessage(innerError, 'Failed to update staged team slot.'));
      setOptimisticTeams(previousTeams);
    }
  };

  const setRecruitTeamForSlot = (slotIndex: number, teamId: string) => {
    setActivityTeamOperations((current) => ({
      ...current,
      recruits: [
        ...current.recruits.filter((entry) => entry.slotIndex !== slotIndex),
        ...(teamId.trim() ? [{ slotIndex, teamId }] : []),
      ],
    }));
  };

  const setDismissTeamForSlot = (slotIndex: number, teamId: string) => {
    setActivityTeamOperations((current) => ({
      ...current,
      dismissals: [
        ...current.dismissals.filter((entry) => entry.slotIndex !== slotIndex),
        ...(teamId.trim() ? [{ slotIndex, teamId }] : []),
      ],
    }));
  };

  const setUpgradeTeamsForSlot = ({
    slotIndex,
    fromTeamId,
    toTeamId,
  }: {
    slotIndex: number;
    fromTeamId?: string;
    toTeamId?: string;
  }) => {
    setActivityTeamOperations((current) => {
      const previous = current.upgrades.find((entry) => entry.slotIndex === slotIndex);
      const nextFromTeamId = fromTeamId ?? previous?.fromTeamId ?? '';
      const nextToTeamId =
        toTeamId ??
        (fromTeamId !== undefined && fromTeamId !== previous?.fromTeamId
          ? ''
          : previous?.toTeamId ?? '');
      const hasAnySelection =
        nextFromTeamId.trim().length > 0 || nextToTeamId.trim().length > 0;
      return {
        ...current,
        upgrades: [
          ...current.upgrades.filter((entry) => entry.slotIndex !== slotIndex),
          ...(hasAnySelection
            ? [
                {
                  slotIndex,
                  fromTeamId: nextFromTeamId,
                  toTeamId: nextToTeamId,
                },
              ]
            : []),
        ],
      };
    });
  };

  const setOfficerChangeForSlot = ({
    slotIndex,
    role,
    characterId,
  }: {
    slotIndex: number;
    role?: OfficerRole;
    characterId?: Id<'character'> | null;
  }) => {
    setActivityOfficerOperations((current) => {
      const previous = current.changes.find((entry) => entry.slotIndex === slotIndex);
      const nextRole = role ?? previous?.role;
      const nextCharacterId =
        characterId === null ? undefined : characterId ?? previous?.characterId;
      return {
        changes: [
          ...current.changes.filter((entry) => entry.slotIndex !== slotIndex),
          ...(nextRole
            ? [{ slotIndex, role: nextRole, characterId: nextCharacterId }]
            : []),
        ],
      };
    });
  };

  const setRefugeSettlementForSlot = (slotIndex: number, settlementKey: string) => {
    setActivityAssetOperations((current) => ({
      ...current,
      refuges: [
        ...current.refuges.filter((entry) => entry.slotIndex !== slotIndex),
        ...(settlementKey.trim() ? [{ slotIndex, settlementKey }] : []),
      ],
    }));
  };

  const setCacheOperationForSlot = ({
    slotIndex,
    mode,
    cacheId,
    label,
    cacheClass,
    location,
    contentsSummary,
    isSecureLocation,
    checkTotal,
  }: {
    slotIndex: number;
    mode?: 'place' | 'retrieve';
    cacheId?: string;
    label?: string;
    cacheClass?: 'minor' | 'intermediate' | 'major';
    location?: string;
    contentsSummary?: string;
    isSecureLocation?: boolean;
    checkTotal?: string;
  }) => {
    setActivityAssetOperations((current) => {
      const previous = current.caches.find((entry) => entry.slotIndex === slotIndex);
      const nextMode = mode ?? previous?.mode;
      if (!nextMode) {
        return {
          ...current,
          caches: current.caches.filter((entry) => entry.slotIndex !== slotIndex),
        };
      }
      const nextEntry: ActivityAssetOperationsDraft['caches'][number] = {
        slotIndex,
        mode: nextMode,
        cacheId: cacheId ?? previous?.cacheId,
        label: label ?? previous?.label,
        cacheClass: cacheClass ?? previous?.cacheClass,
        location: location ?? previous?.location,
        contentsSummary: contentsSummary ?? previous?.contentsSummary,
        isSecureLocation: isSecureLocation ?? previous?.isSecureLocation,
        checkTotal: checkTotal ?? previous?.checkTotal,
      };

      return {
        ...current,
        caches: [
          ...current.caches.filter((entry) => entry.slotIndex !== slotIndex),
          ...(nextMode ? [nextEntry] : []),
        ],
      };
    });
  };

  const setOrderForSlot = ({
    slotIndex,
    description,
    notes,
    costPaid,
    deliveryDays,
  }: {
    slotIndex: number;
    description?: string;
    notes?: string;
    costPaid?: string;
    deliveryDays?: string;
  }) => {
    setActivityAssetOperations((current) => {
      const previous = current.orders.find((entry) => entry.slotIndex === slotIndex);
      const nextEntry = {
        slotIndex,
        description: description ?? previous?.description ?? '',
        notes: notes ?? previous?.notes,
        costPaid: costPaid ?? previous?.costPaid,
        deliveryDays: deliveryDays ?? previous?.deliveryDays,
      };
      const isMeaningful =
        nextEntry.description.trim() ||
        (nextEntry.notes ?? '').trim() ||
        (nextEntry.costPaid ?? '').trim() ||
        (nextEntry.deliveryDays ?? '').trim();
      return {
        ...current,
        orders: [
          ...current.orders.filter((entry) => entry.slotIndex !== slotIndex),
          ...(isMeaningful ? [nextEntry] : []),
        ],
      };
    });
  };

  const setMarketplaceForSlot = ({
    slotIndex,
    label,
    purchaseSummary,
    notes,
  }: {
    slotIndex: number;
    label?: string;
    purchaseSummary?: string;
    notes?: string;
  }) => {
    setActivityAssetOperations((current) => {
      const previous = current.marketplaces.find((entry) => entry.slotIndex === slotIndex);
      const nextEntry = {
        slotIndex,
        label: label ?? previous?.label,
        purchaseSummary: purchaseSummary ?? previous?.purchaseSummary,
        notes: notes ?? previous?.notes,
      };
      const isMeaningful =
        (nextEntry.label ?? '').trim() ||
        (nextEntry.purchaseSummary ?? '').trim() ||
        (nextEntry.notes ?? '').trim();
      return {
        ...current,
        marketplaces: [
          ...current.marketplaces.filter((entry) => entry.slotIndex !== slotIndex),
          ...(isMeaningful ? [nextEntry] : []),
        ],
      };
    });
  };

  const setCovertActionForSlot = ({
    slotIndex,
    mode,
    targetSource,
    followupSlotIndex,
    characterId,
    displayName,
    personKind,
    siteName,
    notes,
  }: {
    slotIndex: number;
    mode?: 'augment_action' | 'place_contact';
    targetSource?: 'character' | 'freeform';
    followupSlotIndex?: number;
    characterId?: Id<'character'> | null;
    displayName?: string;
    personKind?: 'pc' | 'officer_npc' | 'other_npc' | null;
    siteName?: string;
    notes?: string;
  }) => {
    setActivityAssetOperations((current) => {
      const previous = current.covertActions.find(
        (entry) => entry.slotIndex === slotIndex,
      );
      const nextEntry = {
        slotIndex,
        mode: mode ?? previous?.mode,
        targetSource: targetSource ?? previous?.targetSource,
        followupSlotIndex: followupSlotIndex ?? previous?.followupSlotIndex,
        characterId:
          characterId === null ? undefined : characterId ?? previous?.characterId,
        displayName: displayName ?? previous?.displayName,
        personKind: personKind === null ? undefined : personKind ?? previous?.personKind,
        siteName: siteName ?? previous?.siteName,
        notes: notes ?? previous?.notes,
      };
      const isMeaningful =
        nextEntry.mode !== undefined ||
        nextEntry.targetSource !== undefined ||
        nextEntry.followupSlotIndex !== undefined ||
        nextEntry.characterId !== undefined ||
        (nextEntry.displayName ?? '').trim() ||
        nextEntry.personKind !== undefined ||
        (nextEntry.siteName ?? '').trim() ||
        (nextEntry.notes ?? '').trim();
      return {
        ...current,
        covertActions: [
          ...current.covertActions.filter((entry) => entry.slotIndex !== slotIndex),
          ...(isMeaningful ? [nextEntry] : []),
        ],
      };
    });
  };

  const setRescueForSlot = ({
    slotIndex,
    targetSource,
    targetStatusId,
    characterId,
    displayName,
    personKind,
    targetLevel,
    destinationType,
    destinationSettlementKey,
  }: {
    slotIndex: number;
    targetSource?: 'tracked' | 'character' | 'freeform';
    targetStatusId?: string;
    characterId?: Id<'character'> | null;
    displayName?: string;
    personKind?: 'pc' | 'officer_npc' | 'other_npc' | null;
    targetLevel?: string;
    destinationType?: 'hq' | 'refuge' | 'settlement';
    destinationSettlementKey?: string;
  }) => {
    setActivityAssetOperations((current) => {
      const previous = current.rescues.find((entry) => entry.slotIndex === slotIndex);
      const nextEntry = {
        slotIndex,
        targetSource: targetSource ?? previous?.targetSource,
        targetStatusId:
          targetStatusId !== undefined
            ? targetStatusId.trim() || undefined
            : previous?.targetStatusId,
        characterId:
          characterId === null ? undefined : characterId ?? previous?.characterId,
        displayName: displayName ?? previous?.displayName,
        personKind: personKind === null ? undefined : personKind ?? previous?.personKind,
        targetLevel: targetLevel ?? previous?.targetLevel,
        destinationType: destinationType ?? previous?.destinationType,
        destinationSettlementKey:
          destinationSettlementKey ?? previous?.destinationSettlementKey,
      };
      const isMeaningful =
        nextEntry.targetStatusId !== undefined ||
        nextEntry.targetSource !== undefined ||
        nextEntry.characterId !== undefined ||
        (nextEntry.displayName ?? '').trim() ||
        nextEntry.personKind !== undefined ||
        (nextEntry.targetLevel ?? '').trim() ||
        nextEntry.destinationType !== undefined ||
        (nextEntry.destinationSettlementKey ?? '').trim();
      return {
        ...current,
        rescues: [
          ...current.rescues.filter((entry) => entry.slotIndex !== slotIndex),
          ...(isMeaningful ? [nextEntry] : []),
        ],
      };
    });
  };

  const setRestorationForSlot = ({
    slotIndex,
    targetSource,
    targetStatusId,
    characterId,
    displayName,
    personKind,
    mode,
    customCostTotal,
  }: {
    slotIndex: number;
    targetSource?: 'tracked' | 'character' | 'freeform';
    targetStatusId?: string;
    characterId?: Id<'character'> | null;
    displayName?: string;
    personKind?: 'pc' | 'officer_npc' | 'other_npc' | null;
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
  }) => {
    setActivityAssetOperations((current) => {
      const previous = current.restorations.find(
        (entry) => entry.slotIndex === slotIndex,
      );
      const nextEntry = {
        slotIndex,
        targetSource: targetSource ?? previous?.targetSource,
        targetStatusId:
          targetStatusId !== undefined
            ? targetStatusId.trim() || undefined
            : previous?.targetStatusId,
        characterId:
          characterId === null ? undefined : characterId ?? previous?.characterId,
        displayName: displayName ?? previous?.displayName,
        personKind: personKind === null ? undefined : personKind ?? previous?.personKind,
        mode: mode ?? previous?.mode,
        customCostTotal: customCostTotal ?? previous?.customCostTotal,
      };
      const isMeaningful =
        nextEntry.targetStatusId !== undefined ||
        nextEntry.targetSource !== undefined ||
        nextEntry.characterId !== undefined ||
        (nextEntry.displayName ?? '').trim() ||
        nextEntry.personKind !== undefined ||
        nextEntry.mode !== undefined ||
        (nextEntry.customCostTotal ?? '').trim();
      return {
        ...current,
        restorations: [
          ...current.restorations.filter((entry) => entry.slotIndex !== slotIndex),
          ...(isMeaningful ? [nextEntry] : []),
        ],
      };
    });
  };

  useActivityCardDrag({
    dragState,
    setDragState,
    slotRows,
    slotRefs,
    setActiveDropSlotId,
    onDrop: ({ dropSlotIndex, actionId, sourceSlotIndex }) => {
      if (dropSlotIndex !== null) {
        void setSlotAction(dropSlotIndex, actionId, sourceSlotIndex);
        return;
      }
      if (sourceSlotIndex !== undefined) {
        void setSlotAction(sourceSlotIndex, null);
      }
    },
  });

  const actions = {
    changePhase: async (nextPhase: WeekPhase) => {
      if (!data?.militiaId) return;
      setError(undefined);
      try {
        await mutations.savePhase(data.militiaId, nextPhase);
      } catch (innerError) {
        setError(getErrorMessage(innerError, 'Failed to change phase.'));
      }
    },
    resetSlots: async () => {
      if (!data?.militiaId) return;
      const previous = [...slots];
      const previousTeams = [...slotTeams];
      const previousActivityTeamOperations = activityTeamOperations;
      const previousActivityOfficerOperations = activityOfficerOperations;
      const previousActivityAssetOperations = activityAssetOperations;
      const cleared = Array.from({ length: data.maxActions }, () => null) as (
        | ActionId
        | null
      )[];
      const clearedTeams = Array.from({ length: data.maxActions }, () => null);
      setOptimisticSlots(cleared);
      setOptimisticTeams(clearedTeams);
      setActivityTeamOperations({
        recruits: [],
        dismissals: [],
        upgrades: [],
      });
      setActivityOfficerOperations({
        changes: [],
      });
      setActivityAssetOperations(createEmptyActivityAssetOperationsDraft());
      setError(undefined);
      try {
        await mutations.saveSlots(data.militiaId, cleared, clearedTeams);
        setOptimisticSlots(null);
        setOptimisticTeams(null);
      } catch (innerError) {
        setError(getErrorMessage(innerError, 'Failed to reset staged slots.'));
        setOptimisticSlots(previous);
        setOptimisticTeams(previousTeams);
        setActivityTeamOperations(previousActivityTeamOperations);
        setActivityOfficerOperations(previousActivityOfficerOperations);
        setActivityAssetOperations(previousActivityAssetOperations);
      }
    },
    continueToSummary: async () => {
      if (!data?.militiaId) return;
      setError(undefined);
      try {
        const nextPhase: WeekPhase = hasActivePersistentEvents
          ? 'persistent'
          : 'week_closed';
        await mutations.continueToSummary(
          data.militiaId,
          nextPhase,
          {
            eventChanceTotal,
            eventTriggerRollTotal,
            eventPercentileTotal: shouldResolveEventTable
              ? hasGuaranteedEventAction
                ? undefined
                : eventPercentileTotal
              : undefined,
            guaranteedFirstPercentileTotal: hasGuaranteedEventAction
              ? guaranteedEventFirstPercentileTotal
              : undefined,
            guaranteedSecondPercentileTotal: hasGuaranteedEventAction
              ? guaranteedEventSecondPercentileTotal
              : undefined,
            guaranteedChosen: hasGuaranteedEventAction
              ? guaranteedEventChoice || undefined
              : undefined,
            rollTwiceFirstTotal: showRollTwiceFields
              ? eventRollTwiceFirst
              : undefined,
            rollTwiceSecondTotal: showRollTwiceFields
              ? eventRollTwiceSecond
              : undefined,
            sabotageCheckTotal: eventWouldOccurBeforeSabotage
              ? sabotageCheckTotal
              : undefined,
            sabotageNotorietyIncreaseTotal: eventWouldOccurBeforeSabotage
              ? sabotageNotorietyIncreaseTotal
              : undefined,
          },
        );
      } catch (innerError) {
        setError(getErrorMessage(innerError, 'Failed to continue to summary.'));
      }
    },
    commitPhase: async () => {
      if (!data?.militiaId) return;
      setError(undefined);
      try {
        await mutations.commitPhase(data.militiaId);
      } catch (innerError) {
        setError(getErrorMessage(innerError, 'Failed to commit current phase.'));
      }
    },
    goBackWeek: async () => {
      if (!data?.militiaId) return;
      setError(undefined);
      try {
        await mutations.goBackWeek(data.militiaId);
      } catch (innerError) {
        setError(getErrorMessage(innerError, 'Failed to go to previous week.'));
      }
    },
    applyTreasuryUpdate: async (mode: 'deposit' | 'withdraw') => {
      if (!data?.militiaId) return;
      setError(undefined);
      try {
        await mutations.applyTreasuryUpdate(data.militiaId, mode, treasuryAmount);
        setTreasuryAmount('');
      } catch (innerError) {
        setError(
          getErrorMessage(innerError, 'Failed to apply treasury transaction.'),
        );
      }
    },
    applyRankUp: async () => {
      if (!data?.militiaId) return;
      setError(undefined);
      try {
        await mutations.applyRankUp(data.militiaId);
      } catch (innerError) {
        setError(getErrorMessage(innerError, 'Failed to rank up militia.'));
      }
    },
    buyOffPersistentEvent: async (eventStateId: Id<'militiaEventState'>) => {
      if (!data?.militiaId) return;
      setError(undefined);
      try {
        await mutations.buyOffPersistentEventAction(data.militiaId, eventStateId);
      } catch (innerError) {
        setError(
          getErrorMessage(innerError, 'Failed to buy off persistent event.'),
        );
      }
    },
    setError,
  };

  return {
    data,
    isLoading,
    phase,
    availablePhases,
    error,
    minimumTreasury,
    showMaxNotorietyPenalty,
    showTreasuryShortagePenalty,
    upkeepAttritionTotal,
    setUpkeepAttritionTotal,
    upkeepNotorietyPenaltyTotal,
    setUpkeepNotorietyPenaltyTotal,
    maxNotorietyLoyaltyCheckTotal,
    setMaxNotorietyLoyaltyCheckTotal,
    nearestSettlementKey,
    setNearestSettlementKey,
    upkeepTreasuryPenaltyTotal,
    setUpkeepTreasuryPenaltyTotal,
    eventChanceTotal,
    setEventChanceTotal,
    eventTriggerRollTotal,
    setEventTriggerRollTotal,
    eventPercentileTotal,
    setEventPercentileTotal,
    effectiveEventPercentileTotal,
    guaranteedEventFirstPercentileTotal,
    setGuaranteedEventFirstPercentileTotal,
    guaranteedEventSecondPercentileTotal,
    setGuaranteedEventSecondPercentileTotal,
    guaranteedEventChoice,
    setGuaranteedEventChoice,
    eventRollTwiceFirst,
    setEventRollTwiceFirst,
    eventRollTwiceSecond,
    setEventRollTwiceSecond,
    sabotageCheckTotal,
    setSabotageCheckTotal,
    sabotageNotorietyIncreaseTotal,
    setSabotageNotorietyIncreaseTotal,
    treasuryAmount,
    setTreasuryAmount,
    dragState,
    setDragState,
    activeDropSlotId,
    slotRefs,
    assignedActionIds,
    slots,
    slotTeams,
    stagedActionIds,
    hasLieLowStaged,
    hasNonLieLowStaged,
    hasGuaranteedEventAction,
    hasActivePersistentEvents,
    slotRows,
    resolvedEventTrigger,
    eventWouldOccurBeforeSabotage,
    sabotageNegatesEvent,
    shouldResolveEventTable,
    resolvedEvent,
    showRollTwiceFields,
    resolvedRollTwiceFirst,
    resolvedRollTwiceSecond,
    resolvedEventNames,
    serverActivityTotals,
    suggestedEventChanceTotal,
    activityRollSummaryRows,
    teams,
    settlements,
    caches,
    marketplaces,
    orders,
    trackedPeople,
    activeTeamIds,
    officerEffects,
    strategistBonusActionId,
    activityTeamOperations,
    activityOfficerOperations,
    activityAssetOperations,
    setRecruitTeamForSlot,
    setDismissTeamForSlot,
    setUpgradeTeamsForSlot,
    setOfficerChangeForSlot,
    setRefugeSettlementForSlot,
    setCacheOperationForSlot,
    setOrderForSlot,
    setMarketplaceForSlot,
    setCovertActionForSlot,
    setRescueForSlot,
    setRestorationForSlot,
    cacheDiscoveredMitigationTotal,
    setCacheDiscoveredMitigationTotal,
    theftMitigationTotal,
    setTheftMitigationTotal,
    sicknessTwiceLoyaltyTotal,
    setSicknessTwiceLoyaltyTotal,
    turncoatOfficerCheckTotal,
    setTurncoatOfficerCheckTotal,
    turncoatSelectedTeamId,
    setTurncoatSelectedTeamId,
    missingInActionSelectedTeamId,
    setMissingInActionSelectedTeamId,
    sicknessSelectedTeamId,
    setSicknessSelectedTeamId,
    turnAroundBoostTeamId,
    setTurnAroundBoostTeamId,
    marketDayMarketplaceId,
    setMarketDayMarketplaceId,
    marketDayTownName,
    setMarketDayTownName,
    marketDayAppliesToAllTrackedMarketplaces,
    rivalrySelectedTeamIds,
    setRivalrySelectedTeamIds,
    overseerEventSupportTarget: effectiveOverseerEventSupportTarget,
    setOverseerEventSupportTarget,
    setSlotTeam,
    actions,
  };
}

export type WeekBoardController = ReturnType<typeof useWeekBoardController>;

function isParsableManualTotal(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return true;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed);
}

function clampNumber(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  return fallback;
}

function getResolvedEventNames({
  shouldResolveEventTable,
  resolvedEvent,
  showRollTwiceFields,
  resolvedRollTwiceFirst,
  resolvedRollTwiceSecond,
}: {
  shouldResolveEventTable: boolean;
  resolvedEvent: ReturnType<typeof resolveMilitiaEventFromPercentile>;
  showRollTwiceFields: boolean;
  resolvedRollTwiceFirst: ReturnType<typeof resolveMilitiaEventFromPercentile>;
  resolvedRollTwiceSecond: ReturnType<typeof resolveMilitiaEventFromPercentile>;
}) {
  if (!shouldResolveEventTable) return [] as string[];
  const names: string[] = [];
  if (resolvedEvent && 'event' in resolvedEvent) {
    names.push(resolvedEvent.event);
  }
  if (showRollTwiceFields) {
    if (resolvedRollTwiceFirst && 'event' in resolvedRollTwiceFirst) {
      names.push(resolvedRollTwiceFirst.event);
    }
    if (resolvedRollTwiceSecond && 'event' in resolvedRollTwiceSecond) {
      names.push(resolvedRollTwiceSecond.event);
    }
  }
  return Array.from(new Set(names));
}

function normalizeActivityTeamOperationsForSlots(
  operations: ActivityTeamOperationsDraft,
  slots: Array<ActionId | null>,
) {
  return {
    recruits: operations.recruits
      .filter(
        (entry) =>
          slots[entry.slotIndex] === 'recruit_team' &&
          Boolean(entry.teamId?.trim()),
      )
      .sort((a, b) => a.slotIndex - b.slotIndex),
    dismissals: operations.dismissals
      .filter(
        (entry) =>
          slots[entry.slotIndex] === 'dismiss_team' &&
          Boolean(entry.teamId?.trim()),
      )
      .sort((a, b) => a.slotIndex - b.slotIndex),
    upgrades: operations.upgrades
      .filter(
        (entry) =>
          slots[entry.slotIndex] === 'upgrade_team' &&
          Boolean(entry.fromTeamId?.trim()) &&
          Boolean(entry.toTeamId?.trim()),
      )
      .sort((a, b) => a.slotIndex - b.slotIndex),
  };
}

function normalizeActivityOfficerOperationsForSlots(
  operations: ActivityOfficerOperationsDraft,
  slots: Array<ActionId | null>,
) {
  return {
    changes: operations.changes
      .filter(
        (entry) =>
          slots[entry.slotIndex] === 'change_officer_role' &&
          Boolean(entry.role),
      )
      .sort((a, b) => a.slotIndex - b.slotIndex),
  };
}

function normalizeActivityAssetOperationsForSlots(
  operations: ActivityAssetOperationsDraft,
  slots: Array<ActionId | null>,
) {
  return {
    refuges: operations.refuges
      .filter(
        (entry) =>
          slots[entry.slotIndex] === 'activate_refuge' &&
          Boolean(entry.settlementKey?.trim()),
      )
      .sort((a, b) => a.slotIndex - b.slotIndex),
    caches: operations.caches
      .filter(
        (entry) =>
          slots[entry.slotIndex] === 'secure_cache' &&
          (entry.mode === 'place' || entry.mode === 'retrieve'),
      )
      .sort((a, b) => a.slotIndex - b.slotIndex),
    orders: operations.orders
      .filter(
        (entry) =>
          slots[entry.slotIndex] === 'special_order' &&
          Boolean(
            entry.description.trim() ||
              (entry.notes?.trim() ?? '') ||
              (entry.costPaid?.trim() ?? '') ||
              (entry.deliveryDays?.trim() ?? ''),
          ),
      )
      .sort((a, b) => a.slotIndex - b.slotIndex),
    marketplaces: operations.marketplaces
      .filter(
        (entry) =>
          (slots[entry.slotIndex] === 'broker_market' ||
            slots[entry.slotIndex] === 'activate_black_market') &&
          Boolean(
            (entry.label ?? '').trim() ||
              (entry.purchaseSummary ?? '').trim() ||
              (entry.notes ?? '').trim(),
          ),
      )
      .sort((a, b) => a.slotIndex - b.slotIndex),
    covertActions: operations.covertActions
      .filter(
        (entry) =>
          slots[entry.slotIndex] === 'covert_action' &&
          Boolean(
            entry.mode !== undefined ||
              entry.targetSource !== undefined ||
              entry.followupSlotIndex !== undefined ||
              entry.characterId !== undefined ||
              (entry.displayName ?? '').trim() ||
              entry.personKind !== undefined ||
              (entry.siteName ?? '').trim() ||
              (entry.notes ?? '').trim(),
          ),
      )
      .sort((a, b) => a.slotIndex - b.slotIndex),
    rescues: operations.rescues
      .filter(
        (entry) =>
          slots[entry.slotIndex] === 'rescue_character' &&
          Boolean(
            entry.targetStatusId !== undefined ||
              entry.targetSource !== undefined ||
              entry.characterId !== undefined ||
              (entry.displayName ?? '').trim() ||
              entry.personKind !== undefined ||
              (entry.targetLevel ?? '').trim() ||
              entry.destinationType !== undefined ||
              (entry.destinationSettlementKey ?? '').trim(),
          ),
      )
      .sort((a, b) => a.slotIndex - b.slotIndex),
    restorations: operations.restorations
      .filter(
        (entry) =>
          slots[entry.slotIndex] === 'restore_character' &&
          Boolean(
            entry.targetStatusId !== undefined ||
              entry.targetSource !== undefined ||
              entry.characterId !== undefined ||
              (entry.displayName ?? '').trim() ||
              entry.personKind !== undefined ||
              entry.mode !== undefined ||
              (entry.customCostTotal ?? '').trim(),
          ),
      )
      .sort((a, b) => a.slotIndex - b.slotIndex),
  };
}

function remapActivityTeamOperationsForSlotChange(
  operations: ActivityTeamOperationsDraft,
  slotChange: SlotChange,
) {
  return {
    recruits: remapSlotIndexedEntries(operations.recruits, 'recruit_team', slotChange),
    dismissals: remapSlotIndexedEntries(
      operations.dismissals,
      'dismiss_team',
      slotChange,
    ),
    upgrades: remapSlotIndexedEntries(operations.upgrades, 'upgrade_team', slotChange),
  };
}

function remapActivityOfficerOperationsForSlotChange(
  operations: ActivityOfficerOperationsDraft,
  slotChange: SlotChange,
) {
  return {
    changes: remapSlotIndexedEntries(
      operations.changes,
      'change_officer_role',
      slotChange,
    ),
  };
}

function remapActivityAssetOperationsForSlotChange(
  operations: ActivityAssetOperationsDraft,
  slotChange: SlotChange,
) {
  return {
    refuges: remapSlotIndexedEntries(
      operations.refuges,
      'activate_refuge',
      slotChange,
    ),
    caches: remapSlotIndexedEntries(operations.caches, 'secure_cache', slotChange),
    orders: remapSlotIndexedEntries(operations.orders, 'special_order', slotChange),
    marketplaces: remapSlotIndexedEntries(
      operations.marketplaces,
      ['broker_market', 'activate_black_market'],
      slotChange,
    ),
    covertActions: remapSlotIndexedEntries(
      operations.covertActions,
      'covert_action',
      slotChange,
    ),
    rescues: remapSlotIndexedEntries(
      operations.rescues,
      'rescue_character',
      slotChange,
    ),
    restorations: remapSlotIndexedEntries(
      operations.restorations,
      'restore_character',
      slotChange,
    ),
  };
}

type SlotChange = {
  slotIndex: number;
  actionId: ActionId | null;
  sourceSlotIndex?: number;
  swapSourceAndTarget: boolean;
};

function remapSlotIndexedEntries<T extends { slotIndex: number }>(
  entries: T[],
  relevantActionId: ActionId | ActionId[],
  { slotIndex, actionId, sourceSlotIndex, swapSourceAndTarget }: SlotChange,
) {
  const relevantActionIds = Array.isArray(relevantActionId)
    ? relevantActionId
    : [relevantActionId];
  const targetEntry = entries.find((entry) => entry.slotIndex === slotIndex);
  const sourceEntry =
    sourceSlotIndex === undefined
      ? undefined
      : entries.find((entry) => entry.slotIndex === sourceSlotIndex);
  const baseEntries = entries.filter(
    (entry) =>
      entry.slotIndex !== slotIndex &&
      (sourceSlotIndex === undefined || entry.slotIndex !== sourceSlotIndex),
  );

  if (!actionId) {
    return baseEntries;
  }

  if (sourceSlotIndex === undefined || sourceSlotIndex === slotIndex) {
    return baseEntries;
  }

  if (!relevantActionIds.includes(actionId)) {
    if (swapSourceAndTarget && targetEntry) {
      return [...baseEntries, { ...targetEntry, slotIndex: sourceSlotIndex }];
    }
    return baseEntries;
  }

  const remappedEntries = [...baseEntries];
  if (sourceEntry) {
    remappedEntries.push({ ...sourceEntry, slotIndex });
  }
  if (swapSourceAndTarget && targetEntry) {
    remappedEntries.push({ ...targetEntry, slotIndex: sourceSlotIndex });
  }
  return remappedEntries.sort((left, right) => left.slotIndex - right.slotIndex);
}
