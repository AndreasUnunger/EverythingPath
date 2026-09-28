'use client';
import { Archive, ArchiveRestore, TriangleAlert } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Textarea } from '~/components/ui/textarea';
import { CHARACTER_KINDS, formatCharacterKind } from '~/lib/character-kind';
import type { CharacterFormValues } from './types';
import type { CharacterRecordForm } from './use-character-record';

const SCORE_FIELDS = [
  ['strength', 'STR'],
  ['dexterity', 'DEX'],
  ['constitution', 'CON'],
  ['intelligence', 'INT'],
  ['wisdom', 'WIS'],
  ['charisma', 'CHA'],
] as const satisfies readonly (readonly [keyof CharacterFormValues, string])[];

const label = 'font-mono text-sm';
const control = 'border-primary bg-card border-2 font-mono';
const action = 'min-h-11 md:min-h-9';

// The Add/Edit character dialog's markup: every record field with its own
// validation message, the refused write, and Save / Cancel with Archive or
// Un-archive on an existing record.
export function CharacterRecordDialogView({
  open,
  onOpenChange,
  recordForm,
  archiveWarning,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordForm: CharacterRecordForm;
  archiveWarning: string | null;
}) {
  const { form, record, submitError, pending } = recordForm;
  const busy = pending !== null;
  const archived = record?.isActive === false;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="border-primary bg-card max-h-[calc(100dvh-2rem)] overflow-y-auto border-2 font-mono sm:max-w-3xl"
      >
        {/* The badge sits beside the title, so the dialog's name stays
            "Edit character". */}
        <DialogHeader className="flex-row flex-wrap items-center gap-2">
          <DialogTitle className="font-sans text-xl">
            {record ? 'Edit character' : 'Add character'}
          </DialogTitle>
          {archived && (
            <Badge variant="outline" className="font-mono font-normal">
              Archived
            </Badge>
          )}
        </DialogHeader>
        <Form {...form}>
          <form
            noValidate
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              recordForm.save();
            }}
          >
            {submitError && (
              <div
                role="alert"
                className="border-destructive/50 bg-destructive/10 text-destructive border p-2 text-sm"
              >
                {submitError}
              </div>
            )}

            <div className="grid grid-cols-2 items-start gap-3 md:grid-cols-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className={label}>Name</FormLabel>
                    <FormControl>
                      <Input {...field} className={control} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={label}>Hit Dice</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="text"
                        inputMode="numeric"
                        className={control}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={label}>Kind</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className={`${control} w-full`}>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className={control}>
                        {CHARACTER_KINDS.map((kind) => (
                          <SelectItem key={kind} value={kind}>
                            {formatCharacterKind(kind)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 items-start gap-3 md:grid-cols-6">
              {SCORE_FIELDS.map(([name, text]) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={label}>{text}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="text"
                          inputMode="numeric"
                          className={control}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={label}>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} className={control} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {archiveWarning !== null && record && !archived && (
              <p className="flex items-start gap-2 text-sm text-amber-300">
                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {archiveWarning}
                </span>
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              {record && (
                <Button
                  type="button"
                  variant="outline"
                  className={action}
                  disabled={busy}
                  onClick={() => recordForm.toggleArchive()}
                >
                  {archived ? <ArchiveRestore /> : <Archive />}
                  {archived
                    ? pending === 'archive'
                      ? 'Un-archiving…'
                      : 'Un-archive'
                    : pending === 'archive'
                      ? 'Archiving…'
                      : 'Archive'}
                </Button>
              )}
              <div className="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className={action}
                  disabled={busy}
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className={action} disabled={busy}>
                  {pending === 'save' ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
