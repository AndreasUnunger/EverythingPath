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
  marketplaceAvailabilityTierOptions,
  marketplaceContrabandOptions,
  type MarketplaceFormInput,
  marketplaceSourceActionOptions,
  marketplaceTeamOptions,
  type MarketplaceFormValues,
} from './types';
import { formatTeamIdLabel } from '~/lib/team-ids';

export function MarketplaceFormCard({
  form,
  onSubmit,
  onCancel,
  submitError,
  knownTeamIds,
  applyProfileDefaults,
}: {
  form: UseFormReturn<MarketplaceFormInput, unknown, MarketplaceFormValues>;
  onSubmit: (values: MarketplaceFormValues) => Promise<void>;
  onCancel: () => void;
  submitError?: string;
  knownTeamIds: string[];
  applyProfileDefaults: (args: {
    sourceAction: MarketplaceFormValues['sourceAction'];
    teamId: string;
  }) => void;
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
            name="label"
            render={({ field }) => (
              <FormItem className="md:col-span-3">
                <FormLabel className="font-mono text-sm">Marketplace label</FormLabel>
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
            name="sourceAction"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-mono text-sm">Source</FormLabel>
                <FormControl>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      applyProfileDefaults({
                        sourceAction: value as MarketplaceFormValues['sourceAction'],
                        teamId: form.getValues('teamId'),
                      });
                    }}
                  >
                    <SelectTrigger className="border-primary bg-card w-full border-2 font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-primary bg-card border-2 font-mono">
                      {marketplaceSourceActionOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option === 'broker_market'
                            ? 'Broker Market'
                            : 'Activate Black Market'}
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
            name="teamId"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel className="font-mono text-sm">Team</FormLabel>
                <FormControl>
                  <Select
                    value={field.value === '' ? undefined : field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      applyProfileDefaults({
                        sourceAction: form.getValues('sourceAction'),
                        teamId: value,
                      });
                    }}
                  >
                    <SelectTrigger className="border-primary bg-card w-full border-2 font-mono">
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent className="border-primary bg-card border-2 font-mono">
                      {marketplaceTeamOptions.map((teamId) => {
                        const isKnownTeam = knownTeamIds.includes(teamId);
                        return (
                          <SelectItem key={teamId} value={teamId}>
                            {formatTeamIdLabel(teamId)}
                            {isKnownTeam ? ' (in roster)' : ''}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </FormControl>
                {knownTeamIds.length > 0 ? (
                  <p className="text-muted-foreground font-mono text-xs">
                    Current roster: {knownTeamIds.join(', ')}
                  </p>
                ) : null}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="availabilityTier"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-mono text-sm">Availability tier</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="border-primary bg-card w-full border-2 font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-primary bg-card border-2 font-mono">
                      {marketplaceAvailabilityTierOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option === 'small_town' ? 'Small town' : 'Small city'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <NumberField form={form} name="availabilityThreshold" label="Availability %" />
          <NumberField form={form} name="saleValuePercent" label="Sale value %" />

          <FormField
            control={form.control}
            name="contrabandAllowed"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-mono text-sm">Contraband allowed</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="border-primary bg-card w-full border-2 font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-primary bg-card border-2 font-mono">
                      {marketplaceContrabandOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option === 'yes' ? 'Yes' : 'No'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <NumberField form={form} name="createdWeek" label="Created week" />
          <NumberField form={form} name="activeUntilWeek" label="Active through week" />
          <NumberField
            form={form}
            name="marketDayDiscountPercent"
            label="Market Day discount %"
          />
          <NumberField
            form={form}
            name="marketDayAppliedWeek"
            label="Market Day applied week"
          />

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem className="md:col-span-3">
                <FormLabel className="font-mono text-sm">Notes</FormLabel>
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

function NumberField({
  form,
  name,
  label,
}: {
  form: UseFormReturn<MarketplaceFormInput, unknown, MarketplaceFormValues>;
  name:
    | 'availabilityThreshold'
    | 'saleValuePercent'
    | 'createdWeek'
    | 'activeUntilWeek'
    | 'marketDayDiscountPercent'
    | 'marketDayAppliedWeek';
  label: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="font-mono text-sm">{label}</FormLabel>
          <FormControl>
            <Input
              {...field}
              inputMode="numeric"
              className="border-primary bg-card border-2 font-mono"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
