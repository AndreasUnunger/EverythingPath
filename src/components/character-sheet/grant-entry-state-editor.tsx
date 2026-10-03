'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
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
import type { GrantEntryView } from './character-sheet-grants-view-model';
import { action, fieldLabel } from './sheet-parts';
import type { useCharacterSheet } from './use-character-sheet';

type Actions = ReturnType<typeof useCharacterSheet>['grants'];

const schema = z.object({ choice: z.string(), notes: z.string() });
type Values = z.infer<typeof schema>;

/**
 * The recorded state of one Grant or dormant Selection, edited in place: its
 * structural choice where the kind has one, and its notes. Both may be
 * empty. Saving records state only; a Grant stays a Grant. The editor stays
 * open until the hook confirms the save or the player cancels.
 */
export function GrantEntryStateEditor({
  row,
  actions,
  onClose,
}: {
  row: GrantEntryView;
  actions: Actions;
  onClose: () => void;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { choice: row.choice ?? '', notes: row.notes },
  });
  const isSaving = actions.statusFor(row.rowId).kind === 'saving';
  const isDisabled = isSaving || maintenance.readOnly;

  async function save(values: Values) {
    const state = row.canEditChoice
      ? { choice: values.choice.trim() || null, notes: values.notes }
      : { notes: values.notes };
    if (await actions.edit(row, state)) onClose();
  }

  return (
    <Form {...form}>
      <form
        noValidate
        aria-label={`Edit ${row.name}`}
        className="border-foreground/20 mt-2 w-full space-y-2 border p-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (isDisabled) return;
          void form.handleSubmit(save)();
        }}
      >
        {row.canEditChoice ? (
          <FormField
            control={form.control}
            name="choice"
            render={({ field, fieldState }) => (
              <FormItem className="gap-0.5">
                <FormLabel className={fieldLabel}>
                  Choice <span className="sr-only">for {row.name}</span>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    autoFocus
                    autoComplete="off"
                    disabled={isDisabled}
                    className="h-11 md:h-8"
                  />
                </FormControl>
                <FormMessage role={fieldState.error ? 'alert' : undefined} />
              </FormItem>
            )}
          />
        ) : null}
        <FormField
          control={form.control}
          name="notes"
          render={({ field, fieldState }) => (
            <FormItem className="gap-0.5">
              <FormLabel className={fieldLabel}>
                Notes <span className="sr-only">for {row.name}</span>
              </FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  autoFocus={!row.canEditChoice}
                  rows={2}
                  disabled={isDisabled}
                  className="min-h-11 md:min-h-8"
                />
              </FormControl>
              <FormMessage role={fieldState.error ? 'alert' : undefined} />
            </FormItem>
          )}
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button
            type="submit"
            size="sm"
            className={action}
            disabled={isDisabled}
          >
            Save <span className="sr-only">{row.name}</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={action}
            onClick={onClose}
          >
            Cancel <span className="sr-only">editing {row.name}</span>
          </Button>
        </div>
      </form>
    </Form>
  );
}
