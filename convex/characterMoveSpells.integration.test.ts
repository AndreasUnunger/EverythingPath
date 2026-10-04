// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { afterEach, expect, test, vi } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';
import type { Id } from './_generated/dataModel';

const modules = import.meta.glob('./**/*.ts');
const instances: ReturnType<typeof convexTest>[] = [];
afterEach(async () => {
  for (const instance of instances)
    await instance.finishAllScheduledFunctions(vi.runAllTimers);
  instances.length = 0;
  vi.useRealTimers();
});

// Lowered convex-test budgets let small catalogs reach the same move guards.
// Keyed Spell scans stop with 1,024 reads in reserve, so this budget leaves
// them 256 rows short of the unrelated definitions. Discovery reads 32 Spells
// per resume, so paging through those definitions would exceed the resume cap.
function readBudget(unrelatedDefinitions: number) {
  return { documentsRead: unrelatedDefinitions + 768 };
}
const maxMoveResumes = 24;
async function fixture(
  transactionLimits:
    | { documentsRead?: number; documentsWritten?: number }
    | false = false,
) {
  vi.useFakeTimers();
  const t = convexTest({ schema, modules, transactionLimits });
  instances.push(t);
  const campaigns = await t.run(async (ctx) => {
    await ctx.db.insert('user', {
      tokenIdentifier: 'owner',
      orgIds: [{ orgId: 'org', role: 'member' }],
      characterSheetDemo: true,
    });
    const ids: Id<'campaign'>[] = [];
    for (const name of ['Source', 'Destination'])
      ids.push(
        await ctx.db.insert('campaign', {
          name,
          description: '',
          organizationId: 'org',
          ownerId: 'owner',
          e2eFixture: {
            namespace: 'move-spells',
            version: 1,
            workerKey: '0',
            caseKey: name,
            campaignKey: name,
          },
        }),
      );
    return ids;
  });
  const owner = t.withIdentity({ tokenIdentifier: 'owner' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    campaignId: campaigns[0],
    organizationId: 'org',
    name: 'Vessa',
    kind: 'pc',
    operationId: 'create',
  });
  const sheet = await owner.query(api.characterSheet.read, { characterId });
  const wizard = sheet?.catalogEntries.find((row) => row.name === 'Wizard');
  const level = sheet?.entries.find((row) => row.kind === 'classLevel');
  if (!wizard || !level || !campaigns[0] || !campaigns[1])
    throw new Error('Missing fixture');
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId,
    entryId: level._id,
    classEntryId: wizard._id,
    operationId: 'wizard',
  });
  async function spell(
    campaignId: Id<'campaign'>,
    name: string,
    ruleIdentity = name,
    tag = 'wizard',
  ) {
    return t.run((ctx) =>
      ctx.db.insert('catalogEntry', {
        scope: 'campaign',
        campaignId,
        name,
        ruleIdentity,
        sources: [],
        modifiers: [],
        stacksWithItself: false,
        detail: { kind: 'spell', levels: { [tag]: 3 }, school: 'illusion' },
      }),
    );
  }
  async function move(
    operationId: string,
    destinationCampaignId = campaigns[1],
  ) {
    let result = await owner.mutation(api.characterMoves.start, {
      characterId,
      operationId,
      destinationCampaignId,
    });
    for (
      let count = 0;
      count < maxMoveResumes && result.state !== 'completed';
      count++
    )
      result = await owner.mutation(api.characterMoves.resume, {
        characterId,
        operationId,
      });
    expect(result.state).toBe('completed');
  }
  return { t, owner, characterId, campaigns, wizard, spell, move };
}

