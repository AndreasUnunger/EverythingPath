import type { FunctionReturnType } from 'convex/server';
import type { api } from '@convex/_generated/api';
import {
  gp,
  signed,
  signedGp,
  words,
} from '~/components/week-review/review-text';
import { historyPath } from '~/lib/campaign-routes';
import type {
  FinishedWeekHeadlineFact,
  HeadlineValue,
} from '~/lib/finished-week-headlines';
import { eventName } from '~/components/weekly-draft-workspace/event-tree-facts';

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
export const recordedOutcomeAvailable = 'Recorded outcome available';

// Record-local text values: team conditions, settlement attitudes and
// persistent event types. Event types read as their table names.
function text(fact: FinishedWeekHeadlineFact, value: HeadlineValue) {
  if (value === null) return 'Not set';
  const raw = String(value);
  if (fact.key.startsWith('event:')) return eventName(raw) ?? words(raw);
  return words(raw);
}

function amount(fact: FinishedWeekHeadlineFact, value: number) {
  return fact.unit === 'gp' ? gp(value) : String(value);
}

/**
 * One compact comparison from the record's own before and final facts: a
 * signed change for numbers and gp, changed text, or an added or removed
 * subject. A missing starting value shows only the recorded result; nothing
 * is assumed to have been zero.
 */
export function headlineText(fact: FinishedWeekHeadlineFact): string {
  const { label, before, final } = fact;
  // Team, settlement and persistent-event keys name a subject; a null side
  // means the subject was absent.
  const subject = fact.key.includes(':');
  if (subject && fact.beforeRecorded && before === null)
    return `${label} added: ${text(fact, final)}`;
  if (subject && final === null) return `${label} removed`;
  if (fact.unit !== 'text' && typeof final === 'number') {
    if (fact.beforeRecorded && typeof before === 'number') {
      const change = final - before;
      return `${label} ${fact.unit === 'gp' ? signedGp(change) : signed(change)}`;
    }
    return `${label} ${amount(fact, final)}`;
  }
  if (!fact.beforeRecorded) return `${label}: ${text(fact, final)}`;
  return `${label}: ${text(fact, before)} → ${text(fact, final)}`;
}

// Corrected (more than one audit entry) takes precedence; From setup marks
// only an uncorrected reconstruction.
function provenanceBadge(row: FinishedWeekList['weeks'][number]) {
  if (row.entryCount > 1) return 'Corrected';
  if (row.provenance === 'historical_reconstruction') return 'From setup';
  return null;
}

/**
 * Up to three latest finished weeks, latest first as listed. Corrected (more
 * than one audit entry) takes precedence over From setup, which marks only an
 * uncorrected reconstruction.
 */
export function recentWeeks(
  campaignId: string,
  list: FinishedWeekList,
): RecentWeek[] {
  return list.weeks.slice(0, RECENT_WEEK_LIMIT).map((row) => {
    const headlines = row.headlineFacts
      .filter((fact) => fact.finalRecorded)
      .map(headlineText);
    return {
      week: row.week,
      href: historyPath(campaignId, { week: row.week }),
      badge: provenanceBadge(row),
      headlines: headlines.length ? headlines : [recordedOutcomeAvailable],
    };
  });
}
