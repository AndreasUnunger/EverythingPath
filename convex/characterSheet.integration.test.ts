// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { afterEach, expect, test, vi } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';
import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';
import { initializeCharacterSheet } from './lib/characterSheet';
import { initializationEdits } from '../tests/rules/initialization-edits';
afterEach(() => vi.useRealTimers());
const modules = import.meta.glob('./**/*.ts');

async function fixture() {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    for (const [person, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const) {
      await ctx.db.insert('user', {
        tokenIdentifier: `test|${person}`,
        orgIds: [{ orgId, role: 'member' }],
      });
    }
    return ctx.db.insert('campaign', {
      name: 'Sheet fixture',
      description: '',
      organizationId: 'org',
      ownerId: 'test|owner',
      e2eFixture: {
        namespace: 'sheet',
        version: 1,
        workerKey: '0',
        caseKey: 'sheet',
        campaignKey: 'sheet',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'test|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'test|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'test|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Vessa',
    kind: 'pc',
    operationId: 'create',
  });
  const scope = { organizationId: 'org', characterId };
  return { t, owner, member, outsider, campaignId, characterId, scope };
}

test('campaign members read a new Character with permanent base scores and one empty Unspecified Class Level', async () => {
  const { member, scope, characterId } = await fixture();
  const sheet = await member.query(api.characterSheet.read, scope);
  expect(sheet).toMatchObject({
    character: {
      _id: characterId,
      name: 'Vessa',
      ownerId: 'test|owner',
      sheetMode: 'full',
    },
    calculated: {
      level: 1,
      hitDice: 1,
      hp: null,
      abilities: { strength: { score: 10, modifier: 0 } },
    },
    revision: 1,
    lastOperationId: 'create',
    updatedBy: 'test|owner',
  });
  expect(sheet?.entries).toHaveLength(2);
  expect(sheet?.entries.find((row) => row.kind === 'base')).toMatchObject({
    active: true,
    state: {
      kind: 'base',
    },
  });
  expect(sheet?.entries.find((row) => row.kind === 'classLevel')).toMatchObject(
    {
      state: {
        kind: 'classLevel',
        classEntryId: null,
        position: 1,
        hpGained: null,
      },
    },
  );
});

test('saving unchanged base scores preserves the sheet revision and last editor', async () => {
  const { owner, member, scope } = await fixture();
  const before = await owner.query(api.characterSheet.read, scope);
  for (const scores of [{}, { strength: 10, constitution: 10 }]) {
    await member.mutation(api.characterSheet.editBaseScores, {
      ...scope,
      scores,
      operationId: 'unchanged',
    });
    expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
  }
});

test.each([null, 0, 8])(
  'saving unchanged Class Level HP (%s) preserves the sheet revision and last editor',
  async (hpGained) => {
    const { owner, member, scope } = await fixture();
    const initial = await owner.query(api.characterSheet.read, scope);
    const row = initial?.entries.find((entry) => entry.kind === 'classLevel');
    if (!row) throw new Error('Missing level');
    if (hpGained !== null)
      await owner.mutation(api.characterSheet.editClassLevel, {
        ...scope,
        entryId: row._id,
        hpGained,
        operationId: 'record-hp',
      });
    const before = await owner.query(api.characterSheet.read, scope);
    await member.mutation(api.characterSheet.editClassLevel, {
      ...scope,
      entryId: row._id,
      hpGained,
      operationId: 'unchanged',
    });
    expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
  },
);

test('sheet reads reject a malformed route Character identifier', async () => {
  const { owner } = await fixture();
  await expect(
    owner.query(api.characterSheet.read, {
      organizationId: 'org',
      characterId: 'not-a-character-id',
    }),
  ).rejects.toThrow('Character not found');
});

test('members edit independent scores and Class Levels, carry HP through moves, and may remove every level', async () => {
  const { owner, member, scope } = await fixture();
  const initial = await owner.query(api.characterSheet.read, scope);
  const first = initial?.entries.find((entry) => entry.kind === 'classLevel');
  expect(first).toBeDefined();
  if (!first) throw new Error('Missing first level');
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { constitution: 14 },
    operationId: 'con',
  });
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 19 },
    operationId: 'str',
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    hpGained: 8,
    operationId: 'hp1',
  });
  const second = await member.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    operationId: 'add',
  });
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: second,
    hpGained: 5,
    operationId: 'hp2',
  });
  await owner.mutation(api.characterSheet.moveClassLevel, {
    ...scope,
    entryId: second,
    position: 1,
    operationId: 'move',
  });
  const moved = await member.query(api.characterSheet.read, scope);
  expect(
    moved?.entries
      .filter((entry) => entry.kind === 'classLevel')
      .map((entry) => [entry._id, entry.state.position, entry.state.hpGained]),
  ).toEqual([
    [second, 1, 5],
    [first._id, 2, 8],
  ]);
  expect(moved).toMatchObject({
    calculated: {
      level: 2,
      hp: 17,
      abilities: { strength: { score: 19 }, constitution: { score: 14 } },
    },
    revision: 7,
    lastOperationId: 'move',
  });
  for (const entryId of [second, first._id])
    await member.mutation(api.characterSheet.deleteClassLevel, {
      ...scope,
      entryId,
      operationId: `delete-${entryId}`,
    });
  const zero = await owner.query(api.characterSheet.read, scope);
  expect(zero?.entries).toHaveLength(1);
  expect(zero?.calculated).toMatchObject({ level: 0, hitDice: 0, hp: 0 });
  expect(zero?.entries[0]?._id).toBe(initial?.entries[0]?._id);
});

