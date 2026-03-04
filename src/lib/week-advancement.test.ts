import { describe, expect, it } from 'vitest';
import type { EventType, QueueEffect, ResolvedEvent } from '@convex/weekResolution';
import {
  clampPercent,
  computeNextUneventfulBonusCarry,
  consumeQueuedEffectsForWeek,
  deriveFutureEffectsAndPersistence,
  getWeekModifiers,
  resolveEventFromPercentile,
  resolveWeekEvents,
  shouldApplyBaseEffect,
} from '@convex/weekResolution';

type SimArgs = {
  weekNumber: number;
  militia: {
    rank: number;
    training: number;
    treasury: number;
    notoriety: number;
  };
  currentCarry: number;
  queuedEffects: QueueEffect[];
  persistentTypes: EventType[];
  stagedActions?: string[];
  upkeep?: {
    attritionTotal?: number;
    notorietyPenaltyTotal?: number;
    treasuryPenaltyTotal?: number;
  };
  activity?: {
    drillMilitiaTrainingGainTotal?: number;
    earnGoldTotal?: number;
  };
  event?: {
    eventChanceTotal?: number;
    eventTriggerRollTotal?: number;
    eventPercentileTotal?: number;
    rollTwiceFirstTotal?: number;
    rollTwiceSecondTotal?: number;
    guaranteedFirstPercentileTotal?: number;
    guaranteedSecondPercentileTotal?: number;
    guaranteedChosen?: 'first' | 'second';
    sabotageCheckTotal?: number;
    sabotageNotorietyIncreaseTotal?: number;
  };
};

function eventWouldOccur({
  chanceTotal,
  triggerRollTotal,
  guaranteedByAction,
}: {
  chanceTotal?: number;
  triggerRollTotal?: number;
  guaranteedByAction: boolean;
}) {
  if (guaranteedByAction) return true;
  if (chanceTotal === undefined || triggerRollTotal === undefined) return false;
  return clampPercent(triggerRollTotal) < clampPercent(chanceTotal);
}

function simulateWeekAdvance(args: SimArgs) {
  const upkeep = args.upkeep ?? {};
  const activity = args.activity ?? {};
  const event = args.event ?? {};
  const staged = args.stagedActions ?? [];

  const { active: activeQueuedEffects, remaining: remainingQueuedEffects } =
    consumeQueuedEffectsForWeek({
      queuedEffects: args.queuedEffects,
      weekNumber: args.weekNumber,
    });
  const modifiers = getWeekModifiers({
    activeQueuedEffects,
    activePersistentEventTypes: args.persistentTypes,
  });

  let training = args.militia.training;
  let treasury = args.militia.treasury;
  let notoriety = args.militia.notoriety;

  training -= (upkeep.attritionTotal ?? 0) * modifiers.attritionMultiplier;
  training -= upkeep.notorietyPenaltyTotal ?? 0;
  training -= upkeep.treasuryPenaltyTotal ?? 0;
  training +=
    (activity.drillMilitiaTrainingGainTotal ?? 0) *
    modifiers.activityTrainingGainMultiplier;
  treasury += (activity.earnGoldTotal ?? 0) * modifiers.incomeMultiplier;

  const guaranteedByAction =
    staged.includes('guarantee_event') || staged.includes('manipulate_events');
  const occurredBeforeSabotage = eventWouldOccur({
    chanceTotal: event.eventChanceTotal,
    triggerRollTotal: event.eventTriggerRollTotal,
    guaranteedByAction,
  });

  let eventOccurred = modifiers.forceAllIsCalm ? true : occurredBeforeSabotage;
  if (
    !modifiers.forceAllIsCalm &&
    occurredBeforeSabotage &&
    event.sabotageCheckTotal !== undefined
  ) {
    notoriety += event.sabotageNotorietyIncreaseTotal ?? 0;
    if (event.sabotageCheckTotal >= 15 + args.militia.rank) {
      eventOccurred = false;
    }
  }

  const resolvedEvents: ResolvedEvent[] = modifiers.forceAllIsCalm
    ? [{ eventType: 'all_is_calm', rolledValue: 45, isTwiceClause: true }]
    : resolveWeekEvents({
        eventOccurred,
        guaranteedByAction,
        eventPercentileTotal: event.eventPercentileTotal,
        rollTwiceFirstTotal: event.rollTwiceFirstTotal,
        rollTwiceSecondTotal: event.rollTwiceSecondTotal,
        guaranteedFirstPercentileTotal: event.guaranteedFirstPercentileTotal,
        guaranteedSecondPercentileTotal: event.guaranteedSecondPercentileTotal,
        guaranteedChosen: event.guaranteedChosen,
      });

  const autoEventCount = activeQueuedEffects.reduce((count, effect) => {
    if (effect.kind === 'auto_event_roll_once') return count + 1;
    if (effect.kind === 'auto_event_roll_twice') return count + 2;
    return count;
  }, 0);
  const autoEventRolls = [event.rollTwiceFirstTotal, event.rollTwiceSecondTotal]
    .slice(0, autoEventCount)
    .map((raw) => resolveEventFromPercentile(raw))
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .filter((value) => value.eventType !== 'roll_twice');
  resolvedEvents.push(...autoEventRolls);

  for (const resolved of resolvedEvents) {
    if (resolved.eventType === 'war_games' && shouldApplyBaseEffect(resolved)) {
      training += args.militia.rank;
    }
    if (resolved.eventType === 'theft' && shouldApplyBaseEffect(resolved)) {
      treasury = Math.floor(treasury / 2);
    }
  }

  const nextCarry = computeNextUneventfulBonusCarry({
    weekNumber: args.weekNumber,
    currentCarry: args.currentCarry,
    rank: args.militia.rank,
    eventOccurred,
    resolvedEvents,
  });
  const derived = deriveFutureEffectsAndPersistence({
    currentWeek: args.weekNumber,
    resolvedEvents,
  });

  return {
    training,
    treasury,
    notoriety,
    eventOccurred,
    resolvedEvents,
    nextCarry,
    nextQueuedEffects: [...remainingQueuedEffects, ...derived.queuedToAdd],
    persistentToAdd: derived.persistentToAdd,
    endPersistentCount: derived.endPersistentCount,
  };
}

