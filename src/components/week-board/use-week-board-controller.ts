'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Id } from '@convex/_generated/dataModel';
import { buildActivityRollSummaryRows } from '~/components/week-board/activity-rolls-controller';
import {
  resolveEventTrigger,
  resolveMilitiaEventFromPercentile,
} from '~/components/week-board/event-utils';
import {
  readActivityRollTotals,
  readEventRollTotals,
  readUpkeepRollTotals,
} from '~/components/week-board/roll-totals';
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
  const [error, setError] = useState<string>();
  const slotRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const minimumTreasury = data ? data.rank * 10 : 0;
  const showMaxNotorietyPenalty = Boolean(data && data.notoriety >= 100);
  const showTreasuryShortagePenalty = Boolean(
    data && data.treasury < minimumTreasury,
  );

  useEffect(() => {
    if (!data?.state) return;
    const upkeepTotals = readUpkeepRollTotals(data.state.upkeepRollTotals);
    const eventTotals = readEventRollTotals(data.state.eventRollTotals);
    const defaultEventChance = clampNumber(
      data.notoriety + (data.state.uneventfulBonusCarry ?? 0),
      10,
      95,
    ).toString();
    const syncPairs: Array<[number | undefined, (value: string) => void]> = [
      [upkeepTotals.attritionTotal, setUpkeepAttritionTotal],
      [upkeepTotals.notorietyPenaltyTotal, setUpkeepNotorietyPenaltyTotal],
      [eventTotals.eventTriggerRollTotal, setEventTriggerRollTotal],
      [eventTotals.eventPercentileTotal, setEventPercentileTotal],
      [eventTotals.rollTwiceFirstTotal, setEventRollTwiceFirst],
      [eventTotals.rollTwiceSecondTotal, setEventRollTwiceSecond],
      [
        eventTotals.guaranteedFirstPercentileTotal,
        setGuaranteedEventFirstPercentileTotal,
      ],
      [
        eventTotals.guaranteedSecondPercentileTotal,
        setGuaranteedEventSecondPercentileTotal,
      ],
      [eventTotals.sabotageCheckTotal, setSabotageCheckTotal],
      [
        eventTotals.sabotageNotorietyIncreaseTotal,
        setSabotageNotorietyIncreaseTotal,
      ],
    ];
    syncPairs.forEach(([value, setter]) => setter(value?.toString() ?? ''));
    setGuaranteedEventChoice(eventTotals.guaranteedChosen ?? '');
    setEventChanceTotal(
      eventTotals.eventChanceTotal?.toString() ?? defaultEventChance,
    );
    const defaultTreasuryPenalty = showTreasuryShortagePenalty
      ? String(data.rank + 2)
      : '';
    const defaultNearestSettlement = data.settlementKeys[0] ?? '';
    setUpkeepTreasuryPenaltyTotal(
      upkeepTotals.treasuryPenaltyTotal?.toString() ?? defaultTreasuryPenalty,
    );
    setMaxNotorietyLoyaltyCheckTotal(
      upkeepTotals.maxNotorietyLoyaltyCheckTotal?.toString() ?? '',
    );
    setNearestSettlementKey(
      upkeepTotals.nearestSettlementKey ?? defaultNearestSettlement,
    );
  }, [data, showTreasuryShortagePenalty]);

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

  const slots = optimisticSlots ?? persistedSlots;
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
    const next = [...slots];
    if (
      actionId &&
      sourceSlotIndex !== undefined &&
      sourceSlotIndex !== slotIndex
    ) {
      const displaced = next[slotIndex] ?? null;
      next[slotIndex] = actionId;
      next[sourceSlotIndex] = displaced;
    } else if (actionId) {
      const existingIndex = next.findIndex((value) => value === actionId);
      if (existingIndex >= 0) {
        next[existingIndex] = null;
      }
      next[slotIndex] = actionId;
    } else {
      next[slotIndex] = null;
    }
    setOptimisticSlots(next);

    setError(undefined);
    try {
      await mutations.saveSlots(data.militiaId, next);
      setOptimisticSlots(null);
    } catch (innerError) {
      setError(
        getErrorMessage(innerError, 'Failed to update staged activity slot.'),
      );
      setOptimisticSlots(previous);
    }
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
    serverActivityTotals,
    suggestedEventChanceTotal,
    activityRollSummaryRows,
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
