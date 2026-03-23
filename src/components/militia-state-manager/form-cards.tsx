import type { FieldPath, FieldValues, UseFormReturn } from 'react-hook-form';
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
  cacheClassOptions,
  cacheStatusOptions,
  eventTypeOptions,
  formatEventTypeLabel,
  formatFocusLabel,
  formatOrderSourceActionLabel,
  formatOrderStatusLabel,
  formatQueuedEffectKindLabel,
  formatTrackedPersonKindLabel,
  formatTrackedPersonLocationLabel,
  formatTrackedPersonSourceActionLabel,
  formatTrackedPersonStatusLabel,
  formatWeekPhaseLabel,
  militiaFocusOptions,
  orderSourceActionOptions,
  orderStatusOptions,
  queuedEffectKindOptions,
  trackedPersonKindOptions,
  trackedPersonLocationOptions,
  trackedPersonSourceActionOptions,
  trackedPersonStatusOptions,
  weekPhaseOptions,
} from '~/lib/militia-state-options';
import { formatTeamIdLabel, TEAM_IDS } from '~/lib/team-ids';
import type {
  CacheStateFormValues,
  CharacterOption,
  EventStateFormValues,
  MilitiaCoreFormValues,
  OrderStateFormValues,
  QueueEffectFormValues,
  TeamStateFormValues,
  TrackedPersonFormValues,
  WeekContextFormValues,
} from './types';

export function MilitiaCoreFormCard({
  form,
  onSubmit,
  onCancel,
  submitError,
}: {
  form: UseFormReturn<MilitiaCoreFormValues>;
  onSubmit: (values: MilitiaCoreFormValues) => Promise<void>;
  onCancel: () => void;
  submitError?: string;
}) {
  return (
    <FormShell form={form} onSubmit={onSubmit} onCancel={onCancel} submitError={submitError}>
      <div className="grid grid-cols-1 gap-1.5 md:grid-cols-3">
        <TextField form={form} name="name" label="Militia name" className="md:col-span-3" />
        <NumberField form={form} name="rank" label="Rank" />
        <NumberField form={form} name="highestBoonReached" label="Highest boon reached" />
        <NumberField form={form} name="training" label="Training" />
        <NumberField form={form} name="treasury" label="Treasury" />
        <NumberField form={form} name="notoriety" label="Notoriety" />
        <SelectField
          form={form}
          name="focus"
          label="Focus"
          options={[
            { value: 'none', label: formatFocusLabel(null) },
            ...militiaFocusOptions.map((focus) => ({
              value: focus,
              label: formatFocusLabel(focus),
            })),
          ]}
        />
        <TextField
          form={form}
          name="HQLocation"
          label="HQ location"
          className="md:col-span-3"
        />
      </div>
    </FormShell>
  );
}

export function WeekContextFormCard({
  form,
  onSubmit,
  onCancel,
  submitError,
}: {
  form: UseFormReturn<WeekContextFormValues>;
  onSubmit: (values: WeekContextFormValues) => Promise<void>;
  onCancel: () => void;
  submitError?: string;
}) {
  return (
    <FormShell form={form} onSubmit={onSubmit} onCancel={onCancel} submitError={submitError}>
      <div className="grid grid-cols-1 gap-1.5 md:grid-cols-3">
        <NumberField form={form} name="weekNumber" label="Week number" />
        <SelectField
          form={form}
          name="phase"
          label="Current phase"
          options={weekPhaseOptions.map((phase) => ({
            value: phase,
            label: formatWeekPhaseLabel(phase),
          }))}
        />
        <NumberField
          form={form}
          name="uneventfulBonusCarry"
          label="Uneventful bonus carry"
        />
        <SelectField
          form={form}
          name="isFirstWeek"
          label="First week"
          options={yesNoOptions}
        />
        <SelectField
          form={form}
          name="skippedUpkeepThisWeek"
          label="Skipped upkeep this week"
          options={yesNoOptions}
        />
        <NumberField
          form={form}
          name="lastPersistentBuyoffWeek"
          label="Last persistent buyoff week"
          optional
        />
      </div>
    </FormShell>
  );
}

