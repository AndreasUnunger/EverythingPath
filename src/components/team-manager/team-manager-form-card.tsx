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
import type { CharacterRecord, TeamManagerFormValues } from './types';

export function TeamManagerFormCard({
  form,
  characters,
  onSubmit,
  onCancel,
  submitError,
}: {
  form: UseFormReturn<TeamManagerFormValues>;
  characters: CharacterRecord[];
  onSubmit: (values: TeamManagerFormValues) => Promise<void>;
  onCancel: () => void;
  submitError?: string;
}) {
  const isSubmitting = form.formState.isSubmitting;
  const managerSource = form.watch('managerSource');

  return (
    <Form {...form}>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
        {submitError ? (
          <div className="border-destructive/50 bg-destructive/10 text-destructive p-2 font-mono text-sm">
            {submitError}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
          <FormField
            control={form.control}
            name="managerSource"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-mono text-sm">Manager source</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="border-primary bg-card w-full border-2 font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-primary bg-card border-2 font-mono">
                      <SelectItem value="none">No manager</SelectItem>
                      <SelectItem value="character">Character ledger</SelectItem>
                      <SelectItem value="freeform">Freeform manager</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {managerSource === 'character' ? (
          <FormField
            control={form.control}
            name="managerCharacterId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-mono text-sm">Manager character</FormLabel>
                <FormControl>
                  <Select
                    value={field.value === '' ? undefined : field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="border-primary bg-card w-full border-2 font-mono">
                      <SelectValue placeholder="Select character" />
                    </SelectTrigger>
                    <SelectContent className="border-primary bg-card border-2 font-mono">
                      {characters.map((character) => (
                        <SelectItem key={character._id} value={character._id}>
                          {character.name} ({character.kind ?? 'pc'}, CHA {character.charisma})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        {managerSource === 'freeform' ? (
          <div className="grid grid-cols-1 gap-1.5 md:grid-cols-3">
            <FormField
              control={form.control}
              name="managerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-sm">Manager name</FormLabel>
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
              name="managerKind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-sm">Manager type</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="border-primary bg-card w-full border-2 font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-primary bg-card border-2 font-mono">
                        <SelectItem value="pc">PC</SelectItem>
                        <SelectItem value="officer_npc">Officer NPC</SelectItem>
                        <SelectItem value="other_npc">Other NPC</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="managerCharisma"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-sm">Manager Charisma</FormLabel>
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
          </div>
        ) : null}

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
