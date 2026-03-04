export type EventType =
  | 'all_is_calm'
  | 'broke_the_code'
  | 'cache_discovered'
  | 'calm_before_the_storm'
  | 'double_agent'
  | 'festival'
  | 'found_fire'
  | 'hidden_agenda'
  | 'high_morale'
  | 'invasion'
  | 'low_morale'
  | 'market_day'
  | 'missing_in_action'
  | 'night_ops'
  | 'raid'
  | 'rivalry'
  | 'roll_twice'
  | 'sickness'
  | 'theft'
  | 'turn_around'
  | 'turncoat'
  | 'war_games'
  | 'week_of_pain'
  | 'week_of_serenity';

export type ResolvedEvent = {
  eventType: EventType;
  rolledValue: number;
  isTwiceClause: boolean;
};

export type QueueEffectKind =
  | 'week_of_pain_checks_penalty'
  | 'double_upkeep_attrition'
  | 'week_of_serenity_checks_bonus'
  | 'double_next_activity_training_gain'
  | 'all_is_calm_auto_next_week'
  | 'auto_event_roll_once'
  | 'auto_event_roll_twice';

export type QueueEffect = {
  kind: QueueEffectKind;
  appliesWeek: number;
  note?: string;
};

type ResolveWeekEventsArgs = {
  eventOccurred: boolean;
  guaranteedByAction: boolean;
  eventPercentileTotal?: number;
  rollTwiceFirstTotal?: number;
  rollTwiceSecondTotal?: number;
  guaranteedFirstPercentileTotal?: number;
  guaranteedSecondPercentileTotal?: number;
  guaranteedChosen?: 'first' | 'second';
};

export function clampPercent(raw: number) {
  return Math.max(1, Math.min(100, Math.floor(raw)));
}

export function resolveEventFromPercentile(percentile?: number): ResolvedEvent | null {
  if (percentile === undefined) return null;
  const value = clampPercent(percentile);
  if (value <= 4) return { eventType: 'week_of_serenity', rolledValue: value, isTwiceClause: false };
  if (value <= 12) return { eventType: 'war_games', rolledValue: value, isTwiceClause: false };
  if (value <= 16) return { eventType: 'night_ops', rolledValue: value, isTwiceClause: false };
  if (value <= 20) return { eventType: 'broke_the_code', rolledValue: value, isTwiceClause: false };
  if (value <= 24) return { eventType: 'found_fire', rolledValue: value, isTwiceClause: false };
  if (value <= 28) return { eventType: 'high_morale', rolledValue: value, isTwiceClause: false };
  if (value <= 32) return { eventType: 'turn_around', rolledValue: value, isTwiceClause: false };
  if (value <= 36) return { eventType: 'festival', rolledValue: value, isTwiceClause: false };
  if (value <= 40) return { eventType: 'market_day', rolledValue: value, isTwiceClause: false };
  if (value <= 44) return { eventType: 'hidden_agenda', rolledValue: value, isTwiceClause: false };
  if (value <= 48) return { eventType: 'all_is_calm', rolledValue: value, isTwiceClause: false };
  if (value <= 52) return { eventType: 'roll_twice', rolledValue: value, isTwiceClause: false };
  if (value <= 56) return { eventType: 'calm_before_the_storm', rolledValue: value, isTwiceClause: false };
  if (value <= 60) return { eventType: 'turncoat', rolledValue: value, isTwiceClause: false };
  if (value <= 64) return { eventType: 'cache_discovered', rolledValue: value, isTwiceClause: false };
  if (value <= 68) return { eventType: 'rivalry', rolledValue: value, isTwiceClause: false };
  if (value <= 72) return { eventType: 'missing_in_action', rolledValue: value, isTwiceClause: false };
  if (value <= 76) return { eventType: 'theft', rolledValue: value, isTwiceClause: false };
  if (value <= 80) return { eventType: 'raid', rolledValue: value, isTwiceClause: false };
  if (value <= 84) return { eventType: 'invasion', rolledValue: value, isTwiceClause: false };
  if (value <= 88) return { eventType: 'low_morale', rolledValue: value, isTwiceClause: false };
  if (value <= 96) return { eventType: 'sickness', rolledValue: value, isTwiceClause: false };
  if (value <= 99) return { eventType: 'double_agent', rolledValue: value, isTwiceClause: false };
  return { eventType: 'week_of_pain', rolledValue: value, isTwiceClause: false };
}

function pickGuaranteedPrimaryRoll({
  eventPercentileTotal,
  guaranteedFirstPercentileTotal,
  guaranteedSecondPercentileTotal,
  guaranteedChosen,
}: {
  eventPercentileTotal?: number;
  guaranteedFirstPercentileTotal?: number;
  guaranteedSecondPercentileTotal?: number;
  guaranteedChosen?: 'first' | 'second';
}) {
  if (guaranteedChosen === 'first' && guaranteedFirstPercentileTotal !== undefined) {
    return guaranteedFirstPercentileTotal;
  }
  if (guaranteedChosen === 'second' && guaranteedSecondPercentileTotal !== undefined) {
    return guaranteedSecondPercentileTotal;
  }
  if (guaranteedFirstPercentileTotal !== undefined) {
    return guaranteedFirstPercentileTotal;
  }
  if (guaranteedSecondPercentileTotal !== undefined) {
    return guaranteedSecondPercentileTotal;
  }
  return eventPercentileTotal;
}

