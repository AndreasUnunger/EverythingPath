import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import {
  assessCatalogAdmission,
  buildAssessmentBinding,
  collectReferences,
} from '../../scripts/catalog/admission';
import { curationSchema } from '../../scripts/catalog/curation';
import { importCatalog } from '../../scripts/catalog/import';
import type { PreviewEntry } from '../../scripts/catalog/map';
import {
  sourceDescription,
  upstreamRecord,
} from '../../scripts/catalog/records';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import remaps from '../../scripts/catalog/reviewed-remaps.json';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import {
  bindSnapshotToCurrentNotices,
  findCommittedBatchOwnershipProblems,
} from './batch-ownership';
import { materializePinnedTree, readPinned } from './pinned-sources';

/**
 * Shared checks for #596, the Fighter launch subset: one class feature from
 * each class-ability batch, each with its own inventory (`scripts/catalog/
 * legal/class-abilities-<n>.json`), fixture and test. Run A curated #608,
 * #621, #622, #625, #636 and #637; run B adds #613 (Bonus Feats) and the
 * Fighter itself (`classes-596.test.ts`, which reuses these schemas).
 */

export const REVIEWER = 'Sol (AI curator) for the owner';
export const REVIEWED_ON = '2026-10-31';
/** Run B's review date (#613 and the Fighter). */
export const RUN_B_REVIEWED_ON = '2026-11-01';
export const FIGHTER = 'pf1/WLqBCT5DqmGAx8Wd';

export const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
export const strings = z.array(z.string());
export const pcgenRow = z.object({
  path: z.string(),
  line: z.number(),
  literalRow: z.string(),
  comparisonLineSha256: z.string(),
  comparisonFileSha256: z.string(),
  publicationTitle: z.string(),
  publicationAnchor: z.object({
    path: z.string(),
    line: z.number(),
    text: z.string(),
    sha256: z.string(),
  }),
  book: z.string(),
  completeDirectComparison: z.boolean(),
});
export const binding = z.object({
  contentFingerprint: z.string(),
  mappingFingerprint: z.string(),
  evidenceFingerprints: z.record(z.string(), z.string()),
  noticeFingerprints: z.record(z.string(), z.string()),
});
const candidateSchema = z.object({
  externalKey: z.string(),
  name: z.string(),
  kind: z.literal('classFeature'),
  grantingClass: z.literal(FIGHTER),
  disposition: z.enum(['admitted', 'held']),
  assessmentStatus: z.enum(['confirmed', 'unresolved']),
  source: z.object({
    repo: z.literal('pf1'),
    path: z.string(),
    sha256: z.string(),
  }),
  descriptionSha256: z.string(),
  citedSources: z.array(z.object({ book: z.string(), pages: z.string() })),
  requiredNotices: strings,
  evidenceId: z.string(),
  holdIds: strings,
  noticeHoldIds: strings,
  missingEvidence: z
    .record(
      z.string(),
      z.object({
        book: z.string().nullable(),
        reason: z.string(),
        items: strings,
      }),
    )
    .nullable(),
  comparison: pcgenRow,
  additionalComparisonLeads: z.array(pcgenRow),
  prdComparison: z.object({
    path: z.string(),
    pageSha256: z.string(),
    lines: z.array(
      z.object({ line: z.number(), text: z.string(), sha256: z.string() }),
    ),
  }),
  grantEvidence: z.object({
    pcgen: z.array(
      z.object({
        path: z.string(),
        line: z.number(),
        literalRow: z.string(),
        sha256: z.string(),
      }),
    ),
    foundry: z
      .object({ path: z.string(), lines: z.array(z.number()) })
      .nullable(),
  }),
  inheritedRuleNotices: z.array(z.object({ book: z.string() })),
  sourceFields: z.record(z.string(), z.unknown()),
  currentBinding: binding,
  mechanicsReview: z.object({
    descriptionText: z.string(),
    curationRecords: curationSchema.shape.records,
    classFeatureReview: z.object({
      level: z.number(),
      schedule: z.array(
        z.object({
          level: z.number(),
          value: z.union([z.number(), z.boolean()]),
        }),
      ),
      validatedThrough: z.literal(20),
    }),
    outstandingCalculations: z.array(
      z.object({ calculation: z.string(), owner: z.string() }),
    ),
  }),
});
const inventorySchema = z.object({
  ticket: z.string(),
  launchSubset: z.object({
    statement: z.string(),
    curatedKeys: strings,
    remainingAcceptance: strings,
  }),
  reviewedBy: z.literal(REVIEWER),
  reviewedOn: z.enum([REVIEWED_ON, RUN_B_REVIEWED_ON]),
  comparisonSources: z.object({
    pcgenFiles: z.array(z.object({ path: z.string(), sha256: z.string() })),
    prd: z.object({ path: z.string(), sha256: z.string() }),
  }),
  noticeRequirements: z.array(
    z.object({
      book: z.string(),
      holdId: z.null(),
      candidates: strings,
    }),
  ),
  counts: z.record(z.string(), z.number()),
  candidates: z.tuple([candidateSchema]),
});
const previewSchema = z.object({
  entries: z.tuple([importedCatalogEntrySchema]),
  closure: z.tuple([]),
});

