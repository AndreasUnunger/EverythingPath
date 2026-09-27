import { z } from 'zod';
import { TEAM_IDS, TEAM_STATUSES } from './militia-domain';
import { identitySchema } from './weekly-draft-facts';
import { getTeamManagerMaxTeams } from './team-manager-rules';
import { toCurrentRulesManagerKind, rosterKindSchema } from './character-kind';

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
  // Stored mirror of the record kind: legacy and approved values stay verbatim.
  kind: rosterKindSchema,
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

// A rules warning with the roster list it concerns and, where one control can
// repair it, that control's path within the roster.
export type RosterWarning = {
  list: 'people' | 'teams';
  message: string;
  path?:
    | ['people', number, 'hitDice']
    | ['teams', number, 'managerCharacterId'];
};
export function rosterWarnings(
  roster: CanonicalRoster,
  characters: RosterCharacter[],
  maxTeams: number,
) {
  return rosterWarningDescriptors(roster, characters, maxTeams).map(
    (warning) => warning.message,
  );
}
export function rosterWarningDescriptors(
  roster: CanonicalRoster,
  characters: RosterCharacter[],
  maxTeams: number,
) {
  const warnings: RosterWarning[] = [];
  const counted = roster.teams.filter((team) => !team.rewardCapExempt).length;
  if (counted > maxTeams)
    warnings.push({
      list: 'teams',
      message: `${counted} teams count toward the normal limit of ${maxTeams}.`,
    });
  roster.people.forEach((person, personIndex) => {
    const character = characters.find(
      (value) => value.characterId === person.characterId,
    );
    if (!character) return; // Reference integrity is enforced separately, never invented here.
    const roles = roster.officers.filter(
      (officer) => officer.characterId === person.characterId,
    );
    const managed = roster.teams.flatMap((team, index) =>
      team.managerCharacterId === person.characterId ? [index] : [],
    );
    const limit = getTeamManagerMaxTeams({
      kind: toCurrentRulesManagerKind(person.kind),
      charisma: character.charisma,
    });
    // Present exactly when the person manages more teams than the limit.
    const firstBeyondLimit = managed[limit];
    if (firstBeyondLimit !== undefined)
      warnings.push({
        list: 'teams',
        message: `${character.name} manages ${managed.length} teams; the normal limit is ${limit}.`,
        path: ['teams', firstBeyondLimit, 'managerCharacterId'],
      });
    if (roles.length > 1)
      warnings.push({
        list: 'people',
        message: `${character.name} holds more than one officer role.`,
      });
    if (
      roles.some((officer) => officer.role === 'commandant') &&
      person.hitDice === null
    )
      warnings.push({
        list: 'people',
        message: `Enter ${character.name}'s Hit Dice before resolving Commandant training.`,
        path: ['people', personIndex, 'hitDice'],
      });
    if (!character.isActive && (roles.length || managed.length))
      warnings.push({
        list: 'people',
        message: `${character.name} is archived but still assigned.`,
      });
  });
  return warnings;
}

export function mapLegacyOfficers(
  holders: Partial<Record<(typeof OFFICER_ROLES)[number], string>>,
) {
  return OFFICER_ROLES.flatMap((role) =>
    holders[role] ? [{ role, characterId: holders[role] }] : [],
  );
}
