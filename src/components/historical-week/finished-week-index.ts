import type { FunctionReturnType } from 'convex/server';
import type { api } from '../../../convex/_generated/api';
import {
  gp,
  signed,
  signedGp,
  words,
} from '~/components/week-review/review-text';

// Pure derivation for the Finished weeks index: merging listing windows into
// one oldest-first list, marking omitted ranges, and wording each row's
// recorded headlines, marker and date. Nothing here reads live state or rules.

export type FinishedWeekListing = FunctionReturnType<
  typeof api.canonicalHistory.list
>;
export type FinishedWeek = FinishedWeekListing['weeks'][number];
export type HeadlineFact = FinishedWeek['headlineFacts'][number];

/** One loaded page of the listing; `beforeWeek` null is the newest page. */
export type ListWindow = {
  beforeWeek: number | null;
  listing: FinishedWeekListing;
};

export type WeekIndexItem =
  | { kind: 'week'; row: FinishedWeek }
  /** Recorded weeks older than the row below are not loaded yet. */
  | { kind: 'earlier'; beforeWeek: number };

type Segment = { lo: number; hi: number };

// A window holds every recorded week from its oldest row up to (not including)
// its boundary. Without an older page it reaches back to week zero.
function coverage({ beforeWeek, listing }: ListWindow): Segment {
  return {
    lo: listing.earlierWeek ?? 0,
    hi: beforeWeek ?? Number.POSITIVE_INFINITY,
  };
}

function segments(windows: ListWindow[]): Segment[] {
  const sorted = windows.map(coverage).sort((a, b) => a.lo - b.lo);
  const merged: Segment[] = [];
  for (const segment of sorted) {
    const last = merged[merged.length - 1];
    if (last && segment.lo <= last.hi) last.hi = Math.max(last.hi, segment.hi);
    else merged.push({ ...segment });
  }
  return merged;
}

export function isWeekCovered(windows: ListWindow[], week: number): boolean {
  return windows
    .map(coverage)
    .some((segment) => segment.lo <= week && week < segment.hi);
}

/**
 * Loaded windows, plus a selected row fetched on its own, as one oldest-first
 * list. Rows repeated across windows merge by week, keeping the newest
 * effective entry. Each omitted older range gets one control, placed above the
 * oldest row of the loaded range it borders.
 */
export function buildWeekIndex(
  windows: ListWindow[],
  pinned: FinishedWeek | null,
): WeekIndexItem[] {
  const byWeek = new Map<number, FinishedWeek>();
  const rows = [
    ...windows.flatMap(({ listing }) => listing.weeks),
    ...(pinned ? [pinned] : []),
  ];
  for (const row of rows) {
    const known = byWeek.get(row.week);
    if (!known || row.effectiveSequence > known.effectiveSequence)
      byWeek.set(row.week, row);
  }
  const controls = new Set(
    segments(windows)
      .filter((segment) => segment.lo > 0)
      .map((segment) => segment.lo),
  );
  return [...byWeek.values()]
    .sort((a, b) => a.week - b.week)
    .flatMap((row): WeekIndexItem[] =>
      controls.has(row.week)
        ? [
            { kind: 'earlier', beforeWeek: row.week },
            { kind: 'week', row },
          ]
        : [{ kind: 'week', row }],
    );
}

function valueText(value: HeadlineFact['final'], unit: HeadlineFact['unit']) {
  if (value === null) return 'None';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return unit === 'gp' ? gp(value) : `${value}`;
  return words(value);
}

/**
 * One recorded comparison as a short phrase. Numbers become signed changes; a
 * missing starting value shows only the recorded outcome, never a change from
 * an assumed zero. Subjects (keyed `family:id`) are added or removed.
 */
export function headlineText(fact: HeadlineFact): string | null {
  const { label, before, final, unit } = fact;
  if (!fact.finalRecorded) return null;
  if (!fact.beforeRecorded) return `${label} now ${valueText(final, unit)}`;
  if (
    typeof before === 'number' &&
    typeof final === 'number' &&
    unit !== 'text'
  )
    return `${label} ${unit === 'gp' ? signedGp(final - before) : signed(final - before)}`;
  const subject = fact.key.includes(':');
  if (subject && before === null && final !== null) return `${label} added`;
  if (subject && before !== null && final === null) return `${label} removed`;
  return `${label} ${valueText(before, unit)} → ${valueText(final, unit)}`;
}

export const recordedOutcomeAvailable = 'Recorded outcome available';

/** Up to two headline phrases; a record without comparable facts says so. */
export function rowHeadlines(row: FinishedWeek): string[] {
  const phrases = row.headlineFacts
    .map(headlineText)
    .filter((phrase): phrase is string => phrase !== null)
    .slice(0, 2);
  return phrases.length > 0 ? phrases : [recordedOutcomeAvailable];
}

export const provenanceLabels: Record<FinishedWeek['provenance'], string> = {
  confirmation: 'Confirmed week',
  historical_reconstruction: 'Historical reconstruction',
  historical_correction: 'Historical correction',
};

export function rowMarker(row: FinishedWeek): string | null {
  if (row.entryCount > 1) return `Corrected · ${row.entryCount} entries`;
  if (row.provenance === 'historical_reconstruction') return 'From setup';
  return null;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

/** When the record was stored: for `<time dateTime>` and for reading. */
export function recordDate(createdAt: number) {
  return {
    dateTime: new Date(createdAt).toISOString(),
    label: dateFormat.format(createdAt),
  };
}

export function earlierEntryLabel(
  sequence: number | null,
  entryCount: number | null,
) {
  return sequence === null || entryCount === null
    ? 'Earlier entry'
    : `Earlier entry ${sequence + 1} of ${entryCount}`;
}
