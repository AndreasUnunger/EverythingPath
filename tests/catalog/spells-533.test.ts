// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { beforeAll, expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import { importCatalog } from '../../scripts/catalog/import';
import {
  computeFingerprint,
  assessCatalogAdmission,
  buildAssessmentBinding,
} from '../../scripts/catalog/admission';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import {
  sourceDescription,
  upstreamRecord,
} from '../../scripts/catalog/records';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import { calculateCharacterSheetProjections } from '../../src/lib/character-sheet';
import {
  review,
  spells,
  preview,
  bindingPreview,
  provenance,
  snapshot,
  preserved,
} from '../fixtures/spells-533/data';
import { spellFixture, recordedSpellSheet } from '../fixtures/spells-533/sheet';
import {
  findCommittedBatchOwnershipProblems,
  findRecordedBindingProblems,
} from './batch-ownership';
const root = resolve('tests/fixtures/spells-533');
const keys = spells.map((r) => r.externalKey);
const hash = (s: string | Buffer) =>
  createHash('sha256').update(s).digest('hex');
const inputs = {
  systemPath: join(root, 'pf1'),
  contentPath: join(root, 'pf1-content'),
  remaps: bindingPreview.remaps,
  curation: reviewedCuration,
};
let selected: Awaited<ReturnType<typeof importCatalog>>,
  context: Awaited<ReturnType<typeof importCatalog>>;
