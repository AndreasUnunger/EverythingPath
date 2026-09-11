import { eventTypeForPercentile } from '../src/lib/militia-event-table';
import type { EventType } from '../src/lib/militia-domain';

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
  | 'auto_event_roll_twice'
  | 'organization_check_modifier'
  | 'activity_action_block'
  | 'team_check_modifier'
  | 'table_note';

export type QueueEffectCheckType =
  | 'all'
  | 'activity'
  | 'loyalty'
  | 'security'
  | 'secrecy';

export type QueueEffectActionId = 'secure_cache';

export type QueueEffectStrikeTeamMode = 'combat_support' | 'extraction';

export type QueueEffect = {
  kind: QueueEffectKind;
  appliesWeek: number;
  note?: string;
  checkType?: QueueEffectCheckType;
  modifierTotal?: number;
  blockedActionId?: QueueEffectActionId;
  teamId?: string;
  location?: string;
  strikeTeamMode?: QueueEffectStrikeTeamMode;
  sourceEventType?: string;
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
  return { eventType: eventTypeForPercentile(value), rolledValue: value, isTwiceClause: false };
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

export function getQueuedOrganizationCheckModifier({
  activeQueuedEffects,
  activePersistentEventTypes,
  checkType,
}: {
  activeQueuedEffects: QueueEffect[];
  activePersistentEventTypes: EventType[];
  checkType: Exclude<QueueEffectCheckType, 'all' | 'activity'>;
}) {
  let modifier = activeQueuedEffects.reduce((total, effect) => {
    if (effect.kind !== 'organization_check_modifier') {
      return total;
    }
    if (effect.modifierTotal === undefined) {
      return total;
    }
    if (effect.checkType !== 'all' && effect.checkType !== checkType) {
      return total;
    }
    return total + effect.modifierTotal;
  }, 0);

  if (checkType === 'secrecy' && activePersistentEventTypes.includes('double_agent')) {
    modifier -= 2;
  }
  if (checkType === 'loyalty' && activePersistentEventTypes.includes('low_morale')) {
    modifier -= 2;
  }
  if (
    activeQueuedEffects.some(
      (effect) => effect.kind === 'week_of_pain_checks_penalty',
    )
  ) {
    modifier -= 1;
  }
  if (
    activeQueuedEffects.some(
      (effect) => effect.kind === 'week_of_serenity_checks_bonus',
    )
  ) {
    modifier += 5;
  }

  return modifier;
}

export function getQueuedActivityCheckModifier({
  activeQueuedEffects,
}: {
  activeQueuedEffects: QueueEffect[];
}) {
  return activeQueuedEffects.reduce((total, effect) => {
    if (effect.kind !== 'organization_check_modifier') {
      return total;
    }
    if (effect.checkType !== 'activity' || effect.modifierTotal === undefined) {
      return total;
    }
    return total + effect.modifierTotal;
  }, 0);
}

export function isActivityActionBlocked({
  activeQueuedEffects,
  activePersistentEventTypes,
  actionId,
}: {
  activeQueuedEffects: QueueEffect[];
  activePersistentEventTypes: EventType[];
  actionId: QueueEffectActionId;
}) {
  if (actionId === 'secure_cache' && activePersistentEventTypes.includes('double_agent')) {
    return true;
  }

  return activeQueuedEffects.some(
    (effect) =>
      effect.kind === 'activity_action_block' &&
      effect.blockedActionId === actionId,
  );
}

export function getTeamQueuedCheckModifier({
  activeQueuedEffects,
  teamId,
}: {
  activeQueuedEffects: QueueEffect[];
  teamId?: string;
}) {
  if (!teamId) {
    return 0;
  }

  return activeQueuedEffects.reduce((total, effect) => {
    if (effect.kind !== 'team_check_modifier') {
      return total;
    }
    if (effect.teamId !== teamId || effect.modifierTotal === undefined) {
      return total;
    }
    return total + effect.modifierTotal;
  }, 0);
}

export function getResolvedActivityCheckModifier({
  resolvedEvents,
}: {
  resolvedEvents: ResolvedEvent[];
}) {
  let modifier = 0;
  for (const event of resolvedEvents) {
    if (event.eventType !== 'hidden_agenda') {
      continue;
    }
    modifier = Math.max(modifier, event.isTwiceClause ? 5 : 2);
  }
  return modifier;
}

function addQueuedTableNote(
  queuedToAdd: QueueEffect[],
  currentWeek: number,
  sourceEventType: EventType,
  note: string,
) {
  queuedToAdd.push({
    kind: 'table_note',
    appliesWeek: currentWeek + 1,
    sourceEventType,
    note,
  });
}

function addQueuedOrganizationCheckModifier(
  queuedToAdd: QueueEffect[],
  currentWeek: number,
  {
    checkType,
    modifierTotal,
    sourceEventType,
    note,
  }: {
    checkType: Exclude<QueueEffectCheckType, 'all' | 'activity'>;
    modifierTotal: number;
    sourceEventType: EventType;
    note: string;
  },
) {
  queuedToAdd.push({
    kind: 'organization_check_modifier',
    appliesWeek: currentWeek + 1,
    checkType,
    modifierTotal,
    sourceEventType,
    note,
  });
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
      } else if (event.eventType === 'broke_the_code') {
        addQueuedTableNote(
          queuedToAdd,
          currentWeek,
          'broke_the_code',
          'Broke the Code: PCs can identify one magic item of any caster level and gain +5 on Knowledge (local) checks this week.',
        );
      } else if (event.eventType === 'festival') {
        addQueuedTableNote(
          queuedToAdd,
          currentWeek,
          'festival',
          'Festival: choose a recently used town; PCs gain +5 on Bluff, Diplomacy, and Intimidate checks there this week.',
        );
      } else if (event.eventType === 'found_fire') {
        addQueuedOrganizationCheckModifier(queuedToAdd, currentWeek, {
          checkType: 'security',
          modifierTotal: 2,
          sourceEventType: 'found_fire',
          note: 'Found Fire: +2 on Security checks this week.',
        });
        addQueuedTableNote(
          queuedToAdd,
          currentWeek,
          'found_fire',
          'Found Fire: each PC chooses two non-poison alchemical items worth 100 gp or less this week.',
        );
      } else if (event.eventType === 'high_morale') {
        addQueuedOrganizationCheckModifier(queuedToAdd, currentWeek, {
          checkType: 'loyalty',
          modifierTotal: 5,
          sourceEventType: 'high_morale',
          note: 'High Morale: +5 on Loyalty checks this week.',
        });
        endPersistentCount += 2;
      } else if (event.eventType === 'night_ops') {
        addQueuedTableNote(
          queuedToAdd,
          currentWeek,
          'night_ops',
          'Night Ops: PCs gain +5 on Stealth checks after dark this week.',
        );
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
    } else if (event.eventType === 'broke_the_code') {
      addQueuedTableNote(
        queuedToAdd,
        currentWeek,
        'broke_the_code',
        'Broke the Code: PCs can identify one magic item of any caster level and gain +2 on Knowledge (local) checks this week.',
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
    } else if (event.eventType === 'double_agent') {
      queuedToAdd.push(
        {
          kind: 'organization_check_modifier',
          appliesWeek: currentWeek + 1,
          checkType: 'secrecy',
          modifierTotal: -2,
          sourceEventType: 'double_agent',
          note: 'Double Agent: -2 on Secrecy checks this week.',
        },
        {
          kind: 'activity_action_block',
          appliesWeek: currentWeek + 1,
          blockedActionId: 'secure_cache',
          sourceEventType: 'double_agent',
          note: 'Double Agent: militia cannot take Secure Cache this Activity phase.',
        },
      );
    } else if (event.eventType === 'festival') {
      addQueuedTableNote(
        queuedToAdd,
        currentWeek,
        'festival',
        'Festival: choose a recently used town; PCs gain +2 on Bluff, Diplomacy, and Intimidate checks there this week.',
      );
    } else if (event.eventType === 'found_fire') {
      addQueuedOrganizationCheckModifier(queuedToAdd, currentWeek, {
        checkType: 'security',
        modifierTotal: 2,
        sourceEventType: 'found_fire',
        note: 'Found Fire: +2 on Security checks this week.',
      });
      addQueuedTableNote(
        queuedToAdd,
        currentWeek,
        'found_fire',
        'Found Fire: each PC chooses one non-poison alchemical item worth 100 gp or less this week.',
      );
    } else if (event.eventType === 'calm_before_the_storm') {
      queuedToAdd.push({
        kind: 'auto_event_roll_once',
        appliesWeek: currentWeek + 1,
      });
    } else if (event.eventType === 'high_morale') {
      addQueuedOrganizationCheckModifier(queuedToAdd, currentWeek, {
        checkType: 'loyalty',
        modifierTotal: 2,
        sourceEventType: 'high_morale',
        note: 'High Morale: +2 on Loyalty checks this week.',
      });
      endPersistentCount += 1;
    } else if (event.eventType === 'low_morale') {
      addQueuedOrganizationCheckModifier(queuedToAdd, currentWeek, {
        checkType: 'loyalty',
        modifierTotal: -2,
        sourceEventType: 'low_morale',
        note: 'Low Morale: -2 on Loyalty checks this week.',
      });
    } else if (event.eventType === 'night_ops') {
      addQueuedTableNote(
        queuedToAdd,
        currentWeek,
        'night_ops',
        'Night Ops: PCs gain +2 on Stealth checks after dark this week.',
      );
    }
  }

  return { queuedToAdd, persistentToAdd, endPersistentCount };
}