test('outsiders, signed-out callers and legacy substring identities cannot read or write sheets', async () => {
  const { t, owner, outsider, scope, campaignId } = await fixture();
  await t.run((ctx) =>
    ctx.db.insert('user', { tokenIdentifier: 'test|org-fallback', orgIds: [] }),
  );
  const fallback = t.withIdentity({ tokenIdentifier: 'test|org-fallback' });
  const before = await owner.query(api.characterSheet.read, scope);
  const row = before?.entries.find((entry) => entry.kind === 'classLevel');
  if (!row) throw new Error('Missing level');
  for (const caller of [t, outsider, fallback]) {
    await expect(
      caller.query(api.characterSheet.read, scope),
    ).rejects.toThrow();
    await expect(
      caller.mutation(api.characterSheet.create, {
        organizationId: 'org',
        campaignId,
        name: 'Denied',
        kind: 'pc',
        operationId: 'attack',
      }),
    ).rejects.toThrow();
    await expect(
      caller.mutation(api.characterSheet.editBaseScores, {
        ...scope,
        scores: { strength: 99 },
        operationId: 'attack',
      }),
    ).rejects.toThrow();
    await expect(
      caller.mutation(api.characterSheet.addClassLevel, {
        ...scope,
        operationId: 'attack',
      }),
    ).rejects.toThrow();
    await expect(
      caller.mutation(api.characterSheet.editClassLevel, {
        ...scope,
        entryId: row._id,
        hpGained: 99,
        operationId: 'attack',
      }),
    ).rejects.toThrow();
    await expect(
      caller.mutation(api.characterSheet.moveClassLevel, {
        ...scope,
        entryId: row._id,
        position: 1,
        operationId: 'attack',
      }),
    ).rejects.toThrow();
    await expect(
      caller.mutation(api.characterSheet.deleteClassLevel, {
        ...scope,
        entryId: row._id,
        operationId: 'attack',
      }),
    ).rejects.toThrow();
  }
  await expect(
    outsider.query(api.characterSheet.read, {
      ...scope,
      organizationId: 'other',
    }),
  ).rejects.toThrow('No campaign exists');
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
});

test('Class Level commands reject a base entry and another Character’s row without changing either sheet', async () => {
  const { owner, member, scope, campaignId } = await fixture();
  const otherId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Other',
    kind: 'npc',
    operationId: 'other',
  });
  const otherScope = { ...scope, characterId: otherId };
  const before = await owner.query(api.characterSheet.read, scope);
  const other = await owner.query(api.characterSheet.read, otherScope);
  const base = before?.entries.find((entry) => entry.kind === 'base');
  const foreign = other?.entries.find((entry) => entry.kind === 'classLevel');
  if (!base || !foreign) throw new Error('Missing rows');
  for (const entryId of [base._id, foreign._id]) {
    await expect(
      member.mutation(api.characterSheet.editClassLevel, {
        ...scope,
        entryId,
        hpGained: 12,
        operationId: 'attack',
      }),
    ).rejects.toThrow('Class Level does not belong');
    await expect(
      member.mutation(api.characterSheet.moveClassLevel, {
        ...scope,
        entryId,
        position: 1,
        operationId: 'attack',
      }),
    ).rejects.toThrow('Class Level does not belong');
    await expect(
      member.mutation(api.characterSheet.deleteClassLevel, {
        ...scope,
        entryId,
        operationId: 'attack',
      }),
    ).rejects.toThrow('Class Level does not belong');
  }
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
  expect(await owner.query(api.characterSheet.read, otherScope)).toEqual(other);
});

