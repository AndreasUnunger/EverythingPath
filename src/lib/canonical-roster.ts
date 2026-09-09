import { z } from 'zod';
import { TEAM_IDS, TEAM_STATUSES } from './militia-domain';
import { identitySchema } from './weekly-draft-facts';
import { getTeamManagerMaxTeams } from './team-manager-rules';

export const OFFICER_ROLES = [
  'ambassador',
  'commandant',
  'marshal',
  'overseer',
  'spymaster',
  'strategist',
] as const;
export const rosterPersonSchema = z.strictObject({
  characterId: identitySchema,
  kind: z.enum(['pc', 'officer_npc', 'other_npc']),
  // Unknown legacy Hit Dice stay unknown. Level is not a substitute.
  hitDice: z.number().int().nonnegative().nullable(),
});
export const rosterTeamSchema = z.strictObject({
  teamId: identitySchema,
  teamType: z.enum(TEAM_IDS),
  name: z.string().trim().min(1, 'Team name is required').max(100),
  status: z.enum(TEAM_STATUSES),
  rewardCapExempt: z.boolean(),
  managerCharacterId: identitySchema.nullable(),
  notes: z.string().max(500),
});
export const rosterOfficerSchema = z.strictObject({
  role: z.enum(OFFICER_ROLES),
  characterId: identitySchema,
});
// Technical document bounds, deliberately far above the normal rules allowances.
export const canonicalRosterDataSchema = z.strictObject({
  people: z.array(rosterPersonSchema).max(256),
  teams: z.array(rosterTeamSchema).max(256),
  officers: z.array(rosterOfficerSchema).max(1536),
});
export const canonicalRosterSchema = canonicalRosterDataSchema.superRefine(
  (roster, ctx) => {
    const people = new Set(roster.people.map((person) => person.characterId));
    if (people.size !== roster.people.length)
      ctx.addIssue({
        code: 'custom',
        path: ['people'],
        message: 'Duplicate character reference',
      });
    if (
      new Set(roster.teams.map((team) => team.teamId)).size !==
      roster.teams.length
    )
      ctx.addIssue({
        code: 'custom',
        path: ['teams'],
        message: 'Duplicate team identity',
      });
    const assignments = new Set<string>();
    roster.officers.forEach((officer, index) => {
      const key = `${officer.role}:${officer.characterId}`;
      if (assignments.has(key))
        ctx.addIssue({
          code: 'custom',
          path: ['officers', index],
          message: 'Duplicate officer assignment',
        });
      assignments.add(key);
      if (!people.has(officer.characterId))
        ctx.addIssue({
          code: 'custom',
          path: ['officers', index, 'characterId'],
          message: 'Choose a character in this roster',
        });
    });
    roster.teams.forEach((team, index) => {
      if (
        team.managerCharacterId !== null &&
        !people.has(team.managerCharacterId)
      )
        ctx.addIssue({
          code: 'custom',
          path: ['teams', index, 'managerCharacterId'],
          message: 'Choose a manager in this roster',
        });
    });
  },
);
export type CanonicalRoster = z.infer<typeof canonicalRosterSchema>;
export type RosterCharacter = {
  characterId: string;
  name: string;
  charisma: number;
  isActive: boolean;
};

export function rosterWarnings(
  roster: CanonicalRoster,
  characters: RosterCharacter[],
  maxTeams: number,
) {
  const warnings: string[] = [];
  const counted = roster.teams.filter((team) => !team.rewardCapExempt).length;
  if (counted > maxTeams)
    warnings.push(
      `${counted} teams count toward the normal limit of ${maxTeams}.`,
    );
  for (const person of roster.people) {
    const character = characters.find(
      (value) => value.characterId === person.characterId,
    );
    if (!character) continue; // Reference integrity is enforced separately, never invented here.
    const roles = roster.officers.filter(
      (officer) => officer.characterId === person.characterId,
    );
    const managed = roster.teams.filter(
      (team) => team.managerCharacterId === person.characterId,
    ).length;
    const limit = getTeamManagerMaxTeams({
      kind: person.kind,
      charisma: character.charisma,
    });
    if (managed > limit)
      warnings.push(
        `${character.name} manages ${managed} teams; the normal limit is ${limit}.`,
      );
    if (roles.length > 1)
      warnings.push(`${character.name} holds more than one officer role.`);
    if (
      roles.some((officer) => officer.role === 'commandant') &&
      person.hitDice === null
    )
      warnings.push(
        `Enter ${character.name}'s Hit Dice before resolving Commandant training.`,
      );
    if (!character.isActive && (roles.length || managed))
      warnings.push(`${character.name} is archived but still assigned.`);
  }
  return warnings;
}

export function mapLegacyOfficers(
  holders: Partial<Record<(typeof OFFICER_ROLES)[number], string>>,
) {
  return OFFICER_ROLES.flatMap((role) =>
    holders[role] ? [{ role, characterId: holders[role] }] : [],
  );
}
