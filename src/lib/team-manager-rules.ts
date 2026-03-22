import { abilityModifier } from './ability-scores';

export type TeamManagerSource = 'character' | 'freeform';
export type TeamManagerKind = 'pc' | 'officer_npc' | 'other_npc';

export type TeamManagerCharacter = {
  _id: string;
  name: string;
  kind?: 'pc' | 'officer_npc';
  charisma: number;
  isActive?: boolean;
};

export type TeamManagerAssignment = {
  teamId: string;
  managerSource?: TeamManagerSource;
  managerCharacterId?: string;
  managerName?: string;
  managerKind?: TeamManagerKind;
  managerCharisma?: number;
};

export type ResolvedTeamManager = {
  source: TeamManagerSource;
  identityKey: string;
  characterId?: string;
  displayName: string;
  kind: TeamManagerKind;
  charisma: number;
  charismaBonus: number;
  maxTeams: number;
  managedTeamCount: number;
  warnings: string[];
};

export function getTeamManagerCharismaBonus(charisma: number) {
  return Math.max(0, abilityModifier(charisma));
}

export function getTeamManagerMaxTeams({
  kind,
  charisma,
}: {
  kind: TeamManagerKind;
  charisma: number;
}) {
  if (kind === 'other_npc') {
    return 1;
  }

  return Math.max(1, abilityModifier(charisma));
}

export function buildResolvedTeamManagers({
  teams,
  characters,
}: {
  teams: TeamManagerAssignment[];
  characters: TeamManagerCharacter[];
}) {
  const charactersById = new Map(characters.map((character) => [character._id, character]));
  const baseResolved = new Map<string, Omit<ResolvedTeamManager, 'managedTeamCount'>>();
  const counts = new Map<string, number>();

  for (const team of teams) {
    const resolved = resolveSingleTeamManager({
      team,
      charactersById,
    });
    if (!resolved) {
      continue;
    }

    baseResolved.set(team.teamId, resolved);
    counts.set(resolved.identityKey, (counts.get(resolved.identityKey) ?? 0) + 1);
  }

  return new Map(
    teams.map((team) => {
      const resolved = baseResolved.get(team.teamId);
      if (!resolved) {
        return [team.teamId, null];
      }

      const managedTeamCount = counts.get(resolved.identityKey) ?? 1;
      const warnings = [...resolved.warnings];
      if (managedTeamCount > resolved.maxTeams) {
        warnings.push(
          `Managing ${managedTeamCount} teams exceeds the normal limit of ${resolved.maxTeams}.`,
        );
      }

      return [
        team.teamId,
        {
          ...resolved,
          managedTeamCount,
          warnings,
        } satisfies ResolvedTeamManager,
      ];
    }),
  );
}

export function formatTeamManagerBonus(manager: Pick<
  ResolvedTeamManager,
  'displayName' | 'charismaBonus'
>) {
  return `${manager.displayName} manager CHA bonus ${formatSigned(manager.charismaBonus)}`;
}

function resolveSingleTeamManager({
  team,
  charactersById,
}: {
  team: TeamManagerAssignment;
  charactersById: Map<string, TeamManagerCharacter>;
}) {
  if (team.managerSource === 'character' && team.managerCharacterId) {
    const character = charactersById.get(team.managerCharacterId);
    if (!character) {
      return {
        source: 'character' as const,
        identityKey: `character:${team.managerCharacterId}`,
        characterId: team.managerCharacterId,
        displayName: 'Missing character',
        kind: 'pc' as const,
        charisma: 10,
        charismaBonus: 0,
        maxTeams: 1,
        warnings: ['Linked manager character no longer exists.'],
      };
    }

    const kind = character.kind ?? 'pc';
    return {
      source: 'character' as const,
      identityKey: `character:${character._id}`,
      characterId: character._id,
      displayName: character.name,
      kind,
      charisma: character.charisma,
      charismaBonus: getTeamManagerCharismaBonus(character.charisma),
      maxTeams: getTeamManagerMaxTeams({
        kind,
        charisma: character.charisma,
      }),
      warnings:
        character.isActive === false
          ? ['Linked manager character is archived.']
          : [],
    };
  }

  if (
    team.managerSource === 'freeform' &&
    team.managerName &&
    team.managerKind &&
    team.managerCharisma !== undefined
  ) {
    const displayName = team.managerName.trim();
    if (!displayName) {
      return null;
    }

    return {
      source: 'freeform' as const,
      identityKey: `freeform:${displayName.toLocaleLowerCase()}`,
      displayName,
      kind: team.managerKind,
      charisma: team.managerCharisma,
      charismaBonus: getTeamManagerCharismaBonus(team.managerCharisma),
      maxTeams: getTeamManagerMaxTeams({
        kind: team.managerKind,
        charisma: team.managerCharisma,
      }),
      warnings: [],
    };
  }

  return null;
}

function formatSigned(value: number) {
  return value >= 0 ? `+${value}` : String(value);
}