test('a forged Catalog Entry reference from another Character in an accessible campaign is rejected on reads and writes', async () => {
  const { t, owner, scope } = await fixture();
  const otherCampaignId = await owner.mutation(api.campaign.createCampaign, {
    organizationId: 'org',
    name: 'Other',
    description: '',
  });
  await t.run(async (ctx) => {
    const character = await ctx.db.get('character', scope.characterId);
    if (!character?.campaignId) throw new Error('Missing campaign Character');
    const first = await ctx.db.get('campaign', character.campaignId);
    await ctx.db.patch('campaign', otherCampaignId, {
      e2eFixture: first?.e2eFixture,
    });
  });
  const otherId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId: otherCampaignId,
    name: 'Other',
    kind: 'npc',
    operationId: 'other',
  });
  const before = await owner.query(api.characterSheet.read, scope);
  const otherScope = { ...scope, characterId: otherId };
  const other = await owner.query(api.characterSheet.read, otherScope);
  const base = before?.entries.find((entry) => entry.kind === 'base');
  const otherBase = other?.entries.find((entry) => entry.kind === 'base');
  if (!base || !otherBase) throw new Error('Missing base');
  await t.run((ctx) =>
    ctx.db.patch('characterSheetEntry', base._id, {
      catalogEntryId: otherBase.catalogEntryId,
    }),
  );
  await expect(owner.query(api.characterSheet.read, scope)).rejects.toThrow(
    'Base scores do not belong',
  );
  await expect(
    owner.mutation(api.characterSheet.editBaseScores, {
      ...scope,
      scores: { strength: 99 },
      operationId: 'attack',
    }),
  ).rejects.toThrow('Base scores do not belong');
  await expect(
    owner.mutation(api.characterSheet.addClassLevel, {
      ...scope,
      operationId: 'attack',
    }),
  ).rejects.toThrow('Base scores do not belong');
  expect(await owner.query(api.characterSheet.read, otherScope)).toEqual(other);
});

test('prepared writes stay gated on ordinary campaigns and respect the campaign maintenance pause', async () => {
  const { t, owner, scope, campaignId } = await fixture();
  const before = await owner.query(api.characterSheet.read, scope);
  const row = before?.entries.find((entry) => entry.kind === 'classLevel');
  if (!row) throw new Error('Missing row');
  const commands = [
    () =>
      owner.mutation(api.characterSheet.create, {
        organizationId: 'org',
        campaignId,
        name: 'Denied',
        kind: 'pc',
        operationId: 'blocked',
      }),
    () =>
      owner.mutation(api.characterSheet.editBaseScores, {
        ...scope,
        scores: { strength: 15 },
        operationId: 'blocked',
      }),
    () =>
      owner.mutation(api.characterSheet.addClassLevel, {
        ...scope,
        operationId: 'blocked',
      }),
    () =>
      owner.mutation(api.characterSheet.editClassLevel, {
        ...scope,
        entryId: row._id,
        hpGained: 8,
        operationId: 'blocked',
      }),
    () =>
      owner.mutation(api.characterSheet.moveClassLevel, {
        ...scope,
        entryId: row._id,
        position: 1,
        operationId: 'blocked',
      }),
    () =>
      owner.mutation(api.characterSheet.deleteClassLevel, {
        ...scope,
        entryId: row._id,
        operationId: 'blocked',
      }),
  ];
  await t.run((ctx) =>
    ctx.db.patch('campaign', campaignId, { e2eFixture: undefined }),
  );
  for (const command of commands)
    await expect(command()).rejects.toThrow(
      "Character sheets aren't available for this campaign yet.",
    );
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
  await t.run((ctx) =>
    ctx.db.insert('campaignCutover', {
      key: 'weekly-draft',
      status: 'paused',
      operationId: 'pause',
      oldRelease: 'old',
      newRelease: 'new',
      campaignIds: [],
      pausedAt: 0,
    }),
  );
  for (const command of commands)
    await expect(command()).rejects.toThrow('paused for maintenance');
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
});

