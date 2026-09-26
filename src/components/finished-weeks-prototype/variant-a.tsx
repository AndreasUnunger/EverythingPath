'use client';
// PROTOTYPE — Variant A "Ledger": every finished week listed down the left,
// the chosen week's record on the right in exactly the Summary step's order
// (Upkeep, Activity, Event, Persistent, Table Adjustments, Result). Audit
// entries hide behind an "N entries" disclosure in the record header.

import { ChevronDown, ChevronLeft, ChevronRight, History } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import {
  currentWeek,
  effectiveEntry,
  phases,
  provenanceLabels,
} from './mock';
import {
  AdjustmentsSection,
  Chip,
  isEffective,
  PhaseSection,
  ProvenanceLine,
  ReadOnlyNote,
  ResultTable,
  shortDate,
  type RecordProps,
} from './parts';

export const name = 'Ledger: week list left, Summary order right';

export function VariantA({ weeks, record, entry, select }: RecordProps) {
  const [showEntries, setShowEntries] = useState(false);
  const i = weeks.findIndex((w) => w.week === record.week);
  const prev = weeks[i - 1];
  const next = weeks[i + 1];
  return (
    <div className="flex flex-1 gap-4">
      <nav
        aria-label="Finished weeks"
        className="sticky top-3 w-56 shrink-0 self-start"
      >
        <h2 className="text-muted-foreground mb-1 px-2 text-xs tracking-widest uppercase">
          Finished weeks
        </h2>
        <ol className="space-y-0.5">
          {weeks.map((w) => {
            const active = w.week === record.week;
            const eff = effectiveEntry(w);
            return (
              <li key={w.week}>
                <button
                  aria-current={active ? 'page' : undefined}
                  onClick={() => select({ week: w.week })}
                  className={cn(
                    'w-full space-y-0.5 border px-2 py-1.5 text-left',
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-transparent hover:border-foreground/25',
                  )}
                >
                  <span className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Week {w.week}</span>
                    <span
                      className={cn(
                        'text-xs',
                        active ? 'opacity-80' : 'text-muted-foreground',
                      )}
                    >
                      {shortDate(eff.recordedAt)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'block truncate text-xs',
                      active ? 'opacity-80' : 'text-muted-foreground',
                    )}
                  >
                    {w.headline.slice(0, 2).join(' · ')}
                  </span>
                  {(w.entries.length > 1 ||
                    eff.provenance !== 'confirmation') && (
                    <span
                      className={cn(
                        'flex items-center gap-1 text-xs',
                        active ? 'opacity-80' : 'text-muted-foreground',
                      )}
                    >
                      <History className="size-3" />
                      {w.entries.length > 1
                        ? `corrected · ${w.entries.length} entries`
                        : 'reconstructed'}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
        <p className="text-muted-foreground mt-2 px-2 text-xs">
          Week {currentWeek} is in progress.
        </p>
      </nav>

      <article className="min-w-0 flex-1 space-y-4">
        <header className="space-y-2">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <h1 className="text-2xl font-semibold">Week {record.week}</h1>
              <ProvenanceLine record={record} entry={entry} />
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {record.entries.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  aria-expanded={showEntries}
                  onClick={() => setShowEntries(!showEntries)}
                >
                  <History /> {record.entries.length} entries{' '}
                  <ChevronDown
                    className={cn('transition', showEntries && 'rotate-180')}
                  />
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                aria-label="Previous week"
                disabled={!prev}
                onClick={() => prev && select({ week: prev.week })}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Next week"
                disabled={!next}
                onClick={() => next && select({ week: next.week })}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
          {showEntries && (
            <ol
              aria-label="Entries for this week"
              className="bg-card border-foreground/20 divide-foreground/10 divide-y border"
            >
              {[...record.entries].reverse().map((e) => {
                const current = e.recordId === entry.recordId;
                const eff = isEffective(record, e);
                return (
                  <li key={e.recordId}>
                    <button
                      aria-current={current ? 'true' : undefined}
                      onClick={() =>
                        select({
                          week: record.week,
                          recordId: eff ? undefined : e.recordId,
                        })
                      }
                      className={cn(
                        'flex w-full flex-wrap items-baseline gap-2 px-3 py-2 text-left text-sm',
                        current && 'bg-foreground/5',
                      )}
                    >
                      <span className="text-muted-foreground w-14 font-mono text-xs">
                        Entry {e.sequence + 1}
                      </span>
                      <span className="font-medium">
                        {provenanceLabels[e.provenance]}
                      </span>
                      <span className="text-muted-foreground">
                        {shortDate(e.recordedAt)} · Ruleset {e.rulesetVersion}
                      </span>
                      {e.note && (
                        <span className="text-muted-foreground font-serif">
                          “{e.note}”
                        </span>
                      )}
                      {eff && <Chip tone="change">effective</Chip>}
                      {current && !eff && <Chip tone="warn">showing</Chip>}
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </header>

        {phases.map((p, i) => (
          <PhaseSection key={p} record={record} phase={p} n={i + 1} />
        ))}
        <AdjustmentsSection record={record} n={5} />
        <ResultTable record={record} n={6} />
        <ReadOnlyNote />
      </article>
    </div>
  );
}
