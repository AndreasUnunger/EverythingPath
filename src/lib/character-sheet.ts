export const abilityKeys = [
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
] as const;
export type Ability = (typeof abilityKeys)[number];
export const abilityLabels: Record<Ability, string> = {
  strength: 'Strength',
  dexterity: 'Dexterity',
  constitution: 'Constitution',
  intelligence: 'Intelligence',
  wisdom: 'Wisdom',
  charisma: 'Charisma',
};
export type AbilityScores = Record<Ability, number>;
export const defaultAbilityScores: AbilityScores = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
};
export const abilityTargets = {
  strength: 'ability.str',
  dexterity: 'ability.dex',
  constitution: 'ability.con',
  intelligence: 'ability.int',
  wisdom: 'ability.wis',
  charisma: 'ability.cha',
} as const;
export type BaseModifier = {
  target: (typeof abilityTargets)[Ability];
  bonusType: 'base';
  value: number;
};
type SheetEntry =
  | {
      kind: 'base';
      active: true;
      catalogEntryId: string;
      state: { kind: 'base' };
    }
  | {
      kind: 'classLevel';
      active: true;
      state: {
        kind: 'classLevel';
        classEntryId: null;
        position: number;
        hpGained: number | null;
      };
    };

export function calculateCharacterSheet({
  entries,
  catalogEntries,
}: {
  entries: readonly SheetEntry[];
  catalogEntries: readonly {
    _id: string;
    modifiers: readonly BaseModifier[];
  }[];
}) {
  const [base, ...otherBases] = entries.filter(
    (entry) => entry.kind === 'base',
  );
  if (!base || otherBases.length > 0)
    throw new Error('A sheet requires one base-scores entry');
  const catalogEntry = catalogEntries.find(
    (item) => item._id === base.catalogEntryId,
  );
  if (!catalogEntry) throw new Error('Base scores are unavailable');
  const baseModifiers = catalogEntry.modifiers;
  if (baseModifiers.length !== 6)
    throw new Error('Base scores require six finite Modifiers');
  function calculateAbilityValue(ability: Ability) {
    const modifiers = baseModifiers.filter(
      (item) => item.target === abilityTargets[ability],
    );
    const [catalogEntryModifier, ...otherModifiers] = modifiers;
    if (
      !catalogEntryModifier ||
      otherModifiers.length > 0 ||
      !Number.isFinite(catalogEntryModifier.value)
    )
      throw new Error('Base scores require six finite Modifiers');
    const score = catalogEntryModifier.value;
    const abilityModifier = Math.floor((score - 10) / 2);
    return { score, modifier: abilityModifier };
  }
  const abilities = {
    strength: calculateAbilityValue('strength'),
    dexterity: calculateAbilityValue('dexterity'),
    constitution: calculateAbilityValue('constitution'),
    intelligence: calculateAbilityValue('intelligence'),
    wisdom: calculateAbilityValue('wisdom'),
    charisma: calculateAbilityValue('charisma'),
  };
  const levels = entries.filter((entry) => entry.kind === 'classLevel');
  const hp = levels.some((entry) => entry.state.hpGained === null)
    ? null
    : levels.reduce((total, entry) => total + (entry.state.hpGained ?? 0), 0) +
      abilities.constitution.modifier * levels.length;
  return { abilities, level: levels.length, hitDice: levels.length, hp };
}