beforeAll(async () => {
  selected = await importCatalog({ ...inputs, candidateKeys: keys });
  context = await importCatalog({
    ...inputs,
    candidateKeys: bindingPreview.entries.map((r) => r.externalKey),
  });
});
it('reviews exactly the ordered100 Spell keys and keeps both literal3.5 tags held', async () => {
  expect(review.ticket).toBe(533);
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(hash(keys.join('\n'))).toBe(provenance.orderedTicketKeysSha256);
  expect(review.summary).toEqual({
    rawCandidates: 100,
    spellDefinitions: 100,
    held: 100,
    admitted: 0,
    excluded: 0,
    dependentOmissions: 0,
    unsupportedProseOnly: 0,
    recordLevel35Holds: 2,
  });
  const tagged: string[] = [];
  const domainOnly: string[] = [];
  for (const row of spells) {
    const bytes = await readFile(join(inputs.systemPath, row.source.path));
    const raw = upstreamRecord.parse(parse(bytes.toString()));
    expect(hash(bytes)).toBe(row.source.sha256);
    expect(raw._key).toBe('!items!' + row.externalKey.split('/')[1]);
    expect(raw.type).toBe('spell');
    expect(sourceDescription(raw)).toBe(row.fullContentReview.descriptionText);
    expect(hash(sourceDescription(raw))).toBe(row.descriptionSha256);
    expect(raw.system).toEqual(row.fullContentReview.completeRawSystem);
    expect(raw.system.sources).toEqual(row.citedSources);
    const entry = selected.catalog.entries.find(
      (e) => e.externalKey === row.externalKey,
    );
    if (entry?.detail.kind !== 'spell') throw new Error(row.name);
    expect(entry.detail.levels).toEqual(
      z
        .object({ class: z.record(z.string(), z.number()).optional() })
        .parse(raw.system.learnedAt).class ?? {},
    );
    if (
      !Object.hasOwn(
        z.record(z.string(), z.unknown()).parse(raw.system.learnedAt),
        'class',
      )
    ) {
      domainOnly.push(row.name);
      expect(raw.system.learnedAt).toEqual({ domain: { Darkness: 4 } });
      expect(raw.system.level).toBe(4);
      expect(entry.detail.grantedLevels).toEqual({ domain: { Darkness: 4 } });
      expect(entry.detail.levels).toEqual({});
    }
    expect(entry.modifiers).toEqual([]);
    expect(row.mechanicsReview.outstanding.length).toBeGreaterThan(0);
    if (
      z
        .array(z.string())
        .parse(raw.system.tags ?? [])
        .includes('3.5')
    ) {
      tagged.push(row.name);
      expect(row.holdIds).toContain(
        'spells-533-' + raw._id + '-record-level3.5tag',
      );
    }
  }
  expect(tagged).toEqual(['Armor of Darkness', 'Sand Whirlwind, Greater']);
  expect(domainOnly).toEqual(['Armor of Darkness']);
});
it('keeps complete root Notes separate from unexpanded governing rules and protected history', () => {
  for (const row of spells) {
    const record = reviewedCuration.records.find(
      (r) => r.externalKey === row.externalKey && r.kind === 'description',
    );
    expect(record).toMatchObject({
      status: 'checked',
      text: row.fullContentReview.descriptionText,
      reviewedBy: 'Sol (AI curator) for the owner',
      reviewedOn: '2026-10-11',
    });
    expect(record?.outputs).toEqual(
      row.mechanicsReview.protectedHistoricalContext
        ? []
        : row.mechanicsReview.reviewedOptionalOutputs,
    );
    expect(record?.diagnostics.map((r) => r.text)).toEqual(
      row.mechanicsReview.protectedHistoricalContext
        ? []
        : row.mechanicsReview.outstanding,
    );
    expect(row.mechanicsReview.governingSpellBodies).toEqual([]);
    for (const note of row.mechanicsReview.reviewedOptionalOutputs) {
      expect(note.kind).toBe('note');
      if (note.kind === 'note')
        expect(note.text.length).toBeLessThanOrEqual(4096);
    }
  }
});
it('enforces every inherited notice minimum and preserves current source-bound assessments', () => {
  for (const requirement of review.noticeRequirements) {
    if (requirement.book === 'PZO1110') {
      expect(requirement.registryKeys).toEqual(['CRB']);
      expect(requirement.holdId).toBeNull();
    } else
      expect(
        heldNotices.find((r) => r.id === requirement.holdId),
      ).toMatchObject({
        notices: expect.arrayContaining([
          requirement.book,
          ...requirement.registryKeys,
        ]),
        evidence: ['scripts/catalog/legal/spells-533.json'],
      });
  }
  for (const row of spells) {
    for (const dep of row.inheritedNoticeReview) {
      expect(row.requiredNotices).toContain(dep.book);
      expect(hash(dep.evidence)).toBe(dep.evidenceSha256);
    }
    expect(row.requiredNotices).toContain('PZO1131');
    const entry = context.catalog.entries.find(
      (e) => e.externalKey === row.externalKey,
    );
    if (!entry) throw new Error(row.name);
    const binding = buildAssessmentBinding({
      entry,
      artifact: context,
      ...reviewedAdmission,
      requiredNotices: row.requiredNotices,
      evidenceIds: [row.evidenceId],
    });
    expect(
      reviewedAdmission.assessments.find(
        (r) => r.externalKey === row.externalKey,
      ),
    ).toMatchObject({
      ...binding,
      status: 'unresolved',
      requiredNotices: row.requiredNotices,
    });
    expect(
      findRecordedBindingProblems({
        recorded: row.binding,
        current: binding,
        evidenceId: row.evidenceId,
      }),
      row.name,
    ).toEqual([]);
  }
  const gate = assessCatalogAdmission({
    artifact: context,
    ...reviewedAdmission,
  });
  expect(gate.admitted.filter((r) => keys.includes(r.externalKey))).toEqual([]);
  expect(computeFingerprint(selected.catalog.entries)).toBe(
    computeFingerprint(preview.entries),
  );
  expect(computeFingerprint(context.catalog.entries)).toBe(
    computeFingerprint(bindingPreview.entries),
  );
  expect(selected.curation.passed).toBe(true);
  expect(selected.curation.summary.required).toBe(0);
  expect(selected.curation.summary.descriptions.checked).toBe(100);
});
it.each([
  ['Death Knell', '+2 enhancement bonus to Strength'],
  ['Heightened Reflexes', '+10 competence bonus'],
  ['Stoneskin', 'maximum 150 points'],
  ['Heal, Mass', '250'],
  ['Alter Self', '+2 size bonus to your Dexterity'],
  ['Incorporeal Chains', '10 + its CMB'],
  ['Pesh Vigor', 'maximum enhancement bonus of +10'],
  ['Instant Weapon', 'proficient with this weapon'],
  ['Calculated Luck', '3d8'],
  ['Release the Hounds', '25%'],
])(
  'preserves real %s rules without applying a recorded Spell as an effect',
  (name, fragment) => {
    const row = spells.find((r) => r.name === name);
    expect(row?.mechanicsReview.manualRule).toContain(fragment);
    const spell = spellFixture(name),
      tag = Object.keys(spell.detail.levels)[0];
    if (!tag) throw new Error(name);
    const projections = calculateCharacterSheetProjections(
      recordedSpellSheet(name, tag),
    );
    for (const calculated of [projections.current, projections.permanent]) {
      expect(calculated.abilities.strength.score).toBe(10);
      expect(calculated.abilities.constitution.score).toBe(10);
      expect(calculated.spellEffects).toEqual([]);
    }
  },
);
it('retains literal contradictions and uses the shared fear Situation on its actual clause', () => {
  expect(
    spells
      .find((r) => r.name === 'Incorporeal Chains')
      ?.mechanicsReview.discrepancies.join(' '),
  ).toContain('0.5');
  expect(
    spells
      .find((r) => r.name === 'Iron Stake')
      ?.mechanicsReview.discrepancies.join(' '),
  ).toContain('ranged touch');
  expect(
    spells
      .find((r) => r.name === 'Animus Mine, Greater')
      ?.mechanicsReview.discrepancies.join(' '),
  ).toContain('Will negates');
  expect(
    spells.find((r) => r.name === 'Free Spirit')?.mechanicsReview
      .reviewedOptionalOutputs,
  ).toContainEqual({
    kind: 'note',
    text: 'granting you a +4 bonus on saving throws against fear effects.',
    situation: 'fear',
  });
});
it('independently checks the historical definitions its fixture protects, including covered holds', () => {
  const protection = z
    .object({
      protectedRoots: z.array(z.string()),
      definitions: z.record(z.string(), z.string()),
    })
    .parse(snapshot('protected-context.json'));
  expect(protection.protectedRoots).toHaveLength(20);
  for (const entry of context.catalog.entries) {
    const expected = protection.definitions[entry.externalKey];
    if (expected)
      expect(computeFingerprint(entry), entry.externalKey).toBe(expected);
  }
  const proof = z
    .object({
      sourceHistoricalBindings: z.number(),
      localHistoricalBindings: z.number(),
      totalHistoricalBindings: z.number(),
      missingHistoricalBindings: z.array(z.string()),
    })
    .parse(snapshot('historical-binding-proof.json'));
  expect(proof).toMatchObject({
    sourceHistoricalBindings: 3997,
    localHistoricalBindings: 34,
    totalHistoricalBindings: 4031,
    missingHistoricalBindings: [],
  });
});

