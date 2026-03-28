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
import {
  settlementReputationOptions,
  type SettlementFormValues,
} from './types';

export function SettlementFormCard({
  form,
  onSubmit,
  onCancel,
  submitError,
}: {
  form: UseFormReturn<SettlementFormValues>;
  onSubmit: (values: SettlementFormValues) => Promise<void>;
  onCancel: () => void;
  submitError?: string;
}) {
  const isSubmitting = form.formState.isSubmitting;

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

        <div className="grid grid-cols-1 gap-1.5 md:grid-cols-3">
          <FormField
            control={form.control}
            name="settlementKey"
            render={({ field }) => (
              <FormItem className="md:col-span-3">
                <FormLabel className="font-mono text-sm">Settlement name</FormLabel>
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
            name="reputation"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-mono text-sm">Reputation</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="border-primary bg-card w-full border-2 font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-primary bg-card border-2 font-mono">
                      {settlementReputationOptions.map((reputation) => (
                        <SelectItem key={reputation} value={reputation}>
                          {reputation}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="securedState"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-mono text-sm">Secured</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="border-primary bg-card w-full border-2 font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-primary bg-card border-2 font-mono">
                      <SelectItem value="unsecured">No</SelectItem>
                      <SelectItem value="secured">Yes</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