describe('week advancement integration', () => {
  it('advances an uneventful week and applies carry after week 1', () => {
    const result = simulateWeekAdvance({
      weekNumber: 2,
      militia: { rank: 4, training: 20, treasury: 30, notoriety: 25 },
      currentCarry: 0,
      queuedEffects: [],
      persistentTypes: [],
      upkeep: { attritionTotal: 3 },
      activity: { drillMilitiaTrainingGainTotal: 2, earnGoldTotal: 5 },
      event: { eventChanceTotal: 25, eventTriggerRollTotal: 70 },
    });

    expect(result.training).toBe(19);
    expect(result.treasury).toBe(35);
    expect(result.eventOccurred).toBe(false);
    expect(result.nextCarry).toBe(4);
  });

  it('applies sabotage notoriety and negates event on success', () => {
    const result = simulateWeekAdvance({
      weekNumber: 3,
      militia: { rank: 4, training: 20, treasury: 30, notoriety: 25 },
      currentCarry: 2,
      queuedEffects: [],
      persistentTypes: [],
      event: {
        eventChanceTotal: 60,
        eventTriggerRollTotal: 10,
        eventPercentileTotal: 80,
        sabotageCheckTotal: 19,
        sabotageNotorietyIncreaseTotal: 2,
      },
    });

    expect(result.eventOccurred).toBe(false);
    expect(result.notoriety).toBe(27);
    expect(result.resolvedEvents).toEqual([]);
  });

  it('handles Roll Twice duplicate with Twice clause and no uneventful carry', () => {
    const result = simulateWeekAdvance({
      weekNumber: 4,
      militia: { rank: 5, training: 40, treasury: 40, notoriety: 40 },
      currentCarry: 5,
      queuedEffects: [],
      persistentTypes: [],
      event: {
        eventChanceTotal: 60,
        eventTriggerRollTotal: 10,
        eventPercentileTotal: 50,
        rollTwiceFirstTotal: 45,
        rollTwiceSecondTotal: 45,
      },
    });

    expect(result.resolvedEvents).toHaveLength(2);
    expect(result.resolvedEvents[0]?.eventType).toBe('all_is_calm');
    expect(result.resolvedEvents[1]?.isTwiceClause).toBe(true);
    expect(result.nextCarry).toBe(0);
    expect(result.nextQueuedEffects).toContainEqual({
      kind: 'all_is_calm_auto_next_week',
      appliesWeek: 5,
    });
  });

  it('consumes queued effects, applies persistent theft modifier, and queues future effects', () => {
    const result = simulateWeekAdvance({
      weekNumber: 6,
      militia: { rank: 3, training: 18, treasury: 20, notoriety: 30 },
      currentCarry: 0,
      queuedEffects: [
        { kind: 'double_upkeep_attrition', appliesWeek: 6 },
        { kind: 'auto_event_roll_once', appliesWeek: 6 },
        { kind: 'week_of_serenity_checks_bonus', appliesWeek: 7 },
      ],
      persistentTypes: ['theft'],
      upkeep: { attritionTotal: 2 },
      activity: { earnGoldTotal: 10 },
      event: {
        eventChanceTotal: 10,
        eventTriggerRollTotal: 99,
        rollTwiceFirstTotal: 100,
      },
    });

    expect(result.training).toBe(14);
    expect(result.treasury).toBe(25);
    expect(result.resolvedEvents.some((event) => event.eventType === 'week_of_pain')).toBe(
      true,
    );
    expect(result.nextQueuedEffects).toContainEqual({
      kind: 'week_of_serenity_checks_bonus',
      appliesWeek: 7,
    });
    expect(result.nextQueuedEffects).toContainEqual({
      kind: 'week_of_pain_checks_penalty',
      appliesWeek: 7,
    });
    expect(result.nextQueuedEffects).toContainEqual({
      kind: 'double_upkeep_attrition',
      appliesWeek: 7,
    });
  });

  it('uses guarantee/manipulate choose-one rolls and applies chosen event effect', () => {
    const result = simulateWeekAdvance({
      weekNumber: 5,
      militia: { rank: 4, training: 16, treasury: 20, notoriety: 20 },
      currentCarry: 0,
      queuedEffects: [],
      persistentTypes: [],
      stagedActions: ['guarantee_event'],
      event: {
        guaranteedFirstPercentileTotal: 80,
        guaranteedSecondPercentileTotal: 12,
        guaranteedChosen: 'second',
      },
    });

    expect(result.resolvedEvents[0]?.eventType).toBe('war_games');
    expect(result.training).toBe(20);
  });
});
