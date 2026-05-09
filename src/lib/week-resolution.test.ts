import { describe, expect, it } from 'vitest';
import {
  consumeQueuedEffectsForWeek,
  deriveFutureEffectsAndPersistence,
  computeNextUneventfulBonusCarry,
  getWeekModifiers,
  resolveWeekEvents,
  shouldApplyBaseEffect,
} from '@convex/weekResolution';

describe('weekResolution', () => {
  it('uses guaranteed choose-one rolls when event is guaranteed', () => {
    const resolved = resolveWeekEvents({
      eventOccurred: true,
      guaranteedByAction: true,
      guaranteedFirstPercentileTotal: 12,
      guaranteedSecondPercentileTotal: 80,
      guaranteedChosen: 'second',
    });

    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.eventType).toBe('raid');
  });

  it('resolves Roll Twice and ignores nested Roll Twice results', () => {
    const resolved = resolveWeekEvents({
      eventOccurred: true,
      guaranteedByAction: false,
      eventPercentileTotal: 50,
      rollTwiceFirstTotal: 50,
      rollTwiceSecondTotal: 80,
    });

    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.eventType).toBe('raid');
  });

  it('marks duplicate second result as Twice clause', () => {
    const resolved = resolveWeekEvents({
      eventOccurred: true,
      guaranteedByAction: false,
      eventPercentileTotal: 50,
      rollTwiceFirstTotal: 45,
      rollTwiceSecondTotal: 45,
    });

    expect(resolved).toHaveLength(2);
    expect(resolved[0]?.eventType).toBe('all_is_calm');
    expect(resolved[0]?.isTwiceClause).toBe(false);
    expect(resolved[1]?.eventType).toBe('all_is_calm');
    expect(resolved[1]?.isTwiceClause).toBe(true);
  });

  it('does not apply base effect for duplicate event without a Twice clause', () => {
    const resolved = resolveWeekEvents({
      eventOccurred: true,
      guaranteedByAction: false,
      eventPercentileTotal: 50,
      rollTwiceFirstTotal: 5,
      rollTwiceSecondTotal: 5,
    });

    expect(resolved).toHaveLength(2);
    expect(resolved[1]?.eventType).toBe('war_games');
    expect(shouldApplyBaseEffect(resolved[1]!)).toBe(false);
  });

  it('does not apply base effect for duplicate event with a Twice clause', () => {
    const resolved = resolveWeekEvents({
      eventOccurred: true,
      guaranteedByAction: false,
      eventPercentileTotal: 50,
      rollTwiceFirstTotal: 45,
      rollTwiceSecondTotal: 45,
    });

    expect(resolved).toHaveLength(2);
    expect(shouldApplyBaseEffect(resolved[1]!)).toBe(false);
  });

  it('accumulates uneventful carry after week 1 and resets on eventful week', () => {
    const firstWeekCarry = computeNextUneventfulBonusCarry({
      weekNumber: 1,
      currentCarry: 0,
      rank: 4,
      eventOccurred: false,
      resolvedEvents: [],
    });
    expect(firstWeekCarry).toBe(0);

    const secondWeekCarry = computeNextUneventfulBonusCarry({
      weekNumber: 2,
      currentCarry: 0,
      rank: 4,
      eventOccurred: false,
      resolvedEvents: [],
    });
    expect(secondWeekCarry).toBe(4);

    const thirdWeekCarry = computeNextUneventfulBonusCarry({
      weekNumber: 3,
      currentCarry: 4,
      rank: 4,
      eventOccurred: false,
      resolvedEvents: [],
    });
    expect(thirdWeekCarry).toBe(8);

    const resetCarry = computeNextUneventfulBonusCarry({
      weekNumber: 4,
      currentCarry: 8,
      rank: 4,
      eventOccurred: true,
      resolvedEvents: [{ eventType: 'war_games', rolledValue: 5, isTwiceClause: false }],
    });
    expect(resetCarry).toBe(0);
  });

  it('consumes queue effects for the active week and keeps future effects', () => {
    const consumed = consumeQueuedEffectsForWeek({
      queuedEffects: [
        { kind: 'double_upkeep_attrition', appliesWeek: 3 },
        { kind: 'auto_event_roll_once', appliesWeek: 4 },
      ],
      weekNumber: 3,
    });

    expect(consumed.active).toEqual([{ kind: 'double_upkeep_attrition', appliesWeek: 3 }]);
    expect(consumed.remaining).toEqual([{ kind: 'auto_event_roll_once', appliesWeek: 4 }]);
  });

  it('derives modifiers from queue and persistent effects', () => {
    const modifiers = getWeekModifiers({
      activeQueuedEffects: [
        { kind: 'double_upkeep_attrition', appliesWeek: 6 },
        { kind: 'double_next_activity_training_gain', appliesWeek: 6 },
        { kind: 'all_is_calm_auto_next_week', appliesWeek: 6 },
      ],
      activePersistentEventTypes: ['theft'],
    });

    expect(modifiers.attritionMultiplier).toBe(2);
    expect(modifiers.activityTrainingGainMultiplier).toBe(2);
    expect(modifiers.incomeMultiplier).toBe(0.5);
    expect(modifiers.forceAllIsCalm).toBe(true);
  });

  it('derives next-week queued effects and persistence from resolved events', () => {
    const derived = deriveFutureEffectsAndPersistence({
      currentWeek: 8,
      resolvedEvents: [
        { eventType: 'week_of_pain', rolledValue: 100, isTwiceClause: false },
        { eventType: 'high_morale', rolledValue: 27, isTwiceClause: true },
        { eventType: 'theft', rolledValue: 73, isTwiceClause: true },
      ],
    });

    expect(derived.queuedToAdd).toEqual([
      { kind: 'week_of_pain_checks_penalty', appliesWeek: 9 },
      { kind: 'double_upkeep_attrition', appliesWeek: 9 },
      {
        kind: 'organization_check_modifier',
        appliesWeek: 9,
        checkType: 'loyalty',
        modifierTotal: 5,
        sourceEventType: 'high_morale',
        note: 'High Morale: +5 on Loyalty checks this week.',
      },
    ]);
    expect(derived.endPersistentCount).toBe(2);
    expect(derived.persistentToAdd).toEqual(['theft']);
  });
});
