'use client';
// PROTOTYPE — Variant C "Timeline": a strip of week tiles across the top
// (latest selected, the in-progress week greyed at the end), then the record
// as one flat ledger table in rules order, with each item's exception,
// outcome and warning as indented sub-rows, Table Adjustments as their own
// group, and the Result rows closing the table. Audit entries sit in a
// "Record" dropdown in the header.

import { AlertTriangle, History } from 'lucide-react';
import { Fragment } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { cn } from '~/lib/utils';
import {
  currentWeek,
  effectiveEntry,
  phaseLabels,
  phases,
  provenanceLabels,
} from './mock';
import {
  Chip,
  ContextChips,
  isEffective,
  longDate,
  ReadOnlyNote,
  shortDate,
  type RecordProps,
} from './parts';

export const name = 'Timeline: week tiles on top, one ledger table';

function GroupRow({
  n,
  label,
  right,
}: {
  n: number | string;
  label: string;
  right?: React.ReactNode;
}) {
  return (
    <tr className="bg-foreground/5">
      <th colSpan={4} className="py-1.5 pr-2 pl-2 text-left" scope="rowgroup">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">
            <span className="text-muted-foreground mr-2 font-mono">{n}</span>
            {label}
          </span>
          <span className="font-normal">{right}</span>
        </span>
      </th>
    </tr>
  );
}

