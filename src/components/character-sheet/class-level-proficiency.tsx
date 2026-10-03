'use client';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { cn } from '~/lib/utils';
import { RemoteNotice, SaveFeedback } from './sheet-parts';
import { useProficiencyChoiceForm } from './use-character-sheet-skills';

/**
 * The weapon chosen for a proficiency this Class Level may grant, recorded
 * as typed and saved when the field is left or on Enter; a blank clears it.
 * The sheet records the choice only: no proficiency is granted from it yet,
 * and a level without one is never marked as missing a choice.
 */
export function ProficiencyChoiceCell({
  level,
  choice,
  save,
  className,
}: {
  level: number;
  choice: string | null | undefined;
  save: (choice: string | null) => Promise<unknown>;
  className?: string;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const editor = useProficiencyChoiceForm({ choice, save });
  const isDirty = editor.form.formState.isDirty;
  const isSaving = editor.status.kind === 'saving';
  return (
    <Form {...editor.form}>
      <div
        className={cn('flex flex-wrap items-start gap-x-3 gap-y-1', className)}
      >
        <FormField
          control={editor.form.control}
          name="value"
          render={({ field }) => (
            <FormItem className="gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <FormLabel className="font-mono text-sm font-normal">
                  Proficiency{' '}
                  <span className="sr-only">choice at level {level}</span>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    disabled={maintenance.readOnly}
                    type="text"
                    autoComplete="off"
                    className="h-10 w-44 font-mono text-sm md:h-8"
                    onBlur={() => {
                      field.onBlur();
                      if (maintenance.readOnly || !isDirty) return;
                      void editor.save();
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return;
                      event.preventDefault();
                      if (maintenance.readOnly || !isDirty) return;
                      void editor.save();
                    }}
                  />
                </FormControl>
                {isDirty || isSaving ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-10 md:min-h-8"
                    aria-describedby={reasonId}
                    disabled={isSaving || maintenance.readOnly}
                    onClick={() => {
                      if (maintenance.readOnly) return;
                      void editor.save();
                    }}
                  >
                    {isSaving ? 'Saving…' : 'Save proficiency'}
                  </Button>
                ) : null}
              </div>
              {field.value.trim() === '' ? (
                <FormDescription className="text-xs">
                  Choose a weapon if this class grants a proficiency choice.
                </FormDescription>
              ) : null}
            </FormItem>
          )}
        />
        <SaveFeedback status={editor.status} savedText="Proficiency saved." />
        <RemoteNotice
          isShown={editor.hasRemoteChange}
          message={
            isDirty
              ? 'Updated by another player. Your edits are kept.'
              : 'Updated by another player.'
          }
          subject={`level ${level} proficiency`}
          onDismiss={editor.dismissRemoteChange}
        />
      </div>
    </Form>
  );
}
