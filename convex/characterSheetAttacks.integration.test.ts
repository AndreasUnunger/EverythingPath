// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';
import { maxCharacterChildRows } from './lib/preparedCharacterSheet';

const modules = import.meta.glob('./**/*.ts');

async function fixture(privateCharacter = false) {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    for (const [person, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: person,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    return ctx.db.insert('campaign', {
      name: 'Attack fixture',
      description: '',
      organizationId: 'org',
      ownerId: 'owner',
      e2eFixture: {
        namespace: 'attacks',
        version: 1,
        workerKey: '0',
        caseKey: 'attacks',
        campaignKey: 'attacks',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'owner' });
  const member = t.withIdentity({ tokenIdentifier: 'member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'outsider' });
  const campaignScope = privateCharacter
    ? {}
    : { organizationId: 'org', campaignId };
  const characterId = await owner.mutation(api.characterSheet.create, {
    ...campaignScope,
    name: 'Vessa',
    kind: 'pc',
    operationId: 'create',
  });
  const scope = { ...campaignScope, characterId };
  const weapon = await owner.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    operationId: 'weapon',
    name: 'Longsword',
    modifiers: [],
    detail: {
      kind: 'item',
      consumable: false,
      weapon: { baseType: 'longsword', proficiency: 'martial' },
    },
  });
  return { t, owner, member, outsider, scope, weapon };
}

test('adding a weapon creates a named shared routine without adding one for armor or shields', async () => {
  const { owner, member, scope, weapon } = await fixture();
  await owner.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    operationId: 'shield',
    name: 'Heavy shield',
    modifiers: [],
    detail: {
      kind: 'item',
      consumable: false,
      armor: { slot: 'shield', armorCheckPenalty: 2 },
      weapon: { baseType: 'heavy shield', proficiency: 'martial' },
    },
  });
  const sheet = await member.query(api.characterSheet.read, scope);
  expect(
    sheet?.entries.filter((row) => row.kind === 'attackRoutine'),
  ).toMatchObject([
    {
      active: true,
      state: {
        kind: 'attackRoutine',
        name: 'Longsword',
        weaponEntryId: weapon,
        hands: 'one',
        mode: 'melee',
        revision: 0,
      },
    },
  ]);
});

test('representative Base Items can be selected and create routines with natural hands and computed lines', async () => {
  // CRB Tables 6–4 and 8–1: greatsword 2d6, 19–20/×2; Str 18 is +4,
  // two hands gives +6 damage. Without martial proficiency attack takes −4.
  const { owner, member, scope } = await fixture();
  const initial = await owner.query(api.characterSheet.read, scope);
  const greatsword = initial?.catalogEntries.find(
    (row) => row.ruleIdentity === 'greatsword',
  );
  expect(greatsword).toBeDefined();
  if (!greatsword) throw new Error('Missing representative greatsword');
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 18 },
    operationId: 'strength',
  });
  const weapon = await member.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: greatsword._id,
    operationId: 'greatsword',
  });
  const sheet = await owner.query(api.characterSheet.read, scope);
  const routine = sheet?.calculated.attackRoutines.find(
    (row) => row.weaponEntryId === weapon,
  );
  expect(routine).toMatchObject({
    hands: 'two',
    mode: 'melee',
    single: [
      {
        damageDice: '2d6',
        attackBonus: { total: 0 },
        damageBonus: { total: 6 },
        criticalThreat: { total: 19 },
        criticalMultiplier: { total: 2 },
      },
    ],
  });
});

test.each(['global', 'campaign'] as const)(
  'Attack Routines load their referenced %s weapon without unrelated shared definitions',
  async (weaponScope) => {
    const { t, owner, member, scope } = await fixture();
    const { weaponId, unrelatedId } = await t.run(async (ctx) => {
      const definition = {
        name: 'Shared spear',
        ruleIdentity: 'shared-spear',
        sources: [],
        modifiers: [],
        stacksWithItself: false,
        detail: {
          kind: 'item' as const,
          consumable: false,
          weapon: {
            baseType: 'spear',
            proficiency: 'simple' as const,
            handedness: 'twoHanded' as const,
            attackType: 'melee' as const,
            dice: '1d8',
            damageTypes: ['piercing'],
            threat: 20,
            mult: 3,
            strengthDamage: 'melee' as const,
          },
        },
        ...(weaponScope === 'global'
          ? { scope: 'global' as const }
          : { scope: 'campaign' as const, campaignId: scope.campaignId }),
      };
      const weaponId = await ctx.db.insert('catalogEntry', definition);
      const unrelatedId = await ctx.db.insert('catalogEntry', {
        ...definition,
        name: 'Unselected weapon',
        ruleIdentity: 'unselected-weapon',
      });
      return { weaponId, unrelatedId };
    });
    const weaponEntryId = await owner.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: weaponId,
      operationId: 'select-shared-weapon',
    });
    const sheet = await member.query(api.characterSheet.read, scope);
    expect(sheet?.catalogEntries.map((row) => row._id)).toContain(weaponId);
    expect(sheet?.catalogEntries.map((row) => row._id)).not.toContain(
      unrelatedId,
    );
    expect(sheet?.calculated.attackRoutines).toContainEqual(
      expect.objectContaining({
        weaponEntryId,
        hands: 'two',
        single: [expect.objectContaining({ damageDice: '1d8' })],
      }),
    );
  },
);