test('movement publishes carried unrecorded lists and destination spells with accurate browse counts', async () => {
  const { owner, characterId, campaigns, wizard, spell, move } =
    await fixture();
  if (!campaigns[0] || !campaigns[1]) throw new Error('Missing campaigns');
  const sourceId = await spell(campaigns[0], 'Source Sigil');
  const destinationId = await spell(campaigns[1], 'Destination Sigil');
  await spell(campaigns[1], 'Unrelated Sigil', 'unrelated', 'other-list');
  await move('to-destination');
  const sheet = await owner.query(api.characterSheet.read, { characterId });
  const carried = sheet?.catalogEntries.find(
    (row) => row.copiedFrom === sourceId,
  );
  expect(carried).toMatchObject({ scope: 'character', characterId });
  const browser = await owner.query(api.characterSheetSpells.browse, {
    characterId,
    castingClassId: wizard._id,
    search: 'Sigil',
    paginationOpts: { cursor: null, numItems: 20 },
  });
  expect(
    browser.page
      .map((row) => [row.name, row.catalogEntryId, row.recorded])
      .sort(),
  ).toEqual([
    ['Destination Sigil', destinationId, false],
    ['Source Sigil', carried?._id, false],
  ]);
  expect(browser.isDone).toBe(true);
});

test('a carried recorded Spell wins over a divergent destination copy without changing its saved row or class link', async () => {
  const { owner, characterId, campaigns, wizard, spell, move } =
    await fixture();
  if (!campaigns[0] || !campaigns[1]) throw new Error('Missing campaigns');
  const sourceId = await spell(campaigns[0], 'Carried Sigil', 'same-spell');
  await spell(campaigns[1], 'Divergent Sigil', 'same-spell');
  const entryId = await owner.mutation(api.characterSheetSpells.record, {
    characterId,
    catalogEntryId: sourceId,
    castingClassId: wizard._id,
    operationId: 'record',
  });
  const before = await owner.query(api.characterSheet.read, { characterId });
  await move('to-destination');
  const after = await owner.query(api.characterSheet.read, { characterId });
  const previous = before?.entries.find((row) => row._id === entryId);
  const recorded = after?.entries.find((row) => row._id === entryId);
  expect(recorded?.state).toEqual(previous?.state);
  expect(recorded?._id).toBe(entryId);
  const browser = await owner.query(api.characterSheetSpells.browse, {
    characterId,
    castingClassId: wizard._id,
    search: 'Sigil',
    paginationOpts: { cursor: null, numItems: 20 },
  });
  expect(browser.page).toMatchObject([
    { name: 'Carried Sigil', recorded: true, spellLevel: 3 },
  ]);
  expect(browser.page).toHaveLength(1);
  await move('return', campaigns[0]);
  const returned = await owner.query(api.characterSheetSpells.browse, {
    characterId,
    castingClassId: wizard._id,
    search: 'Sigil',
    paginationOpts: { cursor: null, numItems: 20 },
  });
  expect(returned.page).toEqual(browser.page);
});

test('spell expansion beyond the transaction budget leaves the old campaign and browse state authoritative', async () => {
  // Publication reserves 1,024 writes plus three per new Spell: 96 Spells need
  // 1,312, beyond the 1,280-write budget.
  const { t, owner, characterId, campaigns, wizard } = await fixture({
    documentsWritten: 1280,
  });
  if (!campaigns[1]) throw new Error('Missing destination');
  const destinationCampaignId = campaigns[1];
  await t.run(async (ctx) => {
    for (let count = 0; count < 96; count++)
      await ctx.db.insert('catalogEntry', {
        scope: 'campaign',
        campaignId: destinationCampaignId,
        name: `Bound Sigil ${count}`,
        ruleIdentity: `bound-${count}`,
        sources: [],
        modifiers: [],
        stacksWithItself: false,
        detail: { kind: 'spell', levels: { wizard: 1 }, school: 'illusion' },
      });
  });
  const before = await owner.query(api.characterSheet.read, { characterId });
  const operationId = 'too-many-spells';
  let progress = await owner.mutation(api.characterMoves.start, {
    characterId,
    destinationCampaignId,
    operationId,
  });
  for (let count = 0; count < 100 && progress.state !== 'ready'; count++)
    progress = await owner.mutation(api.characterMoves.resume, {
      characterId,
      operationId,
    });
  expect(progress.state).toBe('ready');
  await expect(
    owner.mutation(api.characterMoves.resume, { characterId, operationId }),
  ).rejects.toThrow('spell expansion exceeds atomic publication limits');
  expect(await owner.query(api.characterSheet.read, { characterId })).toEqual(
    before,
  );
  const browser = await owner.query(api.characterSheetSpells.browse, {
    characterId,
    castingClassId: wizard._id,
    search: 'Bound Sigil',
    paginationOpts: { cursor: null, numItems: 20 },
  });
  expect(browser.page).toEqual([]);
});