it('keeps its own description records, assessments, evidence and holds as recorded', () => {
  expect(
    findCommittedBatchOwnershipProblems(
      'scripts/catalog/legal/spells-533.json',
    ),
  ).toEqual([]);
});
it('keeps its whole-history preservation manifest on disk until the #744 cleanup', () => {
  // #749 retired this manifest's checks; the file itself stays as recorded.
  expect(preserved.rawCommitments).toHaveLength(13830);
});
it('independently checks whole PCGen positive DisplayFullSpell branches and their textual comparisons', async () => {
  let count = 0,
    matches = 0;
  const normalized = (s: string) =>
    s
      .replace(/&amp;/g, '&')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();
  for (const row of spells) {
    const comparison = row.fullContentReview.directComparison;
    if (!comparison) continue;
    const bytes = await readFile(join(root, comparison.source)),
      lines = bytes.toString().split('\n');
    expect(hash(bytes)).toBe(comparison.fileSha256);
    expect(lines[comparison.line - 1]).toBe(comparison.text);
    expect(hash(comparison.text)).toBe(comparison.lineSha256);
    const full = comparison.fullDescription;
    if (!full) throw new Error(row.name);
    expect(lines[full.line - 1]).toBe(full.text);
    expect(hash(full.text)).toBe(full.lineSha256);
    expect(full.text).toContain('|PRERULE:1,DisplayFullSpell');
    expect(full.text).not.toContain('|!PRERULE:1,DisplayFullSpell');
    const body = full.text.split('DESC:')[1]?.split('|PRERULE:')[0];
    if (!body) throw new Error(row.name);
    const equal =
      normalized(row.mechanicsReview.manualRule) === normalized(body);
    expect(full.normalizedEqual, row.name).toBe(equal);
    count++;
    if (equal) matches++;
  }
  expect(count).toBe(21);
  expect(matches).toBe(17);
});
it('retains unexpanded governing bodies, source-owned class mechanics and partial creature comparisons with honest scopes', async () => {
  const inventory = z
    .object({
      candidates: z.array(
        z.object({
          name: z.string(),
          mechanicsReview: z.object({
            unexpandedGoverningSpellBodies: z.array(
              z.object({
                name: z.string(),
                descriptionText: z.string(),
                descriptionSha256: z.string(),
                fixturePath: z.string(),
                rawBodyComplete: z.boolean(),
                completeGoverningBody: z.boolean(),
                application: z.string(),
                noteCount: z.number(),
                omittedGoverningClauses: z.string(),
              }),
            ),
            nonSpellSupportingBodies: z.array(
              z.object({
                name: z.string(),
                fixturePath: z.string(),
                sha256: z.string(),
                completeRawRecord: z.record(z.string(), z.unknown()),
                application: z.string(),
                noteCount: z.number(),
              }),
            ),
            missingSupportingBodies: z.array(z.unknown()),
          }),
          fullContentReview: z.object({
            partialCreatureComparison: z
              .object({
                source: z.string(),
                fileSha256: z.string(),
                rawRaceRows: z.array(
                  z.object({
                    line: z.number(),
                    text: z.string(),
                    lineSha256: z.string(),
                  }),
                ),
                role: z.literal('partial-creature-dataset-comparison'),
                omittedGoverningClauses: z.string(),
              })
              .optional(),
          }),
        }),
      ),
    })
    .parse(snapshot('../../../scripts/catalog/legal/spells-533.json'));
  expect(
    inventory.candidates.filter(
      (r) => r.mechanicsReview.unexpandedGoverningSpellBodies.length,
    ),
  ).toHaveLength(31);
  expect(
    inventory.candidates.filter(
      (r) => r.mechanicsReview.missingSupportingBodies.length,
    ),
  ).toHaveLength(12);
  expect(
    inventory.candidates.filter(
      (r) => r.fullContentReview.partialCreatureComparison,
    ),
  ).toHaveLength(4);
  for (const row of inventory.candidates) {
    for (const base of row.mechanicsReview.unexpandedGoverningSpellBodies) {
      const raw = upstreamRecord.parse(
        parse(await readFile(join(root, base.fixturePath), 'utf8')),
      );
      expect(raw.type).toBe('spell');
      expect(raw.name).toBe(base.name);
      expect(sourceDescription(raw)).toBe(base.descriptionText);
      expect(hash(base.descriptionText)).toBe(base.descriptionSha256);
      expect(base).toMatchObject({
        rawBodyComplete: true,
        completeGoverningBody: false,
        application: 'unapplied-pending-composition',
        noteCount: 0,
      });
      expect(base.omittedGoverningClauses).toContain('termination');
    }
    for (const base of row.mechanicsReview.nonSpellSupportingBodies) {
      const bytes = await readFile(join(root, base.fixturePath));
      expect(hash(bytes)).toBe(base.sha256);
      expect(parse(bytes.toString())).toEqual(base.completeRawRecord);
      expect(base.application).toBe('audit-only');
      expect(base.noteCount).toBe(0);
    }
    const comparison = row.fullContentReview.partialCreatureComparison;
    if (comparison) {
      const bytes = await readFile(join(root, comparison.source));
      expect(hash(bytes)).toBe(comparison.fileSha256);
      const lines = bytes.toString().split('\n');
      for (const line of comparison.rawRaceRows) {
        expect(lines[line.line - 1]).toBe(line.text);
        expect(hash(line.text)).toBe(line.lineSha256);
      }
      expect(comparison.omittedGoverningClauses).toContain('outstanding');
    }
  }
  expect(
    spells.find((r) => r.name === 'Radiation Ward')?.requiredNotices,
  ).toContain('PZO9272');
  expect(
    spells.find((r) => r.name === 'Summon Flight of Eagles')?.requiredNotices,
  ).toContain('PZO1112');
});