test('Customize and Detach keep an Attack Routine attached to its Gear row and use the copied weapon statistics', async () => {
  const { t, owner, member, scope } = await fixture();
  const catalog = await owner.query(api.characterSheet.read, scope);
  const longsword = catalog?.catalogEntries.find(
    (row) =>
      row.ruleIdentity === 'longsword' &&
      row.detail.kind === 'item' &&
      row.detail.weapon?.dice,
  );
  if (!longsword) throw new Error('Missing representative longsword');
  const weapon = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: longsword._id,
    operationId: 'select-longsword',
  });
  const initial = await owner.query(api.characterSheet.read, scope);
  const item = initial?.entries.find((row) => row._id === weapon);
  const routine = initial?.calculated.attackRoutines.find(
    (row) => row.weaponEntryId === weapon,
  );
  if (item?.kind !== 'item' || !routine)
    throw new Error('Missing weapon routine');
  expect(routine.single).toMatchObject([
    { weaponName: 'Longsword', damageDice: '1d8' },
  ]);
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', item.catalogEntryId, {
      scope: 'global',
      characterId: undefined,
    }),
  );
  const campaignCopyId = await member.mutation(
    api.catalogCopies.customizeForCampaign,
    {
      ...scope,
      catalogEntryId: item.catalogEntryId,
      operationId: 'customize-weapon',
    },
  );
  await member.mutation(api.catalogCopies.editDefinition, {
    ...scope,
    catalogEntryId: campaignCopyId,
    name: 'Campaign longsword',
    operationId: 'rename-campaign-weapon',
  });
  const customized = await owner.query(api.characterSheet.read, scope);
  expect(customized?.entries.find((row) => row._id === weapon)).toMatchObject({
    catalogEntryId: campaignCopyId,
  });
  expect(
    customized?.calculated.attackRoutines.find(
      (row) => row.entryId === routine.entryId,
    ),
  ).toMatchObject({
    weaponEntryId: weapon,
    single: [{ weaponName: 'Campaign longsword', damageDice: '1d8' }],
  });
  const privateCopyId = await owner.mutation(api.catalogCopies.detach, {
    ...scope,
    target: { kind: 'entry', entryId: weapon },
    operationId: 'detach-weapon',
  });
  const detached = await member.query(api.characterSheet.read, scope);
  const definition = detached?.catalogEntries.find(
    (row) => row._id === privateCopyId,
  );
  if (definition?.detail.kind !== 'item' || !definition.detail.weapon)
    throw new Error('Missing detached weapon');
  await member.mutation(api.catalogCopies.editDefinition, {
    ...scope,
    catalogEntryId: privateCopyId,
    name: 'Private longsword',
    detail: {
      ...definition.detail,
      weapon: { ...definition.detail.weapon, dice: '2d8' },
    },
    operationId: 'edit-detached-weapon',
  });
  const saved = await owner.query(api.characterSheet.read, scope);
  expect(saved?.entries.find((row) => row._id === weapon)).toMatchObject({
    catalogEntryId: privateCopyId,
  });
  expect(
    saved?.calculated.attackRoutines.find(
      (row) => row.entryId === routine.entryId,
    ),
  ).toMatchObject({
    weaponEntryId: weapon,
    single: [{ weaponName: 'Private longsword', damageDice: '2d8' }],
    full: [{ weaponName: 'Private longsword', damageDice: '2d8' }],
    warnings: [],
  });
});

