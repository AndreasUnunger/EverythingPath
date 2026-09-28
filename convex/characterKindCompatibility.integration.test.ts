// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { afterEach, expect, expectTypeOf, test, vi } from 'vitest';
import type { Infer } from 'convex/values';
import { api } from './_generated/api';
import schema, { type characterKindValidator } from './schema';
import type { Id } from './_generated/dataModel';
import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';
import type {
  CharacterRecordKind,
  RosterKind,
} from '../src/lib/character-kind';
import { initializationEdits } from '../tests/rules/initialization-edits';
import { acceptedCampaignSetup } from '../tests/rules/accepted-campaign';
const modules = import.meta.glob('./**/*.ts');
afterEach(() => vi.useRealTimers());

const stats = {
  description: 'Keep notes',
  level: 4,
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 16,
};

async function fixture() {
  const t = convexTest(schema, modules);
  const member = t.withIdentity({ tokenIdentifier: 'test|player' });
  const seeded = await member.run((ctx) => seedAcceptedCampaign(ctx));
  const scope = {
    campaignId: seeded.key.campaignId,
    militiaId: seeded.key.militiaId,
  };
  const create = (name: string, kind: CharacterRecordKind) =>
    member.mutation(api.character.createCharacter, {
      organizationId: 'org',
      character: { campaignId: scope.campaignId, name, kind, ...stats },
    });
  // Records written before this release: a stored legacy kind, and no kind.
  const officer = await create('Ostler', 'npc');
  await t.run((ctx) =>
    ctx.db.patch('character', officer, { kind: 'officer_npc' }),
  );
  const npc = await create('Vessa', 'npc');
  const absent = await create('Rook', 'pc');
  await t.run((ctx) => ctx.db.patch('character', absent, { kind: undefined }));
  const storedKinds = () =>
    t.run(async (ctx) =>
      Promise.all(
        [officer, npc, absent].map(async (id) => {
          const record = await ctx.db.get('character', id);
          return record && 'kind' in record ? record.kind : 'absent';
        }),
      ),
    );
  const livePeople = async () =>
    (await member.query(api.canonicalLedger.read, scope)).state.militiaSnapshot
      .roster.people;
  return {
    t,
    member,
    scope,
    officer,
    npc,
    absent,
    storedKinds,
    livePeople,
    ...seeded,
  };
}

// A live source as it could be stored before this release: roster mirrors
// with both legacy labels, one disagreeing with its record, and null or zero
// Hit Dice. Written directly, as no current write path produces it.
async function seedLegacyRoster(
  { t, scope, officer, npc, absent }: Awaited<ReturnType<typeof fixture>>,
  kinds: { officer: RosterKind; npc: RosterKind; absent: RosterKind },
) {
  const people = [
    { characterId: officer, kind: kinds.officer, hitDice: null },
    { characterId: npc, kind: kinds.npc, hitDice: 0 },
    { characterId: absent, kind: kinds.absent, hitDice: 3 },
  ];
  await t.run(async (ctx) => {
    const state = (await ctx.db
      .query('canonicalMilitiaState')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', scope.militiaId))
      .unique())!;
    // Creating each record already added its facts to the source.
    const { roster } = state.snapshot;
    await ctx.db.patch('canonicalMilitiaState', state._id, {
      revision: state.revision + 1,
      snapshot: {
        ...state.snapshot,
        roster: {
          people: [...roster.people, ...people],
          officers: [
            ...roster.officers,
            { role: 'commandant', characterId: officer },
            { role: 'commandant', characterId: npc },
          ],
          // Rook holds no role: as an NPC, two teams exceed his limit of one.
          teams: [
            ...roster.teams.map((team) => ({
              ...team,
              managerCharacterId: absent,
            })),
            {
              teamId: 'guards',
              teamType: 'defenders',
              name: 'Guards',
              status: 'active',
              rewardCapExempt: false,
              managerCharacterId: absent,
              notes: '',
            },
          ],
        },
      },
    });
  });
  return people;
}

async function stageWeek({
  member,
  scope,
  key,
  characterId,
}: Awaited<ReturnType<typeof fixture>>) {
  for (const [baseRevision, edit] of initializationEdits(
    'patrol',
    characterId,
  ).entries())
    await member.mutation(api.canonicalDraftPersistence.edit, {
      ...scope,
      operation: {
        draftId: key.draftId,
        operationId: `edit-${baseRevision}`,
        baseRevision,
        edit,
      },
    });
}

