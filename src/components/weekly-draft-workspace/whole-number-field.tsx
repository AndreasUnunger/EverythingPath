'use client';
import { useRef, type ReactNode } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '~/components/ui/input';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from '~/components/ui/form';
const digits = z
  .string()
  .regex(/^[0-9]*$/, 'Use digits only.')
  .refine(
    (value) => value === '' || Number.isSafeInteger(Number(value)),
    'Enter a smaller whole number.',
  );
export function WholeNumberField({
  label,
  value,
  required = false,
  disabled = false,
  onValue,
  onInvalid,
  description,
}: {
  label: string;
  value: number | null;
  required?: boolean;
  disabled?: boolean;
  onValue: (value: number | null) => void;
  // Reports rejected local text so an enclosing form can refuse to save.
  onInvalid?: (message: string | null) => void;
  // Read with the input (for example a roll's dice notation), placed directly
  // under it and before the reserved error slot.
  description?: ReactNode;
}) {
  // Rejected text never enters the form value, so react-hook-form's focus-loss
  // validation would see the retained valid number and clear the error while
  // the enclosing form still refuses to save. Remember the rejection so leaving
  // the field keeps that error until valid input replaces it.
  const rejected = useRef<string | null>(null);
  const form = useForm({
    values: { value: value === null ? '' : String(value) },
    mode: 'onBlur',
    resolver: zodResolver(
      z.object({
        value: digits.refine(
          (value) => !required || value !== '',
          'A value is required.',
        ),
      }),
    ),
    resetOptions: { keepErrors: true },
  });
  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="value"
        render={({ field }) => (
          <FormItem className="min-w-0 space-y-1">
            <FormLabel className="text-xs">{label}</FormLabel>
            <FormControl>
              <Input
                {...field}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                disabled={disabled}
                className="font-mono"
                onBlur={() => {
                  if (rejected.current === null) field.onBlur();
                  else form.setError('value', { message: rejected.current });
                }}
                onChange={(event) => {
                  const text = event.target.value;
                  const parsed = digits.safeParse(text);
                  if (!parsed.success) {
                    const message = parsed.error.issues[0]!.message;
                    rejected.current = message;
                    form.setError('value', { message });
                    onInvalid?.(message);
                    return;
                  }
                  rejected.current = null;
                  form.clearErrors('value');
                  onInvalid?.(null);
                  field.onChange(text);
                  onValue(text === '' ? null : Number(text));
                }}
              />
            </FormControl>
            {description && <FormDescription>{description}</FormDescription>}
            <div className="min-h-5">
              <FormMessage role="alert" />
            </div>
          </FormItem>
        )}
      />
    </Form>
  );
}
