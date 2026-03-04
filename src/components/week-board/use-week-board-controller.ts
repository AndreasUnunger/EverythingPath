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
  const [upkeepTreasuryPenaltyTotal, setUpkeepTreasuryPenaltyTotal] =
    useState('');
  const [eventChanceTotal, setEventChanceTotal] = useState('');
  const [eventTriggerRollTotal, setEventTriggerRollTotal] = useState('');
  const [eventPercentileTotal, setEventPercentileTotal] = useState('');
  const [eventRollTwiceFirst, setEventRollTwiceFirst] = useState('');
  const [eventRollTwiceSecond, setEventRollTwiceSecond] = useState('');
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
      [eventTotals.sabotageCheckTotal, setSabotageCheckTotal],
      [
        eventTotals.sabotageNotorietyIncreaseTotal,
        setSabotageNotorietyIncreaseTotal,
      ],
    ];
    syncPairs.forEach(([value, setter]) => setter(value?.toString() ?? ''));
    setEventChanceTotal(
      eventTotals.eventChanceTotal?.toString() ?? defaultEventChance,
    );
    const defaultTreasuryPenalty = showTreasuryShortagePenalty
      ? String(data.rank + 2)
      : '';
    setUpkeepTreasuryPenaltyTotal(
      upkeepTotals.treasuryPenaltyTotal?.toString() ?? defaultTreasuryPenalty,
    );
  }, [data, showTreasuryShortagePenalty]);

  const phase = (data?.state.phase as WeekPhase | undefined) ?? 'upkeep';
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
  const resolvedEvent = shouldResolveEventTable
    ? resolveMilitiaEventFromPercentile(eventPercentileTotal)
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
      const localTreasuryPenalty = showTreasuryShortagePenalty
        ? upkeepTreasuryPenaltyTotal
        : '';
      const serverNotorietyPenalty = showMaxNotorietyPenalty
        ? serverUpkeepTotals.notorietyPenaltyTotal?.toString() ?? ''
        : '';
      const serverTreasuryPenalty = showTreasuryShortagePenalty
        ? serverUpkeepTotals.treasuryPenaltyTotal?.toString() ?? ''
        : '';

      if (
        upkeepAttritionTotal === (serverUpkeepTotals.attritionTotal?.toString() ?? '') &&
        localNotorietyPenalty === serverNotorietyPenalty &&
        localTreasuryPenalty === serverTreasuryPenalty
      ) {
        return true;
      }

      return !(
        isParsableManualTotal(upkeepAttritionTotal) &&
        isParsableManualTotal(localNotorietyPenalty) &&
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
      sabotageCheckTotal,
      sabotageNotorietyIncreaseTotal,
      shouldResolveEventTable,
      showRollTwiceFields,
      serverEventTotals,
    ],
    shouldSkip: () => {
      if (!data?.militiaId) return true;
      const localEventPercentile = shouldResolveEventTable
        ? eventPercentileTotal
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
        ? serverEventTotals.eventPercentileTotal?.toString() ?? ''
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
          ? eventPercentileTotal
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
        await mutations.continueToSummary(data.militiaId, {
          eventChanceTotal,
          eventTriggerRollTotal,
          eventPercentileTotal: shouldResolveEventTable
            ? eventPercentileTotal
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
    setError,
  };

  return {
    data,
    isLoading,
    phase,
    error,
    minimumTreasury,
    showMaxNotorietyPenalty,
    showTreasuryShortagePenalty,
    upkeepAttritionTotal,
    setUpkeepAttritionTotal,
    upkeepNotorietyPenaltyTotal,
    setUpkeepNotorietyPenaltyTotal,
    upkeepTreasuryPenaltyTotal,
    setUpkeepTreasuryPenaltyTotal,
    eventChanceTotal,
    setEventChanceTotal,
    eventTriggerRollTotal,
    setEventTriggerRollTotal,
    eventPercentileTotal,
    setEventPercentileTotal,
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
