'use client';

import { useState } from 'react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import type { HistorySelection } from '~/lib/campaign-routes';
import {
  earlierEntryLabel,
  provenanceLabels,
  recordDate,
  type FinishedWeek,
} from './finished-week-index';
import type {
  AuditPageView,
  AuditView,
  RulesetView,
} from './finished-weeks-types';
import type { AuditRow, HistoryRead } from './history-read';
import { useAuditOrdinal } from './use-audit-ordinal';
import {
  useWatchedQueries,
  useWatchedQuery,
  type Watched,
} from './use-watched-queries';

type AuditPage = { audit: AuditRow[]; earlierSequence: number | null };

/**
 * The shown week's audit entries: an "N entries" disclosure that pages five
 * newest-first entries at a time (the page lives in the address as
 * `beforeSequence`), Ruleset Versions read only for the visible page, and the
 * shown record's "Earlier entry X of N" status. The disclosure resets
 * whenever the week changes.
 */
export function useAuditTrail({
  campaignId,
  isEnabled,
  selection,
  select,
  shownWeek,
  read,
  effectiveRow,
}: {
  campaignId: Id<'campaign'>;
  isEnabled: boolean;
  selection: HistorySelection;
  select: (selection: HistorySelection) => void;
  shownWeek: number | null;
  read: HistoryRead | undefined;
  /** The listing row for the shown week, with the effective Ruleset. */
  effectiveRow: FinishedWeek | null;
}): { audit: AuditView | null; earlierEntry: string | null } {
  const isPaged = selection.beforeSequence !== undefined;
  const [disclosure, setDisclosure] = useState({
    week: shownWeek,
    isOpen: isPaged,
  });
  const [pageAttempt, setPageAttempt] = useState(0);
  const [rulesetAttempts, setRulesetAttempts] = useState<
    Record<string, number>
  >({});
  // Adjusted during render: a different week starts closed, unless its
  // address names an audit page.
  if (disclosure.week !== shownWeek)
    setDisclosure({ week: shownWeek, isOpen: isPaged });
  const isOpen = disclosure.week === shownWeek ? disclosure.isOpen : isPaged;

  // An older page is read on its own, so paging never reloads the record.
  const pageArgs =
    isEnabled && isOpen && read && isPaged
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
  const page: Watched<AuditPage | null> = isPaged
    ? pagedRead
    : read
      ? { status: 'ready', data: read }
      : { status: 'loading' };
  const visibleRows =
    isOpen && page.status === 'ready' ? (page.data?.audit ?? []) : [];

  const knownRuleset = (recordId: string) => {
    if (recordId === read?.record.recordId) return read.record.rulesetVersion;
    if (recordId === effectiveRow?.effectiveRecordId)
      return effectiveRow.rulesetVersion;
    return undefined;
  };
  const rulesetKey = (recordId: string) =>
    `ruleset:${read?.week}:${recordId}:${rulesetAttempts[recordId] ?? 0}`;
  const rulesets = useWatchedQueries(
    api.canonicalHistory.read,
    isEnabled && read
      ? visibleRows
          .filter((entry) => knownRuleset(entry.recordId) === undefined)
          .map((entry) => ({
            key: rulesetKey(entry.recordId),
            args: { campaignId, week: read.week, recordId: entry.recordId },
          }))
      : [],
  );

  const ordinal = useAuditOrdinal({
    campaignId,
    read,
    pageRows: pagedRead.status === 'ready' ? (pagedRead.data?.audit ?? []) : [],
  });

  if (!read) return { audit: null, earlierEntry: null };
  const newestEntry = read.audit[0];
  // The newest page starts with the effective entry: its sequence counts the chain.
  const entryCount =
    newestEntry?.recordId === read.effectiveRecordId
      ? newestEntry.sequence + 1
      : (effectiveRow?.entryCount ?? null);
  const isEffectiveShown = read.record.recordId === read.effectiveRecordId;
  const earlierEntry = isEffectiveShown
    ? null
    : earlierEntryLabel(ordinal.shownSequence, entryCount);
  if (entryCount === null || entryCount < 2)
    return { audit: null, earlierEntry };

  const rulesetFor = (recordId: string): RulesetView => {
    const known = knownRuleset(recordId);
    if (known !== undefined) return { status: 'ready', version: known };
    const result = rulesets[rulesetKey(recordId)];
    if (result?.status === 'loading') return { status: 'loading' };
    if (result?.status === 'ready' && result.data)
      return { status: 'ready', version: result.data.record.rulesetVersion };
    return {
      status: 'failed',
      retry: () =>
        setRulesetAttempts((current) => ({
          ...current,
          [recordId]: (current[recordId] ?? 0) + 1,
        })),
    };
  };
  const choose = (entry: AuditRow) => {
    ordinal.remember(read.week, entry);
    const isEffective = entry.recordId === read.effectiveRecordId;
    select({
      week: read.week,
      recordId: isEffective ? undefined : entry.recordId,
      beforeSequence: selection.beforeSequence,
    });
  };
  const pageView = ((): AuditPageView => {
    if (page.status === 'loading') return { status: 'loading' };
    if (page.status === 'failed' || page.data === null)
      return {
        status: 'failed',
        retry: () => setPageAttempt((value) => value + 1),
      };
    const { audit, earlierSequence } = page.data;
    return {
      status: 'ready',
      entries: audit.map((entry) => ({
        recordId: entry.recordId,
        label: `Entry ${entry.sequence + 1}`,
        provenance: provenanceLabels[entry.provenance],
        date: recordDate(entry.createdAt),
        ruleset: rulesetFor(entry.recordId),
        isSelected: entry.recordId === read.record.recordId,
        isEffective: entry.recordId === read.effectiveRecordId,
        select: () => choose(entry),
      })),
      // Paging keeps the selection as it is: an explicit entry stays pinned,
      // and the effective record is not turned into one.
      earlier:
        earlierSequence === null
          ? null
          : () =>
              select({
                week: read.week,
                recordId: selection.recordId,
                beforeSequence: earlierSequence,
              }),
    };
  })();

  return {
    earlierEntry,
    audit: {
      entryCount,
      isOpen,
      toggle: () => {
        setDisclosure({ week: read.week, isOpen: !isOpen });
        // Reopening starts again from the newest entries.
        if (!isOpen && isPaged)
          select({ week: read.week, recordId: selection.recordId });
      },
      page: pageView,
    },
  };
}
