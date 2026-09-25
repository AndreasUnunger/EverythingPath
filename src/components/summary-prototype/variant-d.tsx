'use client';
// PROTOTYPE — Variant D "Desk": two panes. Left, the Final preview sheet with
// the baseline struck through wherever the table changed it. Right, a sticky
// Table rulings column holding adjustments, Rules Exceptions and recorded
// outcomes together. A compact timeline of how it happened runs underneath.

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { phaseLabels, phases, type AdjustmentKind } from './mock';
import {
  AdjustmentForm,
  AdjustmentItem,
  Chip,
  ExceptionItem,
  KindCards,
  RecordedItem,
  SectionTitle,
  seedFor,
  type SummaryProps,
} from './parts';

export const name = 'Desk: outcome sheet beside table rulings';

export function VariantD({ view, edit, disabled }: SummaryProps) {
  const [adding, setAdding] = useState<AdjustmentKind | 'pick' | null>(null);
  const groups = [...new Set(view.rows.map((r) => r.group))];
  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-4">
        <section
          aria-label="Final preview"
          className="bg-card border-foreground/20 space-y-3 border p-4"
        >
          <SectionTitle>Final preview · week 15</SectionTitle>
          <p className="text-muted-foreground text-xs">
            Struck-through values are the Rules Baseline before a Table
            Adjustment.
          </p>
          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g}>
                <p className="text-muted-foreground text-xs tracking-widest uppercase">
                  {g}
                </p>
                <dl className="divide-foreground/10 divide-y text-sm">
                  {view.rows
                    .filter((r) => r.group === g)
                    .map((r) => (
                      <div
                        key={r.key}
                        className="flex items-baseline gap-2 py-1"
                      >
                        <dt className="min-w-0 flex-1">
                          {r.label}
                          {r.sub && (
                            <span className="text-muted-foreground text-xs">
                              {' '}
                              · {r.sub}
                            </span>
                          )}
                        </dt>
                        <dd className="flex items-baseline gap-2 font-mono">
                          {r.start !== r.baseline && (
                            <span className="text-muted-foreground text-xs">
                              from {r.start}
                            </span>
                          )}
                          {r.baseline !== r.final && (
                            <s className="text-muted-foreground">
                              {r.baseline}
                            </s>
                          )}
                          <span
                            className={cn(
                              r.baseline !== r.final &&
                                'font-semibold text-sky-300',
                            )}
                          >
                            {r.final}
                          </span>
                        </dd>
                      </div>
                    ))}
                </dl>
              </div>
            ))}
          </div>
          <details className="text-sm">
            <summary className="text-muted-foreground cursor-pointer">
              Roster, officers and queued effects
            </summary>
            <p className="text-muted-foreground mt-1">
              Kasvarina · Strategist (from this week) · Ilsa · Commandant · Orin
              · Quartermaster. Queued: {view.final.queued.join('; ')}.
            </p>
          </details>
        </section>

        <aside
          aria-label="Table rulings"
          className="bg-card border-foreground/20 sticky top-3 space-y-4 border p-3"
        >
          <div className="space-y-2">
            <SectionTitle
              count={view.adjustments.length}
              right={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={disabled || adding !== null}
                  onClick={() => setAdding('pick')}
                >
                  <Plus /> Add
                </Button>
              }
            >
              Adjustments
            </SectionTitle>
            {view.adjustments.length === 0 && adding === null && (
              <p className="text-muted-foreground text-sm">
                None. Final equals the Rules Baseline.
              </p>
            )}
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
            {adding === 'pick' && (
              <KindCards compact onPick={setAdding} disabled={disabled} />
            )}
            {adding && adding !== 'pick' && (
              <AdjustmentForm
                initial={seedFor(adding, view)}
                view={view}
                disabled={disabled}
                onSave={(a) => {
                  edit({ kind: 'adjust:add', adjustment: a });
                  setAdding(null);
                }}
                onCancel={() => setAdding(null)}
              />
            )}
          </div>
          <div className="space-y-2">
            <SectionTitle count={view.exceptions.length}>
              Rules Exceptions
            </SectionTitle>
            {view.exceptions.length === 0 ? (
              <p className="text-muted-foreground text-sm">None.</p>
            ) : (
              <ul className="space-y-2">
                {view.exceptions.map((x) => (
                  <ExceptionItem
                    key={x.exceptionId}
                    x={x}
                    edit={edit}
                    disabled={disabled}
                  />
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-2">
            <SectionTitle count={view.recorded.length}>
              Recorded outcomes
            </SectionTitle>
            {view.recorded.length === 0 ? (
              <p className="text-muted-foreground text-sm">None.</p>
            ) : (
              <ul className="space-y-2">
                {view.recorded.map((r) => (
                  <RecordedItem key={r.acknowledgementId} r={r} />
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <section
        aria-label="How it happened"
        className="bg-card border-foreground/20 space-y-2 border p-4"
      >
        <SectionTitle>How it happened</SectionTitle>
        {phases.map((p) => (
          <div key={p} className="grid grid-cols-[6rem_1fr] gap-2 text-sm">
            <span className="text-muted-foreground pt-1 text-xs tracking-widest uppercase">
              {phaseLabels[p]}
            </span>
            <ul className="divide-foreground/10 divide-y">
              {view.consequences
                .filter((c) => c.phase === p)
                .map((c) => (
                  <li key={c.id} className="flex items-baseline gap-2 py-1">
                    <span className="min-w-0 flex-1">
                      {c.text}
                      {c.detail && (
                        <span className="text-muted-foreground">
                          {' '}
                          · {c.detail}
                        </span>
                      )}
                    </span>
                    {view.exceptions.some((x) => x.itemId === c.id) && (
                      <Chip tone="warn">exception ↑</Chip>
                    )}
                    {view.recorded.some((x) => x.itemId === c.id) && (
                      <Chip>recorded ↑</Chip>
                    )}
                    {c.delta && <Chip tone="change">{c.delta}</Chip>}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </section>
    </>
  );
}
