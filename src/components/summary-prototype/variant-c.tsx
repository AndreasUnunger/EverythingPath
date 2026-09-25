'use client';
// PROTOTYPE — Variant C "Tabs": Outcome (Rules Baseline and Final preview side
// by side), Table rulings (Rules Exceptions, Table Adjustments added from a side
// sheet, recorded outcomes: the adjudication record in one place), and This
// week (consequences by phase). Tab badges carry counts and a warning dot.

import { useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { cn } from '~/lib/utils';
import {
  phaseLabels,
  phases,
  type AdjustmentKind,
  type Snapshot,
} from './mock';
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

export const name = 'Tabs: outcome, table rulings, this week';

function OutcomeColumn({
  title,
  s,
  other,
  final,
}: {
  title: string;
  s: Snapshot;
  other: Snapshot;
  final?: boolean;
}) {
  const diff = (a: string, b: string) => final && a !== b;
  const line = (label: string, value: string, base: string) => (
    <div key={label} className="contents">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'text-right font-mono',
          diff(value, base) && 'font-semibold text-sky-300',
        )}
      >
        {value}
      </dd>
    </div>
  );
  return (
    <section aria-label={title} className="min-w-0 space-y-3">
      <h3 className="font-semibold">{title}</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {line('Rank', `${s.rank}`, `${other.rank}`)}
        {line('Training', `${s.training}`, `${other.training}`)}
        {line('Treasury', `${s.treasury} gp`, `${other.treasury} gp`)}
        {line('Notoriety', `${s.notoriety}`, `${other.notoriety}`)}
        {line('Focus', s.focus, other.focus)}
      </dl>
      {[
        [
          'Teams',
          s.teams.map(
            (t, i) => [t.name, t.status, other.teams[i]!.status] as const,
          ),
        ],
        [
          'Settlements',
          s.settlements.map(
            (t, i) =>
              [t.name, t.reputation, other.settlements[i]!.reputation] as const,
          ),
        ],
        [
          'Persistent events',
          s.events.map(
            (e, i) =>
              [
                e.name,
                e.ended ? 'ends' : 'carries',
                other.events[i]!.ended ? 'ends' : 'carries',
              ] as const,
          ),
        ],
      ].map(([label, rows]) => (
        <div key={label as string}>
          <p className="text-muted-foreground text-xs tracking-widest uppercase">
            {label as string}
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
            {(rows as (readonly [string, string, string])[]).map(([n, v, o]) =>
              line(n, v, o),
            )}
          </dl>
        </div>
      ))}
      <details className="border-foreground/20 border p-2 text-sm">
        <summary className="cursor-pointer">
          Roster, officers and week {s.week} context
        </summary>
        <p className="text-muted-foreground mt-1">
          Kasvarina · Strategist · Ilsa · Commandant · Orin · Quartermaster.
          Queued: {s.queued.join('; ') || 'nothing'}.
        </p>
      </details>
    </section>
  );
}

export function VariantC({ view, edit, disabled }: SummaryProps) {
  const [adding, setAdding] = useState<AdjustmentKind | null>(null);
  const [open, setOpen] = useState(false);
  const rulings =
    view.exceptions.length + view.adjustments.length + view.recorded.length;
  const attention =
    view.requirements.some((r) => r.exceptionId) ||
    view.adjustments.some((a) => !a.reason.trim());
  return (
    <Tabs
      defaultValue="outcome"
      className="bg-card border-foreground/20 border p-4"
    >
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="outcome">
          Outcome{' '}
          {view.changedRows > 0 && (
            <Chip tone="table">{view.changedRows} adjusted</Chip>
          )}
        </TabsTrigger>
        <TabsTrigger value="rulings" className="gap-2">
          Table rulings <span className="font-mono">{rulings}</span>
          {attention && (
            <span
              className="size-2 rounded-full bg-amber-300"
              aria-label="needs a reason"
            />
          )}
        </TabsTrigger>
        <TabsTrigger value="week">This week</TabsTrigger>
      </TabsList>

      <TabsContent value="outcome" className="pt-3">
        <div className="grid grid-cols-2 gap-6">
          <OutcomeColumn
            title="Rules Baseline"
            s={view.baseline}
            other={view.final}
          />
          <OutcomeColumn
            title="Final preview"
            s={view.final}
            other={view.baseline}
            final
          />
        </div>
      </TabsContent>

      <TabsContent value="rulings" className="space-y-5 pt-3">
        <div className="space-y-2">
          <SectionTitle count={view.exceptions.length}>
            Rules Exceptions
          </SectionTitle>
          <p className="text-muted-foreground text-xs">
            A reason permits an unusual choice. It does not change the
            calculation.
          </p>
          {view.exceptions.length === 0 ? (
            <p className="text-sm">No Rules Exceptions.</p>
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
          <SectionTitle
            count={view.adjustments.length}
            right={
              <Button
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => setOpen(true)}
              >
                + Add adjustment
              </Button>
            }
          >
            Table Adjustments
          </SectionTitle>
          <p className="text-muted-foreground text-xs">
            Applied after the complete Rules Baseline, in the order shown.
          </p>
          {view.adjustments.length === 0 ? (
            <p className="text-sm">No Table Adjustments.</p>
          ) : (
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
          )}
        </div>
        <div className="space-y-2">
          <SectionTitle count={view.recorded.length}>
            Recorded table outcomes
          </SectionTitle>
          {view.recorded.length === 0 ? (
            <p className="text-sm">No narrative outcomes recorded.</p>
          ) : (
            <ul className="space-y-2">
              {view.recorded.map((r) => (
                <RecordedItem key={r.acknowledgementId} r={r} />
              ))}
            </ul>
          )}
        </div>
      </TabsContent>

      <TabsContent value="week" className="space-y-3 pt-3">
        {phases.map((p) => (
          <div key={p}>
            <h3 className="font-semibold">{phaseLabels[p]}</h3>
            <ul className="divide-foreground/10 divide-y">
              {view.consequences
                .filter((c) => c.phase === p)
                .map((c) => (
                  <li
                    key={c.id}
                    className="flex items-baseline gap-2 py-1.5 text-sm"
                  >
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
                      <Chip tone="warn">exception</Chip>
                    )}
                    {view.recorded.some((x) => x.itemId === c.id) && (
                      <Chip>recorded</Chip>
                    )}
                    {c.delta && <Chip tone="change">{c.delta}</Chip>}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </TabsContent>

      <Sheet
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setAdding(null);
        }}
      >
        <SheetContent side="right" className="w-[440px] sm:max-w-[440px]">
          <SheetHeader>
            <SheetTitle>New Table Adjustment</SheetTitle>
            <SheetDescription>
              Choose what the table changes, then give the reason.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-3 px-4">
            {adding ? (
              <AdjustmentForm
                initial={seedFor(adding, view)}
                view={view}
                disabled={disabled}
                onSave={(a) => {
                  edit({ kind: 'adjust:add', adjustment: a });
                  setAdding(null);
                  setOpen(false);
                }}
                onCancel={() => setAdding(null)}
              />
            ) : (
              <KindCards compact onPick={setAdding} disabled={disabled} />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </Tabs>
  );
}
