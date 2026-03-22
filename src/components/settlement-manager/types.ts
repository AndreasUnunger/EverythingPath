import type { Doc, Id } from '@convex/_generated/dataModel';
import { z } from 'zod';

export const settlementReputationOptions = [
  'Hostile',
  'Unfriendly',
  'Indifferent',
  'Friendly',
  'Helpful',
] as const;

export const settlementSecuredStateOptions = ['unsecured', 'secured'] as const;

export const settlementFormSchema = z.object({
  settlementKey: z
    .string()
    .trim()
    .min(1, 'Settlement name is required')
    .max(100, 'Settlement name must be 100 characters or fewer'),
  reputation: z.enum(settlementReputationOptions),
  securedState: z.enum(settlementSecuredStateOptions),
});

export type SettlementFormValues = z.infer<typeof settlementFormSchema>;

export const defaultSettlementFormValues: SettlementFormValues = {
  settlementKey: '',
  reputation: 'Indifferent',
  securedState: 'unsecured',
};

export type SettlementRecord = Doc<'militiaSettlementState'>;
export type SettlementId = Id<'militiaSettlementState'>;
