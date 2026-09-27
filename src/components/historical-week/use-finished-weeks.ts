'use client';

import { useEffect, useState } from 'react';
import { useConvex } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import type { CampaignWeek } from '~/components/campaign-home/use-campaign-week';
import type { CanonicalResolutionRecord } from '~/lib/canonical-resolution-record';
import { historyPath, type HistorySelection } from '~/lib/campaign-routes';
import { locateAuditSequence } from './audit-ordinal';
import {
  buildWeekIndex,
  earlierEntryLabel,
  isWeekCovered,
  provenanceLabels,
  recordDate,
  rowHeadlines,
  rowMarker,
  type FinishedWeek,
  type ListWindow,
} from './finished-week-index';
import {
  useWatchedQueries,
  useWatchedQuery,
  type Watched,
} from './use-watched-queries';

type HistoryRead = NonNullable<
  FunctionReturnType<typeof api.canonicalHistory.read>
>;
type AuditRow = HistoryRead['audit'][number];

export type RecordDate = ReturnType<typeof recordDate>;

export type WeekRowView = {
  kind: 'week';
  week: number;
  href: string;
  selected: boolean;
  /** The newest finished week, always the bottom row. */
  latest: boolean;
  date: RecordDate;
  headlines: string[];
  /** "Corrected · N entries" or "From setup". */
  marker: string | null;
  /** Call from the row link's click; the latest row restores the newest window. */
  onNavigate?: () => void;
};
export type EarlierWeeksView = {
  kind: 'earlier';
  beforeWeek: number;
  /** Loading, or failed to load; `load` then tries again. */
  status: 'idle' | 'loading' | 'failed';
  load: () => void;
};
export type IndexItemView = WeekRowView | EarlierWeeksView;

export type IndexView =
  | { status: 'loading' }
  | { status: 'failed'; retry: () => void }
  | { status: 'ready'; items: IndexItemView[] };

export type RulesetView =
  | { status: 'loading' }
  | { status: 'failed'; retry: () => void }
  | { status: 'ready'; version: number };

export type AuditEntryView = {
  recordId: string;
  /** "Entry 3" */
  label: string;
  provenance: string;
  date: RecordDate;
  ruleset: RulesetView;
  /** The record shown in the detail. */
  selected: boolean;
  effective: boolean;
  select: () => void;
};

export type AuditView = {
  entryCount: number;
  open: boolean;
  toggle: () => void;
  page:
    | { status: 'loading' }
    | { status: 'failed'; retry: () => void }
    | {
        status: 'ready';
        entries: AuditEntryView[];
        /** Loads the next five older entries; null on the oldest page. */
        earlier: (() => void) | null;
      };
};

export type WeekLink = { week: number; href: string } | null;

export type RecordPaneView = {
  week: number;
  record: CanonicalResolutionRecord;
  provenance: string;
  date: RecordDate;
  rulesetVersion: number;
  /** "Earlier entry 2 of 5" when an earlier audit entry is shown. */
  earlierEntry: string | null;
  previous: WeekLink;
  next: WeekLink;
  /** Null for a week with a single entry. */
  audit: AuditView | null;
};

export type PaneView =
  | { status: 'loading' }
  | { status: 'failed'; retry: () => void; effectiveHref: string | null }
  | { status: 'unavailable'; week: number; latestHref: string }
  | { status: 'ready'; pane: RecordPaneView };

export type FinishedWeeksView =
  | { status: 'no-militia'; setupHref: string }
  | { status: 'loading' }
  | { status: 'failed'; retry: () => void }
  | { status: 'empty'; openWeek: number | null; weekHref: string }
  | {
      status: 'ready';
      index: IndexView;
      pane: PaneView;
      /** The week shown, highlighted in the index. */
      selectedWeek: number | null;
      /** The open week, for "Week N is in progress." */
      inProgressWeek: number | null;
    };

const anchorName = (beforeWeek: number | null) => `${beforeWeek ?? 'newest'}`;

/**
 * Finished weeks for one campaign: the oldest-first index built from bounded
 * listing windows, the selected immutable record, and its paged audit entries.
 * Mount it keyed by campaign so no state or late result crosses campaigns.
 * Selection lives in the address; audit disclosure is local and resets on a
 * week change.
 */
