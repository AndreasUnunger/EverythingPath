'use client';
import { useId, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { ChoiceCards } from './choice-cards';
import { WholeNumberField } from './whole-number-field';
import { activityLabel } from './activity-facts';
type Options = Record<string, { value: string; label: string }[]>;
export function choiceFieldLabel(field: string) {
  return activityLabel(field.replace(/([a-z])([A-Z])/g, '$1_$2'))
    .replace(/ Ids?$/, '')
    .replace(/Copper$/, '(copper)');
}
function unwrap(schema: z.ZodType): z.ZodType {
  if (
    schema instanceof z.ZodOptional ||
    schema instanceof z.ZodNullable ||
    schema instanceof z.ZodDefault
  )
    return unwrap(schema.unwrap() as z.ZodType);
  return schema;
}
function initial(schema: z.ZodType, field = ''): unknown {
  if (schema instanceof z.ZodOptional) return undefined;
  const base = unwrap(schema);
  if (base instanceof z.ZodLiteral) return base.value;
  if (base instanceof z.ZodDiscriminatedUnion)
    return initial(base.options[0] as z.ZodType);
  if (base instanceof z.ZodArray) return [];
  if (base instanceof z.ZodObject)
    return Object.fromEntries(
      Object.entries(base.shape)
        .map(([key, child]) => [key, initial(child as z.ZodType, key)])
        .filter(([, value]) => value !== undefined),
    );
  if (base instanceof z.ZodRecord) return {};
  if (
    base instanceof z.ZodString &&
    ['eventId', 'itemId', 'acknowledgementId'].includes(field)
  )
    return crypto.randomUUID();
  return undefined;
}
function scalarText(value: unknown) {
  return typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
    ? String(value)
    : '';
}
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function Fields({
  schema,
  value,
  change,
  name,
  options,
  path = '',
  issues,
  disabled,
}: {
  schema: z.ZodType;
  value: unknown;
  change: (value: unknown) => void;
  name: string;
  options: Options;
  path?: string;
  issues: z.core.$ZodIssue[];
  disabled: boolean;
}) {
  const id = useId();
  const [formatError, setFormatError] = useState('');
  const base = unwrap(schema);
  const error =
    formatError ||
    issues.find((issue) => issue.path.join('.') === path)?.message;
  const title = choiceFieldLabel(name);
  const nested = (
    child: z.ZodType,
    childValue: unknown,
    childName: string,
    update: (value: unknown) => void,
  ) => (
    <Fields
      key={childName}
      schema={child}
      value={childValue}
      name={childName}
      change={update}
      options={/^\d+$/.test(childName) && options[name] ? { ...options, [childName]: options[name] } : options}
      path={path ? `${path}.${childName}` : childName}
      issues={issues}
      disabled={disabled}
    />
  );
  if (base instanceof z.ZodLiteral) return null;
  if (
    schema instanceof z.ZodOptional &&
    value === undefined &&
    (base instanceof z.ZodObject ||
      base instanceof z.ZodArray ||
      base instanceof z.ZodRecord ||
      base instanceof z.ZodDiscriminatedUnion)
  )
    return (
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => change(initial(base))}
      >
        Add {title.toLowerCase()}
      </Button>
    );
  if (base instanceof z.ZodDiscriminatedUnion) {
    const discriminator = String(base.def.discriminator);
    const selected = record(value)[discriminator];
    const variants = base.options.filter(
      (option): option is z.ZodObject => option instanceof z.ZodObject,
    );
    const selectedSchema = variants.find(
      (option) =>
        option.shape[discriminator] instanceof z.ZodLiteral &&
        option.shape[discriminator].value === selected,
    );
    return (
      <div className="space-y-3 rounded-md border p-3">
        <ChoiceCards
          label={title}
          value={typeof selected === 'string' ? selected : ''}
          choices={variants.map((option) => {
            const value = String(
              (option.shape[discriminator] as z.ZodLiteral<string>).value,
            );
            return { value, label: activityLabel(value) };
          })}
          disabled={disabled}
          onChange={(selected) => {
            const option = variants.find(
              (option) =>
                (option.shape[discriminator] as z.ZodLiteral<string>).value ===
                selected,
            )!;
            change(initial(option));
          }}
        />
        {selectedSchema && (
          <Fields
            schema={selectedSchema}
            value={value}
            change={change}
            name={name}
            options={options}
            path={path}
            issues={issues}
            disabled={disabled}
          />
        )}
      </div>
    );
  }
  if (base instanceof z.ZodObject || base instanceof z.ZodRecord) {
    const object = record(value);
    const fields: [string, z.ZodType][] =
      base instanceof z.ZodObject
        ? (Object.entries(base.shape) as [string, z.ZodType][])
        : base.keyType instanceof z.ZodEnum
          ? base.keyType.options.map((key) => [
              String(key),
              (base.valueType as z.ZodType).optional(),
            ])
          : [];
    return (
      <fieldset className="min-w-0 space-y-3 rounded-md border p-3">
        <legend className="text-sm font-semibold">{title}</legend>
        {fields.map(([key, child]) => {
          if (
            ['eventId', 'itemId', 'acknowledgementId'].includes(key) &&
            !('kind' in object)
          )
            return null;
          return nested(child, object[key], key, (next) =>
            change(
              Object.fromEntries(
                Object.entries({ ...object, [key]: next }).filter(
                  ([, value]) => value !== undefined,
                ),
              ),
            ),
          );
        })}
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </fieldset>
    );
  }
  if (base instanceof z.ZodArray) {
    const values = Array.isArray(value) ? (value as unknown[]) : [];
    return (
      <fieldset className="min-w-0 space-y-3 rounded-md border p-3">
        <legend className="text-sm font-semibold">{title}</legend>
        {values.map((entry, index) => (
          <div
            key={scalarText(
              record(entry).eventId ?? record(entry).itemId ?? index,
            )}
            className="space-y-2"
          >
            {nested(base.element as z.ZodType, entry, String(index), (next) =>
              change(
                values.map((item, itemIndex) =>
                  itemIndex === index ? next : item,
                ),
              ),
            )}
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() =>
                change(values.filter((_, itemIndex) => itemIndex !== index))
              }
            >
              Remove {title.toLowerCase()} {index + 1}
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() =>
            change([...values, initial(base.element as z.ZodType)])
          }
        >
          Add {title.toLowerCase()} entry
        </Button>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </fieldset>
    );
  }
  const choices =
    options[name] ??
    (base instanceof z.ZodEnum
      ? base.options.map((value) => ({
          value: String(value),
          label: activityLabel(String(value)),
        }))
      : base instanceof z.ZodBoolean
        ? [
            { value: 'true', label: 'Yes' },
            { value: 'false', label: 'No' },
          ]
        : null);
  if (choices)
    return (
      <div>
        <ChoiceCards
          label={title}
          value={scalarText(value)}
          choices={[{ value: '', label: 'Not selected' }, ...choices]}
          disabled={disabled}
          onChange={(selected) =>
            change(
              selected === ''
                ? undefined
                : base instanceof z.ZodBoolean
                  ? selected === 'true'
                  : selected,
            )
          }
        />
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </div>
    );
  if (base instanceof z.ZodNumber && base.isInt && (base.minValue ?? 0) >= 0)
    return (
      <div>
        <WholeNumberField
          label={title}
          value={typeof value === 'number' ? value : null}
          disabled={disabled}
          required={!schema.isOptional()}
          onValue={(number) => change(number ?? undefined)}
        />
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </div>
    );
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">
        {title}
      </label>
      <Input
        id={id}
        value={scalarText(value)}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => {
          const text = event.target.value;
          if (base instanceof z.ZodNumber) {
            if (
              text !== '' &&
              (!/^-?[0-9]*(?:\.[0-9]*)?$/.test(text) ||
                !Number.isFinite(Number(text)))
            ) {
              setFormatError('Enter a valid number.');
              return;
            }
            setFormatError('');
            change(
              text === ''
                ? undefined
                : text === '-' || text.endsWith('.')
                  ? text
                  : Number(text),
            );
          } else change(text || undefined);
        }}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
export function StructuredChoiceField({
  schema,
  value,
  name,
  options,
  onValue,
  disabled,
}: {
  schema: z.ZodType;
  value: unknown;
  name: string;
  options: Options;
  onValue: (value: unknown) => void;
  disabled: boolean;
}) {
  const form = useForm<{ value: unknown }>({ values: { value } });
  const [issues, setIssues] = useState<z.core.$ZodIssue[]>([]);
  return (
    <form
      noValidate
      className="space-y-2"
      onSubmit={form.handleSubmit(({ value }) => {
        const parsed = schema.safeParse(value);
        if (!parsed.success) {
          setIssues(
            parsed.error.issues.map((issue) => ({
              ...issue,
              message:
                issue.code === 'invalid_type' &&
                String(issue.message).includes('undefined')
                  ? 'A value is required.'
                  : issue.message,
            })),
          );
          return;
        }
        setIssues([]);
        onValue(parsed.data);
      })}
    >
      <Fields
        schema={schema}
        value={form.watch('value')}
        change={(value) => {
          form.setValue('value', value);
          setIssues([]);
        }}
        name={name}
        options={options}
        issues={issues}
        disabled={disabled}
      />
      <div className="flex gap-2">
        <Button variant="outline" type="submit" disabled={disabled}>
          Save {choiceFieldLabel(name).toLowerCase()}
        </Button>
        <Button
          variant="outline"
          type="button"
          disabled={disabled}
          onClick={() => {
            form.reset({ value: undefined });
            onValue(undefined);
          }}
        >
          Clear {choiceFieldLabel(name).toLowerCase()}
        </Button>
      </div>
    </form>
  );
}
