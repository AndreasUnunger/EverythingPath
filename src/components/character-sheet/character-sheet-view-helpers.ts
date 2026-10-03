import type { UnplacedSelection } from './class-levels';
import type { useCharacterSheet } from './use-character-sheet';

type ReadySheet = NonNullable<ReturnType<typeof useCharacterSheet>['sheet']>;

/**
 * Why HP cannot be stated: racial Hit Dice and the Class Levels still
 * without hit points.
 */
export function describeIncompleteHp({
  levels,
  raceStatistics,
}: Pick<ReadySheet, 'levels' | 'raceStatistics'>) {
  const positions = levels
    .filter((level) => level.state.hpGained === null)
    .map((level) => level.state.position);
  const isRacialMissing =
    raceStatistics !== null &&
    raceStatistics.racialHitDice > 0 &&
    raceStatistics.racialHpGained === null;
  if (positions.length === 0)
    return isRacialMissing
      ? 'Not complete: racial Hit Dice have no hit points yet.'
      : null;
  const list = positions.join(', ');
  const classLevels =
    positions.length === 1 ? `Class Level ${list}` : `Class Levels ${list}`;
  if (isRacialMissing)
    return `Not complete: racial Hit Dice and ${classLevels} have no hit points yet.`;
  const verb = positions.length === 1 ? 'has' : 'have';
  return `Not complete: ${classLevels} ${verb} no hit points yet.`;
}

// A selection whose Class Level was deleted keeps its name; it is shown by
// the levels, not moved to a successor.
export function listUnplacedSelections(sheet: ReadySheet): UnplacedSelection[] {
  return sheet.unplacedSelections.map((selection) => ({
    entryId: selection._id,
    name: selection.name,
  }));
}

// The race and Archetype blocks render their own sections; the Grants block
// keeps every other kind.
const ownBlockKinds = new Set(['race', 'racialTrait', 'archetype']);
export function listGrantBlockSections(sections: ReadySheet['grants']) {
  return sections.filter((section) => !ownBlockKinds.has(section.kind));
}

export function findArchetypeSection(sections: ReadySheet['grants']) {
  return sections.find((section) => section.kind === 'archetype');
}
