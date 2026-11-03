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
import { heldTraits, preview } from '../fixtures/racial-traits-398/data';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';

const modules = import.meta.glob('../../convex/**/*.ts');
const byKey = new Map(
  [...preview.entries, ...preview.closure].map((row) => [row.externalKey, row]),
);
const SKINWALKER = 'pf1/apWl6JIJ8U8p0azq';
// The skinwalker's ability score trait (the importer's local trait that "Base
// Statistics" resolves to once a heritage's ability line is curated), this
// batch's Animal-Minded, and this batch's Werewolf-Kin (Witchwolf), which
// replaces the ability score trait.
const ABILITY = 'local/race-ability-scores/pf1/apWl6JIJ8U8p0azq';
const MINDED = 'pf1-content/bPkht5w4AKauP8Ip';
const WITCHWOLF = 'pf1-content/calSa82WwxgUFwXr';

/**
 * Character-scoped copies of the full-corpus preview's skinwalker ability
 * score trait and two held records of this batch, with stable keys mapped to
 * the inserted IDs. The sheet uses a character-scoped race with the pinned
 * Skinwalker identity that grants the two standard traits. No assessment or
 * Catalog Release is constructed.
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

test('an isolated skinwalker sheet takes the held Werewolf-Kin (Witchwolf) in place of the skinwalker ability score trait it replaces, and keeps access to the campaign', async () => {
  const t = convexTest(schema, modules);
  const { campaignId, otherCampaignId } = await t.run(async (ctx) => {
    for (const [user, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `racial398|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed racial traits #398',
      description: '',
      organizationId: 'org',
      ownerId: 'racial398|owner',
      e2eFixture: {
        namespace: 'racial-traits-398',
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
      ownerId: 'racial398|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'racial398|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'racial398|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'racial398|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed racial trait preview',
    kind: 'pc',
    operationId: 'create-racial-traits-398',
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
  const alternates = [WITCHWOLF];
  const granted = [ABILITY, MINDED];
  for (const key of [...alternates, MINDED])
    expect(heldTraits.find((row) => row.externalKey === key)?.disposition).toBe(
      'held',
    );
  const traits = [...granted, ...alternates];
  const ids = await t
    .run(async (ctx) => {
      const ids = new Map<string, Id<'catalogEntry'>>();
      // Insert placeholders first so references can be mapped, then fill them.
      for (const key of traits)
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
            detail: {
              kind: 'racialTrait' as const,
              raceEntryIds: [],
              replaces: [],
            },
          }),
        );
      // The pinned Skinwalker identity, granting the two standard traits.
      ids.set(
        SKINWALKER,
        await ctx.db.insert('catalogEntry', {
          scope: 'character',
          characterId,
          name: 'Skinwalker (identity only)',
          ruleIdentity: SKINWALKER,
          stacksWithItself: false,
          modifiers: [],
          sources: [],
          detail: {
            kind: 'race' as const,
            racialTraits: granted.map((key) => ids.get(key)!),
          },
        }),
      );
      for (const key of traits)
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
  const totals = (saved: Awaited<ReturnType<typeof read>>) =>
    Object.fromEntries(
      (
        [
          'ability.con',
          'ability.int',
          'ability.wis',
          'skill.han',
          'skill.sen',
        ] as const
      ).map((target) => [target, saved.calculated.breakdowns[target].total]),
    );
  const notes = (saved: Awaited<ReturnType<typeof read>>, key: string) =>
    saved.catalogEntries
      .find((row) => row._id === ids.get(key))
      ?.situationalNotes?.map((note) => note.text)
      .join(' ') ?? '';
  await member.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: ids.get(SKINWALKER)!,
    operationId: 'race',
  });
  // The skinwalker's +2 Wisdom and -2 Intelligence; Animal-Minded's +2
  // racial Handle Animal; Sense Motive adds the Wisdom modifier (+1).
  const skinwalker = await read();
  const base = totals(skinwalker);
  expect(base).toMatchObject({
    'ability.con': 10,
    'ability.int': 8,
    'ability.wis': 12,
    'skill.han': 2,
    'skill.sen': 1,
  });
  expect(notes(skinwalker, MINDED)).toContain('wild empathy');
  const turn = async (key: string, selected: boolean) =>
    member.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: ids.get(key)!,
      selected,
      operationId: `${key}-${selected}`,
    });
  for (const key of alternates) await turn(key, true);
  // Werewolf-Kin: the curated ability line (+2 Con, -2 Int) replaces the
  // skinwalker's ability score trait (+2 Wis, -2 Int), so Wisdom falls to 10
  // and Sense Motive loses its +1 with it.
  const wolf = await read();
  expect(totals(wolf)).toEqual({
    ...base,
    'ability.con': base['ability.con']! + 2,
    'ability.wis': base['ability.wis']! - 2,
    'skill.sen': base['skill.sen']! - 1,
  });
  expect(notes(wolf, WITCHWOLF)).toContain('Ancestry werewolf');
  // Turning it off brings the replaced trait back.
  for (const key of alternates) await turn(key, false);
  const restored = await read();
  expect(totals(restored)).toEqual(base);
  // Outsiders, anonymous callers and another campaign's entries are refused.
  const before = await read();
  await expect(
    outsider.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: ids.get(WITCHWOLF)!,
      selected: true,
      operationId: 'outsider',
    }),
  ).rejects.toThrow();
  await expect(
    t.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: ids.get(WITCHWOLF)!,
      selected: true,
      operationId: 'anonymous',
    }),
  ).rejects.toThrow();
  const foreign = await t.run(async (ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId: otherCampaignId,
      ...traitDefinition(WITCHWOLF, ids),
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
  // Standard traits with no description links or replacements.
  const controls = heldTraits.filter((row) =>
    [
      'Languages (Trox)',
      'Slow Speed (Vine Leshy)',
      'Darkvision (Aphorite)',
    ].includes(row.name),
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
      releaseNumber: 398,
      compatibility: catalogRuntimeCompatibility,
      inputValues: {
        remaps,
        curation: reviewedCuration,
        localData: [],
        parsers: 'isolated-racial-traits-398-proof',
        sanitizers: 'isolated-racial-traits-398-proof',
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
        releaseNumber: 398,
        batchIndex,
        rows: batch,
      });
    await t.mutation(internal.catalogRelease.finalize, { releaseNumber: 398 });
    expect(await t.query(api.catalogRelease.legalInputs, {})).toBeNull();
    // This control exists only in convex-test's isolated database. No
    // deployment, production catalog or held body is published by the test.
    await t.run(async (ctx) => {
      const releaseId = (
        await ctx.db
          .query('catalogRelease')
          .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', 398))
          .unique()
      )?._id;
      if (!releaseId) throw new Error('Missing isolated prepared release');
      await ctx.db.insert('catalogReleaseControl', {
        key: 'global',
        releaseNumber: 398,
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
