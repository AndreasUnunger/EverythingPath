import { abilityModifier } from './ability-scores';
import { getEffectiveHitDice, type CanonicalRoster } from './canonical-roster';

export type FoundationCharacter = {
  characterId: string;
  level: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  isActive: boolean;
};
export type OrganizationCheck = 'loyalty' | 'secrecy' | 'security';
const abilities = {
  loyalty: ['constitution', 'charisma'],
  secrecy: ['dexterity', 'intelligence'],
  security: ['strength', 'wisdom'],
} as const;
export type OfficerAbility = (typeof abilities)[OrganizationCheck][number];
/**
 * The ability an officer adds to a check and its modifier: the better of
 * the two the rules allow, the first on a tie.
 */
export function officerAbilitySource(
  character: FoundationCharacter,
  check: OrganizationCheck,
): { ability: OfficerAbility; modifier: number } {
  const [first, second] = abilities[check];
  const one = abilityModifier(character[first]);
  const two = abilityModifier(character[second]);
  return two > one
    ? { ability: second, modifier: two }
    : { ability: first, modifier: one };
}
export function officerAbility(
  character: FoundationCharacter,
  check: OrganizationCheck,
) {
  return officerAbilitySource(character, check).modifier;
}
export function projectOfficers(
  roster: CanonicalRoster,
  characters: FoundationCharacter[],
  focus: string | null,
) {
  const requirements: string[] = [];
  const warnings: string[] = [];
  function holders(role: CanonicalRoster['officers'][number]['role']) {
    return roster.officers
      .filter((x) => x.role === role)
      .flatMap((x) => {
        const character = characters.find(
          (c) => c.characterId === x.characterId,
        );
        if (!character) {
          requirements.push(`officer:${x.characterId}:character`);
          return [];
        }
        // Archiving does not silently unassign a person; the table can correct it.
        if (!character.isActive)
          warnings.push(`officer:${x.characterId}:archived`);
        return [character];
      });
  }
  function best(
    role: 'ambassador' | 'marshal' | 'spymaster',
    check: OrganizationCheck,
  ) {
    const assigned = holders(role);
    return assigned.length
      ? Math.max(...assigned.map((x) => officerAbility(x, check)))
      : 0;
  }
  const overseers = holders('overseer');
  const strategists = holders('strategist');
  const commandants = holders('commandant');
  // Commandants stack: each distinct holder adds their effective Hit Dice.
  const commandantTrainingBonus = commandants.reduce((total, character) => {
    const person = roster.people.find(
      (x) => x.characterId === character.characterId,
    );
    return total + (person ? getEffectiveHitDice(person, character) : 0);
  }, 0);
  const secondary = (check: OrganizationCheck) =>
    focus && check !== focus.toLowerCase() && overseers.length ? 1 : 0;
  return {
    requirements,
    warnings,
    bonuses: {
      loyalty: best('ambassador', 'loyalty') + secondary('loyalty'),
      secrecy: best('spymaster', 'secrecy') + secondary('secrecy'),
      security: best('marshal', 'security') + secondary('security'),
    },
    commandantTrainingBonus,
    strategistAssigned: strategists.length > 0,
    overseers,
  };
}
