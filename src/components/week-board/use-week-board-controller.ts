'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Id } from '@convex/_generated/dataModel';
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
  const [rivalrySelectedTeamIds, setRivalrySelectedTeamIds] = useState<string[]>(
    [],
  );
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
      rivalrySelectedTeamIds: Array.isArray(eventMitigations.rivalrySelectedTeamIds)
        ? eventMitigations.rivalrySelectedTeamIds.filter(
            (value): value is string => typeof value === 'string',
          )
        : [],
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
      cacheDiscoveredMitigationTotal,
      theftMitigationTotal,
      sicknessTwiceLoyaltyTotal,
      turncoatOfficerCheckTotal,
      turncoatSelectedTeamId,
      missingInActionSelectedTeamId,
      sicknessSelectedTeamId,
      turnAroundBoostTeamId,
      rivalrySelectedTeamIds,
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
    setRivalrySelectedTeamIds(mergedState.rivalrySelectedTeamIds);
    lastSyncedServerStateRef.current = nextServerState;
    lastSyncScopeKeyRef.current = syncScopeKey;
  }, [
    data,
    syncScopeKey,
    showTreasuryShortagePenalty,
    stateAny.activityTeamOperations,
    stateAny.activityOfficerOperations,
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

  const serverUpkeepTotals = readUpkeepRollTotals(data?.state.upkeepRollTotals);
  const serverActivityTotals = readActivityRollTotals(data?.state.activityRollTotals);
  const serverEventTotals = readEventRollTotals(data?.state.eventRollTotals);

  const suggestedEventChanceTotal = data
    ? clampNumber(data.notoriety + (data.state.uneventfulBonusCarry ?? 0), 10, 95)
    : 10;
  const activityRollSummaryRows = buildActivityRollSummaryRows({
    stagedActionIds,
    totals: serverActivityTotals,
  });
  const teams = data?.teams ?? [];
  const activeTeamIds = teams
    .filter((team) => team.status === 'active')
    .map((team) => team.teamId);

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
      const local = normalizeActivityOfficerOperationsForSlots(
        activityOfficerOperations,
        slots,
      );
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
      const normalized = normalizeActivityOfficerOperationsForSlots(
        activityOfficerOperations,
        slots,
      );
      await mutations.saveActivityOfficerOperations(data.militiaId, {
        changes: normalized.changes,
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
      const local = normalizeActivityTeamOperationsForSlots(
        activityTeamOperations,
        slots,
      );
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
      const normalized = normalizeActivityTeamOperationsForSlots(
        activityTeamOperations,
        slots,
      );
      await mutations.saveActivityTeamOperations(data.militiaId, {
        recruits: normalized.recruits,
        dismissals: normalized.dismissals,
        upgrades: normalized.upgrades,
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
      cacheDiscoveredMitigationTotal,
      theftMitigationTotal,
      sicknessTwiceLoyaltyTotal,
      turncoatOfficerCheckTotal,
      turncoatSelectedTeamId,
      missingInActionSelectedTeamId,
      sicknessSelectedTeamId,
      turnAroundBoostTeamId,
      rivalrySelectedTeamIds.join('|'),
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
      const hasRivalry = resolvedEventNames.includes('Rivalry');
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
        JSON.stringify(server.rivalrySelectedTeamIds ?? []) ===
          JSON.stringify(hasRivalry ? rivalrySelectedTeamIds : [])
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
        rivalrySelectedTeamIds:
          hasRivalry && rivalrySelectedTeamIds.length > 0
            ? rivalrySelectedTeamIds
            : undefined,
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

    const previous = [...slots];
    const previousTeams = [...slotTeams];
    const next = [...slots];
    const nextTeams = [...slotTeams];
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
    } else if (actionId) {
      const existingIndex = next.findIndex((value) => value === actionId);
      if (existingIndex >= 0) {
        next[existingIndex] = null;
        nextTeams[existingIndex] = null;
      }
      next[slotIndex] = actionId;
    } else {
      next[slotIndex] = null;
      nextTeams[slotIndex] = null;
    }
    setOptimisticSlots(next);
    setOptimisticTeams(nextTeams);

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
      const nextToTeamId = toTeamId ?? previous?.toTeamId ?? '';
      return {
        ...current,
        upgrades: [
          ...current.upgrades.filter((entry) => entry.slotIndex !== slotIndex),
          ...(nextFromTeamId.trim() && nextToTeamId.trim()
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
      const cleared = Array.from({ length: data.maxActions }, () => null) as (
        | ActionId
        | null
      )[];
      setOptimisticSlots(cleared);
      setError(undefined);
      try {
        await mutations.saveSlots(data.militiaId, cleared);
        setOptimisticSlots(null);
      } catch (innerError) {
        setError(getErrorMessage(innerError, 'Failed to reset staged slots.'));
        setOptimisticSlots(previous);
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
    activeTeamIds,
    activityTeamOperations,
    activityOfficerOperations,
    setRecruitTeamForSlot,
    setDismissTeamForSlot,
    setUpgradeTeamsForSlot,
    setOfficerChangeForSlot,
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
    rivalrySelectedTeamIds,
    setRivalrySelectedTeamIds,
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