export function resolveWeekEvents(args: ResolveWeekEventsArgs) {
  if (!args.eventOccurred) return [] as ResolvedEvent[];

  const primaryRoll = args.guaranteedByAction
    ? pickGuaranteedPrimaryRoll(args)
    : args.eventPercentileTotal;

  const primaryEvent = resolveEventFromPercentile(primaryRoll);
  if (!primaryEvent) return [] as ResolvedEvent[];

  if (primaryEvent.eventType !== 'roll_twice') {
    return [primaryEvent];
  }

  // Rules: Roll Twice only takes effect once; additional Roll Twice results are rerolled.
  // We model that by ignoring nested Roll Twice results if explicit reroll values were not entered.
  const first = resolveEventFromPercentile(args.rollTwiceFirstTotal);
  const second = resolveEventFromPercentile(args.rollTwiceSecondTotal);

  const firstResolved =
    first && first.eventType !== 'roll_twice'
      ? first
      : null;
  const secondResolved =
    second && second.eventType !== 'roll_twice'
      ? second
      : null;

  const resolved: ResolvedEvent[] = [];
  if (firstResolved) {
    resolved.push(firstResolved);
  }
  if (secondResolved) {
    const sameAsFirst =
      firstResolved !== null &&
      firstResolved.eventType === secondResolved.eventType;
    resolved.push({
      ...secondResolved,
      isTwiceClause: sameAsFirst,
    });
  }

  return resolved;
}

export function shouldApplyBaseEffect(event: ResolvedEvent) {
  return !event.isTwiceClause;
}

export function shouldCountAsUneventfulWeek({
  eventOccurred,
  resolvedEvents,
}: {
  eventOccurred: boolean;
  resolvedEvents: ResolvedEvent[];
}) {
  if (!eventOccurred) return true;
  if (resolvedEvents.length !== 1) return false;
  const single = resolvedEvents[0];
  if (!single) return false;
  return single.eventType === 'all_is_calm' && !single.isTwiceClause;
}

export function computeNextUneventfulBonusCarry({
  weekNumber,
  currentCarry,
  rank,
  eventOccurred,
  resolvedEvents,
}: {
  weekNumber: number;
  currentCarry: number;
  rank: number;
  eventOccurred: boolean;
  resolvedEvents: ResolvedEvent[];
}) {
  if (weekNumber <= 1) {
    return 0;
  }
  const countsAsUneventful = shouldCountAsUneventfulWeek({
    eventOccurred,
    resolvedEvents,
  });
  if (!countsAsUneventful) {
    return 0;
  }
  return currentCarry + rank;
}

export function consumeQueuedEffectsForWeek({
  queuedEffects,
  weekNumber,
}: {
  queuedEffects: QueueEffect[];
  weekNumber: number;
}) {
  const active = queuedEffects.filter((effect) => effect.appliesWeek === weekNumber);
  const remaining = queuedEffects.filter((effect) => effect.appliesWeek > weekNumber);
  return { active, remaining };
}

export function getWeekModifiers({
  activeQueuedEffects,
  activePersistentEventTypes,
}: {
  activeQueuedEffects: QueueEffect[];
  activePersistentEventTypes: EventType[];
}) {
  const queuedKinds = new Set(activeQueuedEffects.map((effect) => effect.kind));
  const attritionMultiplier = queuedKinds.has('double_upkeep_attrition') ? 2 : 1;
  const activityTrainingGainMultiplier = queuedKinds.has(
    'double_next_activity_training_gain',
  )
    ? 2
    : 1;
  const forceAllIsCalm = queuedKinds.has('all_is_calm_auto_next_week');
  const incomeMultiplier = activePersistentEventTypes.includes('theft') ? 0.5 : 1;

  return {
    attritionMultiplier,
    activityTrainingGainMultiplier,
    incomeMultiplier,
    forceAllIsCalm,
  };
}

export function deriveFutureEffectsAndPersistence({
  resolvedEvents,
  currentWeek,
}: {
  resolvedEvents: ResolvedEvent[];
  currentWeek: number;
}) {
  const queuedToAdd: QueueEffect[] = [];
  const persistentToAdd: EventType[] = [];
  let endPersistentCount = 0;

  for (const event of resolvedEvents) {
    if (event.isTwiceClause) {
      if (event.eventType === 'all_is_calm') {
        queuedToAdd.push({
          kind: 'all_is_calm_auto_next_week',
          appliesWeek: currentWeek + 1,
        });
      } else if (event.eventType === 'calm_before_the_storm') {
        queuedToAdd.push({
          kind: 'auto_event_roll_twice',
          appliesWeek: currentWeek + 1,
        });
      } else if (
        event.eventType === 'double_agent' ||
        event.eventType === 'low_morale' ||
        event.eventType === 'rivalry' ||
        event.eventType === 'theft'
      ) {
        persistentToAdd.push(event.eventType);
      } else if (event.eventType === 'high_morale') {
        endPersistentCount += 2;
      } else if (event.eventType === 'week_of_pain') {
        // Twice: no additional effect.
      } else if (event.eventType === 'week_of_serenity') {
        // Twice: no additional effect.
      }
      continue;
    }

    if (event.eventType === 'week_of_pain') {
      queuedToAdd.push(
        {
          kind: 'week_of_pain_checks_penalty',
          appliesWeek: currentWeek + 1,
        },
        {
          kind: 'double_upkeep_attrition',
          appliesWeek: currentWeek + 1,
        },
      );
    } else if (event.eventType === 'week_of_serenity') {
      queuedToAdd.push(
        {
          kind: 'week_of_serenity_checks_bonus',
          appliesWeek: currentWeek + 1,
        },
        {
          kind: 'double_next_activity_training_gain',
          appliesWeek: currentWeek + 1,
        },
      );
    } else if (event.eventType === 'calm_before_the_storm') {
      queuedToAdd.push({
        kind: 'auto_event_roll_once',
        appliesWeek: currentWeek + 1,
      });
    } else if (event.eventType === 'high_morale') {
      endPersistentCount += 1;
    }
  }

  return { queuedToAdd, persistentToAdd, endPersistentCount };
}