// Kinds carried through a result, as PC or NPC.
const normalized = (value: unknown) =>
  JSON.parse(
    JSON.stringify(value).replaceAll(
      /"kind":"(officer_npc|other_npc)"/g,
      '"kind":"npc"',
    ),
  ) as unknown;

test('the Convex record validator and the shared stored kinds agree', () => {
  expectTypeOf<
    Infer<typeof characterKindValidator>
  >().toEqualTypeOf<CharacterRecordKind>();
});

test('record APIs store PC or NPC for legacy submissions and leave a stored kind alone on unrelated edits', async () => {
  const { t, member, scope, officer, npc, absent, storedKinds } =
    await fixture();
  // An old client still sends the legacy enum.
  const legacy = await member.mutation(api.character.createCharacter, {
    organizationId: 'org',
    character: {
      campaignId: scope.campaignId,
      name: 'Old form',
      kind: 'officer_npc',
      ...stats,
    },
  });
  expect((await t.run((ctx) => ctx.db.get('character', legacy)))?.kind).toBe(
    'npc',
  );
  expect(await storedKinds()).toEqual(['officer_npc', 'npc', 'absent']);
  const listed = await member.query(api.character.listByCampaign, {
    campaignId: scope.campaignId,
    organizationId: 'org',
    includeInactive: true,
  });
  // The read stays verbatim; migrating stored rows is a separate step.
  expect(listed.map((record) => [record.name, record.kind])).toEqual([
    ['Officer', undefined],
    ['Ostler', 'officer_npc'],
    ['Vessa', 'npc'],
    ['Rook', undefined],
    ['Old form', 'npc'],
  ]);
  for (const characterId of [officer, absent])
    await member.mutation(api.character.updateCharacter, {
      organizationId: 'org',
      characterId,
      patch: { charisma: 12 },
    });
  expect(await storedKinds()).toEqual(['officer_npc', 'npc', 'absent']);
  await member.mutation(api.character.updateCharacter, {
    organizationId: 'org',
    characterId: npc,
    patch: { name: 'Vessa Dray', kind: 'officer_npc' },
  });
  await member.mutation(api.character.updateCharacter, {
    organizationId: 'org',
    characterId: officer,
    patch: { kind: 'officer_npc' },
  });
  expect(await storedKinds()).toEqual(['npc', 'npc', 'absent']);
  for (const identity of ['outsider', undefined]) {
    const caller = identity ? t.withIdentity({ tokenIdentifier: identity }) : t;
    await expect(
      caller.mutation(api.character.updateCharacter, {
        organizationId: 'org',
        characterId: npc,
        patch: { kind: 'pc' },
      }),
    ).rejects.toThrow();
  }
  expect(await storedKinds()).toEqual(['npc', 'npc', 'absent']);
});

test('every character write moves its roster mirror with the record in the same source revision', async () => {
  const context = await fixture();
  const { member, scope, officer, npc, absent, livePeople } = context;
  const people = await seedLegacyRoster(context, {
    officer: 'officer_npc',
    npc: 'npc',
    absent: 'other_npc',
  });
  const revision = async () =>
    (await member.query(api.canonicalLedger.read, scope)).revision;
  const before = await revision();
  const tail = async () => (await livePeople()).slice(-3);
  expect(await tail()).toEqual(people);
  // An unrelated edit still refreshes the mirror from the record; an absent
  // record kind is the PC default, never inferred from Rook's teams.
  await member.mutation(api.character.updateCharacter, {
    organizationId: 'org',
    characterId: absent,
    patch: { charisma: 18 },
  });
  expect(await revision()).toBe(before + 1);
  expect(await tail()).toEqual([
    people[0],
    people[1],
    { characterId: absent, kind: 'pc', hitDice: 3 },
  ]);
  await member.mutation(api.character.updateCharacter, {
    organizationId: 'org',
    characterId: officer,
    patch: { kind: 'officer_npc' },
  });
  await member.mutation(api.character.updateCharacter, {
    organizationId: 'org',
    characterId: npc,
    patch: { kind: 'pc' },
  });
  expect(await revision()).toBe(before + 3);
  // Membership, order and Hit Dice overrides, including null and zero, stay.
  expect(await tail()).toEqual([
    { characterId: officer, kind: 'npc', hitDice: null },
    { characterId: npc, kind: 'pc', hitDice: 0 },
    { characterId: absent, kind: 'pc', hitDice: 3 },
  ]);
  // Archiving mirrors too, and keeps membership.
  await member.mutation(api.character.archiveCharacter, {
    organizationId: 'org',
    characterId: npc,
    isActive: false,
  });
  expect(await tail()).toEqual([
    { characterId: officer, kind: 'npc', hitDice: null },
    { characterId: npc, kind: 'pc', hitDice: 0 },
    { characterId: absent, kind: 'pc', hitDice: 3 },
  ]);
});

