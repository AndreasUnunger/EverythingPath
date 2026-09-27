// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { afterEach, expect, expectTypeOf, test, vi } from 'vitest';
import type { Infer } from 'convex/values';
import { api } from './_generated/api';
import schema, { type characterKindValidator } from './schema';
import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';
import type { CharacterRecordKind } from '../src/lib/character-kind';
import { initializationEdits } from '../tests/rules/initialization-edits';
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
  const officer = await create('Ostler', 'officer_npc');
  const npc = await create('Vessa', 'npc');
  // A legacy record written before kinds existed: no stored kind at all.
  const absent = await create('Rook', 'pc');
  await t.run((ctx) => ctx.db.patch('character', absent, { kind: undefined }));
  return { t, member, scope, officer, npc, absent, ...seeded };
}

test('the Convex record validator and the shared stored kinds agree', () => {
  expectTypeOf<
    Infer<typeof characterKindValidator>
  >().toEqualTypeOf<CharacterRecordKind>();
});

test('record APIs accept legacy, absent and new kinds and store them verbatim', async () => {
  const { t, member, officer, npc, absent } = await fixture();
  const kinds = async () =>
    t.run(async (ctx) =>
      Promise.all(
        [officer, npc, absent].map(async (id) => {
          const record = await ctx.db.get('character', id);
          return record && 'kind' in record ? record.kind : 'absent';
        }),
      ),
    );
  expect(await kinds()).toEqual(['officer_npc', 'npc', 'absent']);
  const listed = await member.query(api.character.listByCampaign, {
    campaignId: (await t.run((ctx) => ctx.db.get('character', npc)))!
      .campaignId,
    organizationId: 'org',
    includeInactive: true,
  });
  expect(listed.map((record) => [record.name, record.kind])).toEqual([
    ['Officer', undefined],
    ['Ostler', 'officer_npc'],
    ['Vessa', 'npc'],
    ['Rook', undefined],
  ]);
  // Old clients keep sending the legacy enum; unrelated edits keep the kind.
  await member.mutation(api.character.updateCharacter, {
    organizationId: 'org',
    characterId: npc,
    patch: { name: 'Vessa Dray', kind: 'officer_npc' },
  });
  await member.mutation(api.character.updateCharacter, {
    organizationId: 'org',
    characterId: npc,
    patch: { kind: 'npc' },
  });
  await member.mutation(api.character.updateCharacter, {
    organizationId: 'org',
    characterId: absent,
    patch: { charisma: 12 },
  });
  expect(await kinds()).toEqual(['officer_npc', 'npc', 'absent']);
  await expect(
    t
      .withIdentity({ tokenIdentifier: 'outsider' })
      .mutation(api.character.updateCharacter, {
        organizationId: 'org',
        characterId: npc,
        patch: { kind: 'pc' },
      }),
  ).rejects.toThrow();
  expect(await kinds()).toEqual(['officer_npc', 'npc', 'absent']);
});

test('mixed roster kinds and null or zero Hit Dice survive corrections, record edits, Confirmation and history', async () => {
  vi.useFakeTimers();
  const { t, member, scope, key, officer, npc, absent, characterId } =
    await fixture();
  const ledger = await member.query(api.canonicalLedger.read, scope);
  const people = [
    ...ledger.state.militiaSnapshot.roster.people,
    { characterId: officer, kind: 'officer_npc' as const, hitDice: null },
    { characterId: npc, kind: 'npc' as const, hitDice: 0 },
    // Mismatched legacy mirror: the record has no kind, the roster says NPC.
    { characterId: absent, kind: 'other_npc' as const, hitDice: 3 },
  ];
  const snapshot = {
    ...ledger.state.militiaSnapshot,
    roster: {
      ...ledger.state.militiaSnapshot.roster,
      people,
      officers: [
        ...ledger.state.militiaSnapshot.roster.officers,
        { role: 'commandant' as const, characterId: npc },
      ],
    },
  };
  await member.mutation(api.canonicalLedger.save, {
    ...scope,
    expectedRevision: ledger.revision,
    snapshot,
    reason: 'Record the officers present',
  });
  const livePeople = async () =>
    (await member.query(api.canonicalLedger.read, scope)).state.militiaSnapshot
      .roster.people;
  expect(await livePeople()).toEqual(people);
  // The current mirror writer is unchanged in this expansion: a record kind is
  // copied as stored, and an absent record kind leaves the mirror alone.
  for (const characterId of [npc, absent, officer])
    await member.mutation(api.character.updateCharacter, {
      organizationId: 'org',
      characterId,
      patch: { charisma: 18 },
    });
  expect(await livePeople()).toEqual(people);

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
  expect(history?.record.sourceMilitiaSnapshot?.roster.people).toEqual(people);
  const outcome = history?.record.finalOutcome.data as {
    militiaSnapshot: { roster: { people: unknown } };
  };
  expect(outcome.militiaSnapshot.roster.people).toEqual(people);
  expect(await livePeople()).toEqual(people);
  const stored = await t.run((ctx) =>
    ctx.db
      .query('canonicalResolutionRecord')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', scope.militiaId))
      .collect(),
  );
  expect(
    stored.map((row) => row.record.sourceMilitiaSnapshot?.roster.people),
  ).toEqual([people]);
});
