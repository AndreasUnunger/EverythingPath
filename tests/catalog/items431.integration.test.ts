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
import { assessedItems, preview } from '../fixtures/items-431/data';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';

const modules = import.meta.glob('../../convex/**/*.ts');
const byKey = new Map(preview.entries.map((row) => [row.externalKey, row]));
const MONKS_OUTFIT = 'pf1/GFOu4GXWqb6MJQQJ';
const EXPLORERS_OUTFIT = 'pf1/LZLwdGasEUnMplnc';
const BRACERS = 'pf1/IjptxC4fEDAhYrZT';
const PERFECTION_BELT = 'pf1/MvIylLVVvfr3kcW2';
const TIN_CAP = 'pf1/KxHYgsJaMhsLI2Xu';
const ELVENKIND_CLOAK = 'pf1/HSF0j88RR9JeTaJi';
const BALL = 'pf1/KKVx0R4EH17PZonh';
const BOARD_GAME = 'pf1/Mehr2G7J5uVsOem9';

// These bodies have no Catalog Entry ID conditions: accept only shared or
// local Situations, never imported external keys as stored references.
const localSituationSchema = z.union([
  z.string().min(1),
  z.strictObject({ local: z.string().min(1).max(4096) }),
]);
const localConditionSchema = modifierConditionSchema
  .pick({ situation: true })
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
/**
 * A character-scoped copy of the full-corpus preview's item: its imported
 * Modifiers, Notes and armor block, unchanged. No assessment or Catalog
 * Release is constructed.
 */
function itemDefinition(key: string) {
  const entry = importedCatalogEntrySchema.parse(byKey.get(key));
  if (entry.detail.kind !== 'item') throw new Error(`${key} is not an item`);
  const armor = entry.detail.armor;
  return {
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
    detail: {
      kind: 'item' as const,
      consumable: entry.detail.consumable,
      ...(armor
        ? {
            armor: {
              slot: armor.slot,
              category: armor.category as never,
              bonus: armor.bonus,
              maxDex: armor.maxDex,
              armorCheckPenalty: armor.armorCheckPenalty,
              asf: armor.asf,
            },
          }
        : {}),
    },
  };
}

