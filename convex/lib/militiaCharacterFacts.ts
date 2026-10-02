import type { Doc } from '../_generated/dataModel';
import type { CanonicalWeekState } from '../../src/lib/canonical-weekly-source';

// Militia Character Facts still come from the flat Character fields. A later
// sheet resolver can replace this calculation without changing their shape.
export function calculateMilitiaCharacterFacts(
  character: Doc<'character'>,
): CanonicalWeekState['militiaSnapshot']['characters'][number] {
  return {
    characterId: character._id,
    level: character.level,
    strength: character.strength,
    dexterity: character.dexterity,
    constitution: character.constitution,
    intelligence: character.intelligence,
    wisdom: character.wisdom,
    charisma: character.charisma,
    isActive: character.isActive,
  };
}