/** One run A batch: its inventory, its single candidate and its fixture entry. */
function loadLaunchFeatureBatch(batch: number) {
  const inventoryPath = `scripts/catalog/legal/class-abilities-${batch}.json`;
  const inventory = inventorySchema.parse(
    JSON.parse(readFileSync(inventoryPath, 'utf8')),
  );
  const preview = previewSchema.parse(
    JSON.parse(
      readFileSync(
        `tests/fixtures/class-abilities-${batch}/preview.json`,
        'utf8',
      ),
    ),
  );
  const [candidate] = inventory.candidates;
  // The committed row is the full-corpus preview's own output; the binding
  // code reads it as imported, as cross-batch-bindings.ts does.
  const [entry] = preview.entries as unknown as [PreviewEntry];
  return { batch, inventoryPath, inventory, candidate, entry };
}

/**
 * The checks every run A batch shares: its inventory and launch-subset
 * statement, its pinned body against the PRD and PCGen rows it cites, a
 * re-extraction from the shared store, its gate outcome and binding, and its
 * own rows in the shared data.
 */
export function describeLaunchFeature({
  batch,
  name,
  disposition,
  reviewedOn = REVIEWED_ON,
}: {
  batch: number;
  name: string;
  disposition: 'admitted' | 'held';
  /** The batch's review date: run A's, unless given (run B). */
  reviewedOn?: string;
}) {
  const data = loadLaunchFeatureBatch(batch);
  const { inventory, candidate, entry, inventoryPath } = data;

  it(`records ${name} as the MVP launch subset of #${batch}, the rest remaining acceptance`, () => {
    expect(candidate.name).toBe(name);
    expect(inventory.reviewedOn).toBe(reviewedOn);
    expect(candidate.disposition).toBe(disposition);
    expect(inventory.ticket).toBe(
      `https://github.com/AndreasUnunger/EverythingPath/issues/${batch}`,
    );
    expect(inventory.launchSubset.statement).toMatch(
      new RegExp(`^MVP launch subset of #${batch}:`),
    );
    expect(inventory.launchSubset.curatedKeys).toEqual([candidate.externalKey]);
    expect(inventory.launchSubset.remainingAcceptance).toHaveLength(99);
    expect(inventory.launchSubset.remainingAcceptance).not.toContain(
      candidate.externalKey,
    );
    expect(inventory.counts).toMatchObject({
      total: 1,
      admitted: disposition === 'admitted' ? 1 : 0,
      held: disposition === 'held' ? 1 : 0,
      excluded: 0,
    });
    expect(candidate.evidenceId).toBe(
      `class-abilities-${batch}-${candidate.externalKey.split('/')[1]}`,
    );
    expect(candidate.noticeHoldIds).toEqual([]);
    for (const requirement of inventory.noticeRequirements)
      expect(requirement.candidates).toEqual([candidate.externalKey]);
    expect(inventory.noticeRequirements.map((row) => row.book)).toEqual(
      candidate.requiredNotices,
    );
    expect(candidate.mechanicsReview.classFeatureReview.schedule).toHaveLength(
      20,
    );
  });

  it(`pins ${name}'s complete body, checked records, PRD lines and PCGen rows in the shared store`, async () => {
    const bytes = await readPinned('pf1', candidate.source.path);
    expect(sha(bytes)).toBe(candidate.source.sha256);
    const raw = upstreamRecord.parse(parse(bytes));
    expect(`pf1/${raw._id}`).toBe(candidate.externalKey);
    expect(raw.name).toBe(name);
    expect(raw.system).toEqual(candidate.sourceFields);
    const description = sourceDescription(raw);
    expect(sha(description)).toBe(candidate.descriptionSha256);
    expect(description).toBe(candidate.mechanicsReview.descriptionText);
    expect(candidate.citedSources.map((row) => row.book)).toEqual(['PZO1110']);
    const records = candidate.mechanicsReview.curationRecords;
    expect(records[0]).toMatchObject({
      kind: 'description',
      target: 'description',
      text: description,
      textSha256: sha(description),
    });
    for (const record of records) {
      expect(record).toMatchObject({
        status: 'checked',
        diagnostics: [],
        reviewedBy: REVIEWER,
        reviewedOn,
      });
      expect(
        reviewedCuration.records.find(
          (current) =>
            current.externalKey === record.externalKey &&
            current.kind === record.kind &&
            current.target === record.target &&
            current.textSha256 === record.textSha256,
        ),
      ).toEqual(record);
    }
    // PCGen rows, each against the file hash the inventory records.
    const files = new Map(
      inventory.comparisonSources.pcgenFiles.map((row) => [
        row.path,
        row.sha256,
      ]),
    );
    for (const row of [
      candidate.comparison,
      ...candidate.additionalComparisonLeads,
    ]) {
      const text = await readPinned('pcgen', row.path);
      expect(sha(text)).toBe(files.get(row.path));
      expect(sha(text)).toBe(row.comparisonFileSha256);
      expect(text.split('\n')[row.line - 1]).toBe(row.literalRow);
      expect(sha(row.literalRow)).toBe(row.comparisonLineSha256);
      const anchor = await readPinned('pcgen', row.publicationAnchor.path);
      expect(anchor.split('\n')[row.publicationAnchor.line - 1]).toMatch(
        new RegExp(`^${row.publicationAnchor.text}(\t|$)`),
      );
      expect(row.publicationAnchor.text).toBe(
        `SOURCELONG:${row.publicationTitle}`,
      );
    }
    expect(candidate.comparison.book).toBe('PZO1110');
    const crb = await readPinned('pcgen', candidate.comparison.path);
    for (const row of candidate.grantEvidence.pcgen) {
      expect(row.path).toBe(candidate.comparison.path);
      expect(crb.split('\n')[row.line - 1]).toBe(row.literalRow);
      expect(sha(row.literalRow)).toBe(row.sha256);
    }
    // The PRD capture's Fighter page, by the manifest's hash.
    const page = await readPinned('prd', candidate.prdComparison.path);
    expect(sha(page)).toBe(candidate.prdComparison.pageSha256);
    expect(sha(page)).toBe(inventory.comparisonSources.prd.sha256);
    const manifest = z
      .object({
        pages: z.array(z.object({ file: z.string(), sha256: z.string() })),
      })
      .parse(JSON.parse(await readPinned('prd', 'manifest.json')));
    expect(
      manifest.pages.find((row) => row.file === candidate.prdComparison.path)
        ?.sha256,
    ).toBe(candidate.prdComparison.pageSha256);
    const lines = page.split('\n');
    for (const row of candidate.prdComparison.lines) {
      expect(lines[row.line - 1]).toBe(row.text);
      expect(sha(row.text)).toBe(row.sha256);
    }
    // The Fighter's own class association, where Foundry records one.
    const { foundry } = candidate.grantEvidence;
    if (foundry) {
      const fighter = (await readPinned('pf1', foundry.path)).split('\n');
      expect(fighter[foundry.lines[0]! - 1]?.trim()).toBe(
        `- level: ${candidate.mechanicsReview.classFeatureReview.level}`,
      );
      expect(fighter[foundry.lines[1]! - 1]?.trim()).toBe(
        `uuid: Compendium.pf1.class-abilities.Item.${candidate.externalKey.split('/')[1]}`,
      );
    }
  });

  it(`reextracts ${name} from the shared store and binds its ${disposition} assessment to current data`, async () => {
    const file = `pf1/${candidate.source.path}`;
    const tree = await materializePinnedTree([file], {
      sha256: { [file]: candidate.source.sha256 },
    });
    try {
      const artifact = await importCatalog({
        ...tree,
        remaps,
        curation: reviewedCuration,
        candidateKeys: [candidate.externalKey],
      });
      expect(artifact.curation.missing).toEqual([]);
      expect(artifact.curation.stale).toEqual([]);
      const [extracted] = artifact.catalog.entries;
      expect(artifact.catalog.entries).toHaveLength(1);
      expect(extracted).toEqual(entry);
      // Its closure is the entry alone: no other assessed body reaches it.
      expect(collectReferences(entry)).toEqual([]);
      const authoritative = {
        ...artifact,
        catalog: { ...artifact.catalog, entries: [entry] },
      };
      const gate = assessCatalogAdmission({
        artifact: authoritative,
        ...reviewedAdmission,
      });
      const assessment = reviewedAdmission.assessments.find(
        (row) => row.externalKey === candidate.externalKey,
      );
      expect(assessment).toMatchObject({
        status: candidate.assessmentStatus,
        requiredNotices: candidate.requiredNotices,
        reviewedBy: REVIEWER,
        reviewedOn,
        ...bindSnapshotToCurrentNotices(candidate.currentBinding),
      });
      expect(
        buildAssessmentBinding({
          artifact: authoritative,
          entry,
          requiredNotices: candidate.requiredNotices,
          evidenceIds: [candidate.evidenceId],
          ...reviewedAdmission,
        }),
      ).toEqual(bindSnapshotToCurrentNotices(candidate.currentBinding));
      expect(gate.failures).toEqual([]);
      if (disposition === 'admitted') {
        expect(gate.admitted.map((row) => row.externalKey)).toEqual([
          candidate.externalKey,
        ]);
        // A changed body invalidates the binding and is no longer admitted.
        const edited = assessCatalogAdmission({
          artifact: {
            ...authoritative,
            catalog: {
              ...authoritative.catalog,
              entries: [{ ...entry, description: `${entry.description} ` }],
            },
          },
          ...reviewedAdmission,
        });
        expect(edited.admitted).toEqual([]);
      } else {
        expect(gate.admitted).toEqual([]);
        expect(gate.held.map((row) => row.externalKey)).toEqual([
          candidate.externalKey,
        ]);
      }
    } finally {
      await tree.dispose();
    }
  });

  it(`keeps #${batch}'s own description record, assessment, evidence and holds as recorded`, () => {
    expect(findCommittedBatchOwnershipProblems(inventoryPath)).toEqual([]);
  });

  return data;
}

/** The rules text of a pinned body's paragraphs, as the reviewed Notes state it. */
export function bodyParagraphs(description: string) {
  return [...description.matchAll(/<p>(.*?)<\/p>/gs)].map(([, text]) =>
    (text ?? '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

/** The PRD line's rules text without its heading and markup. */
export function prdText(line: string) {
  return line
    .replace(/<[^>]+>/g, '')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&times;/g, '×')
    .replace(/\s+/g, ' ')
    .replace(/^[A-Za-z ()]+ \(Ex\): /, '')
    .trim();
}
