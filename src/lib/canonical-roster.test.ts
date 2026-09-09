import { expect, test } from 'vitest';
import {
  canonicalRosterSchema,
  rosterWarnings,
  mapLegacyOfficers,
} from './canonical-roster';

test('[roster.identities] repeated teams keep independent conditions, exemptions and managers', () => {
  const roster = canonicalRosterSchema.parse({
    people: [{ characterId: 'alice', hitDice: 7, kind: 'pc' }],
    officers: [{ role: 'commandant', characterId: 'alice' }],
    teams: [
      {
        teamId: 'first',
        teamType: 'defenders',
        name: 'First',
        status: 'disabled',
        rewardCapExempt: false,
        managerCharacterId: 'alice',
        notes: '',
      },
      {
        teamId: 'second',
        teamType: 'defenders',
        name: 'Second',
        status: 'missing',
        rewardCapExempt: true,
        managerCharacterId: 'alice',
        notes: 'Campaign reward',
      },
    ],
  });
  expect(
    roster.teams.map((team) => [
      team.teamId,
      team.status,
      team.rewardCapExempt,
    ]),
  ).toEqual([
    ['first', 'disabled', false],
    ['second', 'missing', true],
  ]);
  expect(
    rosterWarnings(
      roster,
      [{ characterId: 'alice', name: 'Alice', charisma: 10, isActive: true }],
      1,
    ),
  ).toEqual(['Alice manages 2 teams; the normal limit is 1.']);
  expect(mapLegacyOfficers({ commandant: 'alice', marshal: 'bob' })).toEqual([
    { role: 'commandant', characterId: 'alice' },
    { role: 'marshal', characterId: 'bob' },
  ]);
});

test('[roster.validation] duplicate identities and dangling manager references are structural errors', () => {
  const team = {
    teamId: 'one',
    teamType: 'defenders',
    name: 'First',
    status: 'active',
    rewardCapExempt: false,
    managerCharacterId: null,
    notes: '',
  };
  expect(
    canonicalRosterSchema.safeParse({
      people: [],
      officers: [],
      teams: [team, team],
    }).success,
  ).toBe(false);
  expect(
    canonicalRosterSchema.safeParse({
      people: [],
      officers: [],
      teams: [{ ...team, managerCharacterId: 'missing' }],
    }).success,
  ).toBe(false);
  expect(
    canonicalRosterSchema.safeParse({
      people: [{ characterId: 'a', kind: 'pc', hitDice: NaN }],
      officers: [],
      teams: [],
    }).success,
  ).toBe(false);
});

test('[roster.limits] reward exemptions and manager kinds affect warnings without dropping any teams', () => {
  const roster = canonicalRosterSchema.parse({
    people: [{ characterId: 'a', kind: 'other_npc', hitDice: null }],
    officers: [],
    teams: ['one', 'two', 'three'].map((teamId) => ({
      teamId,
      teamType: 'defenders',
      name: teamId,
      status: 'missing',
      rewardCapExempt: false,
      managerCharacterId: 'a',
      notes: '',
    })),
  });
  const characters = [
    { characterId: 'a', name: 'A', charisma: 18, isActive: true },
  ];
  expect(rosterWarnings(roster, characters, 2)).toEqual([
    '3 teams count toward the normal limit of 2.',
    'A manages 3 teams; the normal limit is 1.',
  ]);
  roster.people[0]!.kind = 'officer_npc';
  roster.teams[0]!.rewardCapExempt = true;
  expect(rosterWarnings(roster, characters, 2)).toEqual([]);
  expect(roster.teams).toHaveLength(3);
});
