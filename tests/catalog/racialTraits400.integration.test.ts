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
import { heldTraits, preview } from '../fixtures/racial-traits-400/data';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';

const modules = import.meta.glob('../../convex/**/*.ts');
const byKey = new Map(
  [...preview.entries, ...preview.closure].map((row) => [row.externalKey, row]),
);
const TIEFLING = 'pf1/nVjKDLZSRONzYm8f';
// The tiefling's ability score trait (the importer's local trait that "Base
// Statistics" resolves to once a heritage's ability line is curated), the
// tiefling's Skilled (#389), this batch's Qlippoth-Spawn (the Motherless),
// which replaces the ability score trait, and this batch's Skilled (Tiefling -
// the Motherless), which replaces Skilled by name.
const ABILITY = 'local/race-ability-scores/pf1/nVjKDLZSRONzYm8f';
const SKILLED = 'pf1-content/AKuDJrwJUZULsJcS';
const QLIPPOTH = 'pf1-content/iWZjiKTQnGS5XnB0';
const MOTHERLESS = 'pf1-content/iMdXJ73UwSIDDJdk';

/**
 * Character-scoped copies of the full-corpus preview's tiefling ability score
 * trait, the tiefling's Skilled and two held records of this batch, with
 * stable keys mapped to the inserted IDs. The sheet uses a character-scoped
 * race with the pinned Tiefling identity that grants the two standard traits.
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

test('an isolated tiefling sheet takes the held Qlippoth-Spawn (the Motherless) in place of the tiefling ability score trait and the Motherless Skilled in place of Skilled, and keeps access to the campaign', async () => {
  const t = convexTest(schema, modules);
  const { campaignId, otherCampaignId } = await t.run(async (ctx) => {
    for (const [user, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `racial400|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed racial traits #400',
      description: '',
      organizationId: 'org',
      ownerId: 'racial400|owner',
      e2eFixture: {
        namespace: 'racial-traits-400',
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
      ownerId: 'racial400|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'racial400|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'racial400|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'racial400|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed racial trait preview',
    kind: 'pc',
    operationId: 'create-racial-traits-400',
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
  const alternates = [QLIPPOTH, MOTHERLESS];
  const granted = [ABILITY, SKILLED];
  for (const key of alternates)
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
      // The pinned Tiefling identity, granting the two standard traits.
      ids.set(
        TIEFLING,
        await ctx.db.insert('catalogEntry', {
          scope: 'character',
          characterId,
          name: 'Tiefling (identity only)',
          ruleIdentity: TIEFLING,
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
          'ability.str',
          'ability.dex',
          'ability.int',
          'ability.wis',
          'ability.cha',
          'skill.blf',
          'skill.ste',
          'skill.esc',
          'skill.sur',
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
    catalogEntryId: ids.get(TIEFLING)!,
    operationId: 'race',
  });
  // The tiefling's +2 Dexterity, +2 Intelligence and -2 Charisma; Skilled's
  // +2 racial Bluff and Stealth. Skills add the ability modifier.
  const tiefling = await read();
  const base = totals(tiefling);
  expect(base).toEqual({
    'ability.str': 10,
    'ability.dex': 12,
    'ability.int': 12,
    'ability.wis': 10,
    'ability.cha': 8,
    'skill.blf': 1,
    'skill.ste': 3,
    'skill.esc': 1,
    'skill.sur': 0,
  });
  const turn = async (key: string, selected: boolean) =>
    member.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: ids.get(key)!,
      selected,
      operationId: `${key}-${selected}`,
    });
  // Qlippoth-Spawn (the Motherless): the curated ability line (+2 Str, +2 Wis,
  // -2 Int) replaces the tiefling's (+2 Dex, +2 Int, -2 Cha), and the skills
  // follow their abilities.
  await turn(QLIPPOTH, true);
  const qlippoth = await read();
  expect(totals(qlippoth)).toEqual({
    'ability.str': 12,
    'ability.dex': 10,
    'ability.int': 8,
    'ability.wis': 12,
    'ability.cha': 10,
    'skill.blf': 2,
    'skill.ste': 2,
    'skill.esc': 0,
    'skill.sur': 1,
  });
  expect(notes(qlippoth, QLIPPOTH)).toContain('Ancestry Qlippoth');
  // The Motherless Skilled replaces Skilled: Bluff and Stealth lose their +2
  // racial bonus and Escape Artist and Survival gain one.
  await turn(MOTHERLESS, true);
  const motherless = await read();
  expect(totals(motherless)).toEqual({
    ...totals(qlippoth),
    'skill.blf': 0,
    'skill.ste': 0,
    'skill.esc': 2,
    'skill.sur': 3,
  });
  // Turning them off brings the replaced traits back.
  for (const key of alternates) await turn(key, false);
  const restored = await read();
  expect(totals(restored)).toEqual(base);
  // Outsiders, anonymous callers and another campaign's entries are refused.
  const before = await read();
  await expect(
    outsider.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: ids.get(QLIPPOTH)!,
      selected: true,
      operationId: 'outsider',
    }),
  ).rejects.toThrow();
  await expect(
    t.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: ids.get(QLIPPOTH)!,
      selected: true,
      operationId: 'anonymous',
    }),
  ).rejects.toThrow();
  const foreign = await t.run(async (ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId: otherCampaignId,
      ...traitDefinition(QLIPPOTH, ids),
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
      'Languages (Grippli)',
      'Slow Speed (Ratfolk)',
      'Darkvision (Syrinx)',
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
      releaseNumber: 400,
      compatibility: catalogRuntimeCompatibility,
      inputValues: {
        remaps,
        curation: reviewedCuration,
        localData: [],
        parsers: 'isolated-racial-traits-400-proof',
        sanitizers: 'isolated-racial-traits-400-proof',
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
        releaseNumber: 400,
        batchIndex,
        rows: batch,
      });
    await t.mutation(internal.catalogRelease.finalize, { releaseNumber: 400 });
    expect(await t.query(api.catalogRelease.legalInputs, {})).toBeNull();
    // This control exists only in convex-test's isolated database. No
    // deployment, production catalog or held body is published by the test.
    await t.run(async (ctx) => {
      const releaseId = (
        await ctx.db
          .query('catalogRelease')
          .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', 400))
          .unique()
      )?._id;
      if (!releaseId) throw new Error('Missing isolated prepared release');
      await ctx.db.insert('catalogReleaseControl', {
        key: 'global',
        releaseNumber: 400,
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
