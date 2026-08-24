'use client';

import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  eventTypeOptions,
  formatTeamStatusLabel,
  teamStatusOptions,
} from '~/lib/militia-state-options';
import { formatTeamIdLabel, TEAM_IDS } from '~/lib/team-ids';
import type { TableAdjustment } from '~/lib/weekly-resolution';

const reputationOptions = [
  'Hostile',
  'Unfriendly',
  'Indifferent',
  'Friendly',
  'Helpful',
] as const;

const formSchema = z
  .object({
    kind: z.enum([
      'militia_value',
      'settlement_reputation',
      'team_status',
      'event_status',
    ]),
    reason: z.string().trim().min(1, 'Enter the table reason for this change.'),
    field: z.enum(['training', 'treasury', 'notoriety']),
    numericOperation: z.enum(['add', 'set']),
    value: z.string(),
    settlementKey: z.string(),
    reputation: z.enum(reputationOptions),
    teamId: z.enum(TEAM_IDS),
    teamStatus: z.enum(teamStatusOptions),
    eventType: z.enum(eventTypeOptions),
    eventOperation: z.enum(['add', 'resolve']),
    isPersistent: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.kind === 'militia_value') {
      if (!value.value.trim()) {
        context.addIssue({
          code: 'custom',
          path: ['value'],
          message: 'Enter a numeric value.',
        });
      } else if (!Number.isFinite(Number(value.value))) {
        context.addIssue({
          code: 'custom',
          path: ['value'],
          message: 'Enter a valid number.',
        });
      }
    }
    if (value.kind === 'settlement_reputation' && !value.settlementKey) {
      context.addIssue({
        code: 'custom',
        path: ['settlementKey'],
        message: 'Select a settlement.',
      });
    }
  });

type FormValues = z.infer<typeof formSchema>;

