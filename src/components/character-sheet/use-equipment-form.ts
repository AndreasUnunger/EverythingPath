'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { equipmentFormSchema } from './equipment-form-schema';
import { useSheetValueForm } from './use-sheet-value-form';

export type EquipmentValues = {
  masterwork?: boolean;
  enhancement?: number;
  material?: string | null;
};

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
    resolver: zodResolver(equipmentFormSchema),
    normalize: (values) =>
      equipmentFormSchema.safeParse(values).success
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