export function useFinishedWeeks({
  campaignId,
  selection,
  select,
  campaignWeek,
  campaignHref,
}: {
  campaignId: Id<'campaign'>;
  selection: HistorySelection;
  select: (selection: HistorySelection) => void;
  campaignWeek: CampaignWeek;
  campaignHref: { week: string; setup: string };
}): FinishedWeeksView {
  const convex = useConvex();
  // A campaign without a militia has no history; its reads would only fail.
  const enabled = campaignWeek.kind !== 'not_set_up';
  const [listAttempts, setListAttempts] = useState<Record<string, number>>({});
  const [readAttempt, setReadAttempt] = useState(0);
  const [pageAttempt, setPageAttempt] = useState(0);
  const [metaAttempts, setMetaAttempts] = useState<Record<string, number>>({});
  const [anchors, setAnchors] = useState<number[]>([]);
  const [disclosure, setDisclosure] = useState<{
    week: number | null;
    open: boolean;
  }>({ week: null, open: selection.beforeSequence !== undefined });
  const [remembered, setRemembered] = useState<Record<string, number>>({});
  const [located, setLocated] = useState<{
    key: string;
    sequence: number | null;
  } | null>(null);

  // Listing windows: the newest page always, older pages on request or for a
  // directly linked week outside them.
  const windowAnchors = [null, ...anchors];
  const listKey = (beforeWeek: number | null) =>
    `list:${anchorName(beforeWeek)}:${listAttempts[anchorName(beforeWeek)] ?? 0}`;
  const windowResults = useWatchedQueries(
    api.canonicalHistory.list,
    enabled
      ? windowAnchors.map((beforeWeek) => ({
          key: listKey(beforeWeek),
          args:
            beforeWeek === null ? { campaignId } : { campaignId, beforeWeek },
        }))
      : [],
  );
  const windowResult = (beforeWeek: number | null) =>
    windowResults[listKey(beforeWeek)] ?? { status: 'loading' };
  // Only failed windows are read again; loaded ones stay on screen.
  const retryList = () =>
    setListAttempts((current) => {
      const next = { ...current };
      for (const beforeWeek of windowAnchors)
        if (windowResult(beforeWeek).status === 'failed')
          next[anchorName(beforeWeek)] =
            (next[anchorName(beforeWeek)] ?? 0) + 1;
      return next;
    });
  const newest = windowResult(null);
  const windows: ListWindow[] = windowAnchors.flatMap((beforeWeek) => {
    const result = windowResult(beforeWeek);
    return result.status === 'ready'
      ? [{ beforeWeek, listing: result.data }]
      : [];
  });
  const windowsSettled = windowAnchors.every(
    (beforeWeek) => windowResult(beforeWeek).status !== 'loading',
  );
  const explicitWeek = selection.week;
  // A deep link loads the window ending at its week rather than every page in
  // between; the gap above it keeps its own load-more control.
  if (
    enabled &&
    explicitWeek !== undefined &&
    newest.status === 'ready' &&
    windowsSettled &&
    !isWeekCovered(windows, explicitWeek) &&
    !anchors.includes(explicitWeek + 1)
  )
    setAnchors([...anchors, explicitWeek + 1]);

  const listed = windows
    .flatMap(({ listing }) => listing.weeks)
    .find((row) => row.week === explicitWeek);
  const selectedListing = useWatchedQuery(
    api.canonicalHistory.list,
    `selected:${explicitWeek}:${listAttempts[anchorName(null)] ?? 0}`,
    enabled && explicitWeek !== undefined && !listed
      ? { campaignId, selectedWeek: explicitWeek, limit: 1 }
      : null,
  );
  const pinned =
    selectedListing.status === 'ready' ? selectedListing.data.selected : null;

  // The selected record. Audit paging is read separately, so paging never
  // reloads or replaces the record on screen.
  const detailArgs = {
    campaignId,
    week: selection.week,
    recordId: selection.recordId,
  };
  const detail = useWatchedQuery(
    api.canonicalHistory.read,
    `read:${JSON.stringify(detailArgs)}:${readAttempt}`,
    enabled ? detailArgs : null,
  );
  const read = detail.status === 'ready' ? detail.data : undefined;
  const latestRow =
    newest.status === 'ready' ? (newest.data.weeks[0] ?? null) : null;
  const selectedWeek = explicitWeek ?? read?.week ?? latestRow?.week ?? null;

  if (selectedWeek !== null && disclosure.week !== selectedWeek)
    setDisclosure({
      week: selectedWeek,
      open: selection.beforeSequence !== undefined,
    });
  const auditOpen =
    disclosure.week === selectedWeek
      ? disclosure.open
      : selection.beforeSequence !== undefined;

  const pageArgs =
    enabled && auditOpen && read && selection.beforeSequence !== undefined
      ? {
          campaignId,
          week: read.week,
          beforeSequence: selection.beforeSequence,
        }
      : null;
  const pagedRead = useWatchedQuery(
    api.canonicalHistory.read,
    `page:${JSON.stringify(pageArgs)}:${pageAttempt}`,
    pageArgs,
  );
  const auditPage: Watched<{
    audit: AuditRow[];
    earlierSequence: number | null;
  } | null> =
    selection.beforeSequence === undefined
      ? read
        ? { status: 'ready', data: read }
        : { status: 'loading' }
      : pagedRead;

  const selectedRow: FinishedWeek | null =
    windows
      .flatMap(({ listing }) => listing.weeks)
      .find((row) => row.week === read?.week) ??
    (pinned?.week === read?.week ? pinned : null);

  // Ruleset Versions for the visible entries the page does not already hold.
  const visible =
    auditOpen && auditPage.status === 'ready'
      ? (auditPage.data?.audit ?? [])
      : [];
  const knownRuleset = (recordId: string) =>
    recordId === read?.record.recordId
      ? read.record.rulesetVersion
      : recordId === selectedRow?.effectiveRecordId
        ? selectedRow.rulesetVersion
        : undefined;
  const metaKey = (recordId: string) =>
    `meta:${read?.week}:${recordId}:${metaAttempts[recordId] ?? 0}`;
  const metadata = useWatchedQueries(
    api.canonicalHistory.read,
    enabled && read
      ? visible
          .filter((entry) => knownRuleset(entry.recordId) === undefined)
          .map((entry) => ({
            key: metaKey(entry.recordId),
            args: { campaignId, week: read.week, recordId: entry.recordId },
          }))
      : [],
  );

  // The shown record's ordinal: from the pages on hand, a sequence remembered
  // when it was picked, or a bounded page-by-page search for a direct link.
  const effectiveId = read?.effectiveRecordId;
  const newestEntry = read?.audit[0];
  const entryCount =
    newestEntry && newestEntry.recordId === effectiveId
      ? newestEntry.sequence + 1
      : (selectedRow?.entryCount ?? null);
  const shownId = read?.record.recordId;
  const rememberKey = `${read?.week}:${shownId}`;
  const onPage = [
    ...(read?.audit ?? []),
    ...(pagedRead.status === 'ready' ? (pagedRead.data?.audit ?? []) : []),
  ].find((entry) => entry.recordId === shownId)?.sequence;
  const lookupKey =
    read &&
    shownId !== effectiveId &&
    onPage === undefined &&
    remembered[rememberKey] === undefined &&
    read.earlierSequence !== null
      ? JSON.stringify([campaignId, read.week, shownId, read.earlierSequence])
      : null;
  useEffect(() => {
    if (lookupKey === null) return;
    const [, week, recordId, from] = JSON.parse(lookupKey) as [
      string,
      number,
      string,
      number,
    ];
    const signal = { cancelled: false };
    locateAuditSequence(
      (beforeSequence) =>
        convex.query(api.canonicalHistory.read, {
          campaignId,
          week,
          beforeSequence,
        }),
      recordId,
      { from, signal },
    ).then(
      (sequence) => {
        if (!signal.cancelled) setLocated({ key: lookupKey, sequence });
      },
      () => {
        if (!signal.cancelled) setLocated({ key: lookupKey, sequence: null });
      },
    );
    return () => {
      signal.cancelled = true;
    };
  }, [convex, campaignId, lookupKey]);
  const shownSequence =
    onPage ??
    remembered[rememberKey] ??
    (located?.key === lookupKey ? located.sequence : null);

  if (!enabled) return { status: 'no-militia', setupHref: campaignHref.setup };
  const retryAll = () => {
    retryList();
    setReadAttempt((value) => value + 1);
  };
  if (detail.status === 'failed' && newest.status === 'failed')
    // Until the open week is known, a failure may only mean "no militia yet".
    return campaignWeek.kind === 'loading'
      ? { status: 'loading' }
      : { status: 'failed', retry: retryAll };
  if (detail.status === 'loading' && newest.status === 'loading')
    return { status: 'loading' };
  const openWeek = campaignWeek.kind === 'week' ? campaignWeek.week : null;
  if (
    (newest.status === 'ready' && newest.data.weeks.length === 0) ||
    (read === undefined &&
      detail.status === 'ready' &&
      explicitWeek === undefined)
  )
    return { status: 'empty', openWeek, weekHref: campaignHref.week };

  const hrefFor = (next: HistorySelection) => historyPath(campaignId, next);
  const index: IndexView =
    newest.status === 'failed'
      ? { status: 'failed', retry: retryList }
      : newest.status === 'loading'
        ? { status: 'loading' }
        : {
            status: 'ready',
            items: buildWeekIndex(windows, pinned).map(
              (item): IndexItemView => {
                if (item.kind === 'earlier') {
                  const requested = anchors.includes(item.beforeWeek);
                  const status = requested
                    ? windowResult(item.beforeWeek).status
                    : 'idle';
                  return {
                    kind: 'earlier',
                    beforeWeek: item.beforeWeek,
                    status: status === 'ready' ? 'idle' : status,
                    load: () =>
                      requested
                        ? retryList()
                        : setAnchors((current) =>
                            current.includes(item.beforeWeek)
                              ? current
                              : [...current, item.beforeWeek],
                          ),
                  };
                }
                const latest = item.row.week === latestRow?.week;
                return {
                  kind: 'week',
                  week: item.row.week,
                  href: hrefFor({ week: item.row.week }),
                  selected: item.row.week === selectedWeek,
                  latest,
                  date: recordDate(item.row.createdAt),
                  headlines: rowHeadlines(item.row),
                  marker: rowMarker(item.row),
                  onNavigate: latest ? () => setAnchors([]) : undefined,
                };
              },
            ),
          };

  const pane = ((): PaneView => {
    if (detail.status === 'loading') return { status: 'loading' };
    if (detail.status === 'failed')
      return {
        status: 'failed',
        retry: () => setReadAttempt((value) => value + 1),
        effectiveHref:
          selection.recordId === undefined
            ? null
            : hrefFor({ week: selection.week }),
      };
    if (!read)
      return {
        status: 'unavailable',
        week: explicitWeek ?? 0,
        latestHref: hrefFor({}),
      };
    const effective = read.record.recordId === read.effectiveRecordId;
    const weekLink = (week: number | null): WeekLink =>
      week === null ? null : { week, href: hrefFor({ week }) };
    const choose = (entry: AuditRow) => {
      setRemembered((current) => ({
        ...current,
        [`${read.week}:${entry.recordId}`]: entry.sequence,
      }));
      select(
        entry.recordId === read.effectiveRecordId
          ? { week: read.week, beforeSequence: selection.beforeSequence }
          : {
              week: read.week,
              recordId: entry.recordId,
              beforeSequence: selection.beforeSequence,
            },
      );
    };
    const rulesetFor = (recordId: string): RulesetView => {
      const known = knownRuleset(recordId);
      if (known !== undefined) return { status: 'ready', version: known };
      const result = metadata[metaKey(recordId)];
      if (result?.status === 'ready' && result.data)
        return { status: 'ready', version: result.data.record.rulesetVersion };
      if (result?.status === 'failed' || result?.status === 'ready')
        return {
          status: 'failed',
          retry: () =>
            setMetaAttempts((current) => ({
              ...current,
              [recordId]: (current[recordId] ?? 0) + 1,
            })),
        };
      return { status: 'loading' };
    };
    const page = ((): AuditView['page'] => {
      if (auditPage.status === 'loading') return { status: 'loading' };
      if (auditPage.status === 'failed' || auditPage.data === null)
        return {
          status: 'failed',
          retry: () => setPageAttempt((value) => value + 1),
        };
      const { audit, earlierSequence } = auditPage.data;
      return {
        status: 'ready',
        entries: audit.map((entry) => ({
          recordId: entry.recordId,
          label: `Entry ${entry.sequence + 1}`,
          provenance: provenanceLabels[entry.provenance],
          date: recordDate(entry.createdAt),
          ruleset: rulesetFor(entry.recordId),
          selected: entry.recordId === read.record.recordId,
          effective: entry.recordId === read.effectiveRecordId,
          select: () => choose(entry),
        })),
        earlier:
          earlierSequence === null
            ? null
            : () =>
                select({
                  week: read.week,
                  recordId: read.record.recordId,
                  beforeSequence: earlierSequence,
                }),
      };
    })();
    return {
      status: 'ready',
      pane: {
        week: read.week,
        record: read.record,
        provenance: provenanceLabels[read.record.provenance],
        date: recordDate(read.createdAt),
        rulesetVersion: read.record.rulesetVersion,
        earlierEntry: effective
          ? null
          : earlierEntryLabel(shownSequence, entryCount),
        previous: weekLink(read.previousWeek),
        next: weekLink(read.nextWeek),
        audit:
          entryCount === null || entryCount < 2
            ? null
            : {
                entryCount,
                open: auditOpen,
                toggle: () => {
                  setDisclosure({ week: read.week, open: !auditOpen });
                  // Reopening starts again from the newest entries.
                  if (!auditOpen && selection.beforeSequence !== undefined)
                    select({ week: read.week, recordId: selection.recordId });
                },
                page,
              },
      },
    };
  })();

  return {
    status: 'ready',
    index,
    pane,
    selectedWeek,
    inProgressWeek: openWeek,
  };
}
