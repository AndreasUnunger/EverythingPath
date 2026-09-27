// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';
import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';
import {
  closedCorrection,
  correctionReducer,
  correctionView,
  planSectionSave,
  type AcceptedMilitia,
} from '../src/components/militia-corrections/correction-lifecycle';
import {
  sectionValue,
  type MilitiaSectionKey,
  type SectionValue,
} from '../src/lib/militia-correction-sections';
const modules = import.meta.glob('./**/*.ts');

async function fixture() {
  const t = convexTest(schema, modules);
  const player = t.withIdentity({ tokenIdentifier: 'test|player' });
  const gm = t.withIdentity({ tokenIdentifier: 'test|gm' });
  const seeded = await player.run((ctx) => seedAcceptedCampaign(ctx));
  const scope = {
    campaignId: seeded.key.campaignId,
    militiaId: seeded.key.militiaId,
  };
  return { t, player, gm, scope, ...seeded };
}

type Client = Awaited<ReturnType<typeof fixture>>['player'];
type Scope = Awaited<ReturnType<typeof fixture>>['scope'];

// One device's section correction, driven through the client lifecycle
// against the real ledger query and mutation.
async function openCorrection(
  client: Client,
  scope: Scope,
  draftId: string,
  section: MilitiaSectionKey,
) {
  const read = async (): Promise<AcceptedMilitia> => ({
    ...(await client.query(api.canonicalLedger.read, scope)),
    draftId,
  });
  const opened = await read();
  const correction = correctionReducer(closedCorrection, {
    type: 'open',
    target: { kind: 'section', section },
    accepted: opened,
  });
  return { opened, correction, read };
}

async function saveSection<K extends MilitiaSectionKey>(
  client: Client,
  scope: Scope,
  state: Awaited<ReturnType<typeof openCorrection>>,
  accepted: AcceptedMilitia,
  section: K,
  yours: SectionValue<K>,
  reason: string,
) {
  const plan = planSectionSave(state.correction, accepted, section, yours);
  if (plan.kind !== 'send') return plan;
  await client.mutation(api.canonicalLedger.save, {
    ...scope,
    expectedRevision: plan.attempt.expectedRevision,
    snapshot: plan.snapshot,
    reason,
  });
  return plan;
}

test('two players correcting different sections keep both corrections through a revision race', async () => {
  const { t, player, gm, scope, key, characterId } = await fixture();
  const values = await openCorrection(player, scope, key.draftId, 'values');
  const teams = await openCorrection(gm, scope, key.draftId, 'teams');

  const valuesYours = {
    ...sectionValue('values', values.opened.state.militiaSnapshot),
    treasuryCopper: 50000,
  };
  await saveSection(
    player,
    scope,
    values,
    values.opened,
    'values',
    valuesYours,
    'Found a purse',
  );

  // The GM's device has not observed that save yet: its Save goes out
  // against the revision it knows, and the server refuses it.
  const teamsYours = sectionValue(
    'teams',
    teams.opened.state.militiaSnapshot,
  ).map((team) => ({ ...team, status: 'active' as const, notes: 'Returned' }));
  await expect(
    saveSection(
      gm,
      scope,
      teams,
      teams.opened,
      'teams',
      teamsYours,
      'Patrol came back',
    ),
  ).rejects.toThrow('Militia changed');

  // Refreshed: Teams was not changed elsewhere, so the same correction is
  // merged onto the newest militia and saved against its revision.
  const refreshed = await teams.read();
  const rejected = correctionReducer(
    correctionReducer(teams.correction, {
      type: 'submit',
      attempt: { expectedRevision: teams.opened.revision, candidate: 'x' },
    }),
    {
      type: 'rejected',
      attempt: { expectedRevision: teams.opened.revision, candidate: 'x' },
      message: 'Militia changed',
    },
  );
  expect(correctionView(rejected, refreshed)).toMatchObject({
    kind: 'editing',
    notice: 'retry',
  });
  const plan = await saveSection(
    gm,
    scope,
    { ...teams, correction: rejected },
    refreshed,
    'teams',
    teamsYours,
    'Patrol came back',
  );
  expect(plan.kind).toBe('send');

  const final = await player.query(api.canonicalLedger.read, scope);
  expect(final.revision).toBe(values.opened.revision + 2);
  expect(final.state.militiaSnapshot.treasuryCopper).toBe(50000);
  expect(final.state.militiaSnapshot.roster.teams[0]).toMatchObject({
    status: 'active',
    notes: 'Returned',
    managerCharacterId: characterId,
  });
  expect(final.state.militiaSnapshot.roster.officers).toEqual(
    values.opened.state.militiaSnapshot.roster.officers,
  );
  expect(final.state.militiaSnapshot.economy).toEqual(
    values.opened.state.militiaSnapshot.economy,
  );
  expect(final.state.context).toEqual(values.opened.state.context);
  const reasons = await t.run((ctx) =>
    ctx.db
      .query('canonicalSourceCorrection')
      .collect()
      .then((rows) => rows.map((row) => row.reason)),
  );
  expect(reasons).toEqual(['Found a purse', 'Patrol came back']);
});