test('HP can be cleared, out-of-rules finite scores persist, and malformed numbers or positions are rejected', async () => {
  const { owner, scope } = await fixture();
  const sheet = await owner.query(api.characterSheet.read, scope);
  const row = sheet?.entries.find((entry) => entry.kind === 'classLevel');
  if (!row) throw new Error('Missing row');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: row._id,
    hpGained: 0,
    operationId: 'zero',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.calculated.hp,
  ).toBe(0);
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: row._id,
    hpGained: null,
    operationId: 'clear',
  });
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: -4, wisdom: 99.5 },
    operationId: 'override',
  });
  const before = await owner.query(api.characterSheet.read, scope);
  expect(before?.calculated).toMatchObject({
    hp: null,
    abilities: { strength: { score: -4 }, wisdom: { score: 99.5 } },
  });
  for (const value of [NaN, Infinity, -Infinity]) {
    await expect(
      owner.mutation(api.characterSheet.editBaseScores, {
        ...scope,
        scores: { strength: value },
        operationId: 'invalid',
      }),
    ).rejects.toThrow('finite');
    await expect(
      owner.mutation(api.characterSheet.editClassLevel, {
        ...scope,
        entryId: row._id,
        hpGained: value,
        operationId: 'invalid',
      }),
    ).rejects.toThrow('finite');
  }
  for (const position of [0, 2, 0.5, NaN])
    await expect(
      owner.mutation(api.characterSheet.moveClassLevel, {
        ...scope,
        entryId: row._id,
        position,
        operationId: 'invalid',
      }),
    ).rejects.toThrow('valid Class Level position');
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
});

test('a prepared sheet leaves legacy Character facts, current militia and frozen history authoritative', async () => {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ tokenIdentifier: 'test|gm' });
  const member = t.withIdentity({ tokenIdentifier: 'test|player' });
  const seeded = await owner.run((ctx) => seedAcceptedCampaign(ctx));
  const scope = { organizationId: 'org', characterId: seeded.characterId };
  expect(await owner.query(api.characterSheet.read, scope)).toBeNull();
  const { campaignId, militiaId } = seeded.key;
  for (const [baseRevision, edit] of initializationEdits(
    'patrol',
    seeded.characterId,
  ).entries()) {
    await member.mutation(api.canonicalDraftPersistence.edit, {
      campaignId,
      militiaId,
      operation: {
        draftId: seeded.key.draftId,
        operationId: `edit-${baseRevision}`,
        baseRevision,
        edit,
      },
    });
  }
  const preview = await member.query(
    api.canonicalDraftPersistence.preview,
    seeded.key,
  );
  expect(preview.status).toBe('ready');
  await member.mutation(api.canonicalDraftPersistence.confirm, {
    ...seeded.key,
    operation: { operationId: 'confirm', reviewed: preview.reviewed },
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const historyArgs = { campaignId, week: 9 };
  const history = await member.query(api.canonicalHistory.read, historyArgs);
  expect(history).not.toBeNull();
  const ledger = await member.query(api.canonicalLedger.read, {
    campaignId,
    militiaId,
  });
  const characters = await member.query(api.character.listByCampaign, {
    campaignId,
    organizationId: 'org',
  });
  await t.run(async (ctx) => {
    await ctx.db.patch('campaign', campaignId, {
      e2eFixture: {
        namespace: 'sheet',
        version: 1,
        workerKey: '0',
        caseKey: 'legacy',
        campaignKey: 'legacy',
      },
    });
    await initializeCharacterSheet(ctx, {
      characterId: seeded.characterId,
      operationId: 'prepare',
      updatedBy: 'test|gm',
    });
  });
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 30, charisma: 35 },
    operationId: 'sheet-only',
  });
  const sheet = await owner.query(api.characterSheet.read, scope);
  const level = sheet?.entries.find((entry) => entry.kind === 'classLevel');
  if (!level) throw new Error('Missing level');
  await member.mutation(api.characterSheet.deleteClassLevel, {
    ...scope,
    entryId: level._id,
    operationId: 'zero',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.calculated,
  ).toMatchObject({
    level: 0,
    abilities: { strength: { score: 30 }, charisma: { score: 35 } },
  });
  const after = await member.query(api.character.listByCampaign, {
    campaignId,
    organizationId: 'org',
  });
  expect(after).toMatchObject(characters);
  expect(
    await member.query(api.canonicalLedger.read, { campaignId, militiaId }),
  ).toEqual(ledger);
  expect(await owner.query(api.canonicalHistory.read, historyArgs)).toEqual(
    history,
  );
  const beforeArchive = await owner.query(api.characterSheet.read, scope);
  await member.mutation(api.characterSheet.archive, {
    ...scope,
    isActive: false,
    operationId: 'archive',
  });
  const archived = await owner.query(api.characterSheet.read, scope);
  expect(archived?.character.isActive).toBe(false);
  expect(archived?.calculated).toMatchObject({
    level: 0,
    abilities: { strength: { score: 30 }, charisma: { score: 35 } },
  });
  const archivedLedger = await member.query(api.canonicalLedger.read, {
    campaignId,
    militiaId,
  });
  expect(archivedLedger.state.militiaSnapshot.roster).toEqual(
    ledger.state.militiaSnapshot.roster,
  );
  expect(archived?.entries).toEqual(beforeArchive?.entries);
  expect(archived?.catalogEntries).toEqual(beforeArchive?.catalogEntries);
  expect(archivedLedger.state.militiaSnapshot.characters).toEqual(
    ledger.state.militiaSnapshot.characters.map((character) =>
      character.characterId === seeded.characterId
        ? { ...character, isActive: false }
        : character,
    ),
  );
  await owner.mutation(api.characterSheet.archive, {
    ...scope,
    isActive: true,
    operationId: 'restore',
  });
  const restored = await member.query(api.canonicalLedger.read, {
    campaignId,
    militiaId,
  });
  expect(restored.state.militiaSnapshot).toEqual(ledger.state.militiaSnapshot);

  expect(await owner.query(api.canonicalHistory.read, historyArgs)).toEqual(
    history,
  );
});