export function QueueEffectFormCard({
  form,
  onSubmit,
  onCancel,
  submitError,
}: {
  form: UseFormReturn<QueueEffectFormValues>;
  onSubmit: (values: QueueEffectFormValues) => Promise<void>;
  onCancel: () => void;
  submitError?: string;
}) {
  return (
    <FormShell form={form} onSubmit={onSubmit} onCancel={onCancel} submitError={submitError}>
      <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
        <SelectField
          form={form}
          name="kind"
          label="Queued effect"
          options={queuedEffectKindOptions.map((kind) => ({
            value: kind,
            label: formatQueuedEffectKindLabel(kind),
          }))}
        />
        <NumberField form={form} name="appliesWeek" label="Applies week" />
        <TextField form={form} name="note" label="Note" className="md:col-span-2" />
      </div>
    </FormShell>
  );
}

export function TeamStateFormCard({
  form,
  onSubmit,
  onCancel,
  submitError,
}: {
  form: UseFormReturn<TeamStateFormValues>;
  onSubmit: (values: TeamStateFormValues) => Promise<void>;
  onCancel: () => void;
  submitError?: string;
}) {
  return (
    <FormShell form={form} onSubmit={onSubmit} onCancel={onCancel} submitError={submitError}>
      <div className="grid grid-cols-1 gap-1.5 md:grid-cols-3">
        <SelectField
          form={form}
          name="teamId"
          label="Team"
          options={TEAM_IDS.map((teamId) => ({
            value: teamId,
            label: formatTeamIdLabel(teamId),
          }))}
        />
        <SelectField
          form={form}
          name="status"
          label="Status"
          options={[
            { value: 'active', label: 'Active' },
            { value: 'disabled', label: 'Disabled' },
            { value: 'missing', label: 'Missing' },
            { value: 'blocked', label: 'Blocked' },
          ]}
        />
        <NumberField
          form={form}
          name="unavailableUntilWeek"
          label="Unavailable until week"
          optional
        />
        <TextField form={form} name="notes" label="Notes" className="md:col-span-3" />
      </div>
    </FormShell>
  );
}

export function CacheStateFormCard({
  form,
  onSubmit,
  onCancel,
  submitError,
}: {
  form: UseFormReturn<CacheStateFormValues>;
  onSubmit: (values: CacheStateFormValues) => Promise<void>;
  onCancel: () => void;
  submitError?: string;
}) {
  return (
    <FormShell form={form} onSubmit={onSubmit} onCancel={onCancel} submitError={submitError}>
      <div className="grid grid-cols-1 gap-1.5 md:grid-cols-3">
        <TextField form={form} name="label" label="Cache label" className="md:col-span-3" />
        <SelectField
          form={form}
          name="cacheClass"
          label="Cache class"
          options={cacheClassOptions.map((cacheClass) => ({
            value: cacheClass,
            label:
              cacheClass === 'intermediate'
                ? 'Intermediate'
                : cacheClass === 'major'
                  ? 'Major'
                  : 'Minor',
          }))}
        />
        <SelectField
          form={form}
          name="status"
          label="Status"
          options={cacheStatusOptions.map((status) => ({
            value: status,
            label:
              status === 'pending_return'
                ? 'Pending return'
                : status === 'retrieved'
                  ? 'Retrieved'
                  : status === 'lost'
                    ? 'Lost'
                    : 'Hidden',
          }))}
        />
        <SelectField
          form={form}
          name="secureLocation"
          label="Secure location"
          options={yesNoOptions}
        />
        <TextField form={form} name="location" label="Location" className="md:col-span-3" />
        <TextField
          form={form}
          name="contentsSummary"
          label="Contents"
          className="md:col-span-3"
        />
        <NumberField form={form} name="createdWeek" label="Created week" />
        <NumberField form={form} name="updatedWeek" label="Updated week" />
        <NumberField form={form} name="retrievedWeek" label="Retrieved week" optional />
        <NumberField form={form} name="lostWeek" label="Lost week" optional />
      </div>
    </FormShell>
  );
}