test('a correction cannot restore an old kind: the save mirrors current records, and a stale one is refused', async () => {
  const context = await fixture();
  const { member, scope, officer, npc, absent, livePeople } = context;
  await seedLegacyRoster(context, {
    officer: 'pc',
    npc: 'pc',
    absent: 'officer_npc',
  });
  const ledger = await member.query(api.canonicalLedger.read, scope);
  // Another player makes Vessa a PC before this correction is saved.
  await member.mutation(api.character.updateCharacter, {
    organizationId: 'org',
    characterId: npc,
    patch: { kind: 'pc' },
  });
  await expect(
    member.mutation(api.canonicalLedger.save, {
      ...scope,
      expectedRevision: ledger.revision,
      snapshot: ledger.state.militiaSnapshot,
      reason: 'Stale roster',
    }),
  ).rejects.toThrow('Militia changed');
  // An old client's payload against the latest revision, still carrying
  // legacy and mismatched kinds, stores only the records' kinds.
  const latest = await member.query(api.canonicalLedger.read, scope);
  const snapshot = {
    ...latest.state.militiaSnapshot,
    roster: {
      ...latest.state.militiaSnapshot.roster,
      people: latest.state.militiaSnapshot.roster.people.map((person) =>
        [officer, npc, absent].includes(person.characterId as Id<'character'>)
          ? { ...person, kind: 'other_npc' as const }
          : person,
      ),
    },
  };
  await member.mutation(api.canonicalLedger.save, {
    ...scope,
    expectedRevision: latest.revision,
    snapshot,
    reason: 'Old client correction',
  });
  expect((await livePeople()).slice(-3)).toEqual([
    { characterId: officer, kind: 'npc', hitDice: null },
    { characterId: npc, kind: 'pc', hitDice: 0 },
    { characterId: absent, kind: 'pc', hitDice: 3 },
  ]);
});

test('Setup stores each roster person with its current record kind and keeps same-source retries idempotent', async () => {
  const t = convexTest(schema, modules);
  const member = t.withIdentity({ tokenIdentifier: 'test|player' });
  const { campaignId, characterId } = await t.run(async (ctx) => {
    await ctx.db.insert('user', {
      tokenIdentifier: 'test|player',
      orgIds: [{ orgId: 'org', role: 'member' }],
    });
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Campaign',
      ownerId: 'gm',
      organizationId: 'org',
      description: '',
    });
    const characterId = await ctx.db.insert('character', {
      campaignId,
      name: 'Officer',
      ownerId: 'gm',
      kind: 'officer_npc',
      ...stats,
    });
    return { campaignId, characterId };
  });
  const options = await member.query(api.canonicalSetup.options, {
    campaignId,
  });
  const setup = acceptedCampaignSetup(characterId);
  setup.state.militiaSnapshot.characters = options!.characters.map(
    ({ name: _name, ...facts }) => facts,
  );
  // A resumed or old-client form that still says PC.
  setup.state.militiaSnapshot.roster.people.at(0)!.kind = 'pc';
  const start = () =>
    member.mutation(api.canonicalSetup.initialize, {
      campaignId,
      initializationId: 'attempt',
      setup,
    });
  const key = await start();
  const live = await member.query(api.canonicalLedger.read, {
    campaignId,
    militiaId: key.militiaId,
  });
  expect(live.state.militiaSnapshot.roster.people).toEqual([
    { ...setup.state.militiaSnapshot.roster.people[0], kind: 'npc' },
  ]);
  // The options result is unchanged: no kind field was added.
  expect(Object.keys(options!.characters.at(0)!).sort()).toEqual(
    [
      'characterId',
      'name',
      'level',
      'strength',
      'dexterity',
      'constitution',
      'intelligence',
      'wisdom',
      'charisma',
      'isActive',
    ].sort(),
  );
  expect(await start()).toEqual(key);
});