test('all routine writers enforce membership, private ownership and legacy write authority', async () => {
  for (const privateCharacter of [false, true]) {
    const { t, owner, member, outsider, scope, weapon } =
      await fixture(privateCharacter);
    const initial = await owner.query(api.characterSheet.read, scope);
    const routine = initial?.entries.find(
      (row) => row.kind === 'attackRoutine',
    );
    if (!routine) throw new Error('Missing routine');
    const commands = (caller: typeof owner, writeEpoch?: number) => [
      () =>
        caller.mutation(api.characterSheet.createAttackRoutine, {
          ...scope,
          weaponEntryId: weapon,
          writeEpoch,
          operationId: 'create',
        }),
      () =>
        caller.mutation(api.characterSheet.editAttackRoutine, {
          ...scope,
          entryId: routine._id,
          name: 'Edited',
          writeEpoch,
          operationId: 'edit',
        }),
      () =>
        caller.mutation(api.characterSheet.deleteAttackRoutine, {
          ...scope,
          entryId: routine._id,
          writeEpoch,
          operationId: 'delete',
        }),
      () =>
        caller.mutation(api.characterSheet.restoreAttackRoutine, {
          ...scope,
          entryId: routine._id,
          writeEpoch,
          operationId: 'undo',
        }),
    ];
    for (const caller of privateCharacter
      ? [t, outsider, member]
      : [t, outsider]) {
      for (const command of commands(caller))
        await expect(command()).rejects.toThrow();
      await expect(
        caller.query(api.characterSheet.read, scope),
      ).rejects.toThrow();
    }
    const control = await t.run(async (ctx) => {
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
    for (const command of commands(owner, 1))
      await expect(command()).rejects.toThrow('MAINTENANCE');
    await t.run((ctx) =>
      ctx.db.patch('initialMigrationControl', control, { closed: false }),
    );
    for (const command of commands(owner, 0))
      await expect(command()).rejects.toThrow('RELOAD_REQUIRED');
    await t.run((ctx) =>
      ctx.db.patch('initialMigrationControl', control, { authority: 'sheet' }),
    );
    for (const command of commands(owner, 1))
      await expect(command()).rejects.toThrow('RELOAD_REQUIRED');
    expect(await owner.query(api.characterSheet.read, scope)).toEqual(initial);
  }
});

test('routine writes reject foreign rows and structurally invalid inputs without changing shared state', async () => {
  const { owner, scope, weapon } = await fixture();
  const initial = await owner.query(api.characterSheet.read, scope);
  const routine = initial?.entries.find((row) => row.kind === 'attackRoutine');
  if (!routine) throw new Error('Missing routine');
  const otherId = await owner.mutation(api.characterSheet.create, {
    organizationId: scope.organizationId,
    campaignId: scope.campaignId,
    name: 'Other',
    kind: 'pc',
    operationId: 'other',
  });
  const otherScope = { ...scope, characterId: otherId };
  for (const command of [
    () =>
      owner.mutation(api.characterSheet.createAttackRoutine, {
        ...otherScope,
        weaponEntryId: weapon,
        operationId: 'foreign-weapon',
      }),
    () =>
      owner.mutation(api.characterSheet.editAttackRoutine, {
        ...otherScope,
        entryId: routine._id,
        name: 'Foreign',
        operationId: 'foreign-routine',
      }),
    () =>
      owner.mutation(api.characterSheet.deleteAttackRoutine, {
        ...otherScope,
        entryId: routine._id,
        operationId: 'foreign-delete',
      }),
    () =>
      owner.mutation(api.characterSheet.restoreAttackRoutine, {
        ...otherScope,
        entryId: routine._id,
        operationId: 'foreign-restore',
      }),
    () =>
      owner.mutation(api.characterSheet.createAttackRoutine, {
        ...scope,
        weaponEntryId: weapon,
        name: ' ',
        operationId: 'empty',
      }),
  ])
    await expect(command()).rejects.toThrow();
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(initial);
});

test('a routine pointing at a non-item keeps the sheet readable and can be repaired', async () => {
  const { t, owner, member, scope, weapon } = await fixture();
  const initial = await owner.query(api.characterSheet.read, scope);
  const routine = initial?.entries.find((row) => row.kind === 'attackRoutine');
  const base = initial?.entries.find((row) => row.kind === 'base');
  if (routine?.kind !== 'attackRoutine' || !base)
    throw new Error('Missing sheet entries');
  await t.run((ctx) =>
    ctx.db.patch('characterSheetEntry', routine._id, {
      state: { ...routine.state, weaponEntryId: base._id },
    }),
  );
  const damaged = await member.query(api.characterSheet.read, scope);
  expect(damaged?.calculated.attackRoutines).toMatchObject([
    {
      entryId: routine._id,
      single: [],
      full: [],
      warnings: [{ check: 'invalidAttackWeapon', subject: routine._id }],
    },
  ]);
  await owner.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: routine._id,
    name: 'Repaired strike',
    weaponEntryId: weapon,
    operationId: 'repair',
  });
  expect(
    (await member.query(api.characterSheet.read, scope))?.calculated
      .attackRoutines,
  ).toMatchObject([{ entryId: routine._id, name: 'Repaired strike' }]);
});

