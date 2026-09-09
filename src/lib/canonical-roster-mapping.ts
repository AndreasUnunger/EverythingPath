import {
  canonicalRosterSchema,
  mapLegacyOfficers,
  type CanonicalRoster,
  type OFFICER_ROLES,
} from './canonical-roster';
import type { TeamId, TeamStatus } from './militia-domain';

export type LegacyRosterInput = {
  characters: { _id: string; kind?: 'pc' | 'officer_npc'; hitDice?: number }[];
  holders: Partial<Record<(typeof OFFICER_ROLES)[number], string>>;
  teams: {
    _id: string;
    teamId: TeamId;
    managerSource?: 'character' | 'freeform';
    managerCharacterId?: string;
  }[];
};
export type LegacyTeamFacts = {
  legacyTeamId: string;
  name: string;
  status: TeamStatus;
  rewardCapExempt: boolean;
  managerCharacterId: string | null;
  notes: string;
};

// Read-only preflight. Explicit per-team facts resolve what type-keyed legacy
// storage cannot prove. Stable source keys make repeated preparation restartable.
export function prepareLegacyRoster(
  input: LegacyRosterInput,
  teamFacts: LegacyTeamFacts[],
) {
  const { teams, issues } = prepareLegacyTeams(input.teams, teamFacts);
  const candidate = {
    people: input.characters.map((character) => ({
      characterId: character._id,
      kind: character.kind ?? 'pc',
      hitDice: character.hitDice ?? null,
    })),
    officers: mapLegacyOfficers(input.holders),
    teams,
  };
  const parsed = canonicalRosterSchema.safeParse(candidate);
  if (!parsed.success)
    issues.push(...parsed.error.issues.map((issue) => issue.message));
  for (const officer of candidate.officers) {
    if (
      officer.role === 'commandant' &&
      candidate.people.find(
        (person) => person.characterId === officer.characterId,
      )?.hitDice == null
    )
      issues.push(`Resolve Commandant Hit Dice for ${officer.characterId}.`);
  }
  return {
    roster:
      parsed.success && teams.length === input.teams.length
        ? parsed.data
        : null,
    issues,
    ready: issues.length === 0,
  };
}

function prepareLegacyTeams(
  legacyTeams: LegacyRosterInput['teams'],
  teamFacts: LegacyTeamFacts[],
) {
  const issues: string[] = [];
  const teams: CanonicalRoster['teams'] = [];
  for (const team of legacyTeams) {
    const matches = teamFacts.filter((fact) => fact.legacyTeamId === team._id);
    const fact = matches[0];
    if (matches.length !== 1 || !fact) {
      issues.push(
        `Resolve condition, reward exemption and manager for team ${team._id}.`,
      );
      continue;
    }
    if (
      team.managerSource === 'character' &&
      team.managerCharacterId !== fact.managerCharacterId
    ) {
      issues.push(`Preserve the linked manager for team ${team._id}.`);
      continue;
    }
    if (team.managerSource === 'freeform' && fact.managerCharacterId === null) {
      issues.push(
        `Link the existing freeform manager for team ${team._id} to a character record.`,
      );
      continue;
    }
    const { legacyTeamId, ...values } = fact;
    teams.push({
      ...values,
      teamId: `legacy-team:${legacyTeamId}`,
      teamType: team.teamId,
    });
  }
  return { teams, issues };
}
