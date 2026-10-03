import {
  abilityLabels,
  type Ability,
  type CharacterSheetProjections,
} from './character-sheet';

// CRB Skills: the current permanent Intelligence applies to every recorded class level.
export function calculateOrdinarySkillBudget(
  projections: CharacterSheetProjections,
  levels: readonly {
    baseRanks: number;
    racialRanks?: number;
    favoredClassRanks?: number;
  }[],
) {
  const intelligence = projections.permanent.abilities.intelligence.modifier;
  return levels.reduce(
    (total, level) =>
      total +
      Math.max(1, level.baseRanks + intelligence) +
      (level.racialRanks ?? 0) +
      (level.favoredClassRanks ?? 0),
    0,
  );
}

// #238: replacement selection uses current modifiers, bonus spells use that ability's permanent score.
export function calculateBonusSpells(
  projections: CharacterSheetProjections,
  {
    baseAbility,
    replacementAbilities = [],
    spellsPerDay,
  }: {
    baseAbility: Ability;
    replacementAbilities?: readonly Ability[];
    spellsPerDay: readonly (number | null)[];
  },
) {
  const ability =
    [...new Set(replacementAbilities)].sort(
      (left, right) =>
        projections.current.abilities[right].modifier -
          projections.current.abilities[left].modifier ||
        abilityLabels[left].localeCompare(abilityLabels[right]),
    )[0] ?? baseAbility;
  const modifier = Math.floor(
    (projections.permanent.abilities[ability].score - 10) / 2,
  );
  const bonusSpells = spellsPerDay.map((entry, level) =>
    entry === null || level === 0 || level > 9 || modifier < level
      ? 0
      : 1 + Math.floor((modifier - level) / 4),
  );
  return { ability, bonusSpells };
}
