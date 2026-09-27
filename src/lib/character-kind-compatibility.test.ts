import { expect, test } from 'vitest';
import {
  prepareCanonicalResolutionRecord,
  projectWeeklyDraft,
  resolveCanonicalWeeklyDraft,
} from './canonical-weekly-resolution';
import { canonicalResolutionRecordSchema } from './canonical-resolution-record';
import { rosterWarnings } from './canonical-roster';
import { projectTeams } from './rules-teams';
import { projectActivity } from './rules-activity';
import { upkeepFixture } from '../../tests/rules/upkeep-fixture';
import {
  militiaSnapshotSchema,
  weeklySourceKey,
} from './canonical-weekly-source';
import {
  militiaSetupSchema,
  newMilitiaSetup,
  prepareMilitiaSetup,
} from './canonical-setup';
import { mirrorRosterKinds, type RosterKind } from './character-kind';
import { persistentEventFixture } from '../../tests/rules/persistent-event-fixture';
import {
  mixedKindRecords,
  mixedKindSnapshot,
} from '../../tests/rules/character-kind-fixture';

// A ready week whose roster also carries every stored kind and Hit Dice form.
function mixedWeek(vessaKind: RosterKind = 'npc') {
  const { draft, snapshot } = persistentEventFixture('low_morale');
  snapshot.training = 15;
  const mixed = mixedKindSnapshot();
  snapshot.characters.push(...mixed.characters);
  snapshot.roster.people.push(
    ...mixed.roster.people.map((person) =>
      person.characterId === 'vessa' ? { ...person, kind: vessaKind } : person,
    ),
  );
  snapshot.roster.officers.push({ role: 'commandant', characterId: 'vessa' });
  // Two teams: within an officer NPC's Charisma limit, over an other NPC's 1.
  snapshot.roster.teams[0]!.managerCharacterId = 'vessa';
  snapshot.roster.teams[1]!.managerCharacterId = 'vessa';
  return { revision: draft, militiaSnapshot: snapshot };
}

test('stored snapshots with legacy, absent and new kinds parse verbatim and keep their source key', () => {
  const input = mixedKindSnapshot();
  const parsed = militiaSnapshotSchema.parse(input);
  expect(parsed).toEqual(input);
  expect(weeklySourceKey(parsed)).toBe(weeklySourceKey(input));
  expect(
    militiaSnapshotSchema.safeParse({
      ...input,
      roster: {
        ...input.roster,
        people: [{ characterId: 'aubrin', kind: 'officer', hitDice: 1 }],
      },
    }).success,
  ).toBe(false);
});

test('current rules treat the new npc kind exactly like the officer NPC it replaces', () => {
  const officer = resolveCanonicalWeeklyDraft(mixedWeek('officer_npc'));
  const npc = resolveCanonicalWeeklyDraft(mixedWeek('npc'));
  expect(npc.status).toBe('ready');
  expect(npc.rulesetVersion).toBe(officer.rulesetVersion);
  expect(npc.warnings).toEqual(officer.warnings);
  const asOfficer = (value: unknown) =>
    JSON.parse(
      JSON.stringify(value).replaceAll('"kind":"npc"', '"kind":"officer_npc"'),
    ) as unknown;
  expect(asOfficer(npc.finalPlan)).toEqual(officer.finalPlan);
  expect(npc.sourceKey).not.toBe(officer.sourceKey);
});

test('legacy manager limits are unchanged and npc keeps the officer-NPC limit', () => {
  const snapshot = militiaSnapshotSchema.parse(mixedKindSnapshot());
  const names = mixedKindRecords.map((record) => ({
    characterId: record.characterId,
    name: record.name,
    charisma: record.charisma,
    isActive: record.characterId !== 'rook',
  }));
  expect(rosterWarnings(snapshot.roster, names, 10)).toEqual([
    'Rook manages 2 teams; the normal limit is 1.',
    'Rook is archived but still assigned.',
  ]);
  const limits = new Map(
    projectTeams(snapshot.roster, snapshot.characters).teams.map((team) => [
      team.managerCharacterId,
      team.manager?.maxTeams,
    ]),
  );
  // Ostler (officer NPC) and Vessa (npc) use CHA; Rook (other NPC) is capped.
  expect(Object.fromEntries(limits)).toEqual({ ostler: 4, rook: 1, vessa: 3 });
});

