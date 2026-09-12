'use client';
import { z } from 'zod';
import { useState } from 'react';
import { tableAdjustmentSchema } from '~/lib/weekly-draft-facts';
import { Button } from '~/components/ui/button';
import { ChoiceCards } from './choice-cards';
import { StructuredChoiceField } from './structured-choice-field';
import type { PhaseView, WeeklyDraftWorkspace } from './types';
type Summary = Extract<PhaseView, { phase: 'summary' }>;
type Adjustment = Summary['adjustments'][number];
type Edit = Extract<WeeklyDraftWorkspace, { status: 'ready' }>['edit'];
const kinds = [
  { value: 'militia_value', label: 'Militia value' },
  { value: 'team_status', label: 'Team condition' },
  { value: 'settlement_reputation', label: 'Settlement reputation' },
  { value: 'event_end', label: 'End persistent event' },
];
function adjustmentSchema(kind: Adjustment['kind']) {
  const schema = tableAdjustmentSchema.options.find(
    (schema) => schema.shape.kind.value === kind,
  )!;
  return z.strictObject(
    Object.fromEntries(
      Object.entries(schema.shape).filter(([key]) => key !== 'adjustmentId'),
    ),
  );
}
export function SummaryAdjustments({
  view,
  edit,
  disabled,
}: {
  view: Summary;
  edit: Edit;
  disabled: boolean;
}) {
  const [adding, setAdding] = useState<{
    id: string;
    kind: Adjustment['kind'];
  } | null>(null);
  const save = async (adjustments: Adjustment[]) => {
    if ((await edit({ kind: 'table_adjustments', adjustments })) === 'accepted')
      setAdding(null);
  };
  return (
    <section className="min-w-0 space-y-3" aria-label="Table Adjustments">
      <h2 className="text-lg font-semibold">Table Adjustments</h2>
      <p className="text-muted-foreground text-sm">
        Apply in the order shown, after the complete Rules Baseline. Every
        adjustment needs a reason.
      </p>
      {view.adjustments.length === 0 && <p>No Table Adjustments.</p>}
      {view.adjustments.map((adjustment, index) => (
        <article
          key={adjustment.adjustmentId}
          className="min-w-0 space-y-2 rounded-md border p-3"
        >
          <h3 className="font-medium">Adjustment {index + 1}</h3>
          <StructuredChoiceField
            name="adjustment"
            schema={adjustmentSchema(adjustment.kind)}
            value={Object.fromEntries(
              Object.entries(adjustment).filter(
                ([key]) => key !== 'adjustmentId',
              ),
            )}
            options={view.options}
            disabled={disabled}
            onValue={(value) => {
              if (value === undefined) {
                void save(
                  view.adjustments.filter(
                    (item) => item.adjustmentId !== adjustment.adjustmentId,
                  ),
                );
                return false;
              }
              const parsed = tableAdjustmentSchema.safeParse({
                ...Object(value),
                adjustmentId: adjustment.adjustmentId,
              });
              if (parsed.success)
                void save(
                  view.adjustments.map((item) =>
                    item.adjustmentId === adjustment.adjustmentId
                      ? parsed.data
                      : item,
                  ),
                );
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={disabled || index === 0}
              onClick={() => {
                const next = [...view.adjustments];
                [next[index - 1], next[index]] = [
                  next[index]!,
                  next[index - 1]!,
                ];
                void save(next);
              }}
            >
              Move adjustment {index + 1} earlier
            </Button>
            <Button
              variant="outline"
              disabled={disabled || index === view.adjustments.length - 1}
              onClick={() => {
                const next = [...view.adjustments];
                [next[index], next[index + 1]] = [
                  next[index + 1]!,
                  next[index]!,
                ];
                void save(next);
              }}
            >
              Move adjustment {index + 1} later
            </Button>
          </div>
        </article>
      ))}
      <ChoiceCards
        label="New Table Adjustment"
        choices={kinds}
        value={adding?.kind ?? null}
        disabled={disabled}
        onChange={(kind) => {
          const parsed = tableAdjustmentSchema.options.find(
            (schema) => schema.shape.kind.value === kind,
          );
          if (parsed)
            setAdding({
              id: crypto.randomUUID(),
              kind: parsed.shape.kind.value,
            });
        }}
      />
      {adding && (
        <StructuredChoiceField
          key={adding.id}
          name="adjustment"
          schema={adjustmentSchema(adding.kind)}
          value={
            adding.kind === 'militia_value'
              ? { kind: adding.kind, field: 'treasuryCopper', operation: 'add' }
              : { kind: adding.kind }
          }
          options={view.options}
          disabled={disabled}
          onValue={(value) => {
            if (value === undefined) {
              setAdding(null);
              return;
            }
            const parsed = tableAdjustmentSchema.safeParse({
              ...Object(value),
              adjustmentId: adding.id,
            });
            if (parsed.success) void save([...view.adjustments, parsed.data]);
          }}
        />
      )}
    </section>
  );
}