test('a destination with more than 128 matching spells and more unrelated definitions than a Spell scan can read remains movable', async () => {
  // 160 Spells raise publication reads beyond a 1,792-read budget.
  const unrelatedDefinitions = 1536;
  const { t, owner, characterId, campaigns, wizard, move } = await fixture(
    readBudget(unrelatedDefinitions),
  );
  if (!campaigns[1]) throw new Error('Missing destination');
  const campaignId = campaigns[1];
  await t.run(async (ctx) => {
    for (let count = 0; count < 160 + unrelatedDefinitions; count++)
      if (count < 160)
        await ctx.db.insert('catalogEntry', {
          scope: 'campaign',
          campaignId,
          name: `Destination ${count}`,
          ruleIdentity: `destination-${count}`,
          sources: [],
          modifiers: [],
          stacksWithItself: false,
          detail: {
            kind: 'spell',
            levels: { wizard: 3 },
            school: 'move-school',
          },
        });
      else
        await ctx.db.insert('catalogEntry', {
          scope: 'campaign',
          campaignId,
          name: `Destination ${count}`,
          ruleIdentity: `destination-${count}`,
          sources: [],
          modifiers: [],
          stacksWithItself: false,
          detail: { kind: 'manual' },
        });
  });
  await move('large-destination');
  const browser = await owner.query(api.characterSheetSpells.browse, {
    characterId,
    castingClassId: wizard._id,
    school: 'move-school',
    paginationOpts: { cursor: null, numItems: 100 },
  });
  const nextPage = await owner.query(api.characterSheetSpells.browse, {
    characterId,
    castingClassId: wizard._id,
    school: 'move-school',
    paginationOpts: { cursor: browser.continueCursor, numItems: 100 },
  });
  expect([...browser.page, ...nextPage.page]).toHaveLength(160);
  expect(nextPage.isDone).toBe(true);
  const metadata = await owner.query(api.characterSheetSpells.browserInfo, {
    characterId,
    castingClassId: wizard._id,
  });
  expect(metadata.schools).toContain('move-school');
  const summary = await t.run((ctx) =>
    ctx.db
      .query('spellCatalogSummary')
      .withIndex('by_characterId_and_castingClassId_and_kind_and_value', (q) =>
        q
          .eq('characterId', characterId)
          .eq('castingClassId', wizard._id)
          .eq('kind', 'school')
          .eq('value', 'move-school'),
      )
      .unique(),
  );
  expect(summary).toMatchObject({
    count: 160,
    availableCount: 160,
    unrecordedCount: 160,
  });
});

test('unused Character customizations carry future referenced options and resources transitively', async () => {
  const { t, owner, characterId, campaigns, move } = await fixture();
  if (!campaigns[0]) throw new Error('Missing source');
  const campaignId = campaigns[0];
  const ids = await t.run(async (ctx) => {
    const customization = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      browseOnly: true,
      name: 'Unused custom future feature',
      ruleIdentity: 'unused-feature',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: {
        kind: 'classFeature',
        picksByLevel: [{ classLevel: 20, list: 'future-options', count: 1 }],
      },
    });
    const option = await ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId,

      name: 'Unselected future option',
      ruleIdentity: 'future-option',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: {
        kind: 'classFeature',
      },
    });
    const resource = await ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId,

      name: 'Option resource',
      ruleIdentity: 'option-resource',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: { kind: 'manual' },
    });
    await ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId,

      name: 'Unrelated option',
      ruleIdentity: 'unrelated-option',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: { kind: 'manual' },
    });
    await ctx.db.patch('catalogEntry', customization, {
      grants: [{ catalogEntryId: option }],
    });
    await ctx.db.patch('catalogEntry', option, {
      grants: [{ catalogEntryId: resource }],
    });
    return { customization, option, resource };
  });
  await move('future-options');
  const definitions = await owner.query(api.catalogCopies.list, {
    characterId,
  });
  expect(
    await t.run((ctx) => ctx.db.get('catalogEntry', ids.customization)),
  ).toMatchObject({
    characterId,
    scope: 'character',
    browseOnly: true,
    name: 'Unused custom future feature',
  });
  expect(
    definitions
      .filter(
        (row) =>
          row.copiedFrom === ids.option || row.copiedFrom === ids.resource,
      )
      .map((row) => row.name)
      .sort(),
  ).toEqual(['Option resource', 'Unselected future option']);
  expect(definitions.some((row) => row.name === 'Unrelated option')).toBe(
    false,
  );
});

