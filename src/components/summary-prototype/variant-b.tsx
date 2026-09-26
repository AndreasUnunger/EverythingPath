'use client';
// PROTOTYPE — Variant B "Story": the week told in rules order, one section per
// phase, with each item's exception and recorded outcome inline; Table rulings
// are the last step of the story, and the Result closes it with only the values
// that changed (everything else behind a toggle).

import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { phaseLabels, phases, type AdjustmentKind } from './mock';
import {
  AdjustmentForm,
  AdjustmentItem,
  Chip,
  ConsequenceItem,
  KindCards,
  SectionTitle,
  seedFor,
  type SummaryProps,
} from './parts';

export const name = 'Story: the week in order, rulings last';

const phaseDelta: Record<string, string[]> = {
  upkeep: ['Training −13', 'Treasury +20 gp', '2 teams back'],
  activity: ['Training +6', 'Treasury +45 gp', 'Longshadow ↑'],
  event: ['Scouts disabled', 'Notoriety +2'],
  persistent: ['Treasury −60 gp', '1 event ends'],
};

export function VariantB({ view, edit, disabled }: SummaryProps) {
  const [adding, setAdding] = useState<AdjustmentKind | null>(null);
  const [all, setAll] = useState(false);
  const changed = view.rows.filter(
    (r) => r.start !== r.final || r.baseline !== r.final,
  );
  const shown = all ? view.rows : changed;
  return (
    <>
      {phases.map((p, i) => (
        <section
          key={p}
          aria-label={phaseLabels[p]}
          className="bg-card border-foreground/20 border p-4"
        >
          <SectionTitle
            right={
              <span className="flex flex-wrap gap-1">
                {phaseDelta[p]!.map((d) => (
                  <Chip key={d} tone="change">
                    {d}
                  </Chip>
                ))}
              </span>
            }
          >
            <span className="text-muted-foreground font-mono">{i + 1}</span>{' '}
            {phaseLabels[p]}
          </SectionTitle>
          <ul className="divide-foreground/10 mt-1 divide-y">
            {view.consequences
              .filter((c) => c.phase === p)
              .map((c) => (
                <ConsequenceItem
                  key={c.id}
                  c={c}
                  view={view}
                  edit={edit}
                  disabled={disabled}
                  attach
                />
              ))}
            {view.exceptions
              .filter(
                (x) =>
                  x.phase === p &&
                  !view.consequences.some((c) => c.id === x.itemId),
              )
              .map((x) => (
                <ConsequenceItem
                  key={x.exceptionId}
                  c={{ id: x.itemId, phase: p, text: x.subject }}
                  view={view}
                  edit={edit}
                  disabled={disabled}
                  attach
                />
              ))}
          </ul>
        </section>
      ))}

      <section
        aria-label="Table rulings"
        className="bg-card border-foreground/20 space-y-3 border p-4"
      >
        <SectionTitle
          count={view.adjustments.length}
          right={
            <span className="text-muted-foreground text-xs">
              Applied after the Rules Baseline, in this order.
            </span>
          }
        >
          <span className="text-muted-foreground font-mono">5</span> Table
          Adjustments
        </SectionTitle>
        {view.adjustments.length === 0 && !adding && (
          <p className="text-muted-foreground text-sm">
            No Table Adjustments. The Final preview equals the Rules Baseline.
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
        {adding ? (
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
        ) : (
          <KindCards onPick={setAdding} disabled={disabled} />
        )}
      </section>

      <section
        aria-label="Result"
        className="bg-card border-foreground/20 space-y-2 border p-4"
      >
        <SectionTitle
          right={
            <Button variant="ghost" size="sm" onClick={() => setAll(!all)}>
              {all
                ? 'Only what changed'
                : `Show all ${view.rows.length} values`}
            </Button>
          }
        >
          <span className="text-muted-foreground font-mono">6</span> Result ·
          week 15 begins
        </SectionTitle>
        <table className="hidden w-full text-sm md:table">
          <thead className="text-muted-foreground text-xs tracking-widest uppercase">
            <tr className="border-foreground/20 border-b">
              <th className="py-1 text-left font-normal">Value</th>
              <th className="py-1 text-right font-normal">Now</th>
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
                  {r.start}
                </td>
                <td
                  className={cn(
                    'py-1 text-right font-mono',
                    r.start === r.baseline && 'text-muted-foreground',
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
          </tbody>
        </table>
        <ul className="divide-foreground/10 divide-y text-sm md:hidden">
          {shown.map((r) => (
            <li key={r.key} className="space-y-1 py-2">
              <p>
                <span className="text-muted-foreground text-xs">{r.group} · </span>
                {r.label}
              </p>
              <dl className="grid grid-cols-3 gap-2 font-mono">
                <div>
                  <dt className="text-muted-foreground font-sans text-[10px] tracking-widest uppercase">Now</dt>
                  <dd className="text-muted-foreground">{r.start}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-sans text-[10px] tracking-widest uppercase">Baseline</dt>
                  <dd className={cn(r.start === r.baseline && 'text-muted-foreground')}>{r.baseline}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-sans text-[10px] tracking-widest uppercase">Final</dt>
                  <dd className={cn(r.baseline !== r.final && 'font-semibold text-sky-300')}>{r.final}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
        {all && (
          <div className="text-muted-foreground grid gap-4 pt-2 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs tracking-widest uppercase">
                Roster and officers
              </p>
              <p>
                Kasvarina · Strategist (from this week) · Ilsa · Commandant ·
                Orin · Quartermaster
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
        )}
      </section>
    </>
  );
}