test('an isolated sheet stores the Core Rulebook outfits and the bracers without an armor block (#762), wears held items without one, takes off the tin cap, and keeps access to the campaign', async () => {
  const t = convexTest(schema, modules);
  const { campaignId, otherCampaignId } = await t.run(async (ctx) => {
    for (const [user, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `items431|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed items #431',
      description: '',
      organizationId: 'org',
      ownerId: 'items431|owner',
      e2eFixture: {
        namespace: 'items-431',
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
      ownerId: 'items431|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'items431|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'items431|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'items431|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed items preview',
    kind: 'pc',
    operationId: 'create-items-431',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: {
      strength: 10,
      dexterity: 14,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    operationId: 'base-scores',
  });
  // #762: the two outfits and the bracers import no armor block, so the stored entry schema
  // accepts them (the release path: armor-mapping.integration.test.ts).
  for (const key of [MONKS_OUTFIT, EXPLORERS_OUTFIT, BRACERS]) {
    expect(byKey.get(key)?.detail, key).not.toHaveProperty('armor');
    await t.run((ctx) =>
      ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...itemDefinition(key),
      }),
    );
  }
  const keys = [PERFECTION_BELT, TIN_CAP, ELVENKIND_CLOAK];
  expect(
    [MONKS_OUTFIT, EXPLORERS_OUTFIT, ...keys].map(
      (key) =>
        assessedItems.find((row) => row.externalKey === key)?.disposition,
    ),
  ).toEqual(['held', 'held', 'held', 'held', 'held']);
  const ids = new Map<string, Id<'catalogEntry'>>();
  for (const key of keys)
    ids.set(
      key,
      await t.run((ctx) =>
        ctx.db.insert('catalogEntry', {
          scope: 'character',
          characterId,
          ...itemDefinition(key),
        }),
      ),
    );
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
  const totals = (saved: Awaited<ReturnType<typeof read>>) => ({
    strength: saved.calculated.breakdowns['ability.str'].total,
    dexterity: saved.calculated.breakdowns['ability.dex'].total,
    constitution: saved.calculated.breakdowns['ability.con'].total,
    wisdom: saved.calculated.breakdowns['ability.wis'].total,
    ac: saved.calculated.derivedStatistics.ac.total,
    fortitude: saved.calculated.derivedStatistics.fortitude.total,
    reflex: saved.calculated.derivedStatistics.reflex.total,
    will: saved.calculated.derivedStatistics.will.total,
    stealth: saved.calculated.breakdowns['skill.ste'].total,
  });
  const base = totals(await read());
  expect(base).toMatchObject({
    strength: 10,
    dexterity: 14,
    constitution: 10,
    wisdom: 10,
    ac: 12,
    fortitude: 0,
    reflex: 2,
    will: 0,
  });
  // The held items worn: Strength, Dexterity and Constitution +4
  // enhancement (belt), Wisdom −2 (the tin cap's penalty, which the reviewed
  // record supplies), and no Stealth bonus from the cloak until its hood is
  // drawn up (its raw +5 imports as 0).
  const entryIds = new Map<string, Id<'characterSheetEntry'>>();
  for (const key of keys)
    entryIds.set(
      key,
      await member.mutation(api.characterSheet.selectEntry, {
        ...scope,
        catalogEntryId: ids.get(key)!,
        operationId: `wear-${key}`,
      }),
    );
  const worn = await read();
  expect(totals(worn)).toEqual({
    strength: 14,
    dexterity: 18,
    constitution: 14,
    wisdom: 8,
    ac: 14,
    fortitude: 2,
    reflex: 4,
    will: -1,
    stealth: base.stealth + 2,
  });
  const capNotes =
    worn.catalogEntries
      .find((row) => row._id === ids.get(TIN_CAP))
      ?.situationalNotes?.map((note) => note.text)
      .join(' ') ?? '';
  expect(capNotes).toContain('always attempt saving throws');
  // Taking the tin cap off removes its −2 to Wisdom.
  await member.mutation(api.characterSheet.editSheetEntry, {
    ...scope,
    entryId: entryIds.get(TIN_CAP)!,
    active: false,
    operationId: 'remove-tin-cap',
  });
  expect(totals(await read())).toMatchObject({ wisdom: 10, will: 0 });
  // Outsiders, anonymous callers and another campaign's entries are refused.
  const before = await read();
  await expect(
    outsider.mutation(api.characterSheet.editSheetEntry, {
      ...scope,
      entryId: entryIds.get(TIN_CAP)!,
      active: true,
      operationId: 'outsider',
    }),
  ).rejects.toThrow();
  await expect(
    t.mutation(api.characterSheet.editSheetEntry, {
      ...scope,
      entryId: entryIds.get(TIN_CAP)!,
      active: true,
      operationId: 'anonymous',
    }),
  ).rejects.toThrow();
  const foreign = await t.run(async (ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId: otherCampaignId,
      ...itemDefinition(TIN_CAP),
    }),
  );
  await expect(
    member.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: foreign,
      operationId: 'foreign',
    }),
  ).rejects.toThrow();
  const after = await read();
  expect(after.entries).toEqual(before.entries);
  expect(after.revision).toBe(before.revision);
}, 60_000);

test('an isolated release holds the monk’s and explorer’s outfits on #762 and publishes none of the held items', async () => {
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
  const { computeFingerprint, assessCatalogAdmission } =
    await import('../../scripts/catalog/admission');
  const { reviewedAdmission, legalResources } =
    await import('../../src/lib/catalog/reviewed-data');
  const { default: remaps } =
    await import('../../scripts/catalog/reviewed-remaps.json');
  // The two outfits and two other held items, none with description links.
  const rows = assessedItems.filter((row) =>
    [MONKS_OUTFIT, EXPLORERS_OUTFIT, BALL, BOARD_GAME].includes(
      row.externalKey,
    ),
  );
  expect(rows).toHaveLength(4);
  for (const row of rows) expect(row.linkedContentReview).toEqual([]);
  const files = rows.map((row) => `${row.source.repo}/${row.source.path}`);
  const tree = await materializePinnedTree(files, {
    sha256: Object.fromEntries(
      rows.map((row) => [
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
      candidateKeys: rows.map((row) => row.externalKey),
    });
    expect(artifact.curation.missing).toEqual([]);
    // The release path's admission gate holds the outfits on their #762
    // importer-gap holds, whatever their complete attribution evidence.
    const gate = assessCatalogAdmission({ artifact, ...reviewedAdmission });
    expect(gate.admitted).toEqual([]);
    for (const key of [MONKS_OUTFIT, EXPLORERS_OUTFIT])
      expect(gate.held.find((row) => row.externalKey === key)?.reason).toMatch(
        new RegExp(
          `^items-431-importer-gap-762-${key.split('/')[1]}: held only on importer gap #762`,
        ),
      );
    const release = await createCatalogRelease({
      artifact,
      attribution: reviewedAdmission,
      legalResources,
      releaseNumber: 431,
      compatibility: catalogRuntimeCompatibility,
      inputValues: {
        remaps,
        curation: reviewedCuration,
        localData: [],
        parsers: 'isolated-items-431-proof',
        sanitizers: 'isolated-items-431-proof',
        ruleResources: [],
        upstreamVerification: { status: 'unverified' },
      },
    });
    const transported = await validateCatalogReleaseArtifact(
      JSON.parse(serializeCatalogRelease(release)),
    );
    expect(computeFingerprint(transported)).toBe(computeFingerprint(release));
    const published = transported.batches.flat();
    for (const row of rows)
      expect(
        published.some(
          (candidate) =>
            candidate.kind === 'definition' &&
            candidate.key === row.externalKey,
        ),
        row.name,
      ).toBe(false);
    expect(
      published.find((row) => row.kind === 'report' && row.key === 'holds')
        ?.payload,
    ).toMatchObject({ held: 4 });
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
        releaseNumber: 431,
        batchIndex,
        rows: batch,
      });
    await t.mutation(internal.catalogRelease.finalize, { releaseNumber: 431 });
    // No held item's notice is required: the release's legal rows list none.
    // No deployment or production catalog is touched by the test.
    expect(
      published.find(
        (row) => row.kind === 'legal' && row.key === 'requiredNotices',
      )?.payload,
    ).toEqual([]);
  } finally {
    await tree.dispose();
  }
}, 90_000);
