import { expect, test } from 'vitest';
import {
  canonicalRosterSchema,
  rosterWarnings,
  rosterWarningDescriptors,
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

test('[roster.limits] reward exemptions and held roles affect warnings without dropping any teams', () => {
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
  roster.teams[0]!.rewardCapExempt = true;
  // The legacy officer kind alone never makes an Officer; holding a role does.
  roster.people[0]!.kind = 'officer_npc';
  expect(rosterWarnings(roster, characters, 2)).toEqual([
    'A manages 3 teams; the normal limit is 1.',
  ]);
  roster.officers = [{ role: 'marshal', characterId: 'a' }];
  expect(rosterWarnings(roster, characters, 2)).toEqual([]);
  expect(roster.teams).toHaveLength(3);
});

test('[roster.role-limits] adding or removing an NPC’s last role raises or lowers their manager limit', () => {
  const roster = canonicalRosterSchema.parse({
    people: [
      { characterId: 'a', kind: 'npc', hitDice: null },
      { characterId: 'b', kind: 'pc', hitDice: null },
    ],
    officers: [
      { role: 'ambassador', characterId: 'a' },
      { role: 'marshal', characterId: 'a' },
    ],
    teams: ['one', 'two'].map((teamId) => ({
      teamId,
      teamType: 'defenders',
      name: teamId,
      status: 'active',
      rewardCapExempt: false,
      managerCharacterId: 'a',
      notes: '',
    })),
  });
  const characters = [
    { characterId: 'a', name: 'A', charisma: 17, isActive: true },
    { characterId: 'b', name: 'B', charisma: 17, isActive: true },
  ];
  const limits = () =>
    rosterWarnings(roster, characters, 5).filter((warning) =>
      warning.includes('normal limit'),
    );
  expect(limits()).toEqual([]);
  roster.officers = [{ role: 'marshal', characterId: 'a' }];
  expect(limits()).toEqual([]);
  roster.officers = [];
  expect(limits()).toEqual(['A manages 2 teams; the normal limit is 1.']);
  // Another person's role changes nothing; a PC's limit never needs one.
  roster.officers = [{ role: 'marshal', characterId: 'b' }];
  expect(limits()).toEqual(['A manages 2 teams; the normal limit is 1.']);
  for (const team of roster.teams) team.managerCharacterId = 'b';
  roster.officers = [];
  expect(limits()).toEqual([]);
});

test('[roster.warning-targets] structured warnings name their roster list and the control that repairs them', () => {
  const roster = canonicalRosterSchema.parse({
    people: [
      { characterId: 'a', kind: 'pc', hitDice: 3 },
      { characterId: 'b', kind: 'pc', hitDice: null },
    ],
    officers: [
      { role: 'commandant', characterId: 'b' },
      { role: 'marshal', characterId: 'b' },
    ],
    teams: ['one', 'two', 'three'].map((teamId) => ({
      teamId,
      teamType: 'defenders',
      name: teamId,
      status: 'active',
      rewardCapExempt: false,
      managerCharacterId: teamId === 'one' ? null : 'a',
      notes: '',
    })),
  });
  const characters = [
    { characterId: 'a', name: 'A', charisma: 10, isActive: true },
    { characterId: 'b', name: 'B', charisma: 10, isActive: false },
  ];
  const warnings = rosterWarningDescriptors(roster, characters, 3);
  expect(warnings).toEqual([
    {
      list: 'teams',
      message: 'A manages 2 teams; the normal limit is 1.',
      path: ['teams', 2, 'managerCharacterId'],
      characterId: 'a',
    },
    // A commandant's blank Hit Dice follow their level: no warning.
    {
      list: 'people',
      message: 'B holds more than one officer role.',
      characterId: 'b',
    },
    {
      list: 'people',
      message: 'B is archived but still assigned.',
      characterId: 'b',
    },
  ]);
  expect(rosterWarnings(roster, characters, 3)).toEqual(
    warnings.map((warning) => warning.message),
  );
});