test('a same-section change elsewhere is a conflict and a character edit is never overwritten', async () => {
  const { player, gm, scope, key, characterId } = await fixture();
  const mine = await openCorrection(player, scope, key.draftId, 'values');
  const theirs = await openCorrection(gm, scope, key.draftId, 'values');
  await saveSection(
    gm,
    scope,
    theirs,
    theirs.opened,
    'values',
    {
      ...sectionValue('values', theirs.opened.state.militiaSnapshot),
      notoriety: 30,
    },
    'Recount notoriety',
  );
  await player.mutation(api.character.updateCharacter, {
    organizationId: 'org',
    characterId,
    patch: { charisma: 20 },
  });
  const latest = await mine.read();
  const yours = {
    ...sectionValue('values', mine.opened.state.militiaSnapshot),
    treasuryCopper: 50000,
  };
  expect(planSectionSave(mine.correction, latest, 'values', yours)).toEqual({
    kind: 'conflict',
  });

  // Starting again from their values keeps both their notoriety and the
  // character edit made meanwhile.
  const restarted = correctionReducer(mine.correction, {
    type: 'restart',
    accepted: latest,
  });
  const plan = await saveSection(
    player,
    scope,
    { ...mine, correction: restarted },
    latest,
    'values',
    {
      ...sectionValue('values', latest.state.militiaSnapshot),
      treasuryCopper: 50000,
    },
    'Found a purse',
  );
  expect(plan.kind).toBe('send');
  const final = await player.query(api.canonicalLedger.read, scope);
  expect(final.state.militiaSnapshot).toMatchObject({
    notoriety: 30,
    treasuryCopper: 50000,
  });
  expect(final.state.militiaSnapshot.characters[0]?.charisma).toBe(20);
});

test('a corrected section is still refused when it removes what carried effects need, and outsiders cannot correct', async () => {
  const { t, player, scope, key } = await fixture();
  const teams = await openCorrection(player, scope, key.draftId, 'teams');
  await expect(
    saveSection(
      player,
      scope,
      teams,
      teams.opened,
      'teams',
      [],
      'Remove the patrol',
    ),
  ).rejects.toThrow('Keep entities referenced by carried events');
  const outsider = t.withIdentity({ tokenIdentifier: 'outsider' });
  const values = await openCorrection(player, scope, key.draftId, 'values');
  await expect(
    saveSection(
      outsider,
      scope,
      values,
      values.opened,
      'values',
      {
        ...sectionValue('values', values.opened.state.militiaSnapshot),
        rank: 9,
      },
      'Not a member',
    ),
  ).rejects.toThrow();
  expect((await player.query(api.canonicalLedger.read, scope)).revision).toBe(
    values.opened.revision,
  );
});
