import { z } from 'zod';
import {
  bonusTypes,
  leafTargets,
  modifierConditionSchema,
  modifierTargets,
  type LeafTarget,
  type ResolvedStatistic,
} from './character-sheet';

const sourcedModifierSchema = z.object({
  target: z.enum(modifierTargets),
  bonusType: z.enum(bonusTypes),
  value: z.number(),
  condition: modifierConditionSchema.optional(),
  stacksWithinEntry: z.literal(true).optional(),
  sheetEntryId: z.string(),
  entryName: z.string(),
  source: z.string(),
  builtIn: z.boolean(),
  stacksWithItself: z.boolean().optional(),
});
const breakdownsSchema = z.record(
  z.enum(leafTargets),
  z.object({
    total: z.number(),
    applied: z.array(sourcedModifierSchema),
    suppressed: z.array(
      sourcedModifierSchema.extend({
        reason: z.string(),
        suppressedBy: z.string(),
      }),
    ),
    conditional: z.array(sourcedModifierSchema),
  }),
);

export function parseCharacterSheetBreakdowns(
  breakdowns: unknown,
): Record<LeafTarget, ResolvedStatistic> {
  return breakdownsSchema.parse(breakdowns);
}