test('replacing a routine weapon applies its natural hands and mode while retaining explicit choices', async () => {
  const { owner, scope, weapon } = await fixture();
  const initial = await owner.query(api.characterSheet.read, scope);
  const routine = initial?.entries.find((row) => row.kind === 'attackRoutine');
  const longbow = initial?.catalogEntries.find(
    (row) => row.ruleIdentity === 'longbow',
  );
  if (!routine || !longbow) throw new Error('Missing routine or weapon');
  const bow = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: longbow._id,
    operationId: 'bow',
  });
  await owner.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: routine._id,
    weaponEntryId: bow,
    operationId: 'replace',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.entries.find(
      (row) => row._id === routine._id,
    ),
  ).toMatchObject({
    state: { weaponEntryId: bow, hands: 'two', mode: 'ranged' },
  });
  await owner.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: routine._id,
    weaponEntryId: weapon,
    hands: 'two',
    mode: 'thrown',
    operationId: 'replace-with-choices',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.entries.find(
      (row) => row._id === routine._id,
    ),
  ).toMatchObject({
    state: { weaponEntryId: weapon, hands: 'two', mode: 'thrown' },
  });
});

test('members create, rename, change hands and undo routine deletion without losing its identity', async () => {
  const { owner, member, scope, weapon } = await fixture();
  const entryId = await member.mutation(
    api.characterSheet.createAttackRoutine,
    {
      ...scope,
      weaponEntryId: weapon,
      name: 'Two hands',
      hands: 'two',
      operationId: 'routine',
    },
  );
  await owner.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId,
    name: 'Quick strike',
    hands: 'one',
    operationId: 'rename',
  });
  await member.mutation(api.characterSheet.deleteAttackRoutine, {
    ...scope,
    entryId,
    operationId: 'delete',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.entries.find(
      (row) => row._id === entryId,
    ),
  ).toMatchObject({
    active: false,
    state: { name: 'Quick strike', revision: 2 },
  });
  await owner.mutation(api.characterSheet.restoreAttackRoutine, {
    ...scope,
    entryId,
    operationId: 'undo',
  });
  expect(
    (await member.query(api.characterSheet.read, scope))?.entries.find(
      (row) => row._id === entryId,
    ),
  ).toMatchObject({
    active: true,
    state: { name: 'Quick strike', hands: 'one', revision: 3 },
  });
});

