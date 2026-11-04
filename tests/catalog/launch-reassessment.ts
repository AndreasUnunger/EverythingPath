import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from 'vitest';
import { z } from 'zod';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';

// The in-place launch re-assessment of a spell batch's launch rows (#735
// S-03), recorded first by #536 whole-content wave 1 and reused by wave 2
// (#544 and #533).
const strings = z.array(z.string());

export const launchReviewSchema = z.object({
  run: z.string(),
  reviewedBy: z.string(),
  reviewedOn: z.string(),
  outcome: z.string(),
  pcgen: z.object({
    path: z.string(),
    line: z.number(),
    literalRow: z.string(),
    lineSha256: z.string(),
    fileSha256: z.string(),
    wordDifferences: z.array(
      z.object({ pinned: z.string(), pcgen: z.string() }),
    ),
    textMatches: z.boolean(),
    baseRow: z.object({
      line: z.number(),
      literalRow: z.string(),
      lineSha256: z.string(),
    }),
  }),
  notes: strings,
  metadata: z.object({
    differences: strings,
    levelsDecidedOnOwnEvidence: strings,
  }),
  books: z.record(z.string(), z.string()),
  outstanding: strings,
  noticeChain: z.record(z.string(), z.string()),
});

export const launchReassessmentSchema = z.object({
  run: z.string(),
  admittedKeys: strings,
  dependentlyOmittedKeys: strings,
  namedHolds: z.record(z.string(), z.string()),
});

export const assessmentHistorySchema = z.array(
  z.object({
    status: z.literal('unresolved'),
    contentFingerprint: z.string(),
    holdIds: strings,
    noticeHoldIds: strings,
    rationale: z.string(),
    reviewedOn: z.string(),
  }),
);

type LaunchRow = {
  name: string;
  externalKey: string;
  citedSources: unknown[];
  disposition: string;
  assessmentStatus: string;
  holdIds: string[];
  noticeHoldIds: string[];
  assessmentHistory?: z.infer<typeof assessmentHistorySchema>;
};
type LaunchReview = z.infer<typeof launchReviewSchema>;
type LaunchReassessment = z.infer<typeof launchReassessmentSchema>;

const hash = (s: string | Buffer) =>
  createHash('sha256').update(s).digest('hex');

/** Each launch row cites the literal pinned PCGen rows and its book pages. */
export async function expectPinnedPcgenRows(
  row: LaunchRow,
  launchReview: LaunchReview,
) {
  const { pcgen } = launchReview;
  const bytes = await readFile(join('tests/fixtures/pinned/pcgen', pcgen.path));
  const lines = bytes.toString().split('\n');
  expect(hash(bytes), row.name).toBe(pcgen.fileSha256);
  expect(lines[pcgen.line - 1], row.name).toBe(pcgen.literalRow);
  expect(hash(pcgen.literalRow), row.name).toBe(pcgen.lineSha256);
  expect(lines[pcgen.baseRow.line - 1], row.name).toBe(
    pcgen.baseRow.literalRow,
  );
  expect(hash(pcgen.baseRow.literalRow), row.name).toBe(
    pcgen.baseRow.lineSha256,
  );
  expect(pcgen.textMatches, row.name).toBe(pcgen.wordDifferences.length === 0);
  const cited = z
    .array(z.object({ id: z.string(), pages: z.string() }))
    .parse(row.citedSources);
  expect(launchReview.books, row.name).toEqual(
    Object.fromEntries(cited.map((source) => [source.id, source.pages])),
  );
  for (const source of cited)
    expect(pcgen.baseRow.literalRow, row.name).toContain(
      `SOURCEPAGE:p.${source.pages}`,
    );
}

/**
 * A named hold keeps the row held; every other launch row is confirmed and
 * its rationale supersedes the batch's whole-content hold.
 */
export function expectLaunchOutcome(
  row: LaunchRow,
  { batch, launch }: { batch: number; launch: LaunchReassessment },
) {
  const id = row.externalKey.split('/')[1];
  const whole = `spells-${batch}-whole-content-${id}`;
  expect(row.assessmentHistory?.[0]?.holdIds, row.name).toEqual([whole]);
  const assessment = reviewedAdmission.assessments.find(
    (r) => r.externalKey === row.externalKey,
  );
  const named = launch.namedHolds[row.externalKey];
  if (named) {
    expect(row, row.name).toMatchObject({
      disposition: 'held',
      assessmentStatus: 'unresolved',
      holdIds: [named],
    });
    expect(assessment?.status, row.name).toBe('unresolved');
    expect(assessment?.rationale, row.name).toContain(named);
    return;
  }
  expect(row, row.name).toMatchObject({
    disposition: launch.admittedKeys.includes(row.externalKey)
      ? 'admitted'
      : 'dependently-omitted',
    assessmentStatus: 'confirmed',
    holdIds: [],
    noticeHoldIds: [],
  });
  expect(assessment?.status, row.name).toBe('confirmed');
  expect(assessment?.rationale, row.name).toContain(whole);
}