it('separates incidental notice evidence from candidate-governing requirements', () => {
  const scoped = z
    .object({
      candidates: z.array(
        z.object({
          externalKey: z.string(),
          name: z.string(),
          requiredNotices: z.array(z.string()),
          inheritedNoticeReview: z.array(
            z.object({ externalKey: z.string(), book: z.string() }),
          ),
          auditNoticeReview: z.array(
            z.object({
              externalKey: z.string(),
              requirementRole: z.literal(
                'audit-only-not-a-root-notice-minimum',
              ),
            }),
          ),
          mechanicsReview: z.object({
            unexpandedGoverningSpellBodies: z.array(
              z.object({ externalKey: z.string() }),
            ),
            nonSpellSupportingBodies: z.array(
              z.object({ externalKey: z.string() }),
            ),
          }),
        }),
      ),
    })
    .parse(snapshot('../../../scripts/catalog/legal/spells-533.json'));
  for (const row of scoped.candidates) {
    const applicable = new Set([
      row.externalKey,
      ...row.mechanicsReview.unexpandedGoverningSpellBodies.map(
        (r) => r.externalKey,
      ),
      ...row.mechanicsReview.nonSpellSupportingBodies.map((r) => r.externalKey),
    ]);
    for (const dep of row.inheritedNoticeReview)
      expect(
        applicable.has(dep.externalKey),
        row.name + ' ' + dep.externalKey,
      ).toBe(true);
    for (const dep of row.auditNoticeReview)
      expect(
        applicable.has(dep.externalKey),
        row.name + ' audit ' + dep.externalKey,
      ).toBe(false);
  }
  const detect = scoped.candidates.find((r) => r.name === 'Detect Charm');
  expect(detect?.requiredNotices).not.toContain('PZO1112');
  expect(detect?.auditNoticeReview.length).toBeGreaterThan(0);
});
