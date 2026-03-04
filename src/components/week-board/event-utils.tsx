import { MILITIA_EVENT_DETAILS, MILITIA_EVENT_TABLE } from '~/components/week-board/data';
import type { EventTriggerResolution, ResolvedEventValue } from '~/components/week-board/types';

export function resolveMilitiaEventFromPercentile(raw: string): ResolvedEventValue {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return { error: 'Enter a numeric percentile total.' };
  }

  const rounded = Math.floor(parsed);
  if (rounded < 1 || rounded > 100) {
    return { error: 'Percentile total must be between 1 and 100.' };
  }

  const match = MILITIA_EVENT_TABLE.find(
    (entry) => rounded >= entry.min && rounded <= entry.max,
  );

  if (!match) {
    return { error: 'No event mapping found for this percentile total.' };
  }

  return { event: match.name, rolledValue: rounded };
}

export function resolveEventTrigger({
  chanceRaw,
  rollRaw,
  guaranteed,
}: {
  chanceRaw: string;
  rollRaw: string;
  guaranteed: boolean;
}): EventTriggerResolution {
  if (guaranteed) {
    return {
      status: 'event',
      reason: 'Event guaranteed by staged action',
    };
  }

  const chanceTrimmed = chanceRaw.trim();
  const rollTrimmed = rollRaw.trim();
  if (!chanceTrimmed || !rollTrimmed) {
    return null;
  }

  const chance = Number(chanceTrimmed);
  const roll = Number(rollTrimmed);
  if (!Number.isFinite(chance) || !Number.isFinite(roll)) {
    return {
      status: 'error',
      message: 'Event chance and trigger roll must be numeric.',
    };
  }

  const chanceValue = Math.floor(chance);
  const rollValue = Math.floor(roll);
  if (chanceValue < 1 || chanceValue > 100 || rollValue < 1 || rollValue > 100) {
    return {
      status: 'error',
      message: 'Event chance and trigger roll must be between 1 and 100.',
    };
  }

  if (rollValue < chanceValue) {
    return {
      status: 'event',
      chanceValue,
      rollValue,
    };
  }
  return {
    status: 'no_event',
    chanceValue,
    rollValue,
  };
}

export function formatResolvedEventTriggerLabel(value: EventTriggerResolution) {
  if (!value) {
    return 'Awaiting event chance and trigger roll';
  }
  if (value.status === 'error') {
    return value.message;
  }
  if (value.status === 'event') {
    if (value.reason) {
      return value.reason;
    }
    return `Event occurs (${value.rollValue} < ${value.chanceValue})`;
  }
  return `No event this week (${value.rollValue} >= ${value.chanceValue})`;
}

export function renderEventChanceRulesWarning(rawChance: string) {
  const trimmed = rawChance.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  const rounded = Math.floor(parsed);
  if (rounded >= 10 && rounded <= 95) {
    return null;
  }

  return (
    <p className="text-muted-foreground">
      Rules baseline is minimum 10% and maximum 95% event chance before table-specific
      adjudication.
    </p>
  );
}

export function formatResolvedEventLabel(value: ResolvedEventValue) {
  if (!value) {
    return 'Awaiting roll';
  }
  if ('error' in value) {
    return value.error;
  }
  return `${value.rolledValue}: ${value.event}`;
}

export function renderResolvedEventDetails(value: ResolvedEventValue) {
  if (!value || 'error' in value) {
    return null;
  }

  const details = MILITIA_EVENT_DETAILS[value.event];
  if (!details) {
    return null;
  }

  return (
    <ul className="mt-2 space-y-1">
      {details.fullText.map((line) => (
        <li key={`${value.event}-${line}`} className="text-muted-foreground">
          {line}
        </li>
      ))}
    </ul>
  );
}

export function formatEventRange(min: number, max: number) {
  if (min === max) {
    return `${min}`;
  }
  return `${min}-${max}`;
}