test('ID-keyed casting conditions keep concentration modifiers through copying', async () => {
  const { t, owner, characterId, campaigns, wizard, move } = await fixture();
  if (!campaigns[0]) throw new Error('Missing source');
  const campaignId = campaigns[0];
  const sourceId = await t.run(async (ctx) => {
    const original = await ctx.db.get('catalogEntry', wizard._id);
    if (
      original?.detail.kind !== 'class' ||
      !('casting' in original.detail) ||
      !original.detail.casting
    )
      throw new Error('Missing casting');
    const { _id, _creationTime, characterId: _character, ...body } = original;
    const id = await ctx.db.insert('catalogEntry', {
      ...body,
      scope: 'campaign',
      campaignId,
      name: 'ID Wizard',
    });
    await ctx.db.patch('catalogEntry', id, {
      detail: {
        ...original.detail,
        casting: { ...original.detail.casting, classTag: id },
      },
      modifiers: [
        {
          target: 'concentration',
          bonusType: 'untyped',
          value: 2,
          condition: { castingClass: id },
        },
      ],
    });
    return id;
  });
  const sheet = await owner.query(api.characterSheet.read, { characterId });
  const level = sheet?.entries.find((row) => row.kind === 'classLevel');
  if (!level) throw new Error('Missing level');
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId,
    entryId: level._id,
    classEntryId: sourceId,
    operationId: 'id-wizard',
  });
  const before = await owner.query(api.characterSheet.read, { characterId });
  const concentration = before?.calculated.spellcastings.find(
    (row) => row.classEntryId === sourceId,
  )?.concentration;
  expect(concentration?.total).toBe(3);
  await move('id-casting');
  const after = await owner.query(api.characterSheet.read, { characterId });
  const carried = after?.catalogEntries.find(
    (row) => row.copiedFrom === sourceId,
  );
  expect(
    after?.calculated.spellcastings.find(
      (row) => row.classEntryId === carried?._id,
    )?.concentration?.total,
  ).toBe(3);
});

test('casting and prompt consumers with the same list key stay in their source campaign', async () => {
  const { t, owner, characterId, campaigns, wizard, spell, move } =
    await fixture();
  const campaignId = campaigns[0];
  if (!campaignId) throw new Error('Missing source');
  const castingDetail = wizard.detail;
  if (castingDetail.kind !== 'class' || !('featuresByLevel' in castingDetail))
    throw new Error('Missing casting class fixture');
  const ids = await t.run(async (ctx) => {
    const child = await ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId,
      name: 'Unrelated progression',
      ruleIdentity: 'unrelated-progression',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: { kind: 'classFeature' },
    });
    const caster = await ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId,
      name: 'Unrelated caster',
      ruleIdentity: 'unrelated-caster',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: {
        ...castingDetail,
        featuresByLevel: [{ classLevel: 20, catalogEntryId: child }],
      },
    });
    const modifier = await ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId,
      name: 'Unrelated concentration modifier',
      ruleIdentity: 'unrelated-casting-modifier',
      sources: [],
      modifiers: [
        {
          target: 'concentration',
          bonusType: 'untyped',
          value: 2,
          condition: { castingClass: 'wizard' },
        },
      ],
      stacksWithItself: false,
      detail: { kind: 'feat' },
    });
    const prompt = await ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId,
      name: 'Unrelated prompt consumer',
      ruleIdentity: 'unrelated-prompt',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: {
        kind: 'classFeature',
        picksByLevel: [{ classLevel: 20, list: 'wizard', count: 1 }],
      },
    });
    return [child, caster, modifier, prompt];
  });
  const member = await spell(campaignId, 'Actual list member');
  await move('provider-aware-membership');
  const definitions = await owner.query(api.catalogCopies.list, {
    characterId,
  });
  expect(definitions.some((row) => row.copiedFrom === member)).toBe(true);
  expect(
    definitions.filter((row) => row.copiedFrom && ids.includes(row.copiedFrom)),
  ).toEqual([]);
});

