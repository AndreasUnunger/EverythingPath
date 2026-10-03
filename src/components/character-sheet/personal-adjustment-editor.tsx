'use client';
import { Plus } from 'lucide-react';
import { MaintenanceReason } from '~/components/campaign-shell/maintenance-reason';
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
import { cn } from '~/lib/utils';
import {
  modifierColumns,
  PersonalAdjustmentModifierRow,
} from './personal-adjustment-modifier-row';
import { action, fieldLabel, RemoteNotice, SaveFeedback } from './sheet-parts';
import type { PersonalAdjustmentInput } from './use-character-sheet';
import { usePersonalAdjustmentForm } from './use-personal-adjustment-form';

/**
 * One personal adjustment, edited in place: its name and the Modifiers it
 * grants, each with a statistic, bonus type, value and an optional
 * Situation of its own. A new adjustment closes once it is saved and
 * nothing newer was typed; an existing one stays open with its Saved note.
 */
export function PersonalAdjustmentEditor({
  adjustment,
  save,
  onClose,
  isNew,
  isRemoved = false,
}: {
  adjustment?: PersonalAdjustmentInput;
  save: (input: PersonalAdjustmentInput) => Promise<unknown>;
  onClose: () => void;
  /** Creating: the editor closes after a clean save. */
  isNew: boolean;
  /** Another player removed the entry this draft belongs to. */
  isRemoved?: boolean;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const editor = usePersonalAdjustmentForm({ adjustment, save });
  const isDirty = editor.form.formState.isDirty;
  const isSaving = editor.status.kind === 'saving';
  const isSaved = editor.status.kind === 'saved';
  const isDisabled = maintenance.readOnly;

  // The form state this render holds is a snapshot; the subscription hears
  // what the save's reset leaves behind the moment it happens, so a new
  // editor closes only when nothing newer than the saved input remains.
  async function saveAndCloseWhenClean() {
    let hasNewerInput = isDirty;
    const unsubscribe = editor.form.subscribe({
      formState: { isDirty: true },
      callback: (state) => {
        if (state.isDirty !== undefined) hasNewerInput = state.isDirty;
      },
    });
    const outcome = await editor.save();
    unsubscribe();
    if (isNew && outcome === 'saved' && !hasNewerInput) onClose();
  }

  if (isRemoved && !isDirty)
    return (
      <div
        role="status"
        className="border-foreground/20 flex flex-wrap items-center gap-x-3 gap-y-1 border p-3 text-sm"
      >
        <span>This adjustment is no longer on the sheet.</span>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Close <span className="sr-only">editor</span>
        </Button>
      </div>
    );

  return (
    <Form {...editor.form}>
      <form
        noValidate
        aria-label={
          isNew ? 'New personal adjustment' : 'Edit personal adjustment'
        }
        className="border-foreground/20 space-y-2 border p-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (isDisabled) return;
          void saveAndCloseWhenClean();
        }}
      >
        <FormField
          control={editor.form.control}
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
        {isRemoved ? (
          <p role="status" className="text-xs text-sky-300">
            This adjustment is no longer on the sheet. Save adds it as a new
            adjustment.
          </p>
        ) : (
          <RemoteNotice
            isShown={editor.hasRemoteChange}
            message={
              isDirty
                ? 'This adjustment changed while you were editing. Your edits are kept.'
                : 'Updated by another player.'
            }
            subject="adjustment"
            onDismiss={editor.dismissRemoteChange}
          />
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button
            type="submit"
            size="sm"
            className={action}
            disabled={isSaving || isDisabled}
          >
            {isSaving ? 'Saving…' : 'Save adjustment'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={action}
            onClick={onClose}
          >
            Close <span className="sr-only">editor</span>
          </Button>
          <SaveFeedback status={editor.status} savedText="Saved." />
          {isSaved && isDirty ? (
            <p className="text-xs text-amber-300">Unsaved edits.</p>
          ) : null}
          <MaintenanceReason notice={maintenance} />
        </div>
      </form>
    </Form>
  );
}
