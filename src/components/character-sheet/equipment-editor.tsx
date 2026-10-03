'use client';
import { MaintenanceReason } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { Checkbox } from '~/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { action, fieldLabel, RemoteNotice, SaveFeedback } from './sheet-parts';
import type { useCharacterSheet } from './use-character-sheet';
import { useEquipmentForm, type EquipmentValues } from './use-equipment-form';

type Row = ReturnType<typeof useCharacterSheet>['equipment']['rows'][number];

/**
 * One armor or shield's own gear state, edited in place: enhancement,
 * masterwork and the material it is made of. A specific item's catalog
 * material is shown as fact, not edited. Saving keeps the editor open with
 * its acknowledgement; Cancel or Close returns to the row.
 */
export function EquipmentEditor({
  row,
  save,
  onClose,
}: {
  row: Row;
  save: (values: Required<EquipmentValues>) => Promise<unknown>;
  onClose: () => void;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const editor = useEquipmentForm({
    value: {
      masterwork: row.masterwork,
      enhancement: row.enhancement,
      material: row.material,
    },
    save,
  });
  const isDirty = editor.form.formState.isDirty;
  const isSaving = editor.status.kind === 'saving';
  const isDisabled = maintenance.readOnly;
  const isMasterworkSupplied =
    row.calculated?.masterwork === true && !row.masterwork;
  return (
    <Form {...editor.form}>
      <form
        noValidate
        aria-label={`Edit ${row.name}`}
        className="border-foreground/20 mt-2 w-full space-y-3 border p-3"
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          onClose();
        }}
        onSubmit={(event) => {
          event.preventDefault();
          if (isDisabled || isSaving) return;
          void editor.save();
        }}
      >
        <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
          <FormField
            control={editor.form.control}
            name="enhancement"
            render={({ field, fieldState }) => (
              <FormItem className="gap-1">
                <FormLabel className={fieldLabel}>Enhancement</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    autoFocus
                    disabled={isDisabled}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    className="h-11 w-24 text-center font-mono md:h-8"
                  />
                </FormControl>
                <FormMessage
                  role={fieldState.error ? 'alert' : undefined}
                  className="max-w-56"
                />
              </FormItem>
            )}
          />
          <FormField
            control={editor.form.control}
            name="masterwork"
            render={({ field }) => (
              <FormItem className="gap-1">
                <span aria-hidden className={fieldLabel}>
                  &nbsp;
                </span>
                <FormLabel className="min-h-11 cursor-pointer gap-2 font-mono text-sm font-normal md:min-h-8">
                  <FormControl>
                    <Checkbox
                      name={field.name}
                      ref={field.ref}
                      checked={field.value}
                      disabled={isDisabled}
                      onBlur={field.onBlur}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <span>Masterwork</span>
                </FormLabel>
                {isMasterworkSupplied ? (
                  <p className="text-muted-foreground max-w-56 text-xs">
                    Already masterwork through its enhancement or material.
                  </p>
                ) : null}
              </FormItem>
            )}
          />
          {row.catalogMaterial ? (
            <div className="flex flex-col gap-1">
              <span className={fieldLabel}>Item material</span>
              <span className="inline-flex min-h-11 items-center text-sm md:min-h-8">
                {row.catalogMaterial}
              </span>
            </div>
          ) : null}
          <FormField
            control={editor.form.control}
            name="material"
            render={({ field, fieldState }) => (
              <FormItem className="min-w-0 gap-1">
                <FormLabel className={fieldLabel}>Material</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    disabled={isDisabled}
                    type="text"
                    autoComplete="off"
                    className="h-11 w-full max-w-56 md:h-8 md:w-44"
                  />
                </FormControl>
                <FormMessage
                  role={fieldState.error ? 'alert' : undefined}
                  className="max-w-56"
                />
              </FormItem>
            )}
          />
        </div>
        <RemoteNotice
          isShown={editor.hasRemoteChange}
          message={
            isDirty
              ? 'Changed by another player. Your edits are kept.'
              : 'Changed by another player.'
          }
          subject={row.name}
          onDismiss={editor.dismissRemoteChange}
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button
            type="submit"
            size="sm"
            className={action}
            disabled={isSaving || isDisabled}
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
            {isDirty ? 'Cancel' : 'Close'}{' '}
            <span className="sr-only">editing {row.name}</span>
          </Button>
          <SaveFeedback status={editor.status} savedText="Saved" />
          <MaintenanceReason notice={maintenance} />
        </div>
      </form>
    </Form>
  );
}