test('source and global catalogs with more unrelated non-Spell definitions than a Spell scan can read still permit a keyed move', async () => {
  const unrelatedDefinitions = 1024;
  const { t, owner, characterId, campaigns, spell, move } = await fixture(
    readBudget(unrelatedDefinitions),
  );
  const sourceCampaignId = campaigns[0];
  if (!sourceCampaignId) throw new Error('Missing source');
  const member = await spell(sourceCampaignId, 'Retained spell');
  const command = { characterId, operationId: 'large-unrelated-source' };
  let progress = await owner.mutation(api.characterMoves.start, {
    ...command,
    destinationCampaignId: campaigns[1],
  });
  for (let i = 0; i < 100 && progress.state !== 'ready'; i++)
    progress = await owner.mutation(api.characterMoves.resume, command);
  expect(progress.state).toBe('ready');
  await t.run(async (ctx) => {
    for (const scope of ['campaign', 'global'] as const)
      for (let i = 0; i < unrelatedDefinitions; i++)
        await ctx.db.insert('catalogEntry', {
          scope,
          campaignId: scope === 'campaign' ? sourceCampaignId : undefined,
          name: `Unrelated ${scope} ${i}`,
          ruleIdentity: `unrelated-${scope}-${i}`,
          sources: [],
          modifiers: [],
          stacksWithItself: false,
          detail: { kind: 'manual' },
        });
  });
  expect((await owner.mutation(api.characterMoves.resume, command)).state).toBe(
    'completed',
  );
  expect(
    (await owner.query(api.catalogCopies.list, { characterId })).some(
      (row) => row.copiedFrom === member,
    ),
  ).toBe(true);
  await move('large-unrelated-return', sourceCampaignId);
  await move('large-unrelated-new-discovery');
});

test('public Spell edits refresh only the staged definition while keeping the current browser fields', async () => {
  const { owner, characterId, campaigns, wizard, spell } = await fixture();
  const campaignId = campaigns[0];
  if (!campaignId) throw new Error('Missing source');
  const catalogEntryId = await spell(campaignId, 'Original spell');
  await owner.mutation(api.characterSheetSpells.record, {
    characterId,
    castingClassId: wizard._id,
    catalogEntryId,
    level: 3,
    operationId: 'record-edited-spell',
  });
  const command = { characterId, operationId: 'public-spell-edit' };
  let ready = await owner.mutation(api.characterMoves.start, {
    ...command,
    destinationCampaignId: campaigns[1],
  });
  for (let i = 0; i < 100 && ready.state !== 'ready'; i++)
    ready = await owner.mutation(api.characterMoves.resume, command);
  expect(ready.state).toBe('ready');
  await owner.mutation(api.catalogCopies.editDefinition, {
    characterId,
    catalogEntryId,
    name: 'Edited spell',
    detail: { kind: 'spell', levels: { wizard: 2 }, school: 'evocation' },
    operationId: 'edit-spell-fields',
  });
  expect(
    await owner.mutation(api.characterMoves.resume, command),
  ).toMatchObject({
    generation: ready.generation,
    prepared: ready.prepared,
    state: 'ready',
  });
  expect((await owner.mutation(api.characterMoves.resume, command)).state).toBe(
    'completed',
  );
  const browser = await owner.query(api.characterSheetSpells.browse, {
    characterId,
    castingClassId: wizard._id,
    search: 'Edited spell',
    paginationOpts: { cursor: null, numItems: 10 },
  });
  expect(browser.page).toMatchObject([
    {
      name: 'Edited spell',
      school: 'evocation',
      spellLevel: 2,
      recorded: true,
    },
  ]);
});