export function OrderStateFormCard({
  form,
  onSubmit,
  onCancel,
  submitError,
  marketplaceOptions,
}: {
  form: UseFormReturn<OrderStateFormValues>;
  onSubmit: (values: OrderStateFormValues) => Promise<void>;
  onCancel: () => void;
  submitError?: string;
  marketplaceOptions: Array<{ value: string; label: string }>;
}) {
  return (
    <FormShell form={form} onSubmit={onSubmit} onCancel={onCancel} submitError={submitError}>
      <div className="grid grid-cols-1 gap-1.5 md:grid-cols-3">
        <TextField
          form={form}
          name="description"
          label="Order description"
          className="md:col-span-3"
        />
        <SelectField
          form={form}
          name="status"
          label="Status"
          options={orderStatusOptions.map((status) => ({
            value: status,
            label: formatOrderStatusLabel(status),
          }))}
        />
        <SelectField
          form={form}
          name="sourceAction"
          label="Source action"
          options={[
            { value: 'none', label: 'None' },
            ...orderSourceActionOptions.map((sourceAction) => ({
              value: sourceAction,
              label: formatOrderSourceActionLabel(sourceAction),
            })),
          ]}
        />
        <SelectField
          form={form}
          name="marketplaceId"
          label="Linked marketplace"
          options={[{ value: '', label: 'None' }, ...marketplaceOptions]}
        />
        <NumberField form={form} name="costPaid" label="Cost paid" optional />
        <NumberField form={form} name="deliveryDays" label="Delivery days" />
        <NumberField form={form} name="orderedWeek" label="Ordered week" />
        <NumberField form={form} name="dueWeek" label="Due week" />
        <NumberField form={form} name="deliveredWeek" label="Delivered week" optional />
        <TextField form={form} name="notes" label="Notes" className="md:col-span-3" />
      </div>
    </FormShell>
  );
}

export function TrackedPersonFormCard({
  form,
  onSubmit,
  onCancel,
  submitError,
  characterOptions,
  settlementOptions,
}: {
  form: UseFormReturn<TrackedPersonFormValues>;
  onSubmit: (values: TrackedPersonFormValues) => Promise<void>;
  onCancel: () => void;
  submitError?: string;
  characterOptions: CharacterOption[];
  settlementOptions: string[];
}) {
  const targetSource = form.watch('targetSource');
  const locationType = form.watch('locationType');

  return (
    <FormShell form={form} onSubmit={onSubmit} onCancel={onCancel} submitError={submitError}>
      <div className="grid grid-cols-1 gap-1.5 md:grid-cols-3">
        <SelectField
          form={form}
          name="targetSource"
          label="Character source"
          options={[
            { value: 'none', label: 'Freeform' },
            { value: 'character', label: 'Character ledger' },
          ]}
        />
        {targetSource === 'character' ? (
          <SelectField
            form={form}
            name="characterId"
            label="Character"
            options={[
              { value: '', label: 'Select character' },
              ...characterOptions.map((character) => ({
                value: character._id,
                label: `${character.name} (lvl ${character.level})`,
              })),
            ]}
          />
        ) : null}
        <TextField form={form} name="displayName" label="Tracked person name" />
        <SelectField
          form={form}
          name="personKind"
          label="Person type"
          options={trackedPersonKindOptions.map((kind) => ({
            value: kind,
            label: formatTrackedPersonKindLabel(kind),
          }))}
        />
        <SelectField
          form={form}
          name="status"
          label="Status"
          options={trackedPersonStatusOptions.map((status) => ({
            value: status,
            label: formatTrackedPersonStatusLabel(status),
          }))}
        />
        <NumberField form={form} name="level" label="Level" optional />
        <SelectField
          form={form}
          name="locationType"
          label="Location type"
          options={trackedPersonLocationOptions.map((locationTypeValue) => ({
            value: locationTypeValue,
            label: formatTrackedPersonLocationLabel(locationTypeValue),
          }))}
        />
        {locationType === 'settlement' || locationType === 'refuge' ? (
          <SelectField
            form={form}
            name="settlementKey"
            label="Settlement"
            options={[
              { value: '', label: 'None' },
              ...settlementOptions.map((settlementKey) => ({
                value: settlementKey,
                label: settlementKey,
              })),
            ]}
          />
        ) : null}
        {locationType === 'site' ? (
          <TextField form={form} name="siteName" label="Site name" />
        ) : null}
        <SelectField
          form={form}
          name="sourceAction"
          label="Source"
          options={trackedPersonSourceActionOptions.map((sourceAction) => ({
            value: sourceAction,
            label: formatTrackedPersonSourceActionLabel(sourceAction),
          }))}
        />
        <NumberField form={form} name="activeUntilWeek" label="Active until week" optional />
        <NumberField form={form} name="hiddenSinceWeek" label="Hidden since week" optional />
        <NumberField
          form={form}
          name="capturedSinceWeek"
          label="Captured since week"
          optional
        />
        <NumberField form={form} name="rescuedWeek" label="Rescued week" optional />
        <NumberField form={form} name="restoredWeek" label="Restored week" optional />
        <NumberField
          form={form}
          name="rescueDcOverride"
          label="Rescue DC override"
          optional
        />
        <TextField form={form} name="notes" label="Notes" className="md:col-span-3" />
      </div>
    </FormShell>
  );
}

