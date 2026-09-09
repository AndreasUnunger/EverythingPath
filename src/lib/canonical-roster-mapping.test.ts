import { expect, test } from 'vitest';
import {
  prepareLegacyRoster,
  type LegacyRosterInput,
  type LegacyTeamFacts,
} from './canonical-roster-mapping';

const legacy: LegacyRosterInput = {
  characters: [
    { _id: 'alice', kind: 'pc' },
    { _id: 'bob', kind: 'officer_npc' },
  ],
  holders: { commandant: 'alice', marshal: 'bob' },
  teams: [
    {
      _id: 'row-a',
      teamId: 'defenders',
      managerSource: 'character',
      managerCharacterId: 'bob',
    },
    { _id: 'row-b', teamId: 'defenders' },
  ],
};
const facts: LegacyTeamFacts[] = [
  {
    legacyTeamId: 'row-a',
    name: 'First',
    status: 'disabled',
    rewardCapExempt: false,
    managerCharacterId: 'bob',
    notes: '',
  },
  {
    legacyTeamId: 'row-b',
    name: 'Second',
    status: 'missing',
    rewardCapExempt: true,
    managerCharacterId: null,
    notes: 'Campaign reward',
  },
];

test('[roster.mapping] preflight preserves singleton holders and repeatable team identities without inventing Hit Dice', () => {
  const original = structuredClone(legacy);
  const result = prepareLegacyRoster(legacy, facts);
  expect(result.ready).toBe(false);
  expect(result.issues).toEqual(['Resolve Commandant Hit Dice for alice.']);
  expect(result.roster?.people[0]?.hitDice).toBeNull();
  expect(result.roster?.officers).toEqual([
    { role: 'commandant', characterId: 'alice' },
    { role: 'marshal', characterId: 'bob' },
  ]);
  expect(
    result.roster?.teams.map((team) => [
      team.teamId,
      team.status,
      team.managerCharacterId,
    ]),
  ).toEqual([
    ['legacy-team:row-a', 'disabled', 'bob'],
    ['legacy-team:row-b', 'missing', null],
  ]);
  expect(prepareLegacyRoster(legacy, facts)).toEqual(result);
  expect(legacy).toEqual(original);
  expect(
    prepareLegacyRoster(
      { ...legacy, characters: [{ _id: 'alice', hitDice: 7 }, { _id: 'bob' }] },
      facts,
    ).ready,
  ).toBe(true);
});

test('[roster.preflight] absent team facts and unlinked freeform managers require resolution', () => {
  expect(prepareLegacyRoster(legacy, []).roster).toBeNull();
  const result = prepareLegacyRoster(
    {
      ...legacy,
      teams: [{ _id: 'row-b', teamId: 'defenders', managerSource: 'freeform' }],
    },
    [facts[1]!],
  );
  expect(result.ready).toBe(false);
  expect(result.issues).toContain(
    'Link the existing freeform manager for team row-b to a character record.',
  );
});