test.each(['campaign', 'global'] as const)(
  'the atomic %s Spell freshness limit preserves a small prepared move and its live militia state',
  async (scope) => {
    const { t, owner, characterId, campaigns, wizard, spell } = await fixture();
    const campaignId = campaigns[0];
    if (!campaignId) throw new Error('Missing source');
    const catalogEntryId = await spell(campaignId, 'Required retained spell');
    await owner.mutation(api.characterSheetSpells.record, {
      characterId,
      castingClassId: wizard._id,
      catalogEntryId,
      level: 3,
      operationId: 'record-before-freshness-limit',
    });
    const { acceptedCampaignSetup } =
      await import('../tests/rules/accepted-campaign');
    const setup = acceptedCampaignSetup(characterId);
    const sourceSheet = await owner.query(api.characterSheet.read, {
      characterId,
    });
    if (!sourceSheet) throw new Error('Missing sheet');
    const facts = sourceSheet.permanentCalculated;
    setup.state.militiaSnapshot.characters = [
      {
        characterId,
        level: facts.level,
        strength: facts.abilities.strength.score,
        dexterity: facts.abilities.dexterity.score,
        constitution: facts.abilities.constitution.score,
        intelligence: facts.abilities.intelligence.score,
        wisdom: facts.abilities.wisdom.score,
        charisma: facts.abilities.charisma.score,
        isActive: true,
      },
    ];
    const key = await owner.mutation(api.canonicalSetup.initialize, {
      campaignId,
      initializationId: 'freshness-limit-militia',
      setup,
    });
    const command = { characterId, operationId: 'bounded-spell-freshness' };
    let ready = await owner.mutation(api.characterMoves.start, {
      ...command,
      destinationCampaignId: campaigns[1],
    });
    for (let i = 0; i < 100 && ready.state !== 'ready'; i++)
      ready = await owner.mutation(api.characterMoves.resume, command);
    expect(ready.state).toBe('ready');
    expect(ready.total).toBeLessThan(300);
    const beforeSheet = await owner.query(api.characterSheet.read, {
      characterId,
    });
    const beforeLedger = await owner.query(api.canonicalLedger.read, {
      campaignId,
      militiaId: key.militiaId,
    });
    const catalogState = () =>
      t.run(async (ctx) => ({
        required: await ctx.db.get('catalogEntry', catalogEntryId),
        own: await ctx.db
          .query('catalogEntry')
          .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
          .take(8193),
      }));
    const beforeCatalog = await catalogState();
    for (let offset = 0; offset < 8200; offset += 2000)
      await t.run(async (ctx) => {
        for (let i = offset; i < Math.min(offset + 2000, 8200); i++)
          await ctx.db.insert('catalogEntry', {
            scope,
            campaignId: scope === 'campaign' ? campaignId : undefined,
            name: `Unrelated Spell ${i}`,
            ruleIdentity: `unrelated-limit-${i}`,
            sources: [],
            modifiers: [],
            stacksWithItself: false,
            detail: { kind: 'spell', levels: { 'unrelated-limit-list': 1 } },
          });
      });
    await expect(
      owner.mutation(api.characterMoves.resume, command),
    ).rejects.toThrow(
      'Keyed catalog discovery exceeds atomic publication limits',
    );
    expect(await owner.query(api.characterMoves.status, command)).toEqual(
      ready,
    );
    expect(await owner.query(api.characterSheet.read, { characterId })).toEqual(
      beforeSheet,
    );
    expect(
      await owner.query(api.canonicalLedger.read, {
        campaignId,
        militiaId: key.militiaId,
      }),
    ).toEqual(beforeLedger);
    expect(await catalogState()).toEqual(beforeCatalog);
  },
);
