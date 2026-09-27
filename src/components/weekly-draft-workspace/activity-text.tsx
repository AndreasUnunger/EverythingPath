'use client';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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

// One saved text value (a subject, an outcome, a reason): typed locally and
// written with its Save button, so each keystroke is not a shared edit.
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
