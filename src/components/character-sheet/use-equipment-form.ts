'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSheetValueForm } from './use-sheet-value-form';

export type EquipmentValues = {
  masterwork?: boolean;
  enhancement?: number;
  material?: string | null;
};

const schema = z.object({
  masterwork: z.boolean(),
  enhancement: z.string().superRefine((value, context) => {
    if (!value.trim())
      context.addIssue({ code: 'custom', message: 'Enhancement is required' });
    else if (
      !/^\d+$/.test(value.trim()) ||
      !Number.isSafeInteger(Number(value))
    )
      context.addIssue({
        code: 'custom',
        message: 'Enhancement must be a whole number of 0 or more',
      });
  }),
  material: z.string(),
});

export function useEquipmentForm({
  value,
  save,
}: {
  value: EquipmentValues;
  save: (value: Required<EquipmentValues>) => Promise<unknown>;
}) {
  return useSheetValueForm({
    incoming: {
      masterwork: value.masterwork ?? false,
      enhancement: String(value.enhancement ?? 0),
      material: value.material ?? '',
    },
    resolver: zodResolver(schema),
    normalize: (values) =>
      schema.safeParse(values).success
        ? {
            ...values,
            enhancement: String(Number(values.enhancement)),
            material: values.material.trim(),
          }
        : null,
    write: (values) =>
      save({
        masterwork: values.masterwork,
        enhancement: Number(values.enhancement),
        material: values.material || null,
      }),
  });
}
