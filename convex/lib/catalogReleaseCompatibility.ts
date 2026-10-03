import { ConvexError } from 'convex/values';
import type { ReadCtx } from '../types';
import {
  calculateCharacterSheetProjections,
  type CharacterSheetInput,
} from '../../src/lib/character-sheet';
import { catalogRuntimeCompatibility } from '../../src/lib/catalog/runtime-compatibility';

export async function requireCompatibleActiveRelease(ctx: ReadCtx) {
  const active = await ctx.db
    .query('catalogReleaseControl')
    .withIndex('by_key', (q) => q.eq('key', 'global'))
    .unique();
  if (
    active &&
    (active.schemaIdentity !== catalogRuntimeCompatibility.schema ||
      active.calculationIdentity !== catalogRuntimeCompatibility.calculation)
  )
    throw new ConvexError(
      'Active Catalog Release requires unavailable schema or calculation behavior',
    );
}

export function calculateActiveCharacterSheet(input: CharacterSheetInput) {
  return calculateCharacterSheetProjections(input);
}