test('routine removal keeps only the latest Undo row and purges older removals on routine writes', async () => {
  const { owner, member, scope, weapon } = await fixture();
  const initial = await owner.query(api.characterSheet.read, scope);
  const first = initial?.entries.find((row) => row.kind === 'attackRoutine');
  if (!first) throw new Error('Missing routine');
  const second = await member.mutation(api.characterSheet.createAttackRoutine, {
    ...scope,
    weaponEntryId: weapon,
    name: 'Second',
    operationId: 'second',
  });
  await owner.mutation(api.characterSheet.deleteAttackRoutine, {
    ...scope,
    entryId: first._id,
    operationId: 'delete-first',
  });
  await member.mutation(api.characterSheet.deleteAttackRoutine, {
    ...scope,
    entryId: second,
    operationId: 'delete-second',
  });
  const removed = await owner.query(api.characterSheet.read, scope);
  expect(
    removed?.entries.filter((row) => row.kind === 'attackRoutine'),
  ).toMatchObject([
    { _id: second, active: false, state: { name: 'Second', revision: 1 } },
  ]);
  expect(
    removed?.entries.find((row) => row._id === second)?.state,
  ).not.toHaveProperty('deleted');
  await expect(
    owner.mutation(api.characterSheet.restoreAttackRoutine, {
      ...scope,
      entryId: first._id,
      operationId: 'undo-expired',
    }),
  ).rejects.toThrow('Attack Routine does not belong to this Character');
  await member.mutation(api.characterSheet.restoreAttackRoutine, {
    ...scope,
    entryId: second,
    operationId: 'undo-second',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.calculated
      .attackRoutines,
  ).toMatchObject([{ entryId: second, name: 'Second' }]);
});

test('a routine write retires historical removals before applying the sheet size limit', async () => {
  const { t, owner, scope, weapon } = await fixture();
  const initial = await owner.query(api.characterSheet.read, scope);
  const routine = initial?.entries.find((row) => row.kind === 'attackRoutine');
  if (routine?.kind !== 'attackRoutine') throw new Error('Missing routine');
  await t.run(async (ctx) => {
    for (let index = 0; index < maxCharacterChildRows + 2; index++)
      await ctx.db.insert('characterSheetEntry', {
        characterId: scope.characterId,
        kind: 'attackRoutine',
        active: false,
        state: routine.state,
      });
  });
  const entryId = await owner.mutation(api.characterSheet.createAttackRoutine, {
    ...scope,
    weaponEntryId: weapon,
    name: 'Fresh strike',
    operationId: 'create-after-old-removals',
  });
  const shared = await owner.query(api.characterSheet.read, scope);
  const routines = shared?.entries.filter(
    (row) => row.kind === 'attackRoutine',
  );
  expect(routines?.filter((row) => !row.active)).toHaveLength(1);
  expect(shared?.calculated.attackRoutines).toMatchObject([
    { entryId: routine._id },
    { entryId, name: 'Fresh strike' },
  ]);
});

test('two sessions apply the latest routine change and preserve independent routine edits', async () => {
  const { owner, member, scope, weapon } = await fixture();
  const initial = await owner.query(api.characterSheet.read, scope);
  const first = initial?.entries.find((row) => row.kind === 'attackRoutine');
  if (!first) throw new Error('Missing default routine');
  const second = await member.mutation(api.characterSheet.createAttackRoutine, {
    ...scope,
    weaponEntryId: weapon,
    operationId: 'second',
  });
  await owner.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: first._id,
    name: 'First session',
    operationId: 'first',
  });
  await member.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: first._id,
    name: 'Latest session',
    operationId: 'latest',
  });
  await member.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: second,
    hands: 'two',
    operationId: 'independent',
  });
  const shared = await owner.query(api.characterSheet.read, scope);
  expect(shared?.entries.find((row) => row._id === first._id)).toMatchObject({
    state: { name: 'Latest session', revision: 2 },
  });
  expect(shared?.entries.find((row) => row._id === second)).toMatchObject({
    state: { hands: 'two', revision: 1 },
  });
  await member.mutation(api.characterSheet.deleteAttackRoutine, {
    ...scope,
    entryId: first._id,
    operationId: 'latest-delete',
  });
  await owner.mutation(api.characterSheet.restoreAttackRoutine, {
    ...scope,
    entryId: first._id,
    operationId: 'latest-undo',
  });
  expect(
    (await member.query(api.characterSheet.read, scope))?.entries.find(
      (row) => row._id === first._id,
    ),
  ).toMatchObject({
    active: true,
    state: { name: 'Latest session', revision: 4 },
  });
});

test('a missing weapon preserves its editable routine and deletion prunes its Accepted Warning before undo', async () => {
  const { owner, member, scope, weapon } = await fixture();
  const initial = await owner.query(api.characterSheet.read, scope);
  const routine = initial?.entries.find((row) => row.kind === 'attackRoutine');
  if (!routine) throw new Error('Missing routine');
  await owner.mutation(api.characterSheet.removeSheetEntry, {
    ...scope,
    entryId: weapon,
    operationId: 'remove-weapon',
  });
  const missing = await member.query(api.characterSheet.read, scope);
  const warning = missing?.calculated.warnings.find(
    (row) => row.check === 'missingAttackWeapon',
  );
  if (!warning) throw new Error('Expected missing weapon warning');
  expect(missing?.calculated.attackRoutines[0]).toMatchObject({
    entryId: routine._id,
    single: [],
    full: [],
  });
  await member.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
    operationId: 'accept',
  });
  await owner.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: routine._id,
    name: 'Keep this routine',
    operationId: 'rename',
  });
  await member.mutation(api.characterSheet.deleteAttackRoutine, {
    ...scope,
    entryId: routine._id,
    operationId: 'delete',
  });
  const deleted = await owner.query(api.characterSheet.read, scope);
  expect(
    deleted?.acceptedWarnings.filter(
      (row) => row.check === 'missingAttackWeapon',
    ),
  ).toEqual([]);
  expect(deleted?.calculated.attackRoutines).toEqual([]);
  await owner.mutation(api.characterSheet.restoreAttackRoutine, {
    ...scope,
    entryId: routine._id,
    operationId: 'undo',
  });
  const restored = await member.query(api.characterSheet.read, scope);
  expect(restored?.calculated.attackRoutines[0]).toMatchObject({
    entryId: routine._id,
    name: 'Keep this routine',
    weaponEntryId: weapon,
  });
  expect(
    restored?.calculated.warnings.some(
      (row) => row.check === 'missingAttackWeapon',
    ),
  ).toBe(true);
});