test('Setup accepts mixed kinds and keeps PC-only rules on explicit PCs', () => {
  const setup = newMilitiaSetup('Loyalty');
  const snapshot = mixedKindSnapshot();
  snapshot.rank = 7;
  const parsed = militiaSetupSchema.parse({
    ...setup,
    mode: 'existing',
    state: {
      ...setup.state,
      context: { ...setup.state.context, firstMilitiaWeek: false },
      militiaSnapshot: snapshot,
    },
  });
  expect(parsed.state.militiaSnapshot.roster).toEqual(snapshot.roster);
  // Highest active PC level is Mara's 3 (Aubrin 2); NPC levels never count.
  expect(prepareMilitiaSetup(parsed, 'setup').warnings).toContain(
    'Rank exceeds the highest active PC level.',
  );
});

test('confirmed records keep recorded kinds and null or zero Hit Dice through history parsing', () => {
  const resolved = resolveCanonicalWeeklyDraft(mixedWeek());
  const record = prepareCanonicalResolutionRecord(resolved, 'record');
  const recorded = mixedWeek().militiaSnapshot.roster.people;
  expect(record.sourceMilitiaSnapshot?.roster.people).toEqual(recorded);
  const outcome = record.finalOutcome.data as {
    militiaSnapshot: { roster: { people: unknown } };
  };
  expect(outcome.militiaSnapshot.roster.people).toEqual(recorded);
  const stored = JSON.parse(JSON.stringify(record)) as unknown;
  const reread = canonicalResolutionRecordSchema.parse(stored);
  expect(reread).toEqual(record);
  expect(weeklySourceKey(reread)).toBe(weeklySourceKey(stored));
  expect(
    projectWeeklyDraft({
      revision: reread.source,
      militiaSnapshot: reread.sourceMilitiaSnapshot!,
    }).sourceKey,
  ).toBe(resolved.sourceKey);
});

test('Change Officer Role still needs the PC exception for every stored NPC kind', () => {
  for (const kind of ['pc', 'officer_npc', 'other_npc', 'npc'] as const) {
    const { draft, snapshot } = upkeepFixture();
    snapshot.roster.people[0]!.kind = kind;
    draft.activity.slots[0]!.choice = {
      choiceId: 'role',
      actionId: 'change_officer_role',
      characterId: 'pc',
      fromRole: 'ambassador',
    };
    expect(
      projectActivity(draft, snapshot).requirements.includes(
        'role:officer-pc:exception',
      ),
    ).toBe(kind !== 'pc');
  }
});

test('normalizing every legacy roster kind to PC or NPC changes no preview or Confirmation outcome', () => {
  const legacy = mixedWeek('officer_npc');
  const normalized = structuredClone(legacy);
  normalized.militiaSnapshot.roster = mirrorRosterKinds(
    normalized.militiaSnapshot.roster,
    [],
  );
  expect(
    new Set(normalized.militiaSnapshot.roster.people.map((p) => p.kind)),
  ).toEqual(new Set(['pc', 'npc']));
  const before = resolveCanonicalWeeklyDraft(legacy);
  const after = resolveCanonicalWeeklyDraft(normalized);
  expect(before.status).toBe('ready');
  expect(after.status).toBe(before.status);
  expect(after.rulesetVersion).toBe(before.rulesetVersion);
  expect(after.requirements).toEqual(before.requirements);
  expect(after.warnings).toEqual(before.warnings);
  // Only the kinds a plan carries through differ; every roll, check and
  // resulting value is the same.
  const asNormalized = (value: unknown) =>
    JSON.parse(
      JSON.stringify(value).replaceAll(
        /"kind":"(officer_npc|other_npc)"/g,
        '"kind":"npc"',
      ),
    ) as unknown;
  expect(asNormalized(before.finalPlan)).toEqual(after.finalPlan);
  expect(asNormalized(before.outcome)).toEqual(after.outcome);
  const beforeRecord = prepareCanonicalResolutionRecord(before, 'record');
  const afterRecord = prepareCanonicalResolutionRecord(after, 'record');
  expect(afterRecord.rulesetVersion).toBe(beforeRecord.rulesetVersion);
  expect(afterRecord.warnings).toEqual(beforeRecord.warnings);
  expect(asNormalized(beforeRecord.finalOutcome)).toEqual(
    afterRecord.finalOutcome,
  );
});
