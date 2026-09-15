import { useId, type ReactNode } from 'react';
import { Controller, useFormContext, type FieldPath } from 'react-hook-form';
import { Button } from '~/components/ui/button';
import { CampaignContextInput } from '../campaign-context/campaign-context-input';
import type { MilitiaSetup } from '~/lib/canonical-setup';
export const choices = (values: readonly string[]) =>
  values.map((value) => ({ value, label: value.replaceAll('_', ' ') }));
export const yesNo = [
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
];
export function SetupField({
  name,
  label,
  numeric,
  decimal,
  omitEmpty,
  options,
}: {
  name: FieldPath<MilitiaSetup>;
  label: string;
  numeric?: boolean;
  decimal?: boolean;
  omitEmpty?: boolean;
  options?: {
    value: string | number | boolean | null | undefined;
    label: string;
  }[];
}) {
  const { control } = useFormContext<MilitiaSetup>();
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className="min-w-0 space-y-1">
          <label
            id={`${id}-label`}
            htmlFor={id}
            className="text-sm font-medium"
          >
            {label}
          </label>
          {options ? (
            <div
              role="group"
              aria-labelledby={`${id}-label`}
              className="flex flex-wrap gap-2"
            >
              {options.map((option) => (
                <Button
                  key={String(option.value)}
                  type="button"
                  variant={field.value === option.value ? 'default' : 'outline'}
                  aria-pressed={field.value === option.value}
                  onClick={() => field.onChange(option.value)}
                  className="h-auto min-h-12 border-2 whitespace-normal transition-transform hover:-translate-y-1"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          ) : (
            <CampaignContextInput
              {...field}
              id={id}
              numeric={numeric}
              numericFormat={decimal ? 'decimal' : 'integer'}
              value={field.value}
              onValueChange={(value) =>
                field.onChange(value === null && omitEmpty ? undefined : value)
              }
              aria-invalid={!!fieldState.error}
              aria-describedby={fieldState.error ? `${id}-error` : undefined}
            />
          )}
          {fieldState.error && (
            <p
              id={`${id}-error`}
              role="alert"
              className="text-destructive text-sm"
            >
              {field.value === null ||
              field.value === undefined ||
              field.value === ''
                ? `${label} is required.`
                : numeric
                  ? `Enter a valid ${decimal ? 'number' : 'whole number'} for ${label}.`
                  : fieldState.error.message}
            </p>
          )}
        </div>
      )}
    />
  );
}
export function SetupSection({
  title,
  children,
  add,
  onAdd,
}: {
  title: string;
  children: ReactNode;
  add?: string;
  onAdd?: () => void;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
      {onAdd && (
        <Button type="button" variant="outline" onClick={onAdd}>
          {add}
        </Button>
      )}
    </section>
  );
}
export function SetupEntry({
  label,
  children,
  onRemove,
}: {
  label: string;
  children: ReactNode;
  onRemove: () => void;
}) {
  return (
    <fieldset aria-label={label} className="min-w-0 space-y-3 border-2 p-3">
      <legend className="max-w-full px-1 font-semibold wrap-break-word">
        {label}
      </legend>
      <div className="grid items-start gap-3 md:grid-cols-2">{children}</div>
      <Button type="button" variant="outline" onClick={onRemove}>
        Remove {label}
      </Button>
    </fieldset>
  );
}

export function SetupSelection({
  name,
  label,
  options,
}: {
  name: FieldPath<MilitiaSetup>;
  label: string;
  options: { value: string; label: string }[];
}) {
  const { control } = useFormContext<MilitiaSetup>();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const selected: string[] = Array.isArray(field.value)
          ? field.value.filter((x): x is string => typeof x === 'string')
          : [];
        return (
          <div className="space-y-2">
            <p className="text-sm font-medium">{label}</p>
            <div
              role="group"
              aria-label={label}
              className="flex flex-wrap gap-2"
            >
              {options.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={
                    selected.includes(option.value) ? 'default' : 'outline'
                  }
                  aria-pressed={selected.includes(option.value)}
                  onClick={() =>
                    field.onChange(
                      selected.includes(option.value)
                        ? selected.filter((value) => value !== option.value)
                        : [...selected, option.value],
                    )
                  }
                >
                  {option.label}
                </Button>
              ))}
            </div>
            {fieldState.error && (
              <p role="alert" className="text-destructive text-sm">
                {fieldState.error.message}
              </p>
            )}
          </div>
        );
      }}
    />
  );
}