export function EventStateFormCard({
  form,
  onSubmit,
  onCancel,
  submitError,
}: {
  form: UseFormReturn<EventStateFormValues>;
  onSubmit: (values: EventStateFormValues) => Promise<void>;
  onCancel: () => void;
  submitError?: string;
}) {
  return (
    <FormShell form={form} onSubmit={onSubmit} onCancel={onCancel} submitError={submitError}>
      <div className="grid grid-cols-1 gap-1.5 md:grid-cols-3">
        <NumberField form={form} name="weekNumber" label="Week number" />
        <SelectField
          form={form}
          name="eventType"
          label="Event type"
          options={eventTypeOptions.map((eventType) => ({
            value: eventType,
            label: formatEventTypeLabel(eventType),
          }))}
        />
        <SelectField
          form={form}
          name="isPersistent"
          label="Persistent"
          options={yesNoOptions}
        />
        <NumberField form={form} name="startedWeek" label="Started week" />
        <NumberField form={form} name="endedWeek" label="Ended week" optional />
        <NumberField
          form={form}
          name="mitigationUntilWeek"
          label="Mitigation until week"
          optional
        />
        <SelectField form={form} name="resolved" label="Resolved" options={yesNoOptions} />
      </div>
    </FormShell>
  );
}

function FormShell<TFieldValues extends FieldValues>({
  form,
  onSubmit,
  onCancel,
  submitError,
  children,
}: {
  form: UseFormReturn<TFieldValues>;
  onSubmit: (values: TFieldValues) => Promise<void>;
  onCancel: () => void;
  submitError?: string;
  children: React.ReactNode;
}) {
  return (
    <Form {...form}>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
        {submitError ? (
          <div className="border-destructive/50 bg-destructive/10 text-destructive p-2 font-mono text-sm">
            {submitError}
          </div>
        ) : null}
        {children}
        <div className="mt-4 flex gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving...' : 'Save'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={form.formState.isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}

function TextField<TFieldValues extends FieldValues>({
  form,
  name,
  label,
  className,
}: {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  className?: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel className="font-mono text-sm">{label}</FormLabel>
          <FormControl>
            <Input {...field} className="border-primary bg-card border-2 font-mono" />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function NumberField<TFieldValues extends FieldValues>({
  form,
  name,
  label,
  optional = false,
}: {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  optional?: boolean;
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
              type="text"
              inputMode="numeric"
              placeholder={optional ? 'Optional' : undefined}
              className="border-primary bg-card border-2 font-mono"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function SelectField<TFieldValues extends FieldValues>({
  form,
  name,
  label,
  options,
}: {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="font-mono text-sm">{label}</FormLabel>
          <FormControl>
            <Select value={field.value as string | undefined} onValueChange={field.onChange}>
              <SelectTrigger className="border-primary bg-card w-full border-2 font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-primary bg-card border-2 font-mono">
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

const yesNoOptions = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];