export function TableAdjustmentsPanel({
  adjustments,
  settlementKeys,
  onChangeAction,
}: {
  adjustments: TableAdjustment[];
  settlementKeys: string[];
  onChangeAction: (adjustments: TableAdjustment[]) => Promise<void>;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      kind: 'militia_value',
      reason: '',
      field: 'treasury',
      numericOperation: 'add',
      value: '',
      settlementKey: settlementKeys[0] ?? '',
      reputation: 'Indifferent',
      teamId: TEAM_IDS[0],
      teamStatus: 'active',
      eventType: eventTypeOptions[0],
      eventOperation: 'add',
      isPersistent: false,
    },
  });
  const kind = form.watch('kind');
  const eventOperation = form.watch('eventOperation');

  const addAdjustment = form.handleSubmit(async (values) => {
    const adjustment = toTableAdjustment(values);
    await onChangeAction([...adjustments, adjustment]);
    form.reset({
      ...values,
      reason: '',
      value: '',
    });
  });

  return (
    <Card className="mt-3 border p-3">
      <div className="mb-3">
        <p className="font-mono text-sm font-bold">Table Adjustments</p>
        <p className="text-muted-foreground font-mono text-xs">
          Applied after the normal rules.
        </p>
      </div>

      {adjustments.length > 0 ? (
        <ul className="mb-3 space-y-2 font-mono text-xs">
          {adjustments.map((adjustment, index) => (
            <li
              key={JSON.stringify(adjustment)}
              className="flex items-start justify-between gap-3 rounded border p-2"
            >
              <span>
                <span className="font-bold">
                  {formatAdjustment(adjustment)}
                </span>
                <span className="text-muted-foreground block">
                  Reason: {adjustment.reason}
                </span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  void onChangeAction(
                    adjustments.filter(
                      (_, adjustmentIndex) => adjustmentIndex !== index,
                    ),
                  )
                }
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={addAdjustment} className="grid gap-3 md:grid-cols-2">
        <SelectField
          label="Adjustment type"
          name="kind"
          control={form.control}
          options={[
            ['militia_value', 'Militia value'],
            ['settlement_reputation', 'Settlement reputation'],
            ['team_status', 'Team status'],
            ['event_status', 'Event status'],
          ]}
        />

        {kind === 'militia_value' ? (
          <>
            <SelectField
              label="Value"
              name="field"
              control={form.control}
              options={[
                ['training', 'Training'],
                ['treasury', 'Treasury'],
                ['notoriety', 'Notoriety'],
              ]}
            />
            <SelectField
              label="Operation"
              name="numericOperation"
              control={form.control}
              options={[
                ['add', 'Add'],
                ['set', 'Set exact value'],
              ]}
            />
            <InputField
              label="Numeric value"
              type="text"
              inputMode="decimal"
              error={form.formState.errors.value?.message}
              {...form.register('value')}
            />
          </>
        ) : null}

        {kind === 'settlement_reputation' ? (
          <>
            <SelectField
              label="Settlement"
              name="settlementKey"
              control={form.control}
              options={settlementKeys.map((key) => [key, key])}
              error={form.formState.errors.settlementKey?.message}
            />
            <SelectField
              label="Reputation"
              name="reputation"
              control={form.control}
              options={reputationOptions.map((value) => [value, value])}
            />
          </>
        ) : null}

        {kind === 'team_status' ? (
          <>
            <SelectField
              label="Team"
              name="teamId"
              control={form.control}
              options={TEAM_IDS.map((teamId) => [
                teamId,
                formatTeamIdLabel(teamId),
              ])}
            />
            <SelectField
              label="Status"
              name="teamStatus"
              control={form.control}
              options={teamStatusOptions.map((status) => [
                status,
                formatTeamStatusLabel(status),
              ])}
            />
          </>
        ) : null}

        {kind === 'event_status' ? (
          <>
            <SelectField
              label="Event"
              name="eventType"
              control={form.control}
              options={eventTypeOptions.map((eventType) => [
                eventType,
                formatEventType(eventType),
              ])}
            />
            <SelectField
              label="Operation"
              name="eventOperation"
              control={form.control}
              options={[
                ['add', 'Add event'],
                ['resolve', 'Resolve event'],
              ]}
            />
            {eventOperation === 'add' ? (
              <label className="flex items-center gap-2 self-end font-mono text-xs">
                <input type="checkbox" {...form.register('isPersistent')} />
                Persistent event
              </label>
            ) : null}
          </>
        ) : null}

        <InputField
          label="Reason"
          error={form.formState.errors.reason?.message}
          className="md:col-span-2"
          {...form.register('reason')}
        />

        <div className="md:col-span-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            Add Adjustment
          </Button>
        </div>
      </form>
    </Card>
  );
}

function SelectField({
  label,
  name,
  control,
  options,
  error,
}: {
  label: string;
  name: keyof FormValues;
  control: ReturnType<typeof useForm<FormValues>>['control'];
  options: ReadonlyArray<readonly [string, string]>;
  error?: string;
}) {
  return (
    <label className="grid content-start gap-1 font-mono text-xs">
      {label}
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Select
            value={typeof field.value === 'string' ? field.value : ''}
            onValueChange={field.onChange}
          >
            <SelectTrigger className="w-full" aria-invalid={Boolean(error)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map(([value, optionLabel]) => (
                <SelectItem key={value} value={value}>
                  {optionLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {error ? <span className="text-destructive">{error}</span> : null}
    </label>
  );
}

function InputField({
  label,
  error,
  className,
  ...inputProps
}: React.ComponentProps<typeof Input> & {
  label: string;
  error?: string;
}) {
  return (
    <label
      className={`grid content-start gap-1 font-mono text-xs ${className ?? ''}`}
    >
      {label}
      <Input aria-invalid={Boolean(error)} {...inputProps} />
      {error ? <span className="text-destructive">{error}</span> : null}
    </label>
  );
}

function toTableAdjustment(values: FormValues): TableAdjustment {
  if (values.kind === 'militia_value') {
    return {
      kind: values.kind,
      field: values.field,
      operation: values.numericOperation,
      value: Number(values.value),
      reason: values.reason,
    };
  }
  if (values.kind === 'settlement_reputation') {
    return {
      kind: values.kind,
      settlementKey: values.settlementKey,
      reputation: values.reputation,
      reason: values.reason,
    };
  }
  if (values.kind === 'team_status') {
    return {
      kind: values.kind,
      teamId: values.teamId,
      status: values.teamStatus,
      reason: values.reason,
    };
  }
  return values.eventOperation === 'add'
    ? {
        kind: values.kind,
        eventType: values.eventType,
        operation: 'add',
        isPersistent: values.isPersistent,
        reason: values.reason,
      }
    : {
        kind: values.kind,
        eventType: values.eventType,
        operation: 'resolve',
        reason: values.reason,
      };
}

function formatAdjustment(adjustment: TableAdjustment) {
  if (adjustment.kind === 'militia_value') {
    return `${adjustment.operation === 'add' ? 'Add to' : 'Set'} ${adjustment.field}: ${adjustment.value}`;
  }
  if (adjustment.kind === 'settlement_reputation') {
    return `${adjustment.settlementKey} reputation: ${adjustment.reputation}`;
  }
  if (adjustment.kind === 'team_status') {
    return `${formatTeamIdLabel(adjustment.teamId)} status: ${formatTeamStatusLabel(adjustment.status)}`;
  }
  return `${adjustment.operation === 'add' ? 'Add' : 'Resolve'} ${formatEventType(adjustment.eventType)}`;
}

function formatEventType(eventType: string) {
  return eventType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