export function VariantC({ weeks, record, entry, select }: RecordProps) {
  const changed = record.rows.filter(
    (r) => r.before !== r.final || r.baseline !== r.final,
  );
  return (
    <div className="flex flex-1 flex-col gap-3">
      <nav aria-label="Finished weeks" className="-mx-5 overflow-x-auto px-5">
        <ol className="flex gap-2">
          {weeks.map((w) => {
            const active = w.week === record.week;
            const eff = effectiveEntry(w);
            return (
              <li key={w.week} className="shrink-0">
                <button
                  aria-current={active ? 'page' : undefined}
                  onClick={() => select({ week: w.week })}
                  className={cn(
                    'flex h-full w-40 flex-col gap-1 border p-2 text-left',
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-foreground/25 bg-card hover:border-foreground/50',
                  )}
                >
                  <span className="flex items-baseline justify-between">
                    <span className="font-semibold">Week {w.week}</span>
                    <span
                      className={cn(
                        'text-xs',
                        active ? 'opacity-80' : 'text-muted-foreground',
                      )}
                    >
                      {shortDate(eff.recordedAt)}
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {w.headline.slice(0, 3).map((h) => (
                      <Chip
                        key={h}
                        tone={active ? 'muted' : 'change'}
                        className={cn(active && 'border-current text-current opacity-90')}
                      >
                        {h}
                      </Chip>
                    ))}
                  </span>
                  {(w.entries.length > 1 ||
                    eff.provenance !== 'confirmation') && (
                    <span
                      className={cn(
                        'mt-auto flex items-center gap-1 text-xs',
                        active ? 'opacity-80' : 'text-muted-foreground',
                      )}
                    >
                      <History className="size-3" />
                      {w.entries.length > 1
                        ? `${w.entries.length} entries`
                        : 'reconstructed'}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          <li className="shrink-0">
            <div className="border-foreground/15 text-muted-foreground flex h-full w-40 flex-col justify-center border border-dashed p-2 text-sm">
              <span className="font-semibold">Week {currentWeek}</span>
              <span className="text-xs">in progress · open the Week tab</span>
            </div>
          </li>
        </ol>
      </nav>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Week {record.week}</h1>
        <Select
          value={entry.recordId}
          onValueChange={(v) =>
            select({
              week: record.week,
              recordId:
                v === effectiveEntry(record).recordId ? undefined : v,
            })
          }
        >
          <SelectTrigger className="w-auto" aria-label="Record">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[...record.entries].reverse().map((e) => (
              <SelectItem key={e.recordId} value={e.recordId}>
                {provenanceLabels[e.provenance]} · {longDate(e.recordedAt)} ·
                Ruleset {e.rulesetVersion}
                {isEffective(record, e)
                  ? ' · effective'
                  : ` · entry ${e.sequence + 1}`}
                {e.note ? ` · “${e.note}”` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!isEffective(record, entry) && (
          <Chip tone="warn">
            Earlier entry {entry.sequence + 1} of {record.entries.length}
          </Chip>
        )}
        <div className="ml-auto">
          <ContextChips record={record} />
        </div>
      </header>

      <table className="bg-card border-foreground/20 w-full border text-sm">
        <thead className="text-muted-foreground text-xs tracking-widest uppercase">
          <tr className="border-foreground/20 border-b">
            <th className="w-1/2 py-1.5 pl-2 text-left font-normal">
              What happened
            </th>
            <th className="py-1.5 text-left font-normal">Check</th>
            <th className="py-1.5 text-right font-normal">Change</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {phases.map((p, i) => (
            <Fragment key={p}>
              <GroupRow
                n={i + 1}
                label={phaseLabels[p]}
                right={
                  <span className="flex flex-wrap justify-end gap-1">
                    {record.phaseDelta[p].map((d) => (
                      <Chip key={d} tone="change">
                        {d}
                      </Chip>
                    ))}
                  </span>
                }
              />
              {record.consequences
                .filter((c) => c.phase === p)
                .map((c) => {
                  const warnings = record.warnings.filter(
                    (w) => w.itemId === c.id,
                  );
                  const exceptions = record.exceptions.filter(
                    (x) => x.itemId === c.id,
                  );
                  const outcomes = record.outcomes.filter(
                    (o) => o.itemId === c.id,
                  );
                  return (
                    <Fragment key={c.id}>
                      <tr className="border-foreground/10 border-t">
                        <td className="py-1 pl-2">{c.text}</td>
                        <td className="text-muted-foreground py-1">
                          {c.detail}
                        </td>
                        <td className="py-1 text-right">
                          {c.delta && <Chip tone="change">{c.delta}</Chip>}
                        </td>
                        <td />
                      </tr>
                      {warnings.map((w) => (
                        <tr key={w.code}>
                          <td colSpan={4} className="py-0.5 pl-8 text-amber-300">
                            <AlertTriangle className="mr-1 inline size-3.5" />
                            {w.message}
                          </td>
                        </tr>
                      ))}
                      {exceptions.map((x) => (
                        <tr key={x.exceptionId}>
                          <td colSpan={4} className="py-0.5 pl-8">
                            <Chip tone="warn">{x.rule}</Chip>{' '}
                            <span className="text-muted-foreground text-xs">
                              Rules Exception{' '}
                            </span>
                            <span className="font-serif">“{x.reason}”</span>
                          </td>
                        </tr>
                      ))}
                      {outcomes.map((o) => (
                        <tr key={o.acknowledgementId}>
                          <td colSpan={4} className="py-0.5 pl-8">
                            <span className="text-muted-foreground text-xs">
                              Recorded outcome ·{' '}
                            </span>
                            <span className="font-serif">{o.outcome}</span>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              {record.warnings
                .filter((w) => w.phase === p && !w.itemId)
                .map((w) => (
                  <tr key={w.code}>
                    <td colSpan={4} className="py-0.5 pl-8 text-amber-300">
                      <AlertTriangle className="mr-1 inline size-3.5" />
                      {w.message}
                    </td>
                  </tr>
                ))}
            </Fragment>
          ))}

          <GroupRow
            n={5}
            label={`Table Adjustments · ${record.adjustments.length}`}
            right={
              record.adjustments.length > 0 && (
                <span className="text-muted-foreground text-xs normal-case tracking-normal">
                  in this order
                </span>
              )
            }
          />
          {record.adjustments.length === 0 ? (
            <tr>
              <td colSpan={4} className="text-muted-foreground py-1 pl-2">
                No Table Adjustments. The Final outcome equals the Rules
                Baseline.
              </td>
            </tr>
          ) : (
            record.adjustments.map((a, i) => (
              <tr key={a.adjustmentId} className="border-foreground/10 border-t">
                <td className="py-1 pl-2">
                  <span className="text-muted-foreground mr-2 font-mono">
                    {i + 1}
                  </span>
                  {a.kind}
                </td>
                <td className="py-1 font-serif">“{a.reason}”</td>
                <td className="py-1 text-right">
                  <Chip tone="table">{a.effect}</Chip>
                </td>
                <td />
              </tr>
            ))
          )}

          <GroupRow
            n={6}
            label={`Result · week ${record.week + 1} began`}
            right={
              <span className="text-muted-foreground text-xs tracking-widest uppercase">
                At confirmation → Baseline → Final
              </span>
            }
          />
          {changed.map((r) => (
            <tr key={r.key} className="border-foreground/10 border-t">
              <td className="py-1 pl-2">
                <span className="text-muted-foreground text-xs">
                  {r.group} ·{' '}
                </span>
                {r.label}
              </td>
              <td className="text-muted-foreground py-1 font-mono">
                {r.before} → {r.baseline}
              </td>
              <td
                className={cn(
                  'py-1 text-right font-mono',
                  r.baseline !== r.final && 'font-semibold text-sky-300',
                )}
              >
                {r.final}
              </td>
              <td />
            </tr>
          ))}
          {record.queued.map((q) => (
            <tr key={q}>
              <td colSpan={4} className="text-muted-foreground py-0.5 pl-8">
                Carried into week {record.week + 1}: {q}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ReadOnlyNote />
    </div>
  );
}
