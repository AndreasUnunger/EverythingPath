import type { UseFormReturn } from 'react-hook-form';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { CHARACTER_KINDS, formatCharacterKind } from '~/lib/character-kind';
import { type CharacterFormValues } from './types';

export function CharacterFormCard({
  form,
  onSubmit,
  onCancel,
  submitError,
}: {
  form: UseFormReturn<CharacterFormValues>;
  onSubmit: (values: CharacterFormValues) => Promise<void>;
  onCancel: () => void;
  submitError?: string;
}) {
  const isSubmitting = form.formState.isSubmitting;
  const statFields = [
    ['strength', 'STR'],
    ['dexterity', 'DEX'],
    ['constitution', 'CON'],
    ['intelligence', 'INT'],
    ['wisdom', 'WIS'],
    ['charisma', 'CHA'],
  ] as const;

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-2"
      >
        {submitError ? (
          <div className="border-destructive/50 bg-destructive/10 text-destructive p-2 font-mono text-sm">
            {submitError}
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
          <div className="md:col-span-2">
            <div className="grid grid-cols-1 gap-1.5 md:grid-cols-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel className="font-mono text-sm">Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="border-primary bg-card border-2 font-mono"
                      />
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
                    <FormLabel className="font-mono text-sm">Level</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="text"
                        inputMode="numeric"
                        className="border-primary bg-card border-2 font-mono"
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
                    <FormLabel className="font-mono text-sm">Kind</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="border-primary bg-card w-full border-2 font-mono">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="border-primary bg-card border-2 font-mono">
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
          </div>

          <div className="md:col-span-2">
            <div className="grid grid-cols-1 gap-1.5 md:grid-cols-6">
              {statFields.map(([name, label]) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-sm">
                        {label}
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="text"
                          inputMode="numeric"
                          className="border-primary bg-card border-2 font-mono"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-sm">Notes</FormLabel>
                  <FormControl>
                    <textarea
                      {...field}
                      className="border-primary bg-card focus-visible:border-ring focus-visible:ring-ring/50 w-full border-2 px-3 py-2 font-mono text-sm outline-none focus-visible:ring-[3px]"
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
