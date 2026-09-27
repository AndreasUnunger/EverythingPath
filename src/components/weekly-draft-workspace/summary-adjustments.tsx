'use client';
import { z } from 'zod';
import { useState } from 'react';
import { tableAdjustmentSchema } from '~/lib/weekly-draft-facts';
import { Button } from '~/components/ui/button';
import { ChoiceCards } from './choice-cards';
import { StructuredChoiceField } from './structured-choice-field';
import { moveAdjustment } from './adjustment-order';
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
const fieldGrid =
  'min-w-0 space-y-3 [&_.grid]:grid-cols-1 sm:[&_.grid]:grid-cols-2';
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
function fieldOptions(view: Summary) {
  return {
    ...view.options,
    field: [
      { value: 'training', label: 'Training' },
      { value: 'treasuryCopper', label: 'Treasury (copper)' },
      { value: 'notoriety', label: 'Notoriety' },
      { value: 'rank', label: 'Rank' },
    ],
  };
}
/**
 * The editor and ordering controls of one staged Table Adjustment; every
 * change saves the complete ordered list.
 */
export function AdjustmentControls({
  view,
  edit,
  disabled,
  index,
}: {
  view: Summary;
  edit: Edit;
  disabled: boolean;
  index: number;
}) {
  const adjustment = view.adjustments[index];
  if (!adjustment) return null;
  const save = (adjustments: Adjustment[]) =>
    void edit({ kind: 'table_adjustments', adjustments });
  return (
    <div className={fieldGrid}>
      <StructuredChoiceField
        name="adjustment"
        schema={adjustmentSchema(adjustment.kind)}
        value={Object.fromEntries(
          Object.entries(adjustment).filter(([key]) => key !== 'adjustmentId'),
        )}
        options={fieldOptions(view)}
        disabled={disabled}
        onValue={(value) => {
          if (value === undefined) {
            save(
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
            save(
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
          onClick={() => save(moveAdjustment(view.adjustments, index, -1))}
        >
          Move adjustment {index + 1} earlier
        </Button>
        <Button
          variant="outline"
          disabled={disabled || index === view.adjustments.length - 1}
          onClick={() => save(moveAdjustment(view.adjustments, index, 1))}
        >
          Move adjustment {index + 1} later
        </Button>
      </div>
    </div>
  );
}
/** Kind cards and the form that appends a new Table Adjustment. */
export function AddAdjustment({
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
    <div className={fieldGrid}>
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
          options={fieldOptions(view)}
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
    </div>
  );
}
