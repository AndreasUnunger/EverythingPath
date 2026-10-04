'use client';
import { createContext, useContext, type ReactNode } from 'react';
import {
  familiarStatisticTargetSchema,
  type FamiliarStatisticTarget,
} from '~/lib/character-sheet-familiar-targets';
import type { BreakdownTarget } from './stat-breakdown-content';

/**
 * The sheet's statistics whose finished value is unavailable: a familiar's
 * totals that need its base creature or a value from its associated
 * Character (#326). Every number on the sheet asks here before it states a
 * total, so a sum of the known contributions never reads as finished.
 */
type UnresolvedStatistics = {
  targets: ReadonlySet<FamiliarStatisticTarget>;
  /** Why, in the open breakdown. */
  reason: string;
};

const UnresolvedStatisticsContext = createContext<UnresolvedStatistics>({
  targets: new Set(),
  reason: '',
});

function statisticKey(target: BreakdownTarget): FamiliarStatisticTarget | null {
  if (typeof target === 'string') {
    const parsed = familiarStatisticTargetSchema.safeParse(target);
    return parsed.success ? parsed.data : null;
  }
  if (target.kind === 'derived') {
    const parsed = familiarStatisticTargetSchema.safeParse(
      `derived.${target.statistic}`,
    );
    return parsed.success ? parsed.data : null;
  }
  if (target.kind === 'attackRoutine' && target.statistic === 'attackBonus')
    return 'attackRoutine.attackBonus';
  return null;
}

export function UnresolvedStatisticsProvider({
  targets,
  reason,
  children,
}: {
  targets: readonly FamiliarStatisticTarget[];
  reason: string;
  children: ReactNode;
}) {
  return (
    <UnresolvedStatisticsContext value={{ targets: new Set(targets), reason }}>
      {children}
    </UnresolvedStatisticsContext>
  );
}

/** Why the statistic's total is unavailable, or null when it is finished. */
export function useUnresolvedReason(target: BreakdownTarget | undefined) {
  const { targets, reason } = useContext(UnresolvedStatisticsContext);
  if (target === undefined || targets.size === 0) return null;
  const key = statisticKey(target);
  return key !== null && targets.has(key) ? reason : null;
}

/** Whether a plain sheet count, such as Hit Dice, is unavailable. */
export function useIsUnresolved(key: FamiliarStatisticTarget) {
  return useContext(UnresolvedStatisticsContext).targets.has(key);
}
