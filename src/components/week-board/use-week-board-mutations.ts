'use client';

import type { Id } from '@convex/_generated/dataModel';
import { api as db } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import type { ActionId, WeekPhase } from '~/components/week-board/types';

export function useWeekBoardMutations(organizationId: string) {
  const saveWeekBoardState = useMutation(db.weekBoard.saveWeekBoardState);
  const commitCurrentPhase = useMutation(db.weekBoard.commitCurrentPhase);
  const goToPreviousWeek = useMutation(db.weekBoard.goToPreviousWeek);
  const applyTreasuryTransaction = useMutation(
    db.weekBoard.applyTreasuryTransaction,
  );
  const rankUpMilitia = useMutation(db.weekBoard.rankUpMilitia);
  const buyOffPersistentEvent = useMutation(db.weekBoard.buyOffPersistentEvent);

  const savePhase = async (militiaId: Id<'militia'>, phase: WeekPhase) => {
    await saveWeekBoardState({
      organizationId,
      militiaId,
      patch: { phase },
    });
  };

  const saveSlots = async (
    militiaId: Id<'militia'>,
    stagedActivityActionIds: (ActionId | null)[],
  ) => {
    await saveWeekBoardState({
      organizationId,
      militiaId,
      patch: { stagedActivityActionIds },
    });
  };

  const saveUpkeepTotals = async (
    militiaId: Id<'militia'>,
    upkeepRollTotals: {
      attritionTotal?: string;
      notorietyPenaltyTotal?: string;
      maxNotorietyLoyaltyCheckTotal?: string;
      nearestSettlementKey?: string;
      treasuryPenaltyTotal?: string;
    },
  ) => {
    await saveWeekBoardState({
      organizationId,
      militiaId,
      patch: { upkeepRollTotals },
    });
  };

  const saveEventTotals = async (
    militiaId: Id<'militia'>,
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
    await saveWeekBoardState({
      organizationId,
      militiaId,
      patch: { eventRollTotals },
    });
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
    await commitCurrentPhase({
      organizationId,
      militiaId,
    });
  };

  const goBackWeek = async (militiaId: Id<'militia'>) => {
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
    await applyTreasuryTransaction({
      organizationId,
      militiaId,
      depositTotal: mode === 'deposit' ? amount : '0',
      withdrawalTotal: mode === 'withdraw' ? amount : '0',
    });
  };

  const applyRankUp = async (militiaId: Id<'militia'>) => {
    await rankUpMilitia({
      organizationId,
      militiaId,
    });
  };

  const buyOffPersistentEventAction = async (
    militiaId: Id<'militia'>,
    eventStateId: Id<'militiaEventState'>,
  ) => {
    await buyOffPersistentEvent({
      organizationId,
      militiaId,
      eventStateId,
    });
  };

  return {
    savePhase,
    saveSlots,
    saveUpkeepTotals,
    saveEventTotals,
    continueToSummary,
    commitPhase,
    goBackWeek,
    applyTreasuryUpdate,
    applyRankUp,
    buyOffPersistentEventAction,
  };
}
