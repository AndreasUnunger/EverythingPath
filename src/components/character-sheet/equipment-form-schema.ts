import { z } from 'zod';

export const equipmentFormSchema = z.object({
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
