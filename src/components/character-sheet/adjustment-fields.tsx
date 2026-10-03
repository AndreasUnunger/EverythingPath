'use client';
import { Plus } from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { cn } from '~/lib/utils';
import {
  modifierColumns,
  PersonalAdjustmentModifierRow,
} from './personal-adjustment-modifier-row';
import { action, fieldLabel } from './sheet-parts';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';
import type { usePersonalAdjustmentForm } from './use-personal-adjustment-form';

type Controller = ReturnType<typeof useCharacterSheet>;
export type AdjustmentFormParts = Pick<
  ReturnType<typeof usePersonalAdjustmentForm>,
  'form' | 'fields' | 'addModifier' | 'removeModifier'
>;

/** The entry's name, inside the adjustment form's provider. */
export function AdjustmentNameField({
  control,
  isDisabled,
}: {
  control: AdjustmentFormParts['form']['control'];
  isDisabled: boolean;
}) {
  return (
    <FormField
      control={control}
      name="name"
      render={({ field, fieldState }) => (
        <FormItem className="gap-0.5">
          <FormLabel className={fieldLabel}>Name</FormLabel>
          <FormControl>
            <Input
              {...field}
              disabled={isDisabled}
              autoComplete="off"
              className="h-11 md:h-8"
            />
          </FormControl>
          <FormMessage role={fieldState.error ? 'alert' : undefined} />
        </FormItem>
      )}
    />
  );
}

/**
 * The Modifiers an entry grants, each with a statistic, bonus type, value
 * (a number or a formula) and an optional Situation, plus Add modifier.
 * The saved entry's formula warnings sit under the Modifier they are about.
 */
export function ModifierListFields({
  editor,
  isDisabled,
  warnings = [],
  warningController,
}: {
  editor: AdjustmentFormParts;
  isDisabled: boolean;
  warnings?: SheetWarningView[];
  warningController?: Controller['warnings'];
}) {
  return (
    <>
      <div
        aria-hidden
        className={cn('hidden md:grid', modifierColumns, fieldLabel)}
      >
        <span>Statistic</span>
        <span>Bonus type</span>
        <span>Value</span>
        <span>Only when…</span>
        <span />
      </div>
      <ul aria-label="Modifiers" className="space-y-1">
        {editor.fields.map((row, index) => (
          <PersonalAdjustmentModifierRow
            key={row.id}
            editor={editor}
            index={index}
            isDisabled={isDisabled}
            canRemove={editor.fields.length > 1}
            warnings={warnings}
            warningController={warningController}
          />
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={action}
          disabled={isDisabled}
          onClick={editor.addModifier}
        >
          <Plus aria-hidden className="size-4" />
          Add modifier
        </Button>
      </div>
    </>
  );
}