test('preview and Confirmation agree before and after normalization; history keeps the recorded kinds', async () => {
  vi.useFakeTimers();
  const context = await fixture();
  const { t, member, scope, key, officer, absent, livePeople } = context;
  // Records and mirrors agree on PC versus NPC, with both legacy labels.
  await t.run((ctx) => ctx.db.patch('character', absent, { kind: 'npc' }));
  const people = await seedLegacyRoster(context, {
    officer: 'officer_npc',
    npc: 'npc',
    absent: 'other_npc',
  });
  await stageWeek(context);
  const legacy = await member.query(api.canonicalDraftPersistence.preview, key);
  expect(legacy.status).toBe('ready');

  // Old clients' writes normalize the records and their mirrors.
  await member.mutation(api.character.updateCharacter, {
    organizationId: 'org',
    characterId: officer,
    patch: { kind: 'officer_npc' },
  });
  await member.mutation(api.character.updateCharacter, {
    organizationId: 'org',
    characterId: absent,
    patch: { charisma: stats.charisma },
  });
  expect((await livePeople()).slice(-3).map((p) => p.kind)).toEqual([
    'npc',
    'npc',
    'npc',
  ]);
  const current = await member.query(
    api.canonicalDraftPersistence.preview,
    key,
  );
  expect(current.status).toBe(legacy.status);
  expect(current.reviewed.rulesetVersion).toBe(legacy.reviewed.rulesetVersion);
  expect(current.warnings).toEqual(legacy.warnings);
  expect(current.requirements).toEqual(legacy.requirements);
  expect(current.outcome).toEqual(normalized(legacy.outcome));
  expect(current.reviewed.sourceKey).not.toBe(legacy.reviewed.sourceKey);

  // A review of the source before the kind change is stale.
  await expect(
    member.mutation(api.canonicalDraftPersistence.confirm, {
      ...key,
      operation: { operationId: 'stale', reviewed: legacy.reviewed },
    }),
  ).rejects.toThrow();
  await member.mutation(api.canonicalDraftPersistence.confirm, {
    ...key,
    operation: { operationId: 'confirm', reviewed: current.reviewed },
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const history = await member.query(api.canonicalHistory.read, {
    campaignId: scope.campaignId,
    week: 9,
  });
  expect(history?.record.rulesetVersion).toBe(current.reviewed.rulesetVersion);
  expect(history?.record.finalOutcome.data).toEqual(
    JSON.parse(JSON.stringify(current.outcome)),
  );
  expect(people.map((person) => person.kind)).toEqual([
    'officer_npc',
    'npc',
    'other_npc',
  ]);
});

test('Confirmation records and commits the kinds it resolved with; the next record write moves the mirror', async () => {
  vi.useFakeTimers();
  const context = await fixture();
  const { t, member, scope, key, livePeople } = context;
  const people = await seedLegacyRoster(context, {
    officer: 'officer_npc',
    npc: 'npc',
    absent: 'other_npc',
  });
  await stageWeek(context);
  const preview = await member.query(
    api.canonicalDraftPersistence.preview,
    key,
  );
  expect(preview.status).toBe('ready');
  await member.mutation(api.canonicalDraftPersistence.confirm, {
    ...key,
    operation: { operationId: 'confirm', reviewed: preview.reviewed },
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const history = await member.query(api.canonicalHistory.read, {
    campaignId: scope.campaignId,
    week: 9,
  });
  const recorded = (
    value: { roster: { people: unknown[] } } | null | undefined,
  ) => value?.roster.people.slice(-3);
  expect(recorded(history?.record.sourceMilitiaSnapshot)).toEqual(people);
  const outcome = history?.record.finalOutcome.data as {
    militiaSnapshot: { roster: { people: unknown[] } };
  };
  expect(recorded(outcome.militiaSnapshot)).toEqual(people);
  // Stored history is never rewritten.
  const stored = await t.run((ctx) =>
    ctx.db
      .query('canonicalResolutionRecord')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', scope.militiaId))
      .collect(),
  );
  expect(
    stored.map((row) => recorded(row.record.sourceMilitiaSnapshot)),
  ).toEqual([people]);
  // Confirmation commits exactly the outcome it resolved; stored legacy
  // mirrors wait for the next write of their record or the live migration.
  expect((await livePeople()).slice(-3)).toEqual(people);
  await member.mutation(api.character.updateCharacter, {
    organizationId: 'org',
    characterId: context.absent,
    patch: { level: 5 },
  });
  expect((await livePeople()).slice(-3)).toEqual([
    people[0],
    people[1],
    // Rook's record has no kind: the PC default wins over the old mirror.
    { ...people[2], kind: 'pc' },
  ]);
});
