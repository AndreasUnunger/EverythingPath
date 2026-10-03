import type { Doc } from '../_generated/dataModel';
import type { CanonicalWeekState } from '../../src/lib/canonical-weekly-source';
import type { ReadCtx } from '../types';
import { ConvexError } from 'convex/values';
import { abilityKeys, type Ability } from '../../src/lib/character-sheet';
import {
  loadPreparedCharacterSheet,
  requireAbilityScore,
} from './preparedCharacterSheet';

export function requireWholeCharacterStatistics(
  statistics: Partial<Pick<Doc<'character'>, 'level' | Ability>>,
) {
  if (statistics.level !== undefined && !Number.isSafeInteger(statistics.level))
    throw new ConvexError('Enter a whole level');
  for (const ability of abilityKeys) {
    const score = statistics[ability];
    if (score !== undefined) requireAbilityScore(score);
  }
}

export async function calculateMilitiaCharacterFacts(
  ctx: ReadCtx,
  character: Doc<'character'>,
  preparedSheet:
    | Awaited<ReturnType<typeof loadPreparedCharacterSheet>>
    | undefined = undefined,
): Promise<CanonicalWeekState['militiaSnapshot']['characters'][number]> {
  const sheet =
    preparedSheet === undefined
      ? await loadPreparedCharacterSheet(ctx, character)
      : preparedSheet;
  // Base scores, Class Levels and Personal Adjustments are permanent today.
  // Select the shared permanent projection here when temporary entries land.
  const calculated = sheet?.calculated;
  const facts = {
    characterId: character._id,
    level: calculated?.level ?? character.level,
    strength: calculated?.abilities.strength.score ?? character.strength,
    dexterity: calculated?.abilities.dexterity.score ?? character.dexterity,
    constitution:
      calculated?.abilities.constitution.score ?? character.constitution,
    intelligence:
      calculated?.abilities.intelligence.score ?? character.intelligence,
    wisdom: calculated?.abilities.wisdom.score ?? character.wisdom,
    charisma: calculated?.abilities.charisma.score ?? character.charisma,
    isActive: character.isActive,
  };
  requireWholeCharacterStatistics(facts);
  return facts;
}
