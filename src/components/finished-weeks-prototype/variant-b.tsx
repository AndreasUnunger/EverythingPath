'use client';
// PROTOTYPE — Variant B "Reader": one week at a time, outcome first. A wide
// header with previous/next and Jump to week, an entries strip only when the
// week was corrected, then the Result and Table Adjustments before the four
// phases, with the recorded context and militia facts in a sticky side panel.

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { cn } from '~/lib/utils';
import { currentWeek, phases, provenanceLabels } from './mock';
import {
  AdjustmentsSection,
  Chip,
  isEffective,
  MilitiaThenNow,
  PhaseSection,
  ProvenanceLine,
  ReadOnlyNote,
  ResultTable,
  shortDate,
  type RecordProps,
} from './parts';

export const name = 'Reader: outcome first, arrows and jump, facts aside';

export function VariantB({ weeks, record, entry, select }: RecordProps) {
  const i = weeks.findIndex((w) => w.week === record.week);
  const prev = weeks[i - 1];
  const next = weeks[i + 1];
  return (
    <div className="flex flex-1 flex-col gap-3">
      <header className="flex items-center gap-3">
        <Button
          variant="outline"
          size="lg"
          disabled={!prev}
          onClick={() => prev && select({ week: prev.week })}
        >
          <ChevronLeft /> {prev ? `Week ${prev.week}` : 'First week'}
        </Button>
        <div className="flex flex-1 flex-col items-center">
          <h1 className="text-2xl font-semibold">Week {record.week}</h1>
          <ProvenanceLine record={record} entry={entry} />
        </div>
        <Select
          value={`${record.week}`}
          onValueChange={(v) => select({ week: Number(v) })}
        >
          <SelectTrigger className="w-60" aria-label="Jump to week">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[...weeks].reverse().map((w) => (
              <SelectItem key={w.week} value={`${w.week}`}>
                Week {w.week} · {w.headline[0]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="lg"
          disabled={!next}
          onClick={() => next && select({ week: next.week })}
        >
          {next ? `Week ${next.week}` : `Week ${currentWeek} in progress`}{' '}
          <ChevronRight />
        </Button>
      </header>

      {record.entries.length > 1 && (
        <nav
          aria-label="Entries for this week"
          className="flex items-center gap-2 text-sm"
        >
          <span className="text-muted-foreground text-xs tracking-widest uppercase">
            Corrected {record.entries.length - 1}×
          </span>
          <ol className="flex flex-wrap gap-1">
            {record.entries.map((e) => {
              const current = e.recordId === entry.recordId;
              const eff = isEffective(record, e);
              return (
                <li key={e.recordId}>
                  <button
                    aria-pressed={current}
                    onClick={() =>
                      select({
                        week: record.week,
                        recordId: eff ? undefined : e.recordId,
                      })
                    }
                    className={cn(
                      'border-foreground/30 flex min-h-9 items-center gap-2 border px-3 text-sm',
                      current &&
                        'bg-primary text-primary-foreground border-primary',
                    )}
                  >
                    <span>
                      {e.sequence + 1} · {provenanceLabels[e.provenance]}
                    </span>
                    <span className={cn(current ? 'opacity-80' : 'text-muted-foreground')}>
                      {shortDate(e.recordedAt)}
                    </span>
                    {e.note && (
                      <span className={cn('font-serif', current ? 'opacity-80' : 'text-muted-foreground')}>
                        “{e.note}”
                      </span>
                    )}
                    {eff && <Chip tone={current ? 'muted' : 'change'}>effective</Chip>}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      <div className="flex flex-1 gap-4">
        <div className="min-w-0 flex-1 space-y-4">
          <ResultTable
            record={record}
            title={`What week ${record.week} changed`}
          />
          <AdjustmentsSection record={record} />
          {phases.map((p, i) => (
            <PhaseSection key={p} record={record} phase={p} n={i + 1} />
          ))}
          <ReadOnlyNote />
        </div>
        <aside className="sticky top-3 w-64 shrink-0 space-y-3 self-start">
          <section
            aria-label="Militia at confirmation"
            className="bg-card border-foreground/20 border p-3"
          >
            <h2 className="text-muted-foreground mb-2 text-xs tracking-widest uppercase">
              Militia · at confirmation → after
            </h2>
            <MilitiaThenNow record={record} />
          </section>
          <section
            aria-label="Recorded context"
            className="bg-card border-foreground/20 border p-3"
          >
            <h2 className="text-muted-foreground mb-2 text-xs tracking-widest uppercase">
              Recorded context
            </h2>
            <ul className="space-y-1 text-sm">
              {record.context.map((c) => (
                <li key={c}>{c}</li>
              ))}
              <li className="text-muted-foreground">
                Officers after: {record.roster}
              </li>
            </ul>
          </section>
          <section
            aria-label="Carried into next week"
            className="bg-card border-foreground/20 border p-3"
          >
            <h2 className="text-muted-foreground mb-2 text-xs tracking-widest uppercase">
              Carried into week {record.week + 1}
            </h2>
            {record.queued.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing queued.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {record.queued.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