test('creation settings default on new sheets and members save configurable budgets and trait choices', async () => {
  const { owner, member, scope } = await fixture();
  const initial = await owner.query(api.characterSheet.read, scope);
  expect(
    initial?.entries.find((entry) => entry.kind === 'base')?.state,
  ).toMatchObject({
    abilityMethod: { kind: 'pointBuy', budget: 15 },
    traitCount: 2,
    campaignTraitRequired: false,
  });
  await member.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    operationId: 'settings',
    settings: {
      abilityMethod: { kind: 'pointBuy', budget: 22 },
      traitCount: 3,
      campaignTraitRequired: true,
    },
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.calculated
      .creationSettings,
  ).toEqual({
    abilityMethod: { kind: 'pointBuy', budget: 22 },
    traitCount: 3,
    campaignTraitRequired: true,
  });
  await owner.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    operationId: 'rolled',
    settings: { abilityMethod: { kind: 'rolled' } },
  });
  const saved = await member.query(api.characterSheet.read, scope);
  expect(saved?.calculated.creationSettings).toEqual({
    abilityMethod: { kind: 'rolled' },
    traitCount: 3,
    campaignTraitRequired: true,
  });
  expect(saved?.calculated.pointBuy).toBeNull();
  await owner.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    operationId: 'unchanged',
    settings: { abilityMethod: { kind: 'rolled' } },
  });
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(saved);
});

test('members accept and reopen an intended rules warning without changing calculation or missing decisions', async () => {
  const { owner, member, scope } = await fixture();
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    operationId: 'over-budget',
    scores: { strength: 18 },
  });
  const before = await owner.query(api.characterSheet.read, scope);
  const warning = before?.calculated.warnings.find(
    (item) => item.check === 'pointBuy',
  );
  if (!warning) throw new Error('Missing point-buy warning');
  const key = {
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
  };
  await member.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    ...key,
    operationId: 'accept',
  });
  const accepted = await owner.query(api.characterSheet.read, scope);
  expect(accepted?.calculated).toEqual(before?.calculated);
  expect(accepted?.calculated.hp).toBeNull();
  expect(accepted?.acceptedWarnings).toEqual([
    expect.objectContaining({
      ...key,
      characterId: scope.characterId,
      acceptedBy: 'test|member',
      acceptedAt: expect.any(Number),
    }),
  ]);
  await owner.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    ...key,
    operationId: 'duplicate',
  });
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(accepted);
  await owner.mutation(api.characterSheet.reopenWarning, {
    ...scope,
    operationId: 'reopen',
    check: key.check,
    subject: key.subject,
  });
  const reopened = await member.query(api.characterSheet.read, scope);
  expect(reopened?.acceptedWarnings).toEqual([]);
  expect(reopened?.calculated).toEqual(before?.calculated);
});