test('changing routine hands applies real weapon proficiency and prunes the resolved Accepted Warning', async () => {
  const { owner, member, scope } = await fixture();
  const initial = await owner.query(api.characterSheet.read, scope);
  const bastard = initial?.catalogEntries.find(
    (row) => row.ruleIdentity === 'bastard-sword',
  );
  if (!bastard) throw new Error('Missing representative bastard sword');
  const weapon = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: bastard._id,
    operationId: 'exotic',
  });
  const sheet = await member.query(api.characterSheet.read, scope);
  const routine = sheet?.entries.find(
    (row) => row.kind === 'attackRoutine' && row.state.weaponEntryId === weapon,
  );
  const warning = sheet?.calculated.warnings.find(
    (row) => row.check === 'oneHandedExotic',
  );
  if (!routine || !warning)
    throw new Error('Missing routine proficiency warning');
  expect(
    sheet?.calculated.weaponProficiencies.find((row) => row.entryId === weapon)
      ?.attackPenalty,
  ).toBe(-4);
  await owner.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
    operationId: 'accept',
  });
  await member.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: routine._id,
    hands: 'two',
    operationId: 'two-hands',
  });
  const corrected = await owner.query(api.characterSheet.read, scope);
  expect(
    corrected?.calculated.warnings.some(
      (row) => row.check === 'oneHandedExotic',
    ),
  ).toBe(false);
  expect(
    corrected?.acceptedWarnings.some((row) => row.check === 'oneHandedExotic'),
  ).toBe(false);
});

test('weapon edits block nonfinite statistics and malformed dice while allowing unusual rule values', async () => {
  const { owner, scope, weapon } = await fixture();
  const before = await owner.query(api.characterSheet.read, scope);
  for (const badWeapon of [
    {
      baseType: 'longsword',
      proficiency: 'martial' as const,
      threat: Number.NaN,
    },
    {
      baseType: 'longsword',
      proficiency: 'martial' as const,
      mult: Number.POSITIVE_INFINITY,
    },
    {
      baseType: 'longsword',
      proficiency: 'martial' as const,
      rangeIncrement: Number.NEGATIVE_INFINITY,
    },
    { baseType: 'longsword', proficiency: 'martial' as const, dice: 'sword' },
  ]) {
    await expect(
      owner.mutation(api.characterSheet.editSheetEntry, {
        ...scope,
        entryId: weapon,
        detail: { kind: 'item', consumable: false, weapon: badWeapon },
        operationId: 'bad-weapon',
      }),
    ).rejects.toThrow();
    await expect(
      owner.mutation(api.characterSheet.createSheetEntry, {
        ...scope,
        name: 'Bad weapon',
        modifiers: [],
        detail: { kind: 'item', consumable: false, weapon: badWeapon },
        operationId: 'bad-new-weapon',
      }),
    ).rejects.toThrow();
  }
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
});

test('sheet reads reject a retained routine linked to another Character while allowing missing weapons', async () => {
  const { t, owner, scope, weapon } = await fixture();
  const otherId = await owner.mutation(api.characterSheet.create, {
    organizationId: scope.organizationId,
    campaignId: scope.campaignId,
    name: 'Other',
    kind: 'pc',
    operationId: 'other',
  });
  await t.run((ctx) =>
    ctx.db.insert('characterSheetEntry', {
      characterId: otherId,
      kind: 'attackRoutine',
      active: true,
      state: {
        kind: 'attackRoutine',
        name: 'Foreign weapon',
        weaponEntryId: weapon,
        hands: 'one',
        mode: 'melee',
      },
    }),
  );
  await expect(
    owner.query(api.characterSheet.read, { ...scope, characterId: otherId }),
  ).rejects.toThrow('Weapon does not belong');
});
