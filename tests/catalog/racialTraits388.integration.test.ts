/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { expect, test } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';
import type { CatalogReleaseStatus } from '../../src/lib/catalog/release-validators';
import { z } from 'zod';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import { outputSchema } from '../../src/lib/catalog/curation-output-schema';
import {
  modifierConditionSchema,
  modifierTargets,
  situationalNoteSchema,
} from '../../src/lib/character-sheet';
import { withSheetCatalog } from '../character-sheet-catalog';
import { heldTraits, preview } from '../fixtures/racial-traits-388/data';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';

const modules = import.meta.glob('../../convex/**/*.ts');
const byKey = new Map(
  [...preview.entries, ...preview.closure].map((row) => [row.externalKey, row]),
);
const AASIMAR = 'pf1/FHY3oIk5zSOFncJH';
const ARCHON = 'pf1-content/3haIOIRYDeFc1YZH';

/**
 * Character-scoped copies of the full-corpus preview's Aasimar race, its
 * standard Racial Traits (its reviewed ability score trait among them) and the
 * held Archon-Blooded heritage, with stable keys mapped to the inserted IDs.
 * No assessment or Catalog Release is constructed.
 */
// These bodies have no Catalog Entry ID conditions: accept only shared or
// local Situations, never imported external keys as stored references.
const localSituationSchema = z.union([
  z.string().min(1),
  z.strictObject({ local: z.string().min(1).max(4096) }),
]);
const localConditionSchema = modifierConditionSchema
  .pick({ situation: true, school: true })
  .extend({ situation: localSituationSchema.optional() })
  .strict();
const fixtureModifier = outputSchema.options[0].omit({ kind: true }).extend({
  target: z.enum(modifierTargets),
  condition: localConditionSchema.optional(),
});
const fixtureNote = situationalNoteSchema
  .safeExtend({
    situation: localSituationSchema.optional(),
    condition: localConditionSchema.optional(),
  })
  .strict();
function common(key: string) {
  const entry = importedCatalogEntrySchema.parse(byKey.get(key));
  return {
    entry,
    fields: {
      name: entry.name,
      ruleIdentity: entry.externalKey,
      stacksWithItself: false,
      sources: entry.sources,
      description: entry.description,
      modifiers: entry.modifiers.map((row) => fixtureModifier.parse(row)),
      ...(entry.situationalNotes
        ? {
            situationalNotes: entry.situationalNotes.map((note) =>
              fixtureNote.parse(note),
            ),
          }
        : {}),
    },
  };
}
function mapped(ids: Map<string, Id<'catalogEntry'>>) {
  return (ref: string) => {
    const found = ids.get(ref);
    if (!found) throw new Error(`Missing fixture ${ref}`);
    return found;
  };
}
function raceDefinition(key: string, ids: Map<string, Id<'catalogEntry'>>) {
  const { entry, fields } = common(key);
  if (entry.detail.kind !== 'race') throw new Error(`${key} is not a race`);
  return {
    ...fields,
    detail: {
      kind: 'race' as const,
      racialTraits: (entry.detail.racialTraits ?? []).map(mapped(ids)),
    },
  };
}
function traitDefinition(key: string, ids: Map<string, Id<'catalogEntry'>>) {
  const { entry, fields } = common(key);
  if (entry.detail.kind !== 'racialTrait')
    throw new Error(`${key} is not a racial trait`);
  return {
    ...fields,
    detail: {
      kind: 'racialTrait' as const,
      raceEntryIds: (entry.detail.raceKeys ?? []).map(mapped(ids)),
      replaces: (entry.detail.replaces ?? []).map(mapped(ids)),
    },
  };
}

