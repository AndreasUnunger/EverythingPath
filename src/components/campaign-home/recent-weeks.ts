import type { FunctionReturnType } from 'convex/server';
import type { api } from '@convex/_generated/api';
import { rowHeadlines } from '~/components/historical-week/finished-week-headline-text';
import { historyPath } from '~/lib/campaign-routes';

export type FinishedWeekList = FunctionReturnType<
  typeof api.canonicalHistory.list
>;
export type RecentWeek = {
  week: number;
  href: string;
  badge: 'Corrected' | 'From setup' | null;
  headlines: string[];
};

export const RECENT_WEEK_LIMIT = 3;

// Corrected (more than one audit entry) takes precedence; From setup marks
// only an uncorrected reconstruction. Finished weeks words the same marker
// Reconstructed on purpose.
function provenanceBadge(row: FinishedWeekList['weeks'][number]) {
  if (row.entryCount > 1) return 'Corrected';
  if (row.provenance === 'historical_reconstruction') return 'From setup';
  return null;
}

/**
 * Up to three latest finished weeks, latest first as listed, with the same
 * recorded headlines as the Finished weeks index.
 */
export function recentWeeks(
  campaignId: string,
  list: FinishedWeekList,
): RecentWeek[] {
  return list.weeks.slice(0, RECENT_WEEK_LIMIT).map((row) => ({
    week: row.week,
    href: historyPath(campaignId, { week: row.week }),
    badge: provenanceBadge(row),
    headlines: rowHeadlines(row),
  }));
}
