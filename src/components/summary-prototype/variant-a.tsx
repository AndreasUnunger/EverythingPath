'use client';
// PROTOTYPE — Variant A "Ledger": one outcome table with Now → Rules Baseline →
// Table Adjustments → Final. Adjustments are added from the row they change (the
// kind is implied by the row), ordered in a list under the table. Consequences
// follow by phase, with each item's Rules Exception and recorded outcome inline.

import { Plus } from 'lucide-react';
import { Fragment, useState } from 'react';
import { cn } from '~/lib/utils';
import { phaseLabels, phases, type Row } from './mock';
import {
  AdjustmentForm,
  AdjustmentItem,
  Chip,
  ConsequenceItem,
  SectionTitle,
  type SummaryProps,
} from './parts';

export const name = 'Ledger: one table, adjust from the row';

export function VariantA({ view, edit, disabled }: SummaryProps) {
  const [adding, setAdding] = useState<Row | null>(null);
  const groups = [...new Set(view.rows.map((r) => r.group))];
  return (
    <>
      <section
        aria-label="Outcome"
        className="bg-card border-foreground/20 space-y-3 border p-4"
      >
        <SectionTitle>Outcome of week 14</SectionTitle>
        <p className="text-muted-foreground text-xs">
          Tap + on a row to adjust it. Adjustments apply after the Rules
          Baseline, in order.
        </p>
        <table className="w-full text-sm">
          <thead className="text-muted-foreground text-xs tracking-widest uppercase">
            <tr className="border-foreground/20 border-b">
              <th className="py-1 text-left font-normal">Value</th>
              <th className="py-1 text-right font-normal">Now</th>
              <th className="py-1 text-right font-normal">Rules Baseline</th>
              <th className="py-1 pl-4 text-left font-normal">
                Table Adjustments
              </th>
              <th className="py-1 text-right font-normal">Final</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g}>
                <tr>
                  <td
                    colSpan={5}
                    className="text-muted-foreground pt-3 pb-1 text-xs tracking-widest uppercase"
                  >
                    {g}
                  </td>
                </tr>
                {view.rows
                  .filter((r) => r.group === g)
                  .map((r) => {
                    const adjusted = r.baseline !== r.final;
                    const ruled = r.start !== r.baseline;
                    return (
                      <Fragment key={r.key}>
                        <tr className="border-foreground/10 border-t">
                          <td className="py-1.5">
                            {r.label}
                            {r.sub && (
                              <span className="text-muted-foreground text-xs">
                                {' '}
                                · {r.sub}
                              </span>
                            )}
                          </td>
                          <td className="text-muted-foreground py-1.5 text-right font-mono">
                            {r.start}
                          </td>
                          <td
                            className={cn(
                              'py-1.5 text-right font-mono',
                              ruled
                                ? 'text-foreground'
                                : 'text-muted-foreground',
                            )}
                          >
                            {r.baseline}
                          </td>
                          <td className="py-1.5 pl-4">
                            <span className="flex flex-wrap items-center gap-1">
                              {r.adjustmentIds.map((id) => {
                                const i = view.adjustments.findIndex(
                                  (a) => a.adjustmentId === id,
                                );
                                return (
                                  <Chip key={id} tone="table">
                                    #{i + 1}
                                  </Chip>
                                );
                              })}
                              <button
                                aria-label={`Adjust ${r.label}`}
                                disabled={disabled}
                                onClick={() => setAdding(r)}
                                className="border-foreground/30 text-muted-foreground hover:text-foreground inline-flex size-7 items-center justify-center border border-dashed"
                              >
                                <Plus className="size-3.5" />
                              </button>
                            </span>
                          </td>
                          <td
                            className={cn(
                              'py-1.5 text-right font-mono',
                              adjusted
                                ? 'font-semibold text-sky-300'
                                : ruled
                                  ? 'text-foreground'
                                  : 'text-muted-foreground',
                            )}
                          >
                            {r.final}
                          </td>
                        </tr>
                        {adding?.key === r.key && (
                          <tr>
                            <td colSpan={5} className="py-2">
                              <AdjustmentForm
                                initial={r.seed}
                                view={view}
                                disabled={disabled}
                                title={`Adjust ${r.label}`}
                                onSave={(a) => {
                                  edit({ kind: 'adjust:add', adjustment: a });
                                  setAdding(null);
                                }}
                                onCancel={() => setAdding(null)}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
              </Fragment>
            ))}
          </tbody>
        </table>
        {view.adjustments.length > 0 && (
          <div className="space-y-2 pt-2">
            <SectionTitle count={view.adjustments.length}>
              Table Adjustments, in order
            </SectionTitle>
            <ol className="space-y-2">
              {view.adjustments.map((a, i) => (
                <AdjustmentItem
                  key={a.adjustmentId}
                  a={a}
                  index={i}
                  count={view.adjustments.length}
                  view={view}
                  edit={edit}
                  disabled={disabled}
                />
              ))}
            </ol>
          </div>
        )}
      </section>

      <section
        aria-label="What happened this week"
        className="bg-card border-foreground/20 space-y-2 border p-4"
      >
        <SectionTitle>What happened this week</SectionTitle>
        <p className="text-muted-foreground text-xs">
          Rules Exceptions and recorded outcomes sit under the item they belong
          to.
        </p>
        {phases.map((p) => {
          const items = view.consequences.filter((c) => c.phase === p);
          const open = items.some(
            (c) =>
              view.exceptions.some((x) => x.itemId === c.id) ||
              view.recorded.some((r) => r.itemId === c.id),
          );
          return (
            <details
              key={p}
              open={open}
              className="border-foreground/15 border-t pt-1"
            >
              <summary className="flex cursor-pointer items-center gap-2 py-1 font-medium">
                {phaseLabels[p]}
                <span className="text-muted-foreground font-mono text-xs">
                  {items.length}
                </span>
                <span className="ml-auto flex gap-1">
                  {view.exceptions.filter((x) => x.phase === p).length > 0 && (
                    <Chip tone="warn">
                      {view.exceptions.filter((x) => x.phase === p).length}{' '}
                      exception
                    </Chip>
                  )}
                  {view.recorded.filter((x) => x.phase === p).length > 0 && (
                    <Chip>
                      {view.recorded.filter((x) => x.phase === p).length}{' '}
                      recorded
                    </Chip>
                  )}
                </span>
              </summary>
              <ul className="divide-foreground/10 divide-y pl-2">
                {items.map((c) => (
                  <ConsequenceItem
                    key={c.id}
                    c={c}
                    view={view}
                    edit={edit}
                    disabled={disabled}
                    attach
                  />
                ))}
              </ul>
            </details>
          );
        })}
        {view.exceptions.filter(
          (x) => !view.consequences.some((c) => c.id === x.itemId),
        ).length > 0 && (
          <details open className="border-foreground/15 border-t pt-1">
            <summary className="cursor-pointer py-1 font-medium">
              Rules Exceptions without a current item
            </summary>
            <ul className="space-y-1 pl-2">
              {view.exceptions
                .filter(
                  (x) => !view.consequences.some((c) => c.id === x.itemId),
                )
                .map((x) => (
                  <ConsequenceItem
                    key={x.exceptionId}
                    c={{ id: x.itemId, phase: x.phase, text: x.subject }}
                    view={view}
                    edit={edit}
                    disabled={disabled}
                    attach
                  />
                ))}
            </ul>
          </details>
        )}
      </section>

      <details className="bg-card border-foreground/20 border p-4">
        <summary className="cursor-pointer font-medium">
          Militia facts and week 15 context
        </summary>
        <div className="text-muted-foreground mt-2 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs tracking-widest uppercase">
              Roster and officers
            </p>
            <p>
              Kasvarina · Strategist (from this week) · Ilsa · Commandant · Orin
              · Quartermaster
            </p>
          </div>
          <div>
            <p className="text-xs tracking-widest uppercase">
              Queued for week 15
            </p>
            <ul>
              {view.final.queued.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
        </div>
      </details>
    </>
  );
}
