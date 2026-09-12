'use client';
import { useId, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { ChoiceCards } from './choice-cards';
import { WholeNumberField } from './whole-number-field';
import { activityLabel } from './activity-labels';
type Options = Record<string, { value: string; label: string }[]>;
export function choiceFieldLabel(field: string) {
  if (/^\d+$/.test(field)) return `Entry ${Number(field) + 1}`;
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
function initial(
  schema: z.ZodType,
  field = '',
  rollSides: Record<string, number> = {},
): unknown {
  if (schema instanceof z.ZodOptional) return undefined;
  const base = unwrap(schema);
  if (base instanceof z.ZodLiteral) return base.value;
  if (base instanceof z.ZodDiscriminatedUnion)
    return initial(base.options[0] as z.ZodType, field, rollSides);
  if (base instanceof z.ZodArray) return [];
  if (
    base instanceof z.ZodObject &&
    'dice' in base.shape &&
    'sides' in base.shape &&
    'provenance' in base.shape
  )
    return {
      dice: [],
      ...(rollSides[field] ? { sides: rollSides[field] } : {}),
      provenance: { kind: 'table' },
      modifiers: [],
    };
  if (
    base instanceof z.ZodObject &&
    'sourceId' in base.shape &&
    'value' in base.shape &&
    'reason' in base.shape
  )
    return { sourceId: `custom:${crypto.randomUUID()}`, value: 0 };
  if (base instanceof z.ZodObject)
    return Object.fromEntries(
      Object.entries(base.shape)
        .map(([key, child]) => [
          key,
          initial(child as z.ZodType, key, rollSides),
        ])
        .filter(([, value]) => value !== undefined),
    );
  if (base instanceof z.ZodRecord) return {};
  if (
    base instanceof z.ZodString &&
    ['eventId', 'itemId', 'acknowledgementId', 'choiceId'].includes(field)
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
type FieldProps = {
  schema: z.ZodType;
  value: unknown;
  change: (value: unknown) => void;
  name: string;
  options: Options;
  path?: string;
  issues: z.core.$ZodIssue[];
  disabled: boolean;
  modifierContext?: boolean;
  ownerEventId?: string;
  rollSides?: Record<string, number>;
  acknowledgementSubject?: string;
};
function nestedField(props: FieldProps) {
  return (
    schema: z.ZodType,
    value: unknown,
    name: string,
    change: (value: unknown) => void,
  ) => (
    <Fields
      key={name}
      rollSides={props.rollSides}
      modifierContext={props.modifierContext}
      ownerEventId={props.ownerEventId}
      acknowledgementSubject={props.acknowledgementSubject}
      schema={schema}
      value={value}
      name={name}
      change={change}
      options={
        /^\d+$/.test(name) && props.options[props.name]
          ? { ...props.options, [name]: props.options[props.name]! }
          : props.options
      }
      path={props.path ? `${props.path}.${name}` : name}
      issues={props.issues}
      disabled={props.disabled}
    />
  );
}
function Fields(props: FieldProps) {
  if (props.name === 'provenance')
    return (
      <p className="text-muted-foreground text-xs">
        {record(props.value).kind === 'generated'
          ? 'Recorded roll.'
          : 'Rolled at the table.'}
      </p>
    );
  const base = unwrap(props.schema);
  if (base instanceof z.ZodLiteral) return null;
  const structured =
    base instanceof z.ZodObject ||
    base instanceof z.ZodArray ||
    base instanceof z.ZodRecord ||
    base instanceof z.ZodDiscriminatedUnion;
  if (
    props.schema instanceof z.ZodOptional &&
    props.value === undefined &&
    structured
  )
    return (
      <Button
        type="button"
        variant="outline"
        disabled={props.disabled}
        onClick={() => props.change(initial(base, props.name, props.rollSides))}
      >
        Add {choiceFieldLabel(props.name).toLowerCase()}
      </Button>
    );
  if (base instanceof z.ZodDiscriminatedUnion)
    return <UnionFields {...props} base={base} />;
  if (base instanceof z.ZodObject || base instanceof z.ZodRecord)
    return <ObjectFields {...props} base={base} />;
  if (base instanceof z.ZodArray) return <ArrayFields {...props} base={base} />;
  return <ScalarField {...props} base={base} />;
}
function UnionFields(props: FieldProps & { base: z.ZodDiscriminatedUnion }) {
  const {
    value,
    change,
    name,
    options,
    path = '',
    issues,
    disabled,
    base,
  } = props;
  const title = choiceFieldLabel(name);
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
          change(initial(option, name, props.rollSides));
        }}
      />
      {selectedSchema && (
        <Fields
          rollSides={props.rollSides}
          modifierContext={props.modifierContext}
          ownerEventId={props.ownerEventId}
          acknowledgementSubject={props.acknowledgementSubject}
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
function optionsForSource(
  options: Options,
  name: string,
  modifier: boolean,
  current: unknown,
) {
  if (name === 'origin') return options.automaticSources ?? [];
  if (!modifier) return null;
  const known = options.modifierSources ?? [];
  const custom =
    typeof current === 'string' && !known.some((item) => item.value === current)
      ? current
      : `custom:${crypto.randomUUID()}`;
  return [...known, { value: custom, label: 'Custom table modifier' }];
}
function ObjectFields(props: FieldProps & { base: z.ZodObject | z.ZodRecord }) {
  const { value, change, name, path = '', issues, base } = props;
  const title = choiceFieldLabel(name);
  const error = issues.find((issue) => issue.path.join('.') === path)?.message;
  const object = record(value);
  const ownerEventId =
    typeof object.eventId === 'string' &&
    ('origin' in object || name === 'occurrence')
      ? object.eventId
      : props.ownerEventId;
  const acknowledgementSubject =
    name === 'persistentDecision' &&
    object.kind === 'end' &&
    typeof object.eventId === 'string'
      ? object.eventId
      : name === 'sabotage' &&
          typeof object.choiceId === 'string' &&
          ownerEventId
        ? `sabotage:${ownerEventId}:${object.choiceId}`
        : props.acknowledgementSubject;
  const modifier = props.modifierContext === true || path.includes('modifiers');
  const knownSources = optionsForSource(
    props.options,
    name,
    Boolean(modifier),
    object.sourceId,
  );
  const nested = nestedField({
    ...props,
    ownerEventId,
    acknowledgementSubject,
    options: knownSources
      ? { ...props.options, sourceId: knownSources }
      : props.options,
  });
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
          [
            'eventId',
            'itemId',
            'acknowledgementId',
            'choiceId',
            'subjectId',
          ].includes(key) &&
          (key === 'subjectId' ||
            key === 'choiceId' ||
            name === 'persistentDecision' ||
            !('kind' in object))
        )
          return null;
        return nested(child, object[key], key, (next) =>
          change(
            Object.fromEntries(
              Object.entries({
                ...object,
                ...('acknowledgementId' in object && acknowledgementSubject
                  ? { subjectId: acknowledgementSubject }
                  : {}),
                [key]:
                  key === 'persistentDecision' &&
                  next !== undefined &&
                  typeof object.eventId === 'string'
                    ? { ...record(next), eventId: object.eventId }
                    : next,
              }).filter(([, value]) => value !== undefined),
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
function ArrayFields(props: FieldProps & { base: z.ZodArray }) {
  const { value, change, name, path = '', issues, disabled, base } = props;
  const title = choiceFieldLabel(name);
  const error = issues.find((issue) => issue.path.join('.') === path)?.message;
  const nested = nestedField({
    ...props,
    modifierContext: props.modifierContext === true || name === 'modifiers',
  });
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
          change([
            ...values,
            initial(base.element as z.ZodType, name, props.rollSides),
          ])
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
function ScalarField(props: FieldProps & { base: z.ZodType }) {
  const {
    value,
    change,
    name,
    options,
    path = '',
    issues,
    disabled,
    base,
  } = props;
  const title = choiceFieldLabel(name);
  const { schema } = props;
  const id = useId();
  const [formatError, setFormatError] = useState('');
  const error =
    formatError ||
    issues.find((issue) => issue.path.join('.') === path)?.message;
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
                (text !== '-' &&
                  !text.endsWith('.') &&
                  !Number.isFinite(Number(text))))
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
  rollSides = {},
}: {
  rollSides?: Record<string, number>;
  schema: z.ZodType;
  value: unknown;
  name: string;
  options: Options;
  onValue: (value: unknown) => boolean | void;
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
        rollSides={rollSides}
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
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" type="submit" disabled={disabled}>
          Save {choiceFieldLabel(name).toLowerCase()}
        </Button>
        <Button
          variant="outline"
          type="button"
          disabled={disabled}
          onClick={() => {
            if (onValue(undefined) !== false) form.reset({ value: undefined });
          }}
        >
          Clear {choiceFieldLabel(name).toLowerCase()}
        </Button>
      </div>
    </form>
  );
}