test('related facts reopen acceptance permanently while unrelated edits preserve it and stale accept commands fail', async () => {
  const { owner, member, scope } = await fixture();
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    operationId: 'scores',
    scores: { strength: 18, dexterity: 17 },
  });
  const first = await owner.query(api.characterSheet.read, scope);
  const warning = first?.calculated.warnings.find(
    (item) => item.check === 'pointBuy',
  );
  const level = first?.entries.find((item) => item.kind === 'classLevel');
  if (!warning || !level) throw new Error('Missing warning or level');
  const key = {
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
  };
  await member.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    ...key,
    operationId: 'accept',
  });
  const acceptance = (await owner.query(api.characterSheet.read, scope))
    ?.acceptedWarnings;
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    hpGained: 8,
    operationId: 'hp',
  });
  await owner.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    settings: { traitCount: 3 },
    operationId: 'traits',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.acceptedWarnings,
  ).toEqual(acceptance);
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    operationId: 'same-cost',
    scores: { strength: 17, dexterity: 18 },
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.acceptedWarnings,
  ).toEqual([]);
  await expect(
    member.mutation(api.characterSheet.acceptWarning, {
      ...scope,
      ...key,
      operationId: 'stale',
    }),
  ).rejects.toThrow('current rules warning');
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    operationId: 'back',
    scores: { strength: 18, dexterity: 17 },
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.acceptedWarnings,
  ).toEqual([]);
  await member.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    ...key,
    operationId: 'accept-again',
  });
  await owner.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    operationId: 'budget',
    settings: { abilityMethod: { kind: 'pointBuy', budget: 20 } },
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.acceptedWarnings,
  ).toEqual([]);
});

test('deleting a warning’s Class Level deletes its acceptance without touching another accepted warning', async () => {
  const { owner, scope } = await fixture();
  const first = await owner.query(api.characterSheet.read, scope);
  const level = first?.entries.find((item) => item.kind === 'classLevel');
  if (!level) throw new Error('Missing level');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    hpGained: 0,
    operationId: 'hp',
  });
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 18 },
    operationId: 'scores',
  });
  const before = await owner.query(api.characterSheet.read, scope);
  for (const warning of before?.calculated.warnings.filter(
    (item) => item.kind === 'rules',
  ) ?? [])
    await owner.mutation(api.characterSheet.acceptWarning, {
      ...scope,
      operationId: warning.check,
      check: warning.check,
      subject: warning.subject,
      fingerprint: warning.fingerprint,
    });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.acceptedWarnings,
  ).toHaveLength(2);
  await owner.mutation(api.characterSheet.deleteClassLevel, {
    ...scope,
    entryId: level._id,
    operationId: 'delete',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.acceptedWarnings,
  ).toEqual([expect.objectContaining({ check: 'pointBuy' })]);
});

test('acceptance refuses missing inputs, unresolved calculations, stale facts and another Character’s subjects', async () => {
  const { owner, scope, campaignId } = await fixture();
  const initial = await owner.query(api.characterSheet.read, scope);
  for (const warning of initial?.calculated.warnings ?? [])
    await expect(
      owner.mutation(api.characterSheet.acceptWarning, {
        ...scope,
        operationId: 'missing',
        check: warning.check,
        subject: warning.subject,
        fingerprint: warning.fingerprint,
      }),
    ).rejects.toThrow('current rules warning');
  const otherId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Other',
    kind: 'pc',
    operationId: 'other',
  });
  const otherScope = { ...scope, characterId: otherId };
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...otherScope,
    scores: { strength: 18 },
    operationId: 'other-scores',
  });
  const other = await owner.query(api.characterSheet.read, otherScope);
  const warning = other?.calculated.warnings.find(
    (item) => item.check === 'pointBuy',
  );
  if (!warning) throw new Error('Missing warning');
  await expect(
    owner.mutation(api.characterSheet.acceptWarning, {
      ...scope,
      operationId: 'foreign',
      check: warning.check,
      subject: warning.subject,
      fingerprint: warning.fingerprint,
    }),
  ).rejects.toThrow('current rules warning');
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(initial);
  expect(await owner.query(api.characterSheet.read, otherScope)).toEqual(other);
});

