import { expect, test } from 'vitest';
import { acceptedCampaignSetup } from '../../tests/rules/accepted-campaign';
import { createWeeklyDraft } from './weekly-draft';
import { stagedReferences } from './correction-staged-choices';
import {
  holdsIdentity,
  missingIdentities,
  noCapturedFacts,
  rememberFacts,
  restorableKinds,
  restoredRow,
} from './reference-restoration';

function openWeek() {
  const { state } = acceptedCampaignSetup('officer');
  const snapshot = structuredClone(state.militiaSnapshot);
  const patrol = snapshot.roster.teams[0]!;
  snapshot.roster.teams.push(
    { ...patrol, teamId: 'scouts', name: 'Scouts', status: 'active' },
    { ...patrol, teamId: 'guards', name: 'Guards', status: 'active' },
  );
  const draft = createWeeklyDraft({
    draftId: 'week',
    week: state.week,
    context: state.context,
    slotIds: ['one', 'two', 'three'],
  });
  draft.activity.slots[0]!.choice = {
    choiceId: 'drill',
    actionId: 'drill_militia',
    teamId: 'scouts',
  };
  draft.activity.slots[2]!.choice = {
    choiceId: 'gold',
    actionId: 'earn_gold',
    teamId: 'guards',
  };
  draft.upkeep.teamDecisions = [{ teamId: 'scouts', decision: 'leave' }];
  return { draft, snapshot };
}

const withoutTeams = (
  snapshot: ReturnType<typeof openWeek>['snapshot'],
  ...removed: string[]
) => ({
  ...snapshot,
  roster: {
    ...snapshot.roster,
    teams: snapshot.roster.teams.filter(
      (team) => !removed.includes(team.teamId),
    ),
  },
});

test('each missing team is listed once with every choice that uses it', () => {
  const { draft, snapshot } = openWeek();
  const removed = withoutTeams(snapshot, 'scouts', 'guards');
  const missing = missingIdentities(
    stagedReferences(draft, removed),
    noCapturedFacts,
  );
  expect(
    missing.map(({ kind, id, neededBy, captured }) => ({
      kind,
      id,
      neededBy: neededBy.map((reference) => reference.key),
      captured,
    })),
  ).toEqual([
    {
      kind: 'team',
      id: 'scouts',
      neededBy: ['upkeepTeam:scouts', 'activitySlot:one'],
      captured: null,
    },
    {
      kind: 'team',
      id: 'guards',
      neededBy: ['activitySlot:three'],
      captured: null,
    },
  ]);
});

test('facts this device saw accepted are reused; otherwise the restored row keeps only its identity', () => {
  const { draft, snapshot } = openWeek();
  const scouts = snapshot.roster.teams[1]!;
  const seen = rememberFacts(noCapturedFacts, snapshot);
  const removed = withoutTeams(snapshot, 'scouts', 'guards');
  // A later accepted militia without the teams does not forget them.
  const captured = rememberFacts(seen, removed);
  const [withFacts] = missingIdentities(
    stagedReferences(draft, removed),
    captured,
  );
  expect(restoredRow(withFacts!)).toEqual(scouts);

  // After a reload (nothing seen) the name, type and condition are entered
  // again; nothing is invented.
  const [blank] = missingIdentities(
    stagedReferences(draft, removed),
    rememberFacts(noCapturedFacts, removed),
  );
  expect(restoredRow(blank!)).toEqual({
    teamId: 'scouts',
    name: '',
    teamType: undefined,
    status: undefined,
    rewardCapExempt: false,
    managerCharacterId: null,
    notes: '',
  });
});

test('a missing settlement restores with its identity and unrecorded facts', () => {
  const { draft, snapshot } = openWeek();
  draft.activity.operatingSettlementId = 'town';
  // Orders carried into the week need Town, so a correction could not have
  // removed it; an older week's source is enough to show the restoration.
  draft.context = { ...draft.context, orders: [] };
  const removed = { ...snapshot, settlements: [] };
  const [town] = missingIdentities(
    stagedReferences(draft, removed),
    noCapturedFacts,
  );
  expect(town).toMatchObject({ kind: 'settlement', id: 'town' });
  expect(restoredRow(town!)).toEqual({
    settlementId: 'town',
    name: '',
    reputation: null,
    secured: null,
    occupied: null,
    temporaryReputationShift: null,
    refugeActivatedWeek: null,
    refugeActiveUntilWeek: null,
  });
});

test('restorable kinds belong to their section and a restored identity is recognised', () => {
  expect(restorableKinds('teams')).toEqual(['team']);
  expect(restorableKinds('settlements')).toEqual(['settlement']);
  expect(restorableKinds('values')).toEqual([]);
  const { snapshot } = openWeek();
  expect(holdsIdentity('team', snapshot.roster.teams, 'scouts')).toBe(true);
  expect(holdsIdentity('team', snapshot.roster.teams, 'lost')).toBe(false);
});
