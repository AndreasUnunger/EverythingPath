// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

async function fixture() {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    for (const [name, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `test|${name}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    return ctx.db.insert('campaign', {
      name: 'Races',
      description: '',
      organizationId: 'org',
      ownerId: 'test|owner',
      e2eFixture: {
        namespace: 'races',
        version: 1,
        workerKey: '0',
        caseKey: 'races',
        campaignKey: 'races',
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
  const scope = { organizationId: 'org', campaignId, characterId };
  const catalog = await t.run(async (ctx) => {
    const human = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Test Human',
      ruleIdentity: 'test-human',
      stacksWithItself: false,
      modifiers: [],
      sources: [],
      detail: { kind: 'race', racialTraits: [] },
    });
    const ability = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Test ability',
      ruleIdentity: 'test-ability',
      stacksWithItself: false,
      modifiers: [{ target: 'ability.$choice', bonusType: 'racial', value: 2 }],
      sources: [],
      detail: { kind: 'racialTrait', raceEntryIds: [human], replaces: [] },
    });
    await ctx.db.patch('catalogEntry', human, {
      detail: { kind: 'race', racialTraits: [ability] },
    });
    const elf = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Test Elf',
      ruleIdentity: 'test-elf',
      stacksWithItself: false,
      modifiers: [],
      sources: [],
      detail: { kind: 'race', racialTraits: [] },
    });
    const alternate = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Test alternate',
      ruleIdentity: 'test-alternate',
      stacksWithItself: false,
      modifiers: [],
      sources: [],
      detail: {
        kind: 'racialTrait',
        raceEntryIds: [human],
        replaces: [ability],
      },
    });
    return { human, ability, elf, alternate };
  });
  return { t, owner, member, outsider, scope, catalog };
}

test.each([true, false])(
  'standard Bonus Feat and its Catalog Copy cannot be selected or deselected (%s)',
  async (selected) => {
    const { t, owner, scope, catalog } = await fixture();
    const bonusFeat = await t.run(async (ctx) => {
      const id = await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId: scope.characterId,
        name: 'Bonus Feat',
        ruleIdentity: 'test-bonus-feat',
        stacksWithItself: false,
        modifiers: [],
        sources: [],
        grantsSlots: [{ kind: 'feat', count: 1 }],
        detail: {
          kind: 'racialTrait',
          raceEntryIds: [catalog.human],
          replaces: [],
        },
      });
      await ctx.db.patch('catalogEntry', catalog.human, {
        detail: { kind: 'race', racialTraits: [catalog.ability, id] },
      });
      const copy = await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId: scope.characterId,
        name: 'Copied Bonus Feat',
        ruleIdentity: 'test-bonus-feat',
        stacksWithItself: false,
        modifiers: [],
        sources: [],
        grantsSlots: [{ kind: 'feat', count: 1 }],
        detail: {
          kind: 'racialTrait',
          raceEntryIds: [catalog.human],
          replaces: [],
        },
      });
      return { id, copy };
    });
    await owner.mutation(api.characterSheet.selectRace, {
      ...scope,
      catalogEntryId: catalog.human,
      operationId: 'human',
    });
    for (const catalogEntryId of [bonusFeat.id, bonusFeat.copy]) {
      await expect(
        owner.mutation(api.characterSheet.setRacialTraitSelected, {
          ...scope,
          catalogEntryId,
          selected,
          operationId: 'standard',
        }),
      ).rejects.toThrow('Standard Racial Traits are granted by their race');
      await expect(
        owner.mutation(api.characterSheet.selectEntry, {
          ...scope,
          catalogEntryId,
          operationId: 'generic-standard',
        }),
      ).rejects.toThrow('Standard Racial Traits are granted by their race');
    }
    const sheet = await owner.query(api.characterSheet.read, scope);
    const counting = sheet!.calculated.resolvedEntries.filter(
      (row) =>
        row.counting &&
        row.entry.kind === 'racialTrait' &&
        (row.entry.catalogEntryId === bonusFeat.id ||
          row.entry.catalogEntryId === bonusFeat.copy),
    );
    expect(counting).toHaveLength(1);
    expect(
      counting[0]?.entry.kind === 'racialTrait'
        ? counting[0].entry.grantKey
        : undefined,
    ).toEqual({
      source: 'test-human',
      entry: 'test-bonus-feat',
    });
    expect(
      sheet!.entries.filter(
        (entry) => entry.kind === 'racialTrait' && !entry.grantKey,
      ),
    ).toHaveLength(0);
  },
);

test('editing an alternate Selection cannot replace it with a standard Racial Trait', async () => {
  const { owner, scope, catalog } = await fixture();
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.human,
    operationId: 'human',
  });
  const entryId = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: catalog.alternate,
    operationId: 'alternate',
  });
  await expect(
    owner.mutation(api.characterSheet.editSelection, {
      ...scope,
      entryId,
      catalogEntryId: catalog.ability,
      operationId: 'replace-with-standard',
    }),
  ).rejects.toThrow('Standard Racial Traits are granted by their race');
  const sheet = await owner.query(api.characterSheet.read, scope);
  expect(sheet?.entries.find((entry) => entry._id === entryId)).toMatchObject({
    catalogEntryId: catalog.alternate,
    state: { kind: 'racialTrait' },
  });
});

test('personal adjustments cannot target a racial ability score choice', async () => {
  const { owner, scope } = await fixture();
  await expect(
    owner.mutation(api.characterSheet.createPersonalAdjustment, {
      ...scope,
      name: 'Invalid choice',
      modifiers: [
        {
          // @ts-expect-error Catalog-only choices are not manual Modifier targets.
          target: 'ability.$choice',
          bonusType: 'racial',
          value: 2,
        },
      ],
      operationId: 'personal-choice',
    }),
  ).rejects.toThrow();
  const sheet = await owner.query(api.characterSheet.read, scope);
  expect(sheet?.entries.some((entry) => entry.kind === 'manual')).toBe(false);
});

test('members select one race without adding to base scores and restore its chosen Grant after a race round trip', async () => {
  const { owner, member, scope, catalog } = await fixture();
  await member.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.human,
    operationId: 'human',
  });
  const human = await owner.query(api.characterSheet.read, scope);
  expect(human?.calculated.abilities.strength.score).toBe(10);
  await member.mutation(api.characterSheet.chooseRacialAbilityScore, {
    ...scope,
    target: { grantKey: { source: 'test-human', entry: 'test-ability' } },
    ability: 'strength',
    operationId: 'choice',
  });
  const chosen = await owner.query(api.characterSheet.read, scope);
  expect(chosen?.calculated.abilities.strength.score).toBe(12);
  expect(
    chosen?.baseScoresEntry.modifiers.find(
      (modifier) => modifier.target === 'ability.str',
    )?.value,
  ).toBe(10);
  const recorded = chosen?.entries.find(
    (entry) => entry.kind === 'racialTrait',
  );
  await member.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.elf,
    operationId: 'elf',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.calculated.abilities
      .strength.score,
  ).toBe(10);
  await member.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.human,
    operationId: 'human-again',
  });
  const restored = await owner.query(api.characterSheet.read, scope);
  expect(restored?.calculated.abilities.strength.score).toBe(12);
  expect(
    restored?.entries.find((entry) => entry._id === recorded?._id),
  ).toMatchObject({ state: { choice: 'strength' } });
  expect(
    restored?.entries.filter((entry) => entry.kind === 'race' && entry.active),
  ).toHaveLength(1);
});

test('changing or clearing a selected racial ability preserves its recorded choice order and Class Level', async () => {
  const { t, owner, scope, catalog } = await fixture();
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', catalog.alternate, {
      modifiers: [{ target: 'ability.$choice', bonusType: 'racial', value: 2 }],
    }),
  );
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.human,
    operationId: 'human',
  });
  const classLevelId = await owner.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    operationId: 'level',
  });
  const entryId = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: catalog.alternate,
    choice: 'strength',
    gainedAtClassLevel: classLevelId,
    choiceOrder: 0,
    operationId: 'alternate',
  });
  for (const ability of ['dexterity', null] as const) {
    await owner.mutation(api.characterSheet.chooseRacialAbilityScore, {
      ...scope,
      target: { entryId },
      ability,
      operationId: ability ?? 'clear',
    });
    const sheet = await owner.query(api.characterSheet.read, scope);
    expect(sheet?.entries.find((entry) => entry._id === entryId)).toMatchObject({
      kind: 'racialTrait',
      choiceOrder: 0,
      gainedAtClassLevel: classLevelId,
      state: { kind: 'racialTrait', choice: ability },
    });
  }
});

test('switching an alternate off restores the same ability choice and reselecting retains the alternate row', async () => {
  const { owner, scope, catalog } = await fixture();
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.human,
    operationId: 'human',
  });
  await owner.mutation(api.characterSheet.chooseRacialAbilityScore, {
    ...scope,
    target: { grantKey: { source: 'test-human', entry: 'test-ability' } },
    ability: 'dexterity',
    operationId: 'choice',
  });
  await owner.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: catalog.alternate,
    selected: true,
    operationId: 'alternate',
  });
  const replaced = await owner.query(api.characterSheet.read, scope);
  const alternate = replaced?.entries.find(
    (entry) => entry.kind === 'racialTrait' && !entry.grantKey,
  );
  expect(replaced?.calculated.abilities.dexterity.score).toBe(10);
  await owner.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: catalog.alternate,
    selected: false,
    operationId: 'off',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.calculated.abilities
      .dexterity.score,
  ).toBe(12);
  await owner.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: catalog.alternate,
    selected: true,
    operationId: 'on',
  });
  const restored = await owner.query(api.characterSheet.read, scope);
  expect(
    restored?.entries.find((entry) => entry._id === alternate?._id)?.active,
  ).toBe(true);
  await owner.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: catalog.alternate,
    selected: false,
    operationId: 'off-again',
  });
  await owner.mutation(api.characterSheet.chooseRacialAbilityScore, {
    ...scope,
    target: { grantKey: { source: 'test-human', entry: 'test-ability' } },
    ability: null,
    operationId: 'clear',
  });
  const cleared = await owner.query(api.characterSheet.read, scope);
  expect(cleared?.calculated.abilities.dexterity.score).toBe(10);
  expect(
    cleared?.calculated.warnings.some(
      (warning) =>
        warning.kind === 'incomplete' &&
        warning.subject.includes('test-ability'),
    ),
  ).toBe(true);
});

test('unresolved replacements use explicit local targets and every change prunes stale duplicate acceptance', async () => {
  const { t, owner, scope, catalog } = await fixture();
  const unresolved = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: scope.characterId,
      name: 'Unresolved heritage',
      ruleIdentity: 'unresolved-heritage',
      stacksWithItself: false,
      modifiers: [],
      sources: [],
      detail: {
        kind: 'racialTrait',
        raceEntryIds: [catalog.human],
        replaces: [],
        unresolvedReplacements: ['ability score trait'],
      },
    }),
  );
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.human,
    operationId: 'human',
  });
  await owner.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: catalog.alternate,
    selected: true,
    operationId: 'first-alternate',
  });
  await owner.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: unresolved,
    selected: true,
    operationId: 'unresolved',
  });
  const pending = await owner.query(api.characterSheet.read, scope);
  const selection = pending?.entries.find(
    (entry) =>
      entry.kind === 'racialTrait' && entry.catalogEntryId === unresolved,
  );
  if (!selection) throw new Error('Missing alternate');
  expect(
    pending?.calculated.warnings.some(
      (warning) => warning.check === 'racialReplacementUnresolved',
    ),
  ).toBe(true);
  await owner.mutation(api.characterSheet.setRacialTraitReplacements, {
    ...scope,
    entryId: selection._id,
    replaces: [catalog.ability],
    operationId: 'manual',
  });
  const duplicate = await owner.query(api.characterSheet.read, scope);
  const warning = duplicate?.calculated.warnings.find(
    (warning) => warning.check === 'racialReplacementDuplicate',
  );
  if (!warning) throw new Error('Missing duplicate warning');
  expect(
    duplicate?.calculated.warnings.some(
      (warning) => warning.check === 'racialReplacementUnresolved',
    ),
  ).toBe(false);
  await owner.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
    operationId: 'accept',
  });
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.elf,
    operationId: 'dormant',
  });
  const dormant = await owner.query(api.characterSheet.read, scope);
  expect(
    dormant?.calculated.warnings.some(
      (current) => current.check === 'racialReplacementDuplicate',
    ),
  ).toBe(false);
  expect(
    dormant?.acceptedWarnings.some(
      (accepted) => accepted.check === 'racialReplacementDuplicate',
    ),
  ).toBe(true);
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.human,
    operationId: 'restore-source',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.acceptedWarnings.some(
      (accepted) => accepted.check === 'racialReplacementDuplicate',
    ),
  ).toBe(true);
  await owner.mutation(api.characterSheet.setRacialTraitReplacements, {
    ...scope,
    entryId: selection._id,
    replaces: [],
    operationId: 'none',
  });
  const resolved = await owner.query(api.characterSheet.read, scope);
  expect(
    resolved?.acceptedWarnings.some(
      (accepted) => accepted.check === 'racialReplacementDuplicate',
    ),
  ).toBe(false);
  await owner.mutation(api.characterSheet.setRacialTraitReplacements, {
    ...scope,
    entryId: selection._id,
    replaces: [catalog.ability],
    operationId: 'duplicate-again',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.acceptedWarnings.some(
      (accepted) => accepted.check === 'racialReplacementDuplicate',
    ),
  ).toBe(false);
});

test('all race writers enforce membership, Character-scoped references, and migration controls', async () => {
  const { t, owner, outsider, scope, catalog } = await fixture();
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.human,
    operationId: 'human',
  });
  await owner.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: catalog.alternate,
    selected: true,
    operationId: 'alternate',
  });
  const before = await owner.query(api.characterSheet.read, scope);
  const race = before?.entries.find((entry) => entry.kind === 'race');
  const alternate = before?.entries.find(
    (entry) => entry.kind === 'racialTrait' && !entry.grantKey,
  );
  if (!race || !alternate) throw new Error('Missing fixture entries');
  const raceId = race._id;
  const alternateId = alternate._id;
  function commands(caller: typeof owner, writeEpoch?: number) {
    const common = { ...scope, operationId: 'blocked', writeEpoch };
    return [
      () =>
        caller.mutation(api.characterSheet.selectRace, {
          ...common,
          catalogEntryId: catalog.elf,
        }),
      () =>
        caller.mutation(api.characterSheet.chooseRacialAbilityScore, {
          ...common,
          target: { grantKey: { source: 'test-human', entry: 'test-ability' } },
          ability: 'strength',
        }),
      () =>
        caller.mutation(api.characterSheet.setRacialTraitSelected, {
          ...common,
          catalogEntryId: catalog.alternate,
          selected: false,
        }),
      () =>
        caller.mutation(api.characterSheet.setRacialTraitReplacements, {
          ...common,
          entryId: alternateId,
          replaces: [],
        }),
      () =>
        caller.mutation(api.characterSheet.editRaceStatistics, {
          ...common,
          entryId: raceId,
          racialHpGained: 8,
        }),
    ];
  }
  for (const command of commands(outsider))
    await expect(command()).rejects.toThrow();
  await expect(t.query(api.characterSheet.read, scope)).rejects.toThrow();
  const otherCharacterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId: scope.campaignId,
    name: 'Other',
    kind: 'pc',
    operationId: 'other',
  });
  await expect(
    owner.mutation(api.characterSheet.selectRace, {
      ...scope,
      characterId: otherCharacterId,
      catalogEntryId: catalog.human,
      operationId: 'foreign-race',
    }),
  ).rejects.toThrow('does not belong');
  await expect(
    owner.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      characterId: otherCharacterId,
      catalogEntryId: catalog.alternate,
      selected: true,
      operationId: 'foreign-trait',
    }),
  ).rejects.toThrow('does not belong');
  await expect(
    owner.mutation(api.characterSheet.setRacialTraitReplacements, {
      ...scope,
      characterId: otherCharacterId,
      entryId: alternateId,
      replaces: [],
      operationId: 'foreign-row',
    }),
  ).rejects.toThrow('does not belong');
  const otherCampaignId = await t.run((ctx) =>
    ctx.db.insert('campaign', {
      name: 'Other campaign',
      description: '',
      organizationId: 'org',
      ownerId: 'test|owner',
      e2eFixture: {
        namespace: 'races',
        version: 1,
        workerKey: '0',
        caseKey: 'other',
        campaignKey: 'other',
      },
    }),
  );
  const crossCampaignCharacterId = await owner.mutation(
    api.characterSheet.create,
    {
      organizationId: 'org',
      campaignId: otherCampaignId,
      name: 'Cross campaign',
      kind: 'pc',
      operationId: 'cross',
    },
  );
  await expect(
    owner.mutation(api.characterSheet.selectRace, {
      ...scope,
      characterId: crossCampaignCharacterId,
      catalogEntryId: catalog.human,
      operationId: 'cross-reference',
    }),
  ).rejects.toThrow();
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
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, { closed: false }),
  );
  for (const command of commands(owner))
    await expect(command()).rejects.toThrow('RELOAD_REQUIRED');
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, { authority: 'sheet' }),
  );
  for (const command of commands(owner, 1))
    await expect(command()).rejects.toThrow('RELOAD_REQUIRED');
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
});

test('private race choices belong to the owner and generic writers cannot bypass race or ability controls', async () => {
  const { owner, member, scope, catalog } = await fixture();
  const privateId = await owner.mutation(api.characterSheet.create, {
    name: 'Private',
    kind: 'pc',
    operationId: 'private',
  });
  await expect(
    member.query(api.characterSheet.read, { characterId: privateId }),
  ).rejects.toThrow();
  await expect(
    member.mutation(api.characterSheet.selectRace, {
      characterId: privateId,
      catalogEntryId: catalog.human,
      operationId: 'steal',
    }),
  ).rejects.toThrow();
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.human,
    operationId: 'human',
  });
  await expect(
    owner.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: catalog.elf,
      operationId: 'duplicate-race',
    }),
  ).rejects.toThrow('race picker');
  await expect(
    owner.mutation(api.characterSheet.editGrantState, {
      ...scope,
      grantKey: { source: 'test-human', entry: 'test-ability' },
      state: { choice: 'luck' },
      operationId: 'invalid-choice',
    }),
  ).rejects.toThrow('valid ability');
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: null,
    operationId: 'clear',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.entries.filter(
      (entry) => entry.kind === 'race' && entry.active,
    ),
  ).toHaveLength(0);
});

test('racial Hit Dice keep level separate, never prefill HP, and persist racial rank allocation through race changes', async () => {
  const { t, owner, scope, catalog } = await fixture();
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', catalog.human, {
      detail: {
        kind: 'race',
        racialTraits: [catalog.ability],
        size: 'medium',
        creatureTypes: ['humanoid'],
        racialHitDice: 2,
        racialProgression: {
          creatureType: 'humanoid',
          hitDie: 8,
          bab: 'full',
          saves: { fort: 'good', ref: 'poor', will: 'poor' },
          skillRanksPerHitDie: 2,
          classSkills: ['acr'],
        },
      },
    }),
  );
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.human,
    operationId: 'human',
  });
  const initial = await owner.query(api.characterSheet.read, scope);
  const race = initial?.entries.find((entry) => entry.kind === 'race');
  const classLevel = initial?.entries.find(
    (entry) => entry.kind === 'classLevel',
  );
  if (race?.kind !== 'race' || !classLevel) throw new Error('Missing entries');
  expect(race.state.racialHpGained).toBeUndefined();
  expect(initial?.calculated).toMatchObject({
    level: 1,
    hitDice: 3,
    hp: null,
    budgets: { racialSkillRanks: 4 },
    racial: { size: 'medium', creatureTypes: ['humanoid'] },
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: classLevel._id,
    hpGained: 8,
    operationId: 'class-hp',
  });
  await owner.mutation(api.characterSheet.editRaceStatistics, {
    ...scope,
    entryId: race._id,
    racialHpGained: 12,
    racialSkillRanks: { acr: 3 },
    operationId: 'race-stats',
  });
  const recorded = await owner.query(api.characterSheet.read, scope);
  expect(recorded?.calculated.hp).toBe(20);
  expect(recorded?.calculated.warnings).toContainEqual(
    expect.objectContaining({
      check: 'racialSkillRankCap',
      subject: `${race._id}:skill.acr`,
      kind: 'rules',
    }),
  );
  expect(recorded?.calculated.classLevels[0]?.exceededSkillRankCaps).toEqual(
    [],
  );
  expect(
    recorded?.calculated.classLevels[0]?.cumulativeSkillRanks,
  ).toContainEqual({ skill: 'skill.acr', ranks: 3 });
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.elf,
    operationId: 'elf',
  });
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.human,
    operationId: 'human-again',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.entries.find(
      (entry) => entry._id === race._id,
    ),
  ).toMatchObject({
    state: { racialHpGained: 12, racialSkillRanks: { acr: 3 } },
  });
  await expect(
    owner.mutation(api.characterSheet.editRaceStatistics, {
      ...scope,
      entryId: race._id,
      racialSkillRanks: { acr: -1 },
      operationId: 'invalid',
    }),
  ).rejects.toThrow('whole number');
});

test('representative private race content exposes trait facts and one-of race equivalence choices on any entry', async () => {
  const { t, owner, member } = await fixture();
  const characterId = await owner.mutation(api.characterSheet.create, {
    name: 'Private half-elf',
    kind: 'pc',
    operationId: 'private',
  });
  const initial = await owner.query(api.characterSheet.read, { characterId });
  const halfElf = initial?.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'half-elf',
  );
  if (!halfElf) throw new Error('Representative race not seeded');
  await owner.mutation(api.characterSheet.selectRace, {
    characterId,
    catalogEntryId: halfElf._id,
    operationId: 'half-elf',
  });
  const selected = await owner.query(api.characterSheet.read, { characterId });
  expect(selected?.calculated.racial).toMatchObject({
    countsAsRaces: ['elf', 'half-elf', 'human'],
    favoredClassCount: 2,
  });
  expect(selected?.calculated.abilities.strength.score).toBe(10);
  await expect(
    member.query(api.characterSheet.read, { characterId }),
  ).rejects.toThrow();
  const heritage = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Chosen blood',
      ruleIdentity: 'chosen-blood',
      modifiers: [],
      stacksWithItself: false,
      sources: [],
      countsAsRaces: { oneOf: ['orc', 'dragon'] },
      detail: { kind: 'feat' },
    }),
  );
  const entryId = await owner.mutation(api.characterSheet.selectEntry, {
    characterId,
    catalogEntryId: heritage,
    operationId: 'heritage',
  });
  expect(
    (await owner.query(api.characterSheet.read, { characterId }))?.calculated
      .racial.countsAsRaces,
  ).not.toContain('orc');
  await owner.mutation(api.characterSheet.editSelection, {
    characterId,
    entryId,
    choice: 'orc',
    operationId: 'orc',
  });
  expect(
    (await owner.query(api.characterSheet.read, { characterId }))?.calculated
      .racial.countsAsRaces,
  ).toContain('orc');
  await expect(
    owner.mutation(api.characterSheet.editSelection, {
      characterId,
      entryId,
      choice: 'elf',
      operationId: 'unavailable',
    }),
  ).rejects.toThrow('available races');
});

test('customizing a selected race preserves its source row, racial HP and recorded ability choice', async () => {
  const { t, owner, scope, catalog } = await fixture();
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.human,
    operationId: 'human',
  });
  const initial = await owner.query(api.characterSheet.read, scope);
  const race = initial?.entries.find((entry) => entry.kind === 'race');
  const definition = initial?.catalogEntries.find(
    (entry) => entry._id === catalog.human,
  );
  if (!race || !definition) throw new Error('Missing race');
  await owner.mutation(api.characterSheet.editRaceStatistics, {
    ...scope,
    entryId: race._id,
    racialHpGained: 7,
    operationId: 'hp',
  });
  await owner.mutation(api.characterSheet.chooseRacialAbilityScore, {
    ...scope,
    target: { grantKey: { source: 'test-human', entry: 'test-ability' } },
    ability: 'strength',
    operationId: 'str',
  });
  const copyId = await t.run((ctx) => {
    const {
      _id: _discardId,
      _creationTime: _discardTime,
      ...copy
    } = definition;
    return ctx.db.insert('catalogEntry', { ...copy, name: 'Human customized' });
  });
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: copyId,
    operationId: 'customize',
  });
  const copied = await owner.query(api.characterSheet.read, scope);
  expect(copied?.entries.find((entry) => entry._id === race._id)).toMatchObject(
    { active: true, catalogEntryId: copyId, state: { racialHpGained: 7 } },
  );
  expect(copied?.calculated.abilities.strength.score).toBe(12);
  expect(copied?.entries.filter((entry) => entry.kind === 'race')).toHaveLength(
    1,
  );
});
