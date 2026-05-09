import { z } from 'zod';
import { TEAM_IDS } from '~/lib/team-ids';

export const marketplaceSourceActionOptions = [
  'broker_market',
  'activate_black_market',
] as const;

export const marketplaceAvailabilityTierOptions = [
  'small_town',
  'small_city',
] as const;

export const marketplaceContrabandOptions = ['no', 'yes'] as const;
export const marketplaceTeamOptions = TEAM_IDS;
const WHOLE_NUMBER_PATTERN = /^-?\d+$/;

function requiredWholeNumber(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((value) => WHOLE_NUMBER_PATTERN.test(value), {
      message: `${label} must be a whole number`,
    });
}

function optionalWholeNumber(label: string) {
  return z
    .string()
    .trim()
    .refine((value) => value === '' || WHOLE_NUMBER_PATTERN.test(value), {
      message: `${label} must be a whole number`,
    });
}

export const marketplaceFormSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, 'Marketplace label is required')
    .max(100, 'Marketplace label must be 100 characters or fewer'),
  sourceAction: z.enum(marketplaceSourceActionOptions),
  teamId: z.union([z.literal(''), z.enum(marketplaceTeamOptions)]).refine(
    (value) => value !== '',
    {
      message: 'Team is required',
    },
  ),
  availabilityTier: z.enum(marketplaceAvailabilityTierOptions),
  availabilityThreshold: requiredWholeNumber('Availability threshold'),
  saleValuePercent: requiredWholeNumber('Sale value percent'),
  contrabandAllowed: z.enum(marketplaceContrabandOptions),
  createdWeek: requiredWholeNumber('Created week'),
  activeUntilWeek: requiredWholeNumber('Active through week'),
  marketDayDiscountPercent: optionalWholeNumber('Market Day discount percent'),
  marketDayAppliedWeek: optionalWholeNumber('Market Day applied week'),
  notes: z
    .string()
    .trim()
    .max(300, 'Notes must be 300 characters or fewer')
    .optional()
    .or(z.literal('')),
});

export type MarketplaceFormInput = z.input<typeof marketplaceFormSchema>;
export type MarketplaceFormValues = z.output<typeof marketplaceFormSchema>;

export const defaultMarketplaceFormValues: MarketplaceFormInput = {
  label: '',
  sourceAction: 'broker_market',
  teamId: '',
  availabilityTier: 'small_town',
  availabilityThreshold: '',
  saleValuePercent: '',
  contrabandAllowed: 'no',
  createdWeek: '',
  activeUntilWeek: '',
  marketDayDiscountPercent: '',
  marketDayAppliedWeek: '',
  notes: '',
};