test('settings and warning commands require membership and honor fixture, maintenance and Write Gate controls', async () => {
  const { t, owner, outsider, scope, campaignId } = await fixture();
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 18 },
    operationId: 'scores',
  });
  const sheet = await owner.query(api.characterSheet.read, scope);
  const warning = sheet?.calculated.warnings.find(
    (item) => item.check === 'pointBuy',
  );
  if (!warning) throw new Error('Missing warning');
  const key = {
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
  };
  function commands(caller: typeof owner) {
    return [
      () =>
        caller.mutation(api.characterSheet.editCreationSettings, {
          ...scope,
          operationId: 'settings',
          settings: { traitCount: 3 },
        }),
      () =>
        caller.mutation(api.characterSheet.acceptWarning, {
          ...scope,
          ...key,
          operationId: 'accept',
        }),
      () =>
        caller.mutation(api.characterSheet.reopenWarning, {
          ...scope,
          check: key.check,
          subject: key.subject,
          operationId: 'reopen',
        }),
    ];
  }
  for (const caller of [t, outsider])
    for (const command of commands(caller))
      await expect(command()).rejects.toThrow();
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(sheet);
  const controlId = await t.run(async (ctx) => {
    const runId = await ctx.db.insert('initialMigrationRun', {
      operationId: 'migration',
      epoch: 1,
      state: 'maintenance',
      frontendBuild: 'build',
      catalogManifest: 'catalog',
      startedAt: 0,
      deadline: 60000,
    });
    return ctx.db.insert('initialMigrationControl', {
      key: 'character-sheet',
      epoch: 1,
      closed: true,
      authority: 'legacy',
      runId,
    });
  });
  for (const command of commands(owner))
    await expect(command()).rejects.toThrow('MAINTENANCE');
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(sheet);
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, { closed: false }),
  );
  for (const command of commands(owner))
    await expect(command()).rejects.toThrow('RELOAD_REQUIRED');
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(sheet);
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, {
      epoch: 0,
      authority: 'sheet',
    }),
  );
  for (const command of commands(owner))
    await expect(command()).rejects.toThrow('RELOAD_REQUIRED');
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(sheet);
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, { authority: 'legacy' }),
  );
  await t.run((ctx) =>
    ctx.db.patch('campaign', campaignId, { e2eFixture: undefined }),
  );
  for (const command of commands(owner))
    await expect(command()).rejects.toThrow(
      "Character sheets aren't available for this campaign yet.",
    );
  await t.run((ctx) =>
    ctx.db.insert('campaignCutover', {
      key: 'weekly-draft',
      status: 'paused',
      operationId: 'pause',
      oldRelease: 'old',
      newRelease: 'new',
      campaignIds: [],
      pausedAt: 0,
    }),
  );
  for (const command of commands(owner))
    await expect(command()).rejects.toThrow('paused for maintenance');
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(sheet);
});

test('creation settings block non-finite values but preserve unusual whole-number choices, with rolled fallback for older sheets', async () => {
  const { t, owner, scope } = await fixture();
  for (const value of [NaN, Infinity, -Infinity]) {
    await expect(
      owner.mutation(api.characterSheet.editCreationSettings, {
        ...scope,
        operationId: 'invalid',
        settings: { abilityMethod: { kind: 'pointBuy', budget: value } },
      }),
    ).rejects.toThrow('finite');
    await expect(
      owner.mutation(api.characterSheet.editCreationSettings, {
        ...scope,
        operationId: 'invalid',
        settings: { traitCount: value },
      }),
    ).rejects.toThrow('finite');
  }
  await owner.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    operationId: 'unusual',
    settings: {
      abilityMethod: { kind: 'pointBuy', budget: 40 },
      traitCount: 0,
    },
  });
  const saved = await owner.query(api.characterSheet.read, scope);
  expect(saved?.calculated.creationSettings).toMatchObject({
    abilityMethod: { kind: 'pointBuy', budget: 40 },
    traitCount: 0,
  });
  await owner.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    operationId: 'same',
    settings: {
      abilityMethod: { kind: 'pointBuy', budget: 40 },
      traitCount: 0,
    },
  });
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(saved);
  const base = saved?.entries.find((entry) => entry.kind === 'base');
  if (!base) throw new Error('Missing base');
  await t.run((ctx) =>
    ctx.db.patch('characterSheetEntry', base._id, { state: { kind: 'base' } }),
  );
  expect(
    (await owner.query(api.characterSheet.read, scope))?.calculated
      .creationSettings,
  ).toEqual({
    abilityMethod: { kind: 'rolled' },
    traitCount: 2,
    campaignTraitRequired: false,
  });
});

