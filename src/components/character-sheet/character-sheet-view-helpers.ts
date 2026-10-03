import type { UnplacedSelection } from './class-levels';
import type { useCharacterSheet } from './use-character-sheet';

type ReadySheet = NonNullable<ReturnType<typeof useCharacterSheet>['sheet']>;

/** Why HP cannot be stated: the Class Levels still without hit points. */
export function describeIncompleteHp(levels: ReadySheet['levels']) {
  const positions = levels
    .filter((level) => level.state.hpGained === null)
    .map((level) => level.state.position);
  if (positions.length === 0) return null;
  const list = positions.join(', ');
  return positions.length === 1
    ? `Not complete: Class Level ${list} has no hit points yet.`
    : `Not complete: Class Levels ${list} have no hit points yet.`;
}

// A selection whose Class Level was deleted keeps its name; it is shown by
// the levels, not moved to a successor.
export function listUnplacedSelections(sheet: ReadySheet): UnplacedSelection[] {
  return sheet.unplacedSelections.map((selection) => ({
    entryId: selection._id,
    name: selection.name,
  }));
}
