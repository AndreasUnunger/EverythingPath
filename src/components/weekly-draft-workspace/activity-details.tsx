'use client';
import { z } from 'zod';
import { ActivityReceipt } from './activity-receipt';
import {
  activityReferenceOptions,
  actionReferenceOptions,
} from './activity-input-options';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  stagedActionChoiceSchema,
  rawRollModifiersSchema,
  type StagedActionChoice,
} from '~/lib/weekly-draft-facts';
import { normalizeRawRoll } from '~/lib/raw-roll';
import { RecordedRollTotal } from './recorded-roll';
import { isTotalRoll, recordedDiceCount } from './roll-facts';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '~/components/ui/form';
import { WholeNumberField } from './whole-number-field';
import { ChoiceCards } from './choice-cards';
import {
  choiceFieldLabel as label,
  StructuredChoiceField,
} from './structured-choice-field';
import { activityLabel } from './activity-labels';
import type { ActivityView } from './types';
export function ActivityText({
  name,
  value,
  onValue,
  disabled,
  required = false,
}: {
  name: string;
  value: string;
  onValue: (value: string) => void;
  disabled: boolean;
  required?: boolean;
}) {
  const form = useForm({
    values: { text: value },
    resolver: zodResolver(
      z.object({
        text: required
          ? z.string().trim().min(1, 'A reason is required.')
          : z.string(),
      }),
    ),
    mode: 'onBlur',
  });
  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(({ text }) => onValue(text))}
        className="space-y-2"
      >
        <FormField
          control={form.control}
          name="text"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{name}</FormLabel>
              <FormControl>
                <Input {...field} disabled={disabled} />
              </FormControl>
              <FormMessage role="alert" />
            </FormItem>
          )}
        />
        <Button type="submit" variant="outline" disabled={disabled}>
          Save {name.toLowerCase()}
        </Button>
      </form>
    </Form>
  );
}
function ChoiceFields({
  choice,
  view,
  disabled,
  change,
  calculatedCostCopper,
  detailError,
}: {
  choice: StagedActionChoice;
  view: ActivityView;
  disabled: boolean;
  change: (field: string, value: unknown) => boolean;
  calculatedCostCopper: number | null;
  detailError: { field: string; message: string } | null;
}) {
  const shape = stagedActionChoiceSchema.options.find(
    (option) => option.shape.actionId.value === choice.actionId,
  )!.shape;
  const values: Record<string, unknown> = choice;
  const references = actionReferenceOptions(choice, view);
  const hidden = new Set([
    'choiceId',
    'actionId',
    'rolls',
    'acknowledgements',
    'orderId',
    'receipt',
  ]);
  return Object.entries(shape)
    .flatMap(([field, wrapped]) => {
      if (hidden.has(field)) return [];
      const schema =
        wrapped instanceof z.ZodOptional
          ? (wrapped.unwrap() as z.ZodType)
          : (wrapped as z.ZodType);
      const value =
        values[field] ??
        (field === 'costCopper'
          ? (calculatedCostCopper ?? undefined)
          : undefined);
      const fieldLabel = label(field);
      let options =
        schema instanceof z.ZodArray ? null : (references[field] ?? null);
      if (!options && schema instanceof z.ZodEnum)
        options = schema.options.map((option) => ({
          value: String(option),
          label: activityLabel(String(option)),
        }));
      else if (!options && schema instanceof z.ZodBoolean)
        options = [
          { value: 'true', label: 'Yes' },
          { value: 'false', label: 'No' },
        ];
      if (options)
        return [
          <ChoiceCards
            key={field}
            label={fieldLabel}
            value={
              typeof value === 'string' || typeof value === 'boolean'
                ? String(value)
                : ''
            }
            choices={[{ value: '', label: 'Not selected' }, ...options]}
            disabled={disabled}
            onChange={(selected) =>
              change(
                field,
                selected === ''
                  ? undefined
                  : schema instanceof z.ZodBoolean
                    ? selected === 'true'
                    : selected,
              )
            }
          />,
        ];
      if (schema instanceof z.ZodNumber && schema.isInt)
        return [
          <WholeNumberField
            key={field}
            label={fieldLabel}
            value={typeof value === 'number' ? value : null}
            disabled={disabled}
            onValue={(number) => change(field, number ?? undefined)}
          />,
        ];
      if (schema instanceof z.ZodString)
        return [
          <ActivityText
            key={field}
            name={fieldLabel}
            value={typeof value === 'string' ? value : ''}
            disabled={disabled}
            onValue={(text) => change(field, text.trim() || undefined)}
          />,
        ];
      return [
        <StructuredChoiceField
          key={field}
          schema={wrapped as z.ZodType}
          name={field}
          value={value}
          disabled={disabled}
          onValue={(value) => change(field, value)}
          options={activityReferenceOptions(choice, view)}
        />,
      ];
    })
    .map((element) => (
      <div key={element.key} className="space-y-1">
        {element}
        {detailError?.field === element.key && (
          <p role="alert" className="text-destructive text-sm">
            {detailError.message}
          </p>
        )}
      </div>
    ));
}
function ChoiceRolls({
  choice,
  requirements,
  view,
  disabled,
  change,
}: {
  choice: StagedActionChoice;
  requirements: string[];
  view: ActivityView;
  disabled: boolean;
  change: (field: string, value: unknown) => void;
}) {
  const fields = new Map<string, { count: number; sides: number }>();
  for (const [field, roll] of Object.entries(choice.rolls ?? {}))
    fields.set(field, { count: recordedDiceCount(roll), sides: roll.sides });
  for (const requirement of requirements) {
    const match = /^(\w+):(\d+)d(\d+)$/.exec(
      requirement.slice(choice.choiceId.length + 1),
    );
    if (match)
      fields.set(match[1]!, {
        count: Number(match[2]),
        sides: Number(match[3]),
      });
  }
  return [...fields].map(([field, dice]) => {
    const roll =
      choice.rolls?.[field as keyof NonNullable<StagedActionChoice['rolls']>];
    // Only a legacy array feeds the per-die writer; a total has no dice.
    const entered = roll && !isTotalRoll(roll) ? roll.dice : [];
    return (
      <fieldset key={field} className="space-y-2">
        <legend className="text-sm font-semibold">
          {activityLabel(field)} · {dice.count}d{dice.sides}
        </legend>
        {roll && isTotalRoll(roll) ? (
          <RecordedRollTotal
            label={`${activityLabel(field)} roll`}
            recorded={roll}
            normalized={normalizeRawRoll(roll, dice)}
            disabled={disabled}
            onClear={() => {
              const rolls = { ...choice.rolls };
              delete rolls[field as keyof typeof rolls];
              change('rolls', rolls);
            }}
          />
        ) : (
          <div className="grid grid-cols-2 items-start gap-2">
            {Array.from({ length: dice.count }, (_, index) => (
              <WholeNumberField
                key={index}
                label={`${activityLabel(field)} die ${index + 1}`}
                required
                disabled={
                  disabled || (index > 0 && entered[index - 1] === undefined)
                }
                value={entered[index] ?? null}
                onValue={(value) => {
                  const next = entered.slice(0, index);
                  if (value !== null)
                    next.push(value, ...entered.slice(index + 1));
                  const rolls = { ...choice.rolls };
                  const key = field as keyof typeof rolls;
                  if (!next.length) delete rolls[key];
                  else
                    rolls[key] = {
                      dice: next,
                      sides: dice.sides,
                      provenance: { kind: 'table' },
                      modifiers: roll?.modifiers ?? [],
                    };
                  change('rolls', rolls);
                }}
              />
            ))}
          </div>
        )}
        {roll && (
          <details className="space-y-2">
            <summary className="cursor-pointer text-sm">
              {activityLabel(field)} sources and modifiers
            </summary>
            <p className="text-muted-foreground text-xs">
              Rules bonuses are calculated automatically. Choose settlement
              support, an available bonus, or record a custom table modifier
              with a reason.
            </p>
            <StructuredChoiceField
              schema={rawRollModifiersSchema.optional()}
              value={roll.modifiers}
              name="modifiers"
              disabled={disabled}
              options={activityReferenceOptions(choice, view)}
              onValue={(modifiers) =>
                change('rolls', {
                  ...choice.rolls,
                  [field]: { ...roll, modifiers: modifiers ?? [] },
                })
              }
            />
          </details>
        )}
      </fieldset>
    );
  });
}
export function ActivityDetails({
  slot,
  view,
  edit,
  disabled,
}: {
  slot: ActivityView['slots'][number];
  view: ActivityView;
  edit: (edit: WeeklyDraftEdit) => unknown;
  disabled: boolean;
}) {
  const choice = slot.choice!;
  const [detailError, setDetailError] = useState<{
    field: string;
    message: string;
  } | null>(null);
  function change(field: string, value: unknown) {
    return saveChoice(
      field,
      Object.fromEntries(
        Object.entries({ ...choice, [field]: value }).filter(
          ([, value]) => value !== undefined,
        ),
      ),
    );
  }
  function saveChoice(field: string, next: unknown) {
    const parsed = stagedActionChoiceSchema.safeParse(next);
    if (!parsed.success) {
      setDetailError({
        field,
        message: `${label(field)}: ${parsed.error.issues[0]!.message}`,
      });
      return false;
    }
    setDetailError(null);
    edit({
      kind: 'detail',
      slotId: slot.slotId,
      choiceId: choice.choiceId,
      choice: parsed.data,
    });
    return true;
  }
  const check = view.checks.find((check) => check.checkId === choice.choiceId);
  return (
    <div className="space-y-3">
      <ChoiceFields
        choice={choice}
        calculatedCostCopper={slot.calculatedCostCopper}
        detailError={detailError}
        view={view}
        change={change}
        disabled={disabled}
      />
      {slot.calculatedCostCopper !== null && (
        <p className="text-sm">
          Calculated cost: {slot.calculatedCostCopper} cp
        </p>
      )}
      {choice.actionId === 'special_order' && (
        <ActivityReceipt
          choice={choice}
          startDay={view.startDay}
          disabled={disabled}
          save={(next) => saveChoice('receipt', next)}
        />
      )}
      <ChoiceRolls
        view={view}
        choice={choice}
        requirements={slot.requirements}
        change={change}
        disabled={disabled}
      />
      {check && (
        <p className="text-sm">
          Calculated bonus: {check.modifier >= 0 ? '+' : ''}
          {check.modifier} · Total: {check.total ?? 'Awaiting roll'}
        </p>
      )}
      {check && (
        <ul className="text-muted-foreground space-y-1 text-xs">
          {check.modifiers.map((modifier) => (
            <li key={modifier.source}>
              {choice.rolls?.check?.modifiers.find(
                (entry) => entry.sourceId === modifier.source,
              )?.reason ??
                view.modifierSources.find(
                  (entry) => entry.value === modifier.source,
                )?.label ??
                {
                  'rank-focus': 'Rank and focus',
                  officers: 'Officers',
                  strategist: 'Strategist',
                  'gather-tier': 'Information gathering',
                  'knowledge-rank': 'Militia knowledge',
                }[modifier.source] ??
                'Calculated modifier'}
              : {modifier.value >= 0 ? '+' : ''}
              {modifier.value}
            </li>
          ))}
        </ul>
      )}
      {[
        ...new Set([
          ...slot.requirements
            .filter((requirement) => requirement.includes(':acknowledgement'))
            .map((requirement) => {
              const subject = requirement.split(':acknowledgement:')[1];
              return subject ?? `${choice.actionId}:${choice.choiceId}`;
            }),
          ...(choice.acknowledgements ?? []).map((item) => item.subjectId),
        ]),
      ].map((subjectId, index) => {
        const existing = choice.acknowledgements?.find(
          (item) => item.subjectId === subjectId,
        );
        return (
          <ActivityText
            key={subjectId}
            name={`Outcome acknowledgement ${index + 1}`}
            value={existing?.outcome ?? ''}
            required
            disabled={disabled}
            onValue={(outcome) =>
              change('acknowledgements', [
                ...(choice.acknowledgements ?? []).filter(
                  (item) => item.subjectId !== subjectId,
                ),
                {
                  acknowledgementId:
                    existing?.acknowledgementId ?? crypto.randomUUID(),
                  subjectId,
                  outcome,
                },
              ])
            }
          />
        );
      })}
      {slot.exceptions.map((exception) => (
        <div
          key={exception.exceptionId}
          role="group"
          aria-label={`${activityLabel(exception.ruleId.replaceAll('-', '_'))} exception`}
          className="space-y-2 rounded-md border border-amber-500 p-3"
        >
          <p className="text-sm">
            Table exception:{' '}
            {activityLabel(exception.ruleId.replaceAll('-', '_'))}. A reason
            allows this choice without changing its calculated outcome.
          </p>
          <ActivityText
            name="Exception reason"
            value={exception.reason}
            required
            disabled={disabled}
            onValue={(reason) =>
              edit({
                kind: 'rules_exception',
                exception: { ...exception, subjectId: choice.choiceId, reason },
              })
            }
          />
          {exception.reason && (
            <Button
              variant="outline"
              disabled={disabled}
              onClick={() =>
                edit({
                  kind: 'clear_rules_exception',
                  exceptionId: exception.exceptionId,
                })
              }
            >
              Remove exception
            </Button>
          )}
        </div>
      ))}
      {slot.requirements.length > 0 && (
        <p className="text-muted-foreground text-sm">
          This choice needs more preparation. Complete its selections, rolls and
          table decisions.
        </p>
      )}
      <Button
        variant="outline"
        disabled={disabled}
        onClick={() =>
          edit({
            kind: 'clear',
            slotId: slot.slotId,
            choiceId: choice.choiceId,
          })
        }
      >
        Clear {activityLabel(choice.actionId)}
      </Button>
    </div>
  );
}