test('an isolated Aasimar sheet takes the held Archon-Blooded heritage in place of the ability score trait and keeps access to the campaign', async () => {
  const t = convexTest(schema, modules);
  const { campaignId, otherCampaignId } = await t.run(async (ctx) => {
    for (const [user, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `racial388|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed racial traits #388',
      description: '',
      organizationId: 'org',
      ownerId: 'racial388|owner',
      e2eFixture: {
        namespace: 'racial-traits-388',
        version: 1,
        workerKey: '0',
        caseKey: 'reviewed',
        campaignKey: 'reviewed',
      },
    });
    const otherCampaignId = await ctx.db.insert('campaign', {
      name: 'Other isolated campaign',
      description: '',
      organizationId: 'org',
      ownerId: 'racial388|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'racial388|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'racial388|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'racial388|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed racial trait preview',
    kind: 'pc',
    operationId: 'create-racial-traits-388',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    operationId: 'base-scores',
  });
  expect(
    heldTraits.find((row) => row.externalKey === ARCHON)?.disposition,
  ).toBe('held');
  const race = byKey.get(AASIMAR);
  if (race?.detail.kind !== 'race') throw new Error('Missing Aasimar');
  const keys = [AASIMAR, ...(race.detail.racialTraits ?? []), ARCHON];
  const ids = await t
    .run(async (ctx) => {
      const ids = new Map<string, Id<'catalogEntry'>>();
      // Insert placeholders first so references can be mapped, then fill them.
      for (const key of keys)
        ids.set(
          key,
          await ctx.db.insert('catalogEntry', {
            scope: 'character',
            characterId,
            name: key,
            ruleIdentity: key,
            stacksWithItself: false,
            modifiers: [],
            sources: [],
            detail:
              key === AASIMAR
                ? { kind: 'race' as const, racialTraits: [] }
                : {
                    kind: 'racialTrait' as const,
                    raceEntryIds: [],
                    replaces: [],
                  },
          }),
        );
      await ctx.db.replace('catalogEntry', ids.get(AASIMAR)!, {
        scope: 'character',
        characterId,
        ...raceDefinition(AASIMAR, ids),
      });
      for (const key of keys.filter((key) => key !== AASIMAR))
        await ctx.db.replace('catalogEntry', ids.get(key)!, {
          scope: 'character',
          characterId,
          ...traitDefinition(key, ids),
        });
      return Object.fromEntries(ids);
    })
    .then((rows) => new Map(Object.entries(rows)));
  const read = async () => {
    const saved = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    if (!saved) throw new Error('Missing saved sheet');
    expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
      saved.calculated.derivedStatistics,
    );
    return saved;
  };
  const scores = (saved: Awaited<ReturnType<typeof read>>) =>
    Object.fromEntries(
      (['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((ability) => [
        ability,
        saved.calculated.breakdowns[`ability.${ability}`].total,
      ]),
    );
  await member.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: ids.get(AASIMAR)!,
    operationId: 'race',
  });
  // The aasimar's reviewed ability score trait: +2 Wis, +2 Cha.
  const aasimar = {
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 12,
    cha: 12,
  };
  expect(scores(await read())).toEqual(aasimar);
  await member.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: ids.get(ARCHON)!,
    selected: true,
    operationId: 'archon',
  });
  // Archon-Blooded replaces it: +2 Con, +2 Wis. Its readable Note is saved.
  const archon = await read();
  expect(scores(archon)).toEqual({
    str: 10,
    dex: 10,
    con: 12,
    int: 10,
    wis: 12,
    cha: 10,
  });
  expect(
    archon.catalogEntries
      .find((row) => row._id === ids.get(ARCHON))
      ?.situationalNotes?.map((note) => note.text)
      .join(' '),
  ).toContain('continual flame');
  // Turning the heritage off brings the ability score trait back.
  await member.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: ids.get(ARCHON)!,
    selected: false,
    operationId: 'archon-off',
  });
  expect(scores(await read())).toEqual(aasimar);
  // Outsiders, anonymous callers and another campaign's entries are refused.
  const before = await read();
  await expect(
    outsider.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: ids.get(ARCHON)!,
      selected: true,
      operationId: 'outsider',
    }),
  ).rejects.toThrow();
  await expect(
    t.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: ids.get(ARCHON)!,
      selected: true,
      operationId: 'anonymous',
    }),
  ).rejects.toThrow();
  const foreign = await t.run(async (ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId: otherCampaignId,
      ...traitDefinition(ARCHON, ids),
    }),
  );
  await expect(
    member.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: foreign,
      selected: true,
      operationId: 'foreign',
    }),
  ).rejects.toThrow();
  const after = await read();
  expect(after.entries).toEqual(before.entries);
  expect(after.revision).toBe(before.revision);
}, 60_000);

test('an isolated release of three held racial traits round-trips and publishes none of them', async () => {
  const { materializePinnedTree } = await import('./pinned-sources');
  const { importCatalog } = await import('../../scripts/catalog/import');
  const { reviewedCuration } =
    await import('../../scripts/catalog/reviewed-curation-data');
  const { createCatalogRelease, serializeCatalogRelease } =
    await import('../../scripts/catalog/release');
  const { validateCatalogReleaseArtifact } =
    await import('../../src/lib/catalog/release-schema');
  const { catalogRuntimeCompatibility } =
    await import('../../src/lib/catalog/runtime-compatibility');
  const { releaseLegalInputsSchema } =
    await import('../../src/lib/catalog/release-legal-inputs');
  const { computeFingerprint } =
    await import('../../scripts/catalog/admission');
  const { reviewedAdmission, legalResources } =
    await import('../../src/lib/catalog/reviewed-data');
  const { default: remaps } =
    await import('../../scripts/catalog/reviewed-remaps.json');
  // Standard traits with no description links or replacements. (#328 S4-A
  // admitted Stonecunning (Dwarf); Languages (Vanara) takes its place.)
  const controls = heldTraits.filter((row) =>
    ['Climber', 'Kasatha', 'Languages (Vanara)'].includes(row.name),
  );
  expect(controls).toHaveLength(3);
  const files = controls.map((row) => `${row.source.repo}/${row.source.path}`);
  const tree = await materializePinnedTree(files, {
    sha256: Object.fromEntries(
      controls.map((row) => [
        `${row.source.repo}/${row.source.path}`,
        row.source.sha256,
      ]),
    ),
  });
  try {
    const artifact = await importCatalog({
      ...tree,
      remaps,
      curation: reviewedCuration,
      candidateKeys: controls.map((row) => row.externalKey),
    });
    expect(artifact.curation.missing).toEqual([]);
    const release = await createCatalogRelease({
      artifact,
      attribution: reviewedAdmission,
      legalResources,
      releaseNumber: 388,
      compatibility: catalogRuntimeCompatibility,
      inputValues: {
        remaps,
        curation: reviewedCuration,
        localData: [],
        parsers: 'isolated-racial-traits-388-proof',
        sanitizers: 'isolated-racial-traits-388-proof',
        ruleResources: [],
        upstreamVerification: { status: 'unverified' },
      },
    });
    const transported = await validateCatalogReleaseArtifact(
      JSON.parse(serializeCatalogRelease(release)),
    );
    expect(computeFingerprint(transported)).toBe(computeFingerprint(release));
    const rows = transported.batches.flat();
    for (const row of controls)
      expect(
        rows.some(
          (published) =>
            published.kind === 'definition' &&
            published.key === row.externalKey,
        ),
        row.name,
      ).toBe(false);
    const t = convexTest(schema, modules);
    const writeBatch = makeFunctionReference<
      'mutation',
      { releaseNumber: number; batchIndex: number; rows: unknown },
      CatalogReleaseStatus
    >('catalogRelease:writeBatch');
    await t.mutation(internal.catalogRelease.begin, {
      manifest: transported.manifest,
    });
    for (const [batchIndex, batch] of transported.batches.entries())
      await t.mutation(writeBatch, {
        releaseNumber: 388,
        batchIndex,
        rows: batch,
      });
    await t.mutation(internal.catalogRelease.finalize, { releaseNumber: 388 });
    expect(await t.query(api.catalogRelease.legalInputs, {})).toBeNull();
    // This control exists only in convex-test's isolated database. No
    // deployment, production catalog or held body is published by the test.
    await t.run(async (ctx) => {
      const releaseId = (
        await ctx.db
          .query('catalogRelease')
          .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', 388))
          .unique()
      )?._id;
      if (!releaseId) throw new Error('Missing isolated prepared release');
      await ctx.db.insert('catalogReleaseControl', {
        key: 'global',
        releaseNumber: 388,
        releaseId,
        schemaIdentity: catalogRuntimeCompatibility.schema,
        calculationIdentity: catalogRuntimeCompatibility.calculation,
        isFixtureOnly: true,
      });
    });
    const legal = releaseLegalInputsSchema.parse(
      await t.query(api.catalogRelease.legalInputs, {}),
    );
    for (const row of controls)
      for (const code of row.requiredNotices.filter(
        (code) => code !== 'PZO1110',
      ))
        expect(legal.requiredNotices, `${row.name} ${code}`).not.toContain(
          code,
        );
    expect(computeFingerprint(legal.registry)).toBe(
      computeFingerprint(reviewedAdmission.registry),
    );
    expect(computeFingerprint(legal.resources)).toBe(
      computeFingerprint(legalResources),
    );
  } finally {
    await tree.dispose();
  }
}, 90_000);
