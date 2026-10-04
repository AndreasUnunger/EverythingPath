'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { numberPattern } from './numeric-form-fields';
import { action, fieldLabel } from './sheet-parts';
import type {
  SelectionControls,
  SelectionRowView,
} from './selection-view-types';
import type { SelectionEditInput } from './use-character-sheet-selections';

/**
 * Choice order is shown counting from 1. Empty is required once an order is
 * recorded, and reads differently from text that is not a whole number.
 */
function orderField(isRequired: boolean) {
  return z.string().superRefine((raw, context) => {
    const value = raw.trim();
    if (!value) {
      if (isRequired)
        context.addIssue({ code: 'custom', message: 'Enter a choice order.' });
      return;
    }
    if (!numberPattern.test(value) || !Number.isFinite(Number(value)))
      context.addIssue({
        code: 'custom',
        message: 'Choice order must be a number.',
      });
    else if (!Number.isSafeInteger(Number(value)) || Number(value) < 1)
      context.addIssue({
        code: 'custom',
        message: 'Choice order must be a whole number of 1 or more.',
      });
  });
}

type Values = { choice: string; notes: string; order: string };

function toValues(row: SelectionRowView): Values {
  return {
    choice: row.choice ?? '',
    notes: row.notes,
    order: row.choiceOrder === null ? '' : String(row.choiceOrder + 1),
  };
}

/** Only what the player changed is sent; the rest of the Selection stays. */
function listChanges(row: SelectionRowView, values: Values) {
  const changes: SelectionEditInput = {};
  const choice = values.choice.trim() || null;
  if (choice !== row.choice) changes.choice = choice;
  if (values.notes !== row.notes) changes.notes = values.notes;
  const order = values.order.trim() ? Number(values.order) - 1 : null;
  if (order !== row.choiceOrder) changes.choiceOrder = order;
  return changes;
}

/**
 * A saved feat or trait's own record, edited in place: its choice, notes
 * and, while it is tied to a level, its order among that level's Selections.
 * The editor stays open with the player's input until the save succeeds.
 */
export function SelectionRowEditor({
  row,
  hasLevel,
  controls,
  onClose,
}: {
  row: SelectionRowView & { entryId: NonNullable<SelectionRowView['entryId']> };
  /** Whether the row is tied to a Class Level, so its order matters. */
  hasLevel: boolean;
  controls: SelectionControls;
  onClose: () => void;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const form = useForm<Values>({
    resolver: zodResolver(
      z.object({
        choice: z.string(),
        notes: z.string(),
        order: orderField(hasLevel && row.choiceOrder !== null),
      }),
    ),
    values: toValues(row),
    resetOptions: { keepDirtyValues: true },
  });
  const isSaving = controls.statusForEntry(row.entryId).kind === 'saving';
  const isDisabled = isSaving || maintenance.readOnly;

  async function save(values: Values) {
    const changes = listChanges(row, values);
    if (!hasLevel) delete changes.choiceOrder;
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    if (await controls.edit(row.entryId, changes)) onClose();
  }

  return (
    <Form {...form}>
      <form
        noValidate
        aria-label={`Edit ${row.name}`}
        className="border-foreground/20 mt-2 flex w-full flex-col gap-2 border p-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (isDisabled) return;
          void form.handleSubmit(save)();
        }}
      >
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
          <FormField
            control={form.control}
            name="choice"
            render={({ field }) => (
              <FormItem className="min-w-0 flex-1 basis-40 gap-0.5">
                <FormLabel className={fieldLabel}>
                  Choice <span className="sr-only">for {row.name}</span>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    autoFocus
                    autoComplete="off"
                    className="h-11 md:h-8"
                  />
                </FormControl>
              </FormItem>
            )}
          />
          {hasLevel ? (
            <FormField
              control={form.control}
              name="order"
              render={({ field, fieldState }) => (
                <FormItem className="w-36 gap-0.5">
                  <FormLabel className={fieldLabel}>Choice order</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      className="h-11 font-mono md:h-8"
                    />
                  </FormControl>
                  <FormMessage
                    role={fieldState.error ? 'alert' : undefined}
                    className="text-xs [overflow-wrap:anywhere]"
                  />
                </FormItem>
              )}
            />
          ) : null}
        </div>
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem className="gap-0.5">
              <FormLabel className={fieldLabel}>
                Notes <span className="sr-only">for {row.name}</span>
              </FormLabel>
              <FormControl>
                <Textarea {...field} rows={2} />
              </FormControl>
            </FormItem>
          )}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            size="sm"
            className={action}
            aria-describedby={reasonId}
            disabled={isDisabled}
          >
            {isSaving ? 'Saving…' : 'Save'}{' '}
            <span className="sr-only">{row.name}</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={action}
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
