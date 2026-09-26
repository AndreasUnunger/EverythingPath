'use client';
// PROTOTYPE — read-only pieces shared by the Finished weeks variants: chips,
// section titles, a recorded item with its Rules Exception, recorded outcome
// and warning under it, the Table Adjustments section, the Result table, and
// the provenance/read-only lines.

import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import {
  currentWeek,
  effectiveEntry,
  phaseLabels,
  provenanceLabels,
  type Consequence,
  type Entry,
  type Phase,
  type WeekRecord,
} from './mock';

export type Selection = { week: number; recordId?: string };
export type RecordProps = {
  weeks: WeekRecord[];
  record: WeekRecord;
  entry: Entry;
  select: (s: Selection) => void;
};

export const isEffective = (record: WeekRecord, entry: Entry) =>
  effectiveEntry(record).recordId === entry.recordId;

export const shortDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};
export const longDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export function Chip({
  children,
  tone = 'muted',
  className,
}: {
  children: React.ReactNode;
  tone?: 'muted' | 'change' | 'warn' | 'table';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-xs whitespace-nowrap',
        tone === 'muted' && 'border-foreground/20 text-muted-foreground',
        tone === 'change' && 'border-foreground/40 text-foreground',
        tone === 'warn' && 'border-amber-300/60 text-amber-300',
        tone === 'table' && 'border-sky-300/60 text-sky-300',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionTitle({
  n,
  children,
  count,
  right,
}: {
  n?: number | string;
  children: React.ReactNode;
  count?: number;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        {n !== undefined && (
          <span className="text-muted-foreground font-mono">{n}</span>
        )}
        {children}
        {count !== undefined && (
          <span className="text-muted-foreground font-mono text-sm">
            {count}
          </span>
        )}
      </h3>
      {right}
    </div>
  );
}

/** One recorded consequence; its exception, outcome and warning sit under it. */
export function RecordItem({
  c,
  record,
}: {
  c: Consequence;
  record: WeekRecord;
}) {
  const exceptions = record.exceptions.filter((x) => x.itemId === c.id);
  const outcomes = record.outcomes.filter((o) => o.itemId === c.id);
  const warnings = record.warnings.filter((w) => w.itemId === c.id);
  const under = exceptions.length + outcomes.length + warnings.length > 0;
  return (
    <li className="space-y-1 py-1.5">
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 text-sm">
          {c.text}
          {c.detail && (
            <span className="text-muted-foreground"> · {c.detail}</span>
          )}
        </span>
        {c.delta && <Chip tone="change">{c.delta}</Chip>}
      </div>
      {under && (
        <ul className="space-y-1 pl-4">
          {warnings.map((w) => (
            <li
              key={w.code}
              className="flex items-start gap-1.5 text-sm text-amber-300"
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>{w.message}</span>
            </li>
          ))}
          {exceptions.map((x) => (
            <li
              key={x.exceptionId}
              className="border-foreground/20 flex flex-wrap items-baseline gap-2 border-l-2 pl-2 text-sm"
            >
              <Chip tone="warn">{x.rule}</Chip>
              <span className="text-muted-foreground text-xs">
                Rules Exception
              </span>
              <span className="font-serif">“{x.reason}”</span>
            </li>
          ))}
          {outcomes.map((o) => (
            <li
              key={o.acknowledgementId}
              className="border-foreground/20 border-l-2 pl-2 text-sm"
            >
              <span className="text-muted-foreground text-xs">
                Recorded outcome ·{' '}
              </span>
              <span className="font-serif">{o.outcome}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** Warnings whose code the client can't pin to an item: listed at phase end. */
export function LooseWarnings({
  record,
  phase,
}: {
  record: WeekRecord;
  phase: Phase;
}) {
  const loose = record.warnings.filter((w) => w.phase === phase && !w.itemId);
  if (loose.length === 0) return null;
  return (
    <ul className="mt-1 space-y-1">
      {loose.map((w) => (
        <li
          key={w.code}
          className="flex items-start gap-1.5 text-sm text-amber-300"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>{w.message}</span>
        </li>
      ))}
    </ul>
  );
}

export function PhaseSection({
  record,
  phase,
  n,
}: {
  record: WeekRecord;
  phase: Phase;
  n: number;
}) {
  return (
    <section
      aria-label={phaseLabels[phase]}
      className="bg-card border-foreground/20 border p-4"
    >
      <SectionTitle
        n={n}
        right={
          <span className="flex flex-wrap justify-end gap-1">
            {record.phaseDelta[phase].map((d) => (
              <Chip key={d} tone="change">
                {d}
              </Chip>
            ))}
          </span>
        }
      >
        {phaseLabels[phase]}
      </SectionTitle>
      <ul className="divide-foreground/10 mt-1 divide-y">
        {record.consequences
          .filter((c) => c.phase === phase)
          .map((c) => (
            <RecordItem key={c.id} c={c} record={record} />
          ))}
      </ul>
      <LooseWarnings record={record} phase={phase} />
    </section>
  );
}

export function AdjustmentsSection({
  record,
  n,
}: {
  record: WeekRecord;
  n?: number | string;
}) {
  return (
    <section
      aria-label="Table Adjustments"
      className="bg-card border-foreground/20 space-y-2 border p-4"
    >
      <SectionTitle
        n={n}
        count={record.adjustments.length}
        right={
          record.adjustments.length > 0 ? (
            <span className="text-muted-foreground text-xs">
              Applied after the Rules Baseline, in this order.
            </span>
          ) : null
        }
      >
        Table Adjustments
      </SectionTitle>
      {record.adjustments.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No Table Adjustments. The Final outcome equals the Rules Baseline.
        </p>
      ) : (
        <ol className="space-y-1.5">
          {record.adjustments.map((a, i) => (
            <li
              key={a.adjustmentId}
              className="flex flex-wrap items-baseline gap-2 text-sm"
            >
              <span className="text-muted-foreground font-mono">{i + 1}</span>
              <Chip tone="table">{a.effect}</Chip>
              <span className="text-muted-foreground text-xs">{a.kind}</span>
              <span className="font-serif">“{a.reason}”</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function ResultTable({
  record,
  n,
  title,
  defaultAll = false,
}: {
  record: WeekRecord;
  n?: number | string;
  title?: string;
  defaultAll?: boolean;
}) {
  const [all, setAll] = useState(defaultAll);
  const changed = record.rows.filter(
    (r) => r.before !== r.final || r.baseline !== r.final,
  );
  const shown = all ? record.rows : changed;
  const next = record.week + 1;
  return (
    <section
      aria-label="Result"
      className="bg-card border-foreground/20 space-y-2 border p-4"
    >
      <SectionTitle
        n={n}
        right={
          <Button variant="ghost" size="sm" onClick={() => setAll(!all)}>
            {all ? 'Only what changed' : `Show all ${record.rows.length} values`}
          </Button>
        }
      >
        {title ??
          (next === currentWeek
            ? `Result · week ${next} began`
            : `Result · week ${next} began`)}
      </SectionTitle>
      <table className="w-full text-sm">
        <thead className="text-muted-foreground text-xs tracking-widest uppercase">
          <tr className="border-foreground/20 border-b">
            <th className="py-1 text-left font-normal">Value</th>
            <th className="py-1 text-right font-normal">At confirmation</th>
            <th className="py-1 text-right font-normal">Rules Baseline</th>
            <th className="py-1 text-right font-normal">Final</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.key} className="border-foreground/10 border-t">
              <td className="py-1">
                <span className="text-muted-foreground text-xs">
                  {r.group} ·{' '}
                </span>
                {r.label}
              </td>
              <td className="text-muted-foreground py-1 text-right font-mono">
                {r.before}
              </td>
              <td
                className={cn(
                  'py-1 text-right font-mono',
                  r.before === r.baseline && 'text-muted-foreground',
                )}
              >
                {r.baseline}
              </td>
              <td
                className={cn(
                  'py-1 text-right font-mono',
                  r.baseline !== r.final && 'font-semibold text-sky-300',
                )}
              >
                {r.final}
              </td>
            </tr>
          ))}
          {shown.length === 0 && (
            <tr>
              <td colSpan={4} className="text-muted-foreground py-2 text-sm">
                Nothing changed this week.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {all && (
        <div className="text-muted-foreground grid grid-cols-2 gap-4 pt-2 text-sm">
          <div>
            <p className="text-xs tracking-widest uppercase">
              Roster and officers
            </p>
            <p>{record.roster}</p>
          </div>
          <div>
            <p className="text-xs tracking-widest uppercase">
              Carried into week {next}
            </p>
            {record.queued.length === 0 ? (
              <p>Nothing queued.</p>
            ) : (
              <ul>
                {record.queued.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export function ProvenanceLine({
  record,
  entry,
}: {
  record: WeekRecord;
  entry: Entry;
}) {
  const effective = isEffective(record, entry);
  return (
    <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
      <span className="text-foreground">
        {provenanceLabels[entry.provenance]}
      </span>
      <span>· {longDate(entry.recordedAt)}</span>
      <span>· Ruleset {entry.rulesetVersion}</span>
      {!effective && (
        <Chip tone="warn">
          Earlier entry {entry.sequence + 1} of {record.entries.length}
        </Chip>
      )}
    </p>
  );
}

/** HIST-04 read-only notice and HIST-06 correction notice, merged. */
export function ReadOnlyNote() {
  return (
    <p className="text-muted-foreground text-xs">
      Read-only. Recorded when the week was confirmed. Corrections to a
      finished week aren't available yet.
    </p>
  );
}

export function ContextChips({ record }: { record: WeekRecord }) {
  return (
    <ul className="flex flex-wrap gap-1">
      {record.context.map((c) => (
        <li key={c}>
          <Chip>{c}</Chip>
        </li>
      ))}
    </ul>
  );
}

/** Militia values at confirmation and after the week, as on the week screen's panel. */
export function MilitiaThenNow({ record }: { record: WeekRecord }) {
  const { before: b, after: a } = record;
  const rows: [string, string][] = [
    ['Rank', `${b.rank} → ${a.rank}`],
    ['Training', `${b.training} → ${a.training}`],
    ['Treasury', `${b.treasury} → ${a.treasury} gp`],
    ['Notoriety', `${b.notoriety} → ${a.notoriety}`],
    ['Focus', b.focus],
    ['Teams', a.teams],
    ['Carried events', `${b.events} → ${a.events}`],
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="text-right font-mono">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