test.each([-1, 2.5])(
  'creation settings reject negative or fractional counts and budgets (%s) without changing the sheet',
  async (value) => {
    const { owner, scope } = await fixture();
    const before = await owner.query(api.characterSheet.read, scope);
    for (const kind of ['pointBuy', 'rolled'] as const)
      await expect(
        owner.mutation(api.characterSheet.editCreationSettings, {
          ...scope,
          operationId: 'invalid-budget',
          settings: { abilityMethod: { kind, budget: value } },
        }),
      ).rejects.toThrow('Point-buy budget must be a whole number of 0 or more');
    await expect(
      owner.mutation(api.characterSheet.editCreationSettings, {
        ...scope,
        operationId: 'invalid-count',
        settings: { traitCount: value },
      }),
    ).rejects.toThrow('Trait count must be a whole number of 0 or more');
    expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
    await owner.mutation(api.characterSheet.editCreationSettings, {
      ...scope,
      operationId: 'zero',
      settings: {
        abilityMethod: { kind: 'pointBuy', budget: 0 },
        traitCount: 0,
      },
    });
    expect(
      (await owner.query(api.characterSheet.read, scope))?.calculated
        .creationSettings,
    ).toEqual({
      abilityMethod: { kind: 'pointBuy', budget: 0 },
      traitCount: 0,
      campaignTraitRequired: false,
    });
  },
);

test('changing a prepared Character’s kind reopens level-zero acceptance without resurrecting it on return', async () => {
  const { owner, scope } = await fixture();
  const initial = await owner.query(api.characterSheet.read, scope);
  const level = initial?.entries.find((item) => item.kind === 'classLevel');
  if (!level) throw new Error('Missing level');
  await owner.mutation(api.characterSheet.deleteClassLevel, {
    ...scope,
    entryId: level._id,
    operationId: 'zero',
  });
  const zero = await owner.query(api.characterSheet.read, scope);
  const warning = zero?.calculated.warnings.find(
    (item) => item.check === 'levelZero',
  );
  if (!warning) throw new Error('Missing warning');
  await owner.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
    operationId: 'accept',
  });
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 18 },
    operationId: 'scores',
  });
  const overBudget = await owner.query(api.characterSheet.read, scope);
  const pointBuy = overBudget?.calculated.warnings.find(
    (item) => item.check === 'pointBuy',
  );
  if (!pointBuy) throw new Error('Missing point-buy warning');
  await owner.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    operationId: 'point-buy',
    check: pointBuy.check,
    subject: pointBuy.subject,
    fingerprint: pointBuy.fingerprint,
  });
  const accepted = await owner.query(api.characterSheet.read, scope);
  const pointBuyAcceptance = accepted?.acceptedWarnings.filter(
    (item) => item.check === 'pointBuy',
  );
  await owner.mutation(api.character.updateCharacter, {
    ...scope,
    patch: { kind: 'pc' },
  });
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(accepted);
  await owner.mutation(api.character.updateCharacter, {
    ...scope,
    patch: { name: 'New name', description: 'Notes' },
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.acceptedWarnings,
  ).toEqual(accepted?.acceptedWarnings);
  await owner.mutation(api.character.updateCharacter, {
    ...scope,
    patch: { kind: 'npc' },
    operationId: 'caller-kind-operation',
  });
  const npc = await owner.query(api.characterSheet.read, scope);
  expect(npc?.lastOperationId).toBe('caller-kind-operation');
  expect(npc?.acceptedWarnings).toEqual(pointBuyAcceptance);
  expect(npc?.revision).toBe((accepted?.revision ?? 0) + 1);
  await owner.mutation(api.character.updateCharacter, {
    ...scope,
    patch: { kind: 'pc' },
  });
  const restored = await owner.query(api.characterSheet.read, scope);
  expect(restored?.acceptedWarnings).toEqual(pointBuyAcceptance);
  expect(restored?.calculated.warnings).toContainEqual(warning);
});

test('rolled settings retain a saved point-buy budget across queries and reject nonfinite retained budgets', async () => {
  const { owner, member, scope } = await fixture();
  await owner.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    operationId: 'rolled-with-budget',
    settings: { abilityMethod: { kind: 'rolled', budget: 27 } },
  });
  const rolled = await member.query(api.characterSheet.read, scope);
  expect(rolled?.calculated.creationSettings.abilityMethod).toEqual({
    kind: 'rolled',
    budget: 27,
  });
  expect(rolled?.calculated.pointBuy).toBeNull();
  await member.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    operationId: 'point-buy-again',
    settings: {
      abilityMethod: {
        kind: 'pointBuy',
        budget: rolled!.calculated.creationSettings.abilityMethod.budget!,
      },
    },
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.calculated
      .creationSettings.abilityMethod,
  ).toEqual({ kind: 'pointBuy', budget: 27 });
  for (const budget of [NaN, Infinity, -Infinity]) {
    await expect(
      owner.mutation(api.characterSheet.editCreationSettings, {
        ...scope,
        operationId: 'invalid-budget',
        settings: { abilityMethod: { kind: 'rolled', budget } },
      }),
    ).rejects.toThrow('finite');
  }
});
