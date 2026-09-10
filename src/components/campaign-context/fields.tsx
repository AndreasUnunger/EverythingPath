import { useId, type ReactNode } from 'react';
import { Controller, useFormContext, type FieldPath } from 'react-hook-form';
import { Button } from '~/components/ui/button';
import { FactInput } from './fact-input';
import type { CampaignContext } from '~/lib/canonical-campaign-context';

export const yesNo = [
  { value: null, label: 'Unknown' },
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
];
export function options(values: readonly string[]) {
  return values.map((value) => ({ value, label: value.replaceAll('_', ' ') }));
}
export function FactField({
  name,
  label,
  numeric,
  choices,
}: {
  name: FieldPath<CampaignContext>;
  label: string;
  numeric?: boolean;
  choices?: { value: string | boolean | null; label: string }[];
}) {
  const { control } = useFormContext<CampaignContext>();
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
          {choices ? (
            <div
              role="group"
              aria-labelledby={`${id}-label`}
              className="flex flex-wrap gap-2"
            >
              {choices.map((choice) => (
                <Button
                  key={String(choice.value)}
                  type="button"
                  variant={field.value === choice.value ? 'default' : 'outline'}
                  aria-pressed={field.value === choice.value}
                  onClick={() => field.onChange(choice.value)}
                  className="h-auto min-h-12 border-2 whitespace-normal transition-transform hover:-translate-y-1"
                >
                  {choice.label}
                </Button>
              ))}
            </div>
          ) : (
            <FactInput
              id={id}
              ref={field.ref}
              name={field.name}
              onBlur={field.onBlur}
              aria-invalid={!!fieldState.error}
              aria-describedby={fieldState.error ? `${id}-error` : undefined}
              numeric={numeric}
              value={field.value}
              onValueChange={field.onChange}
            />
          )}
          {fieldState.error && (
            <p
              id={`${id}-error`}
              role="alert"
              className="text-destructive text-sm"
            >
              {field.value === null
                ? `${label} is required`
                : fieldState.error.message}
            </p>
          )}
        </div>
      )}
    />
  );
}
export function FactSection({
  title,
  children,
  onAdd,
}: {
  title: string;
  children: ReactNode;
  onAdd: () => void;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-xl font-bold">{title}</h3>
      {children}
      <Button type="button" variant="outline" onClick={onAdd}>
        Add {title.toLowerCase().replace(/s$/, '')}
      </Button>
    </section>
  );
}
export function FactEntry({
  label,
  children,
  onRemove,
}: {
  label: string;
  children: ReactNode;
  onRemove: () => void;
}) {
  return (
    <fieldset aria-label={label} className="space-y-3 border-2 p-3">
      <legend className="px-1 font-bold">{label}</legend>
      <div className="grid items-start gap-3 md:grid-cols-2">{children}</div>
      <Button type="button" variant="outline" onClick={onRemove}>
        Remove {label}
      </Button>
    </fieldset>
  );
}

function errorMessages(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  if ('message' in value && typeof value.message === 'string')
    return [value.message];
  return Object.entries(value).flatMap(([key, child]) =>
    key === 'ref' ? [] : errorMessages(child),
  );
}
export function FactErrors({ name }: { name: FieldPath<CampaignContext> }) {
  const { getFieldState, formState } = useFormContext<CampaignContext>();
  return (
    <>
      {[...new Set(errorMessages(getFieldState(name, formState).error))].map(
        (message) => (
          <p role="alert" className="text-destructive text-sm" key={message}>
            {message}
          </p>
        ),
      )}
    </>
  );
}
